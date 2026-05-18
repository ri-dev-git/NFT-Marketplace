const { run } = require("hardhat")

/**
 * Verifies a contract on Etherscan using the V2 API.
 * Requires ETHERSCAN_API_KEY in .env and `etherscan.apiKey` set to a single
 * string (not a network-keyed object) in hardhat.config.js.
 */
const verify = async (contractAddress, args) => {
    console.log("Verifying contract on Etherscan...")
    try {
        await run("verify:verify", {
            address: contractAddress,
            constructorArguments: args,
        })
        console.log("Verification submitted successfully.")
    } catch (e) {
        const msg = e.message || ""
        if (msg.toLowerCase().includes("already verified")) {
            console.log("Contract is already verified.")
        } else if (msg.includes("deprecated V1 endpoint") || msg.includes("v2")) {
            console.log("⚠  Etherscan API key issue — ensure ETHERSCAN_API_KEY is set and hardhat.config.js uses a single string key (V2 format).")
            console.log(msg)
        } else {
            console.log("Verification error:", msg)
        }
    }
}

module.exports = { verify }
