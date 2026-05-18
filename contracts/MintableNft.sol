// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title  MintableNft
 * @author Babbage Lab (babbagelab.tech)
 * @notice Open-mint ERC-721 for the NFT Marketplace demo.
 *         Any address may mint an NFT by supplying an IPFS metadata URI.
 *         The marketplace contract can transfer approved tokens on behalf of sellers.
 */
contract MintableNft is ERC721URIStorage {
    uint256 private _tokenCounter;

    /// @notice Emitted when a new token is minted.
    event NftMinted(
        address indexed owner,
        uint256 indexed tokenId,
        string  tokenUri
    );

    constructor() ERC721("Babbage Lab NFT", "BLAB") {}

    /**
     * @notice Mint a new NFT to the caller with a custom IPFS metadata URI.
     * @param  tokenUri  IPFS URL of the JSON metadata (image, name, description).
     * @return tokenId   The token ID that was minted.
     */
    function mintNft(string memory tokenUri) external returns (uint256) {
        uint256 tokenId = _tokenCounter;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, tokenUri);
        emit NftMinted(msg.sender, tokenId, tokenUri);
        _tokenCounter++;
        return tokenId;
    }

    /// @notice Returns the total number of tokens minted so far.
    function getTokenCounter() external view returns (uint256) {
        return _tokenCounter;
    }
}
