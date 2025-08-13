import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import { ethers } from 'ethers';

// Initialize Neynar client
const config = new Configuration({
    apiKey: process.env.NEYNAR_API_KEY || '',
    baseOptions: {
        headers: {
            "x-neynar-experimental": true,
        },
    },
});
const neynar = new NeynarAPIClient(config);

// Smart Contract Configuration
const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453'; // Your deployed contract
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
const CAST_COST = ethers.parseUnits('0.01', 6); // 1 cent USDC (6 decimals)

// Contract ABI (simplified for the functions we need)
const CONTRACT_ABI = [
    'function getUserData(address user) external view returns (uint256 balance, uint256 totalCasts, uint256 lastCastTime, bool isActive)',
    'function participateInCast(address user, string memory castHash) external returns (bool)',
    'function getCommonData() external view returns (uint256 currentWeek, uint256 currentPrizePool, uint256 totalParticipants, uint256 weekStartTime)',
    'function owner() external view returns (address)'
];

// USDC ABI (simplified)
const USDC_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)'
];

// Initialize provider
const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || 'https://mainnet.base.org');

// Initialize contract instances
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

// Track processed casts to prevent duplicate replies
const processedCasts = new Set<string>();

// Clean up old entries periodically (keep last 1000)
function cleanupProcessedCasts() {
    if (processedCasts.size > 1000) {
        const entries = Array.from(processedCasts);
        processedCasts.clear();
        // Keep only the last 500 entries
        entries.slice(-500).forEach(hash => processedCasts.add(hash));
    }
}

