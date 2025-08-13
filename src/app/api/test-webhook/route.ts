import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        status: 'test-webhook-ready',
        message: 'Test webhook endpoint is working',
        timestamp: new Date().toISOString()
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        return NextResponse.json({
            status: 'webhook-received',
            message: 'Test webhook POST received successfully',
            timestamp: new Date().toISOString(),
            receivedData: body,
            headers: Object.fromEntries(request.headers.entries())
        });
    } catch (error) {
        return NextResponse.json({
            status: 'error',
            message: 'Failed to process webhook',
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
