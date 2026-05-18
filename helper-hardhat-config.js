const networkConfig = {
    31337: {
        name: "localhost",
    },
    11155111: {
        name: "sepolia",
    },
}

const developmentChains = ["hardhat", "localhost"]

const VERIFICATION_BLOCK_CONFIRMATIONS = 6

const frontEndContractsFile = "../nft-alchemy/constants/networkMapping.json"
const frontEndAbiLocation   = "../nft-alchemy/constants/"

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    frontEndContractsFile,
    frontEndAbiLocation,
}
