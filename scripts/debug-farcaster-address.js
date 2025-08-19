import { ethers } from 'ethers';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Test what address the bot would see for a user
async function debugFarcasterAddress(fid) {
    try {
        console.log(`🔍 Debugging FID: ${fid}`);
        
        // Call our bot endpoint to simulate checking this user
        const response = await fetch(`http://localhost:3001/api/user-conversations?fid=${fid}`);
        const data = await response.json();
        
        console.log('User data from bot perspective:', data);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

const fid = process.argv[2];
if (!fid) {
    console.log('Usage: node debug-farcaster-address.js <your-fid>');
    console.log('Example: node debug-farcaster-address.js 123456');
    console.log('Find your FID on Warpcast profile or https://fnames.xyz');
} else {
    debugFarcasterAddress(fid);
}
