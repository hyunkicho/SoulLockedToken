import { ethers } from "hardhat";
import crypto from 'crypto';
import base64url from 'base64url';
import elliptic from 'elliptic';
import fs from 'fs';
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
    utils: Utils,
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

function summarizeResults(results: any[]) {
    const validResults = results.filter(r => r && !r.error);
    const failedCount = results.length - validResults.length;

    function average(arr: number[]): number {
        return arr.reduce((a, b) => a + b, 0) / arr.length;
    }

    function stddev(arr: number[]): number {
        const mean = average(arr);
        return Math.sqrt(arr.reduce((sum, x) => sum + (x - mean) ** 2, 0) / arr.length);
    }

    const getNum = (path: string) =>
        validResults.map(r => {
            const segments = path.split(".");
            return Number(segments.reduce((o, k) => o?.[k], r));
        }).filter(x => !isNaN(x));

    const summary = {
        total: results.length,
        success: validResults.length,
        failureRate: ((failedCount / results.length) * 100).toFixed(2) + "%",

        gasMintAvg: average(getNum("gasUsed.mint")),
        gasMintStd: stddev(getNum("gasUsed.mint")),

        gasUpdateAvg: average(getNum("gasUsed.update")),
        gasUpdateStd: stddev(getNum("gasUsed.update")),

        gasBurnAvg: average(getNum("gasUsed.burn")),
        gasBurnStd: stddev(getNum("gasUsed.burn")),

        timeSignAvg: average(getNum("time.sign")),
        timeSignStd: stddev(getNum("time.sign")),
        timeSignMin: Math.min(...getNum("time.sign")),
        timeSignMax: Math.max(...getNum("time.sign")),

        timeVerifyAvg: average(getNum("time.verify")),
        timeVerifyStd: stddev(getNum("time.verify")),
        timeVerifyMin: Math.min(...getNum("time.verify")),
        timeVerifyMax: Math.max(...getNum("time.verify")),
    };

    console.table(summary);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const registeredAddress = deployer.address;

    const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
    await P256VerifierFactory.deploy();

    const UtilsFactory = await ethers.getContractFactory("Utils");
    const utils = await UtilsFactory.deploy() as Utils;

    const SLTFactory = await ethers.getContractFactory("SoulLockedToken");
    const slt = await SLTFactory.deploy("SLT", "SLT", true) as SoulLockedToken;

    const results: any[] = [];
    const TOTAL = 100;

    for (let i = 0; i < TOTAL; i++) {
        try {
            const { wallet, privateKey, publicKey } = createKeyPair();
            const credId = ethers.zeroPadValue(wallet.address, 32);
            const tokenId = i;

            const mintTx = await slt.safeMint(registeredAddress, tokenId, credId, publicKey);
            const mintReceipt = await mintTx.wait();

            const challenge = `PasskeyVerificationChallenge-${i}-${Date.now()}`;
            const challengeHash = generateChallengeHash(challenge);

            const packed = ethers.solidityPacked(["uint8", "uint48", "bytes32"], [1, 0, challengeHash]);
            const challengeBuffer = Buffer.from(packed.slice(2), "hex");
            const clientDataJSON = `{"type":"webauthn.get","challenge":"${base64url.encode(challengeBuffer)}","origin":"http://localhost:3000","crossOrigin":false}`;
            const authData = `0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000`;

            const signStart = Date.now();
            const sig = await generateSignature(privateKey, authData, clientDataJSON, utils, packed, credId);
            console.log("sig :", sig);
            const signEnd = Date.now();

            const verifyStart = Date.now();
            const isValid = await slt.passKeyChecker(sig, challengeHash);
            console.log("isValid :", isValid);

            const verifyEnd = Date.now();

            // if (!isValid) throw new Error(`[${i}] ❌ Signature failed verification`);

            const ownerStart = Date.now();
            const owner = await slt.owner();
            console.log("owner :", owner);

            const ownerEnd = Date.now();
            const provider = ethers.provider;

            const balanceStart = Date.now();
            const balance = await provider.getBalance(registeredAddress);
            console.log("balance :", balance);

            const balanceEnd = Date.now();

            const blockNumberStart = Date.now();
            const blockNumber = await provider.getBlockNumber();
            console.log("blockNumber :", blockNumber);

            const blockNumberEnd = Date.now();

            // const updateTx = await slt.updateAuth(sig, challengeHash, tokenId, credId);
            // const updateReceipt = await updateTx.wait();
            //
            // const fakeHash = generateChallengeHash("FakeChallenge");
            // const burnTx = await slt.burn(sig, fakeHash, tokenId, credId);
            // const burnReceipt = await burnTx.wait();

            results[i] = {
                tokenId: i,
                gasUsed: {
                    mint: mintReceipt?.gasUsed.toString(),
                    verified : isValid
                //     // update: updateReceipt?.gasUsed.toString(),
                //     // burn: burnReceipt?.gasUsed.toString(),
                },
                time: {
                    sign: signEnd - signStart,
                    verify: verifyEnd - verifyStart,
                    ownerCall: ownerEnd - ownerStart,
                    getBalance: balanceEnd - balanceStart,
                    getBlockNumber: blockNumberEnd - blockNumberStart
                },
            };

            if (i % 10 === 0) console.log(`[${i}] ✅ done`);
        } catch (err) {
            // results[i] = {
            //     tokenId: i,
            //     error: true,
            //     message: (err as Error).message,
            // };
            console.log(err);
            console.error(`[${i}] ❌ failed:`, (err as Error).message);
        }
    }

    summarizeResults(results);
    fs.writeFileSync("sbt_passkey_experiment_results.json", JSON.stringify(results, null, 2));
    console.log("✅ Experiment finished. Results saved to sbt_passkey_experiment_results.json");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
