'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface CastContent {
  hash: string;
  text: string;
  timestamp: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  parent_hash?: string;
  error?: string;
}

interface Participation {
  user: string;
  fid: number;
  castHash: string;
  conversationId: string;
  timestamp: number;
  weekNumber: number;
  usdcAmount: string;
  aiScore: number;
  isEvaluated: boolean;
  timestampFormatted: string;
}

interface Conversation {
  conversationId: string;
  participations: Participation[];
  totalCasts: number;
  startTime: string;
  lastActivity: string;
  totalSpent: string;
  averageScore: string;
}

interface ConversationWithContent extends Conversation {
  casts: CastContent[];
  loading?: boolean;
}

export default function ChatPage() {
  const { address } = useAccount();
  const [conversations, setConversations] = useState<ConversationWithContent[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Fix hydration mismatch by only rendering address-dependent content after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch conversations for connected user
  useEffect(() => {
    if (address) {
      fetchUserConversations();
    }
  }, [address]);

  const fetchUserConversations = async () => {
    if (!address) return;
    
    setLoading(true);
    setError(null);
    
    try {
      console.log('Fetching conversations for address:', address);
      const response = await fetch(`/api/conversations?user=${address}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch conversations: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Fetched conversations:', data);
      
      if (data.conversations) {
        // Fetch cast content for each conversation
        const conversationsWithContent = await Promise.all(
          data.conversations.map(async (conv: Conversation) => {
            const castHashes = conv.participations.map(p => p.castHash);
            
            try {
              const castResponse = await fetch('/api/cast-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  hashes: castHashes,
                  includeReplies: true  // Request bot replies too
                })
              });
              
              if (castResponse.ok) {
                const castData = await castResponse.json();
                return {
                  ...conv,
                  casts: castData.casts || []
                };
              } else {
                console.warn('Farcaster API failed, trying blockchain events fallback for conversation:', conv.conversationId);
                
                // Fallback: Get cast content from blockchain events
                try {
                  const blockchainResponse = await fetch(`/api/blockchain-events?user=${address}`);
                  if (blockchainResponse.ok) {
                    const blockchainData = await blockchainResponse.json();
                    
                    // Find matching conversation
                    const matchingConv = blockchainData.conversations?.find((c: any) => 
                      c.conversationId === conv.conversationId
                    );
                    
                    if (matchingConv) {
                      // Convert blockchain events to cast format
                      const blockchainCasts: any[] = [];
                      
                      matchingConv.participations.forEach((p: any) => {
                        // Add user cast
                        blockchainCasts.push({
                          hash: p.castHash,
                          text: p.castContent, // ✅ From blockchain!
                          timestamp: p.timestampFormatted || new Date().toISOString(),
                          author: {
                            fid: p.fid,
                            username: 'User',
                            display_name: 'User',
                            pfp_url: '/default-avatar.png'
                          },
                          source: 'blockchain',
                          isBot: false
                        });
                        
                        // Add bot reply if available (from complete conversations)
                        if (p.botReply && p.type === 'complete') {
                          blockchainCasts.push({
                            hash: p.botCastHash,
                            text: p.botReply, // ✅ Bot reply from blockchain!
                            timestamp: p.timestampFormatted || new Date().toISOString(),
                            author: {
                              fid: 1159914, // Bot's FID
                              username: 'loveall',
                              display_name: 'LoveAll',
                              pfp_url: 'https://images.pexels.com/photos/20025519/pexels-photo-20025519.jpeg'
                            },
                            source: 'blockchain',
                            isBot: true
                          });
                        }
                      });
                      
                      // Sort by timestamp for proper conversation flow
                      blockchainCasts.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
                      
                      return {
                        ...conv,
                        casts: blockchainCasts,
                        source: 'blockchain_fallback'
                      };
                    }
                  }
                } catch (blockchainError) {
                  console.error('Blockchain fallback also failed:', blockchainError);
                }
                
                return {
                  ...conv,
                  casts: []
                };
              }
            } catch (error) {
              console.error('Error fetching cast content:', error);
              return {
                ...conv,
                casts: []
              };
            }
          })
        );
        
        setConversations(conversationsWithContent);
      }
    } catch (err) {
      console.error('Error fetching conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch conversations');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const truncateConversationId = (id: string) => {
    return `${id.slice(0, 8)}...${id.slice(-8)}`;
  };

  // Show loading state during hydration to prevent mismatch
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="mr-4 hidden md:flex">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">❤️</span>
                </div>
                <h1 className="text-xl font-bold text-foreground">
                  Loveall
                </h1>
              </div>
            </div>
            
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <a 
                href="/" 
                className="transition-colors hover:text-foreground/80 text-muted-foreground"
              >
                Dashboard
              </a>
              <a 
                href="/chat" 
                className="transition-colors hover:text-foreground/80 text-foreground flex items-center space-x-1"
              >
                <span>💬</span>
                <span>Chat History</span>
              </a>
            </nav>
          </div>
        </header>

        <div className="container py-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container flex h-14 items-center">
            <div className="mr-4 hidden md:flex">
              <div className="flex items-center space-x-3">
                <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">❤️</span>
                </div>
                <h1 className="text-xl font-bold text-foreground">
                  Loveall
                </h1>
              </div>
            </div>
            
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <a 
                href="/" 
                className="transition-colors hover:text-foreground/80 text-muted-foreground"
              >
                Dashboard
              </a>
              <a 
                href="/chat" 
                className="transition-colors hover:text-foreground/80 text-foreground flex items-center space-x-1"
              >
                <span>💬</span>
                <span>Chat History</span>
              </a>
            </nav>
          </div>
        </header>

        <div className="container py-12">
          <div className="flex flex-col items-center justify-center space-y-8">
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold text-foreground">💬 Chat History</h1>
              <p className="text-muted-foreground text-lg">View your conversation history with the Loveall bot</p>
            </div>
            <div className="card p-8 max-w-md w-full text-center">
              <p className="text-card-foreground">Please connect your wallet to view your chat history</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedConv = conversations.find(c => c.conversationId === selectedConversation);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 hidden md:flex">
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-primary-foreground font-bold">❤️</span>
              </div>
              <h1 className="text-xl font-bold text-foreground">
                Loveall
              </h1>
            </div>
          </div>
          
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <a 
              href="/" 
              className="transition-colors hover:text-foreground/80 text-muted-foreground"
            >
              Dashboard
            </a>
            <a 
              href="/chat" 
              className="transition-colors hover:text-foreground/80 text-foreground flex items-center space-x-1"
            >
              <span>💬</span>
              <span>Chat History</span>
            </a>
          </nav>
        </div>
      </header>

      <div className="container py-8 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-foreground">💬 Chat History</h1>
          <p className="text-muted-foreground text-lg">Your conversation history with the Loveall bot</p>
          {isMounted && address && (
            <p className="text-sm text-muted-foreground">Connected: {truncateAddress(address)}</p>
          )}
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-4 text-muted-foreground">Loading conversations...</p>
          </div>
        )}

        {error && (
          <div className="card border-destructive bg-destructive/5 p-4">
            <p className="text-destructive font-medium">Error: {error}</p>
            <button 
              onClick={fetchUserConversations}
              className="btn-primary mt-4"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversations List */}
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-semibold text-card-foreground">
                Your Conversations ({conversations.length})
              </h2>
              
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">No conversations found</p>
                  <p className="text-sm text-muted-foreground mt-2">Start chatting with @loveall on Farcaster!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {conversations.map((conv) => (
                    <div 
                      key={conv.conversationId}
                      className={`border rounded-lg p-4 cursor-pointer transition-all hover-lift ${
                        selectedConversation === conv.conversationId 
                          ? 'border-primary bg-accent' 
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedConversation(conv.conversationId)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-medium text-card-foreground">
                          Conversation {truncateConversationId(conv.conversationId)}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(conv.lastActivity)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium text-card-foreground">{conv.totalCasts}</span> casts
                        </div>
                        <div>
                          <span className="font-medium text-card-foreground">{conv.totalSpent}</span> USDC
                        </div>
                        <div>
                          Score: <span className="font-medium text-card-foreground">{conv.averageScore}</span>
                        </div>
                        <div className="col-span-2 text-xs">
                          Started: {formatTimestamp(conv.startTime)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat View */}
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-semibold text-card-foreground">
                {selectedConv ? `Chat: ${truncateConversationId(selectedConv.conversationId)}` : 'Select a Conversation'}
              </h2>
              
              {!selectedConv ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground">Select a conversation from the list to view the chat history</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedConv.casts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <p className="text-muted-foreground">No cast content available</p>
                      <p className="text-sm text-muted-foreground mt-2">Cast content may not be accessible</p>
                    </div>
                  ) : (
                    selectedConv.casts
                      .filter(cast => cast && !cast.error && cast.author) // Filter out failed/invalid casts
                      .map((cast, index) => {
                        const participation = selectedConv.participations.find(p => p.castHash === cast.hash);
                        const isBot = cast.isBot || cast.author?.username === 'loveall';
                      
                      return (
                        <div 
                          key={cast.hash}
                          className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
                        >
                          <div 
                            className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg space-y-2 ${
                              isBot 
                                ? 'bg-muted border-l-4 border-primary' 
                                : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            <div className="flex items-center">
                              <img 
                                src={cast.author.pfp_url} 
                                alt={cast.author.display_name}
                                className="w-6 h-6 rounded-full mr-2"
                              />
                              <span className="text-sm font-medium">
                                {cast.author.display_name}
                                {isBot && <span className="ml-1">🤖</span>}
                              </span>
                            </div>
                            
                            <p className="text-sm leading-relaxed">{cast.text}</p>
                            
                            <div className="text-xs opacity-75 space-y-1">
                              <div>{formatTimestamp(cast.timestamp)}</div>
                              {participation && (
                                <div className="flex items-center space-x-2 text-xs">
                                  <span>• {participation.usdcAmount} USDC</span>
                                  {participation.isEvaluated && (
                                    <span>• Score: {participation.aiScore}</span>
                                  )}
                                </div>
                              )}
                              {cast.source === 'blockchain' && (
                                <div className="text-primary font-medium">• 🔗 On-chain</div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              
              {selectedConv && (
                <div className="border-t pt-4 space-y-2">
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p><span className="font-medium text-card-foreground">Total Casts:</span> {selectedConv.totalCasts}</p>
                    <p><span className="font-medium text-card-foreground">Total Spent:</span> {selectedConv.totalSpent} USDC</p>
                    <p><span className="font-medium text-card-foreground">Average Score:</span> {selectedConv.averageScore}</p>
                    <p><span className="font-medium text-card-foreground">Conversation ID:</span> {selectedConv.conversationId}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
