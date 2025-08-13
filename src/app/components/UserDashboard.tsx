'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

interface UserData {
  balance: string;
  allowance: string;
  participationCount: number;
  lastParticipation: number;
  canParticipate: boolean;
}

export default function UserDashboard() {
  const { address, isConnected } = useAccount();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserData();
    }
  }, [isConnected, address]);

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
                    ⚠️ You need at least 0.01 USDC and contract allowance to participate.
                  </p>
                  <div className="mt-3 space-y-2">
                    <p className="text-yellow-700 text-sm">
                      • Add USDC to your wallet on Base network
                    </p>
                    <p className="text-yellow-700 text-sm">
                      • Approve the contract to spend your USDC
                    </p>
                  </div>
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
