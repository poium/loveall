import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🔍 Debugging character issue...");
  
  const contractAddress = "0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa";
  const contract = await ethers.getContractAt("LoveallPrizePool", contractAddress);
  
  try {
    // Check current character
    console.log("1️⃣ Checking current character...");
    const character = await contract.getCurrentCharacter();
    console.log("- Is Set:", character.isSet);
    console.log("- Name:", character.name);
    console.log("- Task:", character.task);
    
    // Check common data 
    console.log("\n2️⃣ Checking common data...");
    const commonData = await contract.getCommonData();
    console.log("- Current Week:", commonData.currentWeek.toString());
    console.log("- Character Name:", commonData.characterName);
    console.log("- Character Is Set:", commonData.characterIsSet);
    
    // Check if we're the owner
    console.log("\n3️⃣ Checking ownership...");
    const owner = await contract.owner();
    const [signer] = await ethers.getSigners();
    console.log("- Contract Owner:", owner);
    console.log("- Our Address:", signer.address);
    console.log("- Are We Owner:", owner.toLowerCase() === signer.address.toLowerCase());
    
    // Check if contract is paused
    console.log("\n4️⃣ Checking contract state...");
    const paused = await contract.paused();
    console.log("- Contract Paused:", paused);
    
    // Try to call the function with debug
    if (!character.isSet && owner.toLowerCase() === signer.address.toLowerCase() && !paused) {
      console.log("\n5️⃣ Attempting to set character (simulation)...");
      
      try {
        // First simulate the call
        const result = await contract.setWeeklyCharacter.staticCall(
          "Loveall",
          "Warm and engaging conversationalist who makes everyone feel special",
          ["Warmth", "Empathy", "Humor", "Curiosity", "Charm"],
          [9, 8, 7, 8, 7],
          5
        );
        console.log("✅ Static call succeeded");
        
        // Now try the actual transaction with detailed error catching
        const tx = await contract.setWeeklyCharacter(
          "Loveall",
          "Warm and engaging conversationalist who makes everyone feel special",
          ["Warmth", "Empathy", "Humor", "Curiosity", "Charm"],
          [9, 8, 7, 8, 7],
          5,
          { gasLimit: 300000 }
        );
        
        console.log("⏳ Transaction sent:", tx.hash);
        await tx.wait();
        console.log("✅ Character set successfully!");
        
      } catch (error) {
        console.log("❌ Error details:");
        console.log("- Error code:", error.code);
        console.log("- Error message:", error.message);
        
        if (error.reason) {
          console.log("- Revert reason:", error.reason);
        }
        
        if (error.data) {
          console.log("- Error data:", error.data);
        }
      }
    } else {
      console.log("\n❓ Cannot set character because:");
      if (character.isSet) console.log("- Character already set");
      if (owner.toLowerCase() !== signer.address.toLowerCase()) console.log("- Not contract owner");
      if (paused) console.log("- Contract is paused");
    }
    
  } catch (error) {
    console.error("Debug failed:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Script failed:", error);
    process.exit(1);
  });
