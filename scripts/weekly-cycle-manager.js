import pkg from "hardhat";
const { ethers } = pkg;
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

/**
 * Weekly Cycle Manager - Automates the complete weekly flow
 * 1. Evaluate conversations with AI
 * 2. Select winner
 * 3. Distribute prizes  
 * 4. Announce winner
 * 5. Start new week
 * 6. Set new character
 */

// Initialize Neynar for announcements
const neynar = new NeynarAPIClient(new Configuration({
    apiKey: process.env.NEYNAR_API_KEY
}));

// Character database for weekly rotation
const CHARACTERS = [
    {
        name: "Jordan Belfort",
        task: "Master persuader selling investment opportunities with unstoppable charm",
        traits: ["Persuasiveness", "Charisma", "Confidence", "Ambition", "Risk-taking"],
        values: [10, 9, 8, 7, 6],
        count: 5
    },
    {
        name: "Sherlock Holmes", 
        task: "Brilliant detective solving mysteries through deduction and observation",
        traits: ["Intelligence", "Observation", "Logic", "Curiosity", ""],
        values: [10, 9, 8, 8, 0],
        count: 4
    },
    {
        name: "Robin Williams",
        task: "Comedic genius bringing joy and laughter through witty humor",
        traits: ["Humor", "Energy", "Creativity", "Warmth", "Spontaneity"], 
        values: [10, 9, 8, 8, 7],
        count: 5
    },
    {
        name: "Socrates",
        task: "Wise philosopher engaging in deep discussions about life and meaning", 
        traits: ["Wisdom", "Curiosity", "Patience", "Logic", ""],
        values: [10, 9, 8, 7, 0],
        count: 4
    },
    {
        name: "Oprah Winfrey",
        task: "Inspirational host helping users discover their best selves",
        traits: ["Empathy", "Inspiration", "Wisdom", "Charisma", "Positivity"],
        values: [10, 9, 8, 8, 9],
        count: 5
    }
];

async function main() {
    console.log("🔄 Starting Weekly Cycle Management...");
    
    // Get contract instance
    const [deployer] = await ethers.getSigners();
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa";
    const contract = await ethers.getContractAt("LoveallPrizePool", contractAddress);
    
    console.log("📋 Using contract:", contractAddress);
    console.log("👤 Using account:", deployer.address);
    
    try {
        // Step 1: Get unevaluated conversations
        console.log("\n1️⃣ Getting unevaluated conversations...");
        const [conversationIds, users, fids] = await contract.getUnevaluatedConversationsForAI();
        console.log(`📊 Found ${conversationIds.length} conversations to evaluate`);
        
        if (conversationIds.length === 0) {
            console.log("ℹ️ No conversations to evaluate. Skipping to next week setup...");
        } else {
            // Step 2: Simulate AI evaluation (you'd integrate real AI here)
            console.log("\n2️⃣ Simulating AI evaluation...");
            const evaluatedConversations = conversationIds.slice(0, Math.min(10, conversationIds.length));
            const topUsers = users.slice(0, evaluatedConversations.length);
            const topScores = evaluatedConversations.map((_, i) => Math.floor(Math.random() * 50) + 1);
            
            console.log("🤖 Top scores:", topScores);
            
            // Step 3: Record AI scores
            console.log("\n3️⃣ Recording top AI scores...");
            const tx1 = await contract.recordTopAIScores(
                topUsers,
                evaluatedConversations, 
                topScores,
                conversationIds.length
            );
            await tx1.wait();
            console.log("✅ AI scores recorded");
            
            // Step 4: Select winner
            console.log("\n4️⃣ Selecting winner...");
            const tx2 = await contract.selectWinnerByAIScore();
            await tx2.wait();
            console.log("✅ Winner selected");
        }
        
        // Step 5: Get current week data
        const commonData = await contract.getCommonData();
        const currentWeek = commonData.currentWeek;
        const winner = commonData.currentWeekWinner;
        const prize = commonData.currentWeekPrize;
        
        console.log(`\n📊 Week ${currentWeek} Summary:`);
        console.log(`🏆 Winner: ${winner}`);
        console.log(`💰 Prize: ${ethers.formatUnits(prize, 6)} USDC`);
        
        // Step 6: Distribute prize (if there's a winner)
        if (winner !== ethers.ZeroAddress && prize > 0) {
            console.log("\n5️⃣ Distributing prizes...");
            const tx3 = await contract.distributePrize();
            await tx3.wait();
            console.log("✅ Prizes distributed");
            
            // Step 7: Announce winner (optional)
            console.log("\n6️⃣ Announcing winner...");
            try {
                await announceWinner(winner, prize, currentWeek);
            } catch (error) {
                console.log("⚠️ Winner announcement failed:", error.message);
            }
        }
        
        // Step 8: Start new week
        console.log("\n7️⃣ Starting new week...");
        const tx4 = await contract.startNewWeek();
        await tx4.wait();
        const newWeek = currentWeek + 1n;
        console.log(`✅ Started week ${newWeek}`);
        
        // Step 9: Set new character
        console.log("\n8️⃣ Setting new character...");
        const character = CHARACTERS[(Number(newWeek) - 1) % CHARACTERS.length];
        
        const tx5 = await contract.setWeeklyCharacter(
            character.name,
            character.task,
            character.traits,
            character.values,
            character.count
        );
        await tx5.wait();
        
        console.log(`✅ Set character: ${character.name}`);
        console.log(`📝 Task: ${character.task}`);
        console.log(`🎭 Traits: ${character.traits.slice(0, character.count).join(', ')}`);
        
        // Step 10: Announce new character
        console.log("\n9️⃣ Announcing new character...");
        try {
            await announceNewCharacter(character, newWeek);
        } catch (error) {
            console.log("⚠️ Character announcement failed:", error.message);
        }
        
        console.log("\n🎉 Weekly cycle completed successfully!");
        console.log(`🚀 Week ${newWeek} is now active with ${character.name}`);
        
    } catch (error) {
        console.error("💥 Weekly cycle failed:", error);
        throw error;
    }
}

