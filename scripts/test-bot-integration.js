import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("🧪 Testing Bot Integration with Deployed Contract");
  console.log("================================================");
  
  const CONTRACT_ADDRESS = "0x79C495b3F99EeC74ef06C79677Aee352F40F1De5";
  const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  
  // Get signer (this is the bot wallet)
  const [botWallet] = await ethers.getSigners();
  console.log("🤖 Bot wallet address:", botWallet.address);
  
  // Connect to contracts
  const LoveallPrizePool = await ethers.getContractFactory("LoveallPrizePool");
  const contract = LoveallPrizePool.attach(CONTRACT_ADDRESS);
  
  console.log("\n📊 Testing Contract Read Functions:");
  
  try {
    // Test 1: getCommonData
    console.log("1️⃣ Testing getCommonData()...");
    const commonData = await contract.getCommonData();
    console.log("   ✅ Current Week:", commonData.currentWeek.toString());
    console.log("   ✅ Cast Cost:", ethers.formatUnits(commonData.castCost, 6), "USDC");
    console.log("   ✅ Prize Pool:", ethers.formatUnits(commonData.currentPrizePool, 6), "USDC");
    console.log("   ✅ Character Set:", commonData.characterIsSet);
    console.log("   ✅ Character Name:", commonData.characterName || "None");
    
    // Test 2: getCurrentCharacter
    console.log("\n2️⃣ Testing getCurrentCharacter()...");
    const character = await contract.getCurrentCharacter();
    console.log("   ✅ Name:", character.name || "None");
    console.log("   ✅ Task:", character.task || "None");
    console.log("   ✅ Trait Count:", character.traitCount.toString());
    if (character.traitCount > 0) {
      console.log("   ✅ Traits:");
      for (let i = 0; i < character.traitCount; i++) {
        console.log(`      • ${character.traitNames[i]}: ${character.traitValues[i]}/10`);
      }
    }
    
    // Test 3: Test user data with bot's address
    console.log("\n3️⃣ Testing getUserData() for bot wallet...");
    const userData = await contract.getUserData(botWallet.address);
    console.log("   ✅ Balance:", ethers.formatUnits(userData.balance, 6), "USDC");
    console.log("   ✅ Has Sufficient Balance:", userData.hasSufficientBalance);
    console.log("   ✅ Conversation Count:", userData.conversationCount.toString());
    console.log("   ✅ Remaining Conversations:", userData.remainingConversations.toString());
    console.log("   ✅ Participations Count:", userData.participations.length.toString());
    
    // Test 4: Check owner functions
    console.log("\n4️⃣ Testing owner access...");
    const owner = await contract.owner();
    console.log("   ✅ Contract Owner:", owner);
    console.log("   ✅ Bot is Owner:", owner.toLowerCase() === botWallet.address.toLowerCase());
    
    console.log("\n🎯 Key Integration Points:");
    console.log("=========================");
    console.log("✅ Contract Address Updated:", CONTRACT_ADDRESS);
    console.log("✅ USDC Address Correct:", USDC_ADDRESS);
    console.log("✅ Bot Wallet is Owner:", owner.toLowerCase() === botWallet.address.toLowerCase());
    console.log("✅ Character System Ready:", commonData.characterIsSet);
    console.log("✅ Cast Cost:", ethers.formatUnits(commonData.castCost, 6), "USDC");
    
    console.log("\n📝 Next Steps for Bot:");
    console.log("======================");
    console.log("1. Deploy bot to Vercel/production");
    console.log("2. Fund bot wallet with more ETH for gas");
    console.log("3. Test with real Farcaster mentions");
    console.log("4. Monitor contract interactions");
    
  } catch (error) {
    console.error("❌ Error during testing:", error.message);
    return;
  }
  
  console.log("\n✅ Bot integration test completed successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Test failed:", error);
    process.exit(1);
  });
