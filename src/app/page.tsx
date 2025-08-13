'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import UserDashboard from './components/UserDashboard';

interface PrizePoolData {
  currentWeek: number;
  currentPrizePool: string;
  totalParticipants: number;
  weekStartTime: number;
}

export default function Home() {
  const [prizePoolData, setPrizePoolData] = useState<PrizePoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const { isConnected } = useAccount();

  useEffect(() => {
    fetchPrizePoolData();
  }, []);

  const fetchPrizePoolData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/prize-pool');
      if (response.ok) {
        const data = await response.json();
        setPrizePoolData(data);
      } else {
        console.error('Failed to fetch prize pool data');
        // Fallback to mock data if API fails
        const mockData: PrizePoolData = {
          currentWeek: 1,
          currentPrizePool: "0.00",
          totalParticipants: 0,
          weekStartTime: Date.now()
        };
        setPrizePoolData(mockData);
      }
    } catch (error) {
      console.error('Error fetching prize pool data:', error);
      // Fallback to mock data on error
      const mockData: PrizePoolData = {
        currentWeek: 1,
        currentPrizePool: "0.00",
        totalParticipants: 0,
        weekStartTime: Date.now()
      };
      setPrizePoolData(mockData);
    } finally {
      setLoading(false);
    }
  };

  const formatUSDC = (amount: string) => {
    return parseFloat(amount).toFixed(2);
  };

  const getTimeUntilNextWeek = () => {
    if (!prizePoolData) return '';
    
    const now = Date.now();
    const weekStart = prizePoolData.weekStartTime;
    const weekDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
    const nextWeekStart = weekStart + weekDuration;
    const timeLeft = nextWeekStart - now;
    
    if (timeLeft <= 0) return 'New week starting soon!';
    
    const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    return `${days}d ${hours}h remaining`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-pink-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">❤️</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                Loveall
              </h1>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6">
            The Flirty Prize Pool Bot
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Mention @loveall on Farcaster, pay 1 cent USDC, and get a chance to win the weekly prize pool! 
            The bot uses Grok AI to evaluate cast quality and select winners.
          </p>
          
          {!isConnected && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-800">
                🔗 Connect your wallet to see your participation status
              </p>
            </div>
          )}
        </div>

        {/* User Dashboard */}
        <UserDashboard />

        {/* Prize Pool Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-12">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-gray-900 mb-2">Current Prize Pool</h3>
            <p className="text-gray-600">Week {prizePoolData?.currentWeek || 1}</p>
          </div>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading prize pool data...</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-8">
              {/* Prize Pool Amount */}
              <div className="text-center">
                <div className="text-4xl font-bold text-pink-600 mb-2">
                  {formatUSDC(prizePoolData?.currentPrizePool || '0')} USDC
                </div>
                <p className="text-gray-600">Total Prize Pool</p>
              </div>
              
              {/* Participants */}
              <div className="text-center">
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {prizePoolData?.totalParticipants || 0}
                </div>
                <p className="text-gray-600">Participants This Week</p>
              </div>
              
              {/* Time Remaining */}
              <div className="text-center">
                <div className="text-4xl font-bold text-blue-600 mb-2">
                  {getTimeUntilNextWeek()}
                </div>
                <p className="text-gray-600">Until Next Winner</p>
              </div>
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-6">How It Works</h3>
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-pink-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Mention the Bot</h4>
                  <p className="text-gray-600">Send a cast mentioning @loveall on Farcaster</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Pay 1 Cent USDC</h4>
                  <p className="text-gray-600">Automatically deduct 0.01 USDC from your wallet</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Get AI Response</h4>
                  <p className="text-gray-600">Receive a personalized response from Grok AI</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Win the Prize</h4>
                  <p className="text-gray-600">Best cast of the week wins 90% of the prize pool!</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-pink-100 to-purple-100 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">Recent Activity</h3>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4">
                <p className="text-gray-600 text-sm">No recent activity yet</p>
                <p className="text-gray-400 text-xs">Be the first to participate!</p>
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-pink-500 to-purple-600 rounded-2xl p-12 text-white">
          <h3 className="text-3xl font-bold mb-4">Ready to Start Flirting?</h3>
          <p className="text-xl mb-8 opacity-90">
            Connect your wallet and start participating in the Loveall prize pool!
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            Built with ❤️ on Base Network | Powered by Grok AI
          </p>
        </div>
      </footer>
    </div>
  );
}
