'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { FlickeringGrid } from '../components/FlickeringGrid';

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
  isBot?: boolean;
  source?: string;
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
                              username: 'influai',
                              display_name: 'InfluAI',
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
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-6xl flex h-14 items-center justify-between">
            {/* Logo */}
            <div className="hidden md:flex">
              <a href="/" className="h-8 w-auto flex items-center justify-center hover:opacity-80 transition-opacity">
                <img 
                  src="/logo.svg" 
                  alt="InfluAI" 
                  className="h-8 w-auto"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </a>
            </div>
            
            {/* Centered Navigation */}
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <a 
                href="/" 
                className="transition-colors hover:text-foreground/80 text-muted-foreground"
              >
                Dashboard
              </a>
              <a 
                href="/how-it-works" 
                className="transition-colors hover:text-foreground/80 text-muted-foreground flex items-center space-x-1"
              >
                <span>📖</span>
                <span>How It Works</span>
              </a>
              <a 
                href="/chat" 
                className="transition-colors hover:text-foreground/80 text-foreground flex items-center space-x-1"
              >
                <span>💬</span>
                <span>Chat History</span>
              </a>
            </nav>
            
            {/* Connect Button */}
            <div className="flex items-center">
              <ConnectButton />
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto max-w-6xl flex h-14 items-center justify-between">
            {/* Logo */}
            <div className="hidden md:flex">
              <a href="/" className="h-8 w-auto flex items-center justify-center hover:opacity-80 transition-opacity">
                <img 
                  src="/logo.svg" 
                  alt="InfluAI" 
                  className="h-8 w-auto"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </a>
            </div>
            
            {/* Centered Navigation */}
            <nav className="flex items-center space-x-6 text-sm font-medium">
              <a 
                href="/" 
                className="transition-colors hover:text-foreground/80 text-muted-foreground"
              >
                Dashboard
              </a>
              <a 
                href="/how-it-works" 
                className="transition-colors hover:text-foreground/80 text-muted-foreground flex items-center space-x-1"
              >
                <span>📖</span>
                <span>How It Works</span>
              </a>
              <a 
                href="/chat" 
                className="transition-colors hover:text-foreground/80 text-foreground flex items-center space-x-1"
              >
                <span>💬</span>
                <span>Chat History</span>
              </a>
            </nav>
            
            {/* Connect Button */}
            <div className="flex items-center">
              <ConnectButton />
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative overflow-hidden">
          <FlickeringGrid
            className="absolute inset-0"
            squareSize={4}
            gridGap={6}
            flickerChance={0.02}
            color="rgb(147, 51, 234)"
            maxOpacity={0.4}
          />
          {/* Fade-out gradient overlay */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-20"></div>
          <div className="container mx-auto max-w-6xl flex h-auto flex-col items-center justify-center gap-4 py-16 text-center lg:py-20 relative z-10">
            <div className="space-y-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-3xl">💬</span>
                </div>
                
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
                    Chat History
                  </h1>
                  
                  <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto">
                    View your conversation history with the InfluAI bot
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <main className="flex-1 w-full">
          <div className="container mx-auto max-w-6xl py-8 px-4">
            <div className="text-center py-16">
              <div className="max-w-md mx-auto">
                <a href="/" className="w-auto h-20 flex items-center justify-center mx-auto mb-6 hover:opacity-80 transition-opacity">
                  <img 
                    src="/logo.svg" 
                    alt="InfluAI" 
                    className="h-20 w-auto"
                    style={{ filter: 'brightness(0) invert(1)' }}
                  />
                </a>
                <h3 className="text-2xl font-bold text-foreground mb-4">Connect Your Wallet</h3>
                <p className="text-muted-foreground mb-8">
                  Connect your wallet to view your chat history with InfluAI.
                </p>
                <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                  <h4 className="text-lg font-semibold text-foreground mb-3">How it works:</h4>
                  <ul className="text-muted-foreground text-sm space-y-2 text-left">
                    <li>• Connect your wallet to Base network</li>
                    <li>• View all your @influai conversations</li>
                    <li>• See AI scores and participation costs</li>
                    <li>• Track your conversation history</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-card py-6 mt-12 border-t border-border">
          <div className="container mx-auto max-w-6xl px-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-muted-foreground text-sm">
                Built on Base Network • Powered by Farcaster • influai.xyz
              </p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  const selectedConv = conversations.find(c => c.conversationId === selectedConversation);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto max-w-6xl flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="hidden md:flex">
            <a href="/" className="h-8 w-auto flex items-center justify-center hover:opacity-80 transition-opacity">
              <img 
                src="/logo.svg" 
                alt="InfluAI" 
                className="h-8 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </a>
          </div>
          
          {/* Centered Navigation */}
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <a 
              href="/" 
              className="transition-colors hover:text-foreground/80 text-muted-foreground"
            >
              Dashboard
            </a>
            <a 
              href="/how-it-works" 
              className="transition-colors hover:text-foreground/80 text-muted-foreground flex items-center space-x-1"
            >
              <span>📖</span>
              <span>How It Works</span>
            </a>
            <a 
              href="/chat" 
              className="transition-colors hover:text-foreground/80 text-foreground flex items-center space-x-1"
            >
              <span>💬</span>
              <span>Chat History</span>
            </a>
          </nav>
          
          {/* Connect Button */}
          <div className="flex items-center">
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative">
        <FlickeringGrid
          className="absolute inset-0"
          squareSize={3}
          gridGap={8}
          flickerChance={0.2}
          color="rgb(147, 51, 234)"
          maxOpacity={0.15}
        />
        <div className="container mx-auto max-w-6xl flex h-auto flex-col items-center justify-center gap-4 py-16 text-center lg:py-20 relative z-10">
          <div className="space-y-6">
            <div className="flex flex-col items-center space-y-6">
              <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <span className="text-3xl">💬</span>
              </div>
              
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl text-foreground">
                  Chat History
                </h1>
                
                <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto">
                  Your conversation history with the InfluAI bot
                </p>
                
                {isMounted && address && (
                  <div className="inline-flex items-center space-x-3 bg-primary/10 border border-primary/20 rounded-full px-6 py-3">
                    <span className="text-sm text-muted-foreground font-medium">Connected:</span>
                    <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                      {truncateAddress(address)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 w-full">
        <div className="container mx-auto max-w-7xl py-8 px-4 space-y-8">
          
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground text-lg">Loading conversations...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="card border-destructive bg-destructive/5 p-6 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 mb-4">
                <svg className="w-6 h-6 text-destructive" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <h3 className="text-lg font-semibold text-destructive">Error Loading Conversations</h3>
              </div>
              <p className="text-destructive/80 mb-4">{error}</p>
              <button 
                onClick={fetchUserConversations}
                className="btn-primary"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Main Chat Interface */}
          {!loading && !error && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              
              {/* Conversations Sidebar */}
              <div className="xl:col-span-1">
                <div className="card p-6 sticky top-8">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-card-foreground">
                      Conversations
                    </h2>
                    <div className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium">
                      {conversations.length}
                    </div>
                  </div>
                  
                  {conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <span className="text-2xl">💬</span>
                      </div>
                      <h3 className="text-lg font-semibold text-card-foreground mb-2">No Conversations Yet</h3>
                      <p className="text-muted-foreground text-sm mb-4">Start chatting with @influai on Farcaster!</p>
                      <a 
                        href="/how-it-works" 
                        className="btn-primary text-sm"
                      >
                        Learn How It Works
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {conversations.map((conv) => (
                        <div 
                          key={conv.conversationId}
                          className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${
                            selectedConversation === conv.conversationId 
                              ? 'border-primary bg-primary/5 shadow-lg' 
                              : 'border-border hover:border-primary/50 hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedConversation(conv.conversationId)}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <h3 className="font-semibold text-card-foreground text-sm">
                              {truncateConversationId(conv.conversationId)}
                            </h3>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                              {formatTimestamp(conv.lastActivity)}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <span className="text-primary font-semibold">{conv.totalCasts}</span>
                              <span>casts</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-green-400 font-semibold">{conv.totalSpent}</span>
                              <span>USDC</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-blue-400 font-semibold">{conv.averageScore}</span>
                              <span>avg score</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-purple-400 font-semibold">Week {conv.participations[0]?.weekNumber || 'N/A'}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Chat View */}
              <div className="xl:col-span-2">
                <div className="card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold text-card-foreground">
                      {selectedConv ? `Chat: ${truncateConversationId(selectedConv.conversationId)}` : 'Select a Conversation'}
                    </h2>
                    {selectedConv && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded">
                          {selectedConv.totalCasts} casts
                        </span>
                        <span className="bg-blue-900/30 text-blue-400 px-2 py-1 rounded">
                          {selectedConv.totalSpent} USDC
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {!selectedConv ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                        <span className="text-3xl">💬</span>
                      </div>
                      <h3 className="text-xl font-semibold text-card-foreground mb-3">Select a Conversation</h3>
                      <p className="text-muted-foreground">Choose a conversation from the sidebar to view the chat history</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      
                      {/* Chat Messages */}
                      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                        {selectedConv.casts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                              <span className="text-2xl">📝</span>
                            </div>
                            <h3 className="text-lg font-semibold text-card-foreground mb-2">No Messages Available</h3>
                            <p className="text-muted-foreground text-sm">Cast content may not be accessible at this time</p>
                          </div>
                        ) : (
                          selectedConv.casts
                            .filter(cast => cast && !cast.error && cast.author) // Filter out failed/invalid casts
                            .map((cast, index) => {
                              const participation = selectedConv.participations.find(p => p.castHash === cast.hash);
                              const isBot = cast.isBot || cast.author?.username === 'influai';
                            
                            return (
                              <div 
                                key={cast.hash}
                                className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
                              >
                                <div 
                                  className={`max-w-xs lg:max-w-lg px-4 py-3 rounded-2xl space-y-3 ${
                                    isBot 
                                      ? 'bg-muted border-l-4 border-primary' 
                                      : 'bg-primary text-primary-foreground'
                                  }`}
                                >
                                  {/* Message Header */}
                                  <div className="flex items-center gap-2">
                                    <img 
                                      src={cast.author.pfp_url} 
                                      alt={cast.author.display_name}
                                      className="w-6 h-6 rounded-full"
                                      onError={(e) => {
                                        e.currentTarget.src = '/default-avatar.png';
                                      }}
                                    />
                                    <span className="text-sm font-semibold">
                                      {cast.author.display_name}
                                      {isBot && <span className="ml-1">🤖</span>}
                                    </span>
                                    {cast.source === 'blockchain' && (
                                      <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                                        🔗 On-chain
                                      </span>
                                    )}
                                  </div>
                                  
                                  {/* Message Content */}
                                  <p className="text-sm leading-relaxed">{cast.text}</p>
                                  
                                  {/* Message Footer */}
                                  <div className="text-xs opacity-75 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span>{formatTimestamp(cast.timestamp)}</span>
                                      {participation && (
                                        <>
                                          <span>•</span>
                                          <span className="text-green-400 font-medium">{participation.usdcAmount} USDC</span>
                                          {participation.isEvaluated && (
                                            <>
                                              <span>•</span>
                                              <span className="text-blue-400 font-medium">Score: {participation.aiScore}</span>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      
                      {/* Conversation Summary */}
                      {selectedConv && (
                        <div className="border-t pt-6">
                          <h3 className="text-lg font-semibold text-card-foreground mb-4">Conversation Summary</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-4 border border-blue-500/20">
                              <div className="text-2xl font-bold text-blue-400 mb-1">
                                {selectedConv.totalCasts}
                              </div>
                              <p className="text-muted-foreground text-sm font-medium">Total Casts</p>
                            </div>
                            
                            <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/20">
                              <div className="text-2xl font-bold text-green-400 mb-1">
                                {selectedConv.totalSpent}
                              </div>
                              <p className="text-muted-foreground text-sm font-medium">Total Spent (USDC)</p>
                            </div>
                            
                            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-4 border border-purple-500/20">
                              <div className="text-2xl font-bold text-purple-400 mb-1">
                                {selectedConv.averageScore}
                              </div>
                              <p className="text-muted-foreground text-sm font-medium">Average Score</p>
                            </div>
                            
                            <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-4 border border-orange-500/20">
                              <div className="text-lg font-bold text-orange-400 mb-1">
                                {selectedConv.participations[0]?.weekNumber || 'N/A'}
                              </div>
                              <p className="text-muted-foreground text-sm font-medium">Week Number</p>
                            </div>
                          </div>
                          
                          <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-semibold text-card-foreground mb-2">Conversation Details</h4>
                            <div className="text-sm text-muted-foreground space-y-1">
                              <p><span className="font-medium text-card-foreground">Started:</span> {formatTimestamp(selectedConv.startTime)}</p>
                              <p><span className="font-medium text-card-foreground">Last Activity:</span> {formatTimestamp(selectedConv.lastActivity)}</p>
                              <p><span className="font-medium text-card-foreground">Conversation ID:</span> <code className="bg-background px-2 py-1 rounded text-xs">{selectedConv.conversationId}</code></p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card py-6 mt-12 border-t border-border">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Built on Base Network • Powered by Farcaster • influai.xyz
            </p>
            
            {/* BaseXP Footer Widget */}
            <div 
              className="basexp-footer-widget" 
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 
                fontSize: '13px', 
                lineHeight: '1.5'
              }}
            >
              <a 
                href="https://basexp.org" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  color: '#9ca3af', 
                  textDecoration: 'none', 
                  transition: 'color 0.3s ease'
                }}
                onMouseOver={(e) => {
                  const logo = e.currentTarget.querySelector('.basexp-logo') as HTMLImageElement;
                  if (logo) {
                    logo.style.filter = 'brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(1456%) hue-rotate(213deg) brightness(97%) contrast(101%)';
                  }
                }}
                onMouseOut={(e) => {
                  const logo = e.currentTarget.querySelector('.basexp-logo') as HTMLImageElement;
                  if (logo) {
                    logo.style.filter = 'brightness(0) invert(1)';
                  }
                }}
              >
                <span style={{fontSize: '13px', transition: 'color 0.3s ease'}}>
                  Powered by
                </span>
                <img 
                  src="https://basexp.org/logo.svg" 
                  alt="BaseXP" 
                  className="basexp-logo" 
                  style={{
                    height: '16px', 
                    width: 'auto', 
                    display: 'inline-block', 
                    verticalAlign: 'middle', 
                    filter: 'brightness(0) invert(1)', 
                    transition: 'filter 0.5s ease', 
                    cursor: 'pointer'
                  }}
                />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}