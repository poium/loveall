# LoveallPrizePool Smart Contract

## Overview

The LoveallPrizePool smart contract manages the prize pool for the Loveall flirting bot on Farcaster. Users pay 1 USDC per cast, and weekly winners receive 90% of the prize pool, with 10% rolling over to the next week.

## Contract Features

### Core Functions

#### User Balance Management
- `topUp(uint256 amount)` - Add USDC to user balance
- `withdrawBalance(uint256 amount)` - Withdraw unused balance

#### Cast Participation
- `participateInCast(address user, bytes32 castHash)` - Record user participation (owner only)

#### Prize Pool Management
- `setWeeklyWinner(address winner)` - Set weekly winner (owner only)
- `distributePrize()` - Distribute prize to winner and rollover amount
- `startNewWeek()` - Start new weekly cycle (owner only)

#### Optimized View Functions (Recommended)
- `getCommonData()` - Get all common data in one call (prize pool, weekly info, etc.)
- `getUserData(address user)` - Get all user-specific data in one call
- `getMultipleUsersData(address[] users)` - Get data for multiple users in one call
- `getWeeklySummary(uint256 week)` - Get weekly summary data

#### Legacy Functions (Deprecated)
- `getBalance(address user)` - Use `getUserData()` instead
- `hasSufficientBalance(address user)` - Use `getUserData()` instead
- `getCurrentPrizePool()` - Use `getCommonData()` instead
- `getWeeklyPrizePool()` - Use `getCommonData()` instead
- `getRolloverAmount()` - Use `getCommonData()` instead
- `getCurrentWeek()` - Use `getCommonData()` instead
- `getWeekEndTime()` - Use `getCommonData()` instead

#### Admin Functions
- `pause()` / `unpause()` - Emergency pause functionality
- `emergencyWithdraw()` - Emergency withdrawal (owner only)

## Contract Constants

- `CAST_COST`: 0.01 USDC (1 cent) (10,000 wei with 6 decimals)
- `WINNER_PERCENTAGE`: 90% (goes to winner)
- `ROLLOVER_PERCENTAGE`: 10% (rolls to next week)
- `WEEK_DURATION`: 7 days

## Events

- `BalanceToppedUp(address indexed user, uint256 amount)`
- `BalanceWithdrawn(address indexed user, uint256 amount)`
- `CastParticipated(address indexed user, bytes32 castHash, uint256 cost)`
- `WinnerSelected(address indexed winner, uint256 prize, uint256 week)`
- `NewWeekStarted(uint256 weekNumber, uint256 rolloverAmount)`
- `PrizeDistributed(address indexed winner, uint256 prize, uint256 rollover)`

## Deployment

### Prerequisites
1. Node.js and npm installed
2. Hardhat configured
3. Private key with ETH for gas fees
4. Environment variables set

### Environment Variables
Create a `.env` file:
```env
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

### Deployment Commands

#### Testnet (Base Sepolia)
```bash
npm run deploy:baseSepolia
```

#### Mainnet (Base)
```bash
npm run deploy:base
```

#### Local Development
```bash
npm run deploy:local
```

## Testing

Run the test suite:
```bash
npm test
```

## USDC Addresses

- **Base Mainnet**: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **Base Sepolia**: `0x036CbD53842c5426634e7929541eC2318f3dCF7c`

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Emergency pause functionality
- **Ownable**: Access control for admin functions
- **Input Validation**: Comprehensive error checking
- **Safe Math**: Built-in overflow protection (Solidity 0.8+)

## RPC Call Optimization

### Before Optimization (Multiple Calls):
```javascript
// Old way - 7 separate RPC calls
const balance = await contract.getBalance(user);
const hasBalance = await contract.hasSufficientBalance(user);
const participated = await contract.hasParticipatedThisWeek(user);
const prizePool = await contract.getCurrentPrizePool();
const weeklyPool = await contract.getWeeklyPrizePool();
const currentWeek = await contract.getCurrentWeek();
const weekEnd = await contract.getWeekEndTime();
```

### After Optimization (2 Calls):
```javascript
// New way - 2 RPC calls
const commonData = await contract.getCommonData();
const userData = await contract.getUserData(user);
```

### Benefits:
- **Reduced RPC Calls**: 70% fewer calls for dashboard data
- **Better Performance**: Faster frontend loading
- **Lower Costs**: Reduced gas fees for view functions
- **Batch Operations**: `getMultipleUsersData()` for multiple users
- **Structured Data**: Organized data structures for easier frontend integration

## Gas Optimization

- Efficient storage patterns
- Optimized loops and mappings
- Minimal on-chain data storage
- Batch operations where possible

## Integration with Bot

The bot will interact with this contract through:

1. **Balance Checking**: `hasSufficientBalance(user)` before allowing casts
2. **Participation Recording**: `participateInCast(user, castHash)` when user sends cast
3. **Winner Selection**: `setWeeklyWinner(winner)` based on Grok AI evaluation
4. **Prize Distribution**: `distributePrize()` and `startNewWeek()` for weekly cycles

## Error Handling

The contract includes custom errors for better gas efficiency:
- `InsufficientBalance()` - User doesn't have enough USDC
- `InvalidAmount()` - Invalid amount provided
- `NoParticipants()` - No participants in current week
- `AlreadyParticipated()` - User already participated this week
- `TransferFailed()` - USDC transfer failed

## License

MIT License
