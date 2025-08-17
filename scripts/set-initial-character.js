import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🎭 Setting initial AI character for Week 1...");
  
  const CONTRACT_ADDRESS = "0x79C495b3F99EeC74ef06C79677Aee352F40F1De5";
  
  // Get deployer (owner)
  const [owner] = await ethers.getSigners();
  console.log("👤 Owner address:", owner.address);
  
  // Connect to contract
  const LoveallPrizePool = await ethers.getContractFactory("LoveallPrizePool");
  const contract = LoveallPrizePool.attach(CONTRACT_ADDRESS);
  
  // Check current week and character status
  const commonData = await contract.getCommonData();
  console.log("📅 Current week:", commonData.currentWeek.toString());
  console.log("🎭 Character already set:", commonData.characterIsSet);
  
  if (commonData.characterIsSet) {
    console.log("⚠️  Character already set for this week!");
    const character = await contract.getCurrentCharacter();
    console.log("Current character:", character.name);
    return;
  }
  
  // Define first AI character - "Flirty Sales Expert"
  const characterData = {
    name: "Jordan Belfort", 
    task: "Try to sell this pen to me through charming conversation",
    traitNames: ["Charisma", "Confidence", "Playfulness", "Persuasion", "Charm"],
    traitValues: [9, 8, 7, 10, 8], // Scale 1-10
    traitCount: 5
  };
  
  console.log("\n🎭 Setting character:");
  console.log("- Name:", characterData.name);
  console.log("- Task:", characterData.task);
  console.log("- Traits:");
  for (let i = 0; i < characterData.traitNames.length; i++) {
    console.log(`  • ${characterData.traitNames[i]}: ${characterData.traitValues[i]}/10`);
  }
  
  // Set the character
  try {
    console.log("\n🔄 Calling setWeeklyCharacter...");
    const tx = await contract.setWeeklyCharacter(
      characterData.name,
      characterData.task,
      characterData.traitNames,
      characterData.traitValues,
      characterData.traitCount
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Character set successfully!");
    console.log("⛽ Gas used:", receipt.gasUsed.toString());
    
    // Verify the character was set
    const updatedCommonData = await contract.getCommonData();
    console.log("\n📊 Verification:");
    console.log("- Character name:", updatedCommonData.characterName);
    console.log("- Character task:", updatedCommonData.characterTask);
    console.log("- Character set:", updatedCommonData.characterIsSet);
    
  } catch (error) {
    console.error("❌ Error setting character:", error.message);
    
    if (error.message.includes("CharacterAlreadySet")) {
      console.log("ℹ️  Character already set for this week");
    } else if (error.message.includes("InvalidTaskLength")) {
      console.log("ℹ️  Task length must be ≤ 255 characters");
    } else if (error.message.includes("InvalidTraitCount")) {
      console.log("ℹ️  Trait count must be 1-5");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Script failed:", error);
    process.exit(1);
  });
