import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import { ethers } from 'ethers';
import { 
    responseCache, 
    checkMultipleAddressesParallel, 
    getInstantResponse,
    performanceMonitor,
    grokCircuitBreaker 
} from '@/lib/bot-optimizations';
import { requestDeduplicator } from '@/lib/request-deduplication';
import { balanceManager } from '@/lib/balance-manager';
import { requestQueue } from '@/lib/request-queue';
import { getBotUserData, getBotCommonData } from '@/lib/bot-data';

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
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa'; // LoveallPrizePool on Base Mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
// Cast cost is now dynamic and fetched from contract

// Contract ABI (use full ABI for better compatibility)
const CONTRACT_ABI = require('@/abi.json');

// USDC ABI (simplified)
const USDC_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function allowance(address owner, address spender) external view returns (uint256)'
];

// Helper function to get user's FID from address
async function getUserFid(userAddress: string): Promise<number | null> {
    try {
        console.log('Getting FID for address:', userAddress);
        const response = await neynar.fetchBulkUsersByEthOrSolAddress({ addresses: [userAddress] });
        
        if (response && response[userAddress] && response[userAddress].length > 0) {
            const fid = response[userAddress][0].fid;
            console.log('Found FID:', fid, 'for address:', userAddress);
            return fid;
        }
        
        console.log('No FID found for address:', userAddress);
        return null;
    } catch (error) {
        console.error('Error getting FID for address:', userAddress, error);
        return null;
    }
}

// Helper function to generate conversation ID from thread
function getConversationId(castData: any): string {
    // Use thread_hash if available (for replies), otherwise use the cast hash (for original casts)
    const conversationRoot = castData.thread_hash || castData.hash;
    return ethers.keccak256(ethers.toUtf8Bytes(conversationRoot));
}

// Initialize provider with fallback RPC endpoints
const RPC_ENDPOINTS = [
    'https://mainnet.base.org',  // Official Base RPC - most reliable
    'https://base.drpc.org',     // Reliable alternative
    'https://1rpc.io/base',      // Secondary backup
    process.env.BASE_RPC_URL || 'https://mainnet.base.org'
];

let provider: ethers.JsonRpcProvider;

// Function to create provider with fallback
function createProvider(): ethers.JsonRpcProvider {
    const rpcUrl = RPC_ENDPOINTS[0]; // Use primary RPC
    console.log('Using RPC endpoint:', rpcUrl);
    return new ethers.JsonRpcProvider(rpcUrl);
}

// Function to switch to next RPC endpoint
let currentRpcIndex = 0;
function switchRpcEndpoint(): ethers.JsonRpcProvider {
    currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    const newRpcUrl = RPC_ENDPOINTS[currentRpcIndex];
    console.log(`Switching RPC endpoint to: ${newRpcUrl}`);
    return new ethers.JsonRpcProvider(newRpcUrl);
}

provider = createProvider();

// Initialize contract instances
let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
let usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

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

