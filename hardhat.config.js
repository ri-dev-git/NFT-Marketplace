require("@nomicfoundation/hardhat-toolbox")
require("hardhat-deploy")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/your-api-key"
const PRIVATE_KEY     = process.env.PRIVATE_KEY     || "0x0000000000000000000000000000000000000000000000000000000000000001"
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ""
const REPORT_GAS      = process.env.REPORT_GAS === "true"

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    defaultNetwork: "hardhat",

    networks: {
        hardhat: {
            chainId: 31337,
        },
        localhost: {
            chainId: 31337,
        },
        sepolia: {
            url: SEPOLIA_RPC_URL,
            accounts: PRIVATE_KEY !== "0x0000000000000000000000000000000000000000000000000000000000000001"
                ? [PRIVATE_KEY]
                : [],
            chainId: 11155111,
            blockConfirmations: 6,
            saveDeployments: true,
        },
    },

    // Single string key = Etherscan V2 API. Network-keyed object triggers deprecated V1.
    etherscan: {
        apiKey: ETHERSCAN_API_KEY,
    },

    solidity: {
        compilers: [
            {
                version: "0.8.28",
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 200,
                    },
                    evmVersion: "cancun",
                },
            },
        ],
    },

    gasReporter: {
        enabled: REPORT_GAS,
        currency: "USD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },

    contractSizer: {
        runOnCompile: false,
        only: ["NftMarketplace"],
    },

    namedAccounts: {
        deployer: {
            default: 0,
            11155111: 0,
        },
        player: {
            default: 1,
        },
    },

    mocha: {
        timeout: 200000,
    },
}
