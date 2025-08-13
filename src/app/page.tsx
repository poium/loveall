'use client';

import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

interface PrizePoolData {
  currentWeek: number;
  currentPrizePool: string;
  totalParticipants: number;
  weekStartTime: number;
}

interface UserData {
  balance: string;
  hasSufficientBalance: boolean;
  hasParticipatedThisWeek: boolean;
  participationsCount: number;
  participations: Array<{
    user: string;
    castHash: string;
    timestamp: number;
    weekNumber: number;
    usdcAmount: string;
    isEvaluated: boolean;
  }>;
}

// Contract addresses
const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Contract ABIs
const CONTRACT_ABI = [
  {
    name: 'topUp',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: []
  },
  {
    name: 'withdrawBalance',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: []
  }
];

const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
];

export default function Home() {
  const [prizePoolData, setPrizePoolData] = useState<PrizePoolData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(0);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');
  const [allowance, setAllowance] = useState('0');
  const [transactionSuccess, setTransactionSuccess] = useState('');
  const [transactionError, setTransactionError] = useState('');
  const { isConnected, address } = useAccount();

  // Wagmi hooks for contract interactions
  const { writeContract: writeContractTopUp, isPending: isTopUpPending, data: topUpHash } = useWriteContract();
  const { writeContract: writeContractWithdraw, isPending: isWithdrawPending, data: withdrawHash } = useWriteContract();
  const { writeContract: writeContractApprove, isPending: isApprovePending, data: approveHash } = useWriteContract();

  // Wait for transaction receipts
  const { isLoading: isTopUpConfirming, isSuccess: isTopUpSuccess } = useWaitForTransactionReceipt({
    hash: topUpHash,
  });

  const { isLoading: isWithdrawConfirming, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({
    hash: withdrawHash,
  });

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  useEffect(() => {
    fetchPrizePoolData();
    
    // Refresh data every 1 minute
    const interval = setInterval(() => {
      fetchPrizePoolData();
      if (isConnected && address) {
        fetchUserData();
      }
    }, 60000); // 1 minute
    
    return () => clearInterval(interval);
  }, [isConnected, address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserData();
    }
  }, [isConnected, address]);

  // Handle transaction success
  useEffect(() => {
    if (isTopUpSuccess) {
      setTransactionSuccess(`Successfully topped up ${topUpAmount} USDC to contract`);
      setTopUpAmount('');
      fetchUserData();
      fetchAllowance();
    }
  }, [isTopUpSuccess, topUpAmount]);

  useEffect(() => {
    if (isWithdrawSuccess) {
      setTransactionSuccess(`Successfully withdrew ${withdrawAmount} USDC from contract`);
      setWithdrawAmount('');
      fetchUserData();
    }
  }, [isWithdrawSuccess, withdrawAmount]);

  useEffect(() => {
    if (isApproveSuccess) {
      setTransactionSuccess(`Successfully approved ${approvalAmount} USDC for contract`);
      setApprovalAmount('');
      fetchAllowance();
    }
  }, [isApproveSuccess, approvalAmount]);

  const fetchPrizePoolData = async () => {
    try {
      setLoading(true);
      console.log('Fetching prize pool data...');
      const response = await fetch('/api/prize-data');
      if (response.ok) {
        const data = await response.json();
        console.log('Prize pool data received:', data);
        setPrizePoolData(data);
      } else {
        console.error('Failed to fetch prize pool data:', response.status, response.statusText);
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

  const fetchUserData = async () => {
    if (!address) return;
    
    try {
      setUserLoading(true);
      const response = await fetch(`/api/check-balance?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('User data received:', data);
        setUserData({
          balance: data.contractBalance || '0',
          hasSufficientBalance: data.hasSufficientBalance || false,
          hasParticipatedThisWeek: data.hasParticipatedThisWeek || false,
          participationsCount: data.participationsCount || 0,
          participations: data.participations || []
        });
        
        // Also fetch allowance data
        await fetchAllowance();
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setUserLoading(false);
    }
  };

  const fetchAllowance = async () => {
    if (!address) return;
    
    try {
      const response = await fetch(`/api/check-allowance?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Allowance data received:', data);
        setAllowance(data.allowance || '0');
      }
    } catch (error) {
      console.error('Error fetching allowance:', error);
    }
  };

  const handleManualRefresh = async () => {
    if (refreshDisabled) return;
    
    setRefreshDisabled(true);
    setRefreshCountdown(15);
    
    // Fetch both data types
    await fetchPrizePoolData();
    if (isConnected && address) {
      await fetchUserData();
      await fetchAllowance();
    }
    
    // Start countdown timer
    const countdownInterval = setInterval(() => {
      setRefreshCountdown((prev) => {
        if (prev <= 1) {
          setRefreshDisabled(false);
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Contract interaction functions
  const handleTopUp = async () => {
    if (!address || !topUpAmount || parseFloat(topUpAmount) <= 0) return;
    
    try {
      setTransactionError('');
      setTransactionSuccess('');
      
      // Convert USDC amount to wei (6 decimals)
      const amountInWei = BigInt(Math.floor(parseFloat(topUpAmount) * 1000000));
      
      // Call the contract topUp function
      writeContractTopUp({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'topUp',
        args: [amountInWei]
      });
      
    } catch (error) {
      console.error('Top up error:', error);
      setTransactionError('Failed to top up. Please try again.');
    }
  };

  const handleWithdraw = async () => {
    if (!address || !withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    
    try {
      setTransactionError('');
      setTransactionSuccess('');
      
      // Convert USDC amount to wei (6 decimals)
      const amountInWei = BigInt(Math.floor(parseFloat(withdrawAmount) * 1000000));
      
      // Call the contract withdrawBalance function
      writeContractWithdraw({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'withdrawBalance',
        args: [amountInWei]
      });
      
    } catch (error) {
      console.error('Withdraw error:', error);
      setTransactionError('Failed to withdraw. Please try again.');
    }
  };

  const handleApprove = async () => {
    if (!address || !approvalAmount || parseFloat(approvalAmount) <= 0) return;
    
    try {
      setTransactionError('');
      setTransactionSuccess('');
      
      // Convert USDC amount to wei (6 decimals)
      const amountInWei = BigInt(Math.floor(parseFloat(approvalAmount) * 1000000));
      
      // Call the USDC approve function
      writeContractApprove({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS as `0x${string}`, amountInWei]
      });
      
    } catch (error) {
      console.error('Approval error:', error);
      setTransactionError('Failed to approve USDC. Please try again.');
    }
  };



  const formatUSDC = (amount: string) => {
    return parseFloat(amount).toFixed(2);
  };

  const getTimeUntilNextWeek = () => {
    if (!prizePoolData) return '';
    
    const now = Date.now();
    const weekStart = prizePoolData.weekStartTime;
    const weekDuration = 2 * 60 * 60 * 1000; // 2 hours in milliseconds (for testing)
    const nextWeekStart = weekStart + weekDuration;
    const timeLeft = nextWeekStart - now;
    
    if (timeLeft <= 0) return 'New week starting soon!';
    
    const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-indigo-900">
      {/* Header */}
      <header className="bg-gray-800/80 backdrop-blur-sm border-b border-purple-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-lg">❤️</span>
              </div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                Loveall
              </h1>
            </div>
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
                       {/* Comprehensive Data Overview - Top Block */}
               <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-purple-500/20">
                 <div className="flex justify-between items-center mb-6">
                   <div>
                     <h2 className="text-2xl font-bold text-white">📊 Complete System Overview</h2>
                     <p className="text-sm text-gray-400 mt-1">Auto-refresh every 1 minute</p>
                   </div>
                   <button
                     onClick={handleManualRefresh}
                     disabled={refreshDisabled}
                     className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
                       refreshDisabled
                         ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                         : 'bg-purple-600 hover:bg-purple-700 text-white hover:scale-105'
                     }`}
                   >
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                     </svg>
                     {refreshDisabled ? `Refresh (${refreshCountdown}s)` : 'Refresh'}
                   </button>
                 </div>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-400 mx-auto"></div>
              <p className="mt-2 text-gray-300">Loading system data...</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* getCommonData() Section */}
              <div>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                  <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm mr-3">getCommonData()</span>
                  Contract System Data
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Total Prize Pool */}
                  <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl p-4 border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-400 mb-1">
                      {formatUSDC(prizePoolData?.currentPrizePool || '0')} USDC
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Current Week Prize Pool</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Accumulated from this week's participations (0.01 USDC per cast)
                    </p>
                  </div>

                  {/* Current Week */}
                  <div className="bg-gradient-to-r from-pink-900/30 to-rose-900/30 rounded-xl p-4 border border-pink-500/20">
                    <div className="text-2xl font-bold text-pink-400 mb-1">
                      {prizePoolData?.currentWeek || 1}
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Current Week</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Weekly cycle number (resets every 2 hours for testing)
                    </p>
                  </div>

                  {/* Total Participants */}
                  <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-4 border border-blue-500/20">
                    <div className="text-2xl font-bold text-blue-400 mb-1">
                      {prizePoolData?.totalParticipants || 0}
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Participants This Week</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Unique users who participated in current week
                    </p>
                  </div>

                  {/* Time Remaining */}
                  <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/20">
                    <div className="text-lg font-bold text-green-400 mb-1">
                      {getTimeUntilNextWeek()}
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Until Next Winner</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Time remaining in current weekly cycle
                    </p>
                  </div>

                  {/* Week Start Time */}
                  <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-xl p-4 border border-yellow-500/20">
                    <div className="text-sm font-bold text-yellow-400 mb-1">
                      {prizePoolData?.weekStartTime ? formatTimestamp(prizePoolData.weekStartTime) : 'N/A'}
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Week Start Time</p>
                    <p className="text-gray-400 text-xs mt-1">
                      When the current weekly cycle began
                    </p>
                  </div>

                  {/* Rollover Amount */}
                  <div className="bg-gradient-to-r from-teal-900/30 to-cyan-900/30 rounded-xl p-4 border border-teal-500/20">
                    <div className="text-2xl font-bold text-teal-400 mb-1">
                      0.00 USDC
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Rollover Amount</p>
                    <p className="text-gray-400 text-xs mt-1">
                      10% of previous week's pool (if any)
                    </p>
                  </div>

                  {/* Total Prize Pool Ever */}
                  <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl p-4 border border-indigo-500/20">
                    <div className="text-2xl font-bold text-indigo-400 mb-1">
                      {formatUSDC(prizePoolData?.currentPrizePool || '0')} USDC
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Total Prize Pool Ever</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Cumulative total of all prize pools
                    </p>
                  </div>

                  {/* Current Week Winner */}
                  <div className="bg-gradient-to-r from-red-900/30 to-pink-900/30 rounded-xl p-4 border border-red-500/20">
                    <div className="text-sm font-bold text-red-400 mb-1">
                      Not Selected
                    </div>
                    <p className="text-gray-300 text-sm font-medium">Current Week Winner</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Winner selected by admin (if any)
                    </p>
                  </div>
                </div>
              </div>

              {/* getUserData() Section - Only show when connected */}
              {isConnected && address && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="bg-green-600 text-white px-2 py-1 rounded text-sm mr-3">getUserData()</span>
                    Your Personal Data
                  </h3>
                  
                  {userLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400 mx-auto"></div>
                      <p className="mt-2 text-gray-300 text-sm">Loading your data...</p>
                    </div>
                  ) : userData ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* Contract Balance */}
                      <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/20">
                        <div className="text-2xl font-bold text-green-400 mb-1">
                          {formatUSDC(userData.balance)} USDC
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Your Contract Balance</p>
                        <p className="text-gray-400 text-xs mt-1">
                          USDC available for participation (not wallet balance)
                        </p>
                      </div>

                      {/* Sufficient Balance */}
                      <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-4 border border-blue-500/20">
                        <div className="text-2xl font-bold text-blue-400 mb-1">
                          {userData.hasSufficientBalance ? 'Yes' : 'No'}
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Has Sufficient Balance</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Can participate (≥ 0.01 USDC required)
                        </p>
                      </div>

                      {/* Participated This Week */}
                      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-4 border border-purple-500/20">
                        <div className="text-2xl font-bold text-purple-400 mb-1">
                          {userData.hasParticipatedThisWeek ? 'Yes' : 'No'}
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Participated This Week</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Has already participated in current week
                        </p>
                      </div>

                      {/* Participation Count */}
                      <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-xl p-4 border border-yellow-500/20">
                        <div className="text-2xl font-bold text-yellow-400 mb-1">
                          {userData.participationsCount}
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Total Participations</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Number of casts you've participated in
                        </p>
                      </div>

                      {/* Can Participate */}
                      <div className="bg-gradient-to-r from-teal-900/30 to-cyan-900/30 rounded-xl p-4 border border-teal-500/20">
                        <div className="text-2xl font-bold text-teal-400 mb-1">
                          {userData.hasSufficientBalance && !userData.hasParticipatedThisWeek ? 'Yes' : 'No'}
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Can Participate Now</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Ready to send @loveall mentions
                        </p>
                      </div>

                      {/* Total Spent */}
                      <div className="bg-gradient-to-r from-red-900/30 to-pink-900/30 rounded-xl p-4 border border-red-500/20">
                        <div className="text-2xl font-bold text-red-400 mb-1">
                          {(userData.participationsCount * 0.01).toFixed(2)} USDC
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Total Spent</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Total USDC spent on participations
                        </p>
                      </div>

                      {/* Recent Activity */}
                      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl p-4 border border-indigo-500/20">
                        <div className="text-2xl font-bold text-indigo-400 mb-1">
                          {userData.participations.length}
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Recent Activities</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Number of participation records
                        </p>
                      </div>

                      {/* Status Summary */}
                      <div className="bg-gradient-to-r from-gray-900/30 to-gray-800/30 rounded-xl p-4 border border-gray-500/20">
                        <div className="text-lg font-bold text-gray-300 mb-1">
                          {userData.hasSufficientBalance && !userData.hasParticipatedThisWeek 
                            ? 'Ready to Cast' 
                            : !userData.hasSufficientBalance 
                              ? 'Need Balance' 
                              : 'Already Participated'}
                        </div>
                        <p className="text-gray-300 text-sm font-medium">Current Status</p>
                        <p className="text-gray-400 text-xs mt-1">
                          Your participation eligibility
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-300">Failed to load user data</p>
                    </div>
                  )}
                </div>
              )}

              {/* User Actions Section - Only show when connected */}
              {isConnected && address && (
                <div>
                  <h3 className="text-xl font-bold text-white mb-4 flex items-center">
                    <span className="bg-orange-600 text-white px-2 py-1 rounded text-sm mr-3">Actions</span>
                    Your Wallet Actions
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Up Section */}
                    <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600/20">
                      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs mr-2">Top Up</span>
                        Add USDC to Contract
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Amount (USDC)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.01"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={topUpAmount}
                              onChange={(e) => setTopUpAmount(e.target.value)}
                            />
                            <div className="absolute right-3 top-2 text-xs text-gray-400">
                              Min: 0.01 USDC
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-400 space-y-1">
                            <p>• <strong>Minimum:</strong> 0.01 USDC (required for participation)</p>
                            <p>• <strong>Recommended:</strong> 1.00 USDC (for multiple casts)</p>
                            <p>• <strong>Note:</strong> This adds USDC to your contract balance, not your wallet</p>
                            <p>• <strong>Usage:</strong> Each @loveall mention costs 0.01 USDC from contract balance</p>
                          </div>
                        </div>
                        <button
                          onClick={handleTopUp}
                          disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || isTopUpPending || isTopUpConfirming}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            !topUpAmount || parseFloat(topUpAmount) <= 0 || isTopUpPending || isTopUpConfirming
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                          }`}
                        >
                          {isTopUpPending ? 'Confirming...' : isTopUpConfirming ? 'Processing...' : 'Top Up Contract'}
                        </button>
                      </div>
                    </div>

                    {/* Withdraw Section */}
                    <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600/20">
                      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <span className="bg-red-600 text-white px-2 py-1 rounded text-xs mr-2">Withdraw</span>
                        Withdraw from Contract
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Amount (USDC)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.01"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                            />
                            <div className="absolute right-3 top-2 text-xs text-gray-400">
                              Available: {userData?.balance || '0.00'} USDC
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-400 space-y-1">
                            <p>• <strong>Available Balance:</strong> {userData?.balance || '0.00'} USDC in contract</p>
                            <p>• <strong>Minimum:</strong> 0.01 USDC (cannot withdraw less)</p>
                            <p>• <strong>Note:</strong> This withdraws USDC back to your wallet</p>
                            <p>• <strong>Warning:</strong> Withdrawing may affect your ability to participate</p>
                          </div>
                        </div>
                        <button
                          onClick={handleWithdraw}
                          disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isWithdrawPending || isWithdrawConfirming}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            !withdrawAmount || parseFloat(withdrawAmount) <= 0 || isWithdrawPending || isWithdrawConfirming
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-red-600 hover:bg-red-700 text-white hover:scale-105'
                          }`}
                        >
                          {isWithdrawPending ? 'Confirming...' : isWithdrawConfirming ? 'Processing...' : 'Withdraw from Contract'}
                        </button>
                      </div>
                    </div>

                    {/* Allowance Section */}
                    <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600/20">
                      <h4 className="text-lg font-semibold text-white mb-4 flex items-center">
                        <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs mr-2">Allowance</span>
                        USDC Contract Approval
                      </h4>
                      <div className="space-y-4">
                        <div className="text-sm text-gray-300">
                          <p className="mb-2">Current Allowance: <span className="text-white font-medium">{allowance || '0.00'} USDC</span></p>
                          <p className="mb-4">Approve the contract to spend your USDC for top-ups.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">
                            Approval Amount (USDC)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="10.00"
                              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={approvalAmount}
                              onChange={(e) => setApprovalAmount(e.target.value)}
                            />
                            <div className="absolute right-3 top-2 text-xs text-gray-400">
                              Current: {allowance || '0.00'} USDC
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-gray-400 space-y-1">
                            <p>• <strong>Current Allowance:</strong> {allowance || '0.00'} USDC (contract can spend)</p>
                            <p>• <strong>Recommended:</strong> 10.00 USDC (for multiple top-ups)</p>
                            <p>• <strong>Purpose:</strong> Allows contract to transfer USDC from your wallet</p>
                            <p>• <strong>Security:</strong> You can revoke this approval anytime</p>
                            <p>• <strong>Note:</strong> This is required before you can top up your contract balance</p>
                          </div>
                        </div>
                        <button
                          onClick={handleApprove}
                          disabled={!approvalAmount || parseFloat(approvalAmount) <= 0 || isApprovePending || isApproveConfirming}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            !approvalAmount || parseFloat(approvalAmount) <= 0 || isApprovePending || isApproveConfirming
                              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                              : 'bg-yellow-600 hover:bg-yellow-700 text-white hover:scale-105'
                          }`}
                        >
                          {isApprovePending ? 'Confirming...' : isApproveConfirming ? 'Processing...' : 'Approve USDC'}
                        </button>
                      </div>
                    </div>


                  </div>

                  {/* Transaction Status */}
                  {(isTopUpPending || isWithdrawPending || isApprovePending || isTopUpConfirming || isWithdrawConfirming || isApproveConfirming) && (
                    <div className="mt-6 p-4 bg-blue-900/50 border border-blue-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                        <span className="text-blue-300 font-medium">
                          {isTopUpPending && 'Confirming top-up transaction...'}
                          {isWithdrawPending && 'Confirming withdrawal transaction...'}
                          {isApprovePending && 'Confirming approval transaction...'}
                          {isTopUpConfirming && 'Processing top-up transaction...'}
                          {isWithdrawConfirming && 'Processing withdrawal transaction...'}
                          {isApproveConfirming && 'Processing approval transaction...'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Success Messages */}
                  {transactionSuccess && (
                    <div className="mt-6 p-4 bg-green-900/50 border border-green-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-green-300 font-medium">{transactionSuccess}</span>
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {transactionError && (
                    <div className="mt-6 p-4 bg-red-900/50 border border-red-500/20 rounded-xl">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <span className="text-red-300 font-medium">{transactionError}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Data Context Explanation */}
              <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/20">
                <h4 className="font-semibold text-white mb-3">📋 Data Context & Explanation</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-blue-400 mb-2">getCommonData() - System Overview</h5>
                    <ul className="text-gray-300 space-y-1">
                      <li>• <strong>Current Week Prize Pool:</strong> USDC collected this week</li>
                      <li>• <strong>Current Week:</strong> Weekly cycle number</li>
                      <li>• <strong>Participants:</strong> Unique users this week</li>
                      <li>• <strong>Time Remaining:</strong> Until next winner selection</li>
                      <li>• <strong>Week Start Time:</strong> When cycle began</li>
                      <li>• <strong>Rollover Amount:</strong> 10% from previous week</li>
                      <li>• <strong>Total Prize Pool:</strong> All-time cumulative</li>
                      <li>• <strong>Current Winner:</strong> Selected by admin</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-green-400 mb-2">getUserData() - Personal Data</h5>
                    <ul className="text-gray-300 space-y-1">
                      <li>• <strong>Contract Balance:</strong> Your USDC in contract</li>
                      <li>• <strong>Sufficient Balance:</strong> Can participate (≥0.01 USDC)</li>
                      <li>• <strong>Participated This Week:</strong> Already cast this week</li>
                      <li>• <strong>Participation Count:</strong> Total casts made</li>
                      <li>• <strong>Can Participate:</strong> Ready to cast now</li>
                      <li>• <strong>Total Spent:</strong> USDC spent on participations</li>
                      <li>• <strong>Recent Activities:</strong> Participation records</li>
                      <li>• <strong>Status:</strong> Current eligibility</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Connect Wallet Prompt - Only show when not connected */}
        {!isConnected && (
          /* Connect Wallet Prompt */
          <div className="text-center py-16">
            <div className="max-w-md mx-auto">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-3xl">💝</span>
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Connect Your Wallet</h3>
              <p className="text-gray-300 mb-8">
                Connect your wallet to participate in the Loveall prize pool and manage your balance.
              </p>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                <h4 className="text-lg font-semibold text-white mb-3">How it works:</h4>
                <ul className="text-gray-300 text-sm space-y-2 text-left">
                  <li>• Connect your wallet to Base network</li>
                  <li>• Top up your contract balance with USDC</li>
                  <li>• Mention @loveall on Farcaster to participate</li>
                  <li>• Pay 0.01 USDC per cast</li>
                  <li>• Weekly winners get 90% of the prize pool</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800/50 py-6 mt-12 border-t border-purple-500/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400 text-sm">
            Built on Base Network • Powered by Farcaster
          </p>
        </div>
      </footer>
    </div>
  );
}
