/**
 * Reads the Sepolia deployment artifact and checks Etherscan V2 verification status.
 *
 * Usage:
 *   npx hardhat run scripts/verify-deployment.js --network sepolia
 *
 * Or to re-trigger verification:
 *   npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
 */

const fs   = require("fs")
const path = require("path")

async function main() {
    const deploymentPath = path.join(
        __dirname,
        "../deployments/sepolia/NftMarketplace.json"
    )

    if (!fs.existsSync(deploymentPath)) {
        console.error("No Sepolia deployment found at:", deploymentPath)
        console.error("Deploy first with: npm run deploy:sepolia")
        process.exit(1)
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"))
    const address    = deployment.address
    const txHash     = deployment.transactionHash
    const blockNum   = deployment.receipt?.blockNumber

    console.log("\n══════════════════════════════════════════════════")
    console.log("  NftMarketplace — Sepolia Deployment")
    console.log("══════════════════════════════════════════════════")
    console.log(`  Address   : ${address}`)
    console.log(`  Tx Hash   : ${txHash}`)
    console.log(`  Block     : ${blockNum ?? "unknown"}`)
    console.log(`  Explorer  : https://sepolia.etherscan.io/address/${address}`)
    console.log(`  Source    : https://sepolia.etherscan.io/address/${address}#code`)
    console.log("══════════════════════════════════════════════════")

    if (!process.env.ETHERSCAN_API_KEY) {
        console.log("\n  ⚠  ETHERSCAN_API_KEY not set — skipping verification check")
        console.log("     Set it in .env and re-run, or verify manually:")
        console.log(`     npx hardhat verify --network sepolia ${address}`)
        return
    }

    // Etherscan V2 API — single endpoint for all chains via chainId parameter
    const apiUrl = `https://api.etherscan.io/v2/api?chainid=11155111&module=contract&action=getsourcecode&address=${address}&apikey=${process.env.ETHERSCAN_API_KEY}`

    try {
        const res    = await fetch(apiUrl)
        const data   = await res.json()
        const result = data.result?.[0]

        const isVerified   = result?.SourceCode && result.SourceCode.length > 0
        const compilerVer  = result?.CompilerVersion ?? "unknown"
        const contractName = result?.ContractName    ?? "unknown"

        console.log(`\n  Verification : ${isVerified ? "✓ VERIFIED" : "✗ NOT VERIFIED"}`)

        if (isVerified) {
            console.log(`  Contract     : ${contractName}`)
            console.log(`  Compiler     : ${compilerVer}`)
            console.log(`  ABI          : https://sepolia.etherscan.io/address/${address}#code`)
        } else {
            console.log("\n  To verify:")
            console.log(`    npx hardhat verify --network sepolia ${address}`)
        }
    } catch (e) {
        console.log(`\n  Could not reach Etherscan API: ${e.message}`)
        console.log(`  Check manually: https://sepolia.etherscan.io/address/${address}#code`)
    }

    console.log("══════════════════════════════════════════════════\n")
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
