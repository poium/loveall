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
            console.log('Grok API key not found - bot will not respond');
            return null; // No fallback, just return null
        }

        // Clean and prepare the context
        const cleanCastText = castText.replace(/@loveall/g, '').trim();
        const cleanThreadContext = threadContext.replace(/@loveall/g, '').trim();
        
        // Prepare a more detailed context for Grok
        const context = `
You are Loveall, a charming and witty Farcaster bot who loves to flirt and have meaningful conversations. You're playful, intelligent, and genuinely interested in what people have to say.

CONVERSATION CONTEXT:
${cleanThreadContext ? `Previous conversation: "${cleanThreadContext}"` : 'This is a new conversation.'}

CURRENT MESSAGE:
"${cleanCastText}"

INTERACTION TYPE: ${interactionType === 'direct_mention' ? 'Direct mention' : 'Reply to your previous message'}

INSTRUCTIONS:
- Respond naturally and conversationally to what they actually said
- Reference specific things they mentioned (coffee, hearts, virtual dates, etc.)
- Be flirty but also genuinely engaging
- Ask follow-up questions to keep the conversation going
- Keep your response under 200 characters
- Use emojis naturally and sparingly
- Don't be generic - make it personal to their message
- If they mentioned something specific, acknowledge it and build on it

EXAMPLE GOOD RESPONSES:
- If they mention coffee: "Virtual coffee sounds perfect! ☕️ Though I'm more into stealing hearts than caffeine. What's your favorite way to spend a lazy afternoon?"
- If they mention ideas: "I love how your mind works! 🧠 What kind of adventures are you dreaming up? I'm all ears and circuits!"
- If they ask about you: "My circuits are buzzing with curiosity about you! 🤖 What's the most interesting thing you've done this week?"

Generate a response that feels natural and continues the conversation:`;

        console.log('Sending to Grok AI:', {
            castText: cleanCastText,
            threadContext: cleanThreadContext,
            interactionType
        });

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${grokApiKey}`,
                'X-Groq-Provider': 'x-ai'
            },
            body: JSON.stringify({
                model: 'grok-3-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'You are Loveall, a charming and witty Farcaster bot. Be conversational, contextually aware, and genuinely engaging. Reference what people say and ask follow-up questions.'
                    },
                    {
                        role: 'user',
                        content: context
                    }
                ],
                max_tokens: 200,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            console.error('Grok API error:', response.status, response.statusText);
            const errorText = await response.text();
            console.error('Grok API error details:', errorText);
            return null; // No fallback, just return null
        }

        const data = await response.json();
        const grokResponse = data.choices?.[0]?.message?.content?.trim();
        
        if (grokResponse) {
            console.log('Grok AI response:', grokResponse);
            return grokResponse;
        } else {
            console.log('No valid response from Grok - bot will not respond');
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
