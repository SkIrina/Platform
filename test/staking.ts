import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  Token,
  Token__factory,
  XXXToken__factory,
  XXXToken,
  Staking,
  Staking__factory,
} from "../typechain";
import { BigNumber } from "ethers";

describe("My awesome staking contract (no check for unstake and onlyDao function, because dao needed)", function () {
  let StakingToken: Token__factory;
  let stakingToken: Token;
  let RewardToken: XXXToken__factory;
  let rewardToken: XXXToken;
  let StakingContract: Staking__factory;
  let stakingContract: Staking;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const lockedTime = 86400;
  const rewardTime = 604800;

  beforeEach(async function () {
    StakingToken = await ethers.getContractFactory("Token");
    stakingToken = await StakingToken.deploy("ERC20 token", "STK");
    RewardToken = await ethers.getContractFactory("XXXToken");
    rewardToken = await RewardToken.deploy();

    StakingContract = await ethers.getContractFactory("Staking");
    stakingContract = await StakingContract.deploy(
      stakingToken.address,
      rewardToken.address
    );

    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();
    await rewardToken.transfer(
      stakingContract.address,
      ethers.utils.parseEther("100")
    );
  });

  describe("Stake", function () {
    it("Should emit transfer event on stakingToken contract and change balance", async function () {
      // owner approves spending by the contract
      await stakingToken.approve(
        stakingContract.address,
        ethers.utils.parseEther("100")
      );

      const promise = await stakingContract.stake(10);
      // owner stakes 10 STK
      expect(promise)
        .to.emit(stakingToken, "Transfer")
        .withArgs(owner.address, stakingContract.address, 10);

      expect(promise).to.changeEtherBalance(owner, 10);
    });
  });

  describe("Unstake", function () {
    it("Should not let unstake tokens if less than lockedTime passed", async function () {
      // owner approves spending by the contract
      await stakingToken.approve(
        stakingContract.address,
        ethers.utils.parseEther("100")
      );

      const stake = await stakingContract.stake(10);
      // owner stakes 10 STK
      expect(stake)
        .to.emit(stakingToken, "Transfer")
        .withArgs(owner.address, stakingContract.address, 10);

      expect(stake).to.changeEtherBalance(owner, 10);

      // act: unstake
      await expect(stakingContract.unstake()).to.be.revertedWith(
        "Staking time not finished yet"
      );
    });
  });

  describe("Claim reward", function () {
    beforeEach(async function () {
      // owner approves spending by the contract
      await stakingToken.approve(
        stakingContract.address,
        ethers.utils.parseEther("100")
      );
      // owner stakes 10 tokens
      await stakingContract.stake(100);
    });

    it("Should not give reward if less than rewardTime passed", async function () {
      // emulate time passed, rewardTime = 600
      await ethers.provider.send("evm_increaseTime", [rewardTime - 50]);
      await ethers.provider.send("evm_mine", []);

      // act: claim
      await expect(stakingContract.claim()).to.be.revertedWith(
        "Nothing to claim"
      );
    });

    it("Should give reward if more than rewardTime passed", async function () {
      // emulate time passed, rewardTime = 60
      await ethers.provider.send("evm_increaseTime", [rewardTime + 50]);
      await ethers.provider.send("evm_mine", []);

      // act: claim 1x reward
      const claim = await stakingContract.claim();
      expect(claim)
        .to.emit(rewardToken, "Transfer")
        .withArgs(stakingContract.address, owner.address, 2);

      expect(claim).to.changeTokenBalance(rewardToken, owner, 2);
    });

    it("Should give reward depending on time passed", async function () {
      // emulate time passed, rewardTime = 600
      await ethers.provider.send("evm_increaseTime", [rewardTime * 2 + 50]);
      await ethers.provider.send("evm_mine", []);

      // act: claim 3x reward
      const claim = await stakingContract.claim();
      expect(claim)
        .to.emit(rewardToken, "Transfer")
        .withArgs(stakingContract.address, owner.address, 6);

      expect(claim).to.changeTokenBalance(rewardToken, owner, 6);
    });

    it("Should set correct reward if address stakes multiple times", async function () {
      // give addr1 10 staking tokens
      await stakingToken.transfer(addr1.address, 100);
      // addr1 approves spending by the contract
      await stakingToken
        .connect(addr1)
        .approve(stakingContract.address, ethers.utils.parseEther("100"));

      await stakingContract.connect(addr1).stake(10);

      // emulate time passed. reward 10 token * 0.03 rate * 10*rewtime = 3
      await ethers.provider.send("evm_increaseTime", [rewardTime * 10 + 50]);
      await ethers.provider.send("evm_mine", []);

      await stakingContract.connect(addr1).stake(10);

      // emulate time passed reward 20 token * 0.03 rate * 10*rewtime = 6
      await ethers.provider.send("evm_increaseTime", [rewardTime * 10 + 50]);
      await ethers.provider.send("evm_mine", []);

      // act: claim 3x reward
      const claim = await stakingContract.connect(addr1).claim();
      // expect(await stakingContract.rewards(addr1.address)).to.equal(6);
      expect(claim)
        .to.emit(rewardToken, "Transfer")
        .withArgs(stakingContract.address, addr1.address, 9);

      expect(claim).to.changeTokenBalance(rewardToken, addr1, 9);
    });
  });

  describe("Reward rate", function () {
    it("Should not let non-dao to set reward rate", async function () {
      await expect(
        stakingContract.connect(addr1).setRate(10)
      ).to.be.revertedWith("Not authorised");
    });
  });

  describe("Locked time", function () {
    it("Should not let non-dao to set locked time", async function () {
      await expect(
        stakingContract.connect(addr1).setLockedTime(200)
      ).to.be.revertedWith("Not authorised");
    });
  });
});
