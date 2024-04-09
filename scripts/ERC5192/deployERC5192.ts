import { ethers } from "hardhat";

async function main() {
  const name = "SBT5192";
  const symbol = "SBT";
  const SBT5192 = await ethers.deployContract("SBT5192", [name, symbol, true]);

  await SBT5192.waitForDeployment();

  console.log(`token name is ${name}, symbol is ${symbol}  ${SBT5192.target}`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
