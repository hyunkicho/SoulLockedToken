import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { AccountFactory, EntryPoint, NFT, SBT } from "../typechain-types";
import { EntryPoint__factory, UserOperationStruct } from "@account-abstraction/contracts";
import { AddressLike } from "ethers";

describe("Basic AA wallet", function () {
  async function deployAccountAbstractionFixture() {
    const name = "Sample SBT";
    const symbol = "SSBT";

    const name_nft = "Sample NFT";
    const symbol_nft = "NFT";

    // Contracts are deployed using the first signer/account by default
    const [owner, aaWalletSeller, aaWalletBuyer] = await ethers.getSigners();
    const EntryPointFactory = await ethers.getContractFactory("EntryPoint");
    const entryPointFactory = await EntryPointFactory.deploy() as EntryPoint;
    const entryPointAddress = await entryPointFactory.getAddress();
    console.log("entryPointAddress >>", entryPointAddress);
    const AA_accountFactory = await ethers.getContractFactory("AccountTradableFactory");
    const aa_accountFactory = await AA_accountFactory.deploy(entryPointAddress) as AccountTradableFactory;
    const SBT_Factory = await ethers.getContractFactory("SBT");
    const sbt_Factory = await SBT_Factory.deploy(name, symbol, true) as SBT;
    const sbtAddress = await sbt_Factory.getAddress();
    return { aa_accountFactory, entryPointAddress, entryPointFactory, sbt_Factory, sbtAddress, owner, aaWalletSeller, aaWalletBuyer };
  }

  describe("testing mint NFT to ERC4337", async function () {
    it("Should make AA wallet correctly", async function () {
      const { aa_accountFactory, entryPointAddress, entryPointFactory, sbt_Factory, sbtAddress, owner, aaWalletBuyer, aaWalletSeller } = await loadFixture(
        deployAccountAbstractionFixture
      );
      for(let i=0; i< 100; i++) {
        const sbt_owner_salt = i; //example salt
        const createAccountTx = await aa_accountFactory.connect(aaWalletSeller).createAccount(aaWalletSeller.address, sbt_owner_salt);
        await createAccountTx.wait();
        console.log("aa account Factory address : ", await aa_accountFactory.getAddress());
        const newAaAccount = await aa_accountFactory.getAddress2(aaWalletSeller.address, sbt_owner_salt);
        console.log("📮aa account address is : ", newAaAccount);
        console.log("✅aa_accountContract : ", newAaAccount);
        const aa_accountContract = await ethers.getContractAt("Account", newAaAccount);
        console.log("✅newAaAccount owner : ", await aa_accountContract.owner());
        console.log("✅owner EOA Address: ", await aaWalletSeller.address);
  
        const addDepositTx = await aa_accountContract.addDeposit({value: ethers.parseEther("1")});
        await addDepositTx.wait();
        const deposit = await aa_accountContract.getDeposit();
        console.log("deposit :", deposit);
        
        const safeMintTx = await sbt_Factory.safeMint(newAaAccount,i);
        await safeMintTx.wait();
        console.log("✅ SBT is minted to AA account");
        
        const AccountTradable_Factory = await ethers.getContractAt("AccountTradable", newAaAccount);
  
        const setPriceTx = await AccountTradable_Factory.connect(aaWalletSeller).setPrice(ethers.parseEther("1"));
        await setPriceTx.wait();
        console.log("✅ Price of AA wallet including SBT is setted");
        const price = await AccountTradable_Factory.getPrice();
        console.log("price : ", price);
        
        expect(await AccountTradable_Factory.owner()).equal(aaWalletSeller.address);
        const buyOwnerTx = await AccountTradable_Factory.connect(aaWalletBuyer).buyOwner(aaWalletBuyer,{value: ethers.parseEther("1")});
        await buyOwnerTx.wait();
        console.log("owner : ", await AccountTradable_Factory.owner());
  
        expect(await AccountTradable_Factory.owner()).equal(aaWalletBuyer.address);
        console.log("✅ Buyowner function was executed by aaWalletBuyer and owner has changed. Transaction is executed by signature of owner");
      }
    });
  });
});
