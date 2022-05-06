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
} from "../typechain";

describe("My awesome dao contract", function () {
  let StakingToken: ERC20__factory;
  let stakingToken: ERC20;
  let RewardToken: XXXToken__factory;
  let rewardToken: XXXToken;

  let Staking: Staking__factory;
  let staking: Staking;
  let Dao: Dao__factory;
  let dao: Dao;
  let owner: SignerWithAddress;
  let chair: SignerWithAddress;
  let voter1: SignerWithAddress;
  let voter2: SignerWithAddress;
  let voter3: SignerWithAddress;

  let addrs: SignerWithAddress[];

  const jsonAbi = [
    {
      inputs: [
        {
          internalType: "uint256",
          name: "daysNumber",
          type: "uint256",
        },
      ],
      name: "setLockedTime",
      outputs: [],
      stateMutability: "nonpayable",
      type: "function",
    },
  ];
  const iface = new ethers.utils.Interface(jsonAbi);
  const newTimeDays = 10;
  const calldata = iface.encodeFunctionData("setLockedTime", [newTimeDays]);
  let recipient: string;

  beforeEach(async function () {
    [owner, chair, voter1, voter2, voter3, ...addrs] =
      await ethers.getSigners();

    StakingToken = await ethers.getContractFactory("Token");
    stakingToken = await StakingToken.deploy("ERC20 token", "STK");
    RewardToken = await ethers.getContractFactory("XXXToken");
    rewardToken = await RewardToken.deploy();

    Staking = await ethers.getContractFactory("Staking");
    staking = await Staking.deploy(stakingToken.address, rewardToken.address);
    await rewardToken.transfer(staking.address, ethers.utils.parseEther("100"));

    Dao = await ethers.getContractFactory("Dao");
    dao = await Dao.deploy(chair.address, 3, 600);
    await dao.deployed();

    recipient = staking.address;

    await dao.connect(chair).setStaking(staking.address);
  });

  describe("testcall", function () {
    it("[Staking] Check if calldata works, staking onlyDao test", async function () {
      await staking.setDao(dao.address);

      await dao.callTest(recipient, calldata);
      // staking onlyDao Test!!
      expect(await staking.lockedTime()).to.equal(864000);
    });
  });

  describe("constructor", function () {
    it("Should set chairman", async function () {
      expect(await dao.chairman()).to.equal(chair.address);
    });
  });

  describe("setMinQuorum, setDebatePeriod", function () {
    it("Should let chairman change min quorum, debate period", async function () {
      await expect(dao.connect(chair).setMinQuorum(2)).to.not.be.reverted;
      await expect(dao.connect(chair).setDebatePeriod(200)).to.not.be.reverted;
    });
    it("Should not let non-chairman change min quorum, debate period", async function () {
      await expect(dao.connect(voter1).setMinQuorum(2)).to.be.revertedWith(
        "Not the chairman"
      );

      await expect(dao.connect(voter1).setDebatePeriod(200)).to.be.revertedWith(
        "Not the chairman"
      );
    });
  });

  describe("addProposal", function () {
    it("Should let chairman add proposal", async function () {
      await expect(
        dao
          .connect(chair)
          .addProposal(
            calldata,
            recipient,
            "Lets change the locked time duration!"
          )
      ).to.not.be.reverted;
    });

    it("Should not let non-chairman add proposal", async function () {
      await expect(
        dao
          .connect(voter1)
          .addProposal(
            calldata,
            recipient,
            "Lets change the locked time duration!"
          )
      ).to.be.revertedWith("Not the chairman");
    });

    it("Should set proposal parameters correctly", async function () {
      await dao
        .connect(chair)
        .addProposal(
          calldata,
          recipient,
          "Lets change the locked time duration!"
        );
      expect((await dao.proposals(1)).open).to.equal(true);
      expect((await dao.proposals(1)).callData).to.equal(calldata);
      expect((await dao.proposals(1)).recipient).to.equal(recipient);
    });

    it("Should emit addProposal event", async function () {
      // Get the block number
      ethers.provider.getBlockNumber().then(function (blockNumber) {
        // getBlock returns a block object and it has a timestamp property.
        ethers.provider.getBlock(blockNumber).then(async function (block) {
          const timestamp = block.timestamp;
          await expect(
            dao
              .connect(chair)
              .addProposal(
                calldata,
                recipient,
                "Lets change the locked time duration!"
              )
          )
            .to.emit(dao, "AddProposal")
            .withArgs(
              1,
              calldata,
              recipient,
              "Lets change the locked time duration!",
              timestamp
            );
        });
      });
    });
  });

  describe("vote", function () {
    beforeEach(async function () {
      // give addr1 10 staking tokens
      await stakingToken.transfer(voter1.address, 10);
      // addr1 approves spending by the contract
      await stakingToken
        .connect(voter1)
        .approve(staking.address, ethers.utils.parseEther("100"));

      await staking.connect(voter1).stake(10);
    });

    it("Should not let vote if no deposit", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await expect(dao.connect(voter2).vote(1, true)).to.be.revertedWith(
        "No deposit for vote"
      );
    });

    it("Should not let vote for non-existent proposal", async function () {
      await expect(dao.connect(voter1).vote(1, true)).to.be.revertedWith(
        "No such proposal"
      );
    });

    it("Should not let vote twice", async function () {
      //   await dao.connect(voter1).deposit(50);
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).vote(1, true);
      await expect(dao.connect(voter1).vote(1, true)).to.be.revertedWith(
        "Already voted on this proposal"
      );
    });

    it("Should not let vote on finished proposal", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      //   await dao.connect(voter1).deposit(50);
      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await dao.finishProposal(1);

      //   await dao.connect(voter3).deposit(50);

      // give addr3 10 staking tokens
      await stakingToken.transfer(voter3.address, 10);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(voter3)
        .approve(staking.address, ethers.utils.parseEther("100"));

      await staking.connect(voter3).stake(10);

      await expect(dao.connect(voter3).vote(1, true)).to.be.revertedWith(
        "Voting period finished"
      );
    });

    it("Should let vote and set correct parameters", async function () {
      //   await dao.connect(voter1).deposit(50);
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await expect(dao.connect(voter1).vote(1, true)).to.not.be.reverted;
    });

    it("Should emit vote event", async function () {
      //   await dao.connect(voter1).deposit(50);
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");

      await expect(dao.connect(voter1).vote(1, true))
        .to.emit(dao, "Vote")
        .withArgs(voter1.address, 10, 1, true);
    });

    it("[Staking] Should not let unstake if voted on active proposal", async function () {
      // addr1 staked and locked time passed
      await ethers.provider.send("evm_increaseTime", [86400 + 100]);
      await ethers.provider.send("evm_mine", []);

      await staking.setDao(dao.address);
      // then he votes
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      await dao.connect(voter1).vote(1, true);

      await expect(staking.connect(voter1).unstake()).to.be.revertedWith(
        "Voting in dao now, can't unstake"
      );
    });
  });

  describe("finishProposal", function () {
    it("Should not let finish non-existent proposal", async function () {
      await expect(dao.finishProposal(1)).to.be.revertedWith(
        "No such proposal"
      );
    });

    it("Should not let finish before specified period", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      // emulate time passed, 72h = 259200sec
      await ethers.provider.send("evm_increaseTime", [100]);
      await ethers.provider.send("evm_mine", []);
      await expect(dao.connect(chair).finishProposal(1)).to.be.revertedWith(
        "Voting period not finished yet"
      );
    });

    it("Should not let finish twice", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      //   Deposit:
      // give addr3 10 staking tokens
      await stakingToken.transfer(voter1.address, 10);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(voter1)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(voter1).stake(10);

      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await dao.finishProposal(1);

      await expect(dao.finishProposal(1)).to.be.revertedWith(
        "Voting finished already"
      );
    });

    it("Should fail (emit fail event) if not enough quorum", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");

      //   Deposit:
      // give addr3 10 staking tokens
      await stakingToken.transfer(voter1.address, 10);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(voter1)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(voter1).stake(1);

      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.finishProposal(1))
        .to.emit(dao, "ProposalFinished")
        .withArgs(1, false, 1, "Quorum is not present");
    });

    it("Should fail (emit fail event) if more voted against", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      //   await dao.connect(voter1).deposit(50);
      //   Deposit:
      await stakingToken.transfer(voter1.address, 10);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(voter1)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(voter1).stake(10);
      //   await dao.connect(voter3).deposit(400);

      //   Deposit:
      // give addr3 10 staking tokens
      await stakingToken.transfer(voter3.address, 100);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(voter3)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(voter3).stake(100);

      await dao.connect(voter1).vote(1, true);
      await dao.connect(voter3).vote(1, false);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.finishProposal(1))
        .to.emit(dao, "ProposalFinished")
        .withArgs(1, false, 110, "Quorum voted against");
    });

    it("Should emit fail event if calldata execution fails", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      //   await dao.connect(voter1).deposit(50);
      //   Deposit:
      // give addr3 10 staking tokens
      await stakingToken.transfer(voter1.address, 50);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(voter1)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(voter1).stake(50);

      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);

      await expect(dao.connect(voter1).finishProposal(1))
        .to.emit(dao, "ProposalFinished")
        .withArgs(1, false, 50, "Call to contract failed");
    });

    it("Should emit success event if calldata execution succeeds", async function () {
      await dao
        .connect(chair)
        .addProposal(calldata, recipient, "Lets increase the transfer fee!");
      //   Deposit:
      // give addr3 10 staking tokens
      await stakingToken.transfer(voter1.address, 50);
      // addr3 approves spending by the contract
      await stakingToken
        .connect(voter1)
        .approve(staking.address, ethers.utils.parseEther("100"));
      await staking.connect(voter1).stake(50);

      await dao.connect(voter1).vote(1, true);

      await ethers.provider.send("evm_increaseTime", [10000]);
      await ethers.provider.send("evm_mine", []);
      await staking.setDao(dao.address);
      await expect(dao.finishProposal(1))
        .to.emit(dao, "ProposalFinished")
        .withArgs(1, true, 50, "Quorum voted pro and call data executed");

      expect(await staking.lockedTime()).to.equal(864000);
    });
  });
});
