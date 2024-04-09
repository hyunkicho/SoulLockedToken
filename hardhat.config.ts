import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { version: "0.8.19" },
      { version: "0.8.12" },
      { version: "0.8.24" }
    ],
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      }
    },
  }
};

export default config;
