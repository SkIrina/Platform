import { task } from "hardhat/config";

const contractAddressDao = "0xD613f8824B02fd3D6Ca764cb7d98c527eeA24647";

const contractAddressStaking = "0xF524B7e77E2afCB3dE804CB776D73d61355FAF83";

const contractAddressACDMPlat = "0xF524B7e77E2afCB3dE804CB776D73d61355FAF83";

task("vote", "Vote for proposal")
.addParam("proposalId", "Proposal ID")
.addParam("isSupport", "Bool value: for (true) or against (false)")
.setAction(async function ({ proposalId, isSupport }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddressDao);
    const transactionResponse = await Dao.vote(proposalId, isSupport, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("addProposal", "Add new proposal")
.addParam("calldata", "Calldata that will be executed if proposal succeeds")
.addParam("recipient", "Contract address which to call")
.addParam("description", "Description of the proposal")
.setAction(async function ({ calldata, recipient, description }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddressDao);
    const transactionResponse = await Dao.addProposal(calldata, recipient, description, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("finishProposal", "Finish proposal, evaluate results")
.addParam("proposalId", "Proposal ID")
.setAction(async function ({ proposalId }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddressDao);
    const transactionResponse = await Dao.finishProposal(proposalId, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});


task("setMinQuorum", "Set minimal quorum for the voting - owner only")
.addParam("amount", "Token amount for minimal quorum")
.setAction(async function ({ amount }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddressDao);
    const transactionResponse = await Dao.setMinQuorum(amount, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});

task("setDebatePeriod", "Set debate period for the voting - owner only")
.addParam("period", "Debate period for the voting in seconds")
.setAction(async function ({ period }, { ethers }) {
    const Dao = await ethers.getContractAt("Dao", contractAddressDao);
    const transactionResponse = await Dao.setDebatePeriod(period, {
        gasLimit: 500_000,
    });
    console.log(`Transaction Hash: ${transactionResponse.hash}`);
});


task("stake", "--CUSTOM-- Stake tokens in the pool")
  .addParam("amount", "Staking tokens amount")
  .setAction(async function ({ amount }, { ethers }) {
    const Staking = await ethers.getContractAt("Staking", contractAddressStaking);
    const [sender] = await ethers.getSigners();
    await Staking.connect(sender).stake(amount);
    console.log(`The address ${sender.address} staked ${amount} tokens`);
  });

task(
  "unstake",
  "--CUSTOM-- Withdraw all staked tokens"
)
  .setAction(async function ({}, { ethers }) {
    const Staking = await ethers.getContractAt("Staking", contractAddressStaking);
    const [sender] = await ethers.getSigners();
    await Staking.connect(sender).unstake();
    console.log(
      `The address ${sender.address} withdrew all its staked tokens`
    );
  });

task(
  "claim",
  "--CUSTOM-- Claim reward tokens"
)
  .setAction(async function ({}, { ethers }) {
    const Staking = await ethers.getContractAt("Staking", contractAddressStaking);
    const [sender] = await ethers.getSigners();
    await Staking.connect(sender).claim();
    console.log(
      `The sender ${sender.address} withdrew its reward tokens`
    );
  });


  task("addOrder", "--CUSTOM-- Add new order")
  .addParam("amount", "Amount of tokens for sale")
  .addParam("price", "Price per 1 token")
  .setAction(async function ({ amount, price }, { ethers }) {
      const ACDMPlatform = await ethers.getContractAt("ACDMPlatform", contractAddressACDMPlat);
      const transactionResponse = await ACDMPlatform.addOrder(amount, price, {
          gasLimit: 500_000,
      });
      console.log(`Transaction Hash: ${transactionResponse.hash}`);
  });

  task("removeOrder", "--CUSTOM-- Add new orderRemove listed order")
  .addParam("orderId", "Order id")
  .setAction(async function ({ orderId }, { ethers }) {
      const ACDMPlatform = await ethers.getContractAt("ACDMPlatform", contractAddressACDMPlat);
      const transactionResponse = await ACDMPlatform.removeOrder(orderId, {
          gasLimit: 500_000,
      });
      console.log(`Transaction Hash: ${transactionResponse.hash}`);
  });

  task("redeemOrder", "--CUSTOM-- Redeem existing order")
  .addParam("orderId", "Order id")
  .addParam("amount", "Amount of tokens to buy")
  .setAction(async function ({ orderId, amount }, { ethers }) {
      const ACDMPlatform = await ethers.getContractAt("ACDMPlatform", contractAddressACDMPlat);
      const transactionResponse = await ACDMPlatform.redeemOrder(orderId, amount, {
          gasLimit: 500_000,
      });
      console.log(`Transaction Hash: ${transactionResponse.hash}`);
  });

  task("buyACDM", "--CUSTOM-- Buy ACDMToken on the platform")
  .addParam("amount", "Amount of tokens to buy")
  .setAction(async function ({ amount }, { ethers }) {
      const ACDMPlatform = await ethers.getContractAt("ACDMPlatform", contractAddressACDMPlat);
      const transactionResponse = await ACDMPlatform.buyACDM(amount, {
          gasLimit: 500_000,
      });
      console.log(`Transaction Hash: ${transactionResponse.hash}`);
  });

  task("startSaleRound", "--CUSTOM-- Start sale round")
  .setAction(async function ({}, { ethers }) {
      const ACDMPlatform = await ethers.getContractAt("ACDMPlatform", contractAddressACDMPlat);
      const transactionResponse = await ACDMPlatform.startSaleRound({
          gasLimit: 500_000,
      });
      console.log(`Transaction Hash: ${transactionResponse.hash}`);
  });

  task("startTradeRound", "--CUSTOM-- Start trade round")
  .setAction(async function ({}, { ethers }) {
      const ACDMPlatform = await ethers.getContractAt("ACDMPlatform", contractAddressACDMPlat);
      const transactionResponse = await ACDMPlatform.startTradeRound({
          gasLimit: 500_000,
      });
      console.log(`Transaction Hash: ${transactionResponse.hash}`);
  });

  task("setDao", "--CUSTOM-- Set the address of dao")
  .addParam("address", "Amount of tokens to buy")
  .setAction(async function ({address}, { ethers }) {
      const ACDMPlatform = await ethers.getContractAt("ACDMPlatform", contractAddressACDMPlat);
      const transactionResponse = await ACDMPlatform.setDao(address, {
          gasLimit: 500_000,
      });
      console.log(`Transaction Hash: ${transactionResponse.hash}`);
  });