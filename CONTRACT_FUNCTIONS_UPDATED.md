# LoveallPrizePool Contract Functions Documentation

## 📋 Contract Overview

**Contract:** LoveallPrizePool  
**Version:** v2.0 (Updated)  
**Functions:** 35+ external functions  
**Purpose:** Advanced AI character-based prize pool system with complete conversation tracking

---

## 🎯 Function Categories

### 💰 [User Balance Functions](#user-balance-functions) (3)
### 🎮 [Conversation Functions](#conversation-functions) (4)  
### 🤖 [AI Evaluation Functions](#ai-evaluation-functions) (2)
### 🏆 [Winner & Prize Functions](#winner--prize-functions) (3)
### 🎭 [AI Character Functions](#ai-character-functions) (3)
### 📊 [Data Access Functions](#data-access-functions) (8)
### 👤 [User Data Functions](#user-data-functions) (4)
### 🔧 [Admin Functions](#admin-functions) (6)

---

## 💰 User Balance Functions

### 1. `topUp(uint256 amount)`

**Purpose:** Add USDC to user's balance for participating in conversations  
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

**Purpose:** Withdraw unused USDC from user's balance  
**Access:** Public (user can withdraw their own balance)  
**Modifiers:** `whenNotPaused`, `nonReentrant`

