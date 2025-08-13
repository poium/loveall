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
const USDC_ADDRESS = '0x833589fCD6Edb6E08f4c7C32D4f71b54bdA02913';

// USDC ABI for approve function
const USDC_ABI = [
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function allowance(address owner, address spender) external view returns (uint256)'
] as const;

export default function UserDashboard() {
  const { address, isConnected } = useAccount();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFundSection, setShowFundSection] = useState(false);

  // Contract write hooks
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConnected && address) {
      fetchUserData();
    }
  }, [isConnected, address, isSuccess]);

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
    
    console.log('Approving contract...', {
      address,
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
              <h4 className="font-semibold text-gray-900 mb-4">💰 Fund Your Wallet</h4>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-2">Step 1: Add USDC to your wallet</h5>
                  <p className="text-gray-600 text-sm mb-3">
                    You need at least 0.01 USDC to participate. You can get USDC from:
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-sm text-gray-700">Coinbase, Binance, or other exchanges</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-sm text-gray-700">Bridge from Ethereum using Base Bridge</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-sm text-gray-700">Buy directly on Base network</span>
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">
                      <strong>USDC Contract:</strong> {USDC_ADDRESS}
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>Network:</strong> Base Mainnet
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4">
                  <h5 className="font-medium text-gray-900 mb-2">Step 2: Approve Contract</h5>
                  <p className="text-gray-600 text-sm mb-3">
                    Allow the Loveall contract to spend your USDC (0.01 USDC per cast):
                  </p>
                  <button
                    onClick={approveContract}
                    disabled={isPending || isConfirming}
                    className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium py-3 px-4 rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isPending ? 'Approving...' : isConfirming ? 'Confirming...' : 'Approve 100 USDC'}
                  </button>
                  {isSuccess && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-green-800 text-sm font-medium">✅ Approval successful!</p>
                      <p className="text-green-700 text-xs">You can now participate in the Loveall prize pool.</p>
                    </div>
                  )}
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">
                      <strong>Contract Address:</strong> {CONTRACT_ADDRESS}
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>Cost per cast:</strong> 0.01 USDC
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4">
              {userData.canParticipate ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">
                    ✅ You're ready to participate! Mention @loveall on Farcaster to get started.
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-yellow-800 font-medium">
                    ⚠️ Follow the steps above to add USDC and approve the contract.
                  </p>
                </div>
              )}
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
