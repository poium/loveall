const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying LoveallPrizePool contract...");

  // USDC contract addresses
  const USDC_ADDRESSES = {
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base mainnet USDC
    baseSepolia: "0x036CbD53842c5426634e7929541eC2318f3dCF7c", // Base Sepolia USDC
  };

  // Get the network
  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  let usdcAddress;
  if (chainId === 8453n) {
    usdcAddress = USDC_ADDRESSES.base;
  } else if (chainId === 84532n) {
    usdcAddress = USDC_ADDRESSES.baseSepolia;
  } else {
    throw new Error(`Unsupported network: ${chainId}`);
  }

  console.log(`Network: ${chainId}`);
  console.log(`USDC Address: ${usdcAddress}`);

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);

  // Deploy the contract
  const LoveallPrizePool = await ethers.getContractFactory("LoveallPrizePool");
  const loveallPrizePool = await LoveallPrizePool.deploy(usdcAddress, deployer.address);

  await loveallPrizePool.waitForDeployment();
  const contractAddress = await loveallPrizePool.getAddress();

  console.log(`LoveallPrizePool deployed to: ${contractAddress}`);
  console.log(`Owner: ${deployer.address}`);
  console.log(`USDC Token: ${usdcAddress}`);

  // Verify deployment
  console.log("\nVerifying deployment...");
  const owner = await loveallPrizePool.owner();
  const usdcToken = await loveallPrizePool.usdcToken();
  const currentWeek = await loveallPrizePool.currentWeek();

  console.log(`Owner verification: ${owner === deployer.address ? "✅" : "❌"}`);
  console.log(`USDC token verification: ${usdcToken === usdcAddress ? "✅" : "❌"}`);
  console.log(`Current week: ${currentWeek}`);

  console.log("\nDeployment completed successfully! 🎉");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
