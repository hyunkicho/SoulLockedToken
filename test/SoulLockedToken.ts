import {
    time,
    loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import crypto from 'crypto';
import { expect } from "chai";
import { ethers } from "hardhat";
import base64url from 'base64url';
import elliptic from 'elliptic';
import { P256Verifier, SoulLockedToken, Utils } from "../typechain-types";

const ec = new elliptic.ec('p256');

function derToRS(der: Buffer): [Buffer, Buffer] {
    let offset = 3;
    let dataOffset;

    if (der[offset] === 0x21) {
        dataOffset = offset + 2;
    } else {
        dataOffset = offset + 1;
    }
    const r = der.slice(dataOffset, dataOffset + 32);
    offset = offset + der[offset] + 1 + 1;
    if (der[offset] === 0x21) {
        dataOffset = offset + 2;
    } else {
        dataOffset = offset + 1;
    }
    const s = der.slice(dataOffset, dataOffset + 32);
    return [r, s];
}

interface KeyPair {
    wallet: ethers.Wallet;
    privateKey: string;
    publicKey: [string, string];
}

function createKeyPair(): KeyPair {
    const wallet = ethers.Wallet.createRandom();
    const keyPair = ec.keyFromPrivate(wallet.privateKey);
    const privateKey = keyPair.getPrivate("hex");
    const _publicKey = keyPair.getPublic();
    console.log("pk: ", privateKey);
    const publicKey_ecdsa = Buffer.from(_publicKey.encode("hex").substr(2), "hex");
    const publicKey: [string, string] = [
        "0x" + publicKey_ecdsa.slice(0, 32).toString("hex"),
        "0x" + publicKey_ecdsa.slice(32).toString("hex"),
    ];

    return { wallet, privateKey, publicKey };
}

function generateChallengeHash(challenge: string): string {
    const coder = ethers.AbiCoder.defaultAbiCoder();
    const encodedChallenge = coder.encode(["string"], [challenge]);
    return ethers.keccak256(encodedChallenge);
}

async function generateSignature(
    privateKey: string,
    authenticatorData: string,
    clientDataJSON: string,
    UtilsFactoryContract: Utils,
    challengeToSign: string,
    credId: string
): Promise<string> {
    const authenticatorDataBuffer = Buffer.from(authenticatorData.slice(2), "hex");
    const clientDataJSONHash = crypto.createHash("sha256").update(clientDataJSON).digest();
    const concatenatedBuffer = Buffer.concat([authenticatorDataBuffer, clientDataJSONHash]);
    const messageHash = crypto.createHash("sha256").update(concatenatedBuffer).digest("hex");

    const signatureJS = ec.sign(messageHash, privateKey, "hex", { canonical: true });
    const ecdsaParsed = derToRS(Buffer.from(signatureJS.toDER("hex"), "hex"));
    const _sig: [string, string] = [
        "0x" + ecdsaParsed[0].toString("hex"),
        "0x" + ecdsaParsed[1].toString("hex"),
    ];

    return await UtilsFactoryContract.rawSignatureToSignature(
        challengeToSign,
        _sig[0],
        _sig[1],
        credId,
        authenticatorData
    );
}

interface DeployFixtureResult {
    registeredAddress: string;
    UtilsFactoryContract: Utils;
    UtilsAddress: string;
    SoulLockedTokenFactory: SoulLockedToken;
    deployer: ethers.Signer;
}

describe("Test passkey attached SBT", function () {
    async function deployFixture(): Promise<DeployFixtureResult> {
        const deployer = (await ethers.getSigners())[0];
        const registeredAddress = deployer.address;

        const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
        const P256VerifierContract = await P256VerifierFactory.deploy() as P256Verifier;
        const UtilsFactory = await ethers.getContractFactory("Utils");
        const UtilsFactoryContract = await UtilsFactory.deploy() as Utils;
        const UtilsAddress = await UtilsFactoryContract.getAddress();
        const SoulLockedToken = await ethers.getContractFactory("SoulLockedToken");
        const SoulLockedTokenFactory = await SoulLockedToken.deploy("Name", "Symbol", true) as SoulLockedToken;

        return { registeredAddress, UtilsFactoryContract, UtilsAddress, SoulLockedTokenFactory, deployer };
    }

    describe("testing passkey basic functions", function () {
        it("mint SBT correctly and check if owner is valid", async function () {
            const { registeredAddress, UtilsFactoryContract, SoulLockedTokenFactory, deployer } = await loadFixture(deployFixture);

            console.log("key 1st");
            const { wallet, privateKey, publicKey } = createKeyPair();
            const credId = ethers.zeroPadValue(deployer.address, 32);
            const tokenId = 0;

            const safeMintTx = await SoulLockedTokenFactory.safeMint(registeredAddress, tokenId, credId, publicKey);
            await safeMintTx.wait();
            expect(await SoulLockedTokenFactory.ownerOf(tokenId)).equal(registeredAddress);

            const challenge = "PasskeyVerificationChallenge";
            const challengeHash = generateChallengeHash(challenge);

            const version = 1;
            const validUntil = 0;
            const challengeToSign = ethers.solidityPacked(
                ["uint8", "uint48", "bytes32"],
                [version, validUntil, challengeHash]
            );
            const challengeBuffer = Buffer.from(challengeToSign.slice(2), "hex");
            const challengeb64url = base64url.encode(challengeBuffer);

            const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeb64url}","origin":"http://localhost:3000","crossOrigin":false}`;
            const authenticatorData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";

            const sig = await generateSignature(privateKey, authenticatorData, clientDataJSON, UtilsFactoryContract, challengeToSign, credId);
            const CheckingPasskey = await SoulLockedTokenFactory.passKeyChecker(sig, challengeHash);
            expect(CheckingPasskey).to.be.true;

            const authCheck = await SoulLockedTokenFactory.authCheck(tokenId, deployer.address);
            expect(authCheck[0]).to.be.true;

            const updateAuthTx = await SoulLockedTokenFactory.updateAuth(sig, challengeHash, tokenId, credId);
            await updateAuthTx.wait();
        });

        it("execute many times", async function () {
            const { registeredAddress, UtilsFactoryContract, SoulLockedTokenFactory } = await loadFixture(deployFixture);

            const tasks = Array.from({ length: 100 }, async (_, i) => {
                const { wallet, privateKey, publicKey } = createKeyPair();
                const credId = ethers.zeroPadValue(wallet.address, 32);
                const tokenId = i;

                const safeMintTx = await SoulLockedTokenFactory.safeMint(registeredAddress, tokenId, credId, publicKey);
                await safeMintTx.wait();

                expect(await SoulLockedTokenFactory.ownerOf(tokenId)).equal(registeredAddress);

                const challenge = "PasskeyVerificationChallenge";
                const challengeHash = generateChallengeHash(challenge);

                const version = 1;
                const validUntil = 0;
                const challengeToSign = ethers.solidityPacked(
                    ["uint8", "uint48", "bytes32"],
                    [version, validUntil, challengeHash]
                );
                const challengeBuffer = Buffer.from(challengeToSign.slice(2), "hex");
                const challengeb64url = base64url.encode(challengeBuffer);

                const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeb64url}","origin":"http://localhost:3000","crossOrigin":false}`;
                const authenticatorData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";

                const sig = await generateSignature(privateKey, authenticatorData, clientDataJSON, UtilsFactoryContract, challengeToSign, credId);
                const CheckingPasskey = await SoulLockedTokenFactory.passKeyChecker(sig, challengeHash);
                expect(CheckingPasskey).to.be.true;
            });

            await Promise.all(tasks);
        });
    });
});
