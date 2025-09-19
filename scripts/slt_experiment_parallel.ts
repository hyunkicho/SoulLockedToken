// scripts/slt_experiment_parallel.ts
import { ethers } from "hardhat";
import crypto from "crypto";
import base64url from "base64url";
import elliptic from "elliptic";
import fs from "fs";
import pLimit from "p-limit";

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

async function runTest(
    i: number,
    deployerAddress: string,
    utils: any,
    slt: any
): Promise<any> {
    try {
        const { wallet, privateKey, publicKey } = createKeyPair();
        const tokenId = i;
        const credId = ethers.zeroPadValue(wallet.address, 32);

        const mintTx = await slt.safeMint(deployerAddress, tokenId, credId, publicKey);
        const mintReceipt = await mintTx.wait();

        const challenge = `PasskeyVerificationChallenge-${i}-${Date.now()}`;
        const challengeHash = generateChallengeHash(challenge);

        const version = 1;
        const validUntil = 0;
        const challengeToSign = ethers.solidityPacked(["uint8", "uint48", "bytes32"], [version, validUntil, challengeHash]);
        const challengeBuffer = Buffer.from(challengeToSign.slice(2), "hex");
        const challengeb64url = base64url.encode(challengeBuffer);
        const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeb64url}","origin":"http://localhost:3000","crossOrigin":false}`;
        const authenticatorData = `0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000`;

        const signStart = process.hrtime.bigint();
        const sig = await generateSignature(privateKey, authenticatorData, clientDataJSON, UtilsFactoryContract, challengeToSign, credId);
        const signEnd = process.hrtime.bigint();

        const verifyStart = process.hrtime.bigint();
        const isValid = await slt.passKeyChecker(sig, challengeHash);
        const verifyEnd = process.hrtime.bigint();

        const ownerStart = process.hrtime.bigint();
        await slt.owner();
        const ownerEnd = process.hrtime.bigint();

        if (!isValid) throw new Error(`[${i}] ❌ Signature verification failed`);

        const updateTx = await slt.updateAuth(sig, challengeHash, tokenId, credId);
        const updateReceipt = await updateTx.wait();

        const burnTx = await slt.burn(sig, generateChallengeHash("Fake"), tokenId, credId);
        const burnReceipt = await burnTx.wait();

        return {
            tokenId: i,
            gasUsed: {
                mint: mintReceipt.gasUsed.toString(),
                update: updateReceipt.gasUsed.toString(),
                burn: burnReceipt.gasUsed.toString(),
            },
            time: {
                sign: Number(signEnd - signStart) / 1e6,
                verify: Number(verifyEnd - verifyStart) / 1e6,
                ownerCall: Number(ownerEnd - ownerStart) / 1e6,
            },
        };
    } catch (err) {
        return {
            tokenId: i,
            error: true,
            message: (err as Error).message,
        };
    }
}

async function main() {
    const TOTAL = 100;
    const CONCURRENCY = 10;
    const results: any[] = [];
    const limit = pLimit(CONCURRENCY);

    const [deployer] = await ethers.getSigners();
    const deployerAddress = await deployer.getAddress();

    const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
    await P256VerifierFactory.deploy();

    const UtilsFactory = await ethers.getContractFactory("Utils");
    const utils = await UtilsFactory.deploy();

    const SLTFactory = await ethers.getContractFactory("SoulLockedToken");
    const slt = await SLTFactory.deploy("SLT", "SLT", true);

    console.log(`🚀 Running ${TOTAL} tests with concurrency: ${CONCURRENCY}`);

    const jobs = Array.from({ length: TOTAL }, (_, i) =>
        limit(() =>
            runTest(i, deployerAddress, utils, slt).then((res) => {
                results[i] = res;
                if (i % 10 === 0) console.log(`[${i}] ✅ done`);
            })
        )
    );

    await Promise.all(jobs);

    fs.writeFileSync("sbt_passkey_parallel_results.json", JSON.stringify(results, null, 2));
    console.log("✅ Parallel Experiment complete: sbt_passkey_parallel_results.json");
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
