import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import crypto from "crypto";
import { ethers } from "hardhat";
import base64url from "base64url";
import elliptic from "elliptic";
import fs from "fs";
import { P256Verifier, SoulLockedToken, Utils } from "../typechain-types";

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
    utils: Utils,
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

describe("🧪 SLT Signature Experiment (Serial Mode)", function () {
    const TOTAL = 100;

    async function deployFixture() {
        const [deployer] = await ethers.getSigners();
        await (await ethers.getContractFactory("P256Verifier")).deploy();
        const utils = (await (await ethers.getContractFactory("Utils")).deploy()) as Utils;
        const slt = (await (
            await ethers.getContractFactory("SoulLockedToken")
        ).deploy("SLT", "SLT", true)) as SoulLockedToken;
        return { deployer, utils, slt };
    }

    it("🔁 Serial execution to eliminate timing noise", async function () {
        this.timeout(0);
        const { deployer, utils, slt } = await loadFixture(deployFixture);
        const results: any[] = [];

        for (let i = 0; i < TOTAL; i++) {
            try {
                const { wallet, privateKey, publicKey } = createKeyPair();
                const tokenId = i;
                const credId = ethers.zeroPadValue(wallet.address, 32);

                const mintTx = await slt.safeMint(deployer.address, tokenId, credId, publicKey);
                const mintReceipt = await mintTx.wait();

                const challenge = `Passkey-${i}`;
                const challengeHash = generateChallengeHash(challenge);
                const packed = ethers.solidityPacked(["uint8", "uint48", "bytes32"], [1, 0, challengeHash]);

                const clientDataJSON = `{"type":"webauthn.get","challenge":"${base64url.encode(
                    Buffer.from(packed.slice(2), "hex")
                )}","origin":"http://localhost:3000","crossOrigin":false}`;
                const authData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";

                const signStart = process.hrtime.bigint();
                const sig = await generateSignature(privateKey, authData, clientDataJSON, utils, packed, credId);
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

                results.push({
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
                });

                if (i % 10 === 0) console.log(`[${i}] ✅ done`);
            } catch (err) {
                results.push({
                    tokenId: i,
                    error: true,
                    message: (err as Error).message,
                });
                console.error(`[${i}] ❌`, (err as Error).message);
            }
        }

        fs.writeFileSync("sbt_passkey_serial_results.json", JSON.stringify(results, null, 2));
        console.log("✅ Serial Experiment complete: sbt_passkey_serial_results.json");
    });
});
