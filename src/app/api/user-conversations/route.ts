import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import contractABI from '../../../abi.json';

// Contract configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const RPC_ENDPOINT = 'https://mainnet.base.org';

function createProvider() {
    return new ethers.JsonRpcProvider(RPC_ENDPOINT);
}

// Get all conversations for a user using the optimized view function
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('user');

        if (!userAddress) {
            return NextResponse.json({
                error: 'User address is required'
            }, { status: 400 });
        }

        console.log('Fetching conversations for user via getUserConversations:', userAddress);

        const provider = createProvider();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider);

        // Single RPC call to get all conversations with complete content
        const conversations = await contract.getUserConversations(userAddress);
        
        console.log(`Found ${conversations.length} conversations for user ${userAddress}`);

        // Format the response for frontend consumption
        const formattedConversations = conversations.map((conv: any) => {
            // Format messages with proper timestamps and content
            const formattedMessages = conv.messages.map((msg: any) => ({
                hash: msg.castHash,
                text: msg.content,
                timestamp: new Date(Number(msg.timestamp) * 1000).toISOString(),
                author: {
                    fid: msg.isBot ? 1159914 : Number(conv.fid), // Bot FID vs User FID
                    username: msg.isBot ? 'loveall' : 'User',
                    display_name: msg.isBot ? 'LoveAll' : 'User',
                    pfp_url: msg.isBot 
                        ? 'https://images.pexels.com/photos/20025519/pexels-photo-20025519.jpeg'
                        : '/default-avatar.png'
                },
                isBot: msg.isBot,
                source: 'smart_contract'
            }));

            return {
                conversationId: conv.conversationId,
                user: conv.user,
                fid: Number(conv.fid),
                messages: formattedMessages,
                totalCost: ethers.formatUnits(conv.totalCost, 6),
                aiScore: Number(conv.aiScore),
                isEvaluated: conv.isEvaluated,
                startTime: new Date(Number(conv.startTime) * 1000).toISOString(),
                lastActivity: new Date(Number(conv.lastActivity) * 1000).toISOString(),
                messageCount: Number(conv.messageCount),
                
                // Additional computed fields for compatibility
                totalCasts: Number(conv.messageCount),
                totalSpent: ethers.formatUnits(conv.totalCost, 6),
                averageScore: Number(conv.aiScore).toString()
            };
        });

        // Sort by last activity (most recent first)
        formattedConversations.sort((a, b) => 
            new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
        );

        return NextResponse.json({
            userAddress,
            conversations: formattedConversations,
            totalConversations: formattedConversations.length,
            totalMessages: formattedConversations.reduce((sum, conv) => sum + conv.messageCount, 0),
            totalSpent: formattedConversations.reduce((sum, conv) => sum + parseFloat(conv.totalCost), 0).toFixed(4),
            source: 'smart_contract_optimized',
            rpcCalls: 1, // Only 1 RPC call needed!
            farcasterCalls: 0 // No external API dependencies!
        });

    } catch (error) {
        console.error('Error fetching user conversations:', error);
        
        // If the new function doesn't exist yet (pre-deployment), fall back to old method
        if (error instanceof Error && error.message.includes('call revert exception')) {
            console.log('New getUserConversations function not available, falling back to events');
            
            try {
                // Fallback to blockchain events approach
                const fallbackResponse = await fetch(new URL('/api/blockchain-events', request.url), {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' }
                });
                
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    return NextResponse.json({
                        ...fallbackData,
                        source: 'blockchain_events_fallback',
                        note: 'Used fallback method - new contract functions not yet deployed'
                    });
                }
            } catch (fallbackError) {
                console.error('Fallback also failed:', fallbackError);
            }
        }
        
        return NextResponse.json({
            error: 'Failed to fetch user conversations',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
