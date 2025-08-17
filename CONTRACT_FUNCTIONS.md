# LoveallPrizePool Contract Functions Documentation

## 📋 Contract Overview

**Contract:** LoveallPrizePool  
**Version:** v1.0  
**Functions:** 19 external functions  
**Purpose:** Dynamic AI character-based prize pool system for Farcaster flirting bot

---

## 🎯 Function Categories

### 💰 [User Balance Functions](#user-balance-functions) (3)
### 🎮 [Participation Functions](#participation-functions) (1)  
### 🤖 [AI Evaluation Functions](#ai-evaluation-functions) (1)
### 🏆 [Winner & Prize Functions](#winner--prize-functions) (3)
### 🎭 [AI Character Functions](#ai-character-functions) (3)
### 📊 [Data Access Functions](#data-access-functions) (5)
### 👤 [User Data Functions](#user-data-functions) (2)
### 🔧 [Admin Functions](#admin-functions) (4)

---

## 💰 User Balance Functions

### 1. `topUp(uint256 amount)`

**Purpose:** Add USDC to user's balance for participating in casts  
**Access:** Public (anyone can call)  
**Modifiers:** `whenNotPaused`, `nonReentrant`

**Inputs:**
- `amount` (uint256): Amount of USDC to add to balance (in 6 decimals)

**Outputs:** None

**Events Emitted:**
- `BalanceToppedUp(address indexed user, uint256 amount)`

**Usage Example:**
```javascript
// Add 10 USDC to user balance
await contract.topUp(10000000); // 10 USDC (6 decimals)
```

---

### 2. `withdrawBalance(uint256 amount)`

**Purpose:** Withdraw unused USDC balance from the contract  
**Access:** Public (users can withdraw their own balance)  
**Modifiers:** `whenNotPaused`, `nonReentrant`

**Inputs:**
- `amount` (uint256): Amount of USDC to withdraw (must be ≤ user balance)

**Outputs:** None

**Events Emitted:**
- `BalanceWithdrawn(address indexed user, uint256 amount)`

**Usage Example:**
```javascript
// Withdraw 5 USDC from balance
await contract.withdrawBalance(5000000); // 5 USDC (6 decimals)
```

---

### 3. `contributeToPrizePool(uint256 amount)`

**Purpose:** Contribute USDC directly to the current week's prize pool  
**Access:** Public (anyone can contribute)  
**Modifiers:** `whenNotPaused`, `nonReentrant`

**Inputs:**
- `amount` (uint256): Amount of USDC to contribute to prize pool

**Outputs:** None

**Events Emitted:**
- `PrizePoolContribution(address indexed contributor, uint256 amount)`

**Usage Example:**
```javascript
// Contribute 50 USDC to prize pool
await contract.contributeToPrizePool(50000000); // 50 USDC (6 decimals)
```

---

## 🎮 Participation Functions

### 4. `participateInCast(address user, uint256 fid, bytes32 castHash, bytes32 conversationId, string castContent)`

**Purpose:** Record user participation in a cast (called by bot)  
**Access:** Owner only  
**Modifiers:** `whenNotPaused`, `onlyOwner`

**Inputs:**
- `user` (address): User's wallet address (original cast author)
- `fid` (uint256): User's Farcaster ID
- `castHash` (bytes32): Real cast hash from Farcaster
- `conversationId` (bytes32): Conversation/thread ID (derived from original cast)
- `castContent` (string): Content of the cast (emitted in event for off-chain storage)

**Outputs:** None

**Events Emitted:**
- `CastParticipated(address indexed user, uint256 fid, bytes32 castHash, bytes32 conversationId, uint256 cost, string castContent)`

**Usage Example:**
```javascript
// Bot records user participation
await contract.participateInCast(
    "0x742d35Cc6634C0532925a3b8D6f9C0d53e3678c0",
    12345,
    "0x1234567890abcdef...",
    "0xabcdef1234567890...",
    "Hey there, how's your day going?"
);
```

---

## 🤖 AI Evaluation Functions

### 5. `recordTopAIScores(address[] topUsers, bytes32[] topConversationIds, uint256[] topAiScores, uint256 totalEvaluated)`

**Purpose:** Record AI evaluation scores for top conversations (cost-efficient batch upload)  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:**
- `topUsers` (address[]): Array of user addresses (top performers, max 10)
- `topConversationIds` (bytes32[]): Array of conversation IDs (matching topUsers)
- `topAiScores` (uint256[]): Array of AI scores (0-50 scale, matching topUsers)
- `totalEvaluated` (uint256): Total number of conversations evaluated by AI

**Outputs:** None

**Events Emitted:**
- `AIEvaluationCompleted(address indexed user, uint256 fid, bytes32 conversationId, uint256 aiScore)` (for each top user)
- `TopScoresRecorded(uint256 totalEvaluated, uint256 topScoresCount)`

