import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';
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

        // Get USDC allowance with retry
        let allowance = '0';
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const allowanceResult = await usdcContract.allowance(address, CONTRACT_ADDRESS);
                allowance = ethers.formatUnits(allowanceResult, 6);
                console.log('Allowance fetched successfully:', allowance);
                break;
            } catch (error: any) {
                console.log(`Allowance fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All allowance fetch attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

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
