/**
 * Integration Tests — NftMarketplace
 *
 * These tests exercise complete user journeys end-to-end on the local Hardhat network.
 * They do not stub or mock any contract calls. Every assertion reflects actual on-chain
 * state after real transactions.
 *
 * Run with: npx hardhat test test/integration/NftMarketplace.integration.js
 */

const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

;(!developmentChains.includes(network.name) ? describe.skip : describe)(
    "NftMarketplace Integration Tests",
    function () {
        let nftMarketplace, basicNft
        let seller, buyer, buyer2
        let marketplaceAddress, basicNftAddress

        const PRICE     = ethers.parseEther("0.1")
        const NEW_PRICE = ethers.parseEther("0.25")

        // Helper: mint an NFT and return its token ID
        async function mintNft(minterContract) {
            const tokenId = await minterContract.getTokenCounter()
            await minterContract.mintNft()
            return tokenId
        }

        beforeEach(async function () {
            const accounts = await ethers.getSigners()
            seller  = accounts[0]
            buyer   = accounts[1]
            buyer2  = accounts[2]

            await deployments.fixture(["all"])

            const nftMarketplaceDeploy = await deployments.get("NftMarketplace")
            const basicNftDeploy       = await deployments.get("BasicNft")
            nftMarketplace     = await ethers.getContractAt("NftMarketplace", nftMarketplaceDeploy.address, seller)
            basicNft           = await ethers.getContractAt("BasicNft",        basicNftDeploy.address,       seller)
            marketplaceAddress = nftMarketplaceDeploy.address
            basicNftAddress    = basicNftDeploy.address
        })

        // ─────────────────────────────────────────────────────
        //  Journey A: mint → list → buy → withdraw proceeds
        // ─────────────────────────────────────────────────────
        describe("Journey A: full sale lifecycle", function () {
            it("seller lists, buyer purchases, seller withdraws correct ETH", async function () {
                // Step 1: Mint
                const tokenId = await mintNft(basicNft)

                // Step 2: Approve and list
                await basicNft.approve(marketplaceAddress, tokenId)
                await expect(nftMarketplace.listItem(basicNftAddress, tokenId, PRICE))
                    .to.emit(nftMarketplace, "ItemListed")
                    .withArgs(seller.address, basicNftAddress, tokenId, PRICE)

                // Verify listing is stored correctly
                const listing = await nftMarketplace.getListing(basicNftAddress, tokenId)
                assert.equal(listing.price,  PRICE,          "Listing price incorrect")
                assert.equal(listing.seller, seller.address, "Listing seller incorrect")

                // Step 3: Buyer purchases
                await expect(
                    nftMarketplace
                        .connect(buyer)
                        .buyItem(basicNftAddress, tokenId, { value: PRICE })
                )
                    .to.emit(nftMarketplace, "ItemBought")
                    .withArgs(buyer.address, basicNftAddress, tokenId, PRICE)

                // NFT ownership transferred
                assert.equal(
                    await basicNft.ownerOf(tokenId),
                    buyer.address,
                    "NFT not transferred to buyer"
                )

                // Listing cleared
                const clearedListing = await nftMarketplace.getListing(basicNftAddress, tokenId)
                assert.equal(clearedListing.price, 0n, "Listing not cleared after sale")

                // Proceeds credited to seller
                assert.equal(
                    await nftMarketplace.getProceeds(seller.address),
                    PRICE,
                    "Proceeds not credited to seller"
                )

                // Step 4: Seller withdraws
                const balanceBefore = await ethers.provider.getBalance(seller.address)
                const withdrawTx    = await nftMarketplace.withdrawProceeds()
                const receipt       = await withdrawTx.wait()
                const gasCost       = receipt.gasUsed * receipt.gasPrice
                const balanceAfter  = await ethers.provider.getBalance(seller.address)

                assert.equal(
                    balanceAfter,
                    balanceBefore + PRICE - gasCost,
                    "Seller ETH balance incorrect after withdrawal"
                )
                assert.equal(
                    await nftMarketplace.getProceeds(seller.address),
                    0n,
                    "Proceeds not zeroed after withdrawal"
                )
            })
        })

        // ─────────────────────────────────────────────────────
        //  Journey B: mint → list → update price → cancel
        // ─────────────────────────────────────────────────────
        describe("Journey B: update and cancel listing", function () {
            it("seller can update price then cancel, and re-list the same NFT", async function () {
                // Step 1: Mint, approve, list
                const tokenId = await mintNft(basicNft)
                await basicNft.approve(marketplaceAddress, tokenId)
                await nftMarketplace.listItem(basicNftAddress, tokenId, PRICE)

                // Step 2: Update price — must emit ItemUpdated, not ItemListed
                await expect(nftMarketplace.updateListing(basicNftAddress, tokenId, NEW_PRICE))
                    .to.emit(nftMarketplace, "ItemUpdated")
                    .withArgs(seller.address, basicNftAddress, tokenId, NEW_PRICE)
                    .and.not.to.emit(nftMarketplace, "ItemListed")

                // Price is now updated
                const updatedListing = await nftMarketplace.getListing(basicNftAddress, tokenId)
                assert.equal(updatedListing.price, NEW_PRICE, "Price not updated")

                // Step 3: Cancel listing
                await expect(nftMarketplace.cancelListing(basicNftAddress, tokenId))
                    .to.emit(nftMarketplace, "ItemCancelled")
                    .withArgs(seller.address, basicNftAddress, tokenId)

                // Listing cleared, seller still owns NFT
                const cancelledListing = await nftMarketplace.getListing(basicNftAddress, tokenId)
                assert.equal(cancelledListing.price, 0n, "Listing not cleared")
                assert.equal(
                    await basicNft.ownerOf(tokenId),
                    seller.address,
                    "Seller lost NFT after cancel"
                )

                // Step 4: Re-list the same NFT at the original price (must succeed)
                await basicNft.approve(marketplaceAddress, tokenId)
                await expect(nftMarketplace.listItem(basicNftAddress, tokenId, PRICE))
                    .to.emit(nftMarketplace, "ItemListed")
                    .withArgs(seller.address, basicNftAddress, tokenId, PRICE)
            })
        })

        // ─────────────────────────────────────────────────────
        //  Journey C: two sellers, two buyers, independent proceeds
        // ─────────────────────────────────────────────────────
        describe("Journey C: multiple sellers and buyers", function () {
            it("tracks proceeds correctly for independent sellers", async function () {
                // Seller mints and lists token 0
                const tokenId0 = await mintNft(basicNft)
                await basicNft.approve(marketplaceAddress, tokenId0)
                await nftMarketplace.listItem(basicNftAddress, tokenId0, PRICE)

                // Buyer (acting as second seller) mints and lists token 1
                const basicNftAsSeller2 = basicNft.connect(buyer)
                const tokenId1 = await mintNft(basicNftAsSeller2)
                await basicNftAsSeller2.approve(marketplaceAddress, tokenId1)
                await nftMarketplace.connect(buyer).listItem(basicNftAddress, tokenId1, NEW_PRICE)

                // buyer2 purchases both tokens
                await nftMarketplace
                    .connect(buyer2)
                    .buyItem(basicNftAddress, tokenId0, { value: PRICE })
                await nftMarketplace
                    .connect(buyer2)
                    .buyItem(basicNftAddress, tokenId1, { value: NEW_PRICE })

                // Proceeds are credited to their respective sellers
                assert.equal(
                    await nftMarketplace.getProceeds(seller.address),
                    PRICE,
                    "seller proceeds incorrect"
                )
                assert.equal(
                    await nftMarketplace.getProceeds(buyer.address),
                    NEW_PRICE,
                    "buyer-as-seller proceeds incorrect"
                )

                // Both tokens now owned by buyer2
                assert.equal(await basicNft.ownerOf(tokenId0), buyer2.address)
                assert.equal(await basicNft.ownerOf(tokenId1), buyer2.address)
            })
        })

        // ─────────────────────────────────────────────────────
        //  Journey D: pause mid-operation, resume, verify safety
        // ─────────────────────────────────────────────────────
        describe("Journey D: emergency pause and recovery", function () {
            it("blocks new listings during pause, cancels and withdrawals still work", async function () {
                // List and sell one token before pausing
                const tokenId = await mintNft(basicNft)
                await basicNft.approve(marketplaceAddress, tokenId)
                await nftMarketplace.listItem(basicNftAddress, tokenId, PRICE)
                await nftMarketplace.connect(buyer).buyItem(basicNftAddress, tokenId, { value: PRICE })

                // List a second token
                const tokenId2 = await mintNft(basicNft)
                await basicNft.approve(marketplaceAddress, tokenId2)
                await nftMarketplace.listItem(basicNftAddress, tokenId2, PRICE)

                // Owner pauses
                await nftMarketplace.pause()

                // New listings blocked
                const tokenId3 = await mintNft(basicNft)
                await basicNft.approve(marketplaceAddress, tokenId3)
                await expect(nftMarketplace.listItem(basicNftAddress, tokenId3, PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "EnforcedPause")

                // But seller can still cancel their active listing
                await expect(nftMarketplace.cancelListing(basicNftAddress, tokenId2))
                    .to.emit(nftMarketplace, "ItemCancelled")

                // And can still withdraw proceeds from the earlier sale
                await expect(nftMarketplace.withdrawProceeds())
                    .to.emit(nftMarketplace, "ProceedsWithdrawn")
                    .withArgs(seller.address, PRICE)

                // Owner unpauses — new listings work again
                await nftMarketplace.unpause()
                await basicNft.approve(marketplaceAddress, tokenId3)
                await expect(nftMarketplace.listItem(basicNftAddress, tokenId3, PRICE))
                    .to.emit(nftMarketplace, "ItemListed")
            })
        })
    }
)
