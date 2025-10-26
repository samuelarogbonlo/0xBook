// Hardhat 3 ESM configuration
// Note: Built with Hardhat 3.0.9 for the Hardhat 3 Bounty

import hardhatToolbox from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";

export default {
  plugins: [hardhatToolbox, hardhatEthers],
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  mocha: {
    timeout: 180000 // 3 minutes for Arcology tests
  },
  networks: {
    hardhat: {
      type: "edr-simulated",
      chainId: 1337
    },
    arcology: {
      type: "http",
      url: "https://testnet.arcology.network/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 118
    },
    local: {
      type: "http",
      url: "http://localhost:8545",
      chainId: 118,  // Arcology DevNet
      gas: 30000000000,
      gasPrice: 1000000000,
      allowUnlimitedContractSize: true
    }
  }
};
