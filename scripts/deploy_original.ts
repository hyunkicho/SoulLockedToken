import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", await deployer.getAddress());

    // Deploy P256Verifier
    const P256VerifierFactory = await ethers.getContractFactory("P256Verifier");
    const p256Verifier = await P256VerifierFactory.deploy();
    console.log("P256Verifier deployed to:", await p256Verifier.getAddress());

    // Deploy Utils
    const UtilsFactory = await ethers.getContractFactory("Utils");
    const utils = await UtilsFactory.deploy();
    console.log("Utils deployed to:", await utils.getAddress());

    // Deploy SoulLockedToken (original)
    const SLTFactory = await ethers.getContractFactory("SoulLockedToken");
    const slt = await SLTFactory.deploy("SoulLockedToken", "SLT", true);
    console.log("SoulLockedToken deployed to:", await slt.getAddress());

    // Check owner
    const owner = await slt.owner();
    console.log("Contract owner:", owner);
    console.log("Is deployer the owner?", owner === await deployer.getAddress());
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
