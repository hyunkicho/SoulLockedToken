// scripts/passkey_single_test.ts
import { ethers } from "hardhat";
import crypto from "crypto";
import base64url from "base64url";
import elliptic from "elliptic";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

const ec = new elliptic.ec("p256");

// 설정
const SLT_ADDRESS = process.env.SLT_ADDRESS!;
const UTILS_ADDRESS = process.env.UTILS_ADDRESS!;

function derToRS(der: Buffer): [Buffer, Buffer] {
    let offset = 3;
    let dataOffset = der[offset] === 0x21 ? offset + 2 : offset + 1;
    const r = der.slice(dataOffset, dataOffset + 32);
    offset += der[offset] + 2;
    dataOffset = der[offset] === 0x21 ? offset + 2 : offset + 1;
    const s = der.slice(dataOffset, dataOffset + 32);
    return [r, s];
}

function createKeyPair() {
    const wallet = ethers.Wallet.createRandom();
    const keyPair = ec.keyFromPrivate(wallet.privateKey);
    const privateKey = keyPair.getPrivate("hex");
    const _publicKey = keyPair.getPublic();
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
    utils: any,
    challengeToSign: string,
    credId: string
): Promise<string> {
    const authBuf = Buffer.from(authenticatorData.slice(2), "hex");
    const cdjHash = crypto.createHash("sha256").update(clientDataJSON).digest();
    const messageHash = crypto.createHash("sha256").update(Buffer.concat([authBuf, cdjHash])).digest("hex");

    const sig = ec.sign(messageHash, privateKey, "hex", { canonical: true });
    const [r, s] = derToRS(Buffer.from(sig.toDER("hex"), "hex"));

    return await utils.rawSignatureToSignature(
        challengeToSign,
        "0x" + r.toString("hex"),
        "0x" + s.toString("hex"),
        credId,
        authenticatorData
    );
}

async function main() {
    const [signer] = await ethers.getSigners();
    const SoulLockedToken = await ethers.getContractAt("SoulLockedToken", SLT_ADDRESS);
    const Utils = await ethers.getContractAt("Utils", UTILS_ADDRESS);

    const { wallet, privateKey, publicKey } = createKeyPair();
    const credId = ethers.zeroPadValue(wallet.address, 32);
    const tokenId = 999;

    const mintTx = await SoulLockedToken.safeMint(signer.address, tokenId, credId, publicKey);
    await mintTx.wait();
    console.log("✅ Mint success");

    const challenge = `TestChallenge-${Date.now()}`;
    const challengeHash = generateChallengeHash(challenge);
    const packed = ethers.solidityPacked(["uint8", "uint48", "bytes32"], [1, 0, challengeHash]);
    const challengeBuffer = Buffer.from(packed.slice(2), "hex");
    const clientDataJSON = `{"type":"webauthn.get","challenge":"${base64url.encode(challengeBuffer)}","origin":"http://localhost:3000","crossOrigin":false}`;
    const authData = `0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000`;

    const sig = await generateSignature(privateKey, authData, clientDataJSON, Utils, packed, credId);

    const isValid = await SoulLockedToken.passKeyChecker(sig, challengeHash);
    console.log(`✅ Signature valid: ${isValid}`);
}

main().catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
});
