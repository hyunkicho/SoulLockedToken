// import {
//   time,
//   loadFixture,
// } from "@nomicfoundation/hardhat-toolbox/network-helpers";
// import { expect } from "chai";
// import { ethers } from "hardhat";

// describe("TradableAccount", function () {
//   async function deployTradableAccountFixture() {
//     const name = "TradableAccount";
//     const symbol = "TA";

//     // Contracts are deployed using the first signer/account by default
//     const [owner, otherAccount] = await ethers.getSigners();

//     const TradableAccountFactory = await ethers.getContractFactory("TradableAccount");
//     const ta = await TradableAccountFactory.deploy();

//     return { ta, owner, otherAccount };
//   }

//   describe("testing TradableAccount validity", async function () {
//     const price = 1000;    
//     it("Should set price correctly", async function () {
//       const { ta, owner, otherAccount} = await loadFixture(
//         deployTradableAccountFixture
//       );
//       await ta.setPrice(price);
//       expect(await ta.getPrice()).to.equal(price);
//     });

//     it("Owner should change after buying", async function () {
//       const { ta, owner, otherAccount} = await loadFixture(
//         deployTradableAccountFixture
//       );
//       await ta.setPrice(price);
//       expect(await ta.owner()).to.equal(owner.address);
//       await ta.buyOwner(otherAccount.address, {value: price});
//       expect(await ta.owner()).to.equal(otherAccount.address);
//     });
//   });
// });
