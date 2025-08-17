// Vercel serverless function for Loveall Bot
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

// Contract ABI
const contractABI = require('../artifacts/contracts/LoveallPrizePool.sol/LoveallPrizePool.json').abi;

class VercelBot {
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
        
        console.log('🤖 Vercel Loveall Bot initialized!');
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

    // Process a cast mention
    async processMention(castData) {
        try {
            console.log(`📨 Processing mention from ${castData.author.username} (FID: ${castData.author.fid})`);
            console.log(`📝 Cast: "${castData.text}"`);

            // Get user's verified address
            const userAddress = castData.author.verified_accounts?.[0]?.address;
            if (!userAddress) {
                console.log('⚠️ User has no verified account, skipping...');
                return { success: false, reason: 'no_verified_account' };
            }

            // Get user data from contract
            const userData = await this.getUserData(userAddress);
            if (!userData) {
                console.log('❌ Could not get user data, skipping...');
                return { success: false, reason: 'no_user_data' };
            }

            // Check if user can participate
            if (!userData.hasSufficientBalance) {
                const response = this.generateInsufficientBalanceResponse();
                await this.replyToCast(castData.hash, response);
                console.log('💸 User has insufficient balance');
                return { success: true, reason: 'insufficient_balance', response };
            } else if (userData.hasParticipatedThisWeek) {
                const response = this.generateAlreadyParticipatedResponse();
                await this.replyToCast(castData.hash, response);
                console.log('⏰ User already participated this week');
                return { success: true, reason: 'already_participated', response };
            } else {
                // Record participation
                const success = await this.recordParticipation(userAddress, castData.hash);
                if (success) {
                    const response = this.generateFlirtyResponse();
                    await this.replyToCast(castData.hash, response);
                    console.log('✅ Participation recorded successfully');
                    return { success: true, reason: 'participation_recorded', response };
                } else {
                    const response = "Oops! Something went wrong! 😅 Please try again!";
                    await this.replyToCast(castData.hash, response);
                    console.log('❌ Failed to record participation');
                    return { success: false, reason: 'participation_failed', response };
                }
            }

        } catch (error) {
            console.error('Error processing mention:', error);
            return { success: false, reason: 'error', error: error.message };
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
            return true;
        } catch (error) {
            console.error('Error replying to cast:', error);
            return false;
        }
    }
}

// Initialize bot instance
const bot = new VercelBot();

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { method } = req;

        switch (method) {
            case 'GET':
                if (req.url === '/health') {
                    res.json({ status: 'ok', timestamp: new Date().toISOString() });
                } else if (req.url === '/status') {
                    const commonData = await bot.getCommonData();
                    res.json({
                        status: 'running',
                        contract: bot.contractAddress,
                        botWallet: bot.wallet.address,
                        currentWeek: commonData.currentWeek,
                        totalPrizePool: ethers.formatUnits(commonData.totalPrizePool, 6),
                        currentWeekPrizePool: ethers.formatUnits(commonData.currentWeekPrizePool, 6),
                        participantsThisWeek: commonData.currentWeekParticipantsCount
                    });
                } else {
                    res.status(404).json({ error: 'Not found' });
                }
                break;

            case 'POST':
                if (req.url === '/webhook/mention') {
                    const { cast } = req.body;
                    if (!cast) {
                        return res.status(400).json({ error: 'No cast data provided' });
                    }

                    if (bot.isMentioningBot(cast.text)) {
                        const result = await bot.processMention(cast);
                        res.json({ status: 'processed', result });
                    } else {
                        res.json({ status: 'ignored', reason: 'no_mention' });
                    }
                } else if (req.url === '/process-mention') {
                    const { castData } = req.body;
                    if (!castData) {
                        return res.status(400).json({ error: 'No cast data provided' });
                    }

                    const result = await bot.processMention(castData);
                    res.json({ status: 'processed', result });
                } else {
                    res.status(404).json({ error: 'Not found' });
                }
                break;

            default:
                res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('API error:', error);
        res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
