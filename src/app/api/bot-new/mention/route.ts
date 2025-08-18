import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';
import { ethers } from 'ethers';
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
const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5'; // LoveallPrizePool on Base Mainnet
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // USDC on Base
// Cast cost is now dynamic and fetched from contract

// Contract ABI (updated for new contract functions)
const CONTRACT_ABI = [
    'function getUserData(address user) external view returns (tuple(uint256 balance, bool hasSufficientBalance, bool hasParticipatedThisWeek, uint256 participationsCount, uint256 conversationCount, uint256 remainingConversations, uint256 bestScore, bytes32 bestConversationId, uint256 totalContributions))',
    'function participateInCast(address user, uint256 fid, bytes32 castHash, bytes32 conversationId, string castContent) external',
    'function getCommonData() external view returns (tuple(uint256 totalPrizePool, uint256 currentWeekPrizePool, uint256 rolloverAmount, uint256 totalContributions, uint256 totalProtocolFees, uint256 castCost, uint256 currentWeek, uint256 weekStartTime, uint256 weekEndTime, uint256 currentWeekParticipantsCount, address currentWeekWinner, uint256 currentWeekPrize, string characterName, string characterTask, bool characterIsSet))',
    'function getCurrentCharacter() external view returns (tuple(string name, string task, string[5] traitNames, uint8[5] traitValues, uint8 traitCount, bool isSet))',
    'function setCastCost(uint256 newCastCost) external',
    'function owner() external view returns (address)'
];

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
function getUserVerifiedAddresses(castData: any): string[] {
    try {
        const addresses: string[] = [];
        
        // Get all verified addresses from the cast author
        const verifiedAddresses = castData.author?.verified_addresses?.eth_addresses;
        if (verifiedAddresses && verifiedAddresses.length > 0) {
            addresses.push(...verifiedAddresses);
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

// Check all user addresses and find the best one to use
async function checkUserBalance(userAddresses: string[]): Promise<{ 
    hasBalance: boolean; 
    balance: string; 
    bestAddress: string | null;
    allAddresses: Array<{address: string, balance: string, hasBalance: boolean, hasParticipated: boolean}>;
    error?: string 
}> {
    try {
        console.log('Checking balance for all user addresses:', userAddresses);
        
        const addressResults = [];
        let bestAddress: string | null = null;
        let bestBalance = '0';
        
        // Check each address
        for (const address of userAddresses) {
            const result = await checkSingleAddressBalance(address);
            addressResults.push({
                address,
                balance: result.balance,
                hasBalance: result.hasBalance,
                hasParticipated: result.hasParticipated
            });
            
            // Track the best address (first one with sufficient balance)
            if (result.hasBalance && !bestAddress) {
                bestAddress = address;
                bestBalance = result.balance;
            }
        }
        
        return {
            hasBalance: bestAddress !== null,
            balance: bestBalance,
            bestAddress,
            allAddresses: addressResults
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

// Record participation in the smart contract
async function recordParticipation(userAddress: string, castData: any): Promise<{ success: boolean; error?: string; txHash?: string }> {
    try {
        console.log('Recording participation for user:', userAddress, 'cast:', castData.hash);
        
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
        
        // Call the participateInCast function with new parameters
        console.log('Calling participateInCast function...');
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
        
        console.log('Original hash:', castData.hash);
        console.log('Formatted hash:', castHashBytes32);
        console.log('Hash length:', castHashBytes32.length);
        
        const tx = await contractWithSigner.participateInCast(
            userAddress,
            userFid,
            castHashBytes32,
            conversationId,
            castData.text
        );
        console.log('Transaction sent:', tx.hash);
        
        // Wait for transaction confirmation
        console.log('Waiting for transaction confirmation...');
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.hash);
        
        console.log('Participation recorded successfully');
        return { 
            success: true, 
            txHash: receipt.hash 
        };
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

            // Check user's balance for both direct mentions and replies
            const balanceCheck = await checkUserBalance(userAddresses);
            console.log('Balance check result:', balanceCheck);

            if (!balanceCheck.hasBalance) {
                    console.log('User cannot participate - checking reasons');
                    
                    // Create a message based on the specific issue
                    const firstWallet = balanceCheck.allAddresses[0];
                    const walletCount = balanceCheck.allAddresses.length;
                    
                    // Function to shorten wallet address (first 4 + last 4 characters)
                    const shortenAddress = (address: string) => {
                        return `${address.slice(0, 6)}...${address.slice(-4)}`;
                    };
                    
                    let insufficientBalanceResponse;
                    
                    // Check if it's a conversation limit issue
                    const hasReachedConversationLimit = balanceCheck.allAddresses.some(addr => 
                        'remainingConversations' in addr && addr.remainingConversations === 0
                    );
                    
                    if (hasReachedConversationLimit) {
                        const firstWalletWithLimit = balanceCheck.allAddresses.find(addr => 
                            'remainingConversations' in addr && addr.remainingConversations === 0
                        );
                        const conversationCount = firstWalletWithLimit && 'conversationCount' in firstWalletWithLimit ? firstWalletWithLimit.conversationCount : 0;
                        insufficientBalanceResponse = `Hey there! 😊 I'd love to chat, but you've reached your limit of 3 conversations this week! You currently have ${conversationCount}/3 conversations. Come back next week to start fresh conversations! 💫`;
                    } else if (walletCount === 1) {
                        const shortAddress = shortenAddress(firstWallet.address);
                        if (firstWallet.hasParticipated) {
                            const remainingConvs = 'remainingConversations' in firstWallet ? firstWallet.remainingConversations : 0;
                            insufficientBalanceResponse = `Hey there! 😊 You have ${firstWallet.balance} USDC and ${remainingConvs} conversations remaining this week. Let's continue chatting! 💫`;
                        } else {
                            insufficientBalanceResponse = `Hey there! 😊 I'd love to chat, but you need at least 0.01 USDC in your contract balance to participate. You currently have ${firstWallet.balance} USDC. Please top up your contract balance on our website and try again! 💫`;
                        }
                    } else {
                        // For multiple wallets, just show the insufficient balance message
                        // Don't check participation status if they don't have enough balance to participate
                        const shortAddresses = balanceCheck.allAddresses.map(addr => 
                            `${shortenAddress(addr.address)} (${addr.balance} USDC)`
                        ).join(', ');
                        insufficientBalanceResponse = `Hey there! 😊 I'd love to chat, but you need at least 0.01 USDC in your contract balance to participate. Your contract balances: ${shortAddresses}. Please top up your contract balance on our website and try again! 💫`;
                    }
                    
                    try {
                        const replyResult = await postReplyToFarcaster(castData.hash, insufficientBalanceResponse);
                        console.log('Insufficient balance reply posted:', replyResult);
                        
                        return NextResponse.json({
                            status: 'insufficient_balance',
                            message: 'User has insufficient balance',
                            timestamp: new Date().toISOString(),
                            castText: castData.text,
                            userAddresses: userAddresses,
                            balance: balanceCheck.balance,
                            replyPosted: true
                        });
                    } catch (error) {
                        console.error('Error posting insufficient balance reply:', error);
                    }
                }

            // Record participation in smart contract using the best address
            const participationResult = await recordParticipation(balanceCheck.bestAddress || userAddresses[0], castData);
            console.log('Participation recording result:', participationResult);

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
                    userAddresses: userAddresses,
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

