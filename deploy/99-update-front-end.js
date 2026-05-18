const { network } = require("hardhat")
const fs = require("fs")
const path = require("path")

const frontendContractsFile = "../nft-alchemy/constants/networkMapping.json"
const frontEndAbiLocation   = "../nft-alchemy/constants/"

module.exports = async function ({ deployments }) {
    // String "false" is truthy in JS — must compare explicitly
    if (process.env.UPDATE_FRONT_END !== "true") return

    console.log("Updating front end...")
    await updateContractAddresses(deployments)
    await updateAbi(deployments)
    console.log("Front end updated.")
}

async function updateAbi(deployments) {
    const nftMarketplace = await deployments.get("NftMarketplace")
    const basicNft       = await deployments.get("BasicNft")

    fs.writeFileSync(
        path.join(__dirname, `${frontEndAbiLocation}nftMarketplace.json`),
        JSON.stringify(nftMarketplace.abi, null, 2)
    )
    fs.writeFileSync(
        path.join(__dirname, `${frontEndAbiLocation}basicNft.json`),
        JSON.stringify(basicNft.abi, null, 2)
    )
}

async function updateContractAddresses(deployments) {
    const nftMarketplace = await deployments.get("NftMarketplace")
    const chainId        = network.config.chainId.toString()
    const filePath       = path.join(__dirname, frontendContractsFile)

    const contractAddresses = fs.existsSync(filePath)
        ? JSON.parse(fs.readFileSync(filePath, "utf8"))
        : {}

    if (!contractAddresses[chainId]) {
        contractAddresses[chainId] = { NftMarketplace: [] }
    }
    if (!contractAddresses[chainId]["NftMarketplace"]) {
        contractAddresses[chainId]["NftMarketplace"] = []
    }
    if (!contractAddresses[chainId]["NftMarketplace"].includes(nftMarketplace.address)) {
        contractAddresses[chainId]["NftMarketplace"].push(nftMarketplace.address)
    }

    fs.writeFileSync(filePath, JSON.stringify(contractAddresses, null, 2))
}

module.exports.tags = ["all", "frontend"]
