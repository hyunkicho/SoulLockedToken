import { ethers } from "hardhat";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer address:", await deployer.getAddress());
    
    const contractAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
    const SLTFactory = await ethers.getContractFactory("SoulLockedTokenNew");
    const sltContract = SLTFactory.attach(contractAddress);
    
    const owner = await sltContract.owner();
    console.log("Contract owner:", owner);
    console.log("Is deployer the owner?", owner === await deployer.getAddress());
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