// Grok AI integration - ALWAYS call API for paid users
async function getGrokResponse(castText: string, threadContext: string, interactionType: string, isPaidUser: boolean = false) {
    return await performanceMonitor.measure('grok_response_total', async () => {
        try {
            // 🚨 IMPORTANT: If user has paid, they get REAL AI response - no shortcuts!
            if (isPaidUser) {
                console.log('💰 PAID USER - Bypassing cache, providing fresh AI response');
                // Skip all caching/patterns for paid users - they deserve real AI!
            } else {
                console.log('🆓 FREE/UNPAID USER - Using optimizations');
                
                // 1. Check for instant pattern responses first (0ms response time!)
                const instantResponse = getInstantResponse(castText);
                if (instantResponse) {
                    console.log('⚡ Using instant pattern response for unpaid user');
                    return instantResponse;
                }
                
                // 2. Check response cache (1-5ms response time)
                const cachedResponse = responseCache.get(castText, interactionType);
                if (cachedResponse) {
                    console.log('💾 Using cached response for unpaid user');
                    return cachedResponse;
                }
            }
            
            // 3. Call Grok API (for paid users OR unpaid users with cache miss)
        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            console.log('Grok API key not found - bot will not respond');
                return null;
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

        // Use circuit breaker for Grok API calls with fallback
        const apiResponse = await grokCircuitBreaker.execute(
            async () => {
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

                return await response.json();
            },
            // Fallback function when Grok API fails
            async () => {
                console.log('🔄 Using fallback response due to Grok API failure');
                return {
                    choices: [{
                        message: {
                            content: getFallbackResponse(cleanCastText)
                        }
                    }]
                };
            }
        );
        
        console.log('Grok API response data:', JSON.stringify(apiResponse, null, 2));
        
        const grokResponse = apiResponse.choices?.[0]?.message?.content?.trim();
        const reasoningContent = apiResponse.choices?.[0]?.message?.reasoning_content;
        const finishReason = apiResponse.choices?.[0]?.finish_reason;
        
        if (grokResponse) {
            console.log('Grok AI response:', grokResponse);
            
            // Only cache responses for unpaid users (paid users get fresh responses every time)
            if (!isPaidUser) {
                console.log('💾 Caching response for future unpaid users');
                responseCache.set(castText, interactionType, grokResponse);
            } else {
                console.log('💰 NOT caching - paid user deserves fresh responses');
            }
            
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
                choices: apiResponse.choices,
                hasChoices: !!apiResponse.choices,
                choicesLength: apiResponse.choices?.length,
                firstChoice: apiResponse.choices?.[0],
                message: apiResponse.choices?.[0]?.message,
                finishReason: apiResponse.choices?.[0]?.finish_reason
            });
            return null; // No fallback, just return null
        }

    } catch (error) {
        console.error('Grok AI error:', error);
        return null; // No fallback, just return null
        }
    });
}

