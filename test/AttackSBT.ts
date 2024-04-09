import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("attacking SBT via tradable account", function () {
  const price = 1000;    

  async function deployFixture() {

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const name = "Soul Bound Token";
    const symbol = "SBT";

    const SBTFactory = await ethers.getContractFactory("SBT");
    const sbt = await SBTFactory.deploy(name, symbol, true);

    const TradableAccountFactory = await ethers.getContractFactory("TradableAccount");
    const ta = await TradableAccountFactory.deploy();

    return { ta, sbt, owner, otherAccount };
  }

  describe("testing ERC5192 validity", async function () {
    
    it("mint token1 SBT correctyl and check if owner is valid", async function () {
      const { ta, sbt, owner, otherAccount } = await loadFixture(
        deployFixture
      );

      await sbt.safeMint(ta, 1);
      // console.log("tradable account is >>", await ta.getAddress());
      // console.log("owner of SBT token is >>", await sbt.ownerOf(1));

      expect(await sbt.ownerOf(1)).to.equal(await ta.getAddress());
    });

    it("SBT is bound to contract account and check contract account", async function () {
      const { ta, sbt, owner, otherAccount } = await loadFixture(
        deployFixture
      );

      await sbt.safeMint(ta, 1);

      expect(await sbt.ownerOf(1)).to.equal(await ta.getAddress());
      expect(await ta.owner()).to.equal(owner.address);
      // console.log("owner of Tradable account is >>", await ta.owner());

    });

    it("SBT account owner have changed after the account is traded", async function () {
      const { ta, sbt, owner, otherAccount } = await loadFixture(
        deployFixture
      );

      await sbt.safeMint(ta, 1);
      console.log("owner befroe trading account is >>", await ta.owner());

      await ta.setPrice(price);
      expect(await ta.owner()).to.equal(owner.address);

      await ta.buyOwner(otherAccount.address, {value: price});
      console.log("owner after trading account is >>", await ta.owner())
      expect(await ta.owner()).to.equal(otherAccount.address);

    });

    it("execute many times", async function () {
      const { ta, sbt, owner, otherAccount } = await loadFixture(
        deployFixture
      );

      for(let i=1; i< 1000; i++) {
        await sbt.safeMint(otherAccount.address, i);
      }

      for(let i=1; i< 1000; i++) {
        const TradableAccountFactory = await ethers.getContractFactory("TradableAccount");
        const tradableAccount = await TradableAccountFactory.deploy();
        await tradableAccount.setPrice(price+i);
        await tradableAccount.connect(otherAccount).buyOwner(otherAccount.address, {value: price+i});
      }
    });

  });

});
