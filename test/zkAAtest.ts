// test/ZKMESBTUpgradeable.test.ts

import { ethers } from "hardhat";
import { expect } from "chai";

describe("ZKMESBTUpgradeable - SBT Core Test", function () {
    let zkmesbt: any;
    let operator: any;
    let user1: any;
    let user2: any;

    beforeEach(async function () {
        const [deployer, op, u1, u2] = await ethers.getSigners();
        operator = op;
        user1 = u1;
        user2 = u2;

        const Contract = await ethers.getContractFactory("ZKMESBTUpgradeable");
        zkmesbt = await Contract.deploy();
        await zkmesbt.waitForDeployment();

        // initialize(name, symbol, admin)
        await zkmesbt.initialize("zkMe SBT", "ZKMSBT", operator.address);
    });

    it("should attest SBT to user1", async () => {
        const opZkme = zkmesbt.connect(operator);
        const tx = await opZkme.attest(user1.address);
        const receipt = await tx.wait();

        expect(receipt?.status).to.equal(1);
        const tokenId = await zkmesbt.tokenIdOf(user1.address);
        const owner = await zkmesbt.ownerOf(tokenId);
        expect(owner).to.equal(user1.address);
    });

    it("should revoke SBT from user1", async () => {
        const opZkme = zkmesbt.connect(operator);
        await opZkme.attest(user1.address);
        const tokenId = await zkmesbt.tokenIdOf(user1.address);
        await opZkme.revoke(user1.address, tokenId);

        // revoke 후 조회 불가능해야 정상
        await expect(zkmesbt.ownerOf(tokenId)).to.be.reverted;
    });

    it("should burn SBT by owner", async () => {
        const opZkme = zkmesbt.connect(operator);
        await opZkme.attest(user2.address);
        const tokenId = await zkmesbt.tokenIdOf(user2.address);

        const userZkme = zkmesbt.connect(user2);
        await userZkme.burn(tokenId);
        await expect(zkmesbt.ownerOf(tokenId)).to.be.reverted;
    });

    it("should return valid token URI", async () => {
        const opZkme = zkmesbt.connect(operator);
        await opZkme.setBaseTokenURI("https://example.com/token/");
        await opZkme.attest(user1.address);
        const tokenId = await zkmesbt.tokenIdOf(user1.address);

        const uri = await zkmesbt.tokenURI(tokenId);
        expect(uri).to.include(`https://example.com/token/`);
    });
});
