import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';

// Contract ABI (import the full ABI)
import CONTRACT_ABI_JSON from '../../../../contracts/abi.json';
const CONTRACT_ABI = CONTRACT_ABI_JSON;

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

// Function to switch RPC endpoint
let currentRpcIndex = 0;
function switchRpcEndpoint() {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    const newRpcUrl = RPC_ENDPOINTS[currentRpcIndex];
    console.log(`Switching RPC endpoint to: ${newRpcUrl}`);
    provider = new ethers.JsonRpcProvider(newRpcUrl);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

export async function GET(request: NextRequest) {
    try {
        console.log('Fetching prize pool data from contract...');

        // Get common data with retry (optimized - single RPC call)
        let commonData = {
            totalPrizePool: '0.00',
            currentWeekPrizePool: '0.00',
            rolloverAmount: '0.00',
            totalContributions: '0.00',
            totalProtocolFees: '0.00',
            castCost: '0.01',
            currentWeek: 1,
            weekStartTime: Date.now(),
            weekEndTime: Date.now() + (2 * 60 * 60 * 1000), // 2 hours from now
            currentWeekParticipantsCount: 0,
            currentWeekWinner: '0x0000000000000000000000000000000000000000',
            currentWeekPrize: '0.00',
            characterName: '',
            characterTask: '',
            characterIsSet: false
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const data = await contract.getCommonData();
                commonData = {
                    totalPrizePool: ethers.formatUnits(data.totalPrizePool, 6),
                    currentWeekPrizePool: ethers.formatUnits(data.currentWeekPrizePool, 6),
                    rolloverAmount: ethers.formatUnits(data.rolloverAmount, 6),
                    totalContributions: ethers.formatUnits(data.totalContributions, 6),
                    totalProtocolFees: ethers.formatUnits(data.totalProtocolFees, 6),
                    castCost: ethers.formatUnits(data.castCost, 6),
                    currentWeek: Number(data.currentWeek),
                    weekStartTime: Number(data.weekStartTime) * 1000, // Convert to milliseconds
                    weekEndTime: Number(data.weekEndTime) * 1000, // Convert to milliseconds
                    currentWeekParticipantsCount: Number(data.currentWeekParticipantsCount),
                    currentWeekWinner: data.currentWeekWinner,
                    currentWeekPrize: ethers.formatUnits(data.currentWeekPrize, 6),
                    characterName: data.characterName,
                    characterTask: data.characterTask,
                    characterIsSet: data.characterIsSet
                };
                console.log('Prize pool data fetched successfully:', commonData);
                break;
            } catch (error: any) {
                console.log(`Prize pool data fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All prize pool data fetch attempts failed, using fallback data');
                    // Use fallback data if all attempts fail
                    commonData = {
                        totalPrizePool: '0.00',
                        currentWeekPrizePool: '0.00',
                        rolloverAmount: '0.00',
                        totalContributions: '0.00',
                        totalProtocolFees: '0.00',
                        castCost: '0.01',
                        currentWeek: 1,
                        weekStartTime: Date.now(),
                        weekEndTime: Date.now() + (2 * 60 * 60 * 1000),
                        currentWeekParticipantsCount: 0,
                        currentWeekWinner: '0x0000000000000000000000000000000000000000',
                        currentWeekPrize: '0.00',
                        characterName: '',
                        characterTask: '',
                        characterIsSet: false
                    };
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        return NextResponse.json({
            ...commonData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching prize pool data:', error);
        return NextResponse.json({
            error: 'Failed to fetch prize pool data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
