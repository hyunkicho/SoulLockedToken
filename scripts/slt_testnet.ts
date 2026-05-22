import { ethers } from "hardhat";
import crypto from "crypto";
import elliptic from "elliptic";
import base64url from "base64url";
import fs from "fs";

const ec = new elliptic.ec("p256");
const SLT_ADDRESS = "0x8F39C7dff4aDE7ceC4F7cd02Ea528f4c900A470d";
const TOTAL = 100;

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

function derToRS(der: Buffer): [Buffer, Buffer] {
    let offset = 3;
    let dataOffset = der[offset] === 0x21 ? offset + 2 : offset + 1;
    const r = der.slice(dataOffset, dataOffset + 32);
    offset += der[offset] + 2;
    dataOffset = der[offset] === 0x21 ? offset + 2 : offset + 1;
    const s = der.slice(dataOffset, dataOffset + 32);
    return [r, s];
}

async function generateSignature(
    privKey: string,
    authData: string,
    clientDataJSON: string,
    challengeToSign: string,
    credId: string,
    utilsContract: any
): Promise<string> {
    const authBuf = Buffer.from(authData.slice(2), "hex");
    const hashCDJ = crypto.createHash("sha256").update(clientDataJSON).digest();
    const messageHash = crypto.createHash("sha256").update(Buffer.concat([authBuf, hashCDJ])).digest("hex");
    const sig = ec.sign(messageHash, privKey, "hex", { canonical: true });
    const [r, s] = derToRS(Buffer.from(sig.toDER("hex"), "hex"));
    return await utilsContract.rawSignatureToSignature(
        challengeToSign,
        "0x" + r.toString("hex"),
        "0x" + s.toString("hex"),
        credId,
        authData
    );
}

async function main() {
    const slt = await ethers.getContractAt("SoulLockedToken", SLT_ADDRESS);
    const utilsFactory = await ethers.getContractFactory("Utils");
    const utils = await utilsFactory.deploy();
    await utils.waitForDeployment();

    const results: any[] = [];

    for (let i = 0; i < TOTAL; i++) {
        const { wallet, privateKey, publicKey } = createKeyPair();
        const credId = ethers.zeroPadValue(wallet.address, 32);
        const challenge = `Passkey-${i}`;
        const challengeHash = generateChallengeHash(challenge);

        const packed = ethers.solidityPacked(["uint8", "uint48", "bytes32"], [1, 0, challengeHash]);
        const challengeB64url = base64url.encode(Buffer.from(packed.slice(2), "hex"));
        const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeB64url}","origin":"http://localhost:3000","crossOrigin":false}`;
        const authData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";

        // try {
            const t1 = process.hrtime.bigint();
            const sig = await generateSignature(privateKey, authData, clientDataJSON, packed, credId, utils);
            const t2 = process.hrtime.bigint();
            console.log("sig :", sig);

            const t3 = process.hrtime.bigint();
            const checker = await slt.passKeyChecker(sig, challengeHash);
            const t4 = process.hrtime.bigint();
            console.log("checker :", checker);

            const t5 = process.hrtime.bigint();
            const owner = await slt.owner();
            const t6 = process.hrtime.bigint();
            console.log("owner :", owner);

            results.push({
                tokenId: i,
                time: {
                    sign: Number(t2 - t1) / 1e6,
                    verify: Number(t4 - t3) / 1e6,
                    ownerCall: Number(t6 - t5) / 1e6,
                },
            });

            if (i % 10 === 0) console.log(`[${i}] ✅ done`);
        // } catch (err) {
        //     results.push({
        //         tokenId: i,
        //         error: true,
        //         message: (err as Error).message,
        //     });
        //     console.error(`[${i}] ❌ failed`, (err as Error).message);
        // }
    }

    fs.writeFileSync("sbt_passkey_time_measurements.json", JSON.stringify(results, null, 2));
    console.log("✅ 시간 측정 완료: sbt_passkey_time_measurements.json");
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
