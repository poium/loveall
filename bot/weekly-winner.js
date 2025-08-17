require('dotenv').config();
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');
const { ethers } = require('ethers');

// Contract ABI
const contractABI = require('../artifacts/contracts/LoveallPrizePool.sol/LoveallPrizePool.json').abi;

class WeeklyWinnerSelector {
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
        
        console.log('🏆 Weekly Winner Selector initialized!');
    }

    // Get all participants for current week
    async getCurrentWeekParticipants() {
        try {
            const commonData = await this.contract.getCommonData();
            const currentWeek = commonData.currentWeek;
            
            // Get participants for current week
            const participants = await this.contract.getWeeklyParticipants(currentWeek);
            
            console.log(`📊 Found ${participants.length} participants for week ${currentWeek}`);
            return participants;
        } catch (error) {
            console.error('Error getting participants:', error);
            return [];
        }
    }

    // Get cast content for a participant
    async getCastContent(castHash) {
        try {
            const cast = await this.neynar.lookupCastByHash(castHash);
            return cast.cast.text;
        } catch (error) {
            console.error('Error getting cast content:', error);
            return null;
        }
    }

    // Evaluate casts using Grok API
    async evaluateCastsWithGrok(participants) {
        try {
            console.log('🤖 Evaluating casts with Grok AI...');
            
            const evaluations = [];
            
            for (const participant of participants) {
                // Get user's participation data
                const participations = await this.contract.getUserParticipations(participant);
                
                if (participations.length > 0) {
                    const castHash = participations[0].castHash;
                    const castContent = await this.getCastContent(castHash);
                    
                    if (castContent) {
                        // Evaluate with Grok API
                        const score = await this.grokEvaluate(castContent);
                        evaluations.push({
                            user: participant,
                            castContent: castContent,
                            score: score
                        });
                        
                        console.log(`📝 Evaluated cast from ${participant}: ${castContent.substring(0, 50)}... (Score: ${score})`);
                    }
                }
            }
            
            // Sort by score (highest first)
            evaluations.sort((a, b) => b.score - a.score);
            
            return evaluations;
        } catch (error) {
            console.error('Error evaluating casts:', error);
            return [];
        }
    }

    // Grok API evaluation (placeholder - you'll need to implement actual Grok API call)
    async grokEvaluate(castContent) {
        try {
            // This is a placeholder - you'll need to implement actual Grok API integration
            // For now, we'll use a simple scoring system
            
            const prompt = `Evaluate this flirty cast on a scale of 1-10 based on:
            - Charm and wit (1-10)
            - Creativity and originality (1-10)
            - Humor and playfulness (1-10)
            - Overall appeal (1-10)
            
            Cast: "${castContent}"
            
            Please respond with just a number between 1-10.`;
            
            // TODO: Implement actual Grok API call here
            // const response = await fetch('GROK_API_ENDPOINT', {
            //     method: 'POST',
            //     headers: {
            //         'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
            //         'Content-Type': 'application/json'
            //     },
            //     body: JSON.stringify({ prompt: prompt })
            // });
            // const result = await response.json();
            // return parseFloat(result.score);
            
            // For now, return a random score between 5-10
            return Math.random() * 5 + 5;
            
        } catch (error) {
            console.error('Error with Grok evaluation:', error);
            return 5; // Default score
        }
    }

    // Select and announce winner
    async selectAndAnnounceWinner() {
        try {
            console.log('🎯 Starting weekly winner selection...');
            
            // Get current week participants
            const participants = await this.getCurrentWeekParticipants();
            
            if (participants.length === 0) {
                console.log('❌ No participants this week');
                return;
            }
            
            // Evaluate all casts
            const evaluations = await this.evaluateCastsWithGrok(participants);
            
            if (evaluations.length === 0) {
                console.log('❌ No valid evaluations');
                return;
            }
            
            // Select winner (highest score)
            const winner = evaluations[0];
            
            console.log(`🏆 Winner selected: ${winner.user}`);
            console.log(`📝 Winning cast: ${winner.castContent}`);
            console.log(`⭐ Score: ${winner.score}`);
            
            // Set winner in contract
            const tx = await this.contract.setWeeklyWinner(winner.user);
            await tx.wait();
            console.log('✅ Winner set in contract');
            
            // Distribute prize
            const prizeTx = await this.contract.distributePrize();
            await prizeTx.wait();
            console.log('💰 Prize distributed');
            
            // Start new week
            const newWeekTx = await this.contract.startNewWeek();
            await newWeekTx.wait();
            console.log('🔄 New week started');
            
            // Announce winner on Farcaster
            const announcement = `🏆 WEEKLY WINNER ANNOUNCEMENT! 🏆

Congratulations @${winner.user}! 🎉

Your winning cast: "${winner.castContent.substring(0, 100)}..."

You've won this week's prize pool! 💰✨

Thanks to all participants for the amazing flirty casts! 💕

#Loveall #WeeklyWinner #Farcaster`;
            
            await this.announceWinner(announcement);
            
        } catch (error) {
            console.error('Error selecting winner:', error);
        }
    }

    // Announce winner on Farcaster
    async announceWinner(announcement) {
        try {
            await this.neynar.publishCast({
                signer_uuid: process.env.NEYNAR_SIGNER_UUID,
                text: announcement
            });
            console.log('📢 Winner announced on Farcaster!');
        } catch (error) {
            console.error('Error announcing winner:', error);
        }
    }

    // Run the weekly winner selection
    async run() {
        console.log('🚀 Starting weekly winner selection process...');
        await this.selectAndAnnounceWinner();
        console.log('✅ Weekly winner selection completed!');
    }
}

// Run if called directly
if (require.main === module) {
    const selector = new WeeklyWinnerSelector();
    selector.run().catch(console.error);
}

module.exports = WeeklyWinnerSelector;