**Usage Example:**
```javascript
// Upload top 3 AI scores after evaluating 100 conversations
await contract.recordTopAIScores(
    ["0x742d35Cc...", "0x123456Ab...", "0x987654Cd..."],
    ["0xconv1...", "0xconv2...", "0xconv3..."],
    [48, 45, 42], // AI scores out of 50
    100 // Total conversations evaluated
);
```

---

## 🏆 Winner & Prize Functions

### 6. `selectWinnerByAIScore()`

**Purpose:** Automatically select weekly winner based on highest AI score  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:** None

**Outputs:** None

**Events Emitted:**
- `WinnerSelected(address indexed winner, uint256 prize, uint256 week)`

**Usage Example:**
```javascript
// Select winner based on AI scores
await contract.selectWinnerByAIScore();
```

---

### 7. `distributePrize()`

**Purpose:** Distribute prize pool (80% winner, 10% rollover, 10% protocol fee)  
**Access:** Owner only  
**Modifiers:** `onlyOwner`, `nonReentrant`

**Inputs:** None

**Outputs:** None

**Events Emitted:**
- `PrizeDistributed(address indexed winner, uint256 prize, uint256 rollover, uint256 protocolFee)`

**Usage Example:**
```javascript
// Distribute prizes for current week
await contract.distributePrize();
```

---

### 8. `startNewWeek()`

**Purpose:** Start a new weekly cycle (increments week, adds rollover)  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:** None

**Outputs:** None

**Events Emitted:**
- `NewWeekStarted(uint256 weekNumber, uint256 rolloverAmount)`

**Usage Example:**
```javascript
// Start new week
await contract.startNewWeek();
```

---

## 🎭 AI Character Functions

### 9. `setWeeklyCharacter(string name, string task, string[5] traitNames, uint8[5] traitValues, uint8 traitCount)`

**Purpose:** Set AI character for current week with custom traits  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:**
- `name` (string): Character name (e.g., "Jordan Belfort")
- `task` (string): Character task/challenge (max 255 characters)
- `traitNames` (string[5]): Array of trait names (e.g., ["Persuasiveness", "Charisma", ...])
- `traitValues` (uint8[5]): Array of trait values (1-10 scale, matching traitNames)
- `traitCount` (uint8): Number of active traits (1-5)

**Outputs:** None

**Events Emitted:**
- `CharacterSet(uint256 indexed week, string name, string task, uint8 traitCount)`

**Usage Example:**
```javascript
// Set Jordan Belfort sales character
await contract.setWeeklyCharacter(
    "Jordan Belfort",
    "Try selling this pen to me using your best sales techniques",
    ["Persuasiveness", "Aggressiveness", "Charisma", "Persistence", "Confidence"],
    [9, 8, 7, 9, 8],
    5
);
```

---

### 10. `getCurrentCharacter()`

**Purpose:** Get current week's AI character details  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:** None

**Outputs:**
- `name` (string): Character name
- `task` (string): Character task/challenge
- `traitNames` (string[5]): Array of trait names
- `traitValues` (uint8[5]): Array of trait values (1-10)
- `traitCount` (uint8): Number of active traits
- `isSet` (bool): Whether character has been set for current week

**Usage Example:**
```javascript
const character = await contract.getCurrentCharacter();
console.log(`This week: ${character.name}`);
console.log(`Task: ${character.task}`);
console.log(`Traits: ${character.traitNames.slice(0, character.traitCount)}`);
```

---

### 11. `getWeeklyCharacter(uint256 week)`

**Purpose:** Get AI character details for specific week  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:**
- `week` (uint256): Week number to get character for

**Outputs:**
- `name` (string): Character name
- `task` (string): Character task/challenge  
- `traitNames` (string[5]): Array of trait names
- `traitValues` (uint8[5]): Array of trait values (1-10)
- `traitCount` (uint8): Number of active traits
- `isSet` (bool): Whether character was set for that week

**Usage Example:**
```javascript
// Get character from week 5
const character = await contract.getWeeklyCharacter(5);
console.log(`Week 5 character: ${character.name}`);
```

---

## 📊 Data Access Functions

### 12. `getCurrentWeekParticipations()`

**Purpose:** Get all cast participations for current week  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:** None

**Outputs:**
- `participations` (CastParticipation[]): Array of all participation structs for current week

**CastParticipation Struct:**
```solidity
struct CastParticipation {
    address user;           // User address
    uint256 fid;           // Farcaster ID
    bytes32 castHash;      // Cast hash
    bytes32 conversationId; // Conversation ID
    uint256 timestamp;     // Participation timestamp
    uint256 weekNumber;    // Week number
    uint256 usdcAmount;    // USDC amount paid (0.01)
    uint256 aiScore;       // AI score (0-50)
    bool isEvaluated;      // Whether AI evaluated
}
```

