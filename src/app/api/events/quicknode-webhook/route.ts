import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Contract addresses
const YOUR_CONTRACT = '0x79C495b3F99EeC74ef06C79677Aee352F40F1De5';
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Event signatures
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

// In-memory storage (replace with database later)
const userBalances = new Map<string, {
  usdcBalance: string;
  contractBalance: string;
  hasParticipated: boolean;
  remainingConversations: number;
  lastUpdated: number;
}>();

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    if (!payload.data || payload.data.length === 0) {
      // Don't log empty batches to reduce spam - return early without logging
      return NextResponse.json({ status: 'success', processed: 0 });
    }
    
    // Only log when we have events
    console.log('📡 QuickNode webhook received with', payload.data.length, 'events');
    console.log('📦 Block range:', payload.metadata?.batch_start_range, 'to', payload.metadata?.batch_end_range);
    
    // Debug the first event structure
    if (payload.data.length > 0) {
      console.log('🔍 First event structure:', JSON.stringify(payload.data[0], null, 2));
    }
    
    let processedEvents = 0;
    
    for (const log of payload.data) {
      try {
        await processEvent(log);
        processedEvents++;
      } catch (error) {
        console.error('❌ Error processing event:', error);
      }
    }
    
    console.log(`✅ Processed ${processedEvents} events`);
    
    return NextResponse.json({ 
      status: 'success', 
      processed: processedEvents,
      total: payload.data.length 
    });
    
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ 
      error: 'Processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function processEvent(log: any) {
  const address = log.address?.toLowerCase();
  const topic0 = log.topics?.[0];
  
  console.log('🔍 Processing event:', {
    address,
    topic0: topic0?.slice(0, 10) + '...',
    blockNumber: log.blockNumber
  });
  
  // USDC Transfer events
  if (address === USDC_CONTRACT.toLowerCase() && topic0 === TRANSFER_TOPIC) {
    await processUSDCTransfer(log);
  }
  
  // USDC Approval events  
  else if (address === USDC_CONTRACT.toLowerCase() && topic0 === APPROVAL_TOPIC) {
    await processUSDCApproval(log);
  }
  
  // Your contract events
  else if (address === YOUR_CONTRACT.toLowerCase()) {
    await processContractEvent(log);
  }
}

async function processUSDCTransfer(log: any) {
  const from = log.topics[1];
  const to = log.topics[2];
  const amount = ethers.formatUnits(log.data, 6); // USDC has 6 decimals
  
  // Convert topic addresses (remove padding)
  const fromAddress = '0x' + from.slice(-40);
  const toAddress = '0x' + to.slice(-40);
  
  console.log('💰 USDC Transfer:', {
    from: fromAddress,
    to: toAddress,
    amount: amount + ' USDC',
    block: log.blockNumber
  });
  
  // Check if it's a deposit to your contract
  if (toAddress.toLowerCase() === YOUR_CONTRACT.toLowerCase()) {
    console.log('📈 Deposit detected:', fromAddress, 'deposited', amount, 'USDC');
    updateUserBalance(fromAddress, amount, 'deposit');
  }
  
  // Check if it's a withdrawal from your contract
  if (fromAddress.toLowerCase() === YOUR_CONTRACT.toLowerCase()) {
    console.log('📉 Withdrawal detected:', toAddress, 'withdrew', amount, 'USDC');
    updateUserBalance(toAddress, amount, 'withdrawal');
  }
}

async function processUSDCApproval(log: any) {
  const owner = '0x' + log.topics[1].slice(-40);
  const spender = '0x' + log.topics[2].slice(-40);
  const amount = ethers.formatUnits(log.data, 6);
  
  if (spender.toLowerCase() === YOUR_CONTRACT.toLowerCase()) {
    console.log('✅ Approval detected:', {
      owner,
      amount: amount + ' USDC',
      block: log.blockNumber
    });
    
    // Update user's approval status
    updateUserApproval(owner, amount);
  }
}

async function processContractEvent(log: any) {
  console.log('🏗️ Contract event detected:', {
    topic0: log.topics[0],
    block: log.blockNumber,
    txHash: log.transactionHash
  });
  
  // You can decode specific events here based on topics
  // For now, just log them
}

function updateUserBalance(userAddress: string, amount: string, type: 'deposit' | 'withdrawal') {
  const user = userBalances.get(userAddress.toLowerCase()) || {
    usdcBalance: '0',
    contractBalance: '0',
    hasParticipated: false,
    remainingConversations: 3,
    lastUpdated: Date.now()
  };
  
  const amountNum = parseFloat(amount);
  const currentBalance = parseFloat(user.contractBalance);
  
  if (type === 'deposit') {
    user.contractBalance = (currentBalance + amountNum).toString();
  } else {
    user.contractBalance = Math.max(0, currentBalance - amountNum).toString();
  }
  
  user.lastUpdated = Date.now();
  userBalances.set(userAddress.toLowerCase(), user);
  
  console.log('💾 Updated balance for', userAddress, ':', user.contractBalance, 'USDC');
}

function updateUserApproval(userAddress: string, amount: string) {
  console.log('📝 Approval updated for', userAddress, ':', amount, 'USDC');
  // Store approval amount if needed
}

// GET endpoint to check stored balances (for debugging)
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const address = url.searchParams.get('address');
  
  if (address) {
    const user = userBalances.get(address.toLowerCase());
    return NextResponse.json({
      address,
      data: user || null,
      source: 'quicknode-events'
    });
  }
  
  return NextResponse.json({
    totalUsers: userBalances.size,
    users: Array.from(userBalances.entries()).slice(0, 10) // Show first 10
  });
}
