import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';

// Contract ABI for admin functions
const CONTRACT_ABI = [
    {
        name: 'owner',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'address' }]
    },
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
        name: 'getRolloverAmount',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
    },
    {
        name: 'totalPrizePool',
        type: 'function',
        stateMutability: 'view',
        inputs: [],
        outputs: [{ name: '', type: 'uint256' }]
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
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({
                error: 'Address parameter is required',
                example: '/api/admin-data?address=0x...'
            }, { status: 400 });
        }

        // Validate address format
        if (!ethers.isAddress(address)) {
            return NextResponse.json({
                error: 'Invalid address format'
            }, { status: 400 });
        }

        console.log('Fetching admin data for address:', address);

        // Check if user is contract owner with retry
        let isOwner = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const owner = await contract.owner();
                isOwner = owner.toLowerCase() === address.toLowerCase();
                console.log('Owner check successful:', isOwner);
                break;
            } catch (error: any) {
                console.log(`Owner check failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All owner check attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Get common data with retry
        let commonData = {
            currentWeek: 0,
            currentPrizePool: '0',
            totalParticipants: 0,
            weekStartTime: 0
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const data = await contract.getCommonData();
                commonData = {
                    currentWeek: Number(data.currentWeek),
                    currentPrizePool: ethers.formatUnits(data.currentWeekPrizePool, 6),
                    totalParticipants: Number(data.currentWeekParticipantsCount),
                    weekStartTime: Number(data.weekStartTime)
                };
                console.log('Common data fetched successfully');
                break;
            } catch (error: any) {
                console.log(`Common data fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All common data fetch attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Get rollover amount with retry
        let rolloverAmount = '0';
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const rollover = await contract.getRolloverAmount();
                rolloverAmount = ethers.formatUnits(rollover, 6);
                console.log('Rollover amount fetched successfully');
                break;
            } catch (error: any) {
                console.log(`Rollover amount fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All rollover amount fetch attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Get total prize pool with retry
        let totalPrizePool = '0';
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const total = await contract.getTotalPrizePool();
                totalPrizePool = ethers.formatUnits(total, 6);
                console.log('Total prize pool fetched successfully');
                break;
            } catch (error: any) {
                console.log(`Total prize pool fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All total prize pool fetch attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        return NextResponse.json({
            address: address,
            isOwner: isOwner,
            currentWeek: commonData.currentWeek,
            currentPrizePool: commonData.currentPrizePool,
            totalParticipants: commonData.totalParticipants,
            weekStartTime: commonData.weekStartTime,
            rolloverAmount: rolloverAmount,
            totalPrizePool: totalPrizePool,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching admin data:', error);
        return NextResponse.json({
            error: 'Failed to fetch admin data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
