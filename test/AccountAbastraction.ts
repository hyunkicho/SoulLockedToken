// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { expect } from "chai";
// import { ethers } from "hardhat";
// import { AccountFactory, EntryPoint, NFT, SBT } from "../typechain-types";
// import { EntryPoint__factory, UserOperationStruct } from "@account-abstraction/contracts";
// import { AddressLike } from "ethers";

// describe("Basic AA wallet", function () {
//   async function deployAccountAbstractionFixture() {
//     const name = "Sample SBT";
//     const symbol = "SSBT";

//     const name_nft = "Sample NFT";
//     const symbol_nft = "NFT";

//     // Contracts are deployed using the first signer/account by default
//     const [owner, aaWalletOwner] = await ethers.getSigners();
//     const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
//     const entryPointFactory = await EntryPointFactory.deploy() as EntryPoint;
//     const entryPointAddress = await entryPointFactory.getAddress();
//     console.log("entryPointAddress >>", entryPointAddress);
//     const AA_accountFactory = await ethers.getContractFactory("AccountFactory");
//     const aa_accountFactory = await AA_accountFactory.deploy(entryPointAddress) as AccountFactory;
//     const SBT_Factory = await ethers.getContractFactory("SBT");
//     const sbt_Factory = await SBT_Factory.deploy(name, symbol, true) as SBT;
//     const sbtAddress = await sbt_Factory.getAddress();
//     const NFT_Factory = await ethers.getContractFactory("NFT");
//     const nft_Factory = await NFT_Factory.deploy(name, symbol) as NFT;
//     const nftAddress = await nft_Factory.getAddress();
//     return { aa_accountFactory, entryPointAddress, entryPointFactory, sbt_Factory, nft_Factory, sbtAddress, nftAddress, owner, aaWalletOwner };
//   }

//   describe("testing mint NFT to ERC4337", async function () {
//     it("Should make AA wallet correctly", async function () {
//       const { aa_accountFactory, entryPointAddress, entryPointFactory, sbt_Factory, nft_Factory, sbtAddress, nftAddress, owner, aaWalletOwner } = await loadFixture(
//         deployAccountAbstractionFixture
//       );
//       const sbt_owner_salt = 1; //example salt
//       const createAccountTx = await aa_accountFactory.connect(aaWalletOwner).createAccount(aaWalletOwner.address, sbt_owner_salt);
//       await createAccountTx.wait();
//       console.log(await aa_accountFactory.getAddress());
//       const newAaAccount = await aa_accountFactory.getAddress2(aaWalletOwner.address, sbt_owner_salt);
//       console.log("📮aa account address is : ", newAaAccount);
//       await aa_accountFactory.createAccount(aaWalletOwner.address, sbt_owner_salt);
//       // console.log("✅created aa account address is same as expected")
//       console.log("✅aa_accountContract : ", newAaAccount);
//       const aa_accountContract = await ethers.getContractAt("Account", newAaAccount);
//       console.log("✅newAaAccount owner : ", await aa_accountContract.owner());
//       console.log("✅owner EOA Address: ", await aaWalletOwner.address);

//       const addDepositTx = await aa_accountContract.addDeposit({value: ethers.parseEther("1")});
//       await addDepositTx.wait();
//       const deposit = await aa_accountContract.getDeposit();
//       console.log("deposit :", deposit);
      
//       const safeMintTx = await nft_Factory.safeMint(aaWalletOwner.address,1);
//       await safeMintTx.wait();
      
//       const callData = aa_accountContract.interface.encodeFunctionData(
//         "execute",
//         [
//           nftAddress, //target
//           0,
//           nft_Factory.interface.encodeFunctionData(
//             "transferFrom",
//             [
//               newAaAccount,
//               owner.address,
//               1
//             ]
//           )
//         ]
//       );
//       const walletAddress : AddressLike = newAaAccount;
//       const walletNonce = await entryPointFactory.getNonce(newAaAccount,0);

//       // Simulate signing a transaction hash
//       const userOp : UserOperationStruct = {
//         sender: walletAddress,
//         nonce: walletNonce,
//         initCode: "0x",
//         callData: callData,
//         callGasLimit: 200_000,
//         verificationGasLimit: 200_000,
//         preVerificationGas: 50_000,
//         maxFeePerGas: ethers.parseUnits("10", "gwei"),
//         maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
//         paymasterAndData: "0x",
//         signature: '0x'
//       };

//       const userOPHash = await entryPointFactory.getUserOpHash(userOp);
//       console.log(`userOPHash: ${userOPHash}`);
//       const signature = await aaWalletOwner.signMessage(ethers.getBytes(userOPHash));
//       const verified = ethers.verifyMessage(userOPHash,signature);
//       console.log(`verified: ${verified}`);

//       const userOpWithSig : UserOperationStruct = {
//         sender: walletAddress,
//         nonce: walletNonce,
//         initCode: "0x",
//         callData: callData,
//         callGasLimit: 200_000,
//         verificationGasLimit: 200_000,
//         preVerificationGas: 50_000,
//         maxFeePerGas: ethers.parseUnits("10", "gwei"),
//         maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
//         paymasterAndData: "0x",
//         signature: signature
//       };

//       // console.log(`UserOp.sender: ${userOp.sender}`);
//       // console.log(`UserOp.nonce: ${userOp.nonce}`);
//       // console.log(`UserOp.initCode: ${userOp.initCode}`);
//       // console.log(`UserOp.callData: ${userOp.callData}`);
//       // console.log(`UserOp.callGasLimit: ${userOp.callGasLimit}`);
//       // console.log(`UserOp.verificationGasLimit: ${userOp.verificationGasLimit}`);
//       // console.log(`UserOp.preVerificationGas: ${userOp.preVerificationGas}`);
//       // console.log(`UserOp.maxFeePerGas: ${userOp.maxFeePerGas}`);
//       // console.log(`UserOp.maxPriorityFeePerGas: ${userOp.maxPriorityFeePerGas}`);
//       // console.log(`UserOp.paymasterAndData: ${userOp.paymasterAndData}`);
//       // console.log(`UserOp.signature: ${userOp.signature}`);
      
