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

// Generate flirty response
function generateFlirtyResponse() {
    const responses = [
        "Hey there, cutie! 😘 Your flirty cast just made my day! 💕",
        "Wow, that's some serious charm! 😍 You've got the gift of gab! ✨",
        "Ooh la la! 🥰 That was smooth! You're definitely a keeper! 💖",
        "My circuits are tingling! 🤖💕 That was absolutely delightful! 🌟",
        "You've got that special something! 😊 Your wit is irresistible! 💫",
        "Be still my beating heart! 💓 That was pure poetry! 🎭",
        "You're making me blush! 😳 Such a charmer! 🌹",
        "That's the kind of energy I love! 💪✨ You're on fire! 🔥",
        "My digital heart skipped a beat! 💔➡️💖 That was amazing! 🎉",
        "You've got the magic touch! ✨✨✨ Simply enchanting! 🧙‍♀️"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
}

// Generate conversational response for replies
function generateConversationalResponse() {
    const responses = [
        "Oh my! 😍 You're keeping this conversation going! I love it! 💕",
        "You're absolutely adorable! 😊 Keep talking to me! ✨",
        "This is getting interesting! 🥰 Tell me more! 💖",
        "You've got my full attention! 🤖💕 What else is on your mind? 🌟",
        "I'm hanging on every word! 😊 You're so engaging! 💫",
        "This conversation is pure magic! 💓 Keep it coming! 🎭",
        "You're making me smile! 😳 Such a delightful chat! 🌹",
        "I'm loving this energy! 💪✨ You're amazing! 🔥",
        "This is exactly what I needed! 💔➡️💖 You're wonderful! 🎉",
        "You're casting a spell on me! ✨✨✨ I'm enchanted! 🧙‍♀️"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
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
            // Choose response type based on interaction type
            let response;
            let interactionType;
            
            if (isDirectMention) {
                response = generateFlirtyResponse();
                interactionType = 'direct_mention';
                console.log('Direct mention detected, generating flirty response:', response);
            } else {
                response = generateConversationalResponse();
                interactionType = 'reply_to_bot';
                console.log('Reply to bot detected, generating conversational response:', response);
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
