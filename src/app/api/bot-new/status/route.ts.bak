import { NextResponse } from 'next/server';

export async function GET() {
    try {
        return NextResponse.json({
            status: 'running',
            service: 'loveall-bot',
            timestamp: new Date().toISOString(),
            contract: '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5',
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