//       const txHandleOps = await entryPointFactory.handleOps([userOpWithSig], walletAddress /* beneficiary */);
//       const txHandleOpsRes = await txHandleOps.wait();
//       // console.log(txHandleOpsRes);
//       console.log(`✅ Handle Ops tx hash: ${txHandleOpsRes?.hash}`);
      
//       expect(await nft_Factory.ownerOf(1)).to.equal(aaWalletOwner.address);
//       console.log(`✅ Nft minted to AA wallet succesfully`);
//     });

//     it("Should make AA wallet correctly with wallet init code", async function () {
//       const { aa_accountFactory, entryPointAddress, entryPointFactory, sbt_Factory, nft_Factory, sbtAddress, nftAddress, owner, aaWalletOwner } = await loadFixture(
//         deployAccountAbstractionFixture
//       );
//       const sbt_owner_salt = 1; //example salt
//       const createAccountTx = await aa_accountFactory.connect(aaWalletOwner).createAccount(aaWalletOwner.address, sbt_owner_salt);
//       await createAccountTx.wait();
//       console.log(await aa_accountFactory.getAddress());
//       const newAaAccount = await aa_accountFactory.getAddress2(aaWalletOwner.address, sbt_owner_salt);
//       console.log("📮aa account address is : ", newAaAccount);
//       await aa_accountFactory.createAccount(aaWalletOwner.address, sbt_owner_salt);
//       // console.log("✅created aa account address is same as expected")
//       console.log("✅aa_accountContract : ", newAaAccount);
//       const aa_accountContract = await ethers.getContractAt("Account", newAaAccount);
//       console.log("✅newAaAccount owner : ", await aa_accountContract.owner());
//       console.log("✅owner EOA Address: ", await aaWalletOwner.address);

//       const addDepositTx = await aa_accountContract.addDeposit({value: ethers.parseEther("1")});
//       await addDepositTx.wait();
//       const deposit = await aa_accountContract.getDeposit();
//       console.log("deposit :", deposit);
      
//       const safeMintTx = await nft_Factory.safeMint(aaWalletOwner.address,1);
//       await safeMintTx.wait();
      
//       const callData = aa_accountContract.interface.encodeFunctionData(
//         "execute",
//         [
//           nftAddress, //target
//           0,
//           nft_Factory.interface.encodeFunctionData(
//             "transferFrom",
//             [
//               newAaAccount,
//               owner.address,
//               1
//             ]
//           )
//         ]
//       );
//       const walletAddress : AddressLike = newAaAccount;
//       const walletNonce = await entryPointFactory.getNonce(newAaAccount,0);

//       // Simulate signing a transaction hash
//       const userOp : UserOperationStruct = {
//         sender: walletAddress,
//         nonce: walletNonce,
//         initCode: "0x",
//         callData: callData,
//         callGasLimit: 200_000,
//         verificationGasLimit: 200_000,
//         preVerificationGas: 50_000,
//         maxFeePerGas: ethers.parseUnits("10", "gwei"),
//         maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
//         paymasterAndData: "0x",
//         signature: '0x'
//       };

//       const userOPHash = await entryPointFactory.getUserOpHash(userOp);
//       console.log(`userOPHash: ${userOPHash}`);
//       const signature = await aaWalletOwner.signMessage(ethers.getBytes(userOPHash));
//       const verified = ethers.verifyMessage(userOPHash,signature);
//       console.log(`verified: ${verified}`);

//       const userOpWithSig : UserOperationStruct = {
//         sender: walletAddress,
//         nonce: walletNonce,
//         initCode: "0x",
//         callData: callData,
//         callGasLimit: 200_000,
//         verificationGasLimit: 200_000,
//         preVerificationGas: 50_000,
//         maxFeePerGas: ethers.parseUnits("10", "gwei"),
//         maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
//         paymasterAndData: "0x",
//         signature: signature
//       };

//       // console.log(`UserOp.sender: ${userOp.sender}`);
//       // console.log(`UserOp.nonce: ${userOp.nonce}`);
//       // console.log(`UserOp.initCode: ${userOp.initCode}`);
//       // console.log(`UserOp.callData: ${userOp.callData}`);
//       // console.log(`UserOp.callGasLimit: ${userOp.callGasLimit}`);
//       // console.log(`UserOp.verificationGasLimit: ${userOp.verificationGasLimit}`);
//       // console.log(`UserOp.preVerificationGas: ${userOp.preVerificationGas}`);
//       // console.log(`UserOp.maxFeePerGas: ${userOp.maxFeePerGas}`);
//       // console.log(`UserOp.maxPriorityFeePerGas: ${userOp.maxPriorityFeePerGas}`);
//       // console.log(`UserOp.paymasterAndData: ${userOp.paymasterAndData}`);
//       // console.log(`UserOp.signature: ${userOp.signature}`);
      
//       const txHandleOps = await entryPointFactory.handleOps([userOpWithSig], walletAddress /* beneficiary */);
//       const txHandleOpsRes = await txHandleOps.wait();
//       // console.log(txHandleOpsRes);
//       console.log(`✅ Handle Ops tx hash: ${txHandleOpsRes?.hash}`);
      
//       expect(await nft_Factory.ownerOf(1)).to.equal(aaWalletOwner.address);
//       console.log(`✅ Nft minted to AA wallet succesfully`);
//     });
//   });
// });
