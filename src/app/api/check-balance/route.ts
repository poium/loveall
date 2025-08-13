import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// USDC ABI
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

        // Check USDC balance with retry
        let usdcBalance = ethers.parseUnits('0', 6);
        let balanceFormatted = '0';
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                usdcBalance = await usdcContract.balanceOf(address);
                balanceFormatted = ethers.formatUnits(usdcBalance, 6);
                break;
            } catch (error: any) {
                console.log(`Balance check failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All balance check attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Check allowance for the contract with retry
        let allowance = ethers.parseUnits('0', 6);
        let allowanceFormatted = '0';
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                allowance = await usdcContract.allowance(address, CONTRACT_ADDRESS);
                allowanceFormatted = ethers.formatUnits(allowance, 6);
                break;
            } catch (error: any) {
                console.log(`Allowance check failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All allowance check attempts failed');
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        // Check if user has enough balance and allowance for 1 cent
        const CAST_COST = ethers.parseUnits('0.01', 6);
        const hasEnoughBalance = usdcBalance >= CAST_COST;
        const hasEnoughAllowance = allowance >= CAST_COST;

        return NextResponse.json({
            address: address,
            usdcBalance: balanceFormatted,
            contractAllowance: allowanceFormatted,
            hasEnoughBalance: hasEnoughBalance,
            hasEnoughAllowance: hasEnoughAllowance,
            canParticipate: hasEnoughBalance && hasEnoughAllowance,
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
