//SPDX-License-Identifier:MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error NftMarketplace_PriceMustBeAbove0();
error NftMarketplace_NotApprovedForMarketplace();
error NftMarketPlace_AlreadyListed(address nftAddress,uint256 tokenId);
error NftMarketplace_NotOwner();
contract Marketplace {
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

    mapping(address=>mapping(uint256=>Listing)) private s_listings;

    // constructor() {
    // }

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
            revert NftMarketplace_NotOwner();
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
}       