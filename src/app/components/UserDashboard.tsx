'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

interface UserData {
  balance: string;
  hasSufficientBalance: boolean;
  hasParticipatedThisWeek: boolean;
  conversationCount: number;
  remainingConversations: number;
  participations: Array<{
    user: string;
    fid: string;
    castHash: string;
    conversationId: string;
    aiScore: number;
    isEvaluated: boolean;
    timestamp: number;
    weekNumber: number;
    usdcAmount: string;
  }>;
}

interface CommonData {
  currentWeek: number;
  currentPrizePool: string;
  currentWeekParticipantsCount: number;
  castCost: string;
  rolloverAmount: string;
  totalProtocolFees: string;
  characterName: string;
  characterTask: string;
  characterIsSet: boolean;
}

interface AICharacter {
  name: string;
  task: string;
  traitNames: string[];
  traitValues: number[];
  traitCount: number;
  weekNumber: number;
  isSet: boolean;
}

const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const CONTRACT_ABI = [
  // User functions
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
        console.log('API Response:', data);
        
        const participations = data.participations || [];
        const totalSpent = participations.reduce((total: number, participation: any) => {
          return total + parseFloat(participation.usdcAmount || '0');
        }, 0);

        setUserData({
          balance: data.contractBalance || '0',
          allowance: '0',
          participationCount: data.participationsCount || 0,
          lastParticipation: 0,
          canParticipate: data.canParticipate || false,
          totalSpent: totalSpent.toFixed(2),
          hasSufficientBalance: data.hasSufficientBalance || false,
          hasParticipatedThisWeek: data.hasParticipatedThisWeek || false,
          participations: participations
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const approveContract = () => {
    if (!address || chainId !== 8453) {
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
    
    if (!writeContract) {
      console.error('writeContract is not available');
      return;
    }
    
    const amount = parseUnits('100', 6);
    
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
    <div className="card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-card-foreground">Your Dashboard</h3>
        <div className="text-sm text-muted-foreground">
          {address?.slice(0, 6)}...{address?.slice(-4)}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your data...</p>
        </div>
      ) : userData ? (
        <div className="space-y-6">
          {/* Balance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card p-4 space-y-2">
              <div className="text-2xl font-bold text-primary">
                {parseFloat(userData.balance || '0').toFixed(2)} USDC
              </div>
              <p className="text-muted-foreground text-sm">Contract Balance</p>
            </div>
            
            <div className="card p-4 space-y-2">
              <div className="text-2xl font-bold text-primary">
                {userData.participationCount}
              </div>
              <p className="text-muted-foreground text-sm">Total Casts</p>
            </div>
            
            <div className="card p-4 space-y-2">
              <div className="text-2xl font-bold text-primary">
                {parseFloat(userData.totalSpent || '0').toFixed(2)} USDC
              </div>
              <p className="text-muted-foreground text-sm">Total Spent</p>
            </div>
          </div>

          {/* Participation Status */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h4 className="font-semibold text-card-foreground">Participation Status</h4>
                <p className="text-sm text-muted-foreground">
                  {userData.canParticipate ? 'Ready to participate' : 'Cannot participate'}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${
                userData.canParticipate 
                  ? 'bg-primary/10 text-primary border-primary/20' 
                  : 'bg-destructive/10 text-destructive border-destructive/20'
              }`}>
                {userData.canParticipate ? 'Active' : 'Inactive'}
              </div>
            </div>
            {!userData.canParticipate && (
              <p className="text-xs text-muted-foreground">
                {!userData.hasSufficientBalance ? 'Insufficient balance' : 
                 userData.hasParticipatedThisWeek ? 'Already participated this week' : 
                 'Unknown issue'}
              </p>
            )}
          </div>

          {/* Balance Management */}
          <div className="card p-4 space-y-4">
            <h4 className="font-semibold text-card-foreground">Balance Management</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Up */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-card-foreground">Top Up Balance</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="0.01"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    onClick={topUpBalance}
                    disabled={isPending || !topUpAmount}
                    className={isPending || !topUpAmount ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}
                  >
                    Top Up
                  </button>
                </div>
              </div>

              {/* Withdraw */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-card-foreground">Withdraw Balance</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    placeholder="0.01"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="input flex-1"
                  />
                  <button
                    onClick={withdrawBalance}
                    disabled={isPending || !withdrawAmount}
                    className={isPending || !withdrawAmount ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary'}
                  >
                    Withdraw
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Participation History */}
          {userData.participations && userData.participations.length > 0 && (
            <div className="card p-4 space-y-4">
              <h4 className="font-semibold text-card-foreground">Recent Activity</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {userData.participations.slice(0, 5).map((participation, index) => (
                  <div key={index} className="flex justify-between items-center py-2 px-3 bg-muted rounded-lg">
                    <div className="space-y-1">
                      <p className="text-sm text-card-foreground">Cast #{participation.castHash.slice(0, 8)}...</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(participation.timestamp * 1000).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-sm text-primary font-medium">
                      -{participation.usdcAmount} USDC
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Failed to load user data</p>
        </div>
      )}

      {/* Transaction Status */}
      {(isPending || isConfirming) && (
        <div className="card p-3 bg-accent/50">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            <p className="text-card-foreground text-sm">
              {isPending ? 'Transaction pending...' : 'Confirming transaction...'}
            </p>
          </div>
        </div>
      )}

      {isSuccess && (
        <div className="card p-3 bg-primary/10 border-primary/20">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
              <span className="text-primary-foreground text-xs">✓</span>
            </div>
            <p className="text-primary text-sm">Transaction successful!</p>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-3 bg-destructive/10 border-destructive/20">
          <div className="flex items-center space-x-3">
            <div className="w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
              <span className="text-destructive-foreground text-xs">✗</span>
            </div>
            <p className="text-destructive text-sm">Transaction failed: {error.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
