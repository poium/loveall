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

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

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

        // Check USDC balance
        const usdcBalance = await usdcContract.balanceOf(address);
        const balanceFormatted = ethers.formatUnits(usdcBalance, 6);

        // Check allowance for the contract
        const allowance = await usdcContract.allowance(address, CONTRACT_ADDRESS);
        const allowanceFormatted = ethers.formatUnits(allowance, 6);

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
