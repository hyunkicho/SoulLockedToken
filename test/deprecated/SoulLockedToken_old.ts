// import {
//     time,
//     loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import crypto from 'crypto';
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import base64url from 'base64url';
// import { SBTGuardWithPasskey, Utils } from "../typechain-types";
// import elliptic from 'elliptic';
// import { Address } from "cluster";
// // let sha3 = require('js-sha3');
// let ec = new elliptic.ec('p256');

// function derToRS(der) {
//   var offset = 3;
//   var dataOffset;

//   if (der[offset] == 0x21) {
//     dataOffset = offset + 2;
//   }
//   else {
//     dataOffset = offset + 1;
//   }
//   const r = der.slice(dataOffset, dataOffset + 32);
//   offset = offset + der[offset] + 1 + 1
//   if (der[offset] == 0x21) {
//     dataOffset = offset + 2;
//   }
//   else {
//     dataOffset = offset + 1;
//   }
//   const s = der.slice(dataOffset, dataOffset + 32);
//   return [r, s]
// }

// describe("Test passkey attached SBT", function () {

//     async function deployFixture() {
//         const deployer = (await ethers.getSigners())[0];
//         const registeredAddress = deployer.address;
//         console.log(`registeredAddress: 1 ${registeredAddress}`);
//         console.log("Attempting to get Utils contract factory...");

//         const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
//         console.log("Utils contract factory acquired.");
//         const P256VerifierContract = await P256VerifierFactory.deploy();
//         console.log("P256VerifierContract : ", await P256VerifierContract.getAddress())

//         const UtilsFactory = await ethers.getContractFactory("Utils");
//         console.log("Utils contract factory acquired.");
//         const UtilsFactoryContract = await UtilsFactory.deploy();

//         const UtilsAddress = await UtilsFactoryContract.getAddress();
//         console.log(`Utils: ${UtilsAddress}`);

//         const SoulLockedToken = await ethers.getContractFactory("SoulLockedToken");
//         const SoulLockedTokenFactory = await SoulLockedToken.deploy("Name","Symbol",true) as unknown as SoulLockedToken;
//         return {registeredAddress, UtilsFactoryContract, UtilsAddress, SoulLockedTokenFactory, deployer};
//     }

//     describe("testing passkey basic functions", async function () {

//         it("mint SBT correctyl and check if owner is valid", async function () {
//             const { registeredAddress, UtilsFactoryContract, UtilsAddress, SoulLockedTokenFactory, deployer } = await loadFixture(
//                 deployFixture
//             );
//             // ec.setPrivateKey(privateKey);
//             let keyPair = ec.keyFromPrivate("750a4ba28d1b278d35eab3df8d3eb40449207c2197dca9d5625d247cc367b8a1");
//             let privateKey = keyPair.getPrivate("hex");
//             // Get the public and private keys
//             // let _publicKey = ec.getPublicKey();
//             let _publicKey = keyPair.getPublic();
//             const publicKey_ecdsa = Buffer.from(_publicKey.encode("hex").substr(2), "hex");
//             const publicKey = [
//                 "0x" + publicKey_ecdsa.slice(0, 32).toString('hex'),
//                 "0x" + publicKey_ecdsa.slice(32).toString('hex')
//             ];
//             console.log("Public Key:", publicKey_ecdsa.toString('hex'));
//             console.log("Public Key:", publicKey);

//             // 여기서 유저 식별 정보인 cred_id는 SBT의 ID 또는 지갑 주소로 되면 될듯?
//             const address = deployer.address; // 예: "0x1234567890abcdef1234567890abcdef12345678"
//             const bytes32Address = ethers.zeroPadValue(address, 32);
//             const credId = bytes32Address;
//             console.log("credId:", ethers.hexlify(credId));

//             const tokenId = 0;
//             //   const registeredAddress = deployer.address;

//             console.log("STEP 01 : addR1Signer and safeMint");
//             const safeMintTx = await SoulLockedTokenFactory.safeMint(registeredAddress, tokenId, credId, publicKey);
//             await safeMintTx.wait();
//             console.log("safeMintTx : ", safeMintTx);

//             expect(await SoulLockedTokenFactory.ownerOf(tokenId)).equal(registeredAddress);
//             const coder = ethers.AbiCoder.defaultAbiCoder();
//             const challenge = "PasskeyVerificationChallenge";
//             // 여기서 인증할 데이터를 정할 것.
//             const enc = coder.encode(
//                 ["string"],
//                 [challenge]
//             );
//             const challengHash = ethers.keccak256(enc);
//             console.log("challengHash:", challengHash);

