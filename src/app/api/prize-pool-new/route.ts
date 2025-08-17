import { NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Contract ABI for the functions we need
const CONTRACT_ABI = [
  'function getCommonData() external view returns (uint256 currentWeek, uint256 currentPrizePool, uint256 totalParticipants, uint256 weekStartTime)',
  'function getWeeklySummary() external view returns (uint256 week, uint256 prizePool, uint256 participants, uint256 winner, uint256 winnerAmount)'
];

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

export async function GET() {
  try {
    console.log('Fetching prize pool data from contract...');

    // Get common data from contract
    const commonData = await contract.getCommonData();
    
    // Parse the returned data
    const [currentWeek, currentPrizePool, totalParticipants, weekStartTime] = commonData;
    
    // Convert BigInt values to strings for JSON serialization
    const prizePoolData = {
      currentWeek: Number(currentWeek),
      currentPrizePool: ethers.formatUnits(currentPrizePool, 6), // USDC has 6 decimals
      totalParticipants: Number(totalParticipants),
      weekStartTime: Number(weekStartTime) * 1000, // Convert seconds to milliseconds
      timestamp: new Date().toISOString()
    };

    console.log('Prize pool data:', prizePoolData);

    return NextResponse.json(prizePoolData);

  } catch (error) {
    console.error('Error fetching prize pool data:', error);
    return NextResponse.json({
      error: 'Failed to fetch prize pool data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
