'use client';

import { useState, useEffect, useRef } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import AdminDashboard from './components/AdminDashboard';
import { FlickeringGrid } from './components/FlickeringGrid';
import CONTRACT_ABI_JSON from '../abi.json';

declare global {
  interface Window {
    basexpLoaded?: boolean;
  }
}

interface PrizePoolData {
  totalPrizePool: string;
  currentWeekPrizePool: string;
  rolloverAmount: string;
  totalContributions: string;
  totalProtocolFees: string;
  castCost: string;
  currentWeek: number;
  weekStartTime: number;
  weekEndTime: number;
  currentWeekParticipantsCount: number;
  currentWeekWinner: string;
  currentWeekPrize: string;
  characterName: string;
  characterTask: string;
  characterIsSet: boolean;
}

interface CastParticipation {
  user: string;
  fid: number;
  castHash: string;
  conversationId: string;
  timestamp: number;
  weekNumber: number;
  usdcAmount: string;
  aiScore: number;
  isEvaluated: boolean;
}

interface ConversationMessage {
  castHash: string;
  content: string;
  isBot: boolean;
  timestamp: number;
}

interface ConversationThread {
  conversationId: string;
  user: string;
  fid: number;
  messages: ConversationMessage[];
  totalCost: string;
  aiScore: number;
  isEvaluated: boolean;
  startTime: number;
  lastActivity: number;
  messageCount: number;
}

interface AICharacter {
  name: string;
  task: string;
  traitNames: string[];
  traitValues: number[];
  traitCount: number;
  isSet: boolean;
}

interface UserData {
  balance: string;
  hasSufficientBalance: boolean;
  hasParticipatedThisWeek: boolean;
  participationsCount: number;
  conversationCount: number;
  remainingConversations: number;
  bestScore: number;
  bestConversationId: string;
  totalContributions: string;
  participations: CastParticipation[];
}

interface CharacterData {
  name: string;
  task: string;
  traitNames: string[];
  traitValues: number[];
  traitCount: number;
  isSet: boolean;
}

