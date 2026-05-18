const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

;(!developmentChains.includes(network.name) ? describe.skip : describe)(
    "NftMarketplace Unit Tests",
    function () {
        let nftMarketplace, basicNft, deployer, player
        let marketplaceAddress, basicNftAddress

        const PRICE     = ethers.parseEther("0.1")
        const NEW_PRICE = ethers.parseEther("0.2")
        const TOKEN_ID  = 0

        beforeEach(async function () {
            const accounts = await ethers.getSigners()
            deployer = accounts[0]
            player   = accounts[1]

            await deployments.fixture(["all"])

            const nftMarketplaceDeploy = await deployments.get("NftMarketplace")
            const basicNftDeploy       = await deployments.get("BasicNft")
            nftMarketplace     = await ethers.getContractAt("NftMarketplace", nftMarketplaceDeploy.address, deployer)
            basicNft           = await ethers.getContractAt("BasicNft",        basicNftDeploy.address,       deployer)
            marketplaceAddress = nftMarketplaceDeploy.address
            basicNftAddress    = basicNftDeploy.address

            await basicNft.mintNft()
            await basicNft.approve(marketplaceAddress, TOKEN_ID)
        })

        // ─────────────────────────────────────────────────────
        //  listItem
        // ─────────────────────────────────────────────────────
        describe("listItem", function () {
            it("stores the listing and emits ItemListed on success", async function () {
                await expect(nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE))
                    .to.emit(nftMarketplace, "ItemListed")
                    .withArgs(deployer.address, basicNftAddress, TOKEN_ID, PRICE)

                const listing = await nftMarketplace.getListing(basicNftAddress, TOKEN_ID)
                assert.equal(listing.price,  PRICE,            "Price mismatch")
                assert.equal(listing.seller, deployer.address,  "Seller mismatch")
            })

            it("reverts with AlreadyListed if NFT is listed twice", async function () {
                await nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE)
                await expect(nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__AlreadyListed")
                    .withArgs(basicNftAddress, TOKEN_ID)
            })

            it("reverts with NotOwner if caller does not own the NFT", async function () {
                await expect(
                    nftMarketplace.connect(player).listItem(basicNftAddress, TOKEN_ID, PRICE)
                ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotOwner")
            })

            it("reverts with PriceMustBeAboveZero if price is 0", async function () {
                await expect(nftMarketplace.listItem(basicNftAddress, TOKEN_ID, 0))
                    .to.be.revertedWithCustomError(
                        nftMarketplace,
                        "NftMarketplace__PriceMustBeAboveZero"
                    )
            })

            it("reverts with NotApprovedForMarketplace if approval is missing", async function () {
                // Revoke approval granted in beforeEach
                await basicNft.approve(ethers.ZeroAddress, TOKEN_ID)
                await expect(nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE))
                    .to.be.revertedWithCustomError(
                        nftMarketplace,
                        "NftMarketplace__NotApprovedForMarketplace"
                    )
            })

            it("reverts with ZeroAddress if nftAddress is the zero address", async function () {
                await expect(nftMarketplace.listItem(ethers.ZeroAddress, TOKEN_ID, PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__ZeroAddress")
            })

            it("reverts with EnforcedPause when marketplace is paused", async function () {
                await nftMarketplace.pause()
                await expect(nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "EnforcedPause")
            })
        })

        // ─────────────────────────────────────────────────────
        //  buyItem
        // ─────────────────────────────────────────────────────
        describe("buyItem", function () {
            beforeEach(async function () {
                await nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE)
            })

            it("transfers NFT to buyer, credits seller proceeds, emits ItemBought", async function () {
                await expect(
                    nftMarketplace
                        .connect(player)
                        .buyItem(basicNftAddress, TOKEN_ID, { value: PRICE })
                )
                    .to.emit(nftMarketplace, "ItemBought")
                    .withArgs(player.address, basicNftAddress, TOKEN_ID, PRICE)

                assert.equal(await basicNft.ownerOf(TOKEN_ID), player.address)
                assert.equal(await nftMarketplace.getProceeds(deployer.address), PRICE)
            })

            it("deletes the listing after a successful purchase", async function () {
                await nftMarketplace
                    .connect(player)
                    .buyItem(basicNftAddress, TOKEN_ID, { value: PRICE })

                const listing = await nftMarketplace.getListing(basicNftAddress, TOKEN_ID)
                assert.equal(listing.price, 0n)
            })

            it("reverts with NotListed for a token that was never listed", async function () {
                await expect(
                    nftMarketplace
                        .connect(player)
                        .buyItem(basicNftAddress, 999, { value: PRICE })
                )
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
                    .withArgs(basicNftAddress, 999)
            })

            it("reverts with PriceNotMet when ETH sent is below listing price", async function () {
                const lowBid = ethers.parseEther("0.05")
                await expect(
                    nftMarketplace
                        .connect(player)
                        .buyItem(basicNftAddress, TOKEN_ID, { value: lowBid })
                )
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__PriceNotMet")
                    .withArgs(basicNftAddress, TOKEN_ID, PRICE)
            })

            it("reverts with CannotBuyOwnListing when the seller attempts to buy their own item", async function () {
                await expect(nftMarketplace.buyItem(basicNftAddress, TOKEN_ID, { value: PRICE }))
                    .to.be.revertedWithCustomError(
                        nftMarketplace,
                        "NftMarketplace__CannotBuyOwnListing"
                    )
            })

            it("reverts with EnforcedPause when marketplace is paused", async function () {
                await nftMarketplace.pause()
                await expect(
                    nftMarketplace
                        .connect(player)
                        .buyItem(basicNftAddress, TOKEN_ID, { value: PRICE })
                ).to.be.revertedWithCustomError(nftMarketplace, "EnforcedPause")
            })
        })

        // ─────────────────────────────────────────────────────
        //  cancelListing
        // ─────────────────────────────────────────────────────
        describe("cancelListing", function () {
            beforeEach(async function () {
                await nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE)
            })

            it("removes the listing and emits ItemCancelled on success", async function () {
                await expect(nftMarketplace.cancelListing(basicNftAddress, TOKEN_ID))
                    .to.emit(nftMarketplace, "ItemCancelled")
                    .withArgs(deployer.address, basicNftAddress, TOKEN_ID)

                const listing = await nftMarketplace.getListing(basicNftAddress, TOKEN_ID)
                assert.equal(listing.price, 0n)
            })

            it("reverts with NotSeller if caller is not the listing seller", async function () {
                await expect(
                    nftMarketplace.connect(player).cancelListing(basicNftAddress, TOKEN_ID)
                ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotSeller")
            })

            it("reverts with NotListed if token has no active listing", async function () {
                await expect(nftMarketplace.cancelListing(basicNftAddress, 999))
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
                    .withArgs(basicNftAddress, 999)
            })

            it("remains available while paused so sellers can exit in emergencies", async function () {
                await nftMarketplace.pause()
                await expect(nftMarketplace.cancelListing(basicNftAddress, TOKEN_ID))
                    .to.emit(nftMarketplace, "ItemCancelled")
                    .withArgs(deployer.address, basicNftAddress, TOKEN_ID)
            })
        })

        // ─────────────────────────────────────────────────────
        //  updateListing
        // ─────────────────────────────────────────────────────
        describe("updateListing", function () {
            beforeEach(async function () {
                await nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE)
            })

            it("updates the stored price and emits ItemUpdated on success", async function () {
                await expect(nftMarketplace.updateListing(basicNftAddress, TOKEN_ID, NEW_PRICE))
                    .to.emit(nftMarketplace, "ItemUpdated")
                    .withArgs(deployer.address, basicNftAddress, TOKEN_ID, NEW_PRICE)

                const listing = await nftMarketplace.getListing(basicNftAddress, TOKEN_ID)
                assert.equal(listing.price, NEW_PRICE)
            })

            it("does NOT emit ItemListed on a price update (critical for indexer correctness)", async function () {
                await expect(nftMarketplace.updateListing(basicNftAddress, TOKEN_ID, NEW_PRICE)).not.to.emit(
                    nftMarketplace,
                    "ItemListed"
                )
            })

            it("reverts with NotSeller if caller is not the listing seller", async function () {
                await expect(
                    nftMarketplace.connect(player).updateListing(basicNftAddress, TOKEN_ID, NEW_PRICE)
                ).to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotSeller")
            })

            it("reverts with PriceMustBeAboveZero if new price is 0", async function () {
                await expect(nftMarketplace.updateListing(basicNftAddress, TOKEN_ID, 0))
                    .to.be.revertedWithCustomError(
                        nftMarketplace,
                        "NftMarketplace__PriceMustBeAboveZero"
                    )
            })

            it("reverts with NotListed if token has no active listing", async function () {
                await expect(nftMarketplace.updateListing(basicNftAddress, 999, NEW_PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "NftMarketplace__NotListed")
            })

            it("reverts with EnforcedPause when marketplace is paused", async function () {
                await nftMarketplace.pause()
                await expect(nftMarketplace.updateListing(basicNftAddress, TOKEN_ID, NEW_PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "EnforcedPause")
            })
        })

        // ─────────────────────────────────────────────────────
        //  withdrawProceeds
        // ─────────────────────────────────────────────────────
        describe("withdrawProceeds", function () {
            beforeEach(async function () {
                await nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE)
                await nftMarketplace
                    .connect(player)
                    .buyItem(basicNftAddress, TOKEN_ID, { value: PRICE })
            })

            it("transfers the correct ETH amount to the seller", async function () {
                const balanceBefore = await ethers.provider.getBalance(deployer.address)
                const tx      = await nftMarketplace.withdrawProceeds()
                const receipt = await tx.wait()
                const gasCost = receipt.gasUsed * receipt.gasPrice
                const balanceAfter = await ethers.provider.getBalance(deployer.address)

                assert.equal(
                    balanceAfter,
                    balanceBefore + PRICE - gasCost,
                    "Seller received wrong amount"
                )
            })

            it("zeroes the seller's proceeds balance after withdrawal", async function () {
                await nftMarketplace.withdrawProceeds()
                assert.equal(await nftMarketplace.getProceeds(deployer.address), 0n)
            })

            it("emits ProceedsWithdrawn with the seller address and amount", async function () {
                await expect(nftMarketplace.withdrawProceeds())
                    .to.emit(nftMarketplace, "ProceedsWithdrawn")
                    .withArgs(deployer.address, PRICE)
            })

            it("reverts with NoProceeds if the caller has nothing to withdraw", async function () {
                await expect(nftMarketplace.connect(player).withdrawProceeds()).to.be.revertedWithCustomError(
                    nftMarketplace,
                    "NftMarketplace__NoProceeds"
                )
            })

            it("remains available while paused so sellers can recover funds in emergencies", async function () {
                await nftMarketplace.pause()
                await expect(nftMarketplace.withdrawProceeds())
                    .to.emit(nftMarketplace, "ProceedsWithdrawn")
                    .withArgs(deployer.address, PRICE)
            })
        })

        // ─────────────────────────────────────────────────────
        //  Pausable
        // ─────────────────────────────────────────────────────
        describe("Pausable", function () {
            it("owner can pause the marketplace", async function () {
                await nftMarketplace.pause()
                await expect(nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "EnforcedPause")
            })

            it("non-owner cannot pause — reverts with OwnableUnauthorizedAccount", async function () {
                await expect(nftMarketplace.connect(player).pause())
                    .to.be.revertedWithCustomError(nftMarketplace, "OwnableUnauthorizedAccount")
                    .withArgs(player.address)
            })

            it("owner can unpause and normal operations resume", async function () {
                await nftMarketplace.pause()
                await nftMarketplace.unpause()
                await expect(nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE))
                    .to.emit(nftMarketplace, "ItemListed")
            })

            it("non-owner cannot unpause", async function () {
                await nftMarketplace.pause()
                await expect(nftMarketplace.connect(player).unpause())
                    .to.be.revertedWithCustomError(nftMarketplace, "OwnableUnauthorizedAccount")
                    .withArgs(player.address)
            })

            it("buyItem reverts while paused", async function () {
                await nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE)
                await nftMarketplace.pause()
                await expect(
                    nftMarketplace
                        .connect(player)
                        .buyItem(basicNftAddress, TOKEN_ID, { value: PRICE })
                ).to.be.revertedWithCustomError(nftMarketplace, "EnforcedPause")
            })

            it("updateListing reverts while paused", async function () {
                await nftMarketplace.listItem(basicNftAddress, TOKEN_ID, PRICE)
                await nftMarketplace.pause()
                await expect(nftMarketplace.updateListing(basicNftAddress, TOKEN_ID, NEW_PRICE))
                    .to.be.revertedWithCustomError(nftMarketplace, "EnforcedPause")
            })
        })

        // ─────────────────────────────────────────────────────
        //  View functions
        // ─────────────────────────────────────────────────────
        describe("getListing / getProceeds", function () {
            it("returns a zeroed listing for a token that has not been listed", async function () {
                const listing = await nftMarketplace.getListing(basicNftAddress, TOKEN_ID)
                assert.equal(listing.price,  0n)
                assert.equal(listing.seller, ethers.ZeroAddress)
            })

            it("returns zero proceeds for an address with no sales", async function () {
                assert.equal(await nftMarketplace.getProceeds(player.address), 0n)
            })
        })
    }
)
