'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import UserDashboard from './components/UserDashboard';
import AdminDashboard from './components/AdminDashboard';

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
      const response = await fetch('/api/prize-data');
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
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Loveall Prize Pool
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            Mention @loveall on Farcaster to participate in the weekly prize pool
          </p>
        </div>

        {/* Admin Dashboard */}
        <AdminDashboard />

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




      </main>

      {/* Footer */}
      <footer className="bg-gray-100 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 text-sm">
            Built on Base Network
          </p>
        </div>
      </footer>
    </div>
  );
}
