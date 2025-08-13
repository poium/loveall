const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LoveallPrizePool", function () {
  let loveallPrizePool;
  let mockUsdc;
  let owner;
  let user1;
  let user2;
  let user3;

  const CAST_COST = ethers.parseUnits("0.01", 6); // 0.01 USDC (1 cent)
  const TOP_UP_AMOUNT = ethers.parseUnits("10", 6); // 10 USDC

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();

    // Deploy mock USDC token
    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    mockUsdc = await MockUSDC.deploy();

    // Deploy LoveallPrizePool
    const LoveallPrizePool = await ethers.getContractFactory("LoveallPrizePool");
    loveallPrizePool = await LoveallPrizePool.deploy(await mockUsdc.getAddress(), owner.address);

    // Mint USDC to users
    await mockUsdc.mint(user1.address, TOP_UP_AMOUNT);
    await mockUsdc.mint(user2.address, TOP_UP_AMOUNT);
    await mockUsdc.mint(user3.address, TOP_UP_AMOUNT);

    // Approve USDC spending
    await mockUsdc.connect(user1).approve(await loveallPrizePool.getAddress(), TOP_UP_AMOUNT);
    await mockUsdc.connect(user2).approve(await loveallPrizePool.getAddress(), TOP_UP_AMOUNT);
    await mockUsdc.connect(user3).approve(await loveallPrizePool.getAddress(), TOP_UP_AMOUNT);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await loveallPrizePool.owner()).to.equal(owner.address);
    });

    it("Should set the correct USDC token", async function () {
      expect(await loveallPrizePool.usdcToken()).to.equal(await mockUsdc.getAddress());
    });

    it("Should start with week 1", async function () {
      const commonData = await loveallPrizePool.getCommonData();
      expect(commonData.currentWeek).to.equal(1);
    });
  });

  describe("Balance Management", function () {
    it("Should allow users to top up balance", async function () {
      await loveallPrizePool.connect(user1).topUp(TOP_UP_AMOUNT);
      const userData = await loveallPrizePool.getUserData(user1.address);
      expect(userData.balance).to.equal(TOP_UP_AMOUNT);
    });

    it("Should allow users to withdraw balance", async function () {
      await loveallPrizePool.connect(user1).topUp(TOP_UP_AMOUNT);
      await loveallPrizePool.connect(user1).withdrawBalance(TOP_UP_AMOUNT);
      const userData = await loveallPrizePool.getUserData(user1.address);
      expect(userData.balance).to.equal(0);
    });

    it("Should check sufficient balance correctly", async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      const user1Data = await loveallPrizePool.getUserData(user1.address);
      const user2Data = await loveallPrizePool.getUserData(user2.address);
      
      expect(user1Data.hasSufficientBalance).to.be.true;
      expect(user2Data.hasSufficientBalance).to.be.false;
    });
  });

  describe("Cast Participation", function () {
    beforeEach(async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST * 2n); // Enough for 2 participations
      // user2 will not top up to test insufficient balance
    });

    it("Should allow users to participate in cast", async function () {
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      
      await loveallPrizePool.connect(owner).participateInCast(user1.address, castHash);
      
      const userData = await loveallPrizePool.getUserData(user1.address);
      const commonData = await loveallPrizePool.getCommonData();
      
      expect(userData.balance).to.equal(CAST_COST); // Should have 1 USDC left
      expect(commonData.currentWeekPrizePool).to.equal(CAST_COST);
      expect(userData.hasParticipatedThisWeek).to.be.true;
    });

    it("Should prevent participation without sufficient balance", async function () {
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      
      // user2 has no balance in the contract (only approved, not topped up)
      await expect(
        loveallPrizePool.connect(owner).participateInCast(user2.address, castHash)
      ).to.be.revertedWithCustomError(loveallPrizePool, "InsufficientBalance");
    });

    it("Should prevent multiple participations in same week", async function () {
      const castHash1 = ethers.keccak256(ethers.toUtf8Bytes("test cast 1"));
      const castHash2 = ethers.keccak256(ethers.toUtf8Bytes("test cast 2"));
      
      await loveallPrizePool.connect(owner).participateInCast(user1.address, castHash1);
      
      await expect(
        loveallPrizePool.connect(owner).participateInCast(user1.address, castHash2)
      ).to.be.revertedWithCustomError(loveallPrizePool, "AlreadyParticipated");
    });
  });

  describe("Prize Pool Management", function () {
    beforeEach(async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      await loveallPrizePool.connect(user2).topUp(CAST_COST);
      await loveallPrizePool.connect(user3).topUp(CAST_COST);
    });

    it("Should track prize pool correctly", async function () {
      const castHash1 = ethers.keccak256(ethers.toUtf8Bytes("test cast 1"));
      const castHash2 = ethers.keccak256(ethers.toUtf8Bytes("test cast 2"));
      
      await loveallPrizePool.connect(owner).participateInCast(user1.address, castHash1);
      await loveallPrizePool.connect(owner).participateInCast(user2.address, castHash2);
      
      const commonData = await loveallPrizePool.getCommonData();
      expect(commonData.currentWeekPrizePool).to.equal(CAST_COST * 2n);
      expect(commonData.totalPrizePool).to.equal(CAST_COST * 2n);
    });

    it("Should set and distribute prizes correctly", async function () {
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      
      await loveallPrizePool.connect(owner).participateInCast(user1.address, castHash);
      
      const initialBalance = await mockUsdc.balanceOf(user1.address);
      
      await loveallPrizePool.connect(owner).setWeeklyWinner(user1.address);
      await loveallPrizePool.connect(owner).distributePrize();
      
      const finalBalance = await mockUsdc.balanceOf(user1.address);
      const prize = (CAST_COST * 90n) / 100n; // 90% of prize pool
      
      expect(finalBalance - initialBalance).to.equal(prize);
      expect(await loveallPrizePool.getRolloverAmount()).to.equal((CAST_COST * 10n) / 100n);
    });
  });

  describe("Weekly Management", function () {
    it("Should start new week correctly", async function () {
      await loveallPrizePool.connect(owner).startNewWeek();
      const commonData = await loveallPrizePool.getCommonData();
      expect(commonData.currentWeek).to.equal(2);
    });

    it("Should carry over rollover amount to new week", async function () {
      // Setup participation and prize distribution
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      await loveallPrizePool.connect(owner).participateInCast(user1.address, castHash);
      await loveallPrizePool.connect(owner).setWeeklyWinner(user1.address);
      await loveallPrizePool.connect(owner).distributePrize();
      
      // Start new week
      await loveallPrizePool.connect(owner).startNewWeek();
      
      const rollover = (CAST_COST * 10n) / 100n;
      const commonData = await loveallPrizePool.getCommonData();
      expect(commonData.currentWeekPrizePool).to.equal(rollover);
    });
  });

  describe("Access Control", function () {
    it("Should only allow owner to participate in cast", async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      
      await expect(
        loveallPrizePool.connect(user1).participateInCast(user1.address, castHash)
      ).to.be.revertedWithCustomError(loveallPrizePool, "OwnableUnauthorizedAccount");
    });

    it("Should only allow owner to set winner", async function () {
      await expect(
        loveallPrizePool.connect(user1).setWeeklyWinner(user1.address)
      ).to.be.revertedWithCustomError(loveallPrizePool, "OwnableUnauthorizedAccount");
    });
  });

  describe("Optimized View Functions", function () {
    it("Should return complete common data", async function () {
      const commonData = await loveallPrizePool.getCommonData();
      
      expect(commonData.totalPrizePool).to.equal(0);
      expect(commonData.currentWeekPrizePool).to.equal(0);
      expect(commonData.rolloverAmount).to.equal(0);
      expect(commonData.currentWeek).to.equal(1);
      expect(commonData.currentWeekParticipantsCount).to.equal(0);
      expect(commonData.currentWeekWinner).to.equal(ethers.ZeroAddress);
      expect(commonData.currentWeekPrize).to.equal(0);
    });

    it("Should return complete user data", async function () {
      await loveallPrizePool.connect(user1).topUp(TOP_UP_AMOUNT);
      
      const userData = await loveallPrizePool.getUserData(user1.address);
      
      expect(userData.balance).to.equal(TOP_UP_AMOUNT);
      expect(userData.hasSufficientBalance).to.be.true;
      expect(userData.hasParticipatedThisWeek).to.be.false;
      expect(userData.participationsCount).to.equal(0);
      expect(userData.participations.length).to.equal(0);
    });

    it("Should return multiple users data", async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      await loveallPrizePool.connect(user2).topUp(CAST_COST);
      
      const users = [user1.address, user2.address];
      const usersData = await loveallPrizePool.getMultipleUsersData(users);
      
      expect(usersData.length).to.equal(2);
      expect(usersData[0].balance).to.equal(CAST_COST);
      expect(usersData[1].balance).to.equal(CAST_COST);
      expect(usersData[0].hasSufficientBalance).to.be.true;
      expect(usersData[1].hasSufficientBalance).to.be.true;
    });

    it("Should return weekly summary", async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      await loveallPrizePool.connect(owner).participateInCast(user1.address, castHash);
      await loveallPrizePool.connect(owner).setWeeklyWinner(user1.address);
      
      const weeklySummary = await loveallPrizePool.getWeeklySummary(1);
      
      expect(weeklySummary.participants.length).to.equal(1);
      expect(weeklySummary.participants[0]).to.equal(user1.address);
      expect(weeklySummary.winner).to.equal(user1.address);
      expect(weeklySummary.participantsCount).to.equal(1);
    });
  });
});
