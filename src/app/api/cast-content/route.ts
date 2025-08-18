import { NextRequest, NextResponse } from 'next/server';

// Get actual cast content from Farcaster using Neynar API
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const castHash = searchParams.get('hash');

        if (!castHash) {
            return NextResponse.json({
                error: 'Cast hash is required'
            }, { status: 400 });
        }

        const neynarApiKey = process.env.NEYNAR_API_KEY;
        if (!neynarApiKey) {
            return NextResponse.json({
                error: 'Neynar API key not configured'
            }, { status: 500 });
        }

        console.log('Fetching cast content for hash:', castHash);

        // Use Neynar API to get cast details
        const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`, {
            headers: {
                'Accept': 'application/json',
                'api_key': neynarApiKey
            }
        });

        if (!response.ok) {
            console.error('Neynar API error:', response.status, response.statusText);
            return NextResponse.json({
                error: 'Failed to fetch cast from Farcaster',
                status: response.status
            }, { status: response.status });
        }

        const castData = await response.json();
        
        // Extract relevant information
        const cast = castData.cast;
        const result = {
            hash: cast.hash,
            text: cast.text,
            timestamp: cast.timestamp,
            author: {
                fid: cast.author.fid,
                username: cast.author.username,
                display_name: cast.author.display_name,
                pfp_url: cast.author.pfp_url
            },
            parent_hash: cast.parent_hash,
            thread_hash: cast.thread_hash,
            replies: {
                count: cast.replies?.count || 0
            },
            reactions: {
                likes_count: cast.reactions?.likes_count || 0,
                recasts_count: cast.reactions?.recasts_count || 0
            }
        };

        return NextResponse.json(result);

    } catch (error) {
        console.error('Error fetching cast content:', error);
        return NextResponse.json({
            error: 'Failed to fetch cast content',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Batch fetch multiple casts
export async function POST(request: NextRequest) {
    try {
        const { hashes } = await request.json();

        if (!hashes || !Array.isArray(hashes)) {
            return NextResponse.json({
                error: 'Array of cast hashes is required'
            }, { status: 400 });
        }

        const neynarApiKey = process.env.NEYNAR_API_KEY;
        if (!neynarApiKey) {
            return NextResponse.json({
                error: 'Neynar API key not configured'
            }, { status: 500 });
        }

        console.log('Fetching batch cast content for', hashes.length, 'hashes');

        // Fetch all casts in parallel
        const castPromises = hashes.map(async (hash) => {
            try {
                const response = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${hash}&type=hash`, {
                    headers: {
                        'Accept': 'application/json',
                        'api_key': neynarApiKey
                    }
                });

                if (!response.ok) {
                    console.error(`Failed to fetch cast ${hash}:`, response.status);
                    return { hash, error: `HTTP ${response.status}` };
                }

                const castData = await response.json();
                const cast = castData.cast;
                
                return {
                    hash: cast.hash,
                    text: cast.text,
                    timestamp: cast.timestamp,
                    author: {
                        fid: cast.author.fid,
                        username: cast.author.username,
                        display_name: cast.author.display_name,
                        pfp_url: cast.author.pfp_url
                    },
                    parent_hash: cast.parent_hash,
                    thread_hash: cast.thread_hash,
                    replies: {
                        count: cast.replies?.count || 0
                    },
                    reactions: {
                        likes_count: cast.reactions?.likes_count || 0,
                        recasts_count: cast.reactions?.recasts_count || 0
                    }
                };
            } catch (error) {
                console.error(`Error fetching cast ${hash}:`, error);
                return { hash, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });

        const results = await Promise.all(castPromises);
        
        return NextResponse.json({
            casts: results,
            total: results.length,
            successful: results.filter(r => !r.error).length,
            failed: results.filter(r => r.error).length
        });

    } catch (error) {
        console.error('Error in batch cast fetch:', error);
        return NextResponse.json({
            error: 'Failed to fetch batch cast content',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
