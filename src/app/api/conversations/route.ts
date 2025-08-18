import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import contractABI from '../../../abi.json';

// Contract configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const RPC_ENDPOINT = 'https://mainnet.base.org';

const CONTRACT_ABI = contractABI;

function createProvider() {
    return new ethers.JsonRpcProvider(RPC_ENDPOINT);
}

// Clean up cast hash - remove padding zeros that were added for bytes32
function cleanCastHash(hash: string): string {
    if (!hash || !hash.startsWith('0x')) return hash;
    
    // Remove trailing zeros that were added for bytes32 padding
    const cleaned = hash.replace(/0+$/, '');
    
    // Ensure it's still a valid hex string length (should be around 40-42 chars for real hashes)
    if (cleaned.length < 20) {
        return hash; // Return original if cleaning made it too short
    }
    
    return cleaned;
}

// Get conversations for a specific user
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userAddress = searchParams.get('user');
        const conversationId = searchParams.get('conversationId');
        const week = searchParams.get('week');

        if (!userAddress && !conversationId) {
            return NextResponse.json({
                error: 'Either user address or conversationId is required'
            }, { status: 400 });
        }

        const provider = createProvider();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

        // If specific conversation requested
        if (conversationId) {
            console.log('Fetching conversation:', conversationId);
            const participations = await contract.getConversationParticipations(conversationId);
            
            // Convert to readable format
            const formattedParticipations = participations.map((p: any) => ({
                user: p.user,
                fid: Number(p.fid),
                castHash: cleanCastHash(p.castHash),
                conversationId: p.conversationId,
                timestamp: Number(p.timestamp),
                weekNumber: Number(p.weekNumber),
                usdcAmount: ethers.formatUnits(p.usdcAmount, 6),
                aiScore: Number(p.aiScore),
                isEvaluated: p.isEvaluated,
                timestampFormatted: new Date(Number(p.timestamp) * 1000).toISOString()
            }));

            return NextResponse.json({
                conversationId,
                participations: formattedParticipations,
                totalCasts: formattedParticipations.length
            });
        }

        // Get all conversations for a user
        if (userAddress) {
            console.log('Fetching conversations for user:', userAddress);
            
            // Get current week participations first
            const allParticipations = await contract.getCurrentWeekParticipations();
            
            // Filter by user and group by conversation ID
            const userParticipations = allParticipations.filter((p: any) => 
                p.user.toLowerCase() === userAddress.toLowerCase()
            );

            // Group by conversation ID
            const conversationMap = new Map();
            
            userParticipations.forEach((p: any) => {
                const convId = p.conversationId;
                if (!conversationMap.has(convId)) {
                    conversationMap.set(convId, []);
                }
                conversationMap.get(convId).push({
                    user: p.user,
                    fid: Number(p.fid),
                    castHash: cleanCastHash(p.castHash),
                    conversationId: p.conversationId,
                    timestamp: Number(p.timestamp),
                    weekNumber: Number(p.weekNumber),
                    usdcAmount: ethers.formatUnits(p.usdcAmount, 6),
                    aiScore: Number(p.aiScore),
                    isEvaluated: p.isEvaluated,
                    timestampFormatted: new Date(Number(p.timestamp) * 1000).toISOString()
                });
            });

            // Convert to array format
            const conversations = Array.from(conversationMap.entries()).map(([conversationId, participations]) => {
                const sortedParticipations = participations.sort((a: any, b: any) => a.timestamp - b.timestamp);
                return {
                    conversationId,
                    participations: sortedParticipations,
                    totalCasts: sortedParticipations.length,
                    startTime: sortedParticipations[0]?.timestampFormatted,
                    lastActivity: sortedParticipations[sortedParticipations.length - 1]?.timestampFormatted,
                    totalSpent: sortedParticipations.reduce((sum: number, p: any) => sum + parseFloat(p.usdcAmount), 0).toFixed(4),
                    averageScore: sortedParticipations.length > 0 
                        ? (sortedParticipations.reduce((sum: number, p: any) => sum + p.aiScore, 0) / sortedParticipations.length).toFixed(1)
                        : '0'
                };
            });

            // Sort by last activity (most recent first)
            conversations.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

            return NextResponse.json({
                userAddress,
                conversations,
                totalConversations: conversations.length,
                totalCasts: userParticipations.length
            });
        }

        return NextResponse.json({
            error: 'Invalid request parameters'
        }, { status: 400 });

    } catch (error) {
        console.error('Error fetching conversations:', error);
        return NextResponse.json({
            error: 'Failed to fetch conversations',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
