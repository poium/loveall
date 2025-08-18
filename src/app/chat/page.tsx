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
                body: JSON.stringify({ hashes: castHashes })
              });
              
              if (castResponse.ok) {
                const castData = await castResponse.json();
                return {
                  ...conv,
                  casts: castData.casts || []
                };
              } else {
                console.error('Failed to fetch cast content for conversation:', conv.conversationId);
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
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">❤️</span>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  Loveall
                </h1>
              </div>
              
              <nav className="hidden md:flex items-center space-x-6">
                <a 
                  href="/" 
                  className="text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
                >
                  Dashboard
                </a>
                <a 
                  href="/chat" 
                  className="text-purple-600 hover:text-purple-800 transition-colors duration-200 font-medium flex items-center space-x-1"
                >
                  <span>💬</span>
                  <span>Chat History</span>
                </a>
              </nav>
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto p-4">
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-2 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!address) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-lg">❤️</span>
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                  Loveall
                </h1>
              </div>
              
              {/* Navigation */}
              <nav className="hidden md:flex items-center space-x-6">
                <a 
                  href="/" 
                  className="text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
                >
                  Dashboard
                </a>
                <a 
                  href="/chat" 
                  className="text-purple-600 hover:text-purple-800 transition-colors duration-200 font-medium flex items-center space-x-1"
                >
                  <span>💬</span>
                  <span>Chat History</span>
                </a>
              </nav>
            </div>
          </div>
        </header>

        <div className="max-w-4xl mx-auto p-4">
          <div className="text-center py-12">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">💬 Chat History</h1>
            <p className="text-gray-600 mb-8">View your conversation history with the Loveall bot</p>
            <div className="bg-white rounded-lg p-8 shadow-lg">
              <p className="text-lg text-gray-600">Please connect your wallet to view your chat history</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectedConv = conversations.find(c => c.conversationId === selectedConversation);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">❤️</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Loveall
              </h1>
            </div>
            
            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <a 
                href="/" 
                className="text-gray-600 hover:text-gray-800 transition-colors duration-200 font-medium"
              >
                Dashboard
              </a>
              <a 
                href="/chat" 
                className="text-purple-600 hover:text-purple-800 transition-colors duration-200 font-medium flex items-center space-x-1"
              >
                <span>💬</span>
                <span>Chat History</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-4">💬 Chat History</h1>
          <p className="text-gray-600">Your conversation history with the Loveall bot</p>
          {isMounted && address && (
            <p className="text-sm text-gray-500 mt-2">Connected: {truncateAddress(address)}</p>
          )}
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            <p className="mt-2 text-gray-600">Loading conversations...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">Error: {error}</p>
            <button 
              onClick={fetchUserConversations}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversations List */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                Your Conversations ({conversations.length})
              </h2>
              
              {conversations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No conversations found</p>
                  <p className="text-sm mt-2">Start chatting with @loveall on Farcaster!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map((conv) => (
                    <div 
                      key={conv.conversationId}
                      className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                        selectedConversation === conv.conversationId 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() => setSelectedConversation(conv.conversationId)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-gray-800">
                          Conversation {truncateConversationId(conv.conversationId)}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(conv.lastActivity)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">{conv.totalCasts}</span> casts
                        </div>
                        <div>
                          <span className="font-medium">{conv.totalSpent}</span> USDC
                        </div>
                        <div>
                          Score: <span className="font-medium">{conv.averageScore}</span>
                        </div>
                        <div>
                          Started: {formatTimestamp(conv.startTime)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Chat View */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                {selectedConv ? `Chat: ${truncateConversationId(selectedConv.conversationId)}` : 'Select a Conversation'}
              </h2>
              
              {!selectedConv ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Select a conversation from the list to view the chat history</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {selectedConv.casts.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No cast content available</p>
                      <p className="text-sm mt-2">Cast content may not be accessible</p>
                    </div>
                  ) : (
                    selectedConv.casts.map((cast, index) => {
                      const participation = selectedConv.participations.find(p => p.castHash === cast.hash);
                      const isBot = cast.author.username === 'loveall';
                      
                      return (
                        <div 
                          key={cast.hash}
                          className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}
                        >
                          <div 
                            className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                              isBot 
                                ? 'bg-gray-100 text-gray-800' 
                                : 'bg-purple-600 text-white'
                            }`}
                          >
                            <div className="flex items-center mb-1">
                              <img 
                                src={cast.author.pfp_url} 
                                alt={cast.author.display_name}
                                className="w-6 h-6 rounded-full mr-2"
                              />
                              <span className="text-sm font-medium">
                                {cast.author.display_name}
                              </span>
                            </div>
                            
                            <p className="text-sm mb-2">{cast.text}</p>
                            
                            <div className="text-xs opacity-75">
                              {formatTimestamp(cast.timestamp)}
                              {participation && (
                                <span className="ml-2">
                                  • {participation.usdcAmount} USDC
                                  {participation.isEvaluated && (
                                    <span className="ml-1">• Score: {participation.aiScore}</span>
                                  )}
                                </span>
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
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>Total Casts:</strong> {selectedConv.totalCasts}</p>
                    <p><strong>Total Spent:</strong> {selectedConv.totalSpent} USDC</p>
                    <p><strong>Average Score:</strong> {selectedConv.averageScore}</p>
                    <p><strong>Conversation ID:</strong> {selectedConv.conversationId}</p>
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