//             const version = 1;
//             const validUntil = 0;
//             const challengeToSign = ethers.solidityPacked(
//                 ["uint8", "uint48", "bytes32"],
//                 [version, validUntil, challengHash]
//             );
//             console.log("challenge:", challengeToSign);
//             const challengeBuffer = Buffer.from(challengeToSign.slice(2), 'hex');
//             const challengeb64url = base64url.encode(challengeBuffer);
//             const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeb64url}","origin":"http://localhost:3000","crossOrigin":false}`;
//             console.log("clientDataJSON:", clientDataJSON); //챌린지를 json형태로 메타데이터를 다붚여서 base64 인코딩 해야한다. 그 후 서명을 그 데이터로 해야한다.
//             console.log(clientDataJSON.slice(23));
//             console.log(clientDataJSON.slice(1));
//             console.log("getting authenticator data from Front end");
//             const authenticatorData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000"; //세션마다 다른 인증 시스템에 대한 정보
//             const authenticatorDataBuffer = Buffer.from(authenticatorData.slice(2), 'hex');
//             const clientDataJSONHash = crypto.createHash('sha256').update(clientDataJSON).digest(); //해시로 바꾸는 것. 사용하는 해시는 passkey 안에서는 sha256을 사용
//             console.log("clientDataJSONHash:", clientDataJSONHash.toString('hex'));
//             const concatenatedBuffer = Buffer.concat([authenticatorDataBuffer, clientDataJSONHash]);
//             const message_hash = (crypto.createHash('sha256').update(concatenatedBuffer).digest()).toString('hex'); //세션마다 다른 인증 시스템 정보도 넣어서 진행
//             // let hash = Buffer.from(message_hash, "hex");
//             console.log("message_hash:", message_hash);

//             let signature_js = ec.sign(message_hash, privateKey, "hex", { canonical: true });
//             console.log("Signature:", signature_js.toDER('hex').toString(16));
//             const ecdsaParsed = derToRS(Buffer.from(signature_js.toDER('hex'), "hex"));
//             const _sig = [
//                 '0x' + ecdsaParsed[0].toString('hex'),
//                 '0x' + ecdsaParsed[1].toString('hex')
//             ];
//             console.log("Signature parsed:", _sig);

//             // Signature
//             const sig = await UtilsFactoryContract.rawSignatureToSignature(
//                 challengeToSign,     
//                 _sig[0],
//                 _sig[1],
//                 credId,
//                 authenticatorData
//             );
//             console.log("sig:", sig);

//             const CheckingPasskey = await SoulLockedTokenFactory.passKeyChecker(sig, challengHash);
//             expect(CheckingPasskey).to.be.true;

//             const authCheck = await SoulLockedTokenFactory.authCheck(tokenId, deployer.address);
//             expect(authCheck[0]).to.be.true;

//             const updateAuth = await SoulLockedTokenFactory.updateAuth(sig, challengHash, tokenId, credId);

//         })

//         it("mint SBT correctyl and check if owner is valid", async function () {
//             const { registeredAddress, UtilsFactoryContract, UtilsAddress, SoulLockedTokenFactory, deployer } = await loadFixture(
//                 deployFixture
//             );
//             let keyPair = ec.keyFromPrivate("750a4ba28d1b278d35eab3df8d3eb40449207c2197dca9d5625d247cc367b8a1");
//             let privateKey = keyPair.getPrivate("hex");
//             let _publicKey = keyPair.getPublic();
//             const publicKey_ecdsa = Buffer.from(_publicKey.encode("hex").substr(2), "hex");
//             const publicKey = [
//                 "0x" + publicKey_ecdsa.slice(0, 32).toString('hex'),
//                 "0x" + publicKey_ecdsa.slice(32).toString('hex')
//             ];
//             const address = deployer.address;
//             const bytes32Address = ethers.zeroPadValue(address, 32);
//             const credId = bytes32Address;

//             const tokenId = 0;
//             //   const registeredAddress = deployer.address;

//             const safeMintTx = await SoulLockedTokenFactory.safeMint(registeredAddress, tokenId, credId, publicKey);
//             await safeMintTx.wait();

//             expect(await SoulLockedTokenFactory.ownerOf(tokenId)).equal(registeredAddress);
//             const coder = ethers.AbiCoder.defaultAbiCoder();
//             const challenge = "PasskeyVerificationChallenge";
//             // 여기서 인증할 데이터를 정할 것.
//             const enc = coder.encode(
//                 ["string"],
//                 [challenge]
//             );
//             const challengHash = ethers.keccak256(enc);
//             const version = 1;
//             const validUntil = 0;
//             const challengeToSign = ethers.solidityPacked(
//                 ["uint8", "uint48", "bytes32"],
//                 [version, validUntil, challengHash]
//             );
//             const challengeBuffer = Buffer.from(challengeToSign.slice(2), 'hex');
//             const challengeb64url = base64url.encode(challengeBuffer);
//             const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeb64url}","origin":"http://localhost:3000","crossOrigin":false}`;
//             const authenticatorData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000"; //세션마다 다른 인증 시스템에 대한 정보
//             const authenticatorDataBuffer = Buffer.from(authenticatorData.slice(2), 'hex');
//             const clientDataJSONHash = crypto.createHash('sha256').update(clientDataJSON).digest(); //해시로 바꾸는 것. 사용하는 해시는 passkey 안에서는 sha256을 사용
//             const concatenatedBuffer = Buffer.concat([authenticatorDataBuffer, clientDataJSONHash]);
//             const message_hash = (crypto.createHash('sha256').update(concatenatedBuffer).digest()).toString('hex'); //세션마다 다른 인증 시스템 정보도 넣어서 진행
//             let signature_js = ec.sign(message_hash, privateKey, "hex", { canonical: true });
//             const ecdsaParsed = derToRS(Buffer.from(signature_js.toDER('hex'), "hex"));
//             const _sig = [
//                 '0x' + ecdsaParsed[0].toString('hex'),
//                 '0x' + ecdsaParsed[1].toString('hex')
//             ];

