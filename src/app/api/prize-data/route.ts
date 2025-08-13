import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';

// Contract ABI for prize pool data
const CONTRACT_ABI = [
    {
        name: 'getCommonData',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [
            {
                components: [
                    { name: 'totalPrizePool', type: 'uint256' },
                    { name: 'currentWeekPrizePool', type: 'uint256' },
                    { name: 'rolloverAmount', type: 'uint256' },
                    { name: 'currentWeek', type: 'uint256' },
                    { name: 'weekStartTime', type: 'uint256' },
                    { name: 'weekEndTime', type: 'uint256' },
                    { name: 'currentWeekParticipantsCount', type: 'uint256' },
                    { name: 'currentWeekWinner', type: 'address' },
                    { name: 'currentWeekPrize', type: 'uint256' }
                ],
                name: '',
                type: 'tuple'
            }
        ]
    }
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
            currentWeek: 1,
            currentPrizePool: '0.00',
            totalParticipants: 0,
            weekStartTime: Date.now()
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const data = await contract.getCommonData();
                commonData = {
                    currentWeek: Number(data.currentWeek),
                    currentPrizePool: ethers.formatUnits(data.currentWeekPrizePool, 6),
                    totalParticipants: Number(data.currentWeekParticipantsCount),
                    weekStartTime: Number(data.weekStartTime) * 1000 // Convert to milliseconds
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
                        currentWeek: 1,
                        currentPrizePool: '0.00',
                        totalParticipants: 0,
                        weekStartTime: Date.now()
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
