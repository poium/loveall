import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Prize pool test API working!',
    timestamp: new Date().toISOString()
  });
}
