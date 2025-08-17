import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Contract ABI (import the full ABI)
import CONTRACT_ABI_JSON from '../../../../contracts/abi.json';
const CONTRACT_ABI = CONTRACT_ABI_JSON;

// USDC ABI for allowance check
const USDC_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)'
];

// Initialize provider with fallback RPC endpoints
const RPC_ENDPOINTS = [
    process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    'https://base.blockpi.network/v1/rpc/public',
    'https://1rpc.io/base',
    'https://base.meowrpc.com',
    'https://base.drpc.org'
];

let provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[0]);
let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
let usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

// Function to switch RPC endpoint
let currentRpcIndex = 0;
function switchRpcEndpoint() {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    const newRpcUrl = RPC_ENDPOINTS[currentRpcIndex];
    console.log(`Switching RPC endpoint to: ${newRpcUrl}`);
    provider = new ethers.JsonRpcProvider(newRpcUrl);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({
                error: 'Address parameter is required',
                example: '/api/check-balance?address=0x...'
            }, { status: 400 });
        }

        // Validate address format
        if (!ethers.isAddress(address)) {
            return NextResponse.json({
                error: 'Invalid address format'
            }, { status: 400 });
        }

        console.log('Checking balance for address:', address);

        // Get user data from contract with retry (optimized - single RPC call)
        let userData = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                userData = await contract.getUserData(address);
                break;
            } catch (error: any) {
                console.log(`User data fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All user data fetch attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Extract data from single getUserData call
        const contractBalance = userData ? ethers.formatUnits(userData.balance, 6) : '0';
        const hasSufficientBalance = userData ? userData.hasSufficientBalance : false;
        const hasParticipatedThisWeek = userData ? userData.hasParticipatedThisWeek : false;
        const participationsCount = userData ? Number(userData.participationsCount) : 0;
        const conversationCount = userData ? Number(userData.conversationCount) : 0;
        const remainingConversations = userData ? Number(userData.remainingConversations) : 3;
        const bestScore = userData ? Number(userData.bestScore) : 0;
        const bestConversationId = userData ? userData.bestConversationId : '0x0000000000000000000000000000000000000000000000000000000000000000';
        const totalContributions = userData ? ethers.formatUnits(userData.totalContributions, 6) : '0';
        
        // Process participations data with new fields
        const participations = userData ? userData.participations.map((participation: any) => ({
            user: participation.user,
            fid: Number(participation.fid),
            castHash: participation.castHash,
            conversationId: participation.conversationId,
            timestamp: Number(participation.timestamp),
            weekNumber: Number(participation.weekNumber),
            usdcAmount: ethers.formatUnits(participation.usdcAmount, 6),
            aiScore: Number(participation.aiScore),
            isEvaluated: participation.isEvaluated
        })) : [];

        // Debug logging
        console.log('User data analysis:', {
            address,
            contractBalance,
            hasSufficientBalance,
            hasParticipatedThisWeek,
            participationsCount,
            conversationCount,
            remainingConversations,
            bestScore,
            canParticipate: hasSufficientBalance && remainingConversations > 0
        });

        return NextResponse.json({
            address: address,
            contractBalance: contractBalance,
            hasSufficientBalance: hasSufficientBalance,
            hasParticipatedThisWeek: hasParticipatedThisWeek,
            participationsCount: participationsCount,
            conversationCount: conversationCount,
            remainingConversations: remainingConversations,
            bestScore: bestScore,
            bestConversationId: bestConversationId,
            totalContributions: totalContributions,
            participations: participations,
            canParticipate: hasSufficientBalance && remainingConversations > 0,
            requiredAmount: '0.01',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error checking balance:', error);
        return NextResponse.json({
            error: 'Failed to check balance',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
