// test/Hub.test.ts
import { expect } from "chai";
import { ethers } from "hardhat";
import { Hub } from "../typechain-types";
import { Wallet } from "ethers";

describe("Hub - SBT ZKP Issuance Test", function () {
    let hub: Hub;
    let verifier: Wallet;
    let receiver: any;
    const circuitId = ethers.keccak256(ethers.toUtf8Bytes("kyc-proof"));
    const expiration = Math.floor(Date.now() / 1000) + 3600; // +1 hour
    const customFee = ethers.parseEther("0.01");
    const nullifier = 12345;
    const publicValues = [42, 7];

    beforeEach(async () => {
        const [deployer, user] = await ethers.getSigners();
        receiver = user;
        verifier = Wallet.createRandom();

        const HubFactory = await ethers.getContractFactory("Hub");
        hub = await HubFactory.deploy(verifier.address) as Hub;
        await hub.waitForDeployment();
    });

    it("should issue SBT to a verified user with valid signature", async () => {
        // Sign mock data off-chain (imitating Verifier role)
        const messageHash = ethers.solidityPackedKeccak256(
            ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256[]", "uint256"],
            [circuitId, receiver.address, expiration, customFee, nullifier, publicValues, await ethers.provider.getNetwork().then(n => n.chainId)]
        );
        const sig = await verifier.signMessage(ethers.getBytes(messageHash));

        // Send transaction with required fee
        const tx = await hub.setSBT(
            circuitId,
            receiver.address,
            expiration,
            customFee,
            nullifier,
            publicValues,
            sig,
            { value: customFee }
        );
        const receipt = await tx.wait();
        console.log("✨ Gas Used (setSBT):", receipt?.gasUsed.toString());

        // Check SBT is stored
        const sbt = await hub.getSBT(receiver.address, circuitId);
        expect(sbt.expiry).to.equal(expiration);
        expect(sbt.revoked).to.be.false;
        expect(sbt.publicValues.length).to.equal(2);
    });

    it("should revoke SBT and fail on read", async () => {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const msgHash = ethers.solidityPackedKeccak256(
            ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256[]", "uint256"],
            [circuitId, receiver.address, expiration, customFee, nullifier, publicValues, chainId]
        );
        const sig = await verifier.signMessage(ethers.getBytes(msgHash));

        await hub.setSBT(circuitId, receiver.address, expiration, customFee, nullifier, publicValues, sig, { value: customFee });
        const revokeTx = await hub.revokeSBT(receiver.address, circuitId);
        const revokeReceipt = await revokeTx.wait();
        console.log("✨ Gas Used (revokeSBT):", revokeReceipt?.gasUsed.toString());
        await hub.revokeSBT(receiver.address, circuitId);

        await expect(hub.getSBT(receiver.address, circuitId)).to.be.revertedWith("SBT has been revoked");
    });

    it("should reject reused nullifier", async () => {
        const chainId = (await ethers.provider.getNetwork()).chainId;
        const sig = await verifier.signMessage(ethers.getBytes(ethers.solidityPackedKeccak256(
            ["bytes32", "uint256", "uint256", "uint256", "uint256", "uint256[]", "uint256"],
            [circuitId, receiver.address, expiration, customFee, nullifier, publicValues, chainId]
        )));

        await hub.setSBT(circuitId, receiver.address, expiration, customFee, nullifier, publicValues, sig, { value: customFee });

        await expect(hub.setSBT(circuitId, receiver.address, expiration, customFee, nullifier, publicValues, sig, { value: customFee }))
            .to.be.revertedWith("this is already been proven");
    });
});
