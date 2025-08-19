import { ethers } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Contract configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const CONTRACT_ABI = require('../src/abi.json');

// RPC configuration (read-only, no private key needed)
const RPC_URL = 'https://mainnet.base.org';

async function testContract() {
    try {
        console.log('🔍 Testing contract connection...');
        console.log(`Contract: ${CONTRACT_ADDRESS}`);
        console.log(`RPC: ${RPC_URL}\n`);
        
        // Initialize provider (read-only)
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        console.log('📊 Getting contract data...\n');
        
        // Test basic contract reads
        const [commonData, owner, currentCharacter] = await Promise.all([
            contract.getCommonData(),
            contract.owner(),
            contract.getCurrentCharacter()
        ]);
        
        console.log('✅ Contract Connection Success!\n');
        
        console.log('📋 Basic Info:');
        console.log(`Owner: ${owner}`);
        console.log(`Current Week: ${commonData.currentWeek}`);
        console.log(`Cast Cost: ${ethers.formatUnits(commonData.castCost, 6)} USDC`);
        console.log(`Current Prize Pool: ${ethers.formatUnits(commonData.currentWeekPrizePool, 6)} USDC`);
        console.log(`Total Prize Pool: ${ethers.formatUnits(commonData.totalPrizePool, 6)} USDC`);
        console.log(`Participants: ${commonData.currentWeekParticipantsCount}`);
        
        console.log('\n🎭 Current Character:');
        if (currentCharacter.isSet) {
            console.log(`Name: ${currentCharacter.name}`);
            console.log(`Task: ${currentCharacter.task}`);
            console.log(`Trait Count: ${currentCharacter.traitCount}`);
            
            console.log('Traits:');
            for (let i = 0; i < currentCharacter.traitCount; i++) {
                console.log(`  ${currentCharacter.traitNames[i]}: ${currentCharacter.traitValues[i]}/10`);
            }
        } else {
            console.log('❌ No character set for current week');
        }
        
        // Test getting participations
        console.log('\n📊 Participation Data:');
        try {
            const participations = await contract.getCurrentWeekParticipations();
            console.log(`Total Participations: ${participations.length}`);
            
            const evaluated = participations.filter(p => p.isEvaluated).length;
            const unevaluated = participations.length - evaluated;
            console.log(`Evaluated: ${evaluated}`);
            console.log(`Unevaluated: ${unevaluated}`);
            
            if (participations.length > 0) {
                console.log('\nRecent Participations:');
                participations.slice(0, 3).forEach((p, index) => {
                    const timestamp = new Date(Number(p.timestamp) * 1000).toLocaleString();
                    console.log(`${index + 1}. User: ${p.user.slice(0, 6)}...${p.user.slice(-4)}`);
                    console.log(`   FID: ${p.fid}`);
                    console.log(`   Score: ${p.aiScore}/50 ${p.isEvaluated ? '✅' : '❌'}`);
                    console.log(`   Time: ${timestamp}`);
                });
            }
        } catch (error) {
            console.log(`Error getting participations: ${error.message}`);
        }
        
        console.log('\n🎉 Contract test completed successfully!');
        
    } catch (error) {
        console.error('❌ Contract test failed:', error.message);
        
        if (error.message.includes('could not detect network')) {
            console.log('💡 Check your internet connection and RPC endpoint');
        } else if (error.message.includes('call revert')) {
            console.log('💡 Contract might not be deployed or ABI mismatch');
        }
    }
}

// Run the test
testContract();
