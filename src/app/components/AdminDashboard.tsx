'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

interface AdminData {
  currentWeek: number;
  currentPrizePool: string;
  totalParticipants: number;
  weekStartTime: number;
  rolloverAmount: string;
  totalPrizePool: string;
  isOwner: boolean;
}

interface WeeklyWinner {
  week: number;
  winner: string;
  prize: string;
  timestamp: number;
}

const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';

const CONTRACT_ABI = [
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
  },
  {
    name: 'getCommonData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        components: [
          { name: 'totalPrizePool', type: 'uint256' },
          { name: 'currentWeekPrizePool', type: 'uint256' },
          { name: 'rolloverAmount', type: 'uint256' },
          { name: 'currentWeek', type: 'uint256' },
          { name: 'weekStartTime', type: 'uint256' },
          { name: 'weekEndTime', type: 'uint256' },
          { name: 'currentWeekParticipantsCount', type: 'uint256' },
          { name: 'currentWeekWinner', type: 'address' },
          { name: 'currentWeekPrize', type: 'uint256' }
        ],
        name: '',
        type: 'tuple'
      }
    ]
  },
  {
    name: 'setWeeklyWinner',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'winner', type: 'address' }],
    outputs: []
  },
  {
    name: 'distributePrize',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'startNewWeek',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: []
  },
  {
    name: 'getRolloverAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'totalPrizePool',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'currentWeekPrizePool',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'currentWeek',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'weekStartTime',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'getWeeklySummary',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'week', type: 'uint256' }],
    outputs: [
      { name: 'participants', type: 'address[]' },
      { name: 'winner', type: 'address' },
      { name: 'prize', type: 'uint256' },
      { name: 'participantsCount', type: 'uint256' }
    ]
  }
] as const;

export default function AdminDashboard() {
  const { address, isConnected } = useAccount();
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(false);
  const [winnerAddress, setWinnerAddress] = useState('');
  const [weeklyWinners, setWeeklyWinners] = useState<WeeklyWinner[]>([]);
  const [activeTab, setActiveTab] = useState('overview');

  // Contract write hooks
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConnected && address) {
      fetchAdminData();
      fetchWeeklyWinners();
    }
  }, [isConnected, address, isSuccess]);

  const fetchAdminData = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/admin-data?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setAdminData(data);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeeklyWinners = async () => {
    try {
      const response = await fetch('/api/weekly-winners');
      if (response.ok) {
        const data = await response.json();
        setWeeklyWinners(data.winners || []);
      }
    } catch (error) {
      console.error('Error fetching weekly winners:', error);
    }
  };

  const setWinner = () => {
    if (!winnerAddress || !winnerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      alert('Please enter a valid Ethereum address');
      return;
    }

    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'setWeeklyWinner',
      args: [winnerAddress as `0x${string}`],
    });
  };

  const distributePrize = () => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'distributePrize',
    });
  };

  const startNewWeek = () => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'startNewWeek',
    });
  };

  const pauseContract = () => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'pause',
    });
  };

  const unpauseContract = () => {
    writeContract({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: CONTRACT_ABI,
      functionName: 'unpause',
    });
  };

  const emergencyWithdraw = () => {
    if (confirm('Are you sure you want to perform emergency withdrawal? This will withdraw all funds.')) {
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'emergencyWithdraw',
      });
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h3>
        <p className="text-gray-600">Please connect your wallet to access admin functions.</p>
      </div>
    );
  }

  if (!adminData?.isOwner) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">Admin Dashboard</h3>
        <p className="text-gray-600">Only the contract owner can access admin functions.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Admin Dashboard</h3>
        <div className="text-sm text-gray-500">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 rounded-lg p-1">
        {['overview', 'actions'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading admin data...</p>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Current Week</h4>
                <p className="text-3xl font-bold text-pink-600">{adminData?.currentWeek || 0}</p>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Current Prize Pool</h4>
                <p className="text-3xl font-bold text-blue-600">
                  ${parseFloat(adminData?.currentPrizePool || '0').toFixed(2)}
                </p>
              </div>

              <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Total Participants</h4>
                <p className="text-3xl font-bold text-yellow-600">{adminData?.totalParticipants || 0}</p>
              </div>

              <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Rollover Amount</h4>
                <p className="text-3xl font-bold text-green-600">
                  ${parseFloat(adminData?.rolloverAmount || '0').toFixed(2)}
                </p>
              </div>

              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Total Prize Pool</h4>
                <p className="text-3xl font-bold text-purple-600">
                  ${parseFloat(adminData?.totalPrizePool || '0').toFixed(2)}
                </p>
              </div>

              <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-2">Week End Time</h4>
                <p className="text-lg font-semibold text-red-600">
                  {adminData?.weekStartTime ? new Date(adminData.weekStartTime * 1000).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          )}



          {/* Actions Tab */}
          {activeTab === 'actions' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Prize Distribution</h4>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Winner address (0x...)"
                    value={winnerAddress}
                    onChange={(e) => setWinnerAddress(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  <div className="flex space-x-3">
                    <button
                      onClick={setWinner}
                      disabled={isPending || !winnerAddress}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? 'Setting...' : 'Set Winner'}
                    </button>
                    <button
                      onClick={distributePrize}
                      disabled={isPending}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isPending ? 'Distributing...' : 'Distribute Prize'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-6">
                <h4 className="font-semibold text-gray-900 mb-4">Week Management</h4>
                <button
                  onClick={startNewWeek}
                  disabled={isPending}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Starting...' : 'Start New Week'}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Transaction Status */}
      {(isPending || isConfirming) && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <p className="text-blue-800">
              {isPending ? 'Transaction pending...' : 'Confirming transaction...'}
            </p>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <p className="text-green-800">Transaction successful!</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-3">
            <div className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✗</span>
            </div>
            <p className="text-red-800">Transaction failed: {error.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
