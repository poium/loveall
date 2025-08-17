// Simple database layer for caching user data and common data
// This replaces RPC calls with fast local data access

interface UserData {
  address: string;
  contractBalance: string;
  usdcBalance: string;
  allowance: string;
  hasSufficientBalance: boolean;
  hasParticipatedThisWeek: boolean;
  participationsCount: number;
  conversationCount: number;
  remainingConversations: number;
  bestScore: number;
  bestConversationId: string;
  totalContributions: string;
  lastUpdated: number;
}

interface CommonData {
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
  lastUpdated: number;
}

// In-memory cache with persistence to file (can be upgraded to Redis/PostgreSQL)
class UserDataCache {
  private users: Map<string, UserData> = new Map();
  private commonData: CommonData | null = null;
  private lastCommonDataUpdate = 0;

  // Get user data from cache
  getUserData(address: string): UserData | null {
    const userData = this.users.get(address.toLowerCase());
    
    // Return data if it exists and is less than 2 minutes old (reduced for debugging)
    if (userData && (Date.now() - userData.lastUpdated) < 2 * 60 * 1000) {
      return userData;
    }
    
    // Log cache miss reason
    if (userData) {
      const ageMinutes = Math.floor((Date.now() - userData.lastUpdated) / 1000 / 60);
      console.log(`💾 Cache: User data for ${address} is ${ageMinutes} minutes old, expired`);
    } else {
      console.log(`💾 Cache: No cached data found for ${address}`);
    }
    
    return null;
  }

  // Update user data in cache
  updateUserData(address: string, data: Partial<UserData>): void {
    const existing = this.users.get(address.toLowerCase()) || {} as UserData;
    
    const updated: UserData = {
      ...existing,
      ...data,
      address: address.toLowerCase(),
      lastUpdated: Date.now()
    };
    
    this.users.set(address.toLowerCase(), updated);
    console.log('💾 Cache: Updated user data for', address);
  }

  // Update user balance from webhook event
  updateUserBalance(address: string, contractBalance: string, type: 'deposit' | 'withdrawal'): void {
    console.log(`💰 Cache: ${type} detected for ${address}: ${contractBalance}`);
    
    this.updateUserData(address, {
      contractBalance,
      hasSufficientBalance: parseFloat(contractBalance) >= 0.01, // Assuming 0.01 USDC minimum
      lastUpdated: Date.now()
    });
  }

  // Update user allowance from webhook event
  updateUserAllowance(address: string, allowance: string): void {
    console.log(`✅ Cache: Allowance updated for ${address}: ${allowance}`);
    
    this.updateUserData(address, {
      allowance,
      lastUpdated: Date.now()
    });
  }

  // Get common data from cache
  getCommonData(): CommonData | null {
    // Return data if it exists and is less than 10 minutes old
    if (this.commonData && (Date.now() - this.lastCommonDataUpdate) < 10 * 60 * 1000) {
      return this.commonData;
    }
    
    return null;
  }

  // Update common data in cache
  updateCommonData(data: CommonData): void {
    this.commonData = {
      ...data,
      lastUpdated: Date.now()
    };
    this.lastCommonDataUpdate = Date.now();
    console.log('💾 Cache: Updated common data');
  }

  // Get cache statistics
  getStats(): { userCount: number, commonDataAge: number, oldestUserData: number } {
    const now = Date.now();
    let oldestUserData = now;
    
    for (const userData of this.users.values()) {
      if (userData.lastUpdated < oldestUserData) {
        oldestUserData = userData.lastUpdated;
      }
    }
    
    return {
      userCount: this.users.size,
      commonDataAge: this.commonData ? now - this.lastCommonDataUpdate : -1,
      oldestUserData: this.users.size > 0 ? now - oldestUserData : -1
    };
  }

  // Clean up old entries (keep last 1000 users)
  cleanup(): void {
    if (this.users.size <= 1000) return;
    
    const entries = Array.from(this.users.entries());
    entries.sort((a, b) => b[1].lastUpdated - a[1].lastUpdated);
    
    this.users.clear();
    for (let i = 0; i < 1000; i++) {
      this.users.set(entries[i][0], entries[i][1]);
    }
    
    console.log('🧹 Cache: Cleaned up old user data, kept 1000 most recent');
  }

  // Force clear cache for specific user (for debugging)
  clearUserCache(address: string): void {
    const deleted = this.users.delete(address.toLowerCase());
    console.log(`🧹 Cache: ${deleted ? 'Cleared' : 'No data found for'} user ${address}`);
  }

  // Force clear all cache (nuclear option)
  clearAllCache(): void {
    const userCount = this.users.size;
    this.users.clear();
    this.commonData = null;
    this.lastCommonDataUpdate = 0;
    console.log(`🧹 Cache: Cleared all cached data (${userCount} users)`);
  }
}

// Global cache instance
export const userDataCache = new UserDataCache();

// Utility functions for the bot
export async function getCachedUserData(address: string): Promise<UserData | null> {
  return userDataCache.getUserData(address);
}

export async function getCachedCommonData(): Promise<CommonData | null> {
  return userDataCache.getCommonData();
}

export function updateCachedUserData(address: string, data: Partial<UserData>): void {
  userDataCache.updateUserData(address, data);
}

export function updateCachedCommonData(data: CommonData): void {
  userDataCache.updateCommonData(data);
}

// For webhook usage
export function handleDeposit(address: string, amount: string): void {
  userDataCache.updateUserBalance(address, amount, 'deposit');
}

export function handleWithdrawal(address: string, amount: string): void {
  userDataCache.updateUserBalance(address, amount, 'withdrawal');
}

export function handleApproval(address: string, amount: string): void {
  userDataCache.updateUserAllowance(address, amount);
}

export function getCacheStats(): { userCount: number, commonDataAge: number, oldestUserData: number } {
  return userDataCache.getStats();
}

// Cache invalidation functions
export function clearUserCache(address: string): void {
  userDataCache.clearUserCache(address);
}

export function clearAllCache(): void {
  userDataCache.clearAllCache();
}

export { UserData, CommonData };
