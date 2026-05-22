import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import crypto from "crypto";
import { ethers } from "hardhat";
import base64url from "base64url";
import elliptic from "elliptic";
import fs from "fs";
import pLimit from "p-limit";

import { SoulLockedToken, Utils } from "../typechain-types";

const ec = new elliptic.ec("p256");

function derToRS(der: Buffer): [Buffer, Buffer] {
    let offset = 3;
    let dataOffset;

    if (der[offset] === 0x21) dataOffset = offset + 2;
    else dataOffset = offset + 1;

    const r = der.slice(dataOffset, dataOffset + 32);
    offset += der[offset] + 2;

    if (der[offset] === 0x21) dataOffset = offset + 2;
    else dataOffset = offset + 1;

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
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(["string"], [challenge]);
    return ethers.keccak256(encoded);
}

async function generateSignature(
    privKey: string,
    authData: string,
    clientDataJSON: string,
    utils: Utils,
    challengeToSign: string,
    credId: string
) {
    const authBuf = Buffer.from(authData.slice(2), "hex");
    const hashCDJ = crypto.createHash("sha256").update(clientDataJSON).digest();
    const messageHash = crypto
        .createHash("sha256")
        .update(Buffer.concat([authBuf, hashCDJ]))
        .digest("hex");

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

describe("⏱️ SLT Signature Verification Benchmark", function () {
    const LIMIT = 30;
    const TOTAL = 300;

    async function deployFixture() {
        const [deployer] = await ethers.getSigners();
        const utils = await (await ethers.getContractFactory("Utils")).deploy();
        await utils.waitForDeployment();
        const sltInstance = await (await ethers.getContractFactory("SoulLockedToken")).deploy("Name", "Symbol", true);
        await sltInstance.waitForDeployment();
        return { deployer, sltInstance, utils };
    }

    it("🧪 Measure gas & latency (normal vs static call)", async function () {
        this.timeout(0);
        const { deployer, sltInstance, utils } = await loadFixture(deployFixture);

        const limit = pLimit(LIMIT);
        const results: any[] = [];

        const jobs = Array.from({ length: TOTAL }, (_, i) =>
            limit(async () => {
                try {
                    const { wallet, privateKey, publicKey } = createKeyPair();
                    const tokenId = i;
                    const credId = ethers.zeroPadValue(wallet.address, 32);

                    await sltInstance.safeMint(deployer.address, tokenId, credId, publicKey);

                    const challenge = `PasskeyVerification-${i}`;
                    const hash = generateChallengeHash(challenge);
                    const packed = ethers.solidityPacked(["uint8", "uint48", "bytes32"], [1, 0, hash]);
                    const challengeBuffer = Buffer.from(packed.slice(2), "hex");
                    const clientData = `{"type":"webauthn.get","challenge":"${base64url.encode(
                        challengeBuffer
                    )}","origin":"http://localhost:3000","crossOrigin":false}`;
                    const authData =
                        "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";

                    const signStart = Date.now();
                    const sig = await generateSignature(privateKey, authData, clientData, utils, packed, credId);
                    const signEnd = Date.now();

                    const verifyStart = Date.now();
                    console.log("verifyStart 1 : ", verifyStart);

                    const valid = await sltInstance.passKeyChecker(sig, hash);

                    const verifyEnd = Date.now();
                    console.log("verifyEnd 1 : ", verifyEnd);

                    const staticStart = Date.now();
                    console.log("staticStart 1 : ", staticStart);

                    await sltInstance.passKeyChecker.staticCall(sig, hash);
                    const staticEnd = Date.now();
                    console.log("staticEnd 1 : ", staticEnd);


                    results.push({
                        tokenId: i,
                        valid,
                        time: {
                            sign: signEnd - signStart,
                            verify_with_call: verifyEnd - verifyStart,
                            verify_static_only: staticEnd - staticStart,
                        },
                    });

                    if (i % 50 === 0) console.log(`[${i}] ✅ verified`);
                } catch (err) {
                    results.push({
                        tokenId: i,
                        error: true,
                        message: (err as Error).message,
                    });
                    console.error(`[${i}] ❌`, (err as Error).message);
                }
            })
        );

        await Promise.allSettled(jobs);
        fs.writeFileSync("sbt_slt_verification_time.json", JSON.stringify(results, null, 2));
        console.log("✅ Benchmark saved: sbt_slt_verification_time.json");
    });
});
