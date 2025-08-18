// Cache warming endpoint to populate database with RPC data when needed
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { updateCachedUserData, updateCachedCommonData, getCacheStats } from '@/lib/database';

// Contract configuration (same as bot)
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const CONTRACT_ABI = [
    'function getUserData(address user) external view returns (tuple(uint256 balance, bool hasSufficientBalance, bool hasParticipatedThisWeek, uint256 participationsCount, uint256 conversationCount, uint256 remainingConversations, uint256 bestScore, bytes32 bestConversationId, uint256 totalContributions))',
    'function getCommonData() external view returns (tuple(uint256 totalPrizePool, uint256 currentWeekPrizePool, uint256 rolloverAmount, uint256 totalContributions, uint256 totalProtocolFees, uint256 castCost, uint256 currentWeek, uint256 weekStartTime, uint256 weekEndTime, uint256 currentWeekParticipantsCount, address currentWeekWinner, uint256 currentWeekPrize, string characterName, string characterTask, bool characterIsSet))'
];

const USDC_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)'
];

// RPC setup
const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

export async function POST(request: NextRequest) {
  try {
    const { address, type } = await request.json();
    
    if (type === 'user' && address) {
      // Warm user data cache
      console.log('🔥 Cache: Warming user data for', address);
      
      const [userData, usdcBalance, allowance] = await Promise.all([
        contract.getUserData(address),
        usdcContract.balanceOf(address), 
        usdcContract.allowance(address, CONTRACT_ADDRESS)
      ]);
      
      const userDataFormatted = {
        address: address.toLowerCase(),
        contractBalance: ethers.formatUnits(userData.balance, 6),
        usdcBalance: ethers.formatUnits(usdcBalance, 6),
        allowance: ethers.formatUnits(allowance, 6),
        hasSufficientBalance: userData.hasSufficientBalance,
        hasParticipatedThisWeek: userData.hasParticipatedThisWeek,
        participationsCount: Number(userData.participationsCount),
        conversationCount: Number(userData.conversationCount),
        remainingConversations: Number(userData.remainingConversations),
        bestScore: Number(userData.bestScore),
        bestConversationId: userData.bestConversationId,
        totalContributions: ethers.formatUnits(userData.totalContributions, 6),
        lastUpdated: Date.now()
      };
      
      updateCachedUserData(address, userDataFormatted);
      
      return NextResponse.json({
        success: true,
        data: userDataFormatted,
        source: 'rpc_fresh'
      });
      
    } else if (type === 'common') {
      // Warm common data cache
      console.log('🔥 Cache: Warming common data');
      
      const commonData = await contract.getCommonData();
      
      const commonDataFormatted = {
        totalPrizePool: ethers.formatUnits(commonData.totalPrizePool, 6),
        currentWeekPrizePool: ethers.formatUnits(commonData.currentWeekPrizePool, 6),
        rolloverAmount: ethers.formatUnits(commonData.rolloverAmount, 6),
        totalContributions: ethers.formatUnits(commonData.totalContributions, 6),
        totalProtocolFees: ethers.formatUnits(commonData.totalProtocolFees, 6),
        castCost: ethers.formatUnits(commonData.castCost, 6),
        currentWeek: Number(commonData.currentWeek),
        weekStartTime: Number(commonData.weekStartTime) * 1000, // Convert to milliseconds
        weekEndTime: Number(commonData.weekEndTime) * 1000,
        currentWeekParticipantsCount: Number(commonData.currentWeekParticipantsCount),
        currentWeekWinner: commonData.currentWeekWinner,
        currentWeekPrize: ethers.formatUnits(commonData.currentWeekPrize, 6),
        characterName: commonData.characterName,
        characterTask: commonData.characterTask,
        characterIsSet: commonData.characterIsSet,
        lastUpdated: Date.now()
      };
      
      updateCachedCommonData(commonDataFormatted);
      
      return NextResponse.json({
        success: true,
        data: commonDataFormatted,
        source: 'rpc_fresh'
      });
      
    } else {
      return NextResponse.json({
        error: 'Invalid request. Use type: "user" with address or type: "common"'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Cache warming error:', error);
    return NextResponse.json({
      error: 'Cache warming failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Return cache statistics
  const stats = getCacheStats();
  
  return NextResponse.json({
    stats,
    cacheHealth: {
      userCount: stats.userCount,
      commonDataFresh: stats.commonDataAge < 10 * 60 * 1000, // Less than 10 minutes
      oldestUserDataAge: stats.oldestUserData > 0 ? Math.floor(stats.oldestUserData / 1000 / 60) : 0 // Minutes
    }
  });
}
