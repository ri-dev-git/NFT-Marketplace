const { network, ethers } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    const isLocal = developmentChains.includes(network.name)
    const waitConfirmations = isLocal ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS

    log("════════════════════════════════════════════")
    log(`  Network  : ${network.name}`)
    log(`  Deployer : ${deployer}`)
    log("════════════════════════════════════════════")

    const nftMarketplace = await deploy("NftMarketplace", {
        from: deployer,
        args: [],
        log: true,
        waitConfirmations,
    })

    log("")
    log("  Contract : NftMarketplace")
    log(`  Address  : ${nftMarketplace.address}`)
    log(`  Tx Hash  : ${nftMarketplace.transactionHash}`)
    log(`  Etherscan: https://sepolia.etherscan.io/address/${nftMarketplace.address}`)
    log("")

    if (!isLocal && process.env.ETHERSCAN_API_KEY) {
        log("  Verifying on Etherscan (waiting for propagation)...")
        await verify(nftMarketplace.address, [])
        log(`  Verified : https://sepolia.etherscan.io/address/${nftMarketplace.address}#code`)
    }

    log("════════════════════════════════════════════")
}

module.exports.tags = ["all", "NftMarketplace"]
