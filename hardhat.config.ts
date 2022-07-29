import * as dotenv from "dotenv";

import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import 'hardhat-contract-sizer'
import './tasks'
import '@openzeppelin/hardhat-upgrades';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.11",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      // forking: {
      //   enabled: process.env.FORKING_ENABLED == "true",
      //   url: process.env.MAINNET_FORKING_URL as string,
      //   blockNumber: 14785940
      // }
    },
    mainnet: {
      url: process.env.MAINNET_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    rinkeby: {
      url: process.env.RINKEBY_URL,
      gasPrice: 25000000000,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    goerli: {
      url: process.env.GOERLI_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    polygon: {
      url: process.env.POLYGON_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    mumbai: {
      url: process.env.MUMBAI_URL,
      gasPrice: "auto",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    }
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS == "true",
    currency: "USD",
  },
  // etherscan: {
  //   apiKey: process.env.ETHERSCAN_API_KEY,
  // },
  etherscan: {
    apiKey: process.env.POLYGONSCAN_API_KEY,
  },

  mocha: {
    timeout: 3600000,
  },
  contractSizer: {
    alphaSort: false,
    disambiguatePaths: false,
    runOnCompile: process.env.CONTRACT_SIZER == "true",
    strict: false,
  }
};

export default config;
