import { NextRequest, NextResponse } from 'next/server';

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

// GET handler for webhook verification and debugging
export async function GET(request: NextRequest) {
    console.log('GET request received to webhook endpoint');
    console.log('Headers:', Object.fromEntries(request.headers.entries()));
    console.log('URL:', request.url);
    
    return NextResponse.json({
        status: 'webhook-endpoint-ready',
        message: 'Loveall bot webhook endpoint is ready to receive mentions',
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
                hash: body.data.hash
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

        if (isMentioningBot(castData.text)) {
            const response = generateFlirtyResponse();
            console.log('Mention detected, generating response:', response);
            
            return NextResponse.json({ 
                status: 'processed', 
                response,
                message: 'Mention detected and processed',
                timestamp: new Date().toISOString(),
                castText: castData.text
            });
        } else {
            console.log('No mention detected in:', castData.text);
            return NextResponse.json({ 
                status: 'ignored', 
                reason: 'no_mention',
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
