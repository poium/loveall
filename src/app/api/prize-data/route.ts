import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // For now, return mock data until we can connect to the contract
    const mockData = {
      currentWeek: 1,
      currentPrizePool: "0.00",
      totalParticipants: 0,
      weekStartTime: Date.now(),
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(mockData);

  } catch (error) {
    console.error('Error fetching prize data:', error);
    return NextResponse.json({
      error: 'Failed to fetch prize data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
