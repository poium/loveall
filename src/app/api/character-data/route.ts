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

// API Rate limiting to prevent runaway calls
const lastCallTime = { value: 0 };
const MIN_INTERVAL = 5000; // 5 seconds minimum between calls

export async function GET(request: NextRequest) {
    try {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime.value;
        
        if (timeSinceLastCall < MIN_INTERVAL) {
            console.log(`🚫 Rate limited! Only ${timeSinceLastCall}ms since last call (min: ${MIN_INTERVAL}ms)`);
            return NextResponse.json({
                name: '',
                task: '',
                traitNames: [],
                traitValues: [],
                traitCount: 0,
                isSet: false,
                rateLimited: true
            });
        }
        
        lastCallTime.value = now;
        const timestamp = new Date().toISOString();
        console.log(`🚨 [${timestamp}] /api/character-data called! Caller info:`, {
            userAgent: request.headers.get('user-agent'),
            referer: request.headers.get('referer'),
            origin: request.headers.get('origin'),
            url: request.url
        });
        console.log('Fetching character data from contract...');

        // Get character data with retry
        let characterData = {
            name: '',
            task: '',
            traitNames: [],
            traitValues: [],
            traitCount: 0,
            isSet: false
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const data = await contract.getCurrentCharacter();
                
                // Parse the returned data
                const [name, task, traitNames, traitValues, traitCount, isSet] = data;
                
                // Process only active traits
                const activeTraitNames = [];
                const activeTraitValues = [];
                
                for (let i = 0; i < Number(traitCount); i++) {
                    if (traitNames[i] && traitNames[i] !== '') {
                        activeTraitNames.push(traitNames[i]);
                        activeTraitValues.push(Number(traitValues[i]));
                    }
                }

                characterData = {
                    name: name,
                    task: task,
                    traitNames: activeTraitNames,
                    traitValues: activeTraitValues,
                    traitCount: Number(traitCount),
                    isSet: isSet
                };
                
                console.log('Character data fetched successfully:', characterData);
                break;
            } catch (error: any) {
                console.log(`Character data fetch failed (attempt ${attempt}):`, error);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.log('All character data fetch attempts failed, using fallback data');
                    // Use fallback data if all attempts fail
                    characterData = {
                        name: '',
                        task: '',
                        traitNames: [],
                        traitValues: [],
                        traitCount: 0,
                        isSet: false
                    };
                } else {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        }

        return NextResponse.json({
            ...characterData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching character data:', error);
        return NextResponse.json({
            error: 'Failed to fetch character data',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
