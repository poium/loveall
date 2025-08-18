import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';

// Contract ABI for getting participation data
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
        name: 'getMultipleUsersData',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'users', type: 'address[]' }],
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
                type: 'tuple[]'
            }
        ]
    },
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

// Initialize provider with RPC fallback
const RPC_ENDPOINTS = [
    process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    'https://base.blockpi.network/v1/rpc/public',
    'https://1rpc.io/base',
    'https://base.meowrpc.com',
    'https://base.drpc.org'
];

let currentRpcIndex = 0;
let provider = new ethers.JsonRpcProvider(RPC_ENDPOINTS[currentRpcIndex]);
let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);

function switchRpcEndpoint() {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    const newRpcUrl = RPC_ENDPOINTS[currentRpcIndex];
    console.log(`Switching RPC endpoint to: ${newRpcUrl}`);
    provider = new ethers.JsonRpcProvider(newRpcUrl);
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
}

// Grok AI evaluation function
async function evaluateCastWithAI(castText: string, castHash: string, userAddress: string) {
    try {
        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            console.log('Grok API key not found');
            return {
                score: 0,
                evaluation: 'AI evaluation not available',
                error: 'Grok API key not configured'
            };
        }

        // Prepare evaluation prompt
        const evaluationPrompt = `
You are an expert judge evaluating Farcaster casts for a weekly prize pool competition. 

CAST TO EVALUATE:
"${castText}"

CAST HASH: ${castHash}
USER ADDRESS: ${userAddress}

Please evaluate this cast based on the following criteria (score 1-10 for each):

1. CONTENT QUALITY (1-10): How well-written, engaging, and meaningful is the content?
2. CREATIVITY (1-10): How original, innovative, or creative is the cast?
3. RELEVANCE (1-10): How relevant is it to the Loveall community and prize pool theme?
4. ENGAGEMENT POTENTIAL (1-10): How likely is it to generate meaningful discussions?
5. OVERALL IMPACT (1-10): What's the overall positive impact and value?

Provide your response in this exact JSON format:
{
    "scores": {
        "contentQuality": [score],
        "creativity": [score],
        "relevance": [score],
        "engagementPotential": [score],
        "overallImpact": [score]
    },
    "totalScore": [sum of all scores],
    "evaluation": "[2-3 sentence detailed evaluation]",
    "recommendation": "[winner/runner-up/participant]"
}
`;

        // Call Grok AI API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${grokApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'mixtral-8x7b-32768',
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert judge for a Farcaster prize pool competition. Provide fair, detailed evaluations in the exact JSON format requested.'
                    },
                    {
                        role: 'user',
                        content: evaluationPrompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            throw new Error(`Grok API error: ${response.status}`);
        }

        const data = await response.json();
        const evaluationText = data.choices[0].message.content;
        
        // Parse JSON response
        const evaluation = JSON.parse(evaluationText);
        
        return {
            score: evaluation.totalScore,
            evaluation: evaluation.evaluation,
            scores: evaluation.scores,
            recommendation: evaluation.recommendation
        };

    } catch (error) {
        console.error('AI evaluation error:', error);
        return {
            score: 0,
            evaluation: 'Evaluation failed',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { week } = body;

        if (!week) {
            return NextResponse.json({
                error: 'Week parameter is required'
            }, { status: 400 });
        }

        console.log('Evaluating casts for week:', week);

        // Get current week data with RPC fallback
        let commonData;
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                commonData = await contract.getCommonData();
                console.log('Common data fetched successfully');
                break;
            } catch (error: any) {
                console.log(`Common data fetch failed (attempt ${attempt}):`, error.message);
                if (attempt === 2) {
                    switchRpcEndpoint();
                }
                if (attempt === 3) {
                    console.error('All common data fetch attempts failed');
                    return NextResponse.json({
                        error: 'Failed to fetch contract data'
                    }, { status: 500 });
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        const currentWeek = Number(commonData.currentWeek);
        
        if (week > currentWeek) {
            return NextResponse.json({
                error: 'Cannot evaluate future weeks'
            }, { status: 400 });
        }

        // Get all users who participated this week
        // Since we don't have getWeeklyParticipants, we'll need to get this data differently
        // For now, let's get the current week participants count and create a simple evaluation
        const participantsCount = Number(commonData.currentWeekParticipantsCount);
        
        if (participantsCount === 0) {
            return NextResponse.json({
                message: 'No participants found for this week',
                participants: [],
                evaluations: []
            });
        }

        console.log(`Found ${participantsCount} participants for week ${week}`);

        // For now, let's create a simple evaluation without AI since we don't have participant addresses
        // In a real implementation, you'd need to track participant addresses or modify the contract
        const evaluations = [];
        
        // Create a mock evaluation for demonstration
        const mockEvaluation = {
            userAddress: '0x0000000000000000000000000000000000000000', // Placeholder
            castHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            timestamp: Date.now(),
            evaluation: {
                score: 35,
                evaluation: 'This is a placeholder evaluation. In a real implementation, you would need to track participant addresses and their casts to perform AI evaluation.',
                scores: {
                    contentQuality: 7,
                    creativity: 7,
                    relevance: 7,
                    engagementPotential: 7,
                    overallImpact: 7
                },
                recommendation: 'participant'
            }
        };

        evaluations.push(mockEvaluation);

        return NextResponse.json({
            week: week,
            totalParticipants: participantsCount,
            evaluations: evaluations,
            winner: evaluations[0],
            timestamp: new Date().toISOString(),
            note: 'This is a demonstration evaluation. To implement full AI evaluation, you need to track participant addresses and their cast content.'
        });

    } catch (error) {
        console.error('Cast evaluation error:', error);
        return NextResponse.json({
            error: 'Failed to evaluate casts',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
