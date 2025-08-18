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

// Batch fetch multiple casts and their replies
export async function POST(request: NextRequest) {
    try {
        const { hashes, includeReplies = false } = await request.json();

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

        console.log('Fetching batch cast content for', hashes.length, 'hashes', includeReplies ? 'with replies' : 'without replies');

        // Fetch bot replies for a given cast
        const fetchBotReplies = async (castHash: string) => {
            try {
                // Get replies to the cast
                const repliesResponse = await fetch(`https://api.neynar.com/v2/farcaster/cast?identifier=${castHash}&type=hash`, {
                    headers: {
                        'Accept': 'application/json',
                        'api_key': neynarApiKey
                    }
                });

                if (!repliesResponse.ok) return [];

                const repliesData = await repliesResponse.json();
                const cast = repliesData.cast;

                // If this cast has replies, fetch them
                if (cast.replies && cast.replies.count > 0) {
                    // Get conversation/thread to find bot replies
                    const conversationResponse = await fetch(`https://api.neynar.com/v2/farcaster/cast/conversation?identifier=${castHash}&type=hash&reply_depth=2&include_chronological_parent_casts=false`, {
                        headers: {
                            'Accept': 'application/json',
                            'api_key': neynarApiKey
                        }
                    });

                    if (conversationResponse.ok) {
                        const conversationData = await conversationResponse.json();
                        const conversation = conversationData.conversation;
                        
                        // Find direct replies from the loveall bot
                        const botReplies = conversation.cast.direct_replies?.filter((reply: any) => 
                            reply.author.username === 'loveall'
                        ) || [];

                        return botReplies.map((reply: any) => ({
                            hash: reply.hash,
                            text: reply.text,
                            timestamp: reply.timestamp,
                            author: {
                                fid: reply.author.fid,
                                username: reply.author.username,
                                display_name: reply.author.display_name,
                                pfp_url: reply.author.pfp_url
                            },
                            parent_hash: reply.parent_hash,
                            thread_hash: reply.thread_hash,
                            replies: {
                                count: reply.replies?.count || 0
                            },
                            reactions: {
                                likes_count: reply.reactions?.likes_count || 0,
                                recasts_count: reply.reactions?.recasts_count || 0
                            },
                            isBot: true
                        }));
                    }
                }
                return [];
            } catch (error) {
                console.error(`Error fetching bot replies for ${castHash}:`, error);
                return [];
            }
        };

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
                
                const userCast = {
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
                    },
                    isBot: false
                };

                // If includeReplies is true, fetch bot replies too
                if (includeReplies) {
                    const botReplies = await fetchBotReplies(hash);
                    return {
                        userCast,
                        botReplies,
                        allCasts: [userCast, ...botReplies].sort((a, b) => 
                            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
                        )
                    };
                }

                return userCast;
            } catch (error) {
                console.error(`Error fetching cast ${hash}:`, error);
                return { hash, error: error instanceof Error ? error.message : 'Unknown error' };
            }
        });

        const results = await Promise.all(castPromises);
        
        if (includeReplies) {
            // Flatten all casts (user + bot replies) into a single chronological list
            const allCasts: any[] = [];
            results.forEach((result: any) => {
                if (result && !result.error) {
                    if (result.allCasts) {
                        allCasts.push(...result.allCasts);
                    } else {
                        allCasts.push(result);
                    }
                }
            });

            // Sort by timestamp for proper conversation flow
            allCasts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            return NextResponse.json({
                casts: allCasts,
                conversations: results.filter(r => !r.error),
                total: allCasts.length,
                userCasts: results.filter(r => !r.error && r.userCast).length,
                botReplies: allCasts.filter(c => c.isBot).length,
                successful: results.filter(r => !r.error).length,
                failed: results.filter(r => r.error).length
            });
        }
        
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
