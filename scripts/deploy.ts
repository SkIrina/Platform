import { ethers } from "hardhat";

async function main() {

  const ACDMToken = await ethers.getContractFactory("ACDMToken");
  const aCDMToken = await ACDMToken.deploy();
  await aCDMToken.deployed();
  console.log("ACDMToken deployed to:", aCDMToken.address);

  // const XXXToken = await ethers.getContractFactory("XXXToken");
  // const xXXToken = await XXXToken.deploy();
  // await xXXToken.deployed();
  // console.log("XXXToken deployed to:", xXXToken.address);
  const xXXTokenAddr = '0x079C42C7733caddf1913FA326819915945Bc0f94';
  const xXXToken = await ethers.getContractAt("XXXToken", xXXTokenAddr);
  
  // UNI-V2
  const stakingTokenAddr = '0x5838DcCA209d98F3532966359386AD85574c0d88';
  const rewardTokenAddr =  xXXTokenAddr;
  
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(stakingTokenAddr, rewardTokenAddr);
  await staking.deployed();
  console.log("Staking deployed to:", staking.address);
  await xXXToken.transfer(staking.address, ethers.utils.parseEther("100"));

  const roundTime = 86400 * 3;
  const ACDMPlatform = await ethers.getContractFactory("ACDMPlatform");
  const aCDMPlatform = await ACDMPlatform.deploy(aCDMToken.address, roundTime);
  await aCDMPlatform.deployed();
  console.log("aCDMPlatform deployed to:", aCDMPlatform.address);

  aCDMToken.transfer(aCDMPlatform.address, 100000 * 10 ** 6);
  aCDMToken.setPlatform(aCDMPlatform.address);

  const minQuorum = 100;
  const debatePeriod = 86400;
  const chairman = '0xAbF78864415e71466DBBB0Bef55ba98F22e468cA';
  const Dao = await ethers.getContractFactory("Dao");
  const dao = await Dao.deploy(chairman, minQuorum, debatePeriod);
  await dao.deployed();
  console.log("Dao deployed to:", dao.address);

  await dao.setStaking(staking.address);
  await aCDMPlatform.setDao(dao.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
