const DaliahMarketplace = artifacts.require("DaliahMarketplace");
const Distributor = artifacts.require("Distributor");
const Farmer = artifacts.require("Farmer");
const Token = artifacts.require("JordanainDinarToken");
const Escrow = artifacts.require("Escrow");

const chai = require("./chaiSetup.js");
const BN = web3.utils.BN;
const expect = chai.expect;

contract("Marketplace Contract Testing", async (accounts) => {
  const [farmer, distAddress, AnotherAccount] = accounts;

  beforeEach(async () => {
    this.farmer = await Farmer.new();
    this.distributor = await Distributor.new();
    this.token = await Token.new();
    this.escrow = await Escrow.new(
      Token.address,
      web3.utils.toWei("25", "ether"),
    );
    this.marketplace = await DaliahMarketplace.new(
      this.farmer.address,
      this.distributor.address,
      this.escrow.address,
    );

    let farmerInstance = this.farmer;
    let disInstance = this.distributor;
    let tokenInstance = this.token;

    // Step 1 Register a Profile
    let farmerName = "Moe Ali";
    let farmerAddress = "Wadi Alsair, Main St. Amman, Jordan";
    await farmerInstance.register(farmerName, farmerAddress, { from: farmer });

    //Step 2 Adding Catalogue so he can choose it while adding the harvest
    let productName = "Apples";
    let monthlyVolume = "500";
    let photoHash = "QmXL5oinE1Ln4jFmt71HNKeGKszsTXueuntvnafBwnPfP5";
    await farmerInstance.registerCatalogue(
      productName,
      monthlyVolume,
      photoHash,
      {
        from: farmer,
      },
    );
    // Step 3 Adding the harvest
    let _photoHash = "QmXL5oinE1Ln4jFmt71HNKeGKszsTXueuntvnafBwnPfP5";
    let _harvestCaptureDate = +new Date();
    let _catalogueProductID = 0;
    let _PHLevel = 10;
    let _ECLevel = 20;
    let _waterLevel = 30;
    let _quantity = 800;
    let _minOrderQty = 10;
    let _pricePerKG = 5;
    let _expiryDate = +new Date();

    farmerInstance.registerHarvest(
      _photoHash,
      _harvestCaptureDate,
      _catalogueProductID,
      _PHLevel,
      _ECLevel,
      _waterLevel,
      _quantity,
      _minOrderQty,
      _pricePerKG,
      _expiryDate,
      { from: farmer },
    );

    // Step 4 dist need to register an account

    let distName = "Daliah Attari";
    let distphysicalAddress = "Wadi Alsair, Main St. Amman, Jordan";

    await disInstance.register(distName, distphysicalAddress, {
      from: distAddress,
    });

    //Minting some cash to the distAddress so he can play an order
    await tokenInstance.mint(distAddress, web3.utils.toWei("10000", "ether"), {
      from: farmer,
    });
  });

  it("Distributor should be able to place an order", async () => {
    let marketplaceInstance = this.marketplace;
    let EscrowInstance = this.escrow;

    let tokenInstance = this.token;

    // Step 5 dist place an order

    let _productID = 0;
    let _qty = 50;
    let _farmerAddress = farmer;

    // Step 6 funding escrow contract

    let totalAmount = web3.utils.toWei("30", "ether");
    console.log("totalAmount:" + totalAmount);

    // Approving Escrow contract to be able to spend tokens
    await tokenInstance.approve(EscrowInstance.address, totalAmount);

    //expect(marketplaceInstance.placeOrder(_productID,_qty,_farmerAddress, {from: distAddress})).to.eventually.be.fulfilled;

    await marketplaceInstance.placeOrder(_productID, _qty, farmer, {
      from: distAddress,
    });

    let _orderID = 0;
    let status = 1; // Accepted
    let reason = "Accepted";

    await marketplaceInstance.changeOrderStatus(_orderID, status, reason, {
      from: farmer,
    });

    let orderStatus = await marketplaceInstance.ordersMapping(_orderID);

    console.log("orderStatus" + JSON.stringify(orderStatus));
  });

  //   it("Farmer should be able to accept incoming orders", async () => {

  //     // let marketplaceInstance = this.marketplace;
  //     // let EscrowInstance = this.escrow;
  //     // let tokenInstance = this.token;

  //     // // Step 5 dist place an order

  //     // let _productID = 0;
  //     // let  _qty = 50;
  //     // let _farmerAddress = farmer;

  //     //     // Approving Escrow contract to be able to spend tokens
  //     //     await tokenInstance.approve(EscrowInstance.address,web3.utils.toWei("500", "ether"))

  //     //  await marketplaceInstance.placeOrder(_productID,_qty,_farmerAddress, {from: distAddress});

  //     //  // Step 6 Farmer accepting or rejcteting incoming orders

  //     //  let _orderID = 0;
  //     //  let status = 1 // Accepted
  //     //  let reason = "Accepted"

  //     // expect(marketplaceInstance.changeOrderStatus(_orderID,status,reason, {from: farmer})).to.eventually.be.fulfilled;

  //   });
});
