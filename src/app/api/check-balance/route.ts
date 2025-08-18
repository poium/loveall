import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getBotUserData } from '@/lib/bot-data';

// Force cache clearing for debugging
import { clearUserCache } from '@/lib/database';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Contract ABI (import the full ABI)
const CONTRACT_ABI_JSON = require('../../../abi.json');
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

        // Force clear cache for this specific address to ensure fresh data
        clearUserCache(address);
        console.log('🧹 Cleared cache for', address);

        // Use cache-first approach (same as bot for consistency)
        const userData = await getBotUserData(address);
        console.log('✅ User data retrieved from', userData.source, 'for website');

        const contractBalance = userData.balance;
        const hasSufficientBalance = userData.hasSufficientBalance;
        const hasParticipatedThisWeek = userData.hasParticipatedThisWeek;
        const participationsCount = userData.participationsCount;
        const conversationCount = userData.conversationCount;
        const remainingConversations = userData.remainingConversations;
        const bestScore = userData.bestScore;
        const bestConversationId = userData.bestConversationId;
        const totalContributions = userData.totalContributions;
        
        // Process participations data (not available in cache yet - keep empty for now)
        const participations = [] as any[];

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
