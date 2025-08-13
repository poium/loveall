import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Contract ABI
const CONTRACT_ABI = [
    {
        name: 'getUserData',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
            {
                components: [
                    { name: 'balance', type: 'uint256' },
                    { name: 'hasSufficientBalance', type: 'bool' },
                    { name: 'hasParticipatedThisWeek', type: 'bool' },
                    { name: 'participationsCount', type: 'uint256' },
                    {
                        components: [
                            { name: 'user', type: 'address' },
                            { name: 'castHash', type: 'bytes32' },
                            { name: 'timestamp', type: 'uint256' },
                            { name: 'weekNumber', type: 'uint256' },
                            { name: 'usdcAmount', type: 'uint256' },
                            { name: 'isEvaluated', type: 'bool' }
                        ],
                        name: 'participations',
                        type: 'tuple[]'
                    }
                ],
                name: '',
                type: 'tuple'
            }
        ]
    }
];

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
        
        // Process participations data
        const participations = userData ? userData.participations.map((participation: any) => ({
            user: participation.user,
            castHash: participation.castHash,
            timestamp: Number(participation.timestamp),
            weekNumber: Number(participation.weekNumber),
            usdcAmount: ethers.formatUnits(participation.usdcAmount, 6),
            isEvaluated: participation.isEvaluated
        })) : [];

        // Debug logging
        console.log('User data analysis:', {
            address,
            contractBalance,
            hasSufficientBalance,
            hasParticipatedThisWeek,
            participationsCount,
            canParticipate: hasSufficientBalance && !hasParticipatedThisWeek
        });

        return NextResponse.json({
            address: address,
            contractBalance: contractBalance,
            hasSufficientBalance: hasSufficientBalance,
            hasParticipatedThisWeek: hasParticipatedThisWeek,
            participationsCount: participationsCount,
            participations: participations,
            canParticipate: hasSufficientBalance && !hasParticipatedThisWeek,
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
