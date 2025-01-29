const HDWalletProvider = require("@truffle/hdwallet-provider");
require("dotenv").config({ path: "../.env" });

module.exports = {
  contracts_build_directory: "../src/contracts",
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      networkCheckTimeout: 10000,
    },
    sepolia: {
      provider: () => new HDWalletProvider({
        privateKeys: [process.env.PRIVATE_KEY],
        providerOrUrl: process.env.INFURA_SEPOLIA_URL,
        pollingInterval: 8000
      }),
      network_id: 11155111,
      gasPrice: 30000000000, // 30 gwei
      networkCheckTimeout: 100000,
      timeoutBlocks: 200,
      confirmations: 2,
      skipDryRun: true
    },
    ropsten: {
      provider: () => new HDWalletProvider(mnemonic, `https://ropsten.infura.io/v3/${infuraProjectId}`),
      network_id: 3,       // Ropsten's id
      gas: 5500000,        // Ropsten has a lower block limit than mainnet
      confirmations: 2,    // # of confs to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    },
  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.1"
    }
  }
};
