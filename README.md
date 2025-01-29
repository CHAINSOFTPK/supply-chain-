# Daliah - Supply Chain Traceability Using Blockchain Technology

Food is necessary for human survival. As a result, guaranteeing its safety as it passes through food supply chains from farmer to consumer is critical. This can be accomplished by utilizing a food traceability system, which allows for the tracking and tracing of produce across the food supply chain. Due to its capacity to securely store data in a decentralized and tamper-evident manner, blockchain technology has recently shown significant promise in enhancing traceability in food supply chains.

## Installation

```bash
git clone lalghoul/supplychain-blockchain
```

## Usage

- Install NodeJS and it additional tools.
- Make sure you install [Ganache](https://next-stack.github.io/ganache/) and configure the network.

```bash
# install node packges
npm install
# test the contracts
truffle test
# compile and migrate to your local Blockchain copy (Ganache)
truffle migrate
# running the client
cd client && npm run start
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)
