require('dotenv').config();
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

// Contract ABI (we'll get this from updated source)
const contractABI = require('../src/abi.json');

class LoveallBot {
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
        
        // Use a more reliable RPC endpoint
        const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        
        // Add connection retry logic
        this.provider.on('error', (error) => {
            console.error('Provider error:', error);
        });
        
        this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
        this.contract = new ethers.Contract(this.contractAddress, contractABI, this.wallet);
        
        // Bot configuration
        this.botUsername = 'loveall';
        this.lastProcessedTimestamp = 0;
        
        console.log('🤖 Loveall Bot initialized!');
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

    // Record complete conversation (user cast + bot reply)
    async recordCompleteConversation(userAddress, fid, userCastHash, botCastHash, conversationId, userCastContent, botReplyContent) {
        try {
            const tx = await this.contract.recordCompleteConversation(
                userAddress,
                fid,
                userCastHash,
                botCastHash,
                conversationId,
                userCastContent,
                botReplyContent
            );
            await tx.wait();
            console.log(`✅ Complete conversation recorded for ${userAddress}`);
            return true;
        } catch (error) {
            console.error('Error recording complete conversation:', error);
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

    // Process mentions
    async processMentions() {
        try {
            console.log('🔍 Checking for new mentions...');
            
            // Get mentions from Neynar
            const mentions = await this.neynar.fetchUserMentions({
                fid: parseInt(process.env.NEYNAR_CLIENT_ID),
                limit: 10
            });

            for (const mention of mentions.messages) {
                // Skip if already processed
                if (mention.timestamp <= this.lastProcessedTimestamp) continue;
                
                const userAddress = mention.author.verified_accounts?.[0]?.address;
                if (!userAddress) {
                    console.log('⚠️ User has no verified account, skipping...');
                    continue;
                }

                console.log(`📨 Processing mention from ${mention.author.username} (${userAddress})`);

                // Get user data from contract
                const userData = await this.getUserData(userAddress);
                if (!userData) {
                    console.log('❌ Could not get user data, skipping...');
                    continue;
                }

                // Check if user can participate
                if (!userData.hasSufficientBalance) {
                    const response = this.generateInsufficientBalanceResponse();
                    await this.replyToCast(mention.hash, response);
                    console.log('💸 User has insufficient balance');
                } else if (userData.hasParticipatedThisWeek) {
                    const response = this.generateAlreadyParticipatedResponse();
                    await this.replyToCast(mention.hash, response);
                    console.log('⏰ User already participated this week');
                } else {
                    // Generate response and reply to cast
                    const response = this.generateFlirtyResponse();
                    const replyResult = await this.replyToCast(mention.hash, response);
                    
                    if (replyResult && replyResult.hash) {
                        // Create conversation ID from the original mention hash
                        const conversationId = ethers.keccak256(ethers.toUtf8Bytes(mention.hash));
                        
                        // Record complete conversation
                        const success = await this.recordCompleteConversation(
                            userAddress,
                            mention.author.fid,
                            mention.hash,
                            replyResult.hash,
                            conversationId,
                            mention.text,
                            response
                        );
                        
                        if (success) {
                            console.log('✅ Complete conversation recorded successfully');
                        } else {
                            console.log('❌ Failed to record conversation to contract');
                        }
                    } else {
                        console.log('❌ Failed to reply to cast');
                    }
                }

                this.lastProcessedTimestamp = mention.timestamp;
            }

        } catch (error) {
            console.error('Error processing mentions:', error);
        }
    }

    // Reply to a cast
    async replyToCast(parentHash, text) {
        try {
            const result = await this.neynar.publishCast({
                signer_uuid: process.env.NEYNAR_SIGNER_UUID,
                text: text,
                parent: parentHash
            });
            console.log(`💬 Replied: ${text}`);
            return result.cast || result; // Return the cast object which should contain the hash
        } catch (error) {
            console.error('Error replying to cast:', error);
            return null;
        }
    }

    // Start the bot
    async start() {
        console.log('🚀 Starting Loveall Bot...');
        
        // Initial delay
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Start monitoring loop
        setInterval(async () => {
            await this.processMentions();
        }, 30000); // Check every 30 seconds
        
        console.log('✅ Bot is running! Monitoring for @loveall mentions...');
    }
}

// Start the bot
const bot = new LoveallBot();
bot.start().catch(console.error);
