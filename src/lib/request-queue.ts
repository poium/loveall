// Sequential request processing to prevent race conditions
class RequestQueue {
    private userQueues = new Map<string, Array<{
        id: string;
        processor: () => Promise<any>;
        resolve: (value: any) => void;
        reject: (error: any) => void;
        timestamp: number;
    }>>();
    
    private processing = new Set<string>();
    private readonly MAX_QUEUE_SIZE = 5;
    private readonly MAX_WAIT_TIME = 30000; // 30 seconds

    // Add request to user-specific queue
    async enqueueRequest<T>(
        userAddress: string,
        requestId: string,
        processor: () => Promise<T>
    ): Promise<T> {
        
        // Initialize queue for user if doesn't exist
        if (!this.userQueues.has(userAddress)) {
            this.userQueues.set(userAddress, []);
        }
        
        const queue = this.userQueues.get(userAddress)!;
        
        // Check queue size limit
        if (queue.length >= this.MAX_QUEUE_SIZE) {
            throw new Error(`Request queue full for user ${userAddress}. Please try again later.`);
        }
        
        // Create promise for this request
        const requestPromise = new Promise<T>((resolve, reject) => {
            queue.push({
                id: requestId,
                processor,
                resolve,
                reject,
                timestamp: Date.now()
            });
        });
        
        console.log(`📥 Queued request ${requestId} for user ${userAddress} (position: ${queue.length})`);
        
        // Start processing if not already processing for this user
        if (!this.processing.has(userAddress)) {
            this.processQueue(userAddress);
        }
        
        return requestPromise;
    }
    
    // Process requests sequentially for a user
    private async processQueue(userAddress: string): Promise<void> {
        if (this.processing.has(userAddress)) {
            return; // Already processing
        }
        
        this.processing.add(userAddress);
        console.log(`🔄 Started processing queue for user ${userAddress}`);
        
        try {
            const queue = this.userQueues.get(userAddress);
            if (!queue) {
                return;
            }
            
            while (queue.length > 0) {
                const request = queue.shift()!;
                
                // Check if request has expired
                if (Date.now() - request.timestamp > this.MAX_WAIT_TIME) {
                    console.log(`⏰ Request ${request.id} expired, skipping`);
                    request.reject(new Error('Request timeout - took too long to process'));
                    continue;
                }
                
                try {
                    console.log(`⚡ Processing request ${request.id} for user ${userAddress}`);
                    const result = await request.processor();
                    request.resolve(result);
                    console.log(`✅ Completed request ${request.id} for user ${userAddress}`);
                } catch (error) {
                    console.error(`❌ Failed request ${request.id} for user ${userAddress}:`, error);
                    request.reject(error);
                }
                
                // Small delay between requests to prevent overwhelming
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
        } finally {
            this.processing.delete(userAddress);
            console.log(`🏁 Finished processing queue for user ${userAddress}`);
            
            // Clean up empty queue
            const queue = this.userQueues.get(userAddress);
            if (queue && queue.length === 0) {
                this.userQueues.delete(userAddress);
            }
        }
    }
    
    // Get queue stats for monitoring
    getStats(): {
        activeUsers: number;
        totalQueued: number;
        processing: number;
        userBreakdown: Record<string, { queued: number; isProcessing: boolean }>;
    } {
        let totalQueued = 0;
        const userBreakdown: Record<string, { queued: number; isProcessing: boolean }> = {};
        
        for (const [userAddress, queue] of this.userQueues) {
            const queueLength = queue.length;
            totalQueued += queueLength;
            
            userBreakdown[userAddress] = {
                queued: queueLength,
                isProcessing: this.processing.has(userAddress)
            };
        }
        
        return {
            activeUsers: this.userQueues.size,
            totalQueued,
            processing: this.processing.size,
            userBreakdown
        };
    }
    
    // Get queue position for a user
    getQueuePosition(userAddress: string, requestId: string): number {
        const queue = this.userQueues.get(userAddress);
        if (!queue) return -1;
        
        const index = queue.findIndex(req => req.id === requestId);
        return index >= 0 ? index + 1 : -1; // 1-based position
    }
    
    // Clear expired requests from all queues
    cleanupExpiredRequests(): void {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [userAddress, queue] of this.userQueues) {
            const originalLength = queue.length;
            
            // Remove expired requests
            for (let i = queue.length - 1; i >= 0; i--) {
                if (now - queue[i].timestamp > this.MAX_WAIT_TIME) {
                    const expiredRequest = queue.splice(i, 1)[0];
                    expiredRequest.reject(new Error('Request expired while waiting in queue'));
                    cleanedCount++;
                }
            }
            
            // Remove empty queues
            if (queue.length === 0) {
                this.userQueues.delete(userAddress);
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`🧹 Cleaned up ${cleanedCount} expired requests from queues`);
        }
    }
}

export const requestQueue = new RequestQueue();
