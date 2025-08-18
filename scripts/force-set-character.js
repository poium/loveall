import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🎭 Force setting character with higher gas...");
  
  const contractAddress = "0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa";
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("LoveallPrizePool", contractAddress);
  
  console.log("📋 Using contract:", contractAddress);
  console.log("👤 Using account:", signer.address);
  
  // Get current gas price and increase it
  const feeData = await signer.provider.getFeeData();
  const gasPrice = feeData.gasPrice * 120n / 100n; // 20% higher
  
  console.log("⛽ Using gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");
  
  try {
    const tx = await contract.setWeeklyCharacter(
      "Loveall",
      "Warm and engaging conversationalist who makes everyone feel special",
      ["Warmth", "Empathy", "Humor", "Curiosity", "Charm"],
      [9, 8, 7, 8, 7],
      5,
      {
        gasPrice: gasPrice,
        gasLimit: 200000
      }
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    
    // Verify
    const character = await contract.getCurrentCharacter();
    console.log("\n📊 Character Successfully Set:");
    console.log("- Name:", character.name);
    console.log("- Task:", character.task);
    console.log("- Is Set:", character.isSet);
    
    console.log("\n🎉 Bot is ready to chat as Loveall!");
    
  } catch (error) {
    if (error.message.includes("CharacterAlreadySet")) {
      console.log("✅ Character is already set - checking current character...");
      
      const character = await contract.getCurrentCharacter();
      console.log("- Name:", character.name);
      console.log("- Task:", character.task);
      console.log("- Is Set:", character.isSet);
    } else {
      console.error("❌ Failed to set character:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
