// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { register_process } from "./zkUtils";
// import {} from "snarkjs";
// import fs from "fs";
// import { Groth16Verifier } from "../typechain-types";
// const { BigNumber } = require("ethers");


// describe("Make zk Input and verify it", function () {
//   async function deployFixture() {
//     // Contracts are deployed using the first signer/account by default
//     const [owner, otherAccount] = await ethers.getSigners();

//     const verifier_register_factory = await ethers.getContractFactory("Groth16Verifier");
//     const verifier_register = await verifier_register_factory.deploy() as unknown as Groth16Verifier;
//     console.log("verifier_register >>", await verifier_register.getAddress());
//     const privateKey = "your-256-bit-secret";
//     const payload = "01";
//     const register_input = await register_process(privateKey, payload);
//     console.log("register_input >>", register_input);
//     // const verifier_publish_factory = await ethers.getContractFactory("verifier_publish");
//     // const verifier_publish = await verifier_publish_factory.deploy() as unknown as Verifier_publish;
//     // console.log("verifier_publish >>", await verifier_publish.getAddress());
//     // const raw_tx = '0xddfjwkldjflwkjelfwjlkflwf'
//     // const publish_input = await publish_process(privateKey, payload, raw_tx);
//     // console.log("publish_input >>", publish_input);

//     return { owner, otherAccount, verifier_register, register_input };
//   }

//   describe("testing register phase", async function() {

//     it("should pass the verification", async function () {
//       const {owner, otherAccount, verifier_register, register_input} 
//       = await loadFixture(
//         deployFixture
//       );
//       // const proofs: any = [];
//       // const prooflist = fs.readdirSync(`${__dirname}/../zk/zkaa_register/proofs`);
//       // prooflist.forEach(function (f) {
//       //   const calldata = fs.readFileSync(`${__dirname}/../zk/zkaa_register/proofs/${f}`, "utf-8");
//       //   const validJson = `[${calldata}]`;
//       //   const calldataArray = JSON.parse(validJson);
//       //   proofs.push(calldataArray);
//       // });

//       const call: any = [
//         ["0x0856cb213b4c712152215edd4f7eb4608108772c8d4476497de33789901f93ab", "0x052b3c4b8a753824979894847b8e7749b0ee5f050d59a5a579af52f0c2f843aa"],[["0x106bf9f9256dbd0c2c0271311a560e2f748cb93354b282b975f236b285703714", "0x2e5a41d5e543bf2007b2800a344a9859c49e776c5b14bfcb9ce24fe056cf8a65"],["0x04e24a390a1eefcd7f98d92c33de33aecb2e16f0826ad63b41548a8def5dc2c0", "0x0397fa7754a131be347865ed63583a2bc15c7cd1df53802d8a1e2f9e878edce6"]],["0x15ca583716661d800a9f1786e7a7801e068f1ad8860b1263dc690e5959612d22", "0x094c7c4d9b610af057926d73c173aeab12e9cc7b104981958fb30ce57f5edb90"],["0x1f3f1f6f2b7fcd00622237a74b585c2ea682985762afbda96d4a539f4016e3c0","0x275b0b57d1fcd14732440035ac1f9ca6ade83a83680df180404d91e2a18ac7ba","0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133","0x16aeb091e874247f0a7349652ee33a4cbf1a060f87f83e56e0be039337cc4006"]
//       ];
      
//       // Convert elements to BigNumber as needed
      
//       // Ensure you are passing the right arguments
//       const view = await verifier_register.verifyProof(call[0], call[1], call[2], call[3]);
      
//       expect(view).to.equal(true);
  
//         // console.log(`Gas used: ${await verifier.gasUsed()}`);
//         // console.log(res);  
      

//       // console.log("verifyProofCall >>", verifyProofCall);
//     })
//   })
// })
