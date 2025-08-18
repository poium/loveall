import fs from 'fs/promises';
import path from 'path';

// Persistent storage manager for queue data
class PersistentStorage {
    private readonly DATA_DIR = path.join(process.cwd(), 'data');
    private readonly RESERVATIONS_FILE = path.join(this.DATA_DIR, 'reservations.json');
    private readonly QUEUES_FILE = path.join(this.DATA_DIR, 'queues.json');
    private readonly DEDUP_FILE = path.join(this.DATA_DIR, 'dedup-cache.json');
    
    private writeTimeouts = new Map<string, NodeJS.Timeout>();
    private readonly WRITE_DELAY = 1000; // 1 second debounce

    constructor() {
        this.ensureDataDirectory();
    }

    // Ensure data directory exists
    private async ensureDataDirectory(): Promise<void> {
        try {
            await fs.mkdir(this.DATA_DIR, { recursive: true });
        } catch (error) {
            console.error('Error creating data directory:', error);
        }
    }

    // Debounced write to prevent excessive I/O
    private scheduleWrite(file: string, data: any): void {
        // Clear existing timeout
        if (this.writeTimeouts.has(file)) {
            clearTimeout(this.writeTimeouts.get(file)!);
        }

        // Schedule new write
        const timeout = setTimeout(async () => {
            try {
                await fs.writeFile(file, JSON.stringify(data, null, 2));
                console.log(`💾 Persisted data to ${path.basename(file)}`);
            } catch (error) {
                console.error(`Error writing to ${file}:`, error);
            }
            this.writeTimeouts.delete(file);
        }, this.WRITE_DELAY);

        this.writeTimeouts.set(file, timeout);
    }

    // BALANCE RESERVATIONS PERSISTENCE
    async saveReservations(reservationsMap: Map<string, any>): Promise<void> {
        const data = {
            reservations: Object.fromEntries(reservationsMap),
            timestamp: Date.now(),
            count: reservationsMap.size
        };
        this.scheduleWrite(this.RESERVATIONS_FILE, data);
    }

    async loadReservations(): Promise<Map<string, any>> {
        try {
            const data = await fs.readFile(this.RESERVATIONS_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            
            const reservationsMap = new Map();
            const now = Date.now();
            let validCount = 0;
            let expiredCount = 0;

            // Only load non-expired reservations
            for (const [key, reservation] of Object.entries(parsed.reservations || {})) {
                const res = reservation as any;
                if (res.expiresAt && res.expiresAt > now) {
                    reservationsMap.set(key, res);
                    validCount++;
                } else {
                    expiredCount++;
                }
            }

            console.log(`📂 Loaded ${validCount} valid reservations, skipped ${expiredCount} expired`);
            return reservationsMap;
        } catch (error) {
            console.log('📂 No existing reservations file, starting fresh');
            return new Map();
        }
    }

    // REQUEST QUEUES PERSISTENCE (simplified - only metadata)
    async saveQueueMetadata(userQueues: Map<string, any[]>, processing: Set<string>): Promise<void> {
        const data = {
            queueSizes: Object.fromEntries(
                Array.from(userQueues.entries()).map(([user, queue]) => [user, queue.length])
            ),
            processingUsers: Array.from(processing),
            timestamp: Date.now()
        };
        this.scheduleWrite(this.QUEUES_FILE, data);
    }

    async loadQueueMetadata(): Promise<{ queueSizes: Record<string, number>; processingUsers: string[] }> {
        try {
            const data = await fs.readFile(this.QUEUES_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            
            console.log(`📂 Loaded queue metadata: ${Object.keys(parsed.queueSizes || {}).length} users`);
            return {
                queueSizes: parsed.queueSizes || {},
                processingUsers: parsed.processingUsers || []
            };
        } catch (error) {
            console.log('📂 No existing queue file, starting fresh');
            return { queueSizes: {}, processingUsers: [] };
        }
    }

    // DEDUPLICATION CACHE PERSISTENCE
    async saveDedupCache(recentRequests: Map<string, any>): Promise<void> {
        const now = Date.now();
        const validEntries = new Map();

        // Only save non-expired entries
        for (const [key, value] of recentRequests) {
            if (value.timestamp && (now - value.timestamp) < 30000) { // 30 second window
                validEntries.set(key, value);
            }
        }

        const data = {
            recentRequests: Object.fromEntries(validEntries),
            timestamp: now,
            count: validEntries.size
        };
        
        this.scheduleWrite(this.DEDUP_FILE, data);
    }

    async loadDedupCache(): Promise<Map<string, any>> {
        try {
            const data = await fs.readFile(this.DEDUP_FILE, 'utf-8');
            const parsed = JSON.parse(data);
            
            const cacheMap = new Map();
            const now = Date.now();
            let validCount = 0;
            let expiredCount = 0;

            // Only load non-expired cache entries
            for (const [key, value] of Object.entries(parsed.recentRequests || {})) {
                const entry = value as any;
                if (entry.timestamp && (now - entry.timestamp) < 30000) {
                    cacheMap.set(key, entry);
                    validCount++;
                } else {
                    expiredCount++;
                }
            }

            console.log(`📂 Loaded ${validCount} valid cache entries, skipped ${expiredCount} expired`);
            return cacheMap;
        } catch (error) {
            console.log('📂 No existing dedup cache file, starting fresh');
            return new Map();
        }
    }

    // Cleanup - force write all pending data
    async flush(): Promise<void> {
        // Clear all timeouts and write immediately
        for (const [file, timeout] of this.writeTimeouts) {
            clearTimeout(timeout);
        }
        this.writeTimeouts.clear();
        console.log('💾 Flushed all pending writes to disk');
    }

    // Get storage stats
    async getStorageStats(): Promise<{
        reservationsSize: number;
        queuesSize: number;
        dedupSize: number;
        totalSize: number;
    }> {
        const getFileSize = async (file: string): Promise<number> => {
            try {
                const stats = await fs.stat(file);
                return stats.size;
            } catch {
                return 0;
            }
        };

        const reservationsSize = await getFileSize(this.RESERVATIONS_FILE);
        const queuesSize = await getFileSize(this.QUEUES_FILE);
        const dedupSize = await getFileSize(this.DEDUP_FILE);

        return {
            reservationsSize,
            queuesSize,
            dedupSize,
            totalSize: reservationsSize + queuesSize + dedupSize
        };
    }

    // Cleanup old files (optional)
    async cleanup(): Promise<void> {
        try {
            const files = [this.RESERVATIONS_FILE, this.QUEUES_FILE, this.DEDUP_FILE];
            for (const file of files) {
                try {
                    await fs.unlink(file);
                    console.log(`🗑️ Cleaned up ${path.basename(file)}`);
                } catch {
                    // File doesn't exist, that's fine
                }
            }
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }
}

export const persistentStorage = new PersistentStorage();

// Graceful shutdown handler
process.on('SIGINT', async () => {
    console.log('🛑 Graceful shutdown initiated...');
    await persistentStorage.flush();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('🛑 Graceful shutdown initiated...');
    await persistentStorage.flush();
    process.exit(0);
});
