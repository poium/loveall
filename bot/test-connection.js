require('dotenv').config();
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

async function testConnections() {
    console.log('🧪 Testing bot connections...\n');

    // Test 1: Environment variables
    console.log('1️⃣ Testing environment variables...');
    const requiredVars = [
        'NEYNAR_API_KEY',
        'NEYNAR_CLIENT_ID', 
        'NEYNAR_SIGNER_UUID',
        'PRIVATE_KEY',
        'BASE_RPC_URL'
    ];
    
    for (const varName of requiredVars) {
        if (process.env[varName]) {
            console.log(`   ✅ ${varName}: ${process.env[varName].substring(0, 10)}...`);
        } else {
            console.log(`   ❌ ${varName}: Missing`);
        }
    }

    // Test 2: Neynar API
    console.log('\n2️⃣ Testing Neynar API...');
    try {
        const config = new Configuration({
            apiKey: process.env.NEYNAR_API_KEY,
            baseOptions: {
                headers: {
                    "x-neynar-experimental": true,
                },
            },
        });
        const neynar = new NeynarAPIClient(config);
        console.log('   ✅ Neynar client created successfully');
    } catch (error) {
        console.log(`   ❌ Neynar API error: ${error.message}`);
    }

    // Test 3: Contract connection
    console.log('\n3️⃣ Testing contract connection...');
    try {
        const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        const network = await provider.getNetwork();
        console.log(`   ✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
        
        // Test contract call
        const contractABI = require('../artifacts/contracts/LoveallPrizePool.sol/LoveallPrizePool.json').abi;
        const contract = new ethers.Contract('0xE05efF71D71850c0FEc89660DC6588787312e453', contractABI, provider);
        
        const commonData = await contract.getCommonData();
        console.log(`   ✅ Contract call successful - Current week: ${commonData.currentWeek}`);
        
    } catch (error) {
        console.log(`   ❌ Contract connection error: ${error.message}`);
    }

    console.log('\n🎉 Connection test completed!');
}

testConnections().catch(console.error);
