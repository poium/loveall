// Debug endpoint to manually clear cache
import { NextRequest, NextResponse } from 'next/server';
import { clearUserCache, clearAllCache, getCacheStats } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { address, clearAll } = await request.json();
    
    if (clearAll) {
      clearAllCache();
      return NextResponse.json({
        success: true,
        message: 'All cache cleared',
        timestamp: new Date().toISOString()
      });
    }
    
    if (address) {
      clearUserCache(address);
      return NextResponse.json({
        success: true,
        message: `Cache cleared for ${address}`,
        timestamp: new Date().toISOString()
      });
    }
    
    return NextResponse.json({
      error: 'Provide either "address" or "clearAll": true'
    }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Cache clear error:', error);
    return NextResponse.json({
      error: 'Failed to clear cache',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // Return cache stats
  const stats = getCacheStats();
  
  return NextResponse.json({
    stats,
    instructions: {
      clearUser: 'POST {"address": "0x..."}',
      clearAll: 'POST {"clearAll": true}'
    }
  });
}
