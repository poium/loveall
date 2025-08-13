import { NextRequest, NextResponse } from 'next/server';
import { NeynarAPIClient, Configuration } from '@neynar/nodejs-sdk';

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

// Grok AI integration for context-aware responses
async function getGrokResponse(castText: string, threadContext: string, interactionType: string) {
    try {
        const grokApiKey = process.env.GROK_API_KEY;
        if (!grokApiKey) {
            console.log('Grok API key not found, using fallback responses');
            return generateFallbackResponse(interactionType);
        }

        // Prepare context for Grok
        const context = `
You are Loveall, a flirty and witty Farcaster bot. You love to flirt and be charming while maintaining a fun, playful personality.

Current cast: "${castText}"
Thread context: "${threadContext}"
Interaction type: ${interactionType}

Generate a flirty, witty, and contextually relevant response. Be:
- Funny and charming
- Contextually aware of what the user said
- Playful and flirty
- Keep it under 200 characters
- Use emojis naturally
- Reference specific things they mentioned if relevant

Response:`;

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${grokApiKey}`,
                'X-Groq-Provider': 'x-ai'
            },
            body: JSON.stringify({
                model: 'grok-beta',
                messages: [
                    {
                        role: 'system',
                        content: 'You are Loveall, a flirty and witty Farcaster bot. Be charming, contextually aware, and playful.'
                    },
                    {
                        role: 'user',
                        content: context
                    }
                ],
                max_tokens: 150,
                temperature: 0.8
            })
        });

        if (!response.ok) {
            console.error('Grok API error:', response.status, response.statusText);
            return generateFallbackResponse(interactionType);
        }

        const data = await response.json();
        const grokResponse = data.choices?.[0]?.message?.content?.trim();
        
        if (grokResponse) {
            console.log('Grok AI response:', grokResponse);
            return grokResponse;
        } else {
            console.log('No valid response from Grok, using fallback');
            return generateFallbackResponse(interactionType);
        }

    } catch (error) {
        console.error('Grok AI error:', error);
        return generateFallbackResponse(interactionType);
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

// Fallback responses when Grok is not available
function generateFallbackResponse(interactionType: string) {
    if (interactionType === 'direct_mention') {
        const responses = [
            "Hey there, cutie! 😘 Your flirty cast just made my day! 💕",
            "Wow, that's some serious charm! 😍 You've got the gift of gab! ✨",
            "Ooh la la! 🥰 That was smooth! You're definitely a keeper! 💖",
            "My circuits are tingling! 🤖💕 That was absolutely delightful! 🌟",
            "You've got that special something! 😊 Your wit is irresistible! 💫"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    } else {
        const responses = [
            "Oh my! 😍 You're keeping this conversation going! I love it! 💕",
            "You're absolutely adorable! 😊 Keep talking to me! ✨",
            "This is getting interesting! 🥰 Tell me more! 💖",
            "You've got my full attention! 🤖💕 What else is on your mind? 🌟",
            "I'm hanging on every word! 😊 You're so engaging! 💫"
        ];
        return responses[Math.floor(Math.random() * responses.length)];
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
                    replyHash: replyHash
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
