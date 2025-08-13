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

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { castData } = body;

        if (!castData) {
            return NextResponse.json({ error: 'No cast data provided' }, { status: 400 });
        }

        if (isMentioningBot(castData.text)) {
            const response = generateFlirtyResponse();
            return NextResponse.json({ 
                status: 'processed', 
                response,
                message: 'Mention detected and processed',
                timestamp: new Date().toISOString()
            });
        } else {
            return NextResponse.json({ 
                status: 'ignored', 
                reason: 'no_mention',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error('Mention processing error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
