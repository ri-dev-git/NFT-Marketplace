// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title  NftMarketplace
 * @author Babbage Lab (babbagelab.tech)
 * @notice A non-custodial NFT marketplace. Sellers keep their NFT in their wallet
 *         until a buyer purchases it. The marketplace only holds ETH proceeds —
 *         never the NFTs themselves.
 * @dev    Security model:
 *           - ReentrancyGuard on every state-changing function
 *           - Pausable emergency stop controlled by owner
 *           - Checks-Effects-Interactions pattern throughout
 *           - isSeller check on cancel/update prevents griefing by third parties
 */
contract NftMarketplace is ReentrancyGuard, Pausable, Ownable {

    // ─────────────────────────────────────────────
    //  Custom Errors
    // ─────────────────────────────────────────────

    error NftMarketplace__PriceMustBeAboveZero();
    error NftMarketplace__NotApprovedForMarketplace();
    error NftMarketplace__AlreadyListed(address nftAddress, uint256 tokenId);
    error NftMarketplace__NotOwner();
    error NftMarketplace__NotSeller();
    error NftMarketplace__NotListed(address nftAddress, uint256 tokenId);
    error NftMarketplace__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
    error NftMarketplace__NoProceeds();
    error NftMarketplace__TransferFailed();
    error NftMarketplace__ZeroAddress();
    error NftMarketplace__CannotBuyOwnListing();

    // ─────────────────────────────────────────────
    //  Types
    // ─────────────────────────────────────────────

    struct Listing {
        uint256 price;
        address seller;
    }

    // ─────────────────────────────────────────────
    //  Events
    // ─────────────────────────────────────────────

    /// @notice Fired when an NFT is listed for sale. Indexed on all three address/id fields
    ///         so The Graph can filter by seller, collection, or specific token efficiently.
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    /// @notice Fired when an NFT is purchased.
    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );

    /// @notice Fired when a seller cancels their listing.
    event ItemCancelled(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId
    );

    /// @notice Fired when a seller updates their listing price. Separate from ItemListed
    ///         so off-chain indexers can distinguish a price change from a new listing.
    event ItemUpdated(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 newPrice
    );

    /// @notice Fired when a seller withdraws accumulated proceeds.
    event ProceedsWithdrawn(
        address indexed seller,
        uint256 amount
    );

    // ─────────────────────────────────────────────
    //  State
    // ─────────────────────────────────────────────

    /// @dev NFT contract address → Token ID → Listing details
    mapping(address => mapping(uint256 => Listing)) private s_listings;

    /// @dev Seller address → Accumulated proceeds in wei (pull-over-push pattern)
    mapping(address => uint256) private s_proceeds;

    // ─────────────────────────────────────────────
    //  Modifiers
    // ─────────────────────────────────────────────

    /// @dev Reverts if the token already has an active listing (price > 0).
    modifier notListed(address nftAddress, uint256 tokenId) {
        if (s_listings[nftAddress][tokenId].price > 0) {
            revert NftMarketplace__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    /// @dev Reverts if the token does not have an active listing.
    modifier isListed(address nftAddress, uint256 tokenId) {
        if (s_listings[nftAddress][tokenId].price == 0) {
            revert NftMarketplace__NotListed(nftAddress, tokenId);
        }
        _;
    }

    /// @dev Reverts if spender is not the current ERC-721 owner of the token.
    ///      Zero-address check runs here so it fires before the external ownerOf call,
    ///      which would otherwise revert with no reason on address(0).
    ///      Used only at listing time — subsequent operations check the stored seller.
    modifier isNftOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ) {
        if (nftAddress == address(0)) revert NftMarketplace__ZeroAddress();
        if (IERC721(nftAddress).ownerOf(tokenId) != spender) {
            revert NftMarketplace__NotOwner();
        }
        _;
    }

    /// @dev Reverts if caller is not the address that originally created the listing.
    ///      Cheaper than re-querying ownerOf and correctly handles the edge case where
    ///      an NFT is transferred after listing (original seller can still cancel).
    modifier isSeller(address nftAddress, uint256 tokenId) {
        if (s_listings[nftAddress][tokenId].seller != msg.sender) {
            revert NftMarketplace__NotSeller();
        }
        _;
    }

    // ─────────────────────────────────────────────
    //  Constructor
    // ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─────────────────────────────────────────────
    //  Core Marketplace Functions
    // ─────────────────────────────────────────────

    /**
     * @notice List an NFT for sale on the marketplace.
     * @dev    The NFT stays in the seller's wallet. The marketplace must be approved
     *         to transfer it before this call (via ERC-721 approve or setApprovalForAll).
     *         Reverts when the marketplace is paused.
     * @param  nftAddress  The ERC-721 contract address of the token to list.
     * @param  tokenId     The token ID to list.
     * @param  price       The sale price in wei. Must be greater than zero.
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        whenNotPaused
        nonReentrant
        notListed(nftAddress, tokenId)
        isNftOwner(nftAddress, tokenId, msg.sender)
    {
        if (price == 0) revert NftMarketplace__PriceMustBeAboveZero();
        if (IERC721(nftAddress).getApproved(tokenId) != address(this)) {
            revert NftMarketplace__NotApprovedForMarketplace();
        }

        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    /**
     * @notice Purchase a listed NFT by sending at least the listing price in ETH.
     * @dev    Follows Checks-Effects-Interactions:
     *           1. Checks  — price met, not own listing
     *           2. Effects — credit seller proceeds, delete listing
     *           3. Interact — safeTransferFrom NFT to buyer
     *         Reverts when the marketplace is paused.
     * @param  nftAddress  The ERC-721 contract address of the token to buy.
     * @param  tokenId     The token ID to buy.
     */
    function buyItem(
        address nftAddress,
        uint256 tokenId
    )
        external
        payable
        whenNotPaused
        nonReentrant
        isListed(nftAddress, tokenId)
    {
        Listing memory listedItem = s_listings[nftAddress][tokenId];

        if (msg.value < listedItem.price) {
            revert NftMarketplace__PriceNotMet(nftAddress, tokenId, listedItem.price);
        }
        if (msg.sender == listedItem.seller) {
            revert NftMarketplace__CannotBuyOwnListing();
        }

        // Effects before interactions
        s_proceeds[listedItem.seller] += listedItem.price;
        delete s_listings[nftAddress][tokenId];

        // Interaction: transfer NFT. safeTransferFrom will call onERC721Received on contracts.
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }

    /**
     * @notice Cancel an active listing. Only the seller who created the listing may cancel.
     * @dev    Checks the stored seller address, not the current NFT owner. This correctly
     *         allows cancellation even if the underlying NFT was transferred after listing,
     *         and prevents a new token holder from cancelling someone else's listing.
     * @param  nftAddress  The ERC-721 contract address of the listed token.
     * @param  tokenId     The token ID of the listing to cancel.
     */
    function cancelListing(
        address nftAddress,
        uint256 tokenId
    )
        external
        nonReentrant
        isListed(nftAddress, tokenId)
        isSeller(nftAddress, tokenId)
    {
        delete s_listings[nftAddress][tokenId];
        emit ItemCancelled(msg.sender, nftAddress, tokenId);
    }

    /**
     * @notice Update the price of an existing listing.
     * @dev    Emits ItemUpdated (not ItemListed) so off-chain indexers can distinguish
     *         a price change from a brand-new listing. Only the original seller may update.
     *         Reverts when the marketplace is paused.
     * @param  nftAddress  The ERC-721 contract address of the listed token.
     * @param  tokenId     The token ID of the listing to update.
     * @param  newPrice    The new sale price in wei. Must be greater than zero.
     */
    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    )
        external
        whenNotPaused
        nonReentrant
        isListed(nftAddress, tokenId)
        isSeller(nftAddress, tokenId)
    {
        if (newPrice == 0) revert NftMarketplace__PriceMustBeAboveZero();
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemUpdated(msg.sender, nftAddress, tokenId, newPrice);
    }

    /**
     * @notice Withdraw all accumulated sale proceeds to the caller's wallet.
     * @dev    Pull-over-push pattern: sellers accumulate proceeds in a mapping and
     *         withdraw on demand. This avoids push failures if a seller is a contract.
     *         Balance is zeroed before the transfer (CEI) to prevent reentrancy,
     *         and nonReentrant provides a second layer of defence.
     */
    function withdrawProceeds() external nonReentrant {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds == 0) revert NftMarketplace__NoProceeds();

        // Effect before interaction
        s_proceeds[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) revert NftMarketplace__TransferFailed();

        emit ProceedsWithdrawn(msg.sender, proceeds);
    }

    // ─────────────────────────────────────────────
    //  Admin — Emergency Controls
    // ─────────────────────────────────────────────

    /**
     * @notice Pause the marketplace. Listing, buying, and updating are disabled.
     *         Cancellations and withdrawals remain available so users can recover funds.
     * @dev    Only callable by the contract owner. Use in the event of a critical bug.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the marketplace and resume normal operations.
     * @dev    Only callable by the contract owner.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─────────────────────────────────────────────
    //  View Functions
    // ─────────────────────────────────────────────

    /**
     * @notice Retrieve the active listing for a specific token.
     * @param  nftAddress  The ERC-721 contract address.
     * @param  tokenId     The token ID.
     * @return             A Listing struct with price and seller. Price is 0 if not listed.
     */
    function getListing(address nftAddress, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return s_listings[nftAddress][tokenId];
    }

    /**
     * @notice Retrieve the accumulated proceeds available for a seller to withdraw.
     * @param  seller  The seller's wallet address.
     * @return         Amount in wei available to withdraw.
     */
    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
