// scripts/slt_experiment.ts
import { ethers } from "hardhat";
import crypto from "crypto";
import base64url from "base64url";
import elliptic from "elliptic";
import fs from "fs";

const ec = new elliptic.ec("p256");

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
    const pub = Buffer.from(keyPair.getPublic().encode("hex").substr(2), "hex");
    return {
        wallet,
        privateKey: keyPair.getPrivate("hex"),
        publicKey: [
            "0x" + pub.slice(0, 32).toString("hex"),
            "0x" + pub.slice(32).toString("hex"),
        ],
    };
}

function generateChallengeHash(challenge: string): string {
    return ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["string"], [challenge]));
}

async function generateSignature(
    privKey: string,
    authData: string,
    clientDataJSON: string,
    utils: any,
    challengeToSign: string,
    credId: string
): Promise<string> {
    const authBuf = Buffer.from(authData.slice(2), "hex");
    const hashCDJ = crypto.createHash("sha256").update(clientDataJSON).digest();
    const messageHash = crypto.createHash("sha256").update(Buffer.concat([authBuf, hashCDJ])).digest("hex");

    const sig = ec.sign(messageHash, privKey, "hex", { canonical: true });
    const [r, s] = derToRS(Buffer.from(sig.toDER("hex"), "hex"));
    return await utils.rawSignatureToSignature(
        challengeToSign,
        "0x" + r.toString("hex"),
        "0x" + s.toString("hex"),
        credId,
        authData
    );
}

async function main() {
    const TOTAL = 100;
    const results: any[] = [];

    const [deployer] = await ethers.getSigners();

    const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
    const P256VerifierFactoryContract = await P256VerifierFactory.deploy();
    console.log("P256VerifierFactory : ", await P256VerifierFactoryContract.getAddress());

    const UtilsFactory = await ethers.getContractFactory("Utils");
    const utilsContract = await UtilsFactory.deploy();
    console.log("utils : ", await utilsContract.getAddress());

    const SLTFactory = await ethers.getContractFactory("SoulLockedTokenNew");
    const sltContract = await SLTFactory.deploy("SLT", "SLT", true);
    console.log("slt : ", await sltContract.getAddress());
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
