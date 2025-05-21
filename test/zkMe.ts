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

        const initTx = await zkmesbt.initialize("zkMe SBT", "ZKMSBT", operator.address);
        const initReceipt = await initTx.wait();
        console.log("✨ initialize() Gas Used:", initReceipt?.gasUsed.toString());
    });

    it("should attest SBT to user1", async () => {
        const opZkme = zkmesbt.connect(operator);
        const tx = await opZkme.attest(user1.address);
        const receipt = await tx.wait();
        console.log("✨ attest() Gas Used:", receipt?.gasUsed.toString());

        expect(receipt?.status).to.equal(1);
        const tokenId = await zkmesbt.tokenIdOf(user1.address);
        const owner = await zkmesbt.ownerOf(tokenId);
        expect(owner).to.equal(user1.address);
    });

    it("should revoke SBT from user1", async () => {
        const opZkme = zkmesbt.connect(operator);
        const tx1 = await opZkme.attest(user1.address);
        await tx1.wait();

        const tokenId = await zkmesbt.tokenIdOf(user1.address);
        const tx2 = await opZkme.revoke(user1.address, tokenId);
        const receipt = await tx2.wait();
        console.log("✨ revoke() Gas Used:", receipt?.gasUsed.toString());

        await expect(zkmesbt.ownerOf(tokenId)).to.be.reverted;
    });

    it("should burn SBT by owner", async () => {
        const opZkme = zkmesbt.connect(operator);
        await opZkme.attest(user2.address);
        const tokenId = await zkmesbt.tokenIdOf(user2.address);

        const userZkme = zkmesbt.connect(user2);
        const burnTx = await userZkme.burn(tokenId);
        const burnReceipt = await burnTx.wait();
        console.log("✨ burn() Gas Used:", burnReceipt?.gasUsed.toString());

        await expect(zkmesbt.ownerOf(tokenId)).to.be.reverted;
    });

    it("should return valid token URI", async () => {
        const opZkme = zkmesbt.connect(operator);
        const tx1 = await opZkme.setBaseTokenURI("https://example.com/token/");
        const receipt1 = await tx1.wait();
        console.log("✨ setBaseTokenURI() Gas Used:", receipt1?.gasUsed.toString());

        const tx2 = await opZkme.attest(user1.address);
        await tx2.wait();

        const tokenId = await zkmesbt.tokenIdOf(user1.address);
        const uri = await zkmesbt.tokenURI(tokenId);
        expect(uri).to.include(`https://example.com/token/`);
    });
});