**Inputs:**
- `amount` (uint256): Amount to withdraw (must be ≤ user's balance)

**Outputs:** None

**Events Emitted:**
- `BalanceWithdrawn(address indexed user, uint256 amount)`

**Usage Example:**
```javascript
// Withdraw 5 USDC from balance
await contract.withdrawBalance(5000000); // 5 USDC
```

---

### 3. `contributeToPrizePool(uint256 amount)`

**Purpose:** Directly contribute USDC to the prize pool (community funding)  
**Access:** Public (anyone can contribute)  
**Modifiers:** `whenNotPaused`, `nonReentrant`

**Inputs:**
- `amount` (uint256): Amount of USDC to contribute to prize pool

**Outputs:** None

**Events Emitted:**
- `PrizePoolContribution(address indexed contributor, uint256 amount)`

---

## 🎮 Conversation Functions

### 4. `recordCompleteConversation()` ⭐ **NEW**

**Purpose:** Record a complete conversation including user cast and bot reply  
**Access:** Owner only (bot integration)  
**Modifiers:** `whenNotPaused`, `onlyOwner`

**Inputs:**
- `user` (address): User's wallet address
- `fid` (uint256): User's Farcaster ID  
- `userCastHash` (bytes32): Hash of user's original cast
- `botCastHash` (bytes32): Hash of bot's reply cast
- `conversationId` (bytes32): Unique conversation identifier
- `userCastContent` (string): User's message content
- `botReplyContent` (string): Bot's reply content

**Outputs:** None

**Events Emitted:**
- `CompleteConversationRecorded(address indexed user, uint256 fid, bytes32 userCastHash, bytes32 botCastHash, bytes32 conversationId, uint256 cost, string userCastContent, string botReplyContent, uint256 timestamp)`

**Usage Example:**
```javascript
const conversationId = ethers.keccak256(ethers.toUtf8Bytes(userCastHash));
await contract.recordCompleteConversation(
    userAddress,
    userFid,
    userCastHash,
    botReplyHash,
    conversationId,
    "Hey there! 😘",
    "Hello gorgeous! 💕 Thanks for chatting!"
);
```

---

### 5. `getConversation(bytes32 conversationId)` ⭐ **NEW**

**Purpose:** Get all messages in a specific conversation  
**Access:** Public (view function)

**Inputs:**
- `conversationId` (bytes32): Conversation ID to retrieve

**Outputs:**
- Array of `ConversationMessage` structs containing:
  - `castHash` (bytes32): Hash of the cast
  - `content` (string): Message content
  - `isBot` (bool): true if bot message, false if user message
  - `timestamp` (uint256): When message was sent

**Usage Example:**
```javascript
const messages = await contract.getConversation("0xconv123...");
console.log(`Conversation has ${messages.length} messages`);
```

---

### 6. `getUserConversations(address user)` ⭐ **NEW**

**Purpose:** Get all conversations for a specific user with complete details  
**Access:** Public (view function)

**Inputs:**
- `user` (address): User address to get conversations for

**Outputs:**
- Array of `ConversationThread` structs containing:
  - `conversationId` (bytes32): Unique conversation ID
  - `user` (address): User address
  - `fid` (uint256): User's Farcaster ID
  - `messages` (ConversationMessage[]): All messages in chronological order
  - `totalCost` (uint256): Total USDC spent in this conversation
  - `aiScore` (uint256): AI evaluation score
  - `isEvaluated` (bool): Whether conversation has been evaluated
  - `startTime` (uint256): First message timestamp
  - `lastActivity` (uint256): Last message timestamp
  - `messageCount` (uint256): Total number of messages

**Usage Example:**
```javascript
const conversations = await contract.getUserConversations(userAddress);
console.log(`User has ${conversations.length} conversations`);
```

---

### 7. `getUserConversationCount(address user)` ⭐ **NEW**

**Purpose:** Get total number of conversations for a user  
**Access:** Public (view function)

**Inputs:**
- `user` (address): User address

**Outputs:**
- `uint256`: Number of conversations

---

## 🤖 AI Evaluation Functions

### 8. `recordTopAIScores()` ⭐ **NEW**

**Purpose:** Record only the top AI scores after batch evaluation (optimized for gas)  
**Access:** Owner only (AI system)  
**Modifiers:** `onlyOwner`

**Inputs:**
- `topUsers` (address[]): Array of top user addresses (max 10)
- `topConversationIds` (bytes32[]): Array of conversation IDs (max 10)
- `topAiScores` (uint256[]): Array of AI scores (0-50)
- `totalEvaluated` (uint256): Total number of conversations evaluated

**Outputs:** None

**Events Emitted:**
- `TopScoresRecorded(uint256 totalEvaluated, uint256 topScoresCount)`
- `AIEvaluationCompleted(address indexed user, uint256 fid, bytes32 conversationId, uint256 aiScore)` (for each top score)

**Usage Example:**
```javascript
await contract.recordTopAIScores(
    ["0xuser1...", "0xuser2...", "0xuser3..."],
    ["0xconv1...", "0xconv2...", "0xconv3..."],
    [48, 45, 42], // AI scores out of 50
    156 // Total conversations evaluated
);
```

---

### 9. `getUnevaluatedConversationsForAI()` ⭐ **NEW**

**Purpose:** Get all conversations that need AI evaluation  
**Access:** Public (view function)

**Outputs:**
- `conversationIds` (bytes32[]): Array of conversation IDs
- `users` (address[]): Array of user addresses
- `fids` (uint256[]): Array of Farcaster IDs

**Usage Example:**
```javascript
const [conversationIds, users, fids] = await contract.getUnevaluatedConversationsForAI();
console.log(`${conversationIds.length} conversations need evaluation`);
```

---

## 🏆 Winner & Prize Functions

### 10. `selectWinnerByAIScore()` ⭐ **UPDATED**

**Purpose:** Automatically select winner based on highest AI score  
**Access:** Owner only (admin/AI system)  
**Modifiers:** `onlyOwner`

**Inputs:** None

**Outputs:** None

**Events Emitted:**
- `WinnerSelected(address indexed winner, uint256 prize, uint256 week)`

**Usage Example:**
```javascript
await contract.selectWinnerByAIScore();
```

---

### 11. `distributePrize()`

**Purpose:** Distribute prize to winner (80%), rollover (10%), protocol fee (10%)  
**Access:** Owner only  
**Modifiers:** `onlyOwner`, `nonReentrant`

**Events Emitted:**
- `PrizeDistributed(address indexed winner, uint256 prize, uint256 rollover, uint256 protocolFee)`

---

### 12. `startNewWeek()`

**Purpose:** Start a new weekly competition cycle  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Events Emitted:**
- `NewWeekStarted(uint256 weekNumber, uint256 rolloverAmount)`

---

## 🎭 AI Character Functions

### 13. `setWeeklyCharacter()` ⭐ **NEW**

**Purpose:** Set the AI character personality for the current week  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Inputs:**
- `name` (string): Character name (e.g., "Jordan Belfort")
- `task` (string): Character task/description (max 255 chars)
- `traitNames` (string[5]): Array of trait names
- `traitValues` (uint8[5]): Array of trait values (1-10 scale)
- `traitCount` (uint8): Number of active traits (1-5)

**Events Emitted:**
- `CharacterSet(uint256 indexed week, string name, string task, uint8 traitCount)`

**Usage Example:**
```javascript
await contract.setWeeklyCharacter(
    "Jordan Belfort",
    "Channel the Wolf of Wall Street's confidence and charm to create irresistible flirty responses",
    ["Persuasiveness", "Charisma", "Confidence", "Wit", "Boldness"],
    [9, 10, 8, 7, 9], // Trait values out of 10
    5 // Number of traits
);
```

---

### 14. `getCurrentCharacter()` ⭐ **NEW**

**Purpose:** Get the current week's AI character details  
**Access:** Public (view function)

**Outputs:**
- `name` (string): Character name
- `task` (string): Character task description
- `traitNames` (string[5]): Array of trait names
- `traitValues` (uint8[5]): Array of trait values
- `traitCount` (uint8): Number of active traits
- `isSet` (bool): Whether character has been set

---

### 15. `getWeeklyCharacter(uint256 week)` ⭐ **NEW**

**Purpose:** Get AI character details for a specific week  
**Access:** Public (view function)

**Inputs:**
- `week` (uint256): Week number to get character for

**Outputs:** Same as `getCurrentCharacter()`

---

## 📊 Data Access Functions

### 16. `getCommonData()` ⭐ **UPDATED**

**Purpose:** Get all common contract data in one call (optimized for frontend)  
**Access:** Public (view function)

**Outputs:**
- `CommonData` struct containing:
  - `totalPrizePool` (uint256): Total prize pool
  - `currentWeekPrizePool` (uint256): Current week's pool
  - `rolloverAmount` (uint256): Amount rolling over
  - `totalContributions` (uint256): Total community contributions
  - `totalProtocolFees` (uint256): Total protocol fees paid
  - `castCost` (uint256): Current cost per cast
  - `currentWeek` (uint256): Current week number
  - `weekStartTime` (uint256): When current week started
  - `weekEndTime` (uint256): When current week ends
  - `currentWeekParticipantsCount` (uint256): Number of participants
  - `currentWeekWinner` (address): Current week's winner (if selected)
  - `currentWeekPrize` (uint256): Current week's prize amount
  - `characterName` (string): Current character name
  - `characterTask` (string): Current character task
  - `characterIsSet` (bool): Whether character is set

---

### 17. `getCurrentWeekParticipations()`

**Purpose:** Get all participations for the current week  
**Access:** Public (view function)

**Outputs:**
- Array of `CastParticipation` structs

---

### 18. `getConversationParticipations(bytes32 conversationId)`

**Purpose:** Get all participations for a specific conversation  
**Access:** Public (view function)

---

### 19. `getWeeklySummary(uint256 week)`

**Purpose:** Get summary data for a specific week  
**Access:** Public (view function)

**Outputs:**
- `participants` (address[]): All participants
- `winner` (address): Week's winner
- `prize` (uint256): Prize amount
- `participantsCount` (uint256): Number of participants

---

### 20. Constants and View Functions

**Constants:**
- `MAX_CASTS_PER_CONVERSATION()`: Maximum casts per conversation (10)
- `MAX_CONVERSATIONS_PER_USER_PER_WEEK()`: Max conversations per user per week (3)
- `MAX_MESSAGE_LENGTH()`: Maximum message length (2000 chars)
- `MAX_CONVERSATION_LENGTH()`: Maximum total conversation length (20000 chars)
- `WEEK_DURATION()`: Week duration in seconds (7 days)
- `WINNER_PERCENTAGE()`: Winner's percentage (80%)
- `ROLLOVER_PERCENTAGE()`: Rollover percentage (10%)
- `PROTOCOL_FEE_PERCENTAGE()`: Protocol fee percentage (10%)

**State Variables:**
- `castCost()`: Current cost per cast (adjustable)
- `currentWeek()`: Current week number
- `currentWeekPrizePool()`: Current week's prize pool
- `totalPrizePool()`: Total prize pool
- `rolloverAmount()`: Amount rolling over to next week
- `weekStartTime()`: When current week started

---

## 👤 User Data Functions

### 21. `getUserData(address user)` ⭐ **UPDATED**

**Purpose:** Get comprehensive user data in one call  
**Access:** Public (view function)

**Outputs:**
- `UserData` struct containing:
  - `balance` (uint256): User's USDC balance
  - `hasSufficientBalance` (bool): Can afford to participate
  - `hasParticipatedThisWeek` (bool): Has participated this week
  - `participationsCount` (uint256): Total participations this week
  - `conversationCount` (uint256): Total conversations this week
  - `remainingConversations` (uint256): Conversations left this week
  - `bestScore` (uint256): Best AI score this week
  - `bestConversationId` (bytes32): ID of best conversation
  - `totalContributions` (uint256): Total contributions made
  - `participations` (CastParticipation[]): All participations this week

---

### 22. `getMultipleUsersData(address[] users)` ⭐ **NEW**

**Purpose:** Get user data for multiple users efficiently  
**Access:** Public (view function)

**Inputs:**
- `users` (address[]): Array of user addresses

**Outputs:**
- Array of `UserData` structs (same as `getUserData`)

---

## 🔧 Admin Functions

### 23. `setCastCost(uint256 newCastCost)` ⭐ **NEW**

**Purpose:** Update the cost per cast  
**Access:** Owner only  
**Modifiers:** `onlyOwner`

**Events Emitted:**
- `CastCostUpdated(uint256 oldCost, uint256 newCost)`

---

### 24. `pause()`

**Purpose:** Emergency pause contract  
**Access:** Owner only

---

### 25. `unpause()`

**Purpose:** Unpause contract  
**Access:** Owner only

---

### 26. `emergencyWithdraw()`

**Purpose:** Emergency withdraw all funds (disaster recovery)  
**Access:** Owner only

---

### 27. `transferOwnership(address newOwner)`

**Purpose:** Transfer contract ownership  
**Access:** Owner only

---

### 28. `renounceOwnership()`

**Purpose:** Renounce contract ownership (makes contract immutable)  
**Access:** Owner only

---

## 📈 Key Contract Improvements in v2.0

1. **Complete Conversation Tracking**: Now records both user messages and bot replies
2. **AI Character System**: Weekly character personalities with traits
3. **Optimized AI Evaluation**: Batch processing with top scores only
4. **Enhanced Data Access**: Comprehensive data structures for frontend
5. **Gas Optimization**: More efficient functions with better limits
6. **Conversation Management**: Full conversation threads with metadata
7. **Advanced Analytics**: Better tracking and reporting capabilities

---

## 🚀 Integration Guide

### For Bot Developers:
1. Use `recordCompleteConversation()` instead of old `participateInCast()`
2. Implement `getUnevaluatedConversationsForAI()` for evaluation systems
3. Use `recordTopAIScores()` for efficient batch AI evaluation

### For Frontend Developers:
1. Use `getCommonData()` for dashboard data
2. Use `getUserConversations()` for user conversation history
3. Use `getCurrentCharacter()` for character display

### For Administrators:
1. Set weekly characters with `setWeeklyCharacter()`
2. Use `selectWinnerByAIScore()` for automatic winner selection
3. Monitor with enhanced data access functions
