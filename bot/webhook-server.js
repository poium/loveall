require('dotenv').config();
const express = require('express');
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

// Contract ABI
const contractABI = require('../artifacts/contracts/LoveallPrizePool.sol/LoveallPrizePool.json').abi;

class WebhookBot {
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
        
        // Bot state
        this.processedCasts = new Set();
        this.botUsername = 'loveall';
        
        // Initialize Express app
        this.app = express();
        this.app.use(express.json());
        
        console.log('🤖 Webhook Loveall Bot initialized!');
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

    // Process a cast mention
    async processMention(castData) {
        try {
            // Skip if already processed
            if (this.processedCasts.has(castData.hash)) {
                return;
            }

            console.log(`📨 Processing mention from ${castData.author.username} (FID: ${castData.author.fid})`);
            console.log(`📝 Cast: "${castData.text}"`);

            // Get user's verified address
            const userAddress = castData.author.verified_accounts?.[0]?.address;
            if (!userAddress) {
                console.log('⚠️ User has no verified account, skipping...');
                this.processedCasts.add(castData.hash);
                return;
            }

            // Get user data from contract
            const userData = await this.getUserData(userAddress);
            if (!userData) {
                console.log('❌ Could not get user data, skipping...');
                this.processedCasts.add(castData.hash);
                return;
            }

            // Check if user can participate
            if (!userData.hasSufficientBalance) {
                const response = this.generateInsufficientBalanceResponse();
                await this.replyToCast(castData.hash, response);
                console.log('💸 User has insufficient balance');
            } else if (userData.hasParticipatedThisWeek) {
                const response = this.generateAlreadyParticipatedResponse();
                await this.replyToCast(castData.hash, response);
                console.log('⏰ User already participated this week');
            } else {
                // Record participation
                const success = await this.recordParticipation(userAddress, castData.hash);
                if (success) {
                    const response = this.generateFlirtyResponse();
                    await this.replyToCast(castData.hash, response);
                    console.log('✅ Participation recorded successfully');
                } else {
                    await this.replyToCast(castData.hash, "Oops! Something went wrong! 😅 Please try again!");
                    console.log('❌ Failed to record participation');
                }
            }

            // Mark as processed
            this.processedCasts.add(castData.hash);

        } catch (error) {
            console.error('Error processing mention:', error);
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

    // Setup webhook routes
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Webhook endpoint for cast mentions
        this.app.post('/webhook/mention', async (req, res) => {
            try {
                console.log('📥 Received webhook:', req.body);
                
                const { cast } = req.body;
                if (!cast) {
                    return res.status(400).json({ error: 'No cast data provided' });
                }

                // Check if cast mentions the bot
                if (this.isMentioningBot(cast.text)) {
                    await this.processMention(cast);
                }

                res.json({ status: 'processed' });
            } catch (error) {
                console.error('Webhook error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Manual mention processing endpoint
        this.app.post('/process-mention', async (req, res) => {
            try {
                const { castData } = req.body;
                if (!castData) {
                    return res.status(400).json({ error: 'No cast data provided' });
                }

                await this.processMention(castData);
                res.json({ status: 'processed' });
            } catch (error) {
                console.error('Manual processing error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });

        // Status endpoint
        this.app.get('/status', async (req, res) => {
            try {
                const commonData = await this.contract.getCommonData();
                res.json({
                    status: 'running',
                    contract: this.contractAddress,
                    botWallet: this.wallet.address,
                    processedCasts: this.processedCasts.size,
                    currentWeek: commonData.currentWeek,
                    totalPrizePool: ethers.formatUnits(commonData.totalPrizePool, 6),
                    currentWeekPrizePool: ethers.formatUnits(commonData.currentWeekPrizePool, 6),
                    participantsThisWeek: commonData.currentWeekParticipantsCount
                });
            } catch (error) {
                console.error('Status error:', error);
                res.status(500).json({ error: 'Internal server error' });
            }
        });
    }

    // Start the webhook server
    async start(port = 3001) {
        console.log('🚀 Starting Webhook Loveall Bot...');
        
        // Setup routes
        this.setupRoutes();
        
        // Start server
        this.server = this.app.listen(port, () => {
            console.log(`✅ Webhook server running on port ${port}`);
            console.log(`🌐 Health check: http://localhost:${port}/health`);
            console.log(`📊 Status: http://localhost:${port}/status`);
            console.log(`📥 Webhook endpoint: http://localhost:${port}/webhook/mention`);
            console.log(`🔧 Manual processing: http://localhost:${port}/process-mention`);
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Stopping webhook server...');
            this.server.close(() => {
                console.log('👋 Webhook server stopped gracefully');
                process.exit(0);
            });
        });
    }
}

// Create and export the bot
const webhookBot = new WebhookBot();

// Export for interactive use
module.exports = webhookBot;

// Start if called directly
if (require.main === module) {
    webhookBot.start().catch(console.error);
}
