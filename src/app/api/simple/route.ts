import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({
        message: 'Simple API route working!',
        timestamp: new Date().toISOString()
    });
}
