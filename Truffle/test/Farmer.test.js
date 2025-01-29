const Farmer = artifacts.require("Farmer");

const chai = require("./chaiSetup.js");
const BN = web3.utils.BN;
const expect = chai.expect;

contract("Farmer Contract Testing", async (accounts) => {
  const [farmer, distributor, AnotherAccount] = accounts;

  beforeEach(async () => {
    this.farmer = await Farmer.new();
  });

  it("Farmer should be able to register an account", async () => {
    let instance = this.farmer;

    let farmerName = "Moe Ali";
    let farmerAddress = "Wadi Alsair, Main St. Amman, Jordan";
    let farmerEthAddress = farmer;

    await instance.register(farmerName, farmerAddress, { from: farmer });

    let farmerProfile = await instance.farmerProfiles(farmer);

    expect(farmerProfile[0]).to.have.string(farmerName);
    expect(farmerProfile[1]).to.have.string(farmerAddress);
    expect(farmerProfile[2]).to.have.string(farmerEthAddress);
  });

  it("Farmer is able to add a new Catalogue", async () => {
    let instance = this.farmer;

    let productName = "Apples";
    let monthlyVolume = "500";
    let photoHash = "QmXL5oinE1Ln4jFmt71HNKeGKszsTXueuntvnafBwnPfP5";

    let farmerName = "Moe Ali";
    let farmerAddress = "Wadi Alsair, Main St. Amman, Jordan";

    await instance.register(farmerName, farmerAddress, { from: farmer });

    await instance.registerCatalogue(productName, monthlyVolume, photoHash, {
      from: farmer,
    });

    let getCatalogueItemsResults = await instance.getCatalogueItems(farmer);

    expect(getCatalogueItemsResults[0][0]).to.have.string(productName);
    expect(getCatalogueItemsResults[0][1]).to.have.string(monthlyVolume);
    expect(getCatalogueItemsResults[0][2]).to.have.string(photoHash);
  });

  it("Farmer is able to add new harvest to the marketplace", async () => {
    let instance = this.farmer;

    // Step 1 Register a Profile
    let farmerName = "Moe Ali";
    let farmerAddress = "Wadi Alsair, Main St. Amman, Jordan";
    await instance.register(farmerName, farmerAddress, { from: farmer });
    // Step 2 Adding Catalogue so he can choose it while adding the harvest
    let productName = "Apples";
    let monthlyVolume = "500";
    let photoHash = "QmXL5oinE1Ln4jFmt71HNKeGKszsTXueuntvnafBwnPfP5";
    await instance.registerCatalogue(productName, monthlyVolume, photoHash, {
      from: farmer,
    });
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

    expect(
      instance.registerHarvest(
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
      ),
    ).to.eventually.be.fulfilled;
  });

  it("Farmer is able to add used chimecals to his harvest data", async () => {
    let instance = this.farmer;

    // Step 1 Register a Profile
    let farmerName = "Moe Ali";
    let farmerAddress = "Wadi Alsair, Main St. Amman, Jordan";
    await instance.register(farmerName, farmerAddress, { from: farmer });
    // Step 2 Adding Catalogue so he can choose it while adding the harvest
    let productName = "Apples";
    let monthlyVolume = "500";
    let photoHash = "QmXL5oinE1Ln4jFmt71HNKeGKszsTXueuntvnafBwnPfP5";
    await instance.registerCatalogue(productName, monthlyVolume, photoHash, {
      from: farmer,
    });
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

    await instance.registerHarvest(
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

    // Step 4 Adding Used chemicals  to exisitng harvest

    let chemicalName = "solvents";
    let chemicalDate = +new Date();

    await instance.addUsedChimecals(0, chemicalName, chemicalDate, {
      from: farmer,
    });

    let getChemicalDataResults = await instance.getChemicalData(0);

    expect(getChemicalDataResults[0][0]).to.have.string(chemicalName);
    expect(getChemicalDataResults[0][1]).to.have.string(chemicalDate);
  });
});