// Announce winner on Farcaster
async function announceWinner(winnerAddress, prize, week) {
    try {
        // Try to get winner's Farcaster username
        let username = "Anonymous";
        try {
            const userData = await neynar.fetchBulkUsersByEthOrSolAddress({ 
                addresses: [winnerAddress] 
            });
            username = userData[winnerAddress]?.[0]?.username || winnerAddress.slice(0, 8) + "...";
        } catch (e) {
            username = winnerAddress.slice(0, 8) + "...";
        }
        
        const announcement = `🎉 Week ${week} Winner Announced!

🏆 ${username.startsWith('0x') ? username : '@' + username} wins ${ethers.formatUnits(prize, 6)} USDC!

🤖 Outstanding conversation quality and creativity!
💬 Thank you to all participants this week!

🔄 Week ${Number(week) + 1} starts now with a brand new character... 

#LoveallBot #Web3Social #Farcaster`;

        await neynar.publishCast({
            signerUuid: process.env.NEYNAR_SIGNER_UUID,
            text: announcement
        });
        
        console.log("📢 Winner announced on Farcaster");
    } catch (error) {
        console.log("⚠️ Farcaster announcement failed:", error.message);
    }
}

// Announce new character on Farcaster  
async function announceNewCharacter(character, week) {
    try {
        const traits = character.traits.slice(0, character.count)
            .map((trait, i) => `${trait}: ${character.values[i]}/10`)
            .join('\n');
            
        const announcement = `🎭 Week ${week} Character Reveal!

Meet ${character.name}! 
${character.task}

🎯 Personality Traits:
${traits}

💬 Ready to chat? Send me a message and experience ${character.name}'s unique personality!

Each conversation costs 0.01 USDC. Winner takes 80% of the weekly pool! 💰

#LoveallBot #AICharacter #Web3Gaming`;

        await neynar.publishCast({
            signerUuid: process.env.NEYNAR_SIGNER_UUID,
            text: announcement
        });
        
        console.log("📢 New character announced on Farcaster");
    } catch (error) {
        console.log("⚠️ Character announcement failed:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("💥 Script failed:", error);
        process.exit(1);
    });
