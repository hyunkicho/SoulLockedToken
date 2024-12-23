// import fs from 'fs';
// import path from 'path';
// import crypto from 'crypto';

// import {
//     derivePublicKey,
//     signMessage,
//     verifySignature
//   } from "@zk-kit/eddsa-poseidon";

// import { poseidon1, poseidon4 } from 'poseidon-lite';
// import { JwtPayload } from 'jsonwebtoken';
// // import { hre } from 'ethers';

// function generateRandom127Bits() {
//     const buffer = crypto.randomBytes(16);
//     buffer[0] = buffer[0] & 0x7F;
//     return BigInt('0x' + buffer.toString('hex')).toString();
// }

// function makingPoseidonHashBasedJWT(privateKey: string, jwt_payload: string) {
//     //jwt header and jwt_payload is substitute to jwt_payload in real case it should be changed
//     //This process is making a hash inside JWT (header & payload)
//     const message = poseidon1([`${jwt_payload}`]);
//     //This is the process of making mock JWT not real
//     const signature = signMessage(privateKey, message);
//     const publicKey = derivePublicKey(privateKey);
//     const response = verifySignature(message, signature, publicKey);
//     if (response !== true) {
//         throw new Error("JWT create failed");
//     }
//     return {publicKey, signature, message};
// }

// export async function register_process(privateKey: string, jwtMock: string ) {
//     const dataDir = path.join(__dirname, 'register_data');
//     // const privateKey = `secret`;
//     const {publicKey, signature, message} = makingPoseidonHashBasedJWT(privateKey, jwtMock);

//     const rand = generateRandom127Bits();
//     const hash = poseidon4([rand, signature.R8[0], signature.R8[1], signature.S]);
//     //rand is for imporving security
//     const input = {
//         "A": publicKey,
//         "R": signature.R8,
//         "S": signature.S,
//         "Rand": rand,
//         "M": message,
//         "h_cert": hash
//     };
//     // console.log(input);
//     if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir); }
//     const filePath = path.join(dataDir, 'input.json');
//     fs.writeFileSync(filePath, JSON.stringify({
//         "A": [input.A[0].toString(), input.A[1].toString()],
//         "R": [input.R[0].toString(), input.R[1].toString()],
//         "S": input.S.toString(),
//         "Rand": input.Rand.toString(),
//         "M": input.M.toString(),
//         "h_cert": input.h_cert.toString()
//     }));
    
//     return input;
//   }

// // publish phase

// // export async function publish_process(privateKey: string, jwt_payload: Payload, raw_tx: string) {
// //     const dataDir = path.join(__dirname, 'publish_data');
// //     // const privateKey = `secret`;
// //     // const cert = `verified JWT token`;
// //     const {publicKey, signature, bigIntTtpedPayload} = makingPoseidonHashBasedJWT(privateKey, jwt_payload);

// //     const rand = generateRandom127Bits();
// //     const hash = poseidon4([rand, signature.R8[0], signature.R8[1], signature.S]);
// //     const bigIntRawTx = rawTxToBigInt(raw_tx);
// //     const input = {
// //         "R": signature.R8,
// //         "S": signature.S,
// //         "Rand": rand,
// //         "h_cert": hash,
// //         "h_msg": poseidon1([`${bigIntRawTx}`])
// //     };
// //     // console.log(input);

// //     if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir); }
// //     const filePath = path.join(dataDir, 'input.json');
// //     fs.writeFileSync(filePath, JSON.stringify({
// //         "R": [input.R[0].toString(), input.R[1].toString()],
// //         "S": input.S.toString(),
// //         "Rand": input.Rand.toString(),
// //         "h_cert": input.h_cert.toString(),
// //         "h_msg": input.h_msg.toString()
// //     }));

// //     return input;
// // }

// // async function rawTxToBigInt(rawTx: string): Promise<bigint> {
// //     // Step 1: Parse the raw transaction
// //     const tx = hre.ethers.utils.parseTransaction(rawTx);

// //     // Step 2: Serialize the transaction back into a raw format
// //     const serializedTx = hre.ethers.utils.serializeTransaction(tx);

// //     // Step 3: Convert the serialized transaction to a BigInt
// //     const bigIntValue = BigInt('0x' + serializedTx.slice(2)); // Remove the "0x" prefix

// //     return bigIntValue;
// // }