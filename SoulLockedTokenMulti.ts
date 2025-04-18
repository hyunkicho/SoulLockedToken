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
import fs from 'fs'; // 상단에 추가
import pLimit from "p-limit";

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

function wait(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
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
        const LIMIT = 30; // 병렬 실행 제한
        const TOTAL = 500; // 빠른 테스트용 실험 횟수

        it("execute many times in parallel (500)", async function () {
            this.timeout(0); // 무제한 실행 시간 허용
            const { registeredAddress, UtilsFactoryContract, SoulLockedTokenFactory } = await loadFixture(deployFixture);

            const limit = pLimit(LIMIT);
            const results: any[] = [];

            const jobs = Array.from({ length: TOTAL }, (_, i) =>
                limit(async () => {
                    try {
                        const { wallet, privateKey, publicKey } = createKeyPair();
                        const credId = ethers.zeroPadValue(wallet.address, 32);
                        const tokenId = i;

                        const mintTx = await SoulLockedTokenFactory.safeMint(registeredAddress, tokenId, credId, publicKey);
                        const mintReceipt = await mintTx.wait();

                        const challenge = `PasskeyVerificationChallenge-${i}-${Date.now()}`;
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
                        const authenticatorData = `0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000`;

                        const signStart = Date.now();
                        const sig = await generateSignature(privateKey, authenticatorData, clientDataJSON, UtilsFactoryContract, challengeToSign, credId);
                        const signEnd = Date.now();

                        const verifyStart = Date.now();
                        const isValid = await SoulLockedTokenFactory.passKeyChecker(sig, challengeHash);
                        const verifyEnd = Date.now();

                        if (!isValid) {
                            throw new Error(`[${i}] ❌ Signature failed verification`);
                        }

                        const updateAuthTx = await SoulLockedTokenFactory.updateAuth(sig, challengeHash, tokenId, credId);
                        const updateAuthReceipt = await updateAuthTx.wait();

                        const challengeHashFake = generateChallengeHash("PasskeyVerificationChallengeFake");
                        const burnTx = await SoulLockedTokenFactory.burn(sig, challengeHashFake, tokenId, credId);
                        const burnReceipt = await burnTx.wait();

                        results[i] = {
                            tokenId: i,
                            gasUsed: {
                                mint: mintReceipt?.gasUsed.toString(),
                                update: updateAuthReceipt?.gasUsed.toString(),
                                burn: burnReceipt?.gasUsed.toString(),
                            },
                            time: {
                                sign: signEnd - signStart,
                                verify: verifyEnd - verifyStart,
                            },
                        };

                        if (i % 50 === 0) console.log(`[${i}] ✅ done`);
                    } catch (err) {
                        results[i] = {
                            tokenId: i,
                            error: true,
                            message: (err as Error).message,
                        };
                        console.error(`[${i}] ❌ failed:`, (err as Error).message);
                    }
                })
            );

            await Promise.allSettled(jobs);
            summarizeResults(results);
            console.log(`\n📊 Total completed: ${results.length}`);
            fs.writeFileSync("sbt_passkey_parallel_results.json", JSON.stringify(results, null, 2));
        });
    });
});
