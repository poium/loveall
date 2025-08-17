// Bot data helper functions with cache-first approach
import { ethers } from 'ethers';
import { getCachedUserData, getCachedCommonData, updateCachedUserData, updateCachedCommonData, clearUserCache, UserData, CommonData } from './database';

// Contract configuration
const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Import the full ABI to ensure proper struct parsing
import contractABI from '../abi.json';

const CONTRACT_ABI = contractABI;

const USDC_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)'
];

// RPC endpoints for fallback
const RPC_ENDPOINTS = [
    'https://mainnet.base.org',
    'https://base.drpc.org',
    'https://1rpc.io/base',
    process.env.BASE_RPC_URL || 'https://mainnet.base.org'
];

let currentRpcIndex = 0;

function createProvider(): ethers.JsonRpcProvider {
    return new ethers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
}

function switchRpcEndpoint(): ethers.JsonRpcProvider {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    console.log(`🔄 Bot: Switching RPC to: ${RPC_ENDPOINTS[currentRpcIndex]}`);
    return new ethers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
}

// Cache-first user data retrieval with staleness detection
export async function getBotUserData(userAddress: string): Promise<{
    balance: string;
    hasSufficientBalance: boolean;
    hasParticipatedThisWeek: boolean;
    participationsCount: number;
    conversationCount: number;
    remainingConversations: number;
    bestScore: number;
    bestConversationId: string;
    totalContributions: string;
    allowance: string;
    source: 'cache' | 'rpc' | 'rpc_forced';
}> {
    console.log('📊 Bot: Getting user data for', userAddress);
    
    // Try cache first
    const cachedData = await getCachedUserData(userAddress);
    if (cachedData) {
        // Check if cached data seems stale (balance is suspiciously low)
        const balanceNum = parseFloat(cachedData.contractBalance);
        const isSuspiciouslyLow = balanceNum < 0.001; // Less than 0.001 USDC suggests stale data
        
        if (isSuspiciouslyLow) {
            console.log('⚠️ Bot: Cached balance seems stale:', cachedData.contractBalance, 'USDC - clearing cache and forcing fresh RPC call');
            // Clear stale cache entry
            clearUserCache(userAddress);
        } else {
            console.log('⚡ Bot: Using cached data for', userAddress, '- balance:', cachedData.contractBalance, 'USDC');
            return {
                balance: cachedData.contractBalance,
                hasSufficientBalance: cachedData.hasSufficientBalance,
                hasParticipatedThisWeek: cachedData.hasParticipatedThisWeek,
                participationsCount: cachedData.participationsCount,
                conversationCount: cachedData.conversationCount,
                remainingConversations: cachedData.remainingConversations,
                bestScore: cachedData.bestScore,
                bestConversationId: cachedData.bestConversationId,
                totalContributions: cachedData.totalContributions,
                allowance: cachedData.allowance,
                source: 'cache'
            };
        }
    }
    
    // Fallback to RPC with retry logic (either cache miss or forced refresh)
    const reason = cachedData ? 'stale data detected' : 'cache miss';
    console.log(`🔄 Bot: Fetching fresh data from RPC for ${userAddress} (${reason})`);
    
    let provider = createProvider();
    let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    let usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const [userData, allowance] = await Promise.all([
                contract.getUserData(userAddress),
                usdcContract.allowance(userAddress, CONTRACT_ADDRESS)
            ]);
            
            // With full ABI, userData is now a proper struct object
            const result = {
                balance: ethers.formatUnits(userData.balance, 6),
                hasSufficientBalance: userData.hasSufficientBalance,
                hasParticipatedThisWeek: userData.hasParticipatedThisWeek,
                participationsCount: Number(userData.participationsCount),
                conversationCount: Number(userData.conversationCount),
                remainingConversations: Number(userData.remainingConversations),
                bestScore: Number(userData.bestScore),
                bestConversationId: userData.bestConversationId,
                totalContributions: ethers.formatUnits(userData.totalContributions, 6),
                allowance: ethers.formatUnits(allowance, 6),
                source: cachedData ? 'rpc_forced' as const : 'rpc' as const
            };

            console.log('🔍 Bot: Raw userData struct:', {
                balance: userData.balance.toString(),
                balanceFormatted: ethers.formatUnits(userData.balance, 6),
                hasSufficientBalance: userData.hasSufficientBalance,
                hasParticipatedThisWeek: userData.hasParticipatedThisWeek
            });
            
            // Update cache for next time
            updateCachedUserData(userAddress, {
                address: userAddress.toLowerCase(),
                contractBalance: result.balance,
                usdcBalance: '0', // We don't fetch this in bot context
                allowance: result.allowance,
                hasSufficientBalance: result.hasSufficientBalance,
                hasParticipatedThisWeek: result.hasParticipatedThisWeek,
                participationsCount: result.participationsCount,
                conversationCount: result.conversationCount,
                remainingConversations: result.remainingConversations,
                bestScore: result.bestScore,
                bestConversationId: result.bestConversationId,
                totalContributions: result.totalContributions,
                lastUpdated: Date.now()
            });
            
            console.log('✅ Bot: Fetched and cached user data from RPC');
            return result;
            
        } catch (error) {
            console.log(`❌ Bot: RPC attempt ${attempt} failed:`, error);
            
            if (attempt < 3) {
                provider = switchRpcEndpoint();
                contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    throw new Error('Failed to fetch user data after 3 attempts');
}

// Cache-first common data retrieval
export async function getBotCommonData(): Promise<{
    totalPrizePool: string;
    currentWeekPrizePool: string;
    rolloverAmount: string;
    totalContributions: string;
    totalProtocolFees: string;
    castCost: string;
    currentWeek: number;
    weekStartTime: number;
    weekEndTime: number;
    currentWeekParticipantsCount: number;
    currentWeekWinner: string;
    currentWeekPrize: string;
    characterName: string;
    characterTask: string;
    characterIsSet: boolean;
    source: 'cache' | 'rpc';
}> {
    console.log('📊 Bot: Getting common data');
    
    // Try cache first
    const cachedData = await getCachedCommonData();
    if (cachedData) {
        console.log('⚡ Bot: Using cached common data');
        return {
            ...cachedData,
            source: 'cache'
        };
    }
    
    // Fallback to RPC
    console.log('🔄 Bot: Cache miss, fetching common data from RPC');
    
    let provider = createProvider();
    let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const commonData = await contract.getCommonData();
            
            // With full ABI, commonData is now a proper struct object
            const result = {
                totalPrizePool: ethers.formatUnits(commonData.totalPrizePool, 6),
                currentWeekPrizePool: ethers.formatUnits(commonData.currentWeekPrizePool, 6),
                rolloverAmount: ethers.formatUnits(commonData.rolloverAmount, 6),
                totalContributions: ethers.formatUnits(commonData.totalContributions, 6),
                totalProtocolFees: ethers.formatUnits(commonData.totalProtocolFees, 6),
                castCost: ethers.formatUnits(commonData.castCost, 6),
                currentWeek: Number(commonData.currentWeek),
                weekStartTime: Number(commonData.weekStartTime) * 1000,
                weekEndTime: Number(commonData.weekEndTime) * 1000,
                currentWeekParticipantsCount: Number(commonData.currentWeekParticipantsCount),
                currentWeekWinner: commonData.currentWeekWinner,
                currentWeekPrize: ethers.formatUnits(commonData.currentWeekPrize, 6),
                characterName: commonData.characterName,
                characterTask: commonData.characterTask,
                characterIsSet: commonData.characterIsSet,
                source: 'rpc' as const
            };
            
            // Update cache for next time
            updateCachedCommonData({
                ...result,
                lastUpdated: Date.now()
            });
            
            console.log('✅ Bot: Fetched and cached common data from RPC');
            return result;
            
        } catch (error) {
            console.log(`❌ Bot: Common data RPC attempt ${attempt} failed:`, error);
            
            if (attempt < 3) {
                provider = switchRpcEndpoint();
                contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    throw new Error('Failed to fetch common data after 3 attempts');
}
