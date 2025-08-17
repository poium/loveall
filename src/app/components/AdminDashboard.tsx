'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';

// Contract addresses and ABIs
const CONTRACT_ADDRESS = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';

const CONTRACT_ABI = [
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
  }
];

interface AdminData {
  address: string;
  isOwner: boolean;
  currentWeek: number;
  currentPrizePool: string;
  totalParticipants: number;
  weekStartTime: number;
  rolloverAmount: string;
  totalPrizePool: string;
}

interface EvaluationResult {
  userAddress: string;
  castHash: string;
  timestamp: number;
  evaluation: {
    score: number;
    evaluation: string;
    scores?: {
      contentQuality: number;
      creativity: number;
      relevance: number;
      engagementPotential: number;
      overallImpact: number;
    };
    recommendation?: string;
    error?: string;
  };
}

export default function AdminDashboard() {
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
  const [evaluating, setEvaluating] = useState(false);
  const [selectedWinner, setSelectedWinner] = useState<string>('');
  const [winnerLoading, setWinnerLoading] = useState(false);
  const [distributeLoading, setDistributeLoading] = useState(false);
  const [newWeekLoading, setNewWeekLoading] = useState(false);
  
  const { isConnected, address } = useAccount();

  // Wagmi hooks for contract interactions
  const { writeContract: writeContractWinner, isPending: isWinnerPending, data: winnerHash } = useWriteContract();
  const { writeContract: writeContractDistribute, isPending: isDistributePending, data: distributeHash } = useWriteContract();
  const { writeContract: writeContractNewWeek, isPending: isNewWeekPending, data: newWeekHash } = useWriteContract();

  // Wait for transaction receipts
  const { isLoading: isWinnerConfirming, isSuccess: isWinnerSuccess } = useWaitForTransactionReceipt({
    hash: winnerHash,
  });

  const { isLoading: isDistributeConfirming, isSuccess: isDistributeSuccess } = useWaitForTransactionReceipt({
    hash: distributeHash,
  });

  const { isLoading: isNewWeekConfirming, isSuccess: isNewWeekSuccess } = useWaitForTransactionReceipt({
    hash: newWeekHash,
  });

  useEffect(() => {
    if (isConnected && address) {
      fetchAdminData();
    }
  }, [isConnected, address]);

  // Handle transaction success
  useEffect(() => {
    if (isWinnerSuccess) {
      setWinnerLoading(false);
      setSelectedWinner('');
      fetchAdminData();
    }
  }, [isWinnerSuccess]);

  useEffect(() => {
    if (isDistributeSuccess) {
      setDistributeLoading(false);
      fetchAdminData();
    }
  }, [isDistributeSuccess]);

  useEffect(() => {
    if (isNewWeekSuccess) {
      setNewWeekLoading(false);
      fetchAdminData();
    }
  }, [isNewWeekSuccess]);

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

  const evaluateCastsWithAI = async () => {
    if (!adminData) return;
    
    try {
      setEvaluating(true);
      const response = await fetch('/api/evaluate-casts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          week: adminData.currentWeek
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEvaluations(data.evaluations);
        console.log('AI evaluations:', data);
      } else {
        console.error('Failed to evaluate casts');
      }
    } catch (error) {
      console.error('Error evaluating casts:', error);
    } finally {
      setEvaluating(false);
    }
  };

  const setWeeklyWinner = async (winnerAddress: string) => {
    if (!winnerAddress) return;
    
    try {
      setWinnerLoading(true);
      
      writeContractWinner({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'setWeeklyWinner',
        args: [winnerAddress as `0x${string}`]
      });
      
    } catch (error) {
      console.error('Error setting winner:', error);
      setWinnerLoading(false);
    }
  };

  const distributePrize = async () => {
    try {
      setDistributeLoading(true);
      
      writeContractDistribute({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'distributePrize',
        args: []
      });
      
    } catch (error) {
      console.error('Error distributing prize:', error);
      setDistributeLoading(false);
    }
  };

  const startNewWeek = async () => {
    try {
      setNewWeekLoading(true);
      
      writeContractNewWeek({
        address: CONTRACT_ADDRESS as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'startNewWeek',
        args: []
      });
      
    } catch (error) {
      console.error('Error starting new week:', error);
      setNewWeekLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-xl font-bold text-white mb-4">Admin Dashboard</h3>
        <p className="text-gray-300">Please connect your wallet to access admin functions.</p>
      </div>
    );
  }

  if (!adminData?.isOwner) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-xl font-bold text-white mb-4">Admin Dashboard</h3>
        <p className="text-gray-300">Only the contract owner can access admin functions.</p>
        {adminData && (
          <div className="mt-4 p-4 bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-400">Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
            <p className="text-sm text-gray-400">Is Owner: {adminData.isOwner ? 'Yes' : 'No'}</p>
            <p className="text-sm text-gray-400">Current Prize Pool: {adminData.currentPrizePool} USDC</p>
            <p className="text-sm text-gray-400">Total Participants: {adminData.totalParticipants}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-white">Admin Dashboard</h3>
        <button
          onClick={fetchAdminData}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
          <p className="mt-2 text-gray-300">Loading admin data...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/20">
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {adminData?.currentPrizePool} USDC
              </div>
              <p className="text-gray-300 text-sm">Current Prize Pool</p>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/20">
              <div className="text-2xl font-bold text-blue-400 mb-1">
                {adminData?.totalParticipants}
              </div>
              <p className="text-gray-300 text-sm">Total Participants</p>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/20">
              <div className="text-2xl font-bold text-green-400 mb-1">
                Week {adminData?.currentWeek}
              </div>
              <p className="text-gray-300 text-sm">Current Week</p>
            </div>
            <div className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/20">
              <div className="text-2xl font-bold text-yellow-400 mb-1">
                {adminData?.rolloverAmount} USDC
              </div>
              <p className="text-gray-300 text-sm">Rollover Amount</p>
            </div>
          </div>

          {/* AI Evaluation Section */}
          <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600/20">
            <h4 className="text-lg font-semibold text-white mb-4">🤖 AI-Powered Winner Selection</h4>
            
            <div className="space-y-4">
              <button
                onClick={evaluateCastsWithAI}
                disabled={evaluating || adminData?.totalParticipants === 0}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  evaluating || adminData?.totalParticipants === 0
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                }`}
              >
                {evaluating ? 'Evaluating Casts...' : 'Evaluate Casts with AI'}
              </button>

              {evaluations.length > 0 && (
                <div className="space-y-4">
                  <h5 className="text-white font-semibold">AI Evaluation Results:</h5>
                  
                  {evaluations.map((evaluation, index) => (
                    <div key={index} className="bg-gray-800/50 rounded-lg p-4 border border-gray-600/20">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-white font-medium">
                            {index + 1}. {eval.userAddress.slice(0, 6)}...{eval.userAddress.slice(-4)}
                          </p>
                          <p className="text-gray-400 text-sm">
                            Score: {eval.evaluation.score}/50
                          </p>
                        </div>
                                                 <button
                           onClick={() => setSelectedWinner(evaluation.userAddress)}
                           disabled={winnerLoading || isWinnerPending || isWinnerConfirming || evaluation.userAddress === '0x0000000000000000000000000000000000000000'}
                           className={`px-3 py-1 rounded text-sm transition-colors ${
                             winnerLoading || isWinnerPending || isWinnerConfirming || evaluation.userAddress === '0x0000000000000000000000000000000000000000'
                               ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                               : 'bg-green-600 hover:bg-green-700 text-white'
                           }`}
                         >
                           {winnerLoading && selectedWinner === evaluation.userAddress ? 'Setting...' : 
                            evaluation.userAddress === '0x0000000000000000000000000000000000000000' ? 'Demo Mode' : 'Select Winner'}
                         </button>
                      </div>
                      
                                             <p className="text-gray-300 text-sm mb-2">
                         {evaluation.evaluation.evaluation}
                       </p>
                      
                                             {evaluation.evaluation.scores && (
                         <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                           <div className="text-gray-400">Quality: {evaluation.evaluation.scores.contentQuality}/10</div>
                           <div className="text-gray-400">Creativity: {evaluation.evaluation.scores.creativity}/10</div>
                           <div className="text-gray-400">Relevance: {evaluation.evaluation.scores.relevance}/10</div>
                           <div className="text-gray-400">Engagement: {evaluation.evaluation.scores.engagementPotential}/10</div>
                           <div className="text-gray-400">Impact: {evaluation.evaluation.scores.overallImpact}/10</div>
                         </div>
                       )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Admin Actions */}
          <div className="bg-gray-700/50 rounded-xl p-6 border border-gray-600/20">
            <h4 className="text-lg font-semibold text-white mb-4">⚡ Admin Actions</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={distributePrize}
                disabled={distributeLoading || isDistributePending || isDistributeConfirming}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  distributeLoading || isDistributePending || isDistributeConfirming
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
                }`}
              >
                {distributeLoading || isDistributePending || isDistributeConfirming 
                  ? 'Distributing...' 
                  : 'Distribute Prize'
                }
              </button>

              <button
                onClick={startNewWeek}
                disabled={newWeekLoading || isNewWeekPending || isNewWeekConfirming}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  newWeekLoading || isNewWeekPending || isNewWeekConfirming
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105'
                }`}
              >
                {newWeekLoading || isNewWeekPending || isNewWeekConfirming 
                  ? 'Starting...' 
                  : 'Start New Week'
                }
              </button>

              <button
                onClick={fetchAdminData}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-all duration-200 hover:scale-105"
              >
                Refresh Data
              </button>
            </div>
          </div>

          {/* Transaction Status */}
          {(isWinnerPending || isDistributePending || isNewWeekPending || isWinnerConfirming || isDistributeConfirming || isNewWeekConfirming) && (
            <div className="p-4 bg-blue-900/50 border border-blue-500/20 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                <span className="text-blue-300 font-medium">
                  {isWinnerPending && 'Confirming winner selection...'}
                  {isDistributePending && 'Confirming prize distribution...'}
                  {isNewWeekPending && 'Confirming new week start...'}
                  {isWinnerConfirming && 'Processing winner selection...'}
                  {isDistributeConfirming && 'Processing prize distribution...'}
                  {isNewWeekConfirming && 'Processing new week start...'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
