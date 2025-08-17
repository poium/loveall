'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const CONTRACT_ABI = [
  {
    name: 'getUserData',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{
      components: [
        { name: 'balance', type: 'uint256' },
        { name: 'hasSufficientBalance', type: 'bool' },
        { name: 'hasParticipatedThisWeek', type: 'bool' },
        { name: 'conversationCount', type: 'uint256' },
        { name: 'remainingConversations', type: 'uint256' },
        { name: 'participations', type: 'tuple[]', components: [
          { name: 'user', type: 'address' },
          { name: 'fid', type: 'uint256' },
          { name: 'castHash', type: 'bytes32' },
          { name: 'conversationId', type: 'bytes32' },
          { name: 'aiScore', type: 'uint256' },
          { name: 'isEvaluated', type: 'bool' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'weekNumber', type: 'uint256' },
          { name: 'usdcAmount', type: 'uint256' }
        ]}
      ],
      name: '',
      type: 'tuple'
    }]
  },
  { name: 'topUp', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'withdrawBalance', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [] },
  { name: 'getCommonData', type: 'function', stateMutability: 'view', inputs: [], outputs: [{
    components: [
      { name: 'currentWeek', type: 'uint256' },
      { name: 'currentPrizePool', type: 'uint256' },
      { name: 'currentWeekParticipantsCount', type: 'uint256' },
      { name: 'castCost', type: 'uint256' },
      { name: 'rolloverAmount', type: 'uint256' },
      { name: 'totalProtocolFees', type: 'uint256' },
      { name: 'characterName', type: 'string' },
      { name: 'characterTask', type: 'string' },
      { name: 'characterIsSet', type: 'bool' }
    ],
    name: '',
    type: 'tuple'
  }]},
  { name: 'getCurrentCharacter', type: 'function', stateMutability: 'view', inputs: [], outputs: [{
    components: [
      { name: 'name', type: 'string' },
      { name: 'task', type: 'string' },
      { name: 'traitNames', type: 'string[5]' },
      { name: 'traitValues', type: 'uint8[5]' },
      { name: 'traitCount', type: 'uint8' },
      { name: 'weekNumber', type: 'uint256' },
      { name: 'isSet', type: 'bool' }
    ],
    name: '',
    type: 'tuple'
  }]}
] as const;

const USDC_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] }
] as const;

