import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getBotUserData } from '@/lib/bot-data';

const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// USDC ABI for allowance check
const USDC_ABI = [
    {
        name: 'allowance',
        type: 'function',
        stateMutability: 'view',
        inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
        ],
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
let usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

// Function to switch RPC endpoint
let currentRpcIndex = 0;
function switchRpcEndpoint() {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    const newRpcUrl = RPC_ENDPOINTS[currentRpcIndex];
    console.log(`Switching RPC endpoint to: ${newRpcUrl}`);
    provider = new ethers.JsonRpcProvider(newRpcUrl);
    usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const address = searchParams.get('address');

        if (!address) {
            return NextResponse.json({
                error: 'Address parameter is required',
                example: '/api/check-allowance?address=0x...'
            }, { status: 400 });
        }

        // Validate address format
        if (!ethers.isAddress(address)) {
            return NextResponse.json({
                error: 'Invalid address format'
            }, { status: 400 });
        }

        console.log('Checking allowance for address:', address);

        // Use cache-first approach (same as bot for consistency)
        const userData = await getBotUserData(address);
        const allowance = userData.allowance;
        console.log('✅ Allowance retrieved from', userData.source, ':', allowance);

        return NextResponse.json({
            address: address,
            allowance: allowance,
            contractAddress: CONTRACT_ADDRESS,
            usdcAddress: USDC_ADDRESS,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error checking allowance:', error);
        return NextResponse.json({
            error: 'Failed to check allowance',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
