const MyToken = artifacts.require("JordanainDinarToken");

const chai = require("./chaiSetup.js");
const BN = web3.utils.BN;
const expect = chai.expect;

contract("JODT Token Testing", async (accounts) => {
  const [deployerAccount, receiver, AnotherAccount] = accounts;

  beforeEach(async () => {
    this.token = await MyToken.new();
  });

  it("1000 JODT should be in my account (deployer)", async () => {
    let instance = this.token;

    expect(
      instance.balanceOf(deployerAccount),
    ).to.eventually.be.a.bignumber.equal(web3.utils.toWei("1000", "ether"));
  });

  it("We should be able to send Tokens between accounts", async () => {
    const TokenAmount = 1;
    let instance = this.token;

    await instance.transfer(receiver, TokenAmount);

    expect(instance.balanceOf(receiver)).to.eventually.be.a.bignumber.equal(
      new BN(TokenAmount),
    );
  });

  it("Deployer(Owner) Should be able to mint JODT", async () => {
    const TokenAmount = web3.utils.toWei("100", "ether");
    let instance = this.token;

    await instance.mint(receiver, TokenAmount);

    expect(instance.balanceOf(receiver)).to.eventually.be.a.bignumber.equal(
      new BN(TokenAmount),
    );
  });

  it("It's not possible to send JODT more than you have", async () => {
    const TokenAmount = 4000;
    let instance = this.token;

    expect(instance.transfer(receiver, TokenAmount)).to.eventually.be.rejected;
  });
});
