import crypto from 'crypto';
import { persistentStorage } from './persistent-storage';

// Request deduplication to prevent processing duplicate/similar requests
class RequestDeduplicator {
    private processingRequests = new Map<string, Promise<any>>();
    private recentRequests = new Map<string, { timestamp: number; result: any }>();
    private readonly DEDUP_WINDOW = 30000; // 30 seconds
    private readonly SIMILARITY_THRESHOLD = 0.8;
    private initialized = false;

    // Generate a key for deduplication based on user and content
    private generateKey(userAddress: string, castText: string, castHash?: string): string {
        // Use cast hash if available (exact duplicate)
        if (castHash) {
            return `exact:${castHash}`;
        }
        
        // Generate similarity key for near-duplicate content
        const cleanText = castText.toLowerCase()
            .replace(/@loveall/g, '')
            .replace(/[^\w\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        
        const contentHash = crypto.createHash('md5')
            .update(`${userAddress}:${cleanText}`)
            .digest('hex');
        
        return `content:${contentHash}`;
    }

    // Check if request is similar to recent ones
    private findSimilarRequest(userAddress: string, castText: string): string | null {
        const now = Date.now();
        
        for (const [key, data] of this.recentRequests) {
            // Skip if too old
            if (now - data.timestamp > this.DEDUP_WINDOW) {
                this.recentRequests.delete(key);
                continue;
            }
            
            // Check content similarity (simplified)
            if (key.startsWith(`content:`) && key.includes(userAddress.slice(0, 8))) {
                return key;
            }
        }
        
        return null;
    }

    // Initialize from persistent storage on first use
    private async initialize(): Promise<void> {
        if (this.initialized) return;
        
        try {
            console.log('📂 Loading dedup cache from persistent storage...');
            this.recentRequests = await persistentStorage.loadDedupCache();
            this.initialized = true;
            console.log(`✅ Loaded ${this.recentRequests.size} dedup cache entries from storage`);
        } catch (error) {
            console.error('Error loading dedup cache:', error);
            this.initialized = true; // Continue with empty state
        }
    }

    // Process request with deduplication
    async processRequest<T>(
        userAddress: string,
        castText: string,
        castHash: string,
        processor: () => Promise<T>
    ): Promise<{ result: T; wasDuplicate: boolean }> {
        
        // Initialize on first use
        await this.initialize();
        const exactKey = this.generateKey(userAddress, castText, castHash);
        const contentKey = this.generateKey(userAddress, castText);
        
        // 1. Check for exact duplicate (same cast hash)
        const recentExact = this.recentRequests.get(exactKey);
        if (recentExact && Date.now() - recentExact.timestamp < this.DEDUP_WINDOW) {
            console.log(`🔄 EXACT DUPLICATE detected for cast ${castHash} - returning cached result`);
            return { result: recentExact.result, wasDuplicate: true };
        }
        
        // 2. Check if same request is currently processing
        const ongoingPromise = this.processingRequests.get(exactKey);
        if (ongoingPromise) {
            console.log(`⏳ CONCURRENT REQUEST detected for cast ${castHash} - waiting for ongoing processing`);
            const result = await ongoingPromise;
            return { result, wasDuplicate: true };
        }
        
        // 3. Check for similar content from same user (spam protection)
        const similarKey = this.findSimilarRequest(userAddress, castText);
        if (similarKey) {
            const similarRequest = this.recentRequests.get(similarKey);
            if (similarRequest && Date.now() - similarRequest.timestamp < 10000) { // 10 second window for similar content
                console.log(`🚫 SIMILAR REQUEST detected from ${userAddress} - rate limiting`);
                return { 
                    result: {
                        status: 'rate_limited',
                        message: 'Please wait a moment before sending similar messages',
                        wasDuplicate: true
                    } as T,
                    wasDuplicate: true
                };
            }
        }
        
        // 4. Process new request
        console.log(`✅ NEW REQUEST - processing cast ${castHash}`);
        const processingPromise = processor();
        this.processingRequests.set(exactKey, processingPromise);
        
        try {
            const result = await processingPromise;
            
            // Cache result
            this.recentRequests.set(exactKey, {
                timestamp: Date.now(),
                result
            });
            
            // Also cache by content for similarity detection
            this.recentRequests.set(contentKey, {
                timestamp: Date.now(),
                result
            });
            
            // Persist cache to storage
            await persistentStorage.saveDedupCache(this.recentRequests);
            
            return { result, wasDuplicate: false };
            
        } finally {
            // Remove from processing map
            this.processingRequests.delete(exactKey);
            
            // Cleanup old entries periodically
            this.cleanup();
        }
    }
    
    private cleanup(): void {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, data] of this.recentRequests) {
            if (now - data.timestamp > this.DEDUP_WINDOW) {
                this.recentRequests.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} old deduplication entries`);
        }
    }
    
    getStats(): { 
        processing: number; 
        cached: number; 
        oldestCached: number | null;
    } {
        const now = Date.now();
        let oldestTimestamp: number | null = null;
        
        for (const data of this.recentRequests.values()) {
            if (!oldestTimestamp || data.timestamp < oldestTimestamp) {
                oldestTimestamp = data.timestamp;
            }
        }
        
        return {
            processing: this.processingRequests.size,
            cached: this.recentRequests.size,
            oldestCached: oldestTimestamp ? now - oldestTimestamp : null
        };
    }
}

export const requestDeduplicator = new RequestDeduplicator();
