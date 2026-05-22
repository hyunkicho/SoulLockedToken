// test/GalxePassportRepeatFormattedVaried.ts

import { ethers } from "hardhat";
import fs from "fs";

describe("GalxePassport Gas Measurement (Varied Inputs, 100 runs)", function () {
    it("Should measure gas usage with varied values", async function () {
        this.timeout(0);
        const results: any[] = [];

        const [deployer] = await ethers.getSigners();
        const GalxePassport = await ethers.getContractFactory("GalxePassport");
        const galxePassport = await GalxePassport.deploy();
        await galxePassport.waitForDeployment();
        await galxePassport.addMinter(deployer.address);

        for (let i = 0; i < 100; i++) {
            try {
                // 각 사용자 생성 및 충전
                const user1 = ethers.Wallet.createRandom().connect(ethers.provider);
                const user2 = ethers.Wallet.createRandom().connect(ethers.provider);
                const user3 = ethers.Wallet.createRandom().connect(ethers.provider);

                await Promise.all([
                    deployer.sendTransaction({ to: user1.address, value: ethers.parseEther("0.5") }),
                    deployer.sendTransaction({ to: user2.address, value: ethers.parseEther("0.5") }),
                    deployer.sendTransaction({ to: user3.address, value: ethers.parseEther("0.5") })
                ]);

                // Mint to user1
                const mintTx = await galxePassport.mint(user1.address, 10000 + i * 7);
                const mintReceipt = await mintTx.wait();

                // Set passport status (불규칙한 값 사용)
                const statusCode = (i % 5) + 1;
                const setStatusTx = await galxePassport.setPassportStatus(mintReceipt.events?.[0]?.args?.tokenId || 1 + i * 3, statusCode);
                await setStatusTx.wait();

                // Mint to user2
                const mintTx2 = await galxePassport.mint(user2.address, 20000 + i * 13);
                const mintReceipt2 = await mintTx2.wait();

                // Revoke (user2)
                const revokeTx = await galxePassport.revoke(mintReceipt2.events?.[0]?.args?.tokenId || 2 + i * 3);
                const revokeReceipt = await revokeTx.wait();

                // Mint to user3
                const mintTx3 = await galxePassport.mint(user3.address, 30000 + i * 11);
                const mintReceipt3 = await mintTx3.wait();

                // Burn (user3)
                const galxeUser3 = galxePassport.connect(user3);
                const burnTx = await galxeUser3.burn(mintReceipt3.events?.[0]?.args?.tokenId || 3 + i * 3);
                const burnReceipt = await burnTx.wait();

                results.push({
                    iteration: i,
                    gasUsed: {
                        mint: mintReceipt.gasUsed.toString(),
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
                console.log(`❌ [${i}] failed`);
            }
        }

        fs.writeFileSync("sbt_galxe_passport_results.json", JSON.stringify(results, null, 2));
        console.log("✅ Gas data saved to sbt_galxe_passport_results.json");
    });
});
