'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { FlickeringGrid } from '../components/FlickeringGrid';

interface PrizePoolData {
  totalPrizePool: string;
  currentWeekPrizePool: string;
  rolloverAmount: string;
  totalContributions: string;
  totalProtocolFees: string;
  castCost: string;
  currentWeek: number;
  weekStartTime: number;
  weekEndTime: number;
  currentWeekParticipantsCount: number;
  currentWeekWinner: string;
  currentWeekPrize: string;
  characterName: string;
  characterTask: string;
  characterIsSet: boolean;
}

interface CharacterData {
  name: string;
  task: string;
  traitNames: string[];
  traitValues: number[];
  traitCount: number;
  isSet: boolean;
}

export default function HowItWorks() {
  const [prizePoolData, setPrizePoolData] = useState<PrizePoolData | null>(null);
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const { isConnected, address } = useAccount();

  useEffect(() => {
    fetchPrizePoolData();
    fetchCharacterData();
  }, []);

  const fetchPrizePoolData = async () => {
    try {
      const response = await fetch('/api/prize-data');
      if (response.ok) {
        const data = await response.json();
        setPrizePoolData(data);
      }
    } catch (error) {
      console.error('Error fetching prize pool data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharacterData = async () => {
    try {
      const response = await fetch('/api/character-data');
      if (response.ok) {
        const data = await response.json();
        setCharacterData(data);
      }
    } catch (error) {
      console.error('Error fetching character data:', error);
    }
  };

  const formatUSDC = (amount: string) => {
    return parseFloat(amount).toFixed(2);
  };

  const getTimeUntilNextWeek = () => {
    if (!prizePoolData) return { text: '', ended: false };
    
    const now = Date.now();
    const weekEnd = prizePoolData.weekEndTime;
    const timeLeft = weekEnd - now;
    
    if (timeLeft <= 0) {
      return { text: 'WINNER SELECTION TIME!', ended: true };
    }
    
    const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) {
      return { text: `${days}d ${hours}h ${minutes}m remaining`, ended: false };
    } else if (hours > 0) {
      return { text: `${hours}h ${minutes}m remaining`, ended: false };
    } else {
      return { text: `${minutes}m remaining`, ended: false };
    }
  };

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
              className="transition-colors hover:text-foreground/80 text-foreground"
            >
              How It Works
            </a>
            <a 
              href="/chat" 
              className="transition-colors hover:text-foreground/80 text-muted-foreground flex items-center space-x-1"
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
              <img 
                src="/jordan.gif" 
                alt="Jordan Belfort" 
                className="w-32 h-32 md:w-40 md:h-40 object-cover"
              />
              <div className="flex items-center justify-center">
                <div className="inline-flex items-center space-x-3 bg-primary/10 border border-primary/20 rounded-full px-6 py-3">
                  <span className="text-sm text-muted-foreground font-medium">This week character:</span>
                  <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                    {characterData?.name || 'Jordan Belfort'}
                  </span>
                </div>
              </div>
             
              <div className="space-y-4">
                <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
                  How InfluAI Works
                </h1>
                
                <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto">
                  A complete guide to understanding the InfluAI prize pool system, 
                  from participation to winning strategies.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main className="flex-1 w-full">
        <div className="container mx-auto max-w-6xl py-8 space-y-8 px-4">
          
          {/* Quick Overview */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">🎯 Quick Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">💰</span>
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">Pay to Play</h3>
                <p className="text-muted-foreground text-sm">
                  Each @influai mention costs 1 USDC from your contract balance
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">🤖</span>
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">AI Evaluation</h3>
                <p className="text-muted-foreground text-sm">
                  AI evaluates your conversation based on weekly character traits and task completion
                </p>
              </div>
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-2xl">🏆</span>
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">Win Prizes</h3>
                <p className="text-muted-foreground text-sm">
                  Highest AI score wins 80% of the weekly prize pool (10% rolls over, 10% protocol fee)
                </p>
              </div>
            </div>
          </div>

          {/* Step-by-Step Guide */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">📋 Step-by-Step Guide</h2>
            
            <div className="space-y-8">
              {/* Step 1 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">1</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-card-foreground mb-3">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-4">
                    Connect your Base network wallet to the InfluAI dashboard. You'll need USDC tokens to participate.
                  </p>
                  <div className="bg-blue-900/20 border border-blue-500/20 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-300 mb-2">💡 Pro Tip:</h4>
                    <p className="text-blue-200 text-sm">
                      Make sure you're on the Base network and have some USDC in your wallet for top-ups.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">2</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-card-foreground mb-3">Top Up Your Contract Balance</h3>
                  <p className="text-muted-foreground mb-4">
                    Transfer USDC from your wallet to your contract balance. This is separate from your wallet balance and is used specifically for @influai mentions.
                  </p>
                  <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-300 mb-2">💰 Cost Breakdown:</h4>
                    <ul className="text-purple-200 text-sm space-y-1">
                      <li>• Each @influai mention costs 1 USDC</li>
                      <li>• Recommended: Top up with 10 USDC for multiple participations</li>
                      <li>• Minimum: 1.00 USDC (just enough for one mention)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">3</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-card-foreground mb-3">Understand the Weekly Character</h3>
                  <p className="text-muted-foreground mb-4">
                    Each week features a different AI character with specific traits and a task to complete. Your goal is to engage with this character effectively.
                  </p>
                  {characterData && characterData.isSet ? (
                    <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-4">
                      <h4 className="font-semibold text-green-300 mb-2">🎭 Current Character: {characterData.name}</h4>
                      <p className="text-green-200 text-sm mb-3">{characterData.task}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {characterData.traitNames.map((trait, index) => (
                          <div key={index} className="flex justify-between items-center">
                            <span className="text-green-200 text-sm">{trait}:</span>
                            <span className="text-green-300 font-semibold">{characterData.traitValues[index]}/10</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-900/20 border border-gray-500/20 rounded-lg p-4">
                      <p className="text-gray-300 text-sm">No character set for this week yet. Check back later!</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-yellow-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">4</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-card-foreground mb-3">Mention @influai on Farcaster</h3>
                  <p className="text-muted-foreground mb-4">
                    Go to Farcaster and mention @influai in your cast. The AI will respond based on the weekly character's personality and traits.
                  </p>
                  <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-4">
                    <h4 className="font-semibold text-yellow-300 mb-2">💬 Conversation Rules:</h4>
                    <ul className="text-yellow-200 text-sm space-y-1">
                      <li>• Max 3 conversations per week per user</li>
                      <li>• Max 10 casts per conversation</li>
                      <li>• Each cast costs 1 USDC</li>
                      <li>• Engage with the character's personality and complete their task</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-bold text-lg">5</span>
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-card-foreground mb-3">AI Evaluation & Winner Selection</h3>
                  <p className="text-muted-foreground mb-4">
                    At the end of each week, the AI evaluates all conversations based on the character's traits. The highest-scoring conversation wins the prize pool.
                  </p>
                  <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-4">
                    <h4 className="font-semibold text-red-300 mb-2">🏆 Prize Distribution:</h4>
                    <ul className="text-red-200 text-sm space-y-1">
                      <li>• 80% goes to the winner</li>
                      <li>• 10% rolls over to next week</li>
                      <li>• 10% protocol fee</li>
                      <li>• Current prize pool: {formatUSDC(prizePoolData?.currentWeekPrizePool || '0')} USDC</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Week Status */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">📊 Current Week Status</h2>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-4 border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-400 mb-1">
                    Week {prizePoolData?.currentWeek || 1}
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">Current Week</p>
                </div>
                
                <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/20">
                  <div className="text-2xl font-bold text-green-400 mb-1">
                    {formatUSDC(prizePoolData?.currentWeekPrizePool || '0')} USDC
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">Prize Pool</p>
                </div>
                
                <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-4 border border-purple-500/20">
                  <div className="text-2xl font-bold text-purple-400 mb-1">
                    {prizePoolData?.currentWeekParticipantsCount || 0}
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">Participants</p>
                </div>
                
                <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-4 border border-orange-500/20">
                  <div className="text-lg font-bold text-orange-400 mb-1">
                    {getTimeUntilNextWeek().text || 'Loading...'}
                  </div>
                  <p className="text-muted-foreground text-sm font-medium">Time Remaining</p>
                </div>
              </div>
            )}
          </div>

          {/* Winning Strategies */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">🎯 Winning Strategies</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-card-foreground">💡 General Tips</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Read the character's task description carefully</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Engage with the character's personality traits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Be creative and authentic in your approach</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400 mt-1">✓</span>
                    <span>Build a conversation, don't just send single messages</span>
                  </li>
                </ul>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-card-foreground">🚀 Advanced Strategies</h3>
                <ul className="space-y-2 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">⚡</span>
                    <span>Use multiple conversations to test different approaches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">⚡</span>
                    <span>Study high-scoring traits and tailor your responses</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">⚡</span>
                    <span>Engage early in the week for more practice</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-1">⚡</span>
                    <span>Monitor the prize pool and competition level</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">⚙️ Technical Details</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-3">🔗 Smart Contract</h3>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>Contract Address:</strong> <code className="bg-background px-2 py-1 rounded">0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa</code>
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Network:</strong> Base Mainnet
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>USDC Token:</strong> <code className="bg-background px-2 py-1 rounded">0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913</code>
                  </p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-3">🤖 AI System</h3>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>AI Provider:</strong> Grok AI (xAI)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Evaluation:</strong> Character trait-based scoring (0-50 points)
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Response Generation:</strong> Contextual, personality-driven responses
                  </p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-3">📊 Data Storage</h3>
                <div className="bg-muted rounded-lg p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <strong>On-Chain:</strong> User balances, participation records, AI scores
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Off-Chain:</strong> Cast content, conversation history, character data
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <strong>Events:</strong> Participation events for efficient indexing
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="card p-6">
            <h2 className="text-2xl font-bold text-card-foreground mb-6">❓ Frequently Asked Questions</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-2">How much does it cost to participate?</h3>
                <p className="text-muted-foreground">
                  Each @influai mention costs 1 USDC from your contract balance. 
                  You can participate up to 3 times per week with up to 10 casts per conversation.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-2">How is the winner selected?</h3>
                <p className="text-muted-foreground">
                  The AI evaluates all conversations based on the weekly character's traits and task completion. 
                  The conversation with the highest AI score (0-50 points) wins the prize pool.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-2">What happens to my USDC if I don't win?</h3>
                <p className="text-muted-foreground">
                  Your USDC goes into the prize pool for that week. 80% goes to the winner, 10% rolls over to next week, 
                  and 10% goes to protocol fees. You can withdraw any remaining balance from your contract balance anytime.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-2">How often do characters change?</h3>
                <p className="text-muted-foreground">
                  Characters change weekly. Each week features a new AI personality with different traits and tasks. 
                  Check the dashboard to see the current character and their specific requirements.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-card-foreground mb-2">Can I participate multiple times?</h3>
                <p className="text-muted-foreground">
                  Yes! You can have up to 3 conversations per week, with up to 10 casts per conversation. 
                  This gives you multiple chances to win and practice different strategies.
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          {!isConnected && (
            <div className="card p-6 text-center">
              <h2 className="text-2xl font-bold text-card-foreground mb-4">Ready to Start?</h2>
              <p className="text-muted-foreground mb-6">
                Connect your wallet and start participating in the InfluAI prize pool system!
              </p>
              <ConnectButton />
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
