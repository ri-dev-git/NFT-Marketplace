const { ethers } = require("hardhat")
const frontendContractsFile="../nextjs-nftmarketplace/constants/networkMapping.json"
// C:\Users\Lenovo\Desktop\blockchain\nextjs-nftmarketplace
const fs = require('fs')

module.exports= async function (){
    if(process.env.UPDATE_FRONT_END){
        console.log("updating front end...")
        await updateContractAddresses()
    }
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