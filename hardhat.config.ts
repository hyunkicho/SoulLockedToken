import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "hardhat-gas-reporter";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      { 
        version: "0.8.19",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000 
          }
        }
      },
      {
        version: "0.8.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000 
          }
        }
      },
      { 
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000 
          }
        }
      }
    ]
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: {
      // allowUnlimitedContractSize: true,
      forking: {
        enabled: true,
        url: "https://rpc.ankr.com/eth",
      },
    }
  },
};

export default config;
