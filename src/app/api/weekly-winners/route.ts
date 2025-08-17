import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';

// Contract ABI for weekly winners
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
    },
    {
        name: 'getWeeklySummary',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'week', type: 'uint256' }],
        outputs: [
            { name: 'participants', type: 'address[]' },
            { name: 'winner', type: 'address' },
            { name: 'prize', type: 'uint256' },
            { name: 'participantsCount', type: 'uint256' }
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
        console.log('Fetching weekly winners data');

        // Get current week with retry
        let currentWeek = 0;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const data = await contract.getCommonData();
                currentWeek = Number(data.currentWeek);
                console.log('Current week fetched successfully:', currentWeek);
                break;
            } catch (error: any) {
                console.log(`Current week fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All current week fetch attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Fetch winners for all weeks up to current week
        const winners = [];
        const maxWeeksToCheck = Math.min(currentWeek, 10); // Limit to last 10 weeks for performance

        for (let week = 1; week <= maxWeeksToCheck; week++) {
            try {
                const summary = await contract.getWeeklySummary(week);
                
                if (summary.winner !== ethers.ZeroAddress) {
                    winners.push({
                        week: week,
                        winner: summary.winner,
                        prize: ethers.formatUnits(summary.prize, 6),
                        participantsCount: Number(summary.participantsCount),
                        timestamp: Date.now() // We don't have timestamp in contract, using current time
                    });
                }
            } catch (error: any) {
                console.log(`Failed to fetch winner for week ${week}:`, error);
                // Continue with next week
            }
        }

        // Sort winners by week (newest first)
        winners.sort((a, b) => b.week - a.week);

        return NextResponse.json({
            winners: winners,
            currentWeek: currentWeek,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching weekly winners:', error);
        return NextResponse.json({
            error: 'Failed to fetch weekly winners',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
