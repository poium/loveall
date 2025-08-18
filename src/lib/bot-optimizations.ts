import { ethers } from 'ethers';
import crypto from 'crypto';

// Response cache for common AI interactions
class ResponseCache {
    private cache = new Map<string, { response: string; timestamp: number; hitCount: number }>();
    private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    private readonly MAX_CACHE_SIZE = 1000;

    // Generate cache key from user input
    private generateKey(castText: string, interactionType: string): string {
        const cleanText = castText.toLowerCase()
            .replace(/@loveall/g, '')
            .replace(/[^\w\s]/g, '')
            .trim();
        
        return crypto.createHash('md5')
            .update(`${cleanText}-${interactionType}`)
            .digest('hex');
    }

    get(castText: string, interactionType: string): string | null {
        const key = this.generateKey(castText, interactionType);
        const cached = this.cache.get(key);
        
        if (!cached) return null;
        
        // Check if expired
        if (Date.now() - cached.timestamp > this.CACHE_DURATION) {
            this.cache.delete(key);
            return null;
        }
        
        // Increment hit count and return
        cached.hitCount++;
        console.log(`💾 Cache HIT for "${castText.substring(0, 30)}..." (hits: ${cached.hitCount})`);
        return cached.response;
    }

    set(castText: string, interactionType: string, response: string): void {
        const key = this.generateKey(castText, interactionType);
        
        // Cleanup if cache is full
        if (this.cache.size >= this.MAX_CACHE_SIZE) {
            this.cleanup();
        }
        
        this.cache.set(key, {
            response,
            timestamp: Date.now(),
            hitCount: 0
        });
        
        console.log(`💾 Cached response for "${castText.substring(0, 30)}..."`);
    }

    private cleanup(): void {
        // Remove oldest entries
        const entries = Array.from(this.cache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        const toRemove = entries.slice(0, Math.floor(this.MAX_CACHE_SIZE * 0.2));
        toRemove.forEach(([key]) => this.cache.delete(key));
        
        console.log(`🧹 Cleaned up ${toRemove.length} old cache entries`);
    }

    getStats(): { size: number; hitRate: number; topResponses: Array<{text: string; hits: number}> } {
        const entries = Array.from(this.cache.values());
        const totalAccess = entries.reduce((sum, entry) => sum + entry.hitCount, 0);
        const totalHits = entries.filter(entry => entry.hitCount > 0).length;
        
        const topResponses = Array.from(this.cache.entries())
            .filter(([_, entry]) => entry.hitCount > 0)
            .sort((a, b) => b[1].hitCount - a[1].hitCount)
            .slice(0, 5)
            .map(([key, entry]) => ({
                text: entry.response.substring(0, 50) + '...',
                hits: entry.hitCount
            }));

        return {
            size: this.cache.size,
            hitRate: totalAccess > 0 ? (totalHits / totalAccess) * 100 : 0,
            topResponses
        };
    }
}

// Global response cache instance
export const responseCache = new ResponseCache();

// Batch address balance checking
export async function checkMultipleAddressesParallel(
    addresses: string[],
    checkFunction: (address: string) => Promise<any>
): Promise<any[]> {
    console.log(`⚡ Checking ${addresses.length} addresses in parallel...`);
    const startTime = Date.now();
    
    // Execute all checks in parallel
    const checks = addresses.map(async (address, index) => {
        try {
            const result = await checkFunction(address);
            return { address, result, index, success: true };
        } catch (error) {
            console.error(`❌ Error checking address ${address}:`, error);
            return { 
                address, 
                result: { 
                    hasBalance: false, 
                    balance: '0', 
                    error: error instanceof Error ? error.message : 'Unknown error' 
                }, 
                index, 
                success: false 
            };
        }
    });
    
    const results = await Promise.all(checks);
    const duration = Date.now() - startTime;
    
    console.log(`⚡ Parallel check completed in ${duration}ms (vs ${addresses.length * 500}ms sequential)`);
    
    // Return results in original order
    return results
        .sort((a, b) => a.index - b.index)
        .map(r => r.result);
}

// Smart response patterns for instant replies
export const INSTANT_RESPONSES = new Map([
    // Greetings
    ['hello', "Hey there! 😊 I'm Loveall, and I'm really happy to meet you! What's on your mind today?"],
    ['hey', "Hi! 😊 Great to see you here. What's been going on with you lately?"],
    ['hi', "Hello! 😊 I'm excited to chat with you. What would you like to talk about?"],
    
    // How are you variations
    ['how are you', "I'm doing great! Thanks for asking. 😊 What's been the highlight of your day so far?"],
    ['how is it going', "Things are going wonderfully! 😊 I love meeting new people here. How has your day been treating you?"],
    ['whats up', "Not much, just enjoying conversations! 😊 What's been keeping you busy lately?"],
    
    // About responses  
    ['who are you', "I'm Loveall! 😊 I'm here to have genuine, warm conversations with amazing people like you. What brings you to Farcaster?"],
    ['what do you do', "I love having meaningful chats and getting to know people! 😊 There's something special about every person I meet. What's your story?"],
    
    // Simple acknowledgments
    ['thanks', "You're so welcome! 😊 I'm always happy to help. Is there anything else you'd like to chat about?"],
    ['thank you', "My pleasure! 😊 I really enjoy our conversation. What else is on your mind?"],
    
    // Weather/general
    ['nice weather', "I love hearing about beautiful days! ☀️ Perfect weather always makes everything feel more positive. Are you doing anything special to enjoy it?"],
    ['good morning', "Good morning! 🌅 I hope you're starting your day with something that makes you smile. What's first on your agenda?"],
    ['good night', "Sweet dreams! 🌙 Thanks for the lovely chat. Hope tomorrow brings you something wonderful!"]
]);

// Pattern matching for instant responses
export function getInstantResponse(castText: string): string | null {
    const cleanText = castText.toLowerCase()
        .replace(/@loveall/g, '')
        .replace(/[^\w\s]/g, '')
        .trim();
    
    // Direct matches
    for (const [pattern, response] of INSTANT_RESPONSES) {
        if (cleanText.includes(pattern)) {
            console.log(`⚡ INSTANT response for pattern: "${pattern}"`);
            return response;
        }
    }
    
    // Smart pattern matching
    if (/^(gm|good morning)/.test(cleanText)) {
        return "Good morning! 🌅 I hope you're starting your day with something that makes you smile. What's first on your agenda?";
    }
    
    if (/^(gn|good night)/.test(cleanText)) {
        return "Sweet dreams! 🌙 Thanks for the lovely chat. Hope tomorrow brings you something wonderful!";
    }
    
    if (/\b(coffee|tea)\b/.test(cleanText)) {
        return "That sounds lovely! ☕️ I'm more of a digital being myself, but I love hearing about people's favorite ways to relax. What's your perfect afternoon like?";
    }
    
    return null;
}

// Performance monitoring
export class PerformanceMonitor {
    private metrics = new Map<string, { count: number; totalTime: number; maxTime: number; minTime: number }>();
    
