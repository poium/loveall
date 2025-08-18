import { ethers } from 'ethers';
import { persistentStorage } from './persistent-storage';

// Balance reservation system to prevent double-spending
class BalanceManager {
    private reservations = new Map<string, {
        amount: string;
        timestamp: number;
        requestId: string;
        expiresAt: number;
    }>();
    
    private initialized = false;
    
    private readonly RESERVATION_TIMEOUT = 60000; // 1 minute
    private readonly CAST_COST = '0.01'; // USDC

    // Initialize from persistent storage on first use
    private async initialize(): Promise<void> {
        if (this.initialized) return;
        
        try {
            console.log('📂 Loading reservations from persistent storage...');
            this.reservations = await persistentStorage.loadReservations();
            this.initialized = true;
            console.log(`✅ Loaded ${this.reservations.size} reservations from storage`);
        } catch (error) {
            console.error('Error loading reservations:', error);
            this.initialized = true; // Continue with empty state
        }
    }

    // Reserve balance for a user
    async reserveBalance(
        userAddress: string, 
        requestId: string,
        requiredAmount: string = this.CAST_COST
    ): Promise<{ success: boolean; reservationId?: string; availableBalance?: string; error?: string }> {
        
        // Initialize on first use
        await this.initialize();
        
        const reservationKey = `${userAddress}:${requestId}`;
        const now = Date.now();
        
        // Clean up expired reservations first
        this.cleanupExpiredReservations();
        
        // Check if this specific request already has a reservation
        const existingReservation = this.reservations.get(reservationKey);
        if (existingReservation) {
            if (existingReservation.expiresAt > now) {
                console.log(`✅ Existing reservation found for ${userAddress}:${requestId}`);
                return { 
                    success: true, 
                    reservationId: reservationKey,
                    availableBalance: existingReservation.amount
                };
            } else {
                // Expired reservation
                this.reservations.delete(reservationKey);
            }
        }
        
        // Get current balance from contract
        const actualBalance = await this.getActualBalance(userAddress);
        
        // Calculate total reserved amount for this user
        const totalReserved = this.getTotalReservedForUser(userAddress);
        const availableBalance = (parseFloat(actualBalance) - parseFloat(totalReserved)).toFixed(6);
        
        console.log(`💰 Balance check for ${userAddress}:`);
        console.log(`  - Actual balance: ${actualBalance} USDC`);
        console.log(`  - Total reserved: ${totalReserved} USDC`);
        console.log(`  - Available: ${availableBalance} USDC`);
        console.log(`  - Required: ${requiredAmount} USDC`);
        
        // Check if sufficient balance available
        if (parseFloat(availableBalance) < parseFloat(requiredAmount)) {
            return { 
                success: false, 
                availableBalance,
                error: `Insufficient balance. Available: ${availableBalance} USDC, Required: ${requiredAmount} USDC`
            };
        }
        
        // Create reservation
        const reservation = {
            amount: requiredAmount,
            timestamp: now,
            requestId,
            expiresAt: now + this.RESERVATION_TIMEOUT
        };
        
        this.reservations.set(reservationKey, reservation);
        
        // Persist to storage
        await persistentStorage.saveReservations(this.reservations);
        
        console.log(`🔒 Reserved ${requiredAmount} USDC for ${userAddress}:${requestId}`);
        
        return { 
            success: true, 
            reservationId: reservationKey,
            availableBalance: (parseFloat(availableBalance) - parseFloat(requiredAmount)).toFixed(6)
        };
    }
    
    // Release a specific reservation
    async releaseReservation(reservationId: string): Promise<boolean> {
        const reservation = this.reservations.get(reservationId);
        if (reservation) {
            this.reservations.delete(reservationId);
            
            // Persist changes
            await persistentStorage.saveReservations(this.reservations);
            
            console.log(`🔓 Released reservation ${reservationId} (${reservation.amount} USDC)`);
            return true;
        }
        return false;
    }
    
    // Get total reserved amount for a user
    private getTotalReservedForUser(userAddress: string): string {
        let total = 0;
        const now = Date.now();
        
        for (const [key, reservation] of this.reservations) {
            if (key.startsWith(userAddress + ':') && reservation.expiresAt > now) {
                total += parseFloat(reservation.amount);
            }
        }
        
        return total.toFixed(6);
    }
    
    // Get actual balance from smart contract
    private async getActualBalance(userAddress: string): Promise<string> {
        try {
            // Import here to avoid circular dependencies
            const { getBotUserData } = await import('@/lib/bot-data');
            const userData = await getBotUserData(userAddress);
            return userData.balance;
        } catch (error) {
            console.error('Error getting actual balance:', error);
            return '0';
        }
    }
    
    // Clean up expired reservations
    private cleanupExpiredReservations(): void {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, reservation] of this.reservations) {
            if (reservation.expiresAt <= now) {
                this.reservations.delete(key);
                cleanedCount++;
                console.log(`🧹 Cleaned up expired reservation: ${key} (${reservation.amount} USDC)`);
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Total expired reservations cleaned: ${cleanedCount}`);
        }
    }
    
    // Get reservation stats
    getStats(): {
        totalReservations: number;
        totalAmountReserved: string;
        userBreakdown: Record<string, { count: number; amount: string }>;
    } {
        this.cleanupExpiredReservations();
        
        let totalAmount = 0;
        const userBreakdown: Record<string, { count: number; amount: string }> = {};
        
        for (const [key, reservation] of this.reservations) {
            const userAddress = key.split(':')[0];
            totalAmount += parseFloat(reservation.amount);
            
            if (!userBreakdown[userAddress]) {
                userBreakdown[userAddress] = { count: 0, amount: '0' };
            }
            
            userBreakdown[userAddress].count++;
            userBreakdown[userAddress].amount = (
                parseFloat(userBreakdown[userAddress].amount) + parseFloat(reservation.amount)
            ).toFixed(6);
        }
        
        return {
            totalReservations: this.reservations.size,
            totalAmountReserved: totalAmount.toFixed(6),
            userBreakdown
        };
    }
    
    // Force cleanup (for testing)
    forceCleanup(): void {
        this.reservations.clear();
        console.log('🧹 Force cleared all reservations');
    }
}

export const balanceManager = new BalanceManager();
