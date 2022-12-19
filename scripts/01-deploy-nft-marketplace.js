const {network}= require("hardhat");
const {developmentChains}=require("../helper-harhat-config")
const {verify}=require("../utils/verify");

module.exports=async({getNamedAccounts,deployments})=>{
    const {deploy,log}=deployments
    const {deployer}=await getNamedAccounts();

    let args=[];

    const nftMarktplace= await deploy("Marktplace",{
        from:deployer,
        args:args,
        log:true,
        waitConfirmations:network.config.developmentChains||1,
    }) 

    if(!developmentChains.includes(network.name)&&process.env.ETHERSCAN_API_KEY){
        log("Verifying...")
        await verify(nftMarktplace.address,args)
    }
    log("---------------------------------------")
}
 
module.exports.tags=["all","nftMarketplace"]