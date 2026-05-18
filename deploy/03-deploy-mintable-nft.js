const { network } = require("hardhat")
const { developmentChains, VERIFICATION_BLOCK_CONFIRMATIONS } = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer }    = await getNamedAccounts()

    const isLocal          = developmentChains.includes(network.name)
    const waitConfirmations = isLocal ? 1 : VERIFICATION_BLOCK_CONFIRMATIONS

    log("────────────────────────────────────────────")
    const mintableNft = await deploy("MintableNft", {
        from: deployer,
        args: [],
        log:  true,
        waitConfirmations,
    })

    log(`  Address  : ${mintableNft.address}`)
    log(`  Etherscan: https://sepolia.etherscan.io/address/${mintableNft.address}`)

    if (!isLocal && process.env.ETHERSCAN_API_KEY) {
        log("  Verifying...")
        await verify(mintableNft.address, [])
    }
    log("────────────────────────────────────────────")
}

module.exports.tags = ["all", "MintableNft"]
