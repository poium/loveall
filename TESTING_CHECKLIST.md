# 🧪 LoveallPrizePool Testing Checklist

## ✅ **Completed Tests** (No Private Key Required)

### 1. Contract Connection ✅
- [x] Contract deployed at: `0x713DFCCE37f184a2aB3264D6DA5094Eae5F33dFa`
- [x] Basic contract reads working
- [x] Owner verification: `0x462752537CcE212d278DBD361DA67e25C2908938`

### 2. Character System ✅
- [x] Jordan Belfort character set with 5 traits
- [x] Character API endpoint working: `/api/character-data`
- [x] Character traits properly configured

### 3. Frontend Integration ✅
- [x] Next.js dev server running on `localhost:3000`
- [x] Health check endpoint: `/api/health`
- [x] Prize data endpoint: `/api/prize-data`
- [x] Character data endpoint: `/api/character-data`

---

## 🔒 **Tests Requiring Private Key**

### 4. Character Management
```bash
# Set private key safely:
export PRIVATE_KEY="your_key_here"

# Test character management:
cd scripts
node manage-character.js current
node manage-character.js list
node manage-character.js set casanova  # Try different character
```

### 5. Conversation Management
```bash
# Test conversation functions:
node manage-conversations.js stats
node manage-conversations.js unevaluated
```

### 6. Admin Functions (Owner Only)
```bash
# If you're the contract owner:
node manage-character.js set ryan-gosling
node manage-conversations.js winner  # After evaluations
```

---

## 💰 **Tests Requiring USDC Balance**

### 7. User Participation Flow
1. **Top Up Balance:**
   - Connect wallet to frontend
   - Go to user dashboard
   - Click "Top Up Balance"
   - Add USDC (minimum 0.01)

2. **Test Conversation Recording:**
   - Bot needs to call `recordCompleteConversation`
   - Requires bot integration with Farcaster

### 8. Full Prize Pool Cycle
1. Users participate (costs 0.01 USDC each)
2. AI evaluates conversations
3. Admin selects winner by AI score
4. Distribute prizes
5. Start new week

---

## 🤖 **Bot Integration Tests**

### 9. Farcaster Bot Testing
1. **Mention Bot:** `@loveall` on Farcaster
2. **Check Conversation Recording:**
   ```bash
   node manage-conversations.js stats
   ```
3. **Monitor Events:**
   ```bash
   curl "http://localhost:3000/api/blockchain-events"
   ```

### 10. AI Evaluation Flow
1. **Get Unevaluated:**
   ```bash
   node manage-conversations.js unevaluated
   ```
2. **Run AI Evaluation** (external AI service)
3. **Record Top Scores:**
   ```bash
   # Create top-scores.json with evaluation results
   node manage-conversations.js top-scores ./top-scores.json
   ```

---

## 🌐 **Frontend Dashboard Tests**

### 11. User Dashboard (`http://localhost:3000`)
- [ ] View prize pool data
- [ ] View current character
- [ ] Connect wallet (Rainbow/WalletConnect)
- [ ] Check user balance
- [ ] Top up USDC balance
- [ ] View participation history

### 12. Admin Dashboard (Owner wallet required)
- [ ] View admin statistics
- [ ] AI evaluation interface
- [ ] Winner selection
- [ ] Prize distribution
- [ ] New week management
- [ ] Character management

---

## 📊 **API Endpoint Tests**

### 13. All API Routes
```bash
# Test all endpoints:
curl "http://localhost:3000/api/health"
curl "http://localhost:3000/api/prize-data"
curl "http://localhost:3000/api/character-data"
curl "http://localhost:3000/api/admin-data"
curl "http://localhost:3000/api/blockchain-events"
curl "http://localhost:3000/api/conversations"
curl "http://localhost:3000/api/weekly-winners"
```

---

## 🚀 **Production Readiness Tests**

### 14. Performance Tests
- [ ] Load testing with multiple users
- [ ] Gas optimization verification
- [ ] RPC endpoint reliability
- [ ] Frontend responsiveness

### 15. Security Tests
- [ ] Contract owner functions protected
- [ ] User balance validation
- [ ] Reentrancy protection
- [ ] Input validation

### 16. Error Handling
- [ ] Insufficient balance scenarios
- [ ] Network connection issues
- [ ] Invalid inputs
- [ ] Contract paused state

---

## 🎯 **Immediate Next Steps**

1. **Safe Private Key Setup:**
   ```bash
   cd /Users/gm/Desktop/loveall/app/loveall
   echo "PRIVATE_KEY=your_key_here" >> .env
   echo "BASE_RPC_URL=https://mainnet.base.org" >> .env
   ```

2. **Test Character Management:**
   ```bash
   cd scripts
   node manage-character.js current
   ```

3. **Test Frontend:**
   - Visit `http://localhost:3000`
   - Test wallet connection
   - Verify contract data display

4. **Bot Integration:**
   - Test Farcaster mention handling
   - Verify conversation recording

Would you like to proceed with any specific test once you've safely set up your private key?
