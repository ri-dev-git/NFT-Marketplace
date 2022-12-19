//SPDX-License-Identifier:MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketplace_PriceMustBeAbove0();
error NftMarketplace_NotApprovedForMarketplace();
error NftMarketPlace_AlreadyListed(address nftAddress,uint256 tokenId);
error NftMarketplace_NotOwner();
error NftMarketplace_NotListed(address nftAddress,uint256 tokenId);
error NftMarketplace_PriceNotMet(address nftAddress,uint256 tokenId,uint256 price);
error NftMarketplace_NotProceeds();
error NftMarketPlace_TransferFailed();
  

contract nftMarketplace is ReentrancyGuard {

    struct Listing{
        uint256 price;
        address seller;
    }

    
    
    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256  price
    );


    event ItemBought(
        address indexed buyer, 
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256  price
    );

    event ItemCanceled(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId
    );
    //NFT contract address->Nft TokenID->Listing
    mapping(address=>mapping(uint256=>Listing)) private s_listings;

    //Seller address -> Amount earned
    mapping(address=>uint256) private s_proceeds; 


    modifier notListed(address nftAddress,uint256 tokenId,address owner){
        Listing memory listing =s_listings[nftAddress][tokenId];
        if(listing.price>0){
            revert NftMarketPlace_AlreadyListed(nftAddress,tokenId);
        }
        _;
    }

    modifier isOwner(address nftAddress,uint256 tokenId, address spender) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if(spender!=owner){
            revert NftMarketplace_NotOwner( );
        }
        _;
    }

    modifier isListed(address nftAddress,uint256 tokenId){
        Listing memory listing=s_listings[nftAddress][tokenId];
        if(listing.price<=0){
            revert NftMarketplace_NotListed(nftAddress,tokenId);
        }
        _;
    }


    function listItem(address nftAddress, uint256 tokenId, uint256 price ) 
        external 
        notListed(nftAddress,tokenId,msg.sender)
        isOwner(nftAddress,tokenId,msg.sender)
        {
        if(price<=0){
            revert NftMarketplace_PriceMustBeAbove0(); 
        }
        IERC721 nft =IERC721(nftAddress);
        if(nft.getApproved(tokenId)!=address(this)){
            revert NftMarketplace_NotApprovedForMarketplace();
        }
        s_listings[nftAddress][tokenId]=Listing(price,msg.sender);
        emit ItemListed(msg.sender,nftAddress,tokenId,price);
    }



    function buyItem(address nftAddress,uint256 tokenId) external payable 
        nonReentrant
        isListed(nftAddress, tokenId)
        {
            Listing memory listedItem = s_listings[nftAddress][tokenId];
            if(msg.value<listedItem.price){
                revert NftMarketplace_PriceNotMet(nftAddress,tokenId,listedItem.price);
            }
            s_proceeds[listedItem.seller]=s_proceeds[listedItem.seller]+msg.value;
            delete(s_listings[nftAddress][tokenId]);
            IERC721(nftAddress).safeTransferFrom(listedItem.seller,msg.sender,tokenId);

            emit ItemBought(msg.sender,nftAddress,tokenId,listedItem.price);

        }


    function cancelListing(address nftAddress,uint256 tokenId) external 
        isOwner(nftAddress,tokenId,msg.sender)
        isListed(nftAddress,tokenId)
        {
            delete (s_listings[nftAddress][tokenId]);
            emit ItemCanceled(msg.sender,nftAddress,tokenId);
        }


    function updateListing(address nftAddress,uint256 tokenId,uint256 newPrice) external
        isListed(nftAddress, tokenId)
        isOwner(nftAddress,tokenId,msg.sender)
        {
            s_listings[nftAddress][tokenId].price=newPrice;
            emit ItemListed(msg.sender,nftAddress,tokenId,newPrice);
        }


    function withdrawProceeds() external{
            uint256 proceeds = s_proceeds[msg.sender];
            if(proceeds<=0){
                revert NftMarketplace_NotProceeds();
            }
            s_proceeds[msg.sender]=0;
            (bool success,)=payable(msg.sender).call{value: proceeds}("");
            if(!success){
                revert NftMarketPlace_TransferFailed();
            }  
        }


    //Geters

    function getList(address nftAddress,uint256 tokenId) external view 
    returns(Listing memory)
    {
        return s_listings[nftAddress][tokenId];

    }

    function getProceeds(address seller) external view
    returns(uint256){
        return s_proceeds[seller];
    }
}       