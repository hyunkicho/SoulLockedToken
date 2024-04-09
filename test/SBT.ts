import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("SBT", function () {
  async function deploySBTFixture() {
    const name = "Soul Bound Token";
    const symbol = "SBT";

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const SBTFactory = await ethers.getContractFactory("SBT");
    const sbt = await SBTFactory.deploy(name, symbol, true);

    return { sbt, owner, otherAccount };
  }

  describe("testing ERC5192 validity", async function () {
    
    it("Should locked correctly", async function () {
      const { sbt, owner, otherAccount } = await loadFixture(
        deploySBTFixture
      );
      await sbt.safeMint(owner, 0);
      expect(await sbt.locked(0)).to.be.true;
      await sbt.safeMint(owner, 1);
      expect(await sbt.locked(1)).to.be.true;
    });

    it("Should not transferred if nft is locked", async function () {
      const { sbt, owner, otherAccount } = await loadFixture(
        deploySBTFixture
      );
      await sbt.safeMint(owner, 0);
      await expect(sbt.transferFrom(owner, otherAccount, 0)).to.be.revertedWithCustomError(
        sbt, 'ErrLocked'
      );
    });
  });
});
