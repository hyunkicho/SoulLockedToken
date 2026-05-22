import { ethers } from "hardhat";
import fs from "fs";

describe("zkMeSBT Gas Measurement (diverse input test)", function () {
    it("Should measure gas usage across varying tokenIds", async function () {
        this.timeout(0);
        const results: any[] = [];

        const [deployer, operator] = await ethers.getSigners();
        const zkMe = await ethers.getContractFactory("ZKMESBTUpgradeable");
        const zkme = await zkMe.deploy();
        await zkme.waitForDeployment();

        await zkme.initialize("zkMe SBT", "ZKMSBT", operator.address);
        const opZkme = zkme.connect(operator);

        const specialTokenIds = [0, 1, 2 ** 16, 2 ** 128 - 1, 2 ** 256 - 1]; // 경계값 포함

        for (let i = 0; i < 1000; i++) {
            try {
                const wallet1 = ethers.Wallet.createRandom().connect(ethers.provider);
                const wallet2 = ethers.Wallet.createRandom().connect(ethers.provider);
                const wallet3 = ethers.Wallet.createRandom().connect(ethers.provider);

                await operator.sendTransaction({ to: wallet1.address, value: ethers.parseEther("1") });
                await operator.sendTransaction({ to: wallet2.address, value: ethers.parseEther("1") });
                await operator.sendTransaction({ to: wallet3.address, value: ethers.parseEther("1") });

                const tokenIdForTest = i < specialTokenIds.length ? specialTokenIds[i] : i;

                // Mint
                const attestTx = await opZkme.attest(wallet1.address);
                const attestReceipt = await attestTx.wait();

                // Revoke
                await opZkme.attest(wallet2.address);
                const tokenId2 = await zkme.tokenIdOf(wallet2.address);
                const revokeTx = await opZkme.revoke(wallet2.address, tokenId2);
                const revokeReceipt = await revokeTx.wait();

                // Burn
                await opZkme.attest(wallet3.address);
                const tokenId3 = await zkme.tokenIdOf(wallet3.address);
                const burnTx = await zkme.connect(wallet3).burn(tokenId3);
                const burnReceipt = await burnTx.wait();

                results.push({
                    iteration: i,
                    tokenIdUsed: tokenIdForTest,
                    gasUsed: {
                        mint: attestReceipt.gasUsed.toString(),
                        revoke: revokeReceipt.gasUsed.toString(),
                        burn: burnReceipt.gasUsed.toString()
                    }
                });

                console.log(`✅ [${i}] done`);
            } catch (err) {
                results.push({
                    iteration: i,
                    error: true,
                    message: (err as Error).message
                });
                console.log(`❌ [${i}] failed:`, (err as Error).message);
            }
        }

        fs.writeFileSync("sbt_zkme_results_varied.json", JSON.stringify(results, null, 2));
    });
});