export default function TestDashboard() {
  const { address, isConnected } = useAccount();
  const [topUpAmount, setTopUpAmount] = useState('');
  const [approveAmount, setApproveAmount] = useState('');

  // Read contract data
  const { data: userData, refetch: refetchUserData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getUserData',
    args: address ? [address] : undefined,
  });

  const { data: commonData, refetch: refetchCommonData } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getCommonData',
  });

  const { data: character } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: 'getCurrentCharacter',
  });

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { data: usdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, CONTRACT_ADDRESS] : undefined,
  });

  // Write contracts
  const { writeContract: approveUSDC, data: approveHash } = useWriteContract();
  const { writeContract: topUpContract, data: topUpHash } = useWriteContract();

  const { isLoading: isApproving } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const { isLoading: isToppingUp } = useWaitForTransactionReceipt({
    hash: topUpHash,
  });

  const handleApprove = async () => {
    if (!approveAmount || !address) return;
    
    try {
      const amount = parseUnits(approveAmount, 6); // USDC has 6 decimals
      approveUSDC({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, amount],
      });
    } catch (error) {
      console.error('Approval failed:', error);
    }
  };

  const handleTopUp = async () => {
    if (!topUpAmount || !address) return;
    
    try {
      const amount = parseUnits(topUpAmount, 6); // USDC has 6 decimals
      topUpContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'topUp',
        args: [amount],
      });
    } catch (error) {
      console.error('Top up failed:', error);
    }
  };

  const handleRefresh = () => {
    refetchUserData();
    refetchCommonData();
  };

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h2 className="text-xl font-bold text-yellow-800 mb-2">Connect Wallet</h2>
          <p className="text-yellow-700">Please connect your wallet to test the LoveAll Prize Pool.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">🚀 LoveAll Test Dashboard</h1>
        <p className="text-gray-600 mb-4">Test your bot integration with the deployed contract</p>
        <div className="flex gap-4">
          <div className="bg-white rounded-lg px-4 py-2 border">
            <span className="text-sm text-gray-500">Contract:</span>
            <p className="font-mono text-sm">{CONTRACT_ADDRESS}</p>
          </div>
          <div className="bg-white rounded-lg px-4 py-2 border">
            <span className="text-sm text-gray-500">Network:</span>
            <p className="font-semibold text-blue-600">Base Mainnet</p>
          </div>
        </div>
      </div>

      {/* Current Week Character */}
      {character && character.isSet && (
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🎭 Current AI Character</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-bold text-lg text-purple-600">{character.name}</h3>
              <p className="text-gray-600 mb-3">{character.task}</p>
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-700">Personality Traits:</h4>
                {character.traitNames.slice(0, character.traitCount).map((trait, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                    <span className="font-medium">{trait}</span>
                    <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-bold">
                      {character.traitValues[idx]}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-semibold text-purple-800 mb-2">Week Details</h4>
              <p className="text-sm text-purple-600">Week Number: {character.weekNumber.toString()}</p>
              <p className="text-sm text-purple-600">Status: Active ✅</p>
            </div>
          </div>
        </div>
      )}

      {/* Prize Pool Info */}
      {commonData && (
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">💰 Prize Pool Status</h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h3 className="font-semibold text-green-800">Current Prize</h3>
              <p className="text-2xl font-bold text-green-600">
                ${formatUnits(commonData.currentPrizePool, 6)} USDC
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800">Week Number</h3>
              <p className="text-2xl font-bold text-blue-600">{commonData.currentWeek.toString()}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h3 className="font-semibold text-purple-800">Participants</h3>
              <p className="text-2xl font-bold text-purple-600">{commonData.currentWeekParticipantsCount.toString()}</p>
            </div>
            <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
              <h3 className="font-semibold text-pink-800">Cast Cost</h3>
              <p className="text-2xl font-bold text-pink-600">
                ${formatUnits(commonData.castCost, 6)} USDC
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Balance & Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* USDC Balance & Approval */}
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">💳 USDC Management</h2>
          
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2">Your USDC Balance</h3>
              <p className="text-2xl font-bold text-blue-600">
                {usdcBalance ? formatUnits(usdcBalance, 6) : '0'} USDC
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-700 mb-2">Contract Allowance</h3>
              <p className="text-2xl font-bold text-green-600">
                {usdcAllowance ? formatUnits(usdcAllowance, 6) : '0'} USDC
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Approve USDC Amount
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    placeholder="Enter USDC amount"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || !approveAmount}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isApproving ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contract Balance & Top Up */}
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">⚡ Contract Balance</h2>
          
          {userData && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-700 mb-2">Your Contract Balance</h3>
                <p className="text-2xl font-bold text-purple-600">
                  {formatUnits(userData.balance, 6)} USDC
                </p>
                <div className="mt-2 space-y-1">
                  <p className={`text-sm ${userData.hasSufficientBalance ? 'text-green-600' : 'text-red-600'}`}>
                    Sufficient Balance: {userData.hasSufficientBalance ? '✅' : '❌'}
                  </p>
                  <p className="text-sm text-gray-600">
                    Conversations: {userData.conversationCount.toString()}/{userData.conversationCount.toString() + userData.remainingConversations.toString()}
                  </p>
                  <p className="text-sm text-gray-600">
                    Remaining: {userData.remainingConversations.toString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Top Up Amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="Enter USDC amount"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleTopUp}
                      disabled={isToppingUp || !topUpAmount}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isToppingUp ? 'Topping Up...' : 'Top Up'}
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setTopUpAmount('0.1')}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    0.1 USDC
                  </button>
                  <button
                    onClick={() => setTopUpAmount('1')}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    1 USDC
                  </button>
                  <button
                    onClick={() => setTopUpAmount('10')}
                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                  >
                    10 USDC
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Participations */}
      {userData && userData.participations.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">📝 Your Participations</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Cast Hash</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Week</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">AI Score</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Evaluated</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {userData.participations.map((participation, idx) => (
                  <tr key={idx} className="border-t">
                    <td className="px-4 py-2 font-mono text-sm">{participation.castHash.slice(0, 10)}...</td>
                    <td className="px-4 py-2">{participation.weekNumber.toString()}</td>
                    <td className="px-4 py-2">
                      {participation.isEvaluated ? participation.aiScore.toString() : 'Pending'}
                    </td>
                    <td className="px-4 py-2">
                      {participation.isEvaluated ? '✅' : '⏳'}
                    </td>
                    <td className="px-4 py-2">{formatUnits(BigInt(participation.usdcAmount), 6)} USDC</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Testing Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-blue-800 mb-3">🧪 Testing Instructions</h2>
        <div className="space-y-3 text-blue-700">
          <p><strong>Step 1:</strong> Make sure you have USDC on Base mainnet</p>
          <p><strong>Step 2:</strong> Approve USDC allowance for the contract (at least 0.01 USDC)</p>
          <p><strong>Step 3:</strong> Top up your contract balance</p>
          <p><strong>Step 4:</strong> Mention the bot in a Farcaster cast</p>
          <p><strong>Step 5:</strong> Check this dashboard to see participation recorded</p>
        </div>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
}