    async measure<T>(label: string, operation: () => Promise<T>): Promise<T> {
        const startTime = Date.now();
        
        try {
            const result = await operation();
            this.recordMetric(label, Date.now() - startTime);
            return result;
        } catch (error) {
            this.recordMetric(label + '_ERROR', Date.now() - startTime);
            throw error;
        }
    }
    
    private recordMetric(label: string, duration: number): void {
        const existing = this.metrics.get(label);
        
        if (existing) {
            existing.count++;
            existing.totalTime += duration;
            existing.maxTime = Math.max(existing.maxTime, duration);
            existing.minTime = Math.min(existing.minTime, duration);
        } else {
            this.metrics.set(label, {
                count: 1,
                totalTime: duration,
                maxTime: duration,
                minTime: duration
            });
        }
    }
    
    getReport(): Record<string, any> {
        const report: Record<string, any> = {};
        
        for (const [label, metric] of this.metrics) {
            report[label] = {
                calls: metric.count,
                avgTime: Math.round(metric.totalTime / metric.count),
                maxTime: metric.maxTime,
                minTime: metric.minTime,
                totalTime: metric.totalTime
            };
        }
        
        return report;
    }
    
    logReport(): void {
        console.log('📊 Performance Report:', JSON.stringify(this.getReport(), null, 2));
    }
}

export const performanceMonitor = new PerformanceMonitor();

// Optimized error handling with circuit breaker
export class CircuitBreaker {
    private failures = 0;
    private lastFailTime = 0;
    private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    constructor(
        private failureThreshold = 5,
        private timeout = 60000, // 1 minute
        private retryTimeout = 30000 // 30 seconds
    ) {}
    
    async execute<T>(operation: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
        if (this.state === 'OPEN') {
            if (Date.now() - this.lastFailTime >= this.retryTimeout) {
                this.state = 'HALF_OPEN';
            } else {
                console.log('🚫 Circuit breaker OPEN - using fallback');
                if (fallback) return await fallback();
                throw new Error('Circuit breaker is OPEN and no fallback provided');
            }
        }
        
        try {
            const result = await operation();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            if (fallback && this.state === 'OPEN') {
                console.log('🔄 Using fallback due to circuit breaker');
                return await fallback();
            }
            throw error;
        }
    }
    
    private onSuccess(): void {
        this.failures = 0;
        this.state = 'CLOSED';
    }
    
    private onFailure(): void {
        this.failures++;
        this.lastFailTime = Date.now();
        
        if (this.failures >= this.failureThreshold) {
            this.state = 'OPEN';
            console.log(`🚫 Circuit breaker OPENED after ${this.failures} failures`);
        }
    }
}

export const grokCircuitBreaker = new CircuitBreaker();
