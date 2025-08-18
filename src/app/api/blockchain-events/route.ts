import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import contractABI from '../../../abi.json';

// Contract configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const RPC_ENDPOINT = 'https://mainnet.base.org';

function createProvider() {
    return new ethers.JsonRpcProvider(RPC_ENDPOINT);
}

// Get cast content from blockchain events instead of Farcaster API
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('user');
        const castHash = searchParams.get('castHash');

        if (!userAddress && !castHash) {
            return NextResponse.json({
                error: 'Either user address or castHash is required'
            }, { status: 400 });
        }

        const provider = createProvider();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);

        // Get both old and new event types
        const castParticipatedFilter = contract.filters.CastParticipated();
        const completeConversationFilter = contract.filters.CompleteConversationRecorded();
        const currentBlock = await provider.getBlockNumber();
        
        // Look back ~1 week of blocks (assuming 2 second block times)
        const fromBlock = currentBlock - (7 * 24 * 60 * 60 / 2);
        
        console.log(`Fetching blockchain events from block ${fromBlock} to ${currentBlock}`);
        
        // Fetch both event types in parallel
        const [castParticipatedEvents, completeConversationEvents] = await Promise.all([
            contract.queryFilter(castParticipatedFilter, fromBlock, currentBlock),
            contract.queryFilter(completeConversationFilter, fromBlock, currentBlock)
        ]);
        
        console.log(`Found ${castParticipatedEvents.length} CastParticipated events and ${completeConversationEvents.length} CompleteConversationRecorded events`);

        // Parse old CastParticipated events (user content only)
        const oldParticipations = castParticipatedEvents.map((event) => {
            const args = event.args;
            if (!args) return null;

            // Clean cast hash (remove padding)
            let cleanHash = args.castHash;
            if (typeof cleanHash === 'string' && cleanHash.endsWith('000000000000000000000000')) {
                cleanHash = cleanHash.replace(/0+$/, '');
            }

            return {
                user: args.user,
                fid: Number(args.fid),
                castHash: cleanHash,
                originalCastHash: args.castHash,
                conversationId: args.conversationId,
                cost: ethers.formatUnits(args.cost, 6),
                castContent: args.castContent,
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: null,
                type: 'legacy',
                botReply: null // No bot reply in old events
            };
        }).filter(p => p !== null);

        // Parse new CompleteConversationRecorded events (user + bot content)
        const completeConversations = completeConversationEvents.map((event) => {
            const args = event.args;
            if (!args) return null;

            // Clean user cast hash (remove padding)
            let cleanUserHash = args.userCastHash;
            if (typeof cleanUserHash === 'string' && cleanUserHash.endsWith('000000000000000000000000')) {
                cleanUserHash = cleanUserHash.replace(/0+$/, '');
            }

            // Clean bot cast hash (remove padding)  
            let cleanBotHash = args.botCastHash;
            if (typeof cleanBotHash === 'string' && cleanBotHash.endsWith('000000000000000000000000')) {
                cleanBotHash = cleanBotHash.replace(/0+$/, '');
            }

            return {
                user: args.user,
                fid: Number(args.fid),
                castHash: cleanUserHash,
                originalCastHash: args.userCastHash,
                botCastHash: cleanBotHash,
                originalBotCastHash: args.botCastHash,
                conversationId: args.conversationId,
                cost: ethers.formatUnits(args.cost, 6),
                castContent: args.userCastContent, // ✅ USER CONTENT
                botReply: args.botReplyContent,     // ✅ BOT REPLY CONTENT  
                blockNumber: event.blockNumber,
                transactionHash: event.transactionHash,
                timestamp: Number(args.timestamp) * 1000, // Convert to milliseconds
                timestampFormatted: new Date(Number(args.timestamp) * 1000).toISOString(),
                type: 'complete'
            };
        }).filter(p => p !== null);

        // Combine both types, prioritizing complete conversations
        const allParticipations = [...completeConversations, ...oldParticipations];

        // Filter by user or specific cast hash if requested
        let filteredParticipations = allParticipations;
        
        if (userAddress) {
            filteredParticipations = allParticipations.filter(p => 
                p.user.toLowerCase() === userAddress.toLowerCase()
            );
        }
        
        if (castHash) {
            filteredParticipations = allParticipations.filter(p => 
                p.castHash.toLowerCase() === castHash.toLowerCase() ||
                p.originalCastHash.toLowerCase() === castHash.toLowerCase()
            );
        }

        // Group by conversation if user filter
        if (userAddress && !castHash) {
            const conversationMap = new Map();
            
            filteredParticipations.forEach(p => {
                const convId = p.conversationId;
                if (!conversationMap.has(convId)) {
                    conversationMap.set(convId, []);
                }
                conversationMap.get(convId).push(p);
            });

            const conversations = Array.from(conversationMap.entries()).map(([conversationId, participations]) => {
                const sortedParticipations = participations.sort((a, b) => a.blockNumber - b.blockNumber);
                return {
                    conversationId,
                    participations: sortedParticipations,
                    totalCasts: sortedParticipations.length,
                    totalSpent: sortedParticipations.reduce((sum, p) => sum + parseFloat(p.cost), 0).toFixed(4)
                };
            });

            return NextResponse.json({
                userAddress,
                conversations,
                totalConversations: conversations.length,
                totalParticipations: filteredParticipations.length,
                completeConversations: filteredParticipations.filter(p => p.type === 'complete').length,
                legacyParticipations: filteredParticipations.filter(p => p.type === 'legacy').length,
                source: 'blockchain_events'
            });
        }

        return NextResponse.json({
            participations: filteredParticipations,
            total: filteredParticipations.length,
            source: 'blockchain_events',
            ...(userAddress && { userAddress }),
            ...(castHash && { castHash })
        });

    } catch (error) {
        console.error('Error fetching blockchain events:', error);
        return NextResponse.json({
            error: 'Failed to fetch blockchain events',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
