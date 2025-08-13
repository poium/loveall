import { expect } from "chai";
import { ethers } from "hardhat";
import { LoveallPrizePool } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("LoveallPrizePool", function () {
  let loveallPrizePool: LoveallPrizePool;
  let owner: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let user3: SignerWithAddress;
  let mockUsdc: any;

  const CAST_COST = ethers.parseUnits("1", 6); // 1 USDC
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
      expect(await loveallPrizePool.currentWeek()).to.equal(1);
    });
  });

  describe("Balance Management", function () {
    it("Should allow users to top up balance", async function () {
      await loveallPrizePool.connect(user1).topUp(TOP_UP_AMOUNT);
      expect(await loveallPrizePool.getBalance(user1.address)).to.equal(TOP_UP_AMOUNT);
    });

    it("Should allow users to withdraw balance", async function () {
      await loveallPrizePool.connect(user1).topUp(TOP_UP_AMOUNT);
      await loveallPrizePool.connect(user1).withdrawBalance(TOP_UP_AMOUNT);
      expect(await loveallPrizePool.getBalance(user1.address)).to.equal(0);
    });

    it("Should check sufficient balance correctly", async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      expect(await loveallPrizePool.hasSufficientBalance(user1.address)).to.be.true;
      
      expect(await loveallPrizePool.hasSufficientBalance(user2.address)).to.be.false;
    });
  });

  describe("Cast Participation", function () {
    beforeEach(async function () {
      await loveallPrizePool.connect(user1).topUp(CAST_COST);
      await loveallPrizePool.connect(user2).topUp(CAST_COST);
    });

    it("Should allow users to participate in cast", async function () {
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      
      await loveallPrizePool.connect(owner).participateInCast(user1.address, castHash);
      
      expect(await loveallPrizePool.getBalance(user1.address)).to.equal(0);
      expect(await loveallPrizePool.getWeeklyPrizePool()).to.equal(CAST_COST);
      expect(await loveallPrizePool.hasParticipatedThisWeek(user1.address)).to.be.true;
    });

    it("Should prevent participation without sufficient balance", async function () {
      const castHash = ethers.keccak256(ethers.toUtf8Bytes("test cast"));
      
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
      
      expect(await loveallPrizePool.getWeeklyPrizePool()).to.equal(CAST_COST * 2n);
      expect(await loveallPrizePool.getCurrentPrizePool()).to.equal(CAST_COST * 2n);
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
      expect(await loveallPrizePool.currentWeek()).to.equal(2);
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
      expect(await loveallPrizePool.getWeeklyPrizePool()).to.equal(rollover);
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
});

// Mock USDC contract for testing
const MockUSDC = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
`;
