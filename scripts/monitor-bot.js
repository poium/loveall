import { ethers } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Contract configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const CONTRACT_ABI = require('../src/abi.json');

// RPC configuration
const RPC_URL = 'https://mainnet.base.org';

async function monitorRealTime() {
    console.log('👀 Starting real-time monitoring...');
    console.log(`Contract: ${CONTRACT_ADDRESS}`);
    console.log(`Listening for new conversations...\n`);
    
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    // Get initial stats
    let lastStats = await getStats(contract);
    console.log('📊 Initial Stats:');
    console.log(`Participants: ${lastStats.participants}`);
    console.log(`Participations: ${lastStats.participations}`);
    console.log(`Evaluated: ${lastStats.evaluated}`);
    console.log('---\n');
    
    // Monitor every 5 seconds
    setInterval(async () => {
        try {
            const currentStats = await getStats(contract);
            
            // Check for changes
            if (currentStats.participants !== lastStats.participants ||
                currentStats.participations !== lastStats.participations ||
                currentStats.evaluated !== lastStats.evaluated) {
                
                console.log(`🎉 NEW ACTIVITY DETECTED! [${new Date().toLocaleTimeString()}]`);
                console.log(`Participants: ${lastStats.participants} → ${currentStats.participants}`);
                console.log(`Participations: ${lastStats.participations} → ${currentStats.participations}`);
                console.log(`Evaluated: ${lastStats.evaluated} → ${currentStats.evaluated}`);
                
                if (currentStats.participations > lastStats.participations) {
                    console.log('💬 New conversation recorded!');
                    await showLatestConversations(contract);
                }
                
                console.log('---\n');
                lastStats = currentStats;
            } else {
                process.stdout.write('.');
            }
        } catch (error) {
            console.error('❌ Monitoring error:', error.message);
        }
    }, 5000);
}

async function getStats(contract) {
    const commonData = await contract.getCommonData();
    const participations = await contract.getCurrentWeekParticipations();
    const evaluated = participations.filter(p => p.isEvaluated).length;
    
    return {
        participants: Number(commonData.currentWeekParticipantsCount),
        participations: participations.length,
        evaluated
    };
}

async function showLatestConversations(contract) {
    try {
        const participations = await contract.getCurrentWeekParticipations();
        const latest = participations.slice(-3); // Show last 3
        
        console.log('📝 Latest Conversations:');
        latest.forEach((p, index) => {
            const timestamp = new Date(Number(p.timestamp) * 1000).toLocaleTimeString();
            console.log(`${index + 1}. User: ${p.user.slice(0, 6)}...${p.user.slice(-4)}`);
            console.log(`   FID: ${p.fid}`);
            console.log(`   Time: ${timestamp}`);
            console.log(`   Cost: ${ethers.formatUnits(p.usdcAmount, 6)} USDC`);
            console.log(`   Evaluated: ${p.isEvaluated ? '✅' : '❌'}`);
        });
    } catch (error) {
        console.error('Error getting latest conversations:', error.message);
    }
}

// Start monitoring
console.log('🚀 Real-Time Bot Monitor Started!');
console.log('💡 Go mention @loveall on Farcaster now!');
console.log('⏹️  Press Ctrl+C to stop monitoring\n');

monitorRealTime();
