import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🚀 Deploying LoveallPrizePool to Base Mainnet...");
  console.log("⛽ Using Base optimized gas settings: 0.0003 Gwei (normal)");

  // Contract parameters for Base Mainnet
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"; // Base USDC
  const BOT_OWNER_ADDRESS = process.env.ADMIN_WALLET || "0x462752537CcE212d278DBD361DA67e25C2908938";

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.001")) {
    console.log("⚠️  Warning: Low balance! Consider adding more ETH for deployment");
  }

  // Get current gas price from network
  const feeData = await deployer.provider.getFeeData();
  console.log("📊 Network gas price:", ethers.formatUnits(feeData.gasPrice || 0, "gwei"), "Gwei");
  
  // Base optimized gas settings (0.0003 Gwei normal speed)
  const gasPrice = ethers.parseUnits("0.0003", "gwei"); // Normal speed
  console.log("🎯 Using gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");

  // Deploy contract with optimized gas
  const LoveallPrizePool = await ethers.getContractFactory("LoveallPrizePool");
  console.log("🔨 Deploying contract...");
  
  const contract = await LoveallPrizePool.deploy(
    USDC_ADDRESS,
    BOT_OWNER_ADDRESS,
    {
      gasPrice: gasPrice,
      gasLimit: 5000000 // Conservative gas limit
    }
  );

  console.log("⏳ Waiting for deployment transaction...");
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  
  console.log("✅ LoveallPrizePool deployed to:", contractAddress);
  console.log("🔗 USDC Address:", USDC_ADDRESS);
  console.log("👤 Owner Address:", BOT_OWNER_ADDRESS);
  console.log("📊 Deployment TX:", contract.deploymentTransaction().hash);

  // Calculate deployment cost
  const deploymentTx = await contract.deploymentTransaction().wait();
  const gasUsed = deploymentTx.gasUsed;
  const gasCost = gasUsed * gasPrice;
  console.log("⛽ Gas used:", gasUsed.toString());
  console.log("💸 Deployment cost:", ethers.formatEther(gasCost), "ETH (~$" + (parseFloat(ethers.formatEther(gasCost)) * 2000).toFixed(4) + ")");

  // Wait for block confirmations before verification
  console.log("⏳ Waiting for 5 block confirmations...");
  await contract.deploymentTransaction().wait(5);

  // Verify contract on Basescan
  try {
    console.log("🔍 Verifying contract on Basescan...");
    const hre = await import("hardhat");
    await hre.default.run("verify:verify", {
      address: contractAddress,
      constructorArguments: [USDC_ADDRESS, BOT_OWNER_ADDRESS],
    });
    console.log("✅ Contract verified successfully!");
    console.log("🌐 View on Basescan: https://basescan.org/address/" + contractAddress);
  } catch (error) {
    console.log("❌ Verification failed:", error.message);
    console.log("📝 Manual verification needed with these parameters:");
    console.log("- Contract Address:", contractAddress);
    console.log("- Constructor args:", [USDC_ADDRESS, BOT_OWNER_ADDRESS]);
    console.log("- Compiler version: 0.8.20");
    console.log("- Optimization: enabled (200 runs)");
  }

  // Test basic contract functions
  console.log("\n🧪 Testing basic contract functions...");
  try {
    const commonData = await contract.getCommonData();
    console.log("✅ getCommonData() working - Current week:", commonData.currentWeek.toString());
    console.log("✅ Cast cost:", ethers.formatUnits(commonData.castCost, 6), "USDC");
    
    const owner = await contract.owner();
    console.log("✅ Contract owner:", owner);
    console.log("✅ Owner matches bot address:", owner.toLowerCase() === BOT_OWNER_ADDRESS.toLowerCase());
  } catch (error) {
    console.log("❌ Contract test failed:", error.message);
  }

  // Save deployment info
  const deploymentInfo = {
    network: "base-mainnet",
    contractAddress,
    usdcAddress: USDC_ADDRESS,
    ownerAddress: BOT_OWNER_ADDRESS,
    deploymentBlock: await ethers.provider.getBlockNumber(),
    deploymentTx: contract.deploymentTransaction().hash,
    gasPrice: ethers.formatUnits(gasPrice, "gwei") + " Gwei",
    gasUsed: gasUsed.toString(),
    deploymentCost: ethers.formatEther(gasCost) + " ETH",
    timestamp: new Date().toISOString(),
    basescanUrl: "https://basescan.org/address/" + contractAddress
  };

  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log(JSON.stringify(deploymentInfo, null, 2));
  console.log("=".repeat(50));
  
  console.log("\n🎯 Next Steps:");
  console.log("1. Update bot config with contract address:", contractAddress);
  console.log("2. Set initial weekly character using setWeeklyCharacter()");
  console.log("3. Test bot integration with new contract");
  console.log("4. Fund bot wallet with ETH for ongoing operations");
  
  return deploymentInfo;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Deployment failed:", error);
    process.exit(1);
  });
