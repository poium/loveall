require('dotenv').config();
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

// Contract ABI
const contractABI = require('../src/abi.json');

class EnhancedLoveallBot {
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
        
        // Bot state
        this.lastProcessedTimestamp = 0;
        this.processedCasts = new Set();
        this.botUsername = 'loveall';
        this.isRunning = false;
        
        console.log('🤖 Enhanced Loveall Bot initialized!');
        console.log(`Contract: ${this.contractAddress}`);
        console.log(`Bot Wallet: ${this.wallet.address}`);
        console.log(`Bot FID: ${process.env.NEYNAR_CLIENT_ID}`);
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

    // Generate insufficient balance response
    generateInsufficientBalanceResponse() {
        const responses = [
            "Oops! 💸 Looks like you need to top up your balance first! Visit our website to add some USDC! 💰",
            "Not enough balance, sweetie! 😅 Time to refill your love tank! 💕 Visit our site to top up!",
            "Your charm is infinite, but your balance isn't! 😂 Top up with some USDC to keep flirting! 💸",
            "Love is free, but flirting costs 1 cent! 💰 Please top up your balance to continue! 💕",
            "Your wit is priceless, but participation costs 1 cent! 😊 Please add some USDC to your balance! 💸"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Generate already participated response
    generateAlreadyParticipatedResponse() {
        const responses = [
            "You've already charmed me this week! 😊 Come back next week for another chance to win! 💕",
            "One cast per week, sweetie! 💫 You've already participated this week!",
            "Patience is a virtue! 😌 You've already cast your spell this week! ✨",
            "Save some charm for next week! 😘 You've already participated! 💕",
            "One flirty cast per week keeps the prize pool growing! 💰 Come back next week! 🌟"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Check if cast mentions the bot
    isMentioningBot(castText) {
        const mentions = [
            '@loveall',
            '@Loveall',
            '@LOVEALL',
            'loveall',
            'Loveall',
            'LOVEALL'
        ];
        return mentions.some(mention => castText.includes(mention));
    }

    // Get user's verified address
    async getUserVerifiedAddress(userFid) {
        try {
            // Try to get user info by FID
            const userInfo = await this.neynar.lookupUserByCustodyAddress(userFid);
            if (userInfo && userInfo.user && userInfo.user.verified_accounts) {
                return userInfo.user.verified_accounts[0]?.address;
            }
        } catch (error) {
            console.log(`Could not get verified address for FID ${userFid}:`, error.message);
        }
        return null;
    }

    // Process a single cast
    async processCast(cast) {
        try {
            // Skip if already processed
            if (this.processedCasts.has(cast.hash)) {
                return;
            }

            // Check if cast mentions the bot
            if (!this.isMentioningBot(cast.text)) {
                return;
            }

            console.log(`📨 Processing mention from ${cast.author.username} (FID: ${cast.author.fid})`);
            console.log(`📝 Cast: "${cast.text}"`);

            // Get user's verified address
            const userAddress = await this.getUserVerifiedAddress(cast.author.fid);
            if (!userAddress) {
                console.log('⚠️ User has no verified account, skipping...');
                this.processedCasts.add(cast.hash);
                return;
            }

            // Get user data from contract
            const userData = await this.getUserData(userAddress);
            if (!userData) {
                console.log('❌ Could not get user data, skipping...');
                this.processedCasts.add(cast.hash);
                return;
            }

            // Check if user can participate
            if (!userData.hasSufficientBalance) {
                const response = this.generateInsufficientBalanceResponse();
                await this.replyToCast(cast.hash, response);
                console.log('💸 User has insufficient balance');
            } else if (userData.hasParticipatedThisWeek) {
                const response = this.generateAlreadyParticipatedResponse();
                await this.replyToCast(cast.hash, response);
                console.log('⏰ User already participated this week');
            } else {
                // Record participation
                const success = await this.recordParticipation(userAddress, cast.hash);
                if (success) {
                    const response = this.generateFlirtyResponse();
                    await this.replyToCast(cast.hash, response);
                    console.log('✅ Participation recorded successfully');
                } else {
                    await this.replyToCast(cast.hash, "Oops! Something went wrong! 😅 Please try again!");
                    console.log('❌ Failed to record participation');
                }
            }

            // Mark as processed
            this.processedCasts.add(cast.hash);
            this.lastProcessedTimestamp = Math.max(this.lastProcessedTimestamp, cast.timestamp);

        } catch (error) {
            console.error('Error processing cast:', error);
        }
    }

    // Monitor for mentions
    async monitorMentions() {
        try {
            console.log('🔍 Checking for new mentions...');
            
            // For now, we'll use a simple approach - monitor recent casts
            // In production, you'd want to use webhooks or a more efficient method
            const recentCasts = await this.getRecentCasts();
            
            for (const cast of recentCasts) {
                await this.processCast(cast);
            }

        } catch (error) {
            console.error('Error monitoring mentions:', error);
        }
    }

    // Get recent casts (placeholder - implement based on available API)
    async getRecentCasts() {
        try {
            // This is a placeholder - you'll need to implement based on available Neynar API methods
            // For now, return empty array
            return [];
        } catch (error) {
            console.error('Error getting recent casts:', error);
            return [];
        }
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

        console.log(`   Processed Casts: ${this.processedCasts.size}`);
        console.log(`   Last Processed: ${new Date(this.lastProcessedTimestamp * 1000).toLocaleString()}`);
        console.log(`   Bot Running: ${this.isRunning}`);
    }

    // Start the bot
    async start() {
        console.log('🚀 Starting Enhanced Loveall Bot...');
        
        this.isRunning = true;
        
        // Show initial status
        await this.showStatus();
        
        console.log('\n✅ Bot is running! Monitoring for @loveall mentions...');
        console.log('📝 Note: Mention monitoring needs to be implemented with proper Neynar API methods');
        
        // Start monitoring loop
        const monitorInterval = setInterval(async () => {
            if (!this.isRunning) {
                clearInterval(monitorInterval);
                return;
            }
            await this.monitorMentions();
        }, 30000); // Check every 30 seconds
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping bot...');
            this.isRunning = false;
            clearInterval(monitorInterval);
            await this.showStatus();
            console.log('👋 Bot stopped gracefully');
            process.exit(0);
        });
    }

    // Stop the bot
    stop() {
        this.isRunning = false;
        console.log('🛑 Bot stop requested');
    }
}

// Create and export the bot
const bot = new EnhancedLoveallBot();

// Export for interactive use
module.exports = bot;

// Start if called directly
if (require.main === module) {
    bot.start().catch(console.error);
}
