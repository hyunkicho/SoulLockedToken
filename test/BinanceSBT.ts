// test/BinanceSBT.test.ts

import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BinanceSBT Gas Measurement", function () {
    // 테스트를 위한 기본 배포 세팅
    async function deployFixture() {
        const [deployer, operator, user] = await ethers.getSigners();
        const BinanceSBT = await ethers.getContractFactory("BinanceSBT");
        const binanceSBT = await BinanceSBT.deploy();
        await binanceSBT.waitForDeployment();

        // operator 계정을 초기화에 등록
        await binanceSBT.initialize("Binance SBT", "BSBT", operator.address);

        return { binanceSBT, deployer, operator, user };
    }

    describe("Measure gas for major functions", function () {
        it("Should measure gas usage", async function () {
            const { binanceSBT, operator, user } = await loadFixture(deployFixture);

            const opBinance = binanceSBT.connect(operator);

            // --- 1. attest (mint)
            const attestTx = await opBinance.attest(user.address);
            const attestReceipt = await attestTx.wait();
            console.log("✨ Attest (Mint) Gas Used:", attestReceipt?.gasUsed.toString());

            // --- 2. attest to new user (revoke 대상 준비)
            const newWallet = ethers.Wallet.createRandom().connect(ethers.provider);
            await operator.sendTransaction({ to: newWallet.address, value: ethers.parseEther("1") });
            const attestTx2 = await opBinance.attest(newWallet.address);
            await attestTx2.wait();

            // --- 3. revoke (관리자가 강제 소각)
            const revokeTx = await opBinance.revoke(newWallet.address);
            const revokeReceipt = await revokeTx.wait();
            console.log("✨ Revoke Gas Used:", revokeReceipt?.gasUsed.toString());

            // --- 4. attest to another new user (burn 대상 준비)
            const newWallet2 = ethers.Wallet.createRandom().connect(ethers.provider);
            await operator.sendTransaction({ to: newWallet2.address, value: ethers.parseEther("1") });
            const attestTx3 = await opBinance.attest(newWallet2.address);
            await attestTx3.wait();

            // --- 5. burn (user가 직접 소각)
            const binanceUser = binanceSBT.connect(newWallet2);
            const burnTx = await binanceUser.burn();
            const burnReceipt = await burnTx.wait();
            console.log("✨ Burn Gas Used:", burnReceipt?.gasUsed.toString());
        });
    });
});
