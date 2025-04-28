// test/GalxePassport.test.ts

import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("GalxePassport Gas Measurement", function () {
    async function deployFixture() {
        const [deployer, user] = await ethers.getSigners();
        const GalxePassport = await ethers.getContractFactory("GalxePassport");
        const galxePassport = await GalxePassport.deploy();
        await galxePassport.waitForDeployment();

        await galxePassport.addMinter(deployer.address);

        return { galxePassport, deployer, user };
    }

    describe("Measure gas for major functions", function () {
        it("Should measure gas usage", async function () {
            const { galxePassport, deployer, user } = await loadFixture(deployFixture);

            // mint (user 1)
            const mintTx = await galxePassport.mint(user.address, 12345);
            const mintReceipt = await mintTx.wait();
            console.log("✨ Mint Gas Used:", mintReceipt?.gasUsed.toString());

            // setPassportStatus
            const setStatusTx = await galxePassport.setPassportStatus(1, 2);
            const setStatusReceipt = await setStatusTx.wait();
            console.log("✨ SetPassportStatus Gas Used:", setStatusReceipt?.gasUsed.toString());

            // mint (user 2) 추가 - 같은 계정 사용하면 안 됨
            const [_, __, user2] = await ethers.getSigners(); // 새로운 signer 사용
            const mintTx2 = await galxePassport.mint(user2.address, 12346);
            await mintTx2.wait();

            // revoke
            const revokeTx = await galxePassport.revoke(2);
            const revokeReceipt = await revokeTx.wait();
            console.log("✨ Revoke Gas Used:", revokeReceipt?.gasUsed.toString());

            // mint (user 3)
            const [___, ____, user3] = await ethers.getSigners();
            const mintTx3 = await galxePassport.mint(user3.address, 12347);
            await mintTx3.wait();

            // burn (user3로 연결)
            const galxeUser3 = galxePassport.connect(user3);
            const burnTx = await galxeUser3.burn(3);
            const burnReceipt = await burnTx.wait();
            console.log("✨ Burn Gas Used:", burnReceipt?.gasUsed.toString());
        });
    });
});