**Usage Example:**
```javascript
const participations = await contract.getCurrentWeekParticipations();
console.log(`Current week has ${participations.length} participations`);
```

---

### 13. `getUnevaluatedConversationsForAI()`

**Purpose:** Get all conversations that need AI evaluation for batch processing  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:** None

**Outputs:**
- `conversationIds` (bytes32[]): Array of conversation IDs needing evaluation
- `users` (address[]): Array of user addresses (matching conversationIds)
- `fids` (uint256[]): Array of Farcaster IDs (matching conversationIds)

**Usage Example:**
```javascript
const [conversationIds, users, fids] = await contract.getUnevaluatedConversationsForAI();
console.log(`${conversationIds.length} conversations need AI evaluation`);
```

---

### 14. `getConversationParticipations(bytes32 conversationId)`

**Purpose:** Get all cast participations for a specific conversation  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:**
- `conversationId` (bytes32): Conversation ID to get participations for

**Outputs:**
- `participations` (CastParticipation[]): Array of all casts in the conversation

**Usage Example:**
```javascript
const participations = await contract.getConversationParticipations("0xconv123...");
console.log(`Conversation has ${participations.length} casts`);
```

---

### 15. `getWeeklySummary(uint256 week)`

**Purpose:** Get summary data for a specific week  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:**
- `week` (uint256): Week number to get summary for

**Outputs:**
- `participants` (address[]): Array of all participants in that week
- `winner` (address): Winner address (address(0) if no winner)
- `prize` (uint256): Prize amount for winner
- `participantsCount` (uint256): Number of participants

**Usage Example:**
```javascript
const [participants, winner, prize, count] = await contract.getWeeklySummary(5);
console.log(`Week 5: ${count} participants, winner: ${winner}, prize: ${prize}`);
```

---

### 16. `getCommonData()`

**Purpose:** Get all common contract data in one call (optimized for frontend)  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:** None

**Outputs:**
- `CommonData` struct with following fields:
  - `totalPrizePool` (uint256): Total accumulated prize pool
  - `currentWeekPrizePool` (uint256): Current week's prize pool
  - `rolloverAmount` (uint256): Amount to rollover to next week
  - `totalContributions` (uint256): Total community contributions
  - `totalProtocolFees` (uint256): Total protocol fees collected
  - `castCost` (uint256): Current cost per cast in USDC (6 decimals)
  - `currentWeek` (uint256): Current week number
  - `weekStartTime` (uint256): Current week start timestamp
  - `weekEndTime` (uint256): Current week end timestamp
  - `currentWeekParticipantsCount` (uint256): Number of participants this week
  - `currentWeekWinner` (address): Current week winner (if selected)
  - `currentWeekPrize` (uint256): Current week prize amount
  - `characterName` (string): Current week character name
  - `characterTask` (string): Current week character task
  - `characterIsSet` (bool): Whether character is set for current week

**Usage Example:**
```javascript
const data = await contract.getCommonData();
console.log(`Week ${data.currentWeek}: ${data.currentWeekPrizePool} USDC pool`);
console.log(`Character: ${data.characterName} - ${data.characterTask}`);
```

---

## 👤 User Data Functions

### 17. `getUserData(address user)`

**Purpose:** Get comprehensive user data in one call  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:**
- `user` (address): User address to get data for

**Outputs:**
- `UserData` struct with following fields:
  - `balance` (uint256): User's USDC balance
  - `hasSufficientBalance` (bool): Whether user can afford next cast (≥0.01 USDC)
  - `hasParticipatedThisWeek` (bool): Whether user participated this week
  - `participationsCount` (uint256): Number of participations this week
  - `conversationCount` (uint256): Number of conversations started this week
  - `remainingConversations` (uint256): Remaining conversation slots (max 3)
  - `bestScore` (uint256): User's highest AI score this week
  - `bestConversationId` (bytes32): Conversation ID with highest score
  - `totalContributions` (uint256): Total USDC contributed to prize pools
  - `participations` (CastParticipation[]): All user's participations this week

**Usage Example:**
```javascript
const userData = await contract.getUserData("0x742d35Cc6634C0532925a3b8D6f9C0d53e3678c0");
console.log(`Balance: ${userData.balance}, Best Score: ${userData.bestScore}`);
console.log(`Conversations: ${userData.conversationCount}/3`);
```

---

### 18. `getMultipleUsersData(address[] users)`

**Purpose:** Get user data for multiple users in one call (batch operation)  
**Access:** Public view function  
**Modifiers:** `view`

**Inputs:**
- `users` (address[]): Array of user addresses to get data for

**Outputs:**
- `usersData` (UserData[]): Array of UserData structs (matching users array order)

