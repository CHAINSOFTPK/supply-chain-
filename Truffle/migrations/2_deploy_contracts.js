var DaliahMarketplace = artifacts.require("./DaliahMarketplace.sol");
var Farmer = artifacts.require("./Farmer.sol");
var Dist = artifacts.require("./Distributor.sol");
var Token = artifacts.require("./JordanainDinarToken.sol.sol");
var Escrow = artifacts.require("./Escrow.sol");

module.exports = async function (deployer) {
  await deployer.deploy(Farmer);
  const farmerInstance = await Farmer.deployed();

  await deployer.deploy(Dist);
  const distInastance = await Dist.deployed();

  await deployer.deploy(Token);
  const tokenInastance = await Token.deployed();

  await tokenInastance.mint(
    "0xB6C8325bD553893E4B3dF330BC520Fe619B1a929",
    web3.utils.toWei("5000", "ether"),
  );

  await deployer.deploy(
    Escrow,
    tokenInastance.address,
    web3.utils.toWei("25", "ether"),
  );
  const escrowInastance = await Escrow.deployed();

  await deployer.deploy(
    DaliahMarketplace,
    farmerInstance.address,
    distInastance.address,
    escrowInastance.address,
  );
};