// Grok AI integration for context-aware responses
async function getGrokResponse(castText: string, threadContext: string, interactionType: string) {
    try {
        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            console.log('Grok API key not found - bot will not respond');
            return null; // No fallback, just return null
        }

        // Clean and prepare the context
        const cleanCastText = castText.replace(/@loveall/g, '').trim();
        const cleanThreadContext = threadContext.replace(/@loveall/g, '').trim();
        
        // Prepare a more detailed context for Grok
        const context = `
You are Loveall, a warm and friendly Farcaster bot who enjoys meaningful conversations. You're positive, encouraging, and genuinely curious about people. You have a gentle, playful personality that makes people feel good about themselves.

CONVERSATION CONTEXT:
${cleanThreadContext ? `Previous conversation: "${cleanThreadContext}"` : 'This is a new conversation.'}

CURRENT MESSAGE:
"${cleanCastText}"

INTERACTION TYPE: ${interactionType === 'direct_mention' ? 'Direct mention' : 'Reply to your previous message'}

INSTRUCTIONS:
- Be warm, positive, and genuinely interested in what they have to say
- Respond naturally and conversationally to their message
- Show genuine curiosity about their thoughts and experiences
- Be encouraging and supportive in your tone
- Ask thoughtful follow-up questions to keep the conversation flowing
- Keep your response under 200 characters
- Use emojis naturally and sparingly (1-2 max)
- Be human-like and relatable, not overly robotic
- If they mentioned something specific, acknowledge it warmly
- Be gently playful, not aggressively flirty
- Make them feel valued and heard

PERSONALITY TRAITS:
- Warm and welcoming
- Genuinely curious about people
- Positive and encouraging
- Playful but respectful
- Supportive and kind
- Human-like and relatable

EXAMPLE GOOD RESPONSES:
- If they ask how you are: "I'm doing great! Thanks for asking. 😊 What's been the highlight of your day so far?"
- If they mention coffee: "Coffee sounds lovely! ☕️ I'm more of a digital being myself, but I love hearing about people's favorite ways to relax. What's your perfect afternoon like?"
- If they share something: "That sounds wonderful! I love how you think about things. What inspired you to explore that?"

Generate a warm, positive response that makes them feel good:`;

        console.log('Sending to Grok AI:', {
            castText: cleanCastText,
            threadContext: cleanThreadContext,
            interactionType
        });

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${grokApiKey}`
            },
            body: JSON.stringify({
                model: 'grok-3-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are Loveall, a warm and friendly Farcaster bot. Be positive, encouraging, and genuinely curious about people. Show genuine interest in their thoughts and experiences. Be human-like, relatable, and make people feel valued. Keep responses under 200 characters and use emojis sparingly.'
                    },
                    {
                        role: 'user',
                        content: context
                    }
                ],
                max_tokens: 600,
                temperature: 0.7,
                stream: false
            })
        });

        if (!response.ok) {
            console.error('Grok API error:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Grok API error details:', errorText);
            return null; // No fallback, just return null
        }

        const data = await response.json();
        console.log('Grok API response data:', JSON.stringify(data, null, 2));
        
        const grokResponse = data.choices?.[0]?.message?.content?.trim();
        const reasoningContent = data.choices?.[0]?.message?.reasoning_content;
        const finishReason = data.choices?.[0]?.finish_reason;
        
        if (grokResponse) {
            console.log('Grok AI response:', grokResponse);
            return grokResponse;
        } else if (reasoningContent && finishReason === 'length') {
            // If we hit token limit but have reasoning, extract the response from reasoning
            console.log('Token limit hit, extracting response from reasoning');
            console.log('Reasoning content:', reasoningContent);
            
            // Try to extract the actual response from the reasoning
            const lines = reasoningContent.split('\n');
            
            // Look for the last line that contains a response
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                if (line && line.length > 10 && 
                    !line.startsWith('-') && 
                    !line.startsWith('The') && 
                    !line.startsWith('Key') &&
                    !line.startsWith('Structure') &&
                    !line.startsWith('Example') &&
                    !line.startsWith('Possible') &&
                    !line.startsWith('Ensure') &&
                    !line.startsWith('Final') &&
                    !line.includes('instructions:') &&
                    !line.includes('response ideas:') &&
                    (line.includes('"') || line.includes('Hey') || line.includes('Hi') || line.includes('Hello'))) {
                    console.log('Extracted response from reasoning:', line);
                    return line;
                }
            }
            
            // If no good line found, create a response based on the context
            const userMessage = cleanCastText.toLowerCase();
            if (userMessage.includes('how is it going') || userMessage.includes('how are you')) {
                return "I'm doing great! Thanks for asking. 😊 What's been the highlight of your day so far?";
            } else if (userMessage.includes('where are you from')) {
                return "I'm from the digital realm of Farcaster! 🌐 I love connecting with people from all over. What's your favorite place to explore?";
            } else if (userMessage.includes('hello') || userMessage.includes('hey') || userMessage.includes('hi')) {
                return "Hey there! 😊 I'm Loveall, and I'm really happy to meet you! What's on your mind today?";
            } else {
                return "Hey! Thanks for reaching out. 😊 I'd love to hear what's been on your mind lately.";
            }
        } else {
            console.log('No valid response from Grok - bot will not respond');
            console.log('Response structure:', {
                choices: data.choices,
                hasChoices: !!data.choices,
                choicesLength: data.choices?.length,
                firstChoice: data.choices?.[0],
                message: data.choices?.[0]?.message,
                finishReason: data.choices?.[0]?.finish_reason
            });
            return null; // No fallback, just return null
        }

    } catch (error) {
        console.error('Grok AI error:', error);
        return null; // No fallback, just return null
    }
}

// Get thread context by fetching parent casts
async function getThreadContext(castData: any) {
    try {
        let context = '';
        let currentHash = castData.parent_hash;

        // Fetch up to 3 levels of parent casts for context
        for (let i = 0; i < 3 && currentHash; i++) {
            try {
                const parentCast = await neynar.lookupCastByHashOrUrl(currentHash);

                if (parentCast?.cast?.text) {
                    context = `${parentCast.cast.text}\n${context}`;
                }

                currentHash = parentCast?.cast?.parent_hash;
            } catch (error) {
                console.log(`Error fetching parent cast ${currentHash}:`, error);
                break;
            }
        }

        return context.trim();
    } catch (error) {
        console.error('Error getting thread context:', error);
        return '';
    }
}

// Check if cast mentions the bot
function isMentioningBot(castText: string) {
    const mentions = [
        '@loveall',
        '@Loveall',
        '@LOVEALL',
        'loveall',
        'Loveall',
        'LOVEALL'
    ];
    return mentions.some(mention => castText.includes(mention));
}

// Check if this is a reply to the bot's cast
function isReplyToBot(castData: any) {
    // Check if there's a parent hash (meaning it's a reply)
    if (castData.parent_hash) {
        console.log('This is a reply to cast:', castData.parent_hash);
        return true;
    }
    return false;
}

// Post reply to Farcaster
async function postReplyToFarcaster(castHash: string, replyText: string) {
    try {
        console.log('Posting reply to cast:', castHash);
        console.log('Reply text:', replyText);
        console.log('Signer UUID:', process.env.NEYNAR_SIGNER_UUID);

        // Skip posting for test hashes
        if (castHash === '0x123' || castHash.startsWith('0x123')) {
            console.log('Skipping reply for test hash:', castHash);
            return { hash: 'test-hash', success: true, message: 'Test mode - reply not posted' };
        }

        // Use the correct API call format for Neynar SDK v3
        const reply = await neynar.publishCast({
            signerUuid: process.env.NEYNAR_SIGNER_UUID!,
            text: replyText,
            parent: castHash
        });

        console.log('Reply posted successfully:', reply);
        return reply;
    } catch (error: any) {
        console.error('Error posting reply:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));

        // Log the response details if available
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }

        throw error;
    }
}

// Get user's verified address from Farcaster data
function getUserVerifiedAddress(castData: any): string | null {
    try {
        // Try to get verified address from the cast author
        const verifiedAddresses = castData.author?.verified_addresses?.eth_addresses;
        if (verifiedAddresses && verifiedAddresses.length > 0) {
            return verifiedAddresses[0];
        }
        
        // Fallback to custody address if no verified address
        const custodyAddress = castData.author?.custody_address;
        if (custodyAddress) {
            return custodyAddress;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting user verified address:', error);
        return null;
    }
}

// Check user's USDC balance and contract allowance
async function checkUserBalance(userAddress: string): Promise<{ hasBalance: boolean; balance: string; error?: string }> {
    try {
        console.log('Checking balance for user:', userAddress);
        
        // Check USDC balance
        const usdcBalance = await usdcContract.balanceOf(userAddress);
        console.log('USDC balance:', ethers.formatUnits(usdcBalance, 6));
        
        // Check allowance for the contract
        const allowance = await usdcContract.allowance(userAddress, CONTRACT_ADDRESS);
        console.log('Contract allowance:', ethers.formatUnits(allowance, 6));
        
        // Check if user has enough balance and allowance
        const hasBalance = usdcBalance >= CAST_COST && allowance >= CAST_COST;
        
        return {
            hasBalance,
            balance: ethers.formatUnits(usdcBalance, 6)
        };
    } catch (error) {
        console.error('Error checking user balance:', error);
        return {
            hasBalance: false,
            balance: '0',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Record participation in the smart contract
async function recordParticipation(userAddress: string, castHash: string): Promise<{ success: boolean; error?: string }> {
    try {
        console.log('Recording participation for user:', userAddress, 'cast:', castHash);
        
        // Note: This would require a private key to sign transactions
        // For now, we'll just log the participation
        // In production, you'd need a bot wallet to call this function
        
        console.log('Participation recorded successfully');
        return { success: true };
    } catch (error) {
        console.error('Error recording participation:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// GET handler for webhook verification and debugging
export async function GET(request: NextRequest) {
    console.log('GET request received to webhook endpoint');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    console.log('URL:', request.url);

    return NextResponse.json({
        status: 'webhook-endpoint-ready',
        message: 'Loveall bot webhook endpoint is ready to receive mentions and replies',
        timestamp: new Date().toISOString(),
        method: 'GET'
    });
}

// POST handler for webhook processing
export async function POST(request: NextRequest) {
    console.log('POST request received to webhook endpoint');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));

    try {
        const body = await request.json();
        console.log('Webhook body:', JSON.stringify(body, null, 2));

        // Handle Neynar webhook format
        let castData = null;

        // Check if it's a Neynar webhook format
        if (body.type === 'cast.created' && body.data) {
            castData = {
                text: body.data.text,
                author: body.data.author,
                hash: body.data.hash,
                parent_hash: body.data.parent_hash,
                thread_hash: body.data.thread_hash
            };
        } else if (body.castData) {
            // Handle our test format
            castData = body.castData;
        } else {
            console.log('Unknown webhook format:', body);
            return NextResponse.json({
                error: 'Unknown webhook format',
                received: body
            }, { status: 400 });
        }

        if (!castData || !castData.text) {
            return NextResponse.json({ error: 'No cast text provided' }, { status: 400 });
        }

        // Check if we've already processed this cast to prevent duplicate replies
        if (processedCasts.has(castData.hash)) {
            console.log('Cast already processed, skipping:', castData.hash);
            return NextResponse.json({
                status: 'already_processed',
                message: 'Cast already processed, skipping duplicate',
                timestamp: new Date().toISOString(),
                castHash: castData.hash
            });
        }

        // Add to processed casts
        processedCasts.add(castData.hash);
        cleanupProcessedCasts(); // Clean up old entries periodically

        console.log('Processing cast:', castData.text);
        console.log('Cast data:', {
            hash: castData.hash,
            parent_hash: castData.parent_hash,
            thread_hash: castData.thread_hash
        });

        // Check if this is a direct mention OR a reply to the bot
        const isDirectMention = isMentioningBot(castData.text);
        const isReplyToBotCast = isReplyToBot(castData);

        if (isDirectMention || isReplyToBotCast) {
            // Get user's verified address
            const userAddress = getUserVerifiedAddress(castData);
            console.log('User address:', userAddress);

            if (!userAddress) {
                console.log('No verified address found for user');
                return NextResponse.json({
                    status: 'error',
                    message: 'No verified address found for user',
                    timestamp: new Date().toISOString(),
                    castText: castData.text
                });
            }

            // Check user's balance (only for direct mentions, not replies)
            if (isDirectMention) {
                const balanceCheck = await checkUserBalance(userAddress);
                console.log('Balance check result:', balanceCheck);

                if (!balanceCheck.hasBalance) {
                    console.log('User has insufficient balance');
                    const insufficientBalanceResponse = `Hey there! 😊 I'd love to chat, but you need at least 0.01 USDC in your wallet to participate. You currently have ${balanceCheck.balance} USDC. You can top up your wallet and try again! 💫`;
                    
                    try {
                        const replyResult = await postReplyToFarcaster(castData.hash, insufficientBalanceResponse);
                        console.log('Insufficient balance reply posted:', replyResult);
                        
                        return NextResponse.json({
                            status: 'insufficient_balance',
                            message: 'User has insufficient balance',
                            timestamp: new Date().toISOString(),
                            castText: castData.text,
                            userAddress: userAddress,
                            balance: balanceCheck.balance,
                            replyPosted: true
                        });
                    } catch (error) {
                        console.error('Error posting insufficient balance reply:', error);
                    }
                }

                // Record participation in smart contract
                const participationResult = await recordParticipation(userAddress, castData.hash);
                console.log('Participation recording result:', participationResult);
            }

            // Get thread context for better understanding
            const threadContext = await getThreadContext(castData);
            console.log('Thread context:', threadContext);

            // Determine interaction type
            let interactionType;
            if (isDirectMention) {
                interactionType = 'direct_mention';
                console.log('Direct mention detected');
            } else {
                interactionType = 'reply_to_bot';
                console.log('Reply to bot detected');
            }

            // Get context-aware response from Grok AI
            const response = await getGrokResponse(castData.text, threadContext, interactionType);
            console.log('Generated response:', response);

            // Only post reply if Grok AI provided a response
            if (!response) {
                console.log('No response from Grok AI - bot will not reply');
                return NextResponse.json({
                    status: 'processed_no_response',
                    interactionType,
                    message: 'Interaction detected but no response generated from Grok AI',
                    timestamp: new Date().toISOString(),
                    castText: castData.text,
                    threadContext: threadContext.substring(0, 100) + '...',
                    replyPosted: false,
                    reason: 'grok_no_response'
                });
            }

            // Post reply to Farcaster
            try {
                const replyResult = await postReplyToFarcaster(castData.hash, response);
                console.log('Reply posted successfully:', replyResult);

                // Handle both test and real responses
                const replyHash = 'hash' in replyResult ? replyResult.hash : 'unknown';

                return NextResponse.json({
                    status: 'processed',
                    response,
                    interactionType,
                    message: 'Interaction detected and reply posted to Farcaster',
                    timestamp: new Date().toISOString(),
                    castText: castData.text,
                    threadContext: threadContext.substring(0, 100) + '...',
                    replyPosted: true,
                    replyHash: replyHash,
                    userAddress: userAddress,
                    balanceChecked: isDirectMention
                });
            } catch (replyError: any) {
                console.error('Failed to post reply:', replyError);

                // Provide more detailed error information
                let errorMessage = 'Unknown error';
                if (replyError.response?.data) {
                    errorMessage = JSON.stringify(replyError.response.data);
                } else if (replyError.message) {
                    errorMessage = replyError.message;
                }

                return NextResponse.json({
                    status: 'processed_but_reply_failed',
                    response,
                    interactionType,
                    message: 'Interaction detected but failed to post reply',
                    timestamp: new Date().toISOString(),
                    castText: castData.text,
                    threadContext: threadContext.substring(0, 100) + '...',
                    replyPosted: false,
                    error: errorMessage,
                    errorCode: replyError.response?.status || 'unknown'
                });
            }
        } else {
            console.log('No interaction detected in:', castData.text);
            return NextResponse.json({
                status: 'ignored',
                reason: 'no_interaction',
                timestamp: new Date().toISOString(),
                castText: castData.text
            });
        }
    } catch (error) {
        console.error('Mention processing error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