// Contract addresses
const CONTRACT_ADDRESS = '0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa';
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Contract ABI - imported from abi.json
const CONTRACT_ABI = CONTRACT_ABI_JSON;

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
  const renderCount = useRef(0);
  renderCount.current += 1;
  console.log(`🏠 Home component render #${renderCount.current} at ${new Date().toISOString()}`);
  const [prizePoolData, setPrizePoolData] = useState<PrizePoolData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [characterData, setCharacterData] = useState<CharacterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLoading, setUserLoading] = useState(false);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [lastCharacterFetch, setLastCharacterFetch] = useState(0);
  const lastCharacterFetchRef = useRef(0);
  const characterFetchInProgress = useRef(false);
  const [refreshDisabled, setRefreshDisabled] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState({ text: '', days: 0, hours: 0, minutes: 0, seconds: 0, ended: false });
  const [topUpAmount, setTopUpAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [approvalAmount, setApprovalAmount] = useState('');
  const [allowance, setAllowance] = useState('0');
  const [transactionSuccess, setTransactionSuccess] = useState('');
  const [transactionError, setTransactionError] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const { isConnected, address } = useAccount();
  console.log(`💰 Account state: isConnected=${isConnected}, address=${address?.slice(0, 6)}...`);

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
    console.log('🔄 Main useEffect triggered - Initial fetch');
    fetchPrizePoolData();
    fetchCharacterData();
    
    // Refresh data every 1 minute
    const interval = setInterval(() => {
      console.log('⏰ Interval tick - 1 minute passed');
      fetchPrizePoolData();
      
      // Character data every 10 minutes (600,000ms)
      const now = Date.now();
      const timeSinceLastFetch = now - lastCharacterFetchRef.current;
      const tenMinutes = 10 * 60 * 1000;
      
      if (timeSinceLastFetch >= tenMinutes) {
        console.log(`Auto-fetching character data (${Math.floor(timeSinceLastFetch / 60000)} minutes since last fetch)`);
        fetchCharacterData();
      } else {
        console.log(`Character data not due for update (${Math.floor((tenMinutes - timeSinceLastFetch) / 60000)} minutes remaining)`);
      }
      
      if (isConnected && address) {
        fetchUserData();
      }
    }, 60000); // 1 minute
    
    return () => {
      console.log('🧹 Cleaning up interval');
      clearInterval(interval);
    };
  }, [isConnected, address]);

  useEffect(() => {
    if (isConnected && address) {
      fetchUserData();
    }
  }, [isConnected, address]);

  // Real-time countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (prizePoolData) {
        setTimeRemaining(getTimeUntilNextWeek());
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [prizePoolData]);

  // Set mounted state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Load BaseXP script once
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.basexpLoaded) {
      // Check if script already exists
      const existingScript = document.querySelector('script[src="https://basexp.org/widget/basexp-banner.js"]');
      if (existingScript) {
        window.basexpLoaded = true;
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://basexp.org/widget/basexp-banner.js';
      script.setAttribute('data-position', 'top');
      script.setAttribute('data-theme', 'dark');
      script.setAttribute('data-speed', '200');
      script.setAttribute('data-closeable', 'true');
      script.setAttribute('data-announcement-enabled', 'true');
      script.setAttribute('data-website-name', 'InfluAI.xyz');
      script.setAttribute('data-announcement-link', 'https://docs.basexp.org/project-docs/influ-ai/announcements');
      script.async = true;
      
      script.onload = () => {
        window.basexpLoaded = true;
      };
      
      script.onerror = () => {
        console.warn('BaseXP banner script failed to load');
        window.basexpLoaded = true; // Set to true to prevent retries
      };
      
      document.head.appendChild(script);
    }
  }, []);

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
          totalPrizePool: "0.00",
          currentWeekPrizePool: "0.00",
          rolloverAmount: "0.00",
          totalContributions: "0.00",
          totalProtocolFees: "0.00",
          castCost: "1",
          currentWeek: 1,
          weekStartTime: Date.now(),
          weekEndTime: Date.now() + (2 * 60 * 60 * 1000),
          currentWeekParticipantsCount: 0,
          currentWeekWinner: "0x0000000000000000000000000000000000000000",
          currentWeekPrize: "0.00",
          characterName: "",
          characterTask: "",
          characterIsSet: false
        };
        setPrizePoolData(mockData);
      }
    } catch (error) {
      console.error('Error fetching prize pool data:', error);
      const mockData: PrizePoolData = {
        totalPrizePool: "0.00",
        currentWeekPrizePool: "0.00",
        rolloverAmount: "0.00",
        totalContributions: "0.00",
        totalProtocolFees: "0.00",
        castCost: "0.01",
        currentWeek: 1,
        weekStartTime: Date.now(),
        weekEndTime: Date.now() + (2 * 60 * 60 * 1000),
        currentWeekParticipantsCount: 0,
        currentWeekWinner: "0x0000000000000000000000000000000000000000",
        currentWeekPrize: "0.00",
        characterName: "",
        characterTask: "",
        characterIsSet: false
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
          conversationCount: data.conversationCount || 0,
          remainingConversations: data.remainingConversations || 3,
          bestScore: data.bestScore || 0,
          bestConversationId: data.bestConversationId || '',
          totalContributions: data.totalContributions || '0',
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

  const fetchCharacterData = async () => {
    // Prevent concurrent requests
    if (characterFetchInProgress.current) {
      console.log('🚫 Character fetch already in progress, skipping...');
      return;
    }

    try {
      characterFetchInProgress.current = true;
      setCharacterLoading(true);
      const timestamp = new Date().toISOString();
      console.log(`🎭 [${timestamp}] fetchCharacterData called`);
      const response = await fetch('/api/character-data');
      console.log('Character API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Character data received:', data);
        console.log('Character isSet:', data.isSet);
        console.log('Character name:', data.name);
        setCharacterData(data);
        const now = Date.now();
        setLastCharacterFetch(now); // Track when we last fetched (for UI display)
        lastCharacterFetchRef.current = now; // Track when we last fetched (for interval logic)
      } else {
        console.error('Failed to fetch character data:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response body:', errorText);
        setCharacterData({
          name: '',
          task: '',
          traitNames: [],
          traitValues: [],
          traitCount: 0,
          isSet: false
        });
        const now = Date.now();
        setLastCharacterFetch(now); // Track attempt even if failed
        lastCharacterFetchRef.current = now;
      }
    } catch (error) {
      console.error('Error fetching character data:', error);
      setCharacterData({
        name: '',
        task: '',
        traitNames: [],
        traitValues: [],
        traitCount: 0,
        isSet: false
      });
      const now = Date.now();
      setLastCharacterFetch(now); // Track attempt even if failed
      lastCharacterFetchRef.current = now;
    } finally {
      setCharacterLoading(false);
      characterFetchInProgress.current = false;
    }
  };

  const handleManualRefresh = async () => {
    if (refreshDisabled) return;
    console.log('🔄 Manual refresh triggered');
    
    setRefreshDisabled(true);
    setRefreshCountdown(15);
    
    // Fetch all data types
    await fetchPrizePoolData();
    await fetchCharacterData(); // Manual refresh = instant character update
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
    if (!prizePoolData) return { text: '', days: 0, hours: 0, minutes: 0, seconds: 0, ended: false };
    
    const now = Date.now();
    const weekEnd = prizePoolData.weekEndTime; // Already in milliseconds from contract
    const timeLeft = weekEnd - now;
    
    if (timeLeft <= 0) {
      return { text: 'WINNER SELECTION TIME!', days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
    }
    
    const days = Math.floor(timeLeft / (24 * 60 * 60 * 1000));
    const hours = Math.floor((timeLeft % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
    
    if (days > 0) {
      return { text: `${days}d ${hours}h ${minutes}m remaining`, days, hours, minutes, seconds, ended: false };
    } else if (hours > 0) {
      return { text: `${hours}h ${minutes}m ${seconds}s remaining`, days, hours, minutes, seconds, ended: false };
    } else {
      return { text: `${minutes}m ${seconds}s remaining`, days, hours, minutes, seconds, ended: false };
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const getNextCharacterUpdate = () => {
    if (lastCharacterFetch === 0) return '';
    
    const nextUpdate = lastCharacterFetch + (10 * 60 * 1000); // 10 minutes
    const now = Date.now();
    const timeLeft = nextUpdate - now;
    
    if (timeLeft <= 0) return 'Next auto-update: Now';
    
    const minutes = Math.floor(timeLeft / (60 * 1000));
    const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);
    
    return `Next auto-update: ${minutes}m ${seconds}s`;
  };

   return (
     <div className="min-h-screen bg-background flex flex-col">
       {/* Header */}
       <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
         <div className="container mx-auto max-w-6xl flex h-14 items-center justify-between">
          {/* Logo */}
          <div className="hidden md:flex">
            <a href="/" className="h-8 w-auto flex items-center justify-center hover:opacity-80 transition-opacity">
              <img 
                src="/logo.svg" 
                alt="InfluAI" 
                className="h-8 w-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </a>
          </div>
           
          {/* Centered Navigation */}
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <a 
              href="/" 
              className="transition-colors hover:text-foreground/80 text-foreground"
            >
              Dashboard
            </a>
            <a 
              href="/how-it-works" 
              className="transition-colors hover:text-foreground/80 text-muted-foreground flex items-center space-x-1"
            >
              <span>📖</span>
              <span>How It Works</span>
            </a>
            <a 
              href="/chat" 
              className="transition-colors hover:text-foreground/80 text-muted-foreground flex items-center space-x-1"
            >
              <span>💬</span>
              <span>Chat History</span>
            </a>
          </nav>
           
           {/* Connect Button */}
           <div className="flex items-center">
             <ConnectButton />
           </div>
         </div>
       </header>

      {/* Hero Section */}
      <section className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 relative overflow-hidden">
        <FlickeringGrid
          className="absolute inset-0"
          squareSize={4}
          gridGap={6}
          flickerChance={0.02}
          color="rgb(147, 51, 234)"
          maxOpacity={0.4}
        />
        {/* Fade-out gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent z-20"></div>
        <div className="container mx-auto max-w-6xl flex h-auto flex-col items-center justify-center gap-4 py-16 text-center lg:py-20 relative z-10">
           <div className="space-y-6">
             <div className="flex flex-col items-center space-y-6">
               <img 
                 src="/jordan.gif" 
                 alt="Jordan Belfort" 
                 className="w-32 h-32 md:w-40 md:h-40 object-cover"
               />
                <div className="flex items-center justify-center">
                   <div className="inline-flex items-center space-x-3 bg-primary/10 border border-primary/20 rounded-full px-6 py-3">
                     <span className="text-sm text-muted-foreground font-medium">This week character:</span>
                     <span className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                       Jordan Belfort
                     </span>
                   </div>
                 </div>
               
               <div className="space-y-4">
                 <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl text-foreground">
                   Convince the AI. Win the Money.
                 </h1>
                 
                 <p className="text-xl md:text-2xl text-muted-foreground max-w-4xl mx-auto">
                   Every message costs $1 and goes into the prize pool.
                   Everyone tries to persuade the AI — beg, flirt, threaten, whatever works.
                   When the chat ends, the AI picks one winner to get all the money
                 </p>
                 
                
               </div>
             </div>
           </div>
         </div>
       </section>

      {/* Main Content */}
      <main className="flex-1 w-full">
        <div className="container mx-auto max-w-6xl py-8 space-y-8 px-4">
        
        {/* System Overview */}
        <div className="card p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-card-foreground">📊 System Overview</h2>
              <p className="text-sm text-muted-foreground">Prize data: 1min • Character: 10min • User data: 1min</p>
            </div>
            <button
              onClick={handleManualRefresh}
              disabled={refreshDisabled}
              className={`flex items-center whitespace-nowrap ${refreshDisabled ? 'btn-secondary opacity-50 cursor-not-allowed' : 'btn-primary hover-lift'}`}
            >
              <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium">
                {refreshDisabled ? `Refresh (${refreshCountdown}s)` : 'Refresh'}
              </span>
            </button>
          </div>
          
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Loading system data...</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Contract Data Section */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-mono">getCommonData()</span>
                  <h3 className="text-lg font-semibold text-card-foreground">Contract System Data</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  
                  {/* Current Week Prize Pool */}
                  <div className="card p-4 space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {formatUSDC(prizePoolData?.currentWeekPrizePool || '0')} USDC
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Current Week Prize Pool</p>
                    <p className="text-muted-foreground text-xs">
                      Accumulated from this week's participations ({formatUSDC(prizePoolData?.castCost || '1')} USDC per cast)
                    </p>
                  </div>
 
                  {/* Cast Cost */}
                  <div className="card p-4 space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {formatUSDC(prizePoolData?.castCost || '1')} USDC
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Cast Cost</p>
                        <p className="text-muted-foreground text-xs">
                      Price per @influai mention to participate
                    </p>
                  </div>
 
                  {/* Current Week */}
                  <div className="card p-4 space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {prizePoolData?.currentWeek || 1}
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Current Week</p>
                    <p className="text-muted-foreground text-xs">
                      Weekly cycle number (resets every 2 hours for testing)
                    </p>
                  </div>
               
                  {/* Total Participants */}
                  <div className="card p-4 space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {prizePoolData?.currentWeekParticipantsCount || 0}
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Participants This Week</p>
                    <p className="text-muted-foreground text-xs">
                      Unique users who participated in current week
                    </p>
                  </div>
              
                  {/* Week End Time */}
                  <div className="card p-4 space-y-2">
                    <div className="text-lg font-bold text-primary">
                      {prizePoolData ? new Date(prizePoolData.weekEndTime).toLocaleDateString() : 'Loading...'}
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Week End Date</p>
                    <p className="text-muted-foreground text-xs">
                      When the current week ends
                    </p>
                  </div>
 
                  {/* Week Start Time */}
                  <div className="card p-4 space-y-2">
                    <div className="text-sm font-bold text-primary">
                      {prizePoolData?.weekStartTime ? formatTimestamp(prizePoolData.weekStartTime) : 'N/A'}
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Week Start Time</p>
                    <p className="text-muted-foreground text-xs">
                      When the current weekly cycle began
                    </p>
                  </div>
 
                  {/* Rollover Amount */}
                  <div className="card p-4 space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {formatUSDC(prizePoolData?.rolloverAmount || '0')} USDC
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Rollover Amount</p>
                    <p className="text-muted-foreground text-xs">
                      10% of previous week's pool (if any)
                    </p>
                  </div>
 
                  {/* Total Prize Pool Ever */}
                  <div className="card p-4 space-y-2">
                    <div className="text-2xl font-bold text-primary">
                      {formatUSDC(prizePoolData?.totalPrizePool || '0')} USDC
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Total Prize Pool Ever</p>
                    <p className="text-muted-foreground text-xs">
                      Cumulative total of all prize pools
                    </p>
                  </div>
 
                  {/* Current Week Winner */}
                  <div className="card p-4 space-y-2">
                    <div className="text-sm font-bold text-primary">
                      {prizePoolData?.currentWeekWinner && prizePoolData?.currentWeekWinner !== '0x0000000000000000000000000000000000000000' 
                        ? `${prizePoolData.currentWeekWinner.slice(0, 6)}...${prizePoolData.currentWeekWinner.slice(-4)}`
                        : 'Not Selected'}
                    </div>
                    <p className="text-card-foreground text-sm font-medium">Current Week Winner</p>
                    <p className="text-muted-foreground text-xs">
                      {prizePoolData?.currentWeekPrize && parseFloat(prizePoolData.currentWeekPrize) > 0
                        ? `Prize: ${formatUSDC(prizePoolData.currentWeekPrize)} USDC`
                        : 'Winner selected by admin (if any)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* AI Character Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="bg-secondary text-secondary-foreground px-2 py-1 rounded text-sm font-mono">getCurrentCharacter()</span>
                    <h3 className="text-lg font-semibold text-card-foreground">AI Character for Week {prizePoolData?.currentWeek || 1}</h3>
                  </div>
                  {lastCharacterFetch > 0 && (
                    <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                      Updated: {new Date(lastCharacterFetch).toLocaleTimeString()}
                      <br />
                      {getNextCharacterUpdate()}
                    </div>
                  )}
                </div>
                
                {characterLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                    <p className="mt-4 text-muted-foreground">Loading character data...</p>
                  </div>
                ) : characterData && characterData.isSet ? (
                  <div className="card p-6 space-y-6">
                    {/* Character Header */}
                    <div className="text-center space-y-4">
                      <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mx-auto">
                        <span className="text-3xl">🤖</span>
                      </div>
                      <div className="space-y-2">
                        <h4 className="text-3xl font-bold text-card-foreground">{characterData.name}</h4>
                        <div className="bg-muted rounded-lg p-4 border">
                          <p className="text-muted-foreground text-lg leading-relaxed">{characterData.task}</p>
                        </div>
                      </div>
                    </div>

                    {/* Character Traits */}
                    {characterData.traitCount > 0 && (
                      <div className="space-y-4">
                        <h5 className="text-xl font-semibold text-card-foreground text-center">Character Traits</h5>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {characterData.traitNames.map((traitName, index) => (
                            <div key={index} className="bg-secondary rounded-lg p-4 border space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-secondary-foreground font-medium">{traitName}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-primary font-bold text-lg">{characterData.traitValues[index]}</span>
                                  <span className="text-muted-foreground text-sm">/10</span>
                                </div>
                              </div>
                              {/* Trait bar */}
                              <div className="w-full bg-muted rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${(characterData.traitValues[index] / 10) * 100}%` }}
                                ></div>
                              </div>
                              {/* Trait description */}
                              <div className="text-xs text-muted-foreground">
                                {characterData.traitValues[index] >= 8 ? 'Excellent' :
                                 characterData.traitValues[index] >= 6 ? 'Good' :
                                 characterData.traitValues[index] >= 4 ? 'Average' : 'Needs Work'}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Character Stats Summary */}
                        <div className="mt-6 bg-violet-900/30 rounded-xl p-4 border border-violet-500/20">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-2xl font-bold text-violet-400">
                                {characterData.traitCount}
                              </div>
                              <div className="text-violet-200 text-sm">Active Traits</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-violet-400">
                                {characterData.traitValues.reduce((sum, val) => sum + val, 0)}
                              </div>
                              <div className="text-violet-200 text-sm">Total Points</div>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-violet-400">
                                {(characterData.traitValues.reduce((sum, val) => sum + val, 0) / characterData.traitCount).toFixed(1)}
                              </div>
                              <div className="text-violet-200 text-sm">Average Score</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* How to Interact */}
                    <div className="mt-6 bg-gradient-to-r from-blue-900/30 to-indigo-900/30 rounded-xl p-4 border border-blue-500/20">
                      <h5 className="text-lg font-semibold text-foreground mb-3 flex items-center">
                        <span className="mr-2">💬</span>
                        How to Interact
                      </h5>
                      <div className="text-blue-200 text-sm space-y-2">
                        <p>• Mention <span className="font-mono bg-blue-900/50 px-2 py-1 rounded">@influai</span> in your Farcaster casts</p>
                        <p>• Engage with the AI character's personality and complete the given task</p>
                        <p>• Your conversation will be evaluated based on the character traits shown above</p>
                        <p>• Higher scores increase your chances of winning the weekly prize pool!</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card p-6 text-center">
                    <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">❓</span>
                    </div>
                    <h4 className="text-xl font-semibold text-card-foreground mb-2">No Character Set</h4>
                    <p className="text-muted-foreground mb-4">
                      The admin hasn't set an AI character for this week yet. Check back later!
                    </p>
                    {/* Debug info */}
                    {characterData && (
                      <div className="bg-card/50 rounded p-3 text-xs text-muted-foreground text-left">
                        <p><strong>Debug:</strong></p>
                        <p>Name: {characterData.name || 'empty'}</p>
                        <p>Task: {characterData.task || 'empty'}</p>
                        <p>isSet: {String(characterData.isSet)}</p>
                        <p>traitCount: {characterData.traitCount}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* getUserData() Section - Only show when connected */}
              {isConnected && address && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4 flex items-center">
                    <span className="bg-green-600 text-foreground px-2 py-1 rounded text-sm mr-3">getUserData()</span>
                    Your Personal Data
                  </h3>
                  
                  {userLoading ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-400 mx-auto"></div>
                      <p className="mt-2 text-muted-foreground text-sm">Loading your data...</p>
                    </div>
                  ) : userData ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      
                      {/* Contract Balance */}
                      <div className="bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl p-4 border border-green-500/20">
                        <div className="text-2xl font-bold text-green-400 mb-1">
                          {formatUSDC(userData.balance)} USDC
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Your Contract Balance</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          USDC available for participation (not wallet balance)
                        </p>
                      </div>

                      {/* Sufficient Balance */}
                      <div className="bg-gradient-to-r from-blue-900/30 to-cyan-900/30 rounded-xl p-4 border border-blue-500/20">
                        <div className="text-2xl font-bold text-blue-400 mb-1">
                          {userData.hasSufficientBalance ? 'Yes' : 'No'}
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Has Sufficient Balance</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Can participate (≥ 1.00 USDC required)
                        </p>
                      </div>

                      {/* Participated This Week */}
                      <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-xl p-4 border border-purple-500/20">
                        <div className="text-2xl font-bold text-purple-400 mb-1">
                          {userData.hasParticipatedThisWeek ? 'Yes' : 'No'}
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Participated This Week</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Has already participated in current week
                        </p>
                      </div>

                      {/* Participation Count */}
                      <div className="bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-xl p-4 border border-yellow-500/20">
                        <div className="text-2xl font-bold text-yellow-400 mb-1">
                          {userData.participationsCount}
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Total Participations</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Number of casts you've participated in
                        </p>
                      </div>

                      {/* Can Participate */}
                      <div className="bg-gradient-to-r from-teal-900/30 to-cyan-900/30 rounded-xl p-4 border border-teal-500/20">
                        <div className="text-2xl font-bold text-teal-400 mb-1">
                          {userData.hasSufficientBalance && !userData.hasParticipatedThisWeek ? 'Yes' : 'No'}
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Can Participate Now</p>
                          <p className="text-muted-foreground text-xs mt-1">
                          Ready to send @influai mentions
                        </p>
                      </div>

                      {/* Total Spent */}
                      <div className="bg-gradient-to-r from-red-900/30 to-pink-900/30 rounded-xl p-4 border border-red-500/20">
                        <div className="text-2xl font-bold text-red-400 mb-1">
                          {(userData.participationsCount * 1).toFixed(2)} USDC
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Total Spent</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Total USDC spent on participations
                        </p>
                      </div>

                      {/* Conversation Count */}
                      <div className="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 rounded-xl p-4 border border-indigo-500/20">
                        <div className="text-2xl font-bold text-indigo-400 mb-1">
                          {userData.conversationCount}
            </div>
                        <p className="text-muted-foreground text-sm font-medium">Active Conversations</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Number of different conversations this week
                        </p>
        </div>

                      {/* Best AI Score */}
                      <div className="bg-gradient-to-r from-emerald-900/30 to-teal-900/30 rounded-xl p-4 border border-emerald-500/20">
                        <div className="text-2xl font-bold text-emerald-400 mb-1">
                          {userData.bestScore}/50
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Best AI Score</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Highest AI evaluation score this week
                        </p>
                      </div>

                      {/* Remaining Conversations */}
                      <div className="bg-gradient-to-r from-orange-900/30 to-red-900/30 rounded-xl p-4 border border-orange-500/20">
                        <div className="text-2xl font-bold text-orange-400 mb-1">
                          {userData.remainingConversations}
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Remaining Conversations</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Max 3 conversations per week allowed
                        </p>
                      </div>

                      {/* Total Contributions */}
                      <div className="bg-gradient-to-r from-violet-900/30 to-purple-900/30 rounded-xl p-4 border border-violet-500/20">
                        <div className="text-2xl font-bold text-violet-400 mb-1">
                          {formatUSDC(userData.totalContributions || '0')} USDC
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Total Contributions</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Direct contributions to prize pool
                        </p>
                      </div>

                      {/* Status Summary */}
                      <div className="bg-gradient-to-r from-gray-900/30 to-gray-800/30 rounded-xl p-4 border border-gray-500/20">
                        <div className="text-lg font-bold text-muted-foreground mb-1">
                          {userData.hasSufficientBalance && userData.remainingConversations > 0
                            ? 'Ready to Cast' 
                            : !userData.hasSufficientBalance 
                              ? 'Need Balance' 
                              : 'No Conversations Left'}
                        </div>
                        <p className="text-muted-foreground text-sm font-medium">Current Status</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          Your participation eligibility
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Failed to load user data</p>
                    </div>
                  )}
                </div>
              )}

              {/* User Actions Section - Only show when connected */}
              {isConnected && address && (
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-4 flex items-center">
                    <span className="bg-orange-600 text-foreground px-2 py-1 rounded text-sm mr-3">Actions</span>
                    Your Wallet Actions
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Up Section */}
                    <div className="card p-6">
                      <h4 className="text-lg font-semibold text-card-foreground mb-4 flex items-center">
                        <span className="bg-blue-600 text-foreground px-2 py-1 rounded text-xs mr-2">Top Up</span>
                        Add USDC to Contract
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Amount (USDC)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="1.00"
                              placeholder="1.00"
                              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={topUpAmount}
                              onChange={(e) => setTopUpAmount(e.target.value)}
                            />
                            <div className="absolute right-3 top-2 text-xs text-muted-foreground">
                              Min: 1.00 USDC
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            <p>• <strong>Minimum:</strong> 1.00 USDC (required for participation)</p>
                            <p>• <strong>Recommended:</strong> 5.00 USDC (for multiple casts)</p>
                            <p>• <strong>Note:</strong> This adds USDC to your contract balance, not your wallet</p>
                            <p>• <strong>Usage:</strong> Each @influai mention costs {formatUSDC(prizePoolData?.castCost || '1')} USDC from contract balance</p>
                          </div>
                        </div>
                        <button
                          onClick={handleTopUp}
                          disabled={!topUpAmount || parseFloat(topUpAmount) <= 0 || isTopUpPending || isTopUpConfirming}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            !topUpAmount || parseFloat(topUpAmount) <= 0 || isTopUpPending || isTopUpConfirming
                              ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : 'bg-blue-600 hover:bg-blue-700 text-foreground hover:scale-105'
                          }`}
                        >
                          {isTopUpPending ? 'Confirming...' : isTopUpConfirming ? 'Processing...' : 'Top Up Contract'}
                        </button>
                      </div>
                    </div>

                    {/* Withdraw Section */}
                    <div className="card p-6">
                      <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                        <span className="bg-red-600 text-foreground px-2 py-1 rounded text-xs mr-2">Withdraw</span>
                        Withdraw from Contract
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Amount (USDC)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="1.00"
                              placeholder="1.00"
                              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={withdrawAmount}
                              onChange={(e) => setWithdrawAmount(e.target.value)}
                            />
                            <div className="absolute right-3 top-2 text-xs text-muted-foreground">
                              Available: {userData?.balance || '0.00'} USDC
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
                            <p>• <strong>Available Balance:</strong> {userData?.balance || '0.00'} USDC in contract</p>
                            <p>• <strong>Minimum:</strong> 1.00 USDC (cannot withdraw less)</p>
                            <p>• <strong>Note:</strong> This withdraws USDC back to your wallet</p>
                            <p>• <strong>Warning:</strong> Withdrawing may affect your ability to participate</p>
                          </div>
                        </div>
                        <button
                          onClick={handleWithdraw}
                          disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || isWithdrawPending || isWithdrawConfirming}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                            !withdrawAmount || parseFloat(withdrawAmount) <= 0 || isWithdrawPending || isWithdrawConfirming
                              ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : 'bg-red-600 hover:bg-red-700 text-foreground hover:scale-105'
                          }`}
                        >
                          {isWithdrawPending ? 'Confirming...' : isWithdrawConfirming ? 'Processing...' : 'Withdraw from Contract'}
                        </button>
                      </div>
                    </div>

                    {/* Allowance Section */}
                    <div className="card p-6">
                      <h4 className="text-lg font-semibold text-foreground mb-4 flex items-center">
                        <span className="bg-yellow-600 text-foreground px-2 py-1 rounded text-xs mr-2">Allowance</span>
                        USDC Contract Approval
                      </h4>
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          <p className="mb-2">Current Allowance: <span className="text-foreground font-medium">{allowance || '0.00'} USDC</span></p>
                          <p className="mb-4">Approve the contract to spend your USDC for top-ups.</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-muted-foreground mb-2">
                            Approval Amount (USDC)
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="50.00"
                              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                              value={approvalAmount}
                              onChange={(e) => setApprovalAmount(e.target.value)}
                            />
                            <div className="absolute right-3 top-2 text-xs text-muted-foreground">
                              Current: {allowance || '0.00'} USDC
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground space-y-1">
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
                              ? 'bg-muted text-muted-foreground cursor-not-allowed'
                              : 'bg-yellow-600 hover:bg-yellow-700 text-foreground hover:scale-105'
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

               {/* Participation History Section - Only show when connected */}
               {isConnected && address && userData && userData.participations.length > 0 && (
                 <div>
                   <h3 className="text-xl font-bold text-foreground mb-4 flex items-center">
                     <span className="bg-indigo-600 text-foreground px-2 py-1 rounded text-sm mr-3">History</span>
                     Your Participation History
                   </h3>
                   <div className="card p-6">
                     <div className="space-y-4">
                       {userData.participations.map((participation, index) => (
                         <div key={index} className="bg-secondary/50 rounded-lg p-4 border border-border">
                           <div className="flex justify-between items-start mb-3">
                             <div className="flex items-center gap-3">
                               <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                                 <span className="text-foreground text-sm font-bold">#{index + 1}</span>
                </div>
                <div>
                                 <h4 className="text-foreground font-semibold">Cast Participation</h4>
                                 <p className="text-muted-foreground text-sm">Week {participation.weekNumber}</p>
                               </div>
                             </div>
                             <div className="text-right">
                               <div className="text-lg font-bold text-indigo-400">
                                 {participation.usdcAmount} USDC
                               </div>
                               <div className="text-xs text-muted-foreground mb-2">
                                 {participation.isEvaluated ? 'Evaluated' : 'Pending Evaluation'}
                               </div>
                               <a
                                 href={`https://farcaster.xyz/v/${participation.castHash.slice(0, 10)}`}
                                 target="_blank"
                                 rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-foreground text-xs rounded-lg transition-colors"
                                 title="View this cast on Farcaster"
                               >
                                 <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                   <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                   <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                 </svg>
                                 View Cast
                               </a>
                </div>
              </div>
              
                           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                             <div>
                               <p className="text-muted-foreground mb-1">Cast Hash:</p>
                               <div className="flex items-center gap-2">
                                 <p className="text-foreground font-mono text-xs break-all">
                                   {participation.castHash}
                                 </p>
                                 <a
                                   href={`https://farcaster.xyz/v/${participation.castHash.slice(0, 10)}`}
                                   target="_blank"
                                   rel="noopener noreferrer"
                                   className="text-indigo-400 hover:text-indigo-300 transition-colors"
                                   title="View on Farcaster"
                                 >
                                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                     <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                                     <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                                   </svg>
                                 </a>
                               </div>
                               <p className="text-gray-500 text-xs mt-1">
                                 Click the link icon or "View Cast" button to see this cast on Farcaster
                               </p>
                             </div>
                             <div>
                               <p className="text-muted-foreground mb-1">Conversation ID:</p>
                               <p className="text-foreground font-mono text-xs break-all">
                                 {participation.conversationId}
                               </p>
                             </div>
                             <div>
                               <p className="text-muted-foreground mb-1">Farcaster ID:</p>
                               <p className="text-foreground font-mono text-xs">
                                 {participation.fid}
                               </p>
                             </div>
                             <div>
                               <p className="text-muted-foreground mb-1">Timestamp:</p>
                               <p className="text-foreground">
                                 {new Date(participation.timestamp * 1000).toLocaleString()}
                               </p>
                </div>
                             <div>
                               <p className="text-muted-foreground mb-1">AI Score:</p>
                               <div className="flex items-center gap-2">
                                 <span className="text-foreground font-semibold">
                                   {participation.isEvaluated ? `${participation.aiScore}/50` : 'Not evaluated'}
                                 </span>
                                 {participation.isEvaluated && (
                                   <div className={`px-2 py-1 rounded text-xs ${
                                     participation.aiScore >= 40 ? 'bg-green-900 text-green-300' :
                                     participation.aiScore >= 25 ? 'bg-yellow-900 text-yellow-300' :
                                     'bg-red-900 text-red-300'
                                   }`}>
                                     {participation.aiScore >= 40 ? 'Excellent' :
                                      participation.aiScore >= 25 ? 'Good' : 'Needs Work'}
                                   </div>
                                 )}
                               </div>
                             </div>
                <div>
                               <p className="text-muted-foreground mb-1">Status:</p>
                               <div className="flex items-center gap-2">
                                 <div className={`w-2 h-2 rounded-full ${
                                   participation.isEvaluated ? 'bg-green-500' : 'bg-yellow-500'
                                 }`}></div>
                                 <span className="text-foreground">
                                   {participation.isEvaluated ? 'Evaluated' : 'Pending Evaluation'}
                                 </span>
                               </div>
                </div>
              </div>
              
                           {participation.isEvaluated && (
                             <div className="mt-3 p-3 bg-green-900/20 border border-green-500/20 rounded-lg">
                               <div className="flex items-center gap-2">
                                 <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                                   <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                 </svg>
                                 <span className="text-green-300 text-sm font-medium">
                                   This cast has been evaluated by the admin
                                 </span>
                               </div>
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                     
                     {/* Summary Statistics */}
                     <div className="mt-6 p-4 bg-secondary/30 rounded-lg border border-border">
                       <h4 className="text-foreground font-semibold mb-3">Participation Summary</h4>
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                         <div>
                           <p className="text-muted-foreground">Total Spent:</p>
                           <p className="text-foreground font-semibold">
                             {(userData.participations.reduce((sum, p) => sum + parseFloat(p.usdcAmount), 0)).toFixed(2)} USDC
                           </p>
                         </div>
                         <div>
                           <p className="text-muted-foreground">Average per Cast:</p>
                           <p className="text-foreground font-semibold">
                             {(userData.participations.reduce((sum, p) => sum + parseFloat(p.usdcAmount), 0) / userData.participations.length).toFixed(2)} USDC
                           </p>
                         </div>
                         <div>
                           <p className="text-muted-foreground">Evaluated Casts:</p>
                           <p className="text-foreground font-semibold">
                             {userData.participations.filter(p => p.isEvaluated).length} / {userData.participations.length}
                           </p>
                         </div>
                       </div>
                     </div>
                   </div>
                 </div>
               )}

               {/* Data Context Explanation */}
              <div className="card p-4">
                <h4 className="font-semibold text-foreground mb-3">📋 Data Context & Explanation</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <h5 className="font-medium text-blue-400 mb-2">getCommonData() - System Overview</h5>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• <strong>Total Prize Pool:</strong> All-time cumulative USDC</li>
                      <li>• <strong>Current Week Prize Pool:</strong> USDC collected this week</li>
                      <li>• <strong>Rollover Amount:</strong> 10% from previous week</li>
                      <li>• <strong>Total Contributions:</strong> Direct prize pool contributions</li>
                      <li>• <strong>Protocol Fees:</strong> Total fees collected</li>
                      <li>• <strong>Cast Cost:</strong> Current cost per cast</li>
                      <li>• <strong>Current Week:</strong> Weekly cycle number</li>
                      <li>• <strong>Week Times:</strong> Start and end timestamps</li>
                      <li>• <strong>Participants:</strong> Unique users this week</li>
                      <li>• <strong>Current Winner:</strong> Selected winner (if any)</li>
                      <li>• <strong>Character Info:</strong> Basic AI character info</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-violet-400 mb-2">getCurrentCharacter() - AI Character</h5>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• <strong>Character Name:</strong> AI persona name (e.g., "Jordan Belfort")</li>
                      <li>• <strong>Task Description:</strong> What users need to accomplish</li>
                      <li>• <strong>Trait Names:</strong> Character attributes (up to 5)</li>
                      <li>• <strong>Trait Values:</strong> Trait strengths (1-10 scale)</li>
                      <li>• <strong>Trait Count:</strong> Number of active traits</li>
                      <li>• <strong>Is Set:</strong> Whether character is configured</li>
                      <li>• <strong>Weekly Rotation:</strong> New character each week</li>
                      <li>• <strong>AI Evaluation:</strong> Scores based on character traits</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium text-green-400 mb-2">getUserData() - Personal Data</h5>
                    <ul className="text-muted-foreground space-y-1">
                      <li>• <strong>Contract Balance:</strong> Your USDC in contract</li>
                      <li>• <strong>Sufficient Balance:</strong> Can participate (≥cast cost)</li>
                      <li>• <strong>Participated This Week:</strong> Has any casts this week</li>
                      <li>• <strong>Participation Count:</strong> Total casts made this week</li>
                      <li>• <strong>Conversation Count:</strong> Active conversations this week</li>
                      <li>• <strong>Remaining Conversations:</strong> Max 3 per week allowed</li>
                      <li>• <strong>Best AI Score:</strong> Highest evaluation score (0-50)</li>
                      <li>• <strong>Best Conversation ID:</strong> ID of best scored conversation</li>
                      <li>• <strong>Total Contributions:</strong> Direct prize pool contributions</li>
                      <li>• <strong>Participation History:</strong> Detailed cast records</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
          
        {/* Admin Dashboard - Only show for contract owner */}
        {isConnected && address && isMounted && (
          <div className="mt-8">
            <AdminDashboard />
          </div>
        )}

        {/* Connect Wallet Prompt - Only show when not connected */}
        {!isConnected && (
          /* Connect Wallet Prompt */
          <div className="text-center py-16">
            <div className="w-full max-w-4xl mx-auto">
              <div className="w-auto h-20 flex items-center justify-center mx-auto mb-6">
                 <img 
                 src="/logo.svg" 
                 alt="InfluAI" 
                 className="h-20 w-auto"
                  style={{ filter: 'brightness(0) invert(1)' }}
                />
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-4">Connect Your Wallet</h3>
              <p className="text-muted-foreground mb-8">
                Connect your wallet to participate in the InfluAI prize pool and manage your balance.
              </p>
              <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20">
                <h4 className="text-lg font-semibold text-foreground mb-3">How it works:</h4>
                <ul className="text-muted-foreground text-sm space-y-2 text-left">
                  <li>• Connect your wallet to Base network</li>
                  <li>• Top up your contract balance with USDC</li>
                  <li>• Mention @influai on Farcaster to participate</li>
                  <li>• Pay 1 USDC per cast</li>
                  <li>• Weekly winners get 90% of the prize pool</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-card py-6 mt-12 border-t border-border">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">
              Built on Base Network • Powered by Farcaster • influai.xyz
            </p>
            
            {/* BaseXP Footer Widget */}
            <div 
              className="basexp-footer-widget" 
              style={{
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif', 
                fontSize: '13px', 
                lineHeight: '1.5'
              }}
            >
              <a 
                href="https://basexp.org" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  color: '#9ca3af', 
                  textDecoration: 'none', 
                  transition: 'color 0.3s ease'
                }}
                onMouseOver={(e) => {
                  const logo = e.currentTarget.querySelector('.basexp-logo') as HTMLImageElement;
                  if (logo) {
                    logo.style.filter = 'brightness(0) saturate(100%) invert(27%) sepia(96%) saturate(1456%) hue-rotate(213deg) brightness(97%) contrast(101%)';
                  }
                }}
                onMouseOut={(e) => {
                  const logo = e.currentTarget.querySelector('.basexp-logo') as HTMLImageElement;
                  if (logo) {
                    logo.style.filter = 'brightness(0) invert(1)';
                  }
                }}
              >
                <span style={{fontSize: '13px', transition: 'color 0.3s ease'}}>
                  Powered by
                </span>
                <img 
                  src="https://basexp.org/logo.svg" 
                  alt="BaseXP" 
                  className="basexp-logo" 
                  style={{
                    height: '16px', 
                    width: 'auto', 
                    display: 'inline-block', 
                    verticalAlign: 'middle', 
                    filter: 'brightness(0) invert(1)', 
                    transition: 'filter 0.5s ease', 
                    cursor: 'pointer'
                  }}
                />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
