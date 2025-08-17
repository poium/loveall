# Base Mainnet Deployment Configuration

## 🚀 Optimized for Base's Ultra-Low Gas Fees

**Current Base Gas Prices (2025-08-17):**
- Fast: 0.0003 Gwei (15 seconds) - $0.000026
- **Normal: 0.0003 Gwei (1 minute) - $0.000025** ← Using this
- Slow: 0.0003 Gwei (3 minutes) - $0.000025

## 📋 Environment Variables Needed

Create `.env` file with:
```bash
# Base Mainnet RPC
BASE_RPC_URL=https://mainnet.base.org

# Wallet Private Keys (KEEP SECURE!)
DEPLOYER_PRIVATE_KEY=your_deployment_wallet_private_key
PRIVATE_KEY=your_bot_wallet_private_key
BOT_OWNER_ADDRESS=your_bot_wallet_address

# API Keys
NEYNAR_API_KEY=your_neynar_api_key
BASESCAN_API_KEY=your_basescan_api_key

# Base Contract Addresses
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

## 💰 Estimated Deployment Costs

With 0.0003 Gwei gas price:
```bash
Contract Deployment:
- Gas needed: ~3-5M gas
- Cost: ~0.0009-0.0015 ETH
- USD cost: ~$0.002-0.003 (at $2000 ETH)

Initial Setup (set character, etc):
- Gas needed: ~500k gas per function
- Cost: ~0.00015 ETH per function
- USD cost: ~$0.0003 per function

Total recommended: 0.005 ETH (~$10) for deployment + initial setup
```

## 🔧 Deployment Commands

### 1. Compile Contract
```bash
npx hardhat compile
```

### 2. Deploy to Base Mainnet
```bash
npx hardhat run scripts/deploy-base-mainnet.js --network base --config hardhat.config.base.js
```

### 3. Verify on Basescan (automatic in script)
```bash
# If manual verification needed:
npx hardhat verify --network base CONTRACT_ADDRESS "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" "BOT_OWNER_ADDRESS"
```

## 📊 Post-Deployment Setup

### 1. Set Initial Character
```javascript
await contract.setWeeklyCharacter(
  "Jordan Belfort",
  "Try selling this pen to me using your best sales techniques",
  ["Persuasiveness", "Aggressiveness", "Charisma", "Persistence", "Confidence"],
  [9, 8, 7, 9, 8],
  5
);
```

### 2. Verify Cast Cost
```javascript
const commonData = await contract.getCommonData();
console.log("Cast cost:", ethers.formatUnits(commonData.castCost, 6), "USDC");
// Should be 0.01 USDC by default
```

### 3. Update Bot Configuration
```javascript
// Update src/app/api/bot-new/mention/route.ts
const CONTRACT_ADDRESS = 'YOUR_DEPLOYED_CONTRACT_ADDRESS';
```

## ✅ Pre-Deployment Checklist

- [ ] Deployment wallet has 0.005+ ETH on Base
- [ ] Bot wallet address set correctly in BOT_OWNER_ADDRESS
- [ ] All environment variables configured
- [ ] Contract compiles without errors
- [ ] Base RPC endpoint working
- [ ] Basescan API key configured for verification

## 🎯 Expected Output

```bash
🚀 Deploying LoveallPrizePool to Base Mainnet...
⛽ Using Base optimized gas settings: 0.0003 Gwei (normal)
📝 Deploying with account: 0x...
💰 Account balance: 0.01 ETH
📊 Network gas price: 0.0003 Gwei
🎯 Using gas price: 0.0003 Gwei
🔨 Deploying contract...
⏳ Waiting for deployment transaction...
✅ LoveallPrizePool deployed to: 0x...
📊 Deployment TX: 0x...
⛽ Gas used: 3456789
💸 Deployment cost: 0.001037 ETH (~$2.074)
⏳ Waiting for 5 block confirmations...
🔍 Verifying contract on Basescan...
✅ Contract verified successfully!
🌐 View on Basescan: https://basescan.org/address/0x...

🧪 Testing basic contract functions...
✅ getCommonData() working - Current week: 1
✅ Cast cost: 0.01 USDC
✅ Contract owner: 0x...
✅ Owner matches bot address: true

📋 Deployment Summary:
{
  "network": "base-mainnet",
  "contractAddress": "0x...",
  "usdcAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "ownerAddress": "0x...",
  "gasPrice": "0.0003 Gwei",
  "deploymentCost": "0.001037 ETH",
  "basescanUrl": "https://basescan.org/address/0x..."
}

🎯 Next Steps:
1. Update bot config with contract address
2. Set initial weekly character
3. Test bot integration
4. Fund bot wallet for operations
```

## 🚨 Important Notes

### Gas Optimization Benefits
- **Base fees are 99.97% cheaper than Ethereum mainnet**
- **0.0003 Gwei = $0.000025 per transaction**
- **Perfect for high-frequency bot operations**

### Security Reminders
- Keep private keys secure and never commit to git
- Use separate wallets for deployment vs operations
- Start with small test amounts
- Monitor contract after deployment

### Base Network Advantages
- **Lightning fast**: 2-second block times
- **Ultra cheap**: 0.0003 Gwei gas
- **Ethereum compatible**: Same tools and libraries
- **Coinbase backed**: Strong ecosystem support

Ready to deploy with these optimized settings! 🚀
