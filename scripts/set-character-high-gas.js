import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🎭 Setting character with high gas limit...");
  
  const contractAddress = "0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa";
  const [signer] = await ethers.getSigners();
  const contract = await ethers.getContractAt("LoveallPrizePool", contractAddress);
  
  console.log("📋 Using contract:", contractAddress);
  console.log("👤 Using account:", signer.address);
  
  // Get current gas price and use it
  const feeData = await signer.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  
  console.log("⛽ Using gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");
  
  try {
    console.log("🎯 Setting Loveall character with high gas limit...");
    
    const tx = await contract.setWeeklyCharacter(
      "Loveall",
      "Warm and engaging conversationalist who makes everyone feel special",
      ["Warmth", "Empathy", "Humor", "Curiosity", "Charm"],
      [9, 8, 7, 8, 7],
      5,
      {
        gasPrice: gasPrice,
        gasLimit: 500000  // Much higher gas limit (500k instead of 200k)
      }
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    console.log("🔗 View on Basescan:", `https://basescan.org/tx/${tx.hash}`);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("⛽ Gas used:", receipt.gasUsed.toString());
    
    // Verify the character was set
    console.log("\n🔍 Verifying character was set...");
    const character = await contract.getCurrentCharacter();
    
    console.log("📊 Character Details:");
    console.log("- Name:", character.name);
    console.log("- Task:", character.task);
    console.log("- Is Set:", character.isSet);
    console.log("- Trait Count:", character.traitCount.toString());
    
    if (character.isSet) {
      console.log("- Active Traits:");
      for (let i = 0; i < character.traitCount; i++) {
        console.log(`  • ${character.traitNames[i]}: ${character.traitValues[i]}/10`);
      }
      
      console.log("\n🎉 SUCCESS! Character is now set and bot is ready!");
      console.log("💬 Users can now send @loveall mentions and interact with Loveall!");
    } else {
      console.log("❌ Character still not set - there may be another issue");
    }
    
  } catch (error) {
    console.error("❌ Failed to set character:", error.message);
    
    if (error.message.includes("CharacterAlreadySet")) {
      console.log("ℹ️ Character may already be set - checking...");
      const character = await contract.getCurrentCharacter();
      console.log("- Is Set:", character.isSet);
      console.log("- Name:", character.name);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