// Fallback response when Grok API fails
function getFallbackResponse(castText: string): string {
    const userMessage = castText.toLowerCase();
    
    if (userMessage.includes('how is it going') || userMessage.includes('how are you')) {
        return "I'm doing great! Thanks for asking. 😊 What's been the highlight of your day so far?";
    } else if (userMessage.includes('where are you from')) {
        return "I'm from the digital realm of Farcaster! 🌐 I love connecting with people from all over. What's your favorite place to explore?";
    } else if (userMessage.includes('hello') || userMessage.includes('hey') || userMessage.includes('hi')) {
        return "Hey there! 😊 I'm Loveall, and I'm really happy to meet you! What's on your mind today?";
    } else {
        return "Hey! Thanks for reaching out. 😊 I'd love to hear what's been on your mind lately.";
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
function getUserVerifiedAddresses(castData: any): string[] {
    try {
        const addresses: string[] = [];
        
        // PRIORITIZE PRIMARY ADDRESS FIRST
        const primaryAddress = castData.author?.verified_addresses?.primary?.eth_address;
        if (primaryAddress) {
            addresses.push(primaryAddress);
            console.log('🎯 Using primary address first:', primaryAddress);
        }
        
        // Get all other verified addresses (but skip the primary if already added)
        const verifiedAddresses = castData.author?.verified_addresses?.eth_addresses;
        if (verifiedAddresses && verifiedAddresses.length > 0) {
            for (const addr of verifiedAddresses) {
                if (!addresses.includes(addr)) {
                    addresses.push(addr);
                }
            }
        }
        
        // Add custody address as fallback if no verified addresses
        const custodyAddress = castData.author?.custody_address;
        if (custodyAddress && !addresses.includes(custodyAddress)) {
            addresses.push(custodyAddress);
        }
        
        return addresses;
    } catch (error) {
        console.error('Error getting user addresses:', error);
        return [];
    }
}

// Legacy function for backward compatibility
function getUserVerifiedAddress(castData: any): string | null {
    const addresses = getUserVerifiedAddresses(castData);
    return addresses.length > 0 ? addresses[0] : null;
}

// Check user's contract balance and participation status
async function checkSingleAddressBalance(userAddress: string): Promise<{ 
    hasBalance: boolean; 
    balance: string; 
    hasParticipated: boolean; 
    conversationCount: number;

    remainingConversations: number;
    canParticipate: boolean;
    error?: string 
}> {
    try {
        console.log('Checking user data for address:', userAddress);
        console.log('📋 Using contract address:', CONTRACT_ADDRESS);
        try {
            console.log('🌐 Using RPC endpoint:', provider._getConnection().url);
        } catch (e) {
            console.log('🌐 Using RPC endpoint: [Unable to get URL]');
        }
        
        // Create contract instance
        let contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider);
        
        // Get user data with cache-first approach (much faster!)
        const userData = await getBotUserData(userAddress);
        console.log('✅ User data retrieved from', userData.source, ':', userData);
        
        const {
            balance: balanceFormatted,
            hasSufficientBalance,
            hasParticipatedThisWeek,
            participationsCount,
            conversationCount,
            remainingConversations,
            bestScore,
            bestConversationId,
            totalContributions,
            allowance
        } = userData;
        
        console.log('🔍 Balance:', balanceFormatted, 'USDC (from', userData.source, ')');
        
        // User can participate if they have sufficient balance and remaining conversation slots
        const canParticipate = hasSufficientBalance && remainingConversations > 0;
        
        console.log('Final check for address:', userAddress);
        console.log('- Balance:', balanceFormatted, 'USDC');
        console.log('- Has sufficient balance:', hasSufficientBalance);
        console.log('- Has participated this week:', hasParticipatedThisWeek);
        console.log('- Conversation count:', conversationCount.toString());
        console.log('- Remaining conversations:', remainingConversations.toString());
        console.log('- Can participate:', canParticipate);
        console.log('🐞 DEBUG: Returning hasParticipated as:', hasParticipatedThisWeek);
        
        console.log('🔍 Bot returning from checkSingleAddressBalance:');
        console.log('  - hasBalance (canParticipate):', canParticipate);
        console.log('  - hasSufficientBalance:', hasSufficientBalance);
        console.log('  - remainingConversations:', Number(remainingConversations));
        console.log('  - hasParticipated:', hasParticipatedThisWeek);
        
        return {
            hasBalance: canParticipate,
            balance: balanceFormatted,
            hasParticipated: hasParticipatedThisWeek,
            conversationCount: Number(conversationCount),
            remainingConversations: Number(remainingConversations),
            canParticipate
        };
    } catch (error) {
        console.error('Error checking user data:', error);
        return {
            hasBalance: false,
            balance: '0',
            hasParticipated: false,
            conversationCount: 0,
            remainingConversations: 0,
            canParticipate: false,
            error: 'Failed to check user data'
        };
    }
}

// Optimized: Check all user addresses in parallel
async function checkUserBalance(userAddresses: string[]): Promise<{ 
    hasBalance: boolean; 
    balance: string; 
    bestAddress: string | null;
    allAddresses: Array<{address: string, balance: string, hasBalance: boolean, hasParticipated: boolean}>;
    error?: string 
}> {
    try {
        console.log('⚡ Checking balance for all user addresses in parallel:', userAddresses);
        
        // Use parallel processing for massive speed improvement
        const addressResults = await performanceMonitor.measure('parallel_balance_check', async () => {
            return await checkMultipleAddressesParallel(userAddresses, checkSingleAddressBalance);
        });
        
        let bestAddress: string | null = null;
        let bestBalance = '0';
        
        const formattedResults = addressResults.map((result: any, index: number) => {
            const address = userAddresses[index];
            
            // Track the best address (first one with sufficient balance)
            if (result.hasBalance && !bestAddress) {
                bestAddress = address;
                bestBalance = result.balance;
            }
            
            return {
                address,
                balance: result.balance,
                hasBalance: result.hasBalance,
                hasParticipated: result.hasParticipated
            };
        });
        
        return {
            hasBalance: bestAddress !== null,
            balance: bestBalance,
            bestAddress,
            allAddresses: formattedResults
        };
    } catch (error) {
        console.error('Error checking user balances:', error);
        return {
            hasBalance: false,
            balance: '0',
            bestAddress: null,
            allAddresses: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Process user interaction with concurrency protection
async function processUserInteraction(
    castData: any, 
    userAddresses: string[], 
    isDirectMention: boolean, 
    threadContext: string
): Promise<any> {
    const primaryAddress = userAddresses[0];
    const requestId = `${castData.hash}:${Date.now()}`;
    
    try {
        // 1. Reserve balance FIRST to prevent race conditions
        console.log('🔒 Attempting to reserve balance for user interaction...');
        const reservation = await balanceManager.reserveBalance(primaryAddress, requestId);
        
        if (!reservation.success) {
            console.log('❌ Balance reservation failed:', reservation.error);
            
            // Send insufficient balance message
            const insufficientBalanceResponse = `Hey there! 😊 I'd love to chat, but you need at least 0.01 USDC in your contract balance to participate. ${reservation.error}. Please top up your contract balance on our website and try again! 💫`;
            
            try {
                const replyResult = await postReplyToFarcaster(castData.hash, insufficientBalanceResponse);
                console.log('Insufficient balance reply posted:', replyResult);
                
                return {
                    status: 'insufficient_balance',
                    message: 'User has insufficient balance',
                    timestamp: new Date().toISOString(),
                    castText: castData.text,
                    userAddresses: userAddresses,
                    availableBalance: reservation.availableBalance,
                    replyPosted: true
                };
            } catch (error) {
                console.error('Error posting insufficient balance reply:', error);
                return {
                    status: 'insufficient_balance',
                    message: 'User has insufficient balance',
                    error: 'Failed to post reply'
                };
            }
        }
        
        console.log('✅ Balance reserved successfully:', reservation.reservationId);
        
        // 2. Generate AI response (user has paid, so full AI experience)
        const interactionType = isDirectMention ? 'direct_mention' : 'reply_to_bot';
        console.log(`Interaction type: ${interactionType}`);
        
        const response = await getGrokResponse(castData.text, threadContext, interactionType, true);
        console.log('Generated response for PAID USER:', response);
        
        if (!response) {
            // Release reservation if AI fails
            await balanceManager.releaseReservation(reservation.reservationId!);
            console.log('No response from Grok AI - released reservation');
            
            return {
                status: 'processed_no_response',
                interactionType,
                message: 'Interaction detected but no response generated from Grok AI',
                timestamp: new Date().toISOString(),
                castText: castData.text,
                threadContext: threadContext.substring(0, 100) + '...',
                replyPosted: false,
                reason: 'grok_no_response'
            };
        }
        
        // 3. Record complete conversation on blockchain FIRST
        let conversationResult;
        try {
            console.log('🔗 BLOCKCHAIN FIRST: Recording conversation before Farcaster post...');
            conversationResult = await recordCompleteConversation(
                primaryAddress,
                castData,
                response,
                null // No Farcaster result yet - we'll update this after
            );
            
            if (conversationResult.success) {
                console.log('✅ Blockchain recording successful - user has been charged');
                console.log('💰 Transaction hash:', conversationResult.txHash);
                
                // 4. Now post to Farcaster SECOND (after payment confirmed)
                let replyResult;
                try {
                    console.log('📱 FARCASTER SECOND: Posting reply after blockchain confirmation...');
                    replyResult = await postReplyToFarcaster(castData.hash, response);
                    console.log('✅ Farcaster reply posted successfully:', replyResult);
                    
                    // Success! Release reservation (already charged via blockchain)
                    await balanceManager.releaseReservation(reservation.reservationId!);
                    
                    return {
                        status: 'success',
                        message: 'Conversation recorded on blockchain and reply posted to Farcaster',
                        timestamp: new Date().toISOString(),
                        castText: castData.text,
                        response: response,
                        replyPosted: true,
                        conversationRecorded: true,
                        transactionHash: conversationResult.txHash,
                        userAddress: primaryAddress,
                        order: 'blockchain_first_farcaster_second'
                    };
                    
                } catch (farcasterError) {
                    // 🚨 CRITICAL: User paid, blockchain recorded, but Farcaster failed
                    // This is actually OK - user got what they paid for (blockchain record)
                    console.error('⚠️ Farcaster post failed AFTER blockchain success:', farcasterError);
                    console.log('💡 User still got value: conversation recorded on blockchain');
                    
                    // Release reservation (user was already charged)
                    await balanceManager.releaseReservation(reservation.reservationId!);
                    
                    return {
                        status: 'partial_success',
                        message: 'Conversation recorded on blockchain successfully, but Farcaster post failed',
                        timestamp: new Date().toISOString(),
                        castText: castData.text,
                        response: response,
                        replyPosted: false,
                        conversationRecorded: true,
                        transactionHash: conversationResult.txHash,
                        userAddress: primaryAddress,
                        farcasterError: farcasterError instanceof Error ? farcasterError.message : 'Unknown error',
                        note: 'User received full value - conversation is permanently stored on blockchain'
                    };
                }
                
            } else {
                // Blockchain failed - release reservation (user not charged)
                await balanceManager.releaseReservation(reservation.reservationId!);
                console.error('❌ Blockchain recording failed:', conversationResult.error);
                console.log('💰 User NOT charged - no service delivered');
                
                return {
                    status: 'blockchain_error', 
                    message: 'Blockchain recording failed - user not charged',
                    error: conversationResult.error,
                    replyPosted: false,
                    conversationRecorded: false,
                    userAddress: primaryAddress,
                    note: 'Fair transaction: no payment without service delivery'
                };
            }
            
        } catch (error) {
            // Release reservation on any blockchain error
            await balanceManager.releaseReservation(reservation.reservationId!);
            console.error('Blockchain recording error:', error);
            
            return {
                status: 'blockchain_error',
                message: 'Reply posted but blockchain recording failed',
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
        
    } catch (error) {
        console.error('Error in processUserInteraction:', error);
        
        // Always try to release reservation on any error
        try {
            await balanceManager.releaseReservation(`${primaryAddress}:${requestId}`);
        } catch (releaseError) {
            console.error('Error releasing reservation:', releaseError);
        }
        
        return {
            status: 'error',
            message: 'Internal processing error',
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

// Record complete conversation (user cast + bot reply) in the smart contract  
// Character limits (must match contract constants)
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONVERSATION_LENGTH = 20000;

function truncateMessage(message: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
    if (message.length <= maxLength) {
        return message;
    }
    
    // Truncate and add ellipsis
    const truncated = message.substring(0, maxLength - 3) + '...';
    console.log(`⚠️ Message truncated from ${message.length} to ${truncated.length} characters`);
    return truncated;
}

async function recordCompleteConversation(
    userAddress: string, 
    castData: any, 
    botReply: string, 
    replyResult: any | null // Now nullable since we call this before Farcaster post
): Promise<{ success: boolean; error?: string; txHash?: string }> {
    try {
        console.log('Recording complete conversation for user:', userAddress, 'user cast:', castData.hash);
        
        // Validate and truncate message lengths to prevent contract reverts
        const userContent = truncateMessage(castData.text || '');
        const botContent = truncateMessage(botReply);
        
        if (userContent.length + botContent.length > MAX_CONVERSATION_LENGTH) {
            console.warn('⚠️ Combined message length too long, this conversation may hit gas limits');
        }
        
        // Check if we have the bot's private key
        const botPrivateKey = process.env.PRIVATE_KEY;
        if (!botPrivateKey) {
            console.error('PRIVATE_KEY not found in environment variables');
            return {
                success: false,
                error: 'Bot private key not configured'
            };
        }
        
        // Get user's FID
        const userFid = await getUserFid(userAddress);
        if (!userFid) {
            console.error('Could not get FID for user:', userAddress);
            return {
                success: false,
                error: 'Could not get user FID'
            };
        }
        
        // Generate conversation ID
        const conversationId = getConversationId(castData);
        console.log('Conversation ID:', conversationId);
        
        // Create bot wallet
        const botWallet = new ethers.Wallet(botPrivateKey, provider);
        console.log('Bot wallet address:', botWallet.address);
        
        // Create contract instance with bot wallet
        const contractWithSigner = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, botWallet);
        
        // Call the recordCompleteConversation function with new parameters
        console.log('Calling recordCompleteConversation function...');
        console.log('Parameters:');
        console.log('- User:', userAddress);
        console.log('- FID:', userFid);
        console.log('- Cast Hash:', castData.hash);
        console.log('- Conversation ID:', conversationId);
        console.log('- Cast Content:', castData.text);
        
        // Convert cast hash to proper bytes32 format
        let castHashBytes32 = castData.hash;
        if (!castHashBytes32.startsWith('0x')) {
            castHashBytes32 = '0x' + castHashBytes32;
        }
        
        // Ensure it's exactly 32 bytes (64 hex chars + 0x = 66 total)
        if (castHashBytes32.length < 66) {
            // Pad with zeros on the right to make it 32 bytes
            castHashBytes32 = castHashBytes32.padEnd(66, '0');
        } else if (castHashBytes32.length > 66) {
            // Take first 32 bytes if too long
            castHashBytes32 = castHashBytes32.substring(0, 66);
        }
        
        console.log('Original user hash:', castData.hash);
        console.log('Formatted user hash:', castHashBytes32);
        console.log('User hash length:', castHashBytes32.length);
        
        // Format bot reply hash the same way
        // Handle case where Farcaster post hasn't happened yet (blockchain-first approach)
        let botCastHashBytes32;
        if (replyResult && 'hash' in replyResult) {
            botCastHashBytes32 = replyResult.hash;
        } else {
            // Generate a placeholder hash for blockchain-first approach
            botCastHashBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
            console.log('🔗 BLOCKCHAIN FIRST: Using placeholder bot cast hash (Farcaster post will happen after blockchain)');
        }
        if (!botCastHashBytes32.startsWith('0x')) {
            botCastHashBytes32 = '0x' + botCastHashBytes32;
        }
        if (botCastHashBytes32.length < 66) {
            botCastHashBytes32 = botCastHashBytes32.padEnd(66, '0');
        } else if (botCastHashBytes32.length > 66) {
            botCastHashBytes32 = botCastHashBytes32.substring(0, 66);
        }
        
        console.log('Bot reply hash:', botCastHashBytes32);
        console.log('User cast content:', userContent);
        console.log('Bot reply content:', botContent);
        
        const tx = await contractWithSigner.recordCompleteConversation(
            userAddress,
            userFid,
            castHashBytes32,        // User's cast hash
            botCastHashBytes32,     // Bot's reply hash (placeholder if blockchain-first)
            conversationId,
            userContent,            // User's cast content (truncated if needed)
            botContent              // Bot's reply content (truncated if needed)
        );
        console.log('Complete conversation transaction sent:', tx.hash);
        
        // Wait for transaction confirmation
        console.log('Waiting for transaction confirmation...');
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.hash);
        
        console.log('Complete conversation recorded successfully on-chain');
        return { 
            success: true, 
            txHash: receipt.hash 
        };
    } catch (error) {
        console.error('Error recording complete conversation:', error);
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
    const startTime = Date.now();
    console.log('🚀 POST request received to webhook endpoint');
    
    return await performanceMonitor.measure('total_request', async () => {
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
            // Get user's verified addresses
            const userAddresses = getUserVerifiedAddresses(castData);
            console.log('User addresses:', userAddresses);

            if (userAddresses.length === 0) {
                console.log('No verified address found for user');
                return NextResponse.json({
                    status: 'error',
                    message: 'No verified address found for user',
                    timestamp: new Date().toISOString(),
                    castText: castData.text
                });
            }

            // Get thread context for better understanding
            const threadContext = await getThreadContext(castData);
            console.log('Thread context:', threadContext);

            // 🚨 CRITICAL: Use request deduplication to prevent concurrent processing
            const primaryAddress = userAddresses[0];
            const requestId = `${castData.hash}:${Date.now()}`;
            
            return await requestDeduplicator.processRequest(
                primaryAddress,
                castData.text,
                castData.hash,
                async () => {
                    // This entire block runs only once per unique request
                    return await requestQueue.enqueueRequest(
                        primaryAddress,
                        requestId,
                        async () => {
                            // This runs sequentially per user to prevent race conditions
                            return await processUserInteraction(castData, userAddresses, isDirectMention, threadContext);
                        }
                    );
                }
            ).then(({ result, wasDuplicate }) => {
                if (wasDuplicate) {
                    console.log('🔄 Request was duplicate/concurrent - returned cached result');
                }
                return NextResponse.json(result);
            });
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
    } finally {
        // Log performance metrics every 10 requests
        if (Math.random() < 0.1) {
            console.log('📊 Performance Report:');
            performanceMonitor.logReport();
            
            console.log('💾 Cache Stats:');
            console.log(responseCache.getStats());
        }
        
        const totalTime = Date.now() - startTime;
        console.log(`⚡ Total request time: ${totalTime}ms`);
    }
    });
}

