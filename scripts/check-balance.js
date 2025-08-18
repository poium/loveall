import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🔍 Checking deployment readiness...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Account:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "ETH");
  
  const feeData = await deployer.provider.getFeeData();
  console.log("📊 Network gas price:", ethers.formatUnits(feeData.gasPrice || 0, "gwei"), "Gwei");
  
  // Estimate deployment cost
  const LoveallPrizePool = await ethers.getContractFactory("LoveallPrizePool");
  const deploymentData = LoveallPrizePool.interface.encodeDeploy([
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    deployer.address
  ]);
  
  const gasEstimate = await deployer.provider.estimateGas({
    data: deploymentData
  });
  
  console.log("⛽ Estimated gas:", gasEstimate.toString());
  console.log("💸 Estimated cost:", ethers.formatEther(gasEstimate * (feeData.gasPrice || 0n)), "ETH");
  
  if (balance < gasEstimate * (feeData.gasPrice || 0n)) {
    console.log("❌ Insufficient balance for deployment!");
  } else {
    console.log("✅ Ready for deployment!");
  }
}

main().catch(console.error);
