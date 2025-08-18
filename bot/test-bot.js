require('dotenv').config();
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

// Contract ABI
const contractABI = require('../artifacts/contracts/LoveallPrizePool.sol/LoveallPrizePool.json').abi;

class BotTester {
    constructor() {
        // Initialize Neynar client
        const config = new Configuration({
            apiKey: process.env.NEYNAR_API_KEY,
            baseOptions: {
                headers: {
                    "x-neynar-experimental": true,
                },
            },
        });
        this.neynar = new NeynarAPIClient(config);
        
        // Initialize contract
        this.contractAddress = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(this.contractAddress, contractABI, this.wallet);
        
        console.log('🧪 Bot Tester initialized!');
    }

    // Test getting user data
    async testGetUserData() {
        console.log('\n1️⃣ Testing getUserData...');
        try {
            const userData = await this.contract.getUserData(this.wallet.address);
            console.log('   ✅ User data retrieved:');
            console.log(`      Balance: ${ethers.formatUnits(userData.balance, 6)} USDC`);
            console.log(`      Has sufficient balance: ${userData.hasSufficientBalance}`);
            console.log(`      Has participated this week: ${userData.hasParticipatedThisWeek}`);
            console.log(`      Participations count: ${userData.participationsCount}`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    // Test getting common data
    async testGetCommonData() {
        console.log('\n2️⃣ Testing getCommonData...');
        try {
            const commonData = await this.contract.getCommonData();
            console.log('   ✅ Common data retrieved:');
            console.log(`      Total prize pool: ${ethers.formatUnits(commonData.totalPrizePool, 6)} USDC`);
            console.log(`      Current week prize pool: ${ethers.formatUnits(commonData.currentWeekPrizePool, 6)} USDC`);
            console.log(`      Current week: ${commonData.currentWeek}`);
            console.log(`      Participants this week: ${commonData.currentWeekParticipantsCount}`);
            console.log(`      Week end time: ${new Date(Number(commonData.weekEndTime) * 1000).toLocaleString()}`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    // Test Neynar API
    async testNeynarAPI() {
        console.log('\n3️⃣ Testing Neynar API...');
        try {
            // Test getting user info
            const userInfo = await this.neynar.lookupUserByFid(parseInt(process.env.NEYNAR_CLIENT_ID));
            console.log('   ✅ User info retrieved:');
            console.log(`      Username: ${userInfo.user.username}`);
            console.log(`      Display name: ${userInfo.user.displayName}`);
            console.log(`      FID: ${userInfo.user.fid}`);
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    // Test response generation
    testResponseGeneration() {
        console.log('\n4️⃣ Testing response generation...');
        
        const responses = [
            "Hey there, cutie! 😘 Your flirty cast just made my day! 💕",
            "Wow, that's some serious charm! 😍 You've got the gift of gab! ✨",
            "Ooh la la! 🥰 That was smooth! You're definitely a keeper! 💖",
            "My circuits are tingling! 🤖💕 That was absolutely delightful! 🌟",
            "You've got that special something! 😊 Your wit is irresistible! 💫"
        ];
        
        console.log('   ✅ Sample responses:');
        for (let i = 0; i < 3; i++) {
            const response = responses[Math.floor(Math.random() * responses.length)];
            console.log(`      ${i + 1}. ${response}`);
        }
    }

    // Run all tests
    async runTests() {
        console.log('🚀 Starting bot functionality tests...\n');
        
        await this.testGetUserData();
        await this.testGetCommonData();
        await this.testNeynarAPI();
        this.testResponseGeneration();
        
        console.log('\n🎉 All tests completed!');
    }
}

// Run tests
const tester = new BotTester();
tester.runTests().catch(console.error);
