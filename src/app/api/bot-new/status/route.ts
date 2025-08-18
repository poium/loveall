import { NextResponse } from 'next/server';

export async function GET() {
    try {
        return NextResponse.json({
            status: 'running',
            service: 'loveall-bot',
            timestamp: new Date().toISOString(),
            contract: '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa',
            features: [
                'mention-detection',
                'response-generation',
                'contract-integration'
            ]
        });
    } catch (error) {
        console.error('Status error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