**Usage Example:**
```javascript
const users = ["0x742d35Cc...", "0x123456Ab...", "0x987654Cd..."];
const usersData = await contract.getMultipleUsersData(users);
usersData.forEach((data, i) => {
    console.log(`User ${users[i]}: Balance ${data.balance}, Score ${data.bestScore}`);
});
```

---

## 🔧 Admin Functions

### 19. `pause()`

**Purpose:** Emergency pause all contract operations  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:** None

**Outputs:** None

**Usage Example:**
```javascript
// Emergency pause
await contract.pause();
```

---

### 20. `unpause()`

**Purpose:** Resume contract operations after pause  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:** None

**Outputs:** None

**Usage Example:**
```javascript
// Resume operations
await contract.unpause();
```

---

### 21. `setCastCost(uint256 newCastCost)`

**Purpose:** Update the cost required for each cast participation  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:**
- `newCastCost` (uint256): New cost per cast in USDC (6 decimals)

**Outputs:** None

**Events Emitted:**
- `CastCostUpdated(uint256 oldCost, uint256 newCost)`

**Usage Example:**
```javascript
// Set cast cost to 0.02 USDC (2 cents)
await contract.setCastCost(20000); // 0.02 USDC (6 decimals)

// Set cast cost to 0.005 USDC (half a cent)  
await contract.setCastCost(5000); // 0.005 USDC (6 decimals)
```

---

### 22. `emergencyWithdraw()`

**Purpose:** Emergency withdrawal of all USDC from contract  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:** None

**Outputs:** None

**Usage Example:**
```javascript
// Emergency withdraw all funds
await contract.emergencyWithdraw();
```

---

## 🎯 Common Usage Patterns

### **Weekly Cycle Management:**
```javascript
// 1. Start new week
await contract.startNewWeek();

// 2. Set character for the week
await contract.setWeeklyCharacter(
    "Maya Angelou",
    "Woo me with beautiful words and metaphors",
    ["Romanticism", "Eloquence", "Creativity", "Sensitivity", "Depth"],
    [10, 9, 8, 9, 8],
    5
);

// 3. Users participate throughout the week (via bot)
// ... participations happen ...

// 4. AI evaluates conversations at week end
const [conversationIds, users, fids] = await contract.getUnevaluatedConversationsForAI();
// ... AI processes conversations off-chain ...

// 5. Upload top AI scores
await contract.recordTopAIScores(topUsers, topConversations, topScores, totalEvaluated);

// 6. Select winner
await contract.selectWinnerByAIScore();

// 7. Distribute prizes
await contract.distributePrize();
```

### **User Balance Management:**
```javascript
// Check user balance and status
const userData = await contract.getUserData(userAddress);
if (!userData.hasSufficientBalance) {
    // User needs to top up
    await contract.topUp(1000000); // Add 1 USDC
}

// Check conversation limits
if (userData.remainingConversations === 0) {
    console.log("User reached conversation limit for this week");
}
```

### **Dashboard Data Fetching:**
```javascript
// Get all data for dashboard
const commonData = await contract.getCommonData();
const currentCharacter = await contract.getCurrentCharacter();
const weeklyParticipations = await contract.getCurrentWeekParticipations();

// Display prize pool, character info, and participation stats
console.log(`Prize Pool: ${commonData.currentWeekPrizePool} USDC`);
console.log(`Character: ${currentCharacter.name} - ${currentCharacter.task}`);
console.log(`Participations: ${weeklyParticipations.length}`);
```

---

## 📋 Error Codes

The contract uses custom errors for gas efficiency:

- `InsufficientBalance()` - User doesn't have enough USDC
- `InvalidAmount()` - Invalid amount provided (0 or negative)
- `WeekNotEnded()` - Operation requires week to be ended
- `NoParticipants()` - No participants in current week
- `TransferFailed()` - USDC transfer failed
- `CastNotEvaluated()` - Cast hasn't been evaluated by AI
- `InvalidAIScore()` - AI score not in valid range (0-50)
- `ConversationNotFound()` - Conversation ID not found
- `NoEvaluatedConversations()` - No conversations have been evaluated
- `MaxConversationsReached()` - User reached max conversations per week (3)
- `MaxCastsPerConversationReached()` - Conversation reached max casts (10)
- `InvalidTaskLength()` - Character task exceeds 255 characters
- `InvalidTraitCount()` - Trait count not in range 1-5
- `CharacterAlreadySet()` - Character already set for current week

---

## 🔗 Related Documentation

- [Smart Contract Deployment Guide](DEPLOYMENT.md)
- [Frontend Integration Guide](FRONTEND_INTEGRATION.md)
- [AI Evaluation System](AI_EVALUATION.md)
- [Bot Integration Guide](BOT_INTEGRATION.md)
