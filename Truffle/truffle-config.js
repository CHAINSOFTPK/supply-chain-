const path = require("path");
require("dotenv").config({ path: "../.env" });
const HDWalletProvider = require("@truffle/hdwallet-provider");

module.exports = {
  contracts_build_directory: "../src/contracts",
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545,
      network_id: "*",
      deploymentPollingInterval: 10,
    },
    sepolia: {
      provider: () => new HDWalletProvider({
        privateKeys: [process.env.PRIVATE_KEY],
        providerOrUrl: process.env.INFURA_SEPOLIA_URL.replace('https', 'wss'),
      }),
      network_id: 11155111,
      gas: 5000000,
      gasPrice: 20000000000, // 20 gwei
      confirmations: 3,
      timeoutBlocks: 500,
      skipDryRun: true,
      networkCheckTimeout: 10000000,
      deploymentPollingInterval: 15000,
      websockets: true,
      pollingInterval: 15000
    },
    mumbai: {
      provider: () => new HDWalletProvider({
        privateKeys: [process.env.PRIVATE_KEY],
        providerOrUrl: process.env.INFURA_MUMBAI_URL,
      }),
      network_id: 80001,
      deploymentPollingInterval: 10,
    },
  },
  compilers: {
    solc: {
      version: "0.8.1",
    },
  },
  //
  // Truffle DB is currently disabled by default; to enable it, change enabled:
  // false to enabled: true. The default storage location can also be
  // overridden by specifying the adapter settings, as shown in the commented code below.
  //
  // NOTE: It is not possible to migrate your contracts to truffle DB and you should
  // make a backup of your artifacts to a safe location before enabling this feature.
  //
  // After you backed up your artifacts you can utilize db by running migrate as follows:
  // $ truffle migrate --reset --compile-all
  //
  // db: {
  //   enabled: true,
  //   host: "127.0.0.1",
  //   adapter: {
  //     name: "sqlite",
  //     settings: {
  //       directory: ".db",
  //     },
  //   },
  // },
};
