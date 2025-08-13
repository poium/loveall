require('dotenv').config();
const { NeynarAPIClient, Configuration } = require('@neynar/nodejs-sdk');

async function testNeynarMethods() {
    console.log('🔍 Exploring Neynar SDK methods...\n');
    
    const config = new Configuration({
        apiKey: process.env.NEYNAR_API_KEY,
        baseOptions: {
            headers: {
                "x-neynar-experimental": true,
            },
        },
    });
    const neynar = new NeynarAPIClient(config);
    
    console.log('Available methods on neynar client:');
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(neynar)).filter(name => name !== 'constructor'));
    
    console.log('\nTrying to get user info...');
    try {
        // Try different method names
        const methods = ['lookupUserByFid', 'getUserByFid', 'user', 'lookupUser'];
        
        for (const method of methods) {
            if (typeof neynar[method] === 'function') {
                console.log(`✅ Method ${method} exists`);
                try {
                    const result = await neynar[method](parseInt(process.env.NEYNAR_CLIENT_ID));
                    console.log(`   Result:`, result);
                    break;
                } catch (error) {
                    console.log(`   Error with ${method}:`, error.message);
                }
            } else {
                console.log(`❌ Method ${method} does not exist`);
            }
        }
    } catch (error) {
        console.log('Error:', error.message);
    }
}

testNeynarMethods().catch(console.error);
