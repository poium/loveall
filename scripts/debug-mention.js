import { ethers } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const CONTRACT_ABI = require('../src/abi.json');
const RPC_URL = 'https://mainnet.base.org';

async function debugUserBalance(userAddress) {
    try {
        console.log(`🔍 Debugging user: ${userAddress}`);
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        const userData = await contract.getUserData(userAddress);
        const commonData = await contract.getCommonData();
        
        console.log('\n📊 User Status:');
        console.log(`Balance: ${ethers.formatUnits(userData.balance, 6)} USDC`);
        console.log(`Required: ${ethers.formatUnits(commonData.castCost, 6)} USDC`);
        console.log(`Sufficient Balance: ${userData.hasSufficientBalance ? '✅' : '❌'}`);
        console.log(`Participated This Week: ${userData.hasParticipatedThisWeek ? '✅' : '❌'}`);
        console.log(`Conversations: ${userData.conversationCount}`);
        console.log(`Remaining: ${userData.remainingConversations}`);
        
        if (!userData.hasSufficientBalance) {
            const needed = ethers.formatUnits(commonData.castCost - userData.balance, 6);
            console.log(`\n💡 Need to add ${needed} more USDC to participate`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

const userAddress = process.argv[2];
if (!userAddress) {
    console.log('Usage: node debug-mention.js <user-address>');
    console.log('Example: node debug-mention.js 0x1234...');
} else {
    debugUserBalance(userAddress);
}
