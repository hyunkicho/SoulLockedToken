// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
// import { expect } from "chai";
// import { ethers } from "hardhat";

// describe("guard SBT from Account Abstraction Attack", function () {
//   const price = 1000;    

//   async function deployFixture() {

//     // Contracts are deployed using the first signer/account by default
//     const [owner, otherAccount] = await ethers.getSigners();

//     const name = "Soul Bound Token";
//     const symbol = "SBT";

//     const SSBTAAGaurdFactory = await ethers.getContractFactory("SBTAAGaurd");
//     const sbt = await SSBTAAGaurdFactory.deploy(name, symbol, true);

//     const TradableAccountFactory = await ethers.getContractFactory("TradableAccount");
//     const ta = await TradableAccountFactory.deploy();

//     const RegisterdAccountFactory = await ethers.getContractFactory("RegisteredAccount");
//     const registeredAccount = await RegisterdAccountFactory.deploy();

//     return { ta, sbt, RegisterdAccountFactory, registeredAccount, owner, otherAccount };
//   }

//   describe("testing ERC5192 validity", async function () {
    
//     it("mint token1 SBT if the address is EOA", async function () {
//       const { ta,  sbt, RegisterdAccountFactory, registeredAccount, owner, otherAccount } = await loadFixture(
//         deployFixture
//       );

//       await sbt.safeMint(owner.address, 1);
//       // console.log("tradable account is >>", await ta.getAddress());
//       // console.log("owner of SBT token is >>", owner.address);

//       expect(await sbt.ownerOf(1)).to.equal(owner.address);
//     });

//     it("caCheckerr must work correctly", async function () {
//       const { ta,  sbt, RegisterdAccountFactory, registeredAccount, owner, otherAccount } = await loadFixture(
//         deployFixture
//       );

//       await expect(sbt.safeMint(await ta.getAddress(), 1))
//       .to.be.revertedWith("SBTAAGaurd: to account is contract and not allowed");
//     });

//     it("bytecode checker must work correctly", async function () {
//       const { ta,  sbt, RegisterdAccountFactory, registeredAccount, owner, otherAccount } = await loadFixture(
//         deployFixture
//       );
//       const RegisterdAccountByteCode = RegisterdAccountFactory.bytecode;
//       const RegisterdAccountByteCodeHash = ethers.keccak256(RegisterdAccountByteCode);
//       console.log("RegisterdAccountByteCodeHash >>", RegisterdAccountByteCodeHash);
//       await sbt.registerBytecodeHash(RegisterdAccountByteCodeHash);
//       const BytecodeChecked = await sbt.bytecodeChecker(sbt.getAddress());
//       console.log("BytecodeChecked >>", BytecodeChecked);
//       await expect(sbt.safeMint(await registeredAccount.getAddress(), 1))
//     });
//   })

//   it("execute many times", async function () {
//     const { ta, sbt, owner, otherAccount } = await loadFixture(
//       deployFixture
//     );

//     for(let i=0; i< 1000; i++) {
//       await sbt.safeMint(otherAccount.address, i);
//     }
//   });
// });
