import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import {
  ERC20,
  ERC20__factory,
  XXXToken__factory,
  XXXToken,
  Staking,
  Staking__factory,
  Dao__factory,
  Dao,
  ACDMToken,
  ACDMToken__factory,
  ACDMPlatform__factory,
  ACDMPlatform,
} from "../typechain";

describe("My awesome ACDMPlatform contract", function () {
  // const tokenAddr = '0xAC2384A436f1Ff3CB0E5F3104dC229754199bbbd';
  let StakingToken: ERC20__factory;
  let stakingToken: ERC20;
  let RewardToken: XXXToken__factory;
  let rewardToken: XXXToken;
  let xxxToken: XXXToken;

  let Staking: Staking__factory;
  let staking: Staking;

  let Token: ACDMToken__factory;
  let token: ACDMToken;
  let ACDMPlatform: ACDMPlatform__factory;
  let aCDMPlatform: ACDMPlatform;
  let Dao: Dao__factory;
  let dao: Dao;

  let owner: SignerWithAddress;
  let chair: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;

  let addrs: SignerWithAddress[];

  const jsonAbi = [
    {
      inputs: [
        {
          internalType: "uint8",
          name: "_rate",
          type: "uint8",
        },
      ],
      name: "setFirstReferrerRate",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  const iface = new ethers.utils.Interface(jsonAbi);
  const newValue = 6;
  const calldata = iface.encodeFunctionData("setFirstReferrerRate", [newValue]);
  let recipient: string;
  const roundTime = 86400 * 3;

  beforeEach(async function () {
    [owner, addr1, addr2, addr3, ...addrs] = await ethers.getSigners();

    StakingToken = await ethers.getContractFactory("Token");
    stakingToken = await StakingToken.deploy("ERC20 token", "STK");
    RewardToken = await ethers.getContractFactory("XXXToken");
    rewardToken = await RewardToken.deploy();
    xxxToken = await ethers.getContractAt(
      "XXXToken",
      "0x079C42C7733caddf1913FA326819915945Bc0f94"
    );

    Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(stakingToken.address, rewardToken.address);
    await rewardToken.transfer(staking.address, ethers.utils.parseEther("100"));

    Token = await ethers.getContractFactory("ACDMToken");
    token = await Token.deploy();
    await token.deployed();

    ACDMPlatform = await ethers.getContractFactory("ACDMPlatform");
    aCDMPlatform = await ACDMPlatform.deploy(token.address, roundTime);
    await aCDMPlatform.deployed();

    token.transfer(aCDMPlatform.address, 100000 * 10 ** 6);
    token.setPlatform(aCDMPlatform.address);

    const minQuorum = 3;
    const debatePeriod = 600;
    Dao = await ethers.getContractFactory("Dao");
    dao = await Dao.deploy(addr1.address, minQuorum, debatePeriod);
    await dao.deployed();

    await dao.connect(addr1).setStaking(staking.address);
    await aCDMPlatform.setDao(dao.address);
    recipient = aCDMPlatform.address;
  });

  describe("constructor", function () {
    it("Should set correct properties", async function () {
      expect(await aCDMPlatform.roundTime()).to.equal(roundTime);
      expect(await aCDMPlatform.isSaleRound()).to.equal(true);
      expect(await aCDMPlatform.referrers(owner.address)).to.equal(
        owner.address
      );
      expect(await token.balanceOf(aCDMPlatform.address)).to.equal(
        100000 * 10 ** 6
      );
    });
  });

  describe("setFirstReferrerRate", function () {
    it("Should let dao change referrer rate, not others", async function () {
      // emulate dao voting:

      await dao
        .connect(addr1)
        .addProposal(calldata, recipient, "Lets increase the referrer rate!");
      //  Deposit:
      await stakingToken.transfer(addr2.address, 50);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(addr2)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(addr2).stake(50);
      await dao.connect(addr2).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.finishProposal(1))
        .to.emit(dao, "ProposalFinished")
        .withArgs(1, true, 50, "Quorum voted pro and call data executed");

      expect(await aCDMPlatform.firstReferrerRate()).to.equal(6);

      await expect(
        aCDMPlatform.connect(addr2).setFirstReferrerRate(6)
      ).to.be.revertedWith("Not authorised");
    });
  });

  describe("buyACDM", function () {
    it("Should let users buy ACDMToken during sale round", async function () {
      await expect(
        aCDMPlatform.connect(addr1).buyACDM(10 * 10 ** 6, { value: 10 ** 14 })
      )
        .to.emit(token, "Transfer")
        .withArgs(aCDMPlatform.address, addr1.address, 10 * 10 ** 6);
      expect(await token.balanceOf(addr1.address)).to.equal(10 * 10 ** 6);
    });

    it("Should not let buy if it is not sale round", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      console.log(await token.balanceOf(aCDMPlatform.address));
      await aCDMPlatform.startTradeRound();
      await expect(
        aCDMPlatform.connect(addr1).buyACDM(10 * 10 ** 6, { value: 10 ** 14 })
      ).to.be.revertedWith("Not the sale round now");
    });

    it("Should not let buy more than there is for sale", async function () {
      await expect(
        aCDMPlatform
          .connect(addr1)
          .buyACDM(100000 * 10 ** 7, { value: ethers.utils.parseEther("10") })
      ).to.be.revertedWith("Not enough tokens for sale");
    });

    it("Should not let buy if wrong amount specified", async function () {
      await expect(
        aCDMPlatform.connect(addr1).buyACDM(20 * 10 ** 6, { value: 10 ** 14 })
      ).to.be.revertedWith("Wrong amount of ether sent");
    });

    it("Should send interest rate to referrers", async function () {
      await aCDMPlatform.connect(addr1).register(owner.address);
      await aCDMPlatform.connect(addr2).register(addr1.address);

      console.log(await addr1.getBalance());

      await expect(
        await aCDMPlatform
          .connect(addr2)
          .buyACDM(10000 * 10 ** 6, { value: ethers.utils.parseEther("0.1") })
      ).to.changeEtherBalances([addr1, owner], [5 * 10 ** 15, 3 * 10 ** 15]);
      console.log(await addr1.getBalance());
    });
  });

  describe("register", function () {
    it("Should let register", async function () {
      await expect(aCDMPlatform.connect(addr1).register(owner.address)).to.not
        .be.reverted;
    });
    it("Should not let register if referrer is not a member", async function () {
      await expect(
        aCDMPlatform.connect(addr1).register(addr2.address)
      ).to.be.revertedWith("Your referrer is not registered");
    });

    it("Should not let register twice", async function () {
      await aCDMPlatform.connect(addr1).register(owner.address);
      await expect(
        aCDMPlatform.connect(addr1).register(owner.address)
      ).to.be.revertedWith("You have already registered");
    });
  });

  describe("startTradeRound", function () {
    it("Should not let start trade round before roundTime is over and tokens not sold", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime - 1000]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });
      await expect(aCDMPlatform.startTradeRound()).to.be.revertedWith(
        "Sale round not finished yet"
      );
    });

    it("Should let start trade round before roundTime is over when tokens are sold", async function () {
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(100000 * 10 ** 6, { value: ethers.utils.parseEther("1") });
      await expect(aCDMPlatform.startTradeRound()).to.not.be.reverted;
    });

    it("Should let start trade round when roundTime is over and tokens not sold", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime + 1000]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });
      await expect(aCDMPlatform.startTradeRound()).to.not.be.reverted;
    });

    it("Should set correct values when start the round, emit Transfer", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime + 1000]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });

      await expect(aCDMPlatform.startTradeRound())
        .to.emit(token, "Transfer")
        .withArgs(
          aCDMPlatform.address,
          ethers.constants.AddressZero,
          99990000000
        );
      expect(await aCDMPlatform.tradedValue()).to.equal(0);
      expect(await aCDMPlatform.isSaleRound()).to.equal(false);
    });
  });

  describe("startSaleRound", function () {
    it("Should not let start sale round before roundTime is over", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startTradeRound();
      await ethers.provider.send("evm_increaseTime", [roundTime - 1000]);
      await ethers.provider.send("evm_mine", []);
      await expect(aCDMPlatform.startSaleRound()).to.be.revertedWith(
        "Trade round not finished yet"
      );
    });

    it("Should let start trade round when roundTime is over", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startTradeRound();
      await ethers.provider.send("evm_increaseTime", [roundTime + 1000]);
      await ethers.provider.send("evm_mine", []);
      await expect(aCDMPlatform.startSaleRound()).to.not.be.reverted;
    });

    it("Should set correct values when start the round, emit Transfer", async function () {
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);

      await aCDMPlatform.startTradeRound();
      // emulate trade
      await token.connect(addr1).approve(aCDMPlatform.address, 10 * 10 ** 6);
      await aCDMPlatform.connect(addr1).addOrder(10 * 10 ** 6, 10 ** 13);
      await aCDMPlatform.connect(addr2).redeemOrder(1, 5 * 10 ** 6, {
        value: ethers.utils.parseEther("0.00005"),
      });

      await ethers.provider.send("evm_increaseTime", [roundTime + 1000]);
      await ethers.provider.send("evm_mine", []);

      await expect(aCDMPlatform.startSaleRound())
        .to.emit(token, "Transfer")
        .withArgs(ethers.constants.AddressZero, aCDMPlatform.address, 3);
      expect(await aCDMPlatform.lastPrice()).to.equal(143 * 10 ** 11);
      expect(await aCDMPlatform.isSaleRound()).to.equal(true);
      expect(await aCDMPlatform.tokensForSale()).to.equal(3);
    });
  });

  describe("addOrder", function () {
    beforeEach(async function () {
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });
      await token.connect(addr1).approve(aCDMPlatform.address, 10 * 10 ** 6);
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startTradeRound();
    });
    it("Should not let add order in sale round", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startSaleRound();
      await expect(
        aCDMPlatform.connect(addr1).addOrder(5 * 10 ** 6, 10 ** 12)
      ).to.be.revertedWith("Not trade round now");
    });

    it("Should not let add order with zero price", async function () {
      await expect(
        aCDMPlatform.connect(addr1).addOrder(5 * 10 ** 6, 0)
      ).to.be.revertedWith("Non-zero price required");
    });

    it("Should not let add order with zero amount", async function () {
      await expect(
        aCDMPlatform.connect(addr1).addOrder(0, 10 ** 12)
      ).to.be.revertedWith("Non-zero amount required");
    });

    it("Should let add order and emit event", async function () {
      await expect(aCDMPlatform.connect(addr1).addOrder(5 * 10 ** 6, 10 ** 12))
        .to.emit(token, "Transfer")
        .withArgs(addr1.address, aCDMPlatform.address, 5 * 10 ** 6);
    });

    it("Should let add order and set correct params ", async function () {
      await aCDMPlatform.connect(addr1).addOrder(5 * 10 ** 6, 10 ** 12);
      expect((await aCDMPlatform.orders(1)).price).to.equal(10 ** 12);
      expect((await aCDMPlatform.orders(1)).seller).to.equal(addr1.address);
    });
  });

  describe("removeOrder", function () {
    beforeEach(async function () {
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });
      await token.connect(addr1).approve(aCDMPlatform.address, 10 * 10 ** 6);
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startTradeRound();
      await aCDMPlatform.connect(addr1).addOrder(5 * 10 ** 6, 10 ** 12);
    });

    it("Should not let remove order in sale round", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startSaleRound();
      await expect(
        aCDMPlatform.connect(addr1).removeOrder(1)
      ).to.be.revertedWith("Not trade round now");
    });

    it("Should not let remove order with wrong id", async function () {
      await expect(
        aCDMPlatform.connect(addr1).removeOrder(2)
      ).to.be.revertedWith("Order sold or non-existent");
    });

    it("Should not let non-owner remove the order", async function () {
      await expect(
        aCDMPlatform.connect(addr2).removeOrder(1)
      ).to.be.revertedWith("Only owner can remove the order");
    });

    it("Should let owner remove order and emit event", async function () {
      await expect(aCDMPlatform.connect(addr1).removeOrder(1))
        .to.emit(token, "Transfer")
        .withArgs(aCDMPlatform.address, addr1.address, 5 * 10 ** 6);
    });

    it("Should let owner remove order and return funds if something was sold", async function () {
      await aCDMPlatform.connect(addr2).redeemOrder(1, 4 * 10 ** 6, {
        value: ethers.utils.parseEther("0.000004"),
      });

      await expect(aCDMPlatform.connect(addr1).removeOrder(1))
        .to.emit(token, "Transfer")
        .withArgs(aCDMPlatform.address, addr1.address, 10 ** 6);
    });
  });

  describe("redeemOrder", function () {
    beforeEach(async function () {
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });
      await token.connect(addr1).approve(aCDMPlatform.address, 10 * 10 ** 6);
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startTradeRound();
      await aCDMPlatform.connect(addr1).addOrder(5 * 10 ** 6, 10 ** 13);
    });

    it("Should not let redeem order in sale round", async function () {
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startSaleRound();
      await expect(
        aCDMPlatform.connect(addr2).redeemOrder(1, 10 ** 6)
      ).to.be.revertedWith("Not trade round now");
    });

    it("Should not let redeem order with wrong id", async function () {
      await expect(
        aCDMPlatform.connect(addr2).redeemOrder(2, 10 ** 6)
      ).to.be.revertedWith("Order sold or non-existent");
    });

    it("Should not let redeem the order if asked more than ordered", async function () {
      await expect(
        aCDMPlatform.connect(addr2).redeemOrder(1, 10 ** 7)
      ).to.be.revertedWith("Can't buy more than ordered");
    });

    it("Should not let redeem the order if wrong amount sent", async function () {
      await expect(
        aCDMPlatform.connect(addr2).redeemOrder(1, 10 ** 6, {
          value: ethers.utils.parseEther("0.00002"),
        })
      ).to.be.revertedWith("Wrong amount of ether sent");
    });

    it("Should let owner redeem order and emit event", async function () {
      await expect(
        aCDMPlatform.connect(addr2).redeemOrder(1, 10 ** 6, {
          value: ethers.utils.parseEther("0.00001"),
        })
      )
        .to.emit(token, "Transfer")
        .withArgs(aCDMPlatform.address, addr2.address, 10 ** 6);
    });

    it("Should let owner remove order and change seller's balance", async function () {
      await expect(
        await aCDMPlatform.connect(addr2).redeemOrder(1, 10 ** 6, {
          value: ethers.utils.parseEther("0.00001"),
        })
      ).to.changeEtherBalance(addr1, ethers.utils.parseEther("0.0000095"));
    });

    it("Should send interest rate to referrers", async function () {
      await aCDMPlatform.connect(addr3).register(owner.address);
      await aCDMPlatform.connect(addr2).register(addr3.address);

      console.log(await addr1.getBalance());

      await expect(
        await aCDMPlatform.connect(addr2).redeemOrder(1, 10 ** 6, {
          value: ethers.utils.parseEther("0.00001"),
        })
      ).to.changeEtherBalances([addr3, owner], [25 * 10 ** 10, 25 * 10 ** 10]);
      console.log(await addr1.getBalance());
    });

    it("Should save interest rate at platform if no referrers", async function () {
      console.log(await addr1.getBalance());

      await aCDMPlatform
        .connect(addr2)
        .redeemOrder(1, 10 ** 6, { value: ethers.utils.parseEther("0.00001") });
      console.log(await addr1.getBalance());
      expect(await aCDMPlatform.feeSum()).to.equal(50 * 10 ** 10);
    });
  });

  describe("daosVotings", function () {
    beforeEach(async function () {
      // emulate trading
      await aCDMPlatform
        .connect(addr1)
        .buyACDM(10 * 10 ** 6, { value: 10 ** 14 });
      await token.connect(addr1).approve(aCDMPlatform.address, 10 * 10 ** 6);
      await ethers.provider.send("evm_increaseTime", [roundTime]);
      await ethers.provider.send("evm_mine", []);
      await aCDMPlatform.startTradeRound();
      await aCDMPlatform.connect(addr1).addOrder(5 * 10 ** 6, 10 ** 13);

      // await aCDMPlatform.connect(addr3).register(owner.address);
      // await aCDMPlatform.connect(addr2).register(addr3.address);

      console.log(await addr1.getBalance());

      await aCDMPlatform
        .connect(addr2)
        .redeemOrder(1, 10 ** 6, { value: ethers.utils.parseEther("0.00001") });
      expect(await aCDMPlatform.feeSum()).to.equal(5 * 10 ** 11);

      console.log(await addr1.getBalance());
    });

    it("Should let dao buy xxxtokens and burn them", async function () {
      // Daos voting
      const jsonAbi1 = [
        {
          inputs: [],
          name: "buyWithFeeSumAndBurn",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ];
      const iface = new ethers.utils.Interface(jsonAbi1);
      const calldata1 = iface.encodeFunctionData("buyWithFeeSumAndBurn");

      await dao
        .connect(addr1)
        .addProposal(calldata1, recipient, "Lets buy xxxtokens and burn them!");
      //   Deposit:
      await stakingToken.transfer(addr2.address, 50);
      // addr approves spending by the contract
      await stakingToken
        .connect(addr2)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(addr2).stake(50);
      await dao.connect(addr2).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.finishProposal(1))
        .to.emit(dao, "ProposalFinished")
        .withArgs(1, true, 50, "Quorum voted pro and call data executed");

      expect(await xxxToken.balanceOf(aCDMPlatform.address)).to.equal(0);
    });

    it("Should let dao transfer fee to the owner", async function () {
      // Daos voting
      const jsonAbi1 = [
        {
          inputs: [],
          name: "sendFeeSumToOwner",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ];
      const iface = new ethers.utils.Interface(jsonAbi1);
      const calldata1 = iface.encodeFunctionData("sendFeeSumToOwner");

      await dao
        .connect(addr1)
        .addProposal(calldata1, recipient, "Lets transfer fee to the owner!");
      //   Deposit:
      await stakingToken.transfer(addr2.address, 50);
      // addr approves spending by the contract
      await stakingToken
        .connect(addr2)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(addr2).stake(50);
      await dao.connect(addr2).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.finishProposal(1))
        .to.emit(dao, "ProposalFinished")
        .withArgs(1, true, 50, "Quorum voted pro and call data executed");
    });
  });
});
