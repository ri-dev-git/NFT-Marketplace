const { ethers } = require("hardhat")
const frontendContractsFile="../nextjs-nftmarketplace/constants/networkMapping.json"
const frontEndAbiLocation="../nextjs-nftmarketplace/constants/"
// C:\Users\Lenovo\Desktop\blockchain\nextjs-nftmarketplace
const fs = require('fs')
const { network } = require("hardhat")

module.exports= async function (){
    if(process.env.UPDATE_FRONT_END){
        console.log("updating front end...")
        await updateContractAddresses()
        await updateAbi()
        console.log("Front end written!")
    }
}


async function updateAbi() {
    const nftMarketplace = await ethers.getContract("nftMarketplace")
    fs.writeFileSync(
        `${frontEndAbiLocation}nftMarketplace.json`,
        nftMarketplace.interface.format(ethers.utils.FormatTypes.json)
    )
 

    const basicNft = await ethers.getContract("BasicNft")
    fs.writeFileSync(
        `${frontEndAbiLocation}basicNft.json`,
        basicNft.interface.format(ethers.utils.FormatTypes.json)
    )

}


async function updateContractAddresses(){
    const nftMarketplace=await ethers.getContract("nftMarketplace")
    const chainId= network.config.chainId.toString()
    const contraactAddresses=JSON.parse(fs.readFileSync(frontendContractsFile,"utf8"))
    if(chainId in contraactAddresses){
        if(!contraactAddresses[chainId]["nftMarketplace"].includes(nftMarketplace.address))
        contraactAddresses[chainId]["nftMarketplace"].push(nftMarketplace.address)
    }else{
        contraactAddresses[chainId]={nftMarketplace:[nftMarketplace.address]}
    }
    fs.writeFileSync(frontendContractsFile,JSON.stringify(contraactAddresses))
}
module.exports.tags=["all","frontend"]