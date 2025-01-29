const Distributor = artifacts.require("Distributor");

const chai = require("./chaiSetup.js");
const BN = web3.utils.BN;
const expect = chai.expect;

contract("Distributor Contract Testing", async (accounts) => {
  const [farmer, distAddress, AnotherAccount] = accounts;

  beforeEach(async () => {
    this.distributor = await Distributor.new();
  });

  it("Distributor should be able to register an account", async () => {
    let instance = this.distributor;

    let distName = "Daliah Attari";
    let distphysicalAddress = "Wadi Alsair, Main St. Amman, Jordan";

    await instance.register(distName, distphysicalAddress, {
      from: distAddress,
    });

    let distProfile = await instance.distProfiles(distAddress);

    expect(distProfile[0]).to.have.string(distName);
    expect(distProfile[1]).to.have.string(distphysicalAddress);
    expect(distProfile[2]).to.have.string(distAddress);
  });
});
