require('dotenv').config();
const { ethers } = require('ethers');

// Contract configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const CONTRACT_ABI = require('../src/abi.json');

// RPC configuration
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error('❌ PRIVATE_KEY not found in environment variables');
    process.exit(1);
}

// Initialize provider and contract
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

async function getUnevaluatedConversations() {
    try {
        console.log('📋 Getting unevaluated conversations...');
        const [conversationIds, users, fids] = await contract.getUnevaluatedConversationsForAI();
        
        console.log(`\n📊 Found ${conversationIds.length} unevaluated conversations:`);
        
        for (let i = 0; i < conversationIds.length; i++) {
            console.log(`\n${i + 1}. Conversation ID: ${conversationIds[i]}`);
            console.log(`   User: ${users[i]}`);
            console.log(`   FID: ${fids[i]}`);
        }
        
        return { conversationIds, users, fids };
    } catch (error) {
        console.error('❌ Error getting unevaluated conversations:', error.message);
        return null;
    }
}

async function getConversation(conversationId) {
    try {
        console.log(`📋 Getting conversation: ${conversationId}`);
        const messages = await contract.getConversation(conversationId);
        
        console.log(`\n💬 Conversation has ${messages.length} messages:`);
        
        messages.forEach((message, index) => {
            const timestamp = new Date(Number(message.timestamp) * 1000).toLocaleString();
            const role = message.isBot ? 'Bot' : 'User';
            console.log(`\n${index + 1}. [${role}] ${timestamp}`);
            console.log(`   Hash: ${message.castHash}`);
            console.log(`   Content: ${message.content}`);
        });
        
        return messages;
    } catch (error) {
        console.error('❌ Error getting conversation:', error.message);
        return null;
    }
}

async function getUserConversations(userAddress) {
    try {
        console.log(`📋 Getting conversations for user: ${userAddress}`);
        const conversations = await contract.getUserConversations(userAddress);
        
        console.log(`\n👤 User has ${conversations.length} conversations:`);
        
        conversations.forEach((conv, index) => {
            const startTime = new Date(Number(conv.startTime) * 1000).toLocaleString();
            const lastActivity = new Date(Number(conv.lastActivity) * 1000).toLocaleString();
            const costInUsdc = ethers.formatUnits(conv.totalCost, 6);
            
            console.log(`\n${index + 1}. Conversation ID: ${conv.conversationId}`);
            console.log(`   Messages: ${conv.messageCount}`);
            console.log(`   Total Cost: ${costInUsdc} USDC`);
            console.log(`   AI Score: ${conv.aiScore}/50 ${conv.isEvaluated ? '✅' : '❌'}`);
            console.log(`   Started: ${startTime}`);
            console.log(`   Last Activity: ${lastActivity}`);
        });
        
        return conversations;
    } catch (error) {
        console.error('❌ Error getting user conversations:', error.message);
        return null;
    }
}

