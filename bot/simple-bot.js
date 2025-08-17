require('dotenv').config();
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

// Contract ABI
const contractABI = require('../artifacts/contracts/LoveallPrizePool.sol/LoveallPrizePool.json').abi;

class SimpleLoveallBot {
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
        this.contractAddress = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';
        this.provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL);
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(this.contractAddress, contractABI, this.wallet);
        
        console.log('🤖 Simple Loveall Bot initialized!');
        console.log(`Contract: ${this.contractAddress}`);
        console.log(`Bot Wallet: ${this.wallet.address}`);
    }

    // Get user data from contract
    async getUserData(userAddress) {
        try {
            const userData = await this.contract.getUserData(userAddress);
            return {
                balance: userData.balance,
                hasSufficientBalance: userData.hasSufficientBalance,
                hasParticipatedThisWeek: userData.hasParticipatedThisWeek,
                participationsCount: userData.participationsCount
            };
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    }

    // Get common data (prize pool, etc.)
    async getCommonData() {
        try {
            const commonData = await this.contract.getCommonData();
            return {
                totalPrizePool: commonData.totalPrizePool,
                currentWeekPrizePool: commonData.currentWeekPrizePool,
                currentWeek: commonData.currentWeek,
                currentWeekParticipantsCount: commonData.currentWeekParticipantsCount,
                weekEndTime: commonData.weekEndTime
            };
        } catch (error) {
            console.error('Error getting common data:', error);
            return null;
        }
    }

    // Record user participation in cast
    async recordParticipation(userAddress, castHash) {
        try {
            const tx = await this.contract.participateInCast(userAddress, castHash);
            await tx.wait();
            console.log(`✅ Participation recorded for ${userAddress}`);
            return true;
        } catch (error) {
            console.error('Error recording participation:', error);
            return false;
        }
    }

    // Generate flirty response
    generateFlirtyResponse() {
        const responses = [
            "Hey there, cutie! 😘 Your flirty cast just made my day! 💕",
            "Wow, that's some serious charm! 😍 You've got the gift of gab! ✨",
            "Ooh la la! 🥰 That was smooth! You're definitely a keeper! 💖",
            "My circuits are tingling! 🤖💕 That was absolutely delightful! 🌟",
            "You've got that special something! 😊 Your wit is irresistible! 💫",
            "Be still my beating heart! 💓 That was pure poetry! 🎭",
            "You're making me blush! 😳 Such a charmer! 🌹",
            "That's the kind of energy I love! 💪✨ You're on fire! 🔥",
            "My digital heart skipped a beat! 💔➡️💖 That was amazing! 🎉",
            "You've got the magic touch! ✨✨✨ Simply enchanting! 🧙‍♀️"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Reply to a cast
    async replyToCast(parentHash, text) {
        try {
            await this.neynar.publishCast({
                signer_uuid: process.env.NEYNAR_SIGNER_UUID,
                text: text,
                parent: parentHash
            });
            console.log(`💬 Replied: ${text}`);
        } catch (error) {
            console.error('Error replying to cast:', error);
        }
    }

    // Manual participation function (for testing)
    async manualParticipation(userAddress, castHash) {
        console.log(`🎯 Processing manual participation for ${userAddress}`);
        
        // Get user data
        const userData = await this.getUserData(userAddress);
        if (!userData) {
            console.log('❌ Could not get user data');
            return false;
        }

        console.log(`💰 User balance: ${ethers.formatUnits(userData.balance, 6)} USDC`);
        console.log(`✅ Has sufficient balance: ${userData.hasSufficientBalance}`);
        console.log(`📅 Has participated this week: ${userData.hasParticipatedThisWeek}`);

        if (!userData.hasSufficientBalance) {
            console.log('💸 User has insufficient balance');
            return false;
        }

        if (userData.hasParticipatedThisWeek) {
            console.log('⏰ User already participated this week');
            return false;
        }

        // Record participation
        const success = await this.recordParticipation(userAddress, castHash);
        if (success) {
            console.log('✅ Participation recorded successfully');
            return true;
        } else {
            console.log('❌ Failed to record participation');
            return false;
        }
    }

    // Display current status
    async showStatus() {
        console.log('\n📊 Current Bot Status:');
        
        const commonData = await this.getCommonData();
        if (commonData) {
            console.log(`   Current Week: ${commonData.currentWeek}`);
            console.log(`   Total Prize Pool: ${ethers.formatUnits(commonData.totalPrizePool, 6)} USDC`);
            console.log(`   Current Week Pool: ${ethers.formatUnits(commonData.currentWeekPrizePool, 6)} USDC`);
            console.log(`   Participants This Week: ${commonData.currentWeekParticipantsCount}`);
            console.log(`   Week Ends: ${new Date(Number(commonData.weekEndTime) * 1000).toLocaleString()}`);
        }

        const userData = await this.getUserData(this.wallet.address);
        if (userData) {
            console.log(`\n🤖 Bot Wallet Status:`);
            console.log(`   Balance: ${ethers.formatUnits(userData.balance, 6)} USDC`);
            console.log(`   Has participated this week: ${userData.hasParticipatedThisWeek}`);
        }
    }

    // Start the bot
    async start() {
        console.log('🚀 Starting Simple Loveall Bot...');
        
        // Show initial status
        await this.showStatus();
        
        console.log('\n✅ Bot is ready!');
        console.log('📝 Available commands:');
        console.log('   - await bot.showStatus()');
        console.log('   - await bot.manualParticipation(address, castHash)');
        console.log('   - await bot.replyToCast(castHash, message)');
        
        // Keep the process alive
        process.on('SIGINT', () => {
            console.log('\n👋 Bot stopped gracefully');
            process.exit(0);
        });
    }
}

// Create and start the bot
const bot = new SimpleLoveallBot();

// Export for interactive use
module.exports = bot;

// Start if called directly
if (require.main === module) {
    bot.start().catch(console.error);
}
