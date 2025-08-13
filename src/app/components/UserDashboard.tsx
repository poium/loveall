'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits } from 'viem';

interface UserData {
  balance: string;
  allowance: string;
  participationCount: number;
  lastParticipation: number;
  canParticipate: boolean;
}

// Contract addresses
const CONTRACT_ADDRESS = '0xE05efF71D71850c0FEc89660DC6588787312e453';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// USDC ABI for approve function
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
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

// Contract ABI for user functions
const CONTRACT_ABI = [
  {
    name: 'getBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
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
  },
  {
    name: 'getUserData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        components: [
          { name: 'balance', type: 'uint256' },
          { name: 'hasSufficientBalance', type: 'bool' },
          { name: 'hasParticipatedThisWeek', type: 'bool' },
          { name: 'participationsCount', type: 'uint256' },
          {
            components: [
              { name: 'user', type: 'address' },
              { name: 'castHash', type: 'bytes32' },
              { name: 'timestamp', type: 'uint256' },
              { name: 'weekNumber', type: 'uint256' },
              { name: 'usdcAmount', type: 'uint256' },
              { name: 'isEvaluated', type: 'bool' }
            ],
            name: 'participations',
            type: 'tuple[]'
          }
        ],
        name: '',
        type: 'tuple'
      }
    ]
  },
  {
    name: 'hasSufficientBalance',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'hasParticipatedThisWeek',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: '', type: 'uint256' },
      { name: '', type: 'address' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

export default function UserDashboard() {
  const { address, isConnected, chainId } = useAccount();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFundSection, setShowFundSection] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [topUpAmount, setTopUpAmount] = useState('');

  // Contract write hooks
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConnected && address) {
      console.log('Wallet connected:', { address, chainId });
      fetchUserData();
    }
  }, [isConnected, address, isSuccess]);

  useEffect(() => {
    if (error) {
      console.error('Write contract error:', error);
    }
  }, [error]);

  const fetchUserData = async () => {
    if (!address) return;
    
    try {
      setLoading(true);
      const response = await fetch(`/api/check-balance?address=${address}`);
      if (response.ok) {
        const data = await response.json();
        setUserData({
          balance: data.usdcBalance,
          allowance: data.contractAllowance,
          participationCount: 0, // TODO: Add participation tracking
          lastParticipation: 0, // TODO: Add participation tracking
          canParticipate: data.canParticipate
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveContract = () => {
    if (!address) {
      console.log('No address found');
      return;
    }
    
    // Check if we're on Base network (chainId 8453)
    if (chainId !== 8453) {
      console.error('Wrong network! Please switch to Base network. Current chainId:', chainId);
      alert('Please switch to Base network to approve the contract.');
      return;
    }
    
    console.log('Approving contract...', {
      address,
      chainId,
      contractAddress: CONTRACT_ADDRESS,
      usdcAddress: USDC_ADDRESS
    });
    
    // Check if writeContract is available
    if (!writeContract) {
      console.error('writeContract is not available');
      return;
    }
    
    // Approve 100 USDC (enough for many casts)
    const amount = parseUnits('100', 6); // USDC has 6 decimals
    
    try {
      const result = writeContract({
        address: USDC_ADDRESS as `0x${string}`,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS as `0x${string}`, amount],
      });
      console.log('Write contract called successfully', result);
    } catch (error) {
      console.error('Error calling writeContract:', error);
    }
  };

  const topUpBalance = () => {
    if (!address || !topUpAmount) {
      alert('Please enter an amount to top up');
      return;
    }
    
    if (chainId !== 8453) {
      alert('Please switch to Base network to top up your balance.');
      return;
    }
    
    try {
      const amount = parseUnits(topUpAmount, 6);
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'topUp',
        args: [amount],
      });
      setTopUpAmount('');
    } catch (error) {
      console.error('Error topping up balance:', error);
    }
  };

  const withdrawBalance = () => {
    if (!address || !withdrawAmount) {
      alert('Please enter an amount to withdraw');
      return;
    }
    
    if (chainId !== 8453) {
      alert('Please switch to Base network to withdraw your balance.');
      return;
    }
    
    try {
      const amount = parseUnits(withdrawAmount, 6);
      writeContract({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'withdrawBalance',
        args: [amount],
      });
      setWithdrawAmount('');
    } catch (error) {
      console.error('Error withdrawing balance:', error);
    }
  };

  if (!isConnected) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-gray-900">Your Dashboard</h3>
        <div className="text-sm text-gray-500">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading your data...</p>
        </div>
      ) : userData ? (
        <>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Balance Section */}
            <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-6">
              <h4 className="font-semibold text-gray-900 mb-4">USDC Balance</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Available:</span>
                  <span className="font-semibold">{parseFloat(userData.balance).toFixed(2)} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contract Allowance:</span>
                  <span className="font-semibold">{parseFloat(userData.allowance).toFixed(2)} USDC</span>
                </div>
              </div>
            </div>

            {/* Participation Section */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Participation</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">This Week:</span>
                  <span className="font-semibold">{userData.participationCount} casts</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-semibold ${userData.canParticipate ? 'text-green-600' : 'text-red-600'}`}>
                    {userData.canParticipate ? 'Ready to Participate' : 'Insufficient Balance'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Fund Wallet Section */}
          {!userData.canParticipate && (
            <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-6 border border-yellow-200">
              <h4 className="font-semibold text-gray-900 mb-4">💰 Setup Required</h4>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <p className="text-gray-600 text-sm mb-3">
                    You need USDC in your wallet and contract approval to participate.
                  </p>
                  <button
                    onClick={approveContract}
                    disabled={isPending || isConfirming}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium py-3 px-4 rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isPending ? 'Approving...' : isConfirming ? 'Confirming...' : 'Approve Contract'}
                  </button>
                  {isSuccess && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm">✅ Approval successful!</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Balance Management Section */}
          <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-200">
            <h4 className="font-semibold text-gray-900 mb-4">💳 Balance Management</h4>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Up Section */}
              <div className="bg-white rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-3">Top Up Contract Balance</h5>
                <p className="text-gray-600 text-sm mb-3">
                  Add USDC to your contract balance to participate in casts:
                </p>
                <div className="space-y-3">
                  <input
                    type="number"
                    placeholder="Amount (USDC)"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    step="0.01"
                    min="0.01"
                  />
                  <button
                    onClick={topUpBalance}
                    disabled={isPending || isConfirming || !topUpAmount}
                    className="w-full bg-green-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isPending ? 'Topping Up...' : isConfirming ? 'Confirming...' : 'Top Up Balance'}
                  </button>
                </div>
              </div>

              {/* Withdraw Section */}
              <div className="bg-white rounded-lg p-4">
                <h5 className="font-medium text-gray-900 mb-3">Withdraw Balance</h5>
                <p className="text-gray-600 text-sm mb-3">
                  Withdraw unused USDC from your contract balance:
                </p>
                <div className="space-y-3">
                  <input
                    type="number"
                    placeholder="Amount (USDC)"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    step="0.01"
                    min="0.01"
                  />
                  <button
                    onClick={withdrawBalance}
                    disabled={isPending || isConfirming || !withdrawAmount}
                    className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isPending ? 'Withdrawing...' : isConfirming ? 'Confirming...' : 'Withdraw Balance'}
                  </button>
                </div>
              </div>
            </div>
          </div>


        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-600">Unable to load user data</p>
        </div>
      )}
    </div>
  );
}
