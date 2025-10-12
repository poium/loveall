'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
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
      <div className="container py-8">
        <div className="card p-6 border-destructive bg-destructive/5">
          <h2 className="text-xl font-bold text-destructive mb-2">Connect Wallet</h2>
          <p className="text-muted-foreground">Please connect your wallet to test the LoveAll Prize Pool.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6">
      <div className="card p-6 space-y-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-card-foreground">🚀 LoveAll Test Dashboard</h1>
          <p className="text-muted-foreground">Test your bot integration with the deployed contract</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="bg-muted rounded-lg px-4 py-2 space-y-1">
            <span className="text-sm text-muted-foreground">Contract:</span>
            <p className="font-mono text-sm text-card-foreground">{CONTRACT_ADDRESS}</p>
          </div>
          <div className="bg-muted rounded-lg px-4 py-2 space-y-1">
            <span className="text-sm text-muted-foreground">Network:</span>
            <p className="font-semibold text-primary">Base Mainnet</p>
          </div>
        </div>
      </div>

      {/* Current Week Character */}
      {character && character.isSet && (
        <div className="card p-6 space-y-4">
          <h2 className="text-2xl font-bold text-card-foreground">🎭 Current AI Character</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg text-primary mb-2">{character.name}</h3>
                <p className="text-muted-foreground">{character.task}</p>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-card-foreground">Personality Traits:</h4>
                {character.traitNames.slice(0, character.traitCount).map((trait, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-secondary p-3 rounded-lg">
                    <span className="font-medium text-secondary-foreground">{trait}</span>
                    <span className="bg-primary text-primary-foreground px-2 py-1 rounded font-bold text-sm">
                      {character.traitValues[idx]}/10
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-semibold text-card-foreground">Week Details</h4>
              <p className="text-sm text-muted-foreground">Week Number: {character.weekNumber.toString()}</p>
              <p className="text-sm text-muted-foreground">Status: Active ✅</p>
            </div>
          </div>
        </div>
      )}

      {/* Prize Pool Info */}
      {commonData && (
        <div className="card p-6 space-y-4">
          <h2 className="text-2xl font-bold text-card-foreground">💰 Prize Pool Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-card-foreground">Current Prize</h3>
              <p className="text-2xl font-bold text-primary">
                ${formatUnits(commonData.currentPrizePool, 6)} USDC
              </p>
            </div>
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-card-foreground">Week Number</h3>
              <p className="text-2xl font-bold text-primary">{commonData.currentWeek.toString()}</p>
            </div>
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-card-foreground">Participants</h3>
              <p className="text-2xl font-bold text-primary">{commonData.currentWeekParticipantsCount.toString()}</p>
            </div>
            <div className="card p-4 space-y-2">
              <h3 className="font-semibold text-card-foreground">Cast Cost</h3>
              <p className="text-2xl font-bold text-primary">
                ${formatUnits(commonData.castCost, 6)} USDC
              </p>
            </div>
          </div>
        </div>
      )}

      {/* User Balance & Actions */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* USDC Balance & Approval */}
        <div className="card p-6 space-y-4">
          <h2 className="text-xl font-bold text-card-foreground">💳 USDC Management</h2>
          
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-card-foreground">Your USDC Balance</h3>
              <p className="text-2xl font-bold text-primary">
                {usdcBalance ? formatUnits(usdcBalance, 6) : '0'} USDC
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-card-foreground">Contract Allowance</h3>
              <p className="text-2xl font-bold text-primary">
                {usdcAllowance ? formatUnits(usdcAllowance, 6) : '0'} USDC
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-card-foreground mb-2">
                  Approve USDC Amount
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                    placeholder="Enter USDC amount"
                    className="input flex-1"
                  />
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || !approveAmount}
                    className={isApproving || !approveAmount ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}
                  >
                    {isApproving ? 'Approving...' : 'Approve'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contract Balance & Top Up */}
        <div className="card p-6 space-y-4">
          <h2 className="text-xl font-bold text-card-foreground">⚡ Contract Balance</h2>
          
          {userData && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-card-foreground">Your Contract Balance</h3>
                <p className="text-2xl font-bold text-primary">
                  {formatUnits(userData.balance, 6)} USDC
                </p>
                <div className="space-y-1">
                  <p className={`text-sm ${userData.hasSufficientBalance ? 'text-primary' : 'text-destructive'}`}>
                    Sufficient Balance: {userData.hasSufficientBalance ? '✅' : '❌'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Conversations: {userData.conversationCount.toString()}/{userData.conversationCount.toString() + userData.remainingConversations.toString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Remaining: {userData.remainingConversations.toString()}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-card-foreground mb-2">
                    Top Up Amount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="Enter USDC amount"
                      className="input flex-1"
                    />
                    <button
                      onClick={handleTopUp}
                      disabled={isToppingUp || !topUpAmount}
                      className={isToppingUp || !topUpAmount ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}
                    >
                      {isToppingUp ? 'Topping Up...' : 'Top Up'}
                    </button>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setTopUpAmount('0.1')}
                    className="btn-ghost text-xs px-3 py-1"
                  >
                    0.1 USDC
                  </button>
                  <button
                    onClick={() => setTopUpAmount('1')}
                    className="btn-ghost text-xs px-3 py-1"
                  >
                    1 USDC
                  </button>
                  <button
                    onClick={() => setTopUpAmount('10')}
                    className="btn-ghost text-xs px-3 py-1"
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
        <div className="card p-6 space-y-4">
          <h2 className="text-2xl font-bold text-card-foreground">📝 Your Participations</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="px-4 py-2 text-left font-semibold text-card-foreground border-b">Cast Hash</th>
                  <th className="px-4 py-2 text-left font-semibold text-card-foreground border-b">Week</th>
                  <th className="px-4 py-2 text-left font-semibold text-card-foreground border-b">AI Score</th>
                  <th className="px-4 py-2 text-left font-semibold text-card-foreground border-b">Evaluated</th>
                  <th className="px-4 py-2 text-left font-semibold text-card-foreground border-b">Amount</th>
                </tr>
              </thead>
              <tbody>
                {userData.participations.map((participation, idx) => (
                  <tr key={idx} className="border-b border-border">
                    <td className="px-4 py-2 font-mono text-sm text-muted-foreground">{participation.castHash.slice(0, 10)}...</td>
                    <td className="px-4 py-2 text-card-foreground">{participation.weekNumber.toString()}</td>
                    <td className="px-4 py-2 text-card-foreground">
                      {participation.isEvaluated ? participation.aiScore.toString() : 'Pending'}
                    </td>
                    <td className="px-4 py-2">
                      {participation.isEvaluated ? '✅' : '⏳'}
                    </td>
                    <td className="px-4 py-2 text-card-foreground">{formatUnits(BigInt(participation.usdcAmount), 6)} USDC</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Testing Instructions */}
      <div className="card p-6 space-y-4 bg-accent/50">
        <h2 className="text-xl font-bold text-card-foreground">🧪 Testing Instructions</h2>
        <div className="space-y-3 text-muted-foreground">
          <p><span className="font-semibold text-card-foreground">Step 1:</span> Make sure you have USDC on Base mainnet</p>
          <p><span className="font-semibold text-card-foreground">Step 2:</span> Approve USDC allowance for the contract (at least 0.01 USDC)</p>
          <p><span className="font-semibold text-card-foreground">Step 3:</span> Top up your contract balance</p>
          <p><span className="font-semibold text-card-foreground">Step 4:</span> Mention the bot in a Farcaster cast</p>
          <p><span className="font-semibold text-card-foreground">Step 5:</span> Check this dashboard to see participation recorded</p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-primary"
        >
          🔄 Refresh Data
        </button>
      </div>
    </div>
  );
}
