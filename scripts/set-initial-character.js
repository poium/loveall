import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🎭 Setting initial weekly character...");
  
  const contractAddress = "0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa";
  const [deployer] = await ethers.getSigners();
  
  // Get contract instance
  const contract = await ethers.getContractAt("LoveallPrizePool", contractAddress);
  
  console.log("📋 Using contract:", contractAddress);
  console.log("👤 Using account:", deployer.address);
  
  // Check if character is already set
  const currentCharacter = await contract.getCurrentCharacter();
  
  if (currentCharacter.isSet) {
    console.log("ℹ️ Character already set for this week:");
    console.log("- Name:", currentCharacter.name);
    console.log("- Task:", currentCharacter.task);
    console.log("- Traits:", currentCharacter.traitNames.slice(0, currentCharacter.traitCount));
    return;
  }
  
  // Set Loveall as the initial character
  console.log("🎯 Setting initial character: Loveall");
  
  const tx = await contract.setWeeklyCharacter(
    "Loveall",                                          // name
    "Warm and engaging conversationalist who makes everyone feel special", // task  
    ["Warmth", "Empathy", "Humor", "Curiosity", "Charm"], // trait names
    [9, 8, 7, 8, 7],                                   // trait values (1-10)
    5                                                   // trait count
  );
  
  console.log("⏳ Transaction sent:", tx.hash);
  await tx.wait();
  
  console.log("✅ Character set successfully!");
  
  // Verify the character was set
  const verifyCharacter = await contract.getCurrentCharacter();
  console.log("\n📊 Character Details:");
  console.log("- Name:", verifyCharacter.name);
  console.log("- Task:", verifyCharacter.task);
  console.log("- Active Traits:");
  for (let i = 0; i < verifyCharacter.traitCount; i++) {
    console.log(`  • ${verifyCharacter.traitNames[i]}: ${verifyCharacter.traitValues[i]}/10`);
  }
  
  console.log("\n🎉 Bot is ready to chat as Loveall!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Failed to set character:", error);
    process.exit(1);
  });