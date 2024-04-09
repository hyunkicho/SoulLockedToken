import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("guard SBT from PrivateKey Trading Attack", function () {
  const price = 1000;    

  async function deployFixture() {

    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount, web2AuthServiceAccount] = await ethers.getSigners();

    const name = "Soul Bound Token";
    const symbol = "SBT";

    const SBTAAGaurdWithWeb2Factory = await ethers.getContractFactory("SBTAAGaurdWithWeb2");
    const sbt = await SBTAAGaurdWithWeb2Factory.deploy(name, symbol, true);

    const TradableAccountFactory = await ethers.getContractFactory("TradableAccount");
    const ta = await TradableAccountFactory.deploy();

    return { ta, sbt, owner, otherAccount ,web2AuthServiceAccount};
  }

  describe("testing SBTAAGaurdWithWeb2", async function () {

    it("caCheckerr must work correctly", async function () {
      const { ta, sbt, owner, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(sbt.safeMint(await ta.getAddress(), 1))
      .to.be.revertedWith("SBTAAGaurdWithWeb2 : to address is contract account");
    });

    it("must revert non wihtelisted token", async function () {
      const { ta, sbt, owner, otherAccount } = await loadFixture(
        deployFixture
      );

      await expect(sbt.safeMint(owner.address, 1))
      .to.be.revertedWith("SBTAAGaurdWithWeb2 : to address is not web2 whitelisted");
    });

    it("must passed if whitelisted", async function () {
      const { ta, sbt, owner, otherAccount } = await loadFixture(
        deployFixture
      );

      await sbt.addWeb2Whitelist(otherAccount.address);

      await sbt.safeMint(otherAccount.address, 1);
      // console.log("whirelisted account is >>", otherAccount.address);
      // console.log("owner of SBT token is >>", await sbt.ownerOf(1));

      expect(await sbt.ownerOf(1)).to.equal(otherAccount.address);
    });

    it("must add new web2Auth manager correctly", async function () {
      const { ta, sbt, owner, otherAccount, web2AuthServiceAccount } = await loadFixture(
        deployFixture
      );

      const byte32OfRole = await sbt.WEB2AUTH_ROLE();
      // console.log("web2 auth role is >>", byte32OfRole);

      await sbt.grantRole(byte32OfRole,web2AuthServiceAccount.address);

      await sbt.connect(web2AuthServiceAccount).addWeb2Whitelist(otherAccount.address);

      await sbt.safeMint(otherAccount.address, 1);
      // console.log("whirelisted account is >>", otherAccount.address);
      // console.log("owner of SBT token is >>", await sbt.ownerOf(1));

      expect(await sbt.ownerOf(1)).to.equal(otherAccount.address);
    });
  })

  it("execute many times", async function () {
    const { ta, sbt, owner, otherAccount } = await loadFixture(
      deployFixture
    );
    const signers = await ethers.getSigners();
    const name = "Soul Bound Token";
    const symbol = "SBT";

    for(let i=0; i< 1000; i++) {
      const ranInt =  Math.floor(Math.random() * 20)
      const signer = signers[ranInt];
      const signer2 = signers[(ranInt+1)%20];
      const SBTAAGaurdWithWeb2Factory = await ethers.getContractFactory("SBTAAGaurdWithWeb2");
      const sbt = await SBTAAGaurdWithWeb2Factory.deploy(name, symbol, true);
      const byte32OfRole = await sbt.WEB2AUTH_ROLE();
      await sbt.grantRole(byte32OfRole,signer.address);
      await sbt.connect(signer).addWeb2Whitelist(signer2.address);
      await sbt.safeMint(signer2.address, i);
    }
  });
});
