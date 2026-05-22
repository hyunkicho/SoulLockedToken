import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";

dotenv.config(); // 🔑 .env 로드

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "http://127.0.0.1:8545";
const BASE_SEPOLIA_RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.7.6",
        settings: { optimizer: { enabled: true, runs: 999999 } },
      },
      {
        version: "0.8.19",
        settings: { optimizer: { enabled: true, runs: 999999 } },
      },
      {
        version: "0.8.12",
        settings: { optimizer: { enabled: true, runs: 999999 } },
      },
      {
        version: "0.8.24",
        settings: { optimizer: { enabled: true, runs: 999999 } },
      },
      {
        version: "0.8.21",
        settings: { optimizer: { enabled: true, runs: 999999 }, viaIR: true },
      },
    ],
  },
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      blockGasLimit: 100_000_000_000
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: [PRIVATE_KEY],
    },
    local: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
    sepolia: {
      url: SEPOLIA_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
    baseSepolia: {
      url: BASE_SEPOLIA_RPC_URL,
      chainId: 84532,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;
