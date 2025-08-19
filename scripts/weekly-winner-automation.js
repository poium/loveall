import 'dotenv/config';
import { ethers } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const CONTRACT_ABI = require('../src/abi.json');
const RPC_URL = 'https://mainnet.base.org';

async function automateWeeklyWinner() {
    try {
        console.log('🏆 Weekly Winner Automation Started');
        
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
        
        // Check if week has ended
        const commonData = await contract.getCommonData();
        const currentTime = Math.floor(Date.now() / 1000);
        const weekEndTime = Number(commonData.weekEndTime);
        
        console.log(`Current time: ${currentTime}`);
        console.log(`Week ends: ${weekEndTime}`);
        console.log(`Week ended: ${currentTime > weekEndTime}`);
        
        if (currentTime < weekEndTime) {
            console.log('⏰ Week not ended yet. Come back later!');
            return;
        }
        
        // Check if winner already selected
        if (commonData.currentWeekWinner !== '0x0000000000000000000000000000000000000000') {
            console.log('🎯 Winner already selected:', commonData.currentWeekWinner);
            
            // Distribute prize if not done yet
            if (Number(commonData.currentWeekPrize) > 0) {
                console.log('💰 Distributing prize...');
                const tx = await contract.distributePrize();
                await tx.wait();
                console.log('✅ Prize distributed!');
            }
            
            // Start new week
            console.log('🔄 Starting new week...');
            const tx2 = await contract.startNewWeek();
            await tx2.wait();
            console.log('✅ New week started!');
            
        } else {
            console.log('🤖 Selecting winner by AI score...');
            const tx = await contract.selectWinnerByAIScore();
            await tx.wait();
            console.log('✅ Winner selected!');
            
            // Get winner info
            const updatedData = await contract.getCommonData();
            console.log('🏆 Winner:', updatedData.currentWeekWinner);
            console.log('💰 Prize:', ethers.formatUnits(updatedData.currentWeekPrize, 6), 'USDC');
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Run immediately
automateWeeklyWinner();
