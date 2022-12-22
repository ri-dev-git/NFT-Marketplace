const {ethers}=require("hardhat")

const PRICE=ethers.utils.parseEther("0.1")

async function mintAndList(){
    const nftMarketplace= await ethers.getContract("nftMarketplace")
    const basicNft=await ethers.getContract("BasicNft")
    console.log("Minting....")
    const mintTx=await basicNft.mintNft()
    const mintTxReceipt = await mintTx.wait(1)
    const tokenId=mintTxReceipt.events[0].args.tokenId

    const approveTx= await basicNft.approve(nftMarketplace.address,tokenId)

    await approveTx.wait(1)
    console.log("Listing NFT...")
    const tx =await nftMarketplace.listItem(basicNft.address,tokenId,PRICE)
    await tx.wait(1)
    console.log("Listed!!")
}

mintAndList()
    .then(()=>process.exit(0))
    .catch((e)=>{
        console.error(e)
        process.exit(1)
    })