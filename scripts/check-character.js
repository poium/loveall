import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🔍 Checking current character status...");
  
  const contractAddress = "0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa";
  const contract = await ethers.getContractAt("LoveallPrizePool", contractAddress);
  
  console.log("📋 Using contract:", contractAddress);
  
  try {
    // Get current character
    const character = await contract.getCurrentCharacter();
    
    console.log("\n📊 Current Character Status:");
    console.log("- Is Set:", character.isSet);
    
    if (character.isSet) {
      console.log("- Name:", character.name);
      console.log("- Task:", character.task);
      console.log("- Trait Count:", character.traitCount.toString());
      console.log("- Active Traits:");
      
      for (let i = 0; i < character.traitCount; i++) {
        console.log(`  • ${character.traitNames[i]}: ${character.traitValues[i]}/10`);
      }
      
      console.log("\n✅ Character is properly set!");
    } else {
      console.log("❌ No character set for current week");
      
      // Try to set it
      console.log("\n🎯 Setting character now...");
      const [signer] = await ethers.getSigners();
      
      const tx = await contract.setWeeklyCharacter(
        "Loveall",
        "Warm and engaging conversationalist who makes everyone feel special",
        ["Warmth", "Empathy", "Humor", "Curiosity", "Charm"],
        [9, 8, 7, 8, 7],
        5
      );
      
      console.log("⏳ Transaction:", tx.hash);
      await tx.wait();
      console.log("✅ Character set successfully!");
    }
    
    // Also check common data
    const commonData = await contract.getCommonData();
    console.log("\n📈 Contract Status:");
    console.log("- Current Week:", commonData.currentWeek.toString());
    console.log("- Cast Cost:", ethers.formatUnits(commonData.castCost, 6), "USDC");
    console.log("- Character Name:", commonData.characterName);
    console.log("- Character Set:", commonData.characterIsSet);
    
  } catch (error) {
    console.error("Error checking character:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