async function recordTopScores(topScoresData) {
    try {
        console.log('📊 Recording top AI scores...');
        
        const { topUsers, topConversationIds, topAiScores, totalEvaluated } = topScoresData;
        
        // Validate arrays
        if (topUsers.length !== topConversationIds.length || 
            topConversationIds.length !== topAiScores.length) {
            console.error('❌ Array lengths must match');
            return;
        }
        
        if (topUsers.length > 10) {
            console.error('❌ Maximum 10 top scores allowed');
            return;
        }
        
        // Validate scores
        for (let score of topAiScores) {
            if (score < 0 || score > 50) {
                console.error('❌ AI scores must be between 0 and 50');
                return;
            }
        }
        
        console.log(`Recording ${topUsers.length} top scores from ${totalEvaluated} total evaluations`);
        
        // Estimate gas
        const gasEstimate = await contract.recordTopAIScores.estimateGas(
            topUsers,
            topConversationIds,
            topAiScores,
            totalEvaluated
        );
        
        console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
        
        // Send transaction
        const tx = await contract.recordTopAIScores(
            topUsers,
            topConversationIds,
            topAiScores,
            totalEvaluated,
            { gasLimit: gasEstimate.mul(120).div(100) } // Add 20% buffer
        );
        
        console.log(`⏳ Transaction sent: ${tx.hash}`);
        console.log('Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log(`✅ Top scores recorded successfully! Block: ${receipt.blockNumber}`);
        
    } catch (error) {
        console.error('❌ Error recording top scores:', error.message);
    }
}

async function selectWinner() {
    try {
        console.log('🏆 Selecting winner by AI score...');
        
        // Estimate gas
        const gasEstimate = await contract.selectWinnerByAIScore.estimateGas();
        console.log(`⛽ Estimated gas: ${gasEstimate.toString()}`);
        
        // Send transaction
        const tx = await contract.selectWinnerByAIScore({
            gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
        });
        
        console.log(`⏳ Transaction sent: ${tx.hash}`);
        console.log('Waiting for confirmation...');
        
        const receipt = await tx.wait();
        console.log(`✅ Winner selected successfully! Block: ${receipt.blockNumber}`);
        
        // Get updated common data to show winner
        const commonData = await contract.getCommonData();
        if (commonData.currentWeekWinner !== ethers.ZeroAddress) {
            const prizeInUsdc = ethers.formatUnits(commonData.currentWeekPrize, 6);
            console.log(`🎉 Winner: ${commonData.currentWeekWinner}`);
            console.log(`💰 Prize: ${prizeInUsdc} USDC`);
        }
        
    } catch (error) {
        console.error('❌ Error selecting winner:', error.message);
        
        if (error.message.includes('NoEvaluatedConversations')) {
            console.log('💡 No evaluated conversations found. Run AI evaluation first.');
        }
    }
}

async function getCurrentWeekStats() {
    try {
        console.log('📊 Getting current week statistics...');
        
        const commonData = await contract.getCommonData();
        const participations = await contract.getCurrentWeekParticipations();
        
        const currentWeekPrizeUsdc = ethers.formatUnits(commonData.currentWeekPrizePool, 6);
        const totalPrizeUsdc = ethers.formatUnits(commonData.totalPrizePool, 6);
        const castCostUsdc = ethers.formatUnits(commonData.castCost, 6);
        
        console.log(`\n📈 Week ${commonData.currentWeek} Statistics:`);
        console.log(`Current Prize Pool: ${currentWeekPrizeUsdc} USDC`);
        console.log(`Total Prize Pool: ${totalPrizeUsdc} USDC`);
        console.log(`Cast Cost: ${castCostUsdc} USDC`);
        console.log(`Participants: ${commonData.currentWeekParticipantsCount}`);
        console.log(`Total Participations: ${participations.length}`);
        
        // Count evaluated vs unevaluated
        const evaluated = participations.filter(p => p.isEvaluated).length;
        const unevaluated = participations.length - evaluated;
        
        console.log(`Evaluated: ${evaluated}`);
        console.log(`Unevaluated: ${unevaluated}`);
        
        if (commonData.currentWeekWinner !== ethers.ZeroAddress) {
            const prizeUsdc = ethers.formatUnits(commonData.currentWeekPrize, 6);
            console.log(`\n🏆 Winner Selected: ${commonData.currentWeekWinner}`);
            console.log(`💰 Prize Amount: ${prizeUsdc} USDC`);
        }
        
        // Character info
        if (commonData.characterIsSet) {
            console.log(`\n🎭 Character: ${commonData.characterName}`);
            console.log(`Task: ${commonData.characterTask}`);
        } else {
            console.log('\n❌ No character set for this week');
        }
        
    } catch (error) {
        console.error('❌ Error getting current week stats:', error.message);
    }
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log(`
💬 Conversation Management Script

Usage:
  node manage-conversations.js unevaluated              # Get unevaluated conversations
  node manage-conversations.js conversation <id>       # Get specific conversation
  node manage-conversations.js user <address>          # Get user conversations
  node manage-conversations.js stats                   # Get current week stats
  node manage-conversations.js winner                  # Select winner by AI score
  node manage-conversations.js top-scores <file>       # Record top scores from JSON file

Examples:
  node manage-conversations.js conversation 0x123...
  node manage-conversations.js user 0xabc...
  node manage-conversations.js top-scores ./top-scores.json

Top scores JSON format:
{
  "topUsers": ["0xuser1...", "0xuser2..."],
  "topConversationIds": ["0xconv1...", "0xconv2..."],
  "topAiScores": [48, 45, 42],
  "totalEvaluated": 156
}
        `);
        return;
    }

    const command = args[0];

    switch (command) {
        case 'unevaluated':
            await getUnevaluatedConversations();
            break;
            
        case 'conversation':
            if (args.length < 2) {
                console.error('❌ Please specify a conversation ID');
                return;
            }
            await getConversation(args[1]);
            break;
            
        case 'user':
            if (args.length < 2) {
                console.error('❌ Please specify a user address');
                return;
            }
            await getUserConversations(args[1]);
            break;
            
        case 'stats':
            await getCurrentWeekStats();
            break;
            
        case 'winner':
            await selectWinner();
            break;
            
        case 'top-scores':
            if (args.length < 2) {
                console.error('❌ Please specify a JSON file path');
                return;
            }
            try {
                const fs = require('fs');
                const topScoresData = JSON.parse(fs.readFileSync(args[1], 'utf8'));
                await recordTopScores(topScoresData);
            } catch (error) {
                console.error('❌ Error reading JSON file:', error.message);
            }
            break;
            
        default:
            console.error(`❌ Unknown command: ${command}`);
            break;
    }
}

// Run the script
main().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
});