//             // Signature
//             const sig = await UtilsFactoryContract.rawSignatureToSignature(
//                 challengeToSign,     
//                 _sig[0],
//                 _sig[1],
//                 credId,
//                 authenticatorData
//             );

//             const CheckingPasskey = await SoulLockedTokenFactory.passKeyChecker(sig, challengHash);
//             expect(CheckingPasskey).to.be.true;

//             const authCheck = await SoulLockedTokenFactory.authCheck(tokenId, deployer.address);
//             expect(authCheck[0]).to.be.true;
//             const authDateBefore = authCheck[0].checkedAt;
//             const updateAuthTx = await SoulLockedTokenFactory.updateAuth(sig, challengHash, tokenId, credId);
//             await updateAuthTx.wait();
//             expect(authCheck[0].checkedAt).greaterThan(authDateBefore);

//             const changedSig = await UtilsFactoryContract.rawSignatureToSignature(
//                 challengeToSign,     
//                 _sig[0],
//                 _sig[1],
//                 credId,
//                 authenticatorData
//             );

//             await SoulLockedTokenFactory.burn(changedSig, challengHash, tokenId, credId);

//         })

//         it("execute many times", async function () {
//             const { registeredAddress, UtilsFactoryContract, SoulLockedTokenFactory } = await loadFixture(deployFixture);
        
//             const tasks = Array.from({ length: 3 }, async (_, i) => {
//                 console.log("i >>", i);
//                 const wallet = ethers.Wallet.createRandom();
//                 let keyPair = ec.keyFromPrivate(wallet.privateKey);
//                 let privateKey = keyPair.getPrivate("hex");
        
//                 let _publicKey = keyPair.getPublic();
//                 const publicKey_ecdsa = Buffer.from(_publicKey.encode("hex").substr(2), "hex");
//                 const publicKey = [
//                     "0x" + publicKey_ecdsa.slice(0, 32).toString('hex'),
//                     "0x" + publicKey_ecdsa.slice(32).toString('hex')
//                 ];
        
//                 const address = wallet.address;
//                 const bytes32Address = ethers.zeroPadValue(address, 32);
//                 const credId = bytes32Address;
        
//                 const tokenId = i;
//                 const safeMintTx = await SoulLockedTokenFactory.safeMint(registeredAddress, tokenId, credId, publicKey);
//                 await safeMintTx.wait();
        
//                 expect(await SoulLockedTokenFactory.ownerOf(tokenId)).equal(registeredAddress);
        
//                 const coder = ethers.AbiCoder.defaultAbiCoder();
//                 const challenge = "PasskeyVerificationChallenge";
//                 const enc = coder.encode(["string"], [challenge]);
//                 const challengeHash = ethers.keccak256(enc);
        
//                 const version = 1;
//                 const validUntil = 0;
//                 const challengeToSign = ethers.solidityPacked(
//                     ["uint8", "uint48", "bytes32"],
//                     [version, validUntil, challengeHash]
//                 );
        
//                 const challengeBuffer = Buffer.from(challengeToSign.slice(2), 'hex');
//                 const challengeb64url = base64url.encode(challengeBuffer);
        
//                 const clientDataJSON = `{"type":"webauthn.get","challenge":"${challengeb64url}","origin":"http://localhost:3000","crossOrigin":false}`;
//                 const authenticatorData = "0x49960de5880e8c687434170f6476605b8fe4aeb9a28632c7995cf3ba831d97630500000000";
//                 const authenticatorDataBuffer = Buffer.from(authenticatorData.slice(2), 'hex');
        
//                 const clientDataJSONHash = crypto.createHash('sha256').update(clientDataJSON).digest();
//                 const concatenatedBuffer = Buffer.concat([authenticatorDataBuffer, clientDataJSONHash]);
//                 const message_hash = crypto.createHash('sha256').update(concatenatedBuffer).digest().toString('hex');
        
//                 let signature_js = ec.sign(message_hash, privateKey, "hex", { canonical: true });
//                 const ecdsaParsed = derToRS(Buffer.from(signature_js.toDER('hex'), "hex"));
//                 const _sig = [
//                     '0x' + ecdsaParsed[0].toString('hex'),
//                     '0x' + ecdsaParsed[1].toString('hex')
//                 ];
        
//                 // Signature 생성
//                 const sig = await UtilsFactoryContract.rawSignatureToSignature(
//                     challengeToSign,
//                     _sig[0],
//                     _sig[1],
//                     credId,
//                     authenticatorData
//                 );
        
//                 // passKeyChecker로 검증
//                 const CheckingPasskey = await SoulLockedTokenFactory.passKeyChecker(sig, challengeHash);
//                 expect(CheckingPasskey).to.be.true;
//             });
        
//             await Promise.all(tasks);
//         });
        
//     })
// });
