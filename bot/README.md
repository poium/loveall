# 🤖 Loveall Bot

The Loveall flirting bot for Farcaster that manages the weekly prize pool competition.

## 🚀 Features

- **Farcaster Integration**: Monitors for @loveall mentions
- **Smart Contract Integration**: Records participations and manages prize pool
- **AI Evaluation**: Uses Grok API to evaluate cast quality
- **Weekly Winner Selection**: Automatically selects and announces winners
- **Flirty Responses**: Generates fun, witty responses to users

## 📋 Prerequisites

- Node.js (v18 or higher)
- Neynar API credentials
- Grok API credentials
- Deployed LoveallPrizePool contract

## 🛠️ Installation

1. **Install dependencies:**
```bash
cd bot
npm install
```

2. **Set up environment variables** (already done in parent directory):
```bash
# .env file should contain:
NEYNAR_CLIENT_ID=your_client_id
NEYNAR_API_KEY=your_api_key
NEYNAR_SIGNER_UUID=your_signer_uuid
GROK_API_KEY=your_grok_api_key
PRIVATE_KEY=your_private_key
BASE_RPC_URL=https://mainnet.base.org
```

## 🎯 Usage

### Start the Bot
```bash
npm start
```

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Run Weekly Winner Selection
```bash
node weekly-winner.js
```

## 🔧 Configuration

### Bot Settings
- **Monitoring Interval**: 30 seconds
- **Cast Cost**: 1 cent (0.01 USDC)
- **Weekly Duration**: 2 hours (for testing)
- **Prize Distribution**: 90% winner, 10% rollover

### Response Messages
The bot generates random flirty responses from predefined sets:
- **Successful Participation**: 10 different flirty responses
- **Insufficient Balance**: 5 different reminder messages
- **Already Participated**: 5 different "try again next week" messages

## 📊 Bot Workflow

### 1. Mention Monitoring
- Bot checks for @loveall mentions every 30 seconds
- Processes mentions in chronological order
- Skips already processed mentions

### 2. User Validation
- Checks if user has verified wallet address
- Validates user balance in contract
- Checks if user already participated this week

### 3. Participation Recording
- Records participation in smart contract
- Deducts 1 cent from user balance
- Adds 1 cent to weekly prize pool

### 4. Response Generation
- Generates appropriate response based on user status
- Posts reply to original cast
- Logs all actions for monitoring

## 🏆 Weekly Winner Selection

### Process
1. **Get Participants**: Retrieves all participants for current week
2. **Fetch Cast Content**: Gets original cast content from Farcaster
3. **AI Evaluation**: Uses Grok API to score each cast
4. **Winner Selection**: Selects participant with highest score
5. **Prize Distribution**: Distributes 90% of pool to winner
6. **New Week**: Starts new weekly cycle
7. **Announcement**: Posts winner announcement on Farcaster

### Running Winner Selection
```bash
# Manual execution
node weekly-winner.js

# Or integrate with cron job for automatic execution
# 0 */2 * * * cd /path/to/bot && node weekly-winner.js
```

## 🔍 Monitoring

### Logs
The bot provides detailed logging:
- ✅ Successful operations
- ❌ Error messages
- 📨 Mention processing
- 💬 Response generation
- 💰 Contract interactions

### Key Metrics
- Mentions processed per hour
- Participation success rate
- Contract transaction success rate
- Response time

## 🛡️ Security

### Access Control
- Only contract owner can record participations
- Only contract owner can select winners
- Private keys stored securely in environment variables

### Error Handling
- Graceful handling of API failures
- Retry logic for failed transactions
- Comprehensive error logging

## 🔧 Troubleshooting

### Common Issues

1. **"User has no verified account"**
   - User needs to connect wallet to Farcaster account
   - Bot can only process users with verified addresses

2. **"Could not get user data"**
   - Check contract connection
   - Verify RPC URL and network connectivity

3. **"Failed to record participation"**
   - Check gas fees and wallet balance
   - Verify contract permissions

4. **"Error replying to cast"**
   - Check Neynar API credentials
   - Verify signer UUID is valid

### Debug Mode
Enable detailed logging by setting:
```bash
DEBUG=true npm start
```

## 📈 Performance

### Optimization
- Efficient mention processing (skips duplicates)
- Optimized contract calls (uses view functions)
- Minimal API calls to Neynar

### Scalability
- Can handle multiple mentions per minute
- Efficient memory usage
- Graceful handling of high load

## 🔄 Updates

### Adding New Responses
Edit the response arrays in `loveall-bot.js`:
```javascript
generateFlirtyResponse() {
    const responses = [
        "Your new response here! 😊",
        // ... existing responses
    ];
    return responses[Math.floor(Math.random() * responses.length)];
}
```

### Modifying Evaluation Criteria
Update the Grok API prompt in `weekly-winner.js`:
```javascript
const prompt = `Your new evaluation criteria here...`;
```

## 📞 Support

For issues or questions:
1. Check the logs for error messages
2. Verify all environment variables are set
3. Test contract connectivity
4. Check Neynar API status

## 🎉 Success Metrics

- **User Engagement**: Number of mentions per day
- **Participation Rate**: Successful participations vs attempts
- **Prize Pool Growth**: Weekly pool amounts
- **User Satisfaction**: Response quality and engagement

---

**Happy Flirting! 💕**
