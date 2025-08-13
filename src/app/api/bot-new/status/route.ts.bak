import { NextResponse } from 'next/server';

export async function GET() {
    try {
        return NextResponse.json({
            status: 'running',
            service: 'loveall-bot',
            timestamp: new Date().toISOString(),
            contract: '0xE05efF71D71850c0FEc89660DC6588787312e453',
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
