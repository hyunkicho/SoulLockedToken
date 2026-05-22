// test/BinanceSBTMulti_varied.ts

import { ethers } from "hardhat";
import fs from "fs";

describe("BinanceSBT Gas Measurement with Varied Inputs", function () {
    it("should execute mint, revoke, burn with varied addresses", async function () {
        const [deployer, operator] = await ethers.getSigners();
        const BinanceSBT = await ethers.getContractFactory("BinanceSBT");
        const binanceSBT = await BinanceSBT.deploy();
        await binanceSBT.waitForDeployment();
        await binanceSBT.initialize("Binance SBT", "BSBT", operator.address);

        const opBinance = binanceSBT.connect(operator);
        const results: any[] = [];

        for (let i = 0; i < 100; i++) {
            // 1. attest (mint) with new wallet
            const wallet1 = ethers.Wallet.createRandom().connect(ethers.provider);
            await operator.sendTransaction({
                to: wallet1.address,
                value: ethers.parseEther("0.1"),
            });
            const attestTx = await opBinance.attest(wallet1.address);
            const attestReceipt = await attestTx.wait();

            // 2. revoke
            const wallet2 = ethers.Wallet.createRandom().connect(ethers.provider);
            await operator.sendTransaction({
                to: wallet2.address,
                value: ethers.parseEther("0.1"),
            });
            const attestTx2 = await opBinance.attest(wallet2.address);
            await attestTx2.wait();
            const revokeTx = await opBinance.revoke(wallet2.address);
            const revokeReceipt = await revokeTx.wait();

            // 3. burn (self-burn from user wallet)
            const wallet3 = ethers.Wallet.createRandom().connect(ethers.provider);
            await operator.sendTransaction({
                to: wallet3.address,
                value: ethers.parseEther("0.1"),
            });
            const attestTx3 = await opBinance.attest(wallet3.address);
            await attestTx3.wait();
            const userBurn = binanceSBT.connect(wallet3);
            const burnTx = await userBurn.burn();
            const burnReceipt = await burnTx.wait();

            results.push({
                iteration: i,
                gasUsed: {
                    mint: attestReceipt?.gasUsed.toString(),
                    revoke: revokeReceipt?.gasUsed.toString(),
                    burn: burnReceipt?.gasUsed.toString(),
                },
            });

            console.log(`[${i}] ✅ Mint: ${attestReceipt?.gasUsed}, Revoke: ${revokeReceipt?.gasUsed}, Burn: ${burnReceipt?.gasUsed}`);
        }

        fs.writeFileSync("sbt_binance_results.json", JSON.stringify(results, null, 2));
        console.log("✅ Gas data saved to sbt_binance_results.json");
    });
});
