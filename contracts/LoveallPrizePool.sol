// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LoveallPrizePool
 * @dev Smart contract for managing the Loveall flirting bot prize pool
 * Users pay 0.01 USDC per cast, weekly winner gets 80% of pool, 10% rolls over, 10% protocol fee
 */
contract LoveallPrizePool is Ownable, Pausable, ReentrancyGuard {
    // USDC token contract
    IERC20 public immutable usdcToken;
    
    // Constants
    uint256 public castCost = 1e4; // 0.01 USDC (1 cent) (6 decimals) - adjustable by owner
    uint256 public constant WINNER_PERCENTAGE = 80; // 80% to winner
    uint256 public constant ROLLOVER_PERCENTAGE = 10; // 10% rollover
    uint256 public constant PROTOCOL_FEE_PERCENTAGE = 10; // 10% protocol fee
    uint256 public constant MAX_CONVERSATIONS_PER_USER_PER_WEEK = 3; // Max 3 conversations per user per week
    uint256 public constant MAX_CASTS_PER_CONVERSATION = 10; // Max 10 casts per conversation
    
    // Weekly cycle management
    uint256 public currentWeek;
    uint256 public weekStartTime;
    uint256 public constant WEEK_DURATION = 2 hours;
    
    // AI Character system
    struct AICharacter {
        string name;                    // Character name (e.g., "Jordan Belfort")
        string task;                    // Task description (max 255 chars)
        string[5] traitNames;           // Array of trait names (e.g., ["Persuasiveness", "Charisma", ...])
        uint8[5] traitValues;           // Array of trait values (1-10 scale, matching traitNames)
        uint8 traitCount;               // Number of active traits (1-5)
        uint256 weekNumber;             // Week this character is active
        bool isSet;                     // Whether character has been set for this week
    }
    
    mapping(uint256 => AICharacter) public weeklyCharacters;
    
    // Prize pool tracking
    uint256 public totalPrizePool;
    uint256 public currentWeekPrizePool;
    uint256 public rolloverAmount;
    uint256 public totalContributions; // Total USDC contributed by community
    uint256 public totalProtocolFees; // Total protocol fees paid to owner
    mapping(address => uint256) public userContributions; // Track individual contributions
    
    // User balances
    mapping(address => uint256) public userBalances;
    
    // Weekly participation tracking
    mapping(uint256 => address[]) public weeklyParticipants;
    mapping(uint256 => mapping(address => CastParticipation[])) public weeklyParticipations;
    mapping(uint256 => mapping(address => uint256)) public userConversationCount; // Week → user → conversation count
    mapping(uint256 => mapping(bytes32 => uint256)) public conversationCastCount; // Week → conversationId → cast count
    
    // Winner tracking
    mapping(uint256 => address) public weeklyWinners;
    mapping(uint256 => uint256) public weeklyPrizes;
    
    // Struct for cast participation
    struct CastParticipation {
        address user;
        uint256 fid; // Farcaster ID
        bytes32 castHash; // Real cast hash from Farcaster
        bytes32 conversationId; // Conversation/thread ID (derived from original cast)
        uint256 timestamp;
        uint256 weekNumber;
        uint256 usdcAmount;
        uint256 aiScore; // AI evaluation score (0-50) for the entire conversation
        bool isEvaluated; // Whether AI has evaluated this conversation
    }
    
    // Events
    event BalanceToppedUp(address indexed user, uint256 amount);
    event BalanceWithdrawn(address indexed user, uint256 amount);
    event CastParticipated(address indexed user, uint256 fid, bytes32 castHash, bytes32 conversationId, uint256 cost, string castContent);
    event CompleteConversationRecorded(address indexed user, uint256 fid, bytes32 userCastHash, bytes32 botCastHash, bytes32 conversationId, uint256 cost, string userCastContent, string botReplyContent, uint256 timestamp);
    event AIEvaluationCompleted(address indexed user, uint256 fid, bytes32 conversationId, uint256 aiScore);
    event TopScoresRecorded(uint256 totalEvaluated, uint256 topScoresCount);
    event WinnerSelected(address indexed winner, uint256 prize, uint256 week);
    event NewWeekStarted(uint256 weekNumber, uint256 rolloverAmount);
    event PrizeDistributed(address indexed winner, uint256 prize, uint256 rollover, uint256 protocolFee);
    event PrizePoolContribution(address indexed contributor, uint256 amount);
    event CharacterSet(uint256 indexed week, string name, string task, uint8 traitCount);
    event CastCostUpdated(uint256 oldCost, uint256 newCost);
    
    // Errors
    error InsufficientBalance();
    error InvalidAmount();
    error WeekNotEnded();
    error NoParticipants();
    error TransferFailed();
    error CastNotEvaluated();
    error InvalidAIScore();
    error ConversationNotFound();
    error NoEvaluatedConversations();
    error MaxConversationsReached();
    error MaxCastsPerConversationReached();
    error InvalidTaskLength();
    error InvalidTraitCount();
    error CharacterAlreadySet();
    
    /**
     * @dev Constructor
     * @param _usdcToken USDC token contract address
     * @param _owner Contract owner address
     */
    constructor(address _usdcToken, address _owner) Ownable(_owner) {
        if (_usdcToken == address(0)) revert InvalidAmount();
        if (_owner == address(0)) revert InvalidAmount();
        
        usdcToken = IERC20(_usdcToken);
        currentWeek = 1;
        weekStartTime = block.timestamp;
    }
    
    /**
     * @dev Top up user balance with USDC
     * @param amount Amount of USDC to add to balance
     */
    function topUp(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        // Transfer USDC from user to contract
        if (!usdcToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        
        userBalances[msg.sender] += amount;
        
        emit BalanceToppedUp(msg.sender, amount);
    }
    
    /**
     * @dev Withdraw user's unused balance
     * @param amount Amount to withdraw
     */
    function withdrawBalance(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0 || amount > userBalances[msg.sender]) {
            revert InvalidAmount();
        }
        
        userBalances[msg.sender] -= amount;
        
        if (!usdcToken.transfer(msg.sender, amount)) {
            revert TransferFailed();
        }
        
        emit BalanceWithdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Contribute USDC directly to the prize pool (anyone can contribute)
     * @param amount Amount of USDC to contribute to the prize pool
     */
    function contributeToPrizePool(uint256 amount) external whenNotPaused nonReentrant {
        if (amount == 0) revert InvalidAmount();
        
        // Transfer USDC from contributor to contract
        if (!usdcToken.transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }
        
        // Add contribution to current week's prize pool
        currentWeekPrizePool += amount;
        totalPrizePool += amount;
        
        // Track total contributions and individual contributor amounts
        totalContributions += amount;
        userContributions[msg.sender] += amount;
        
        emit PrizePoolContribution(msg.sender, amount);
    }
    
    /**
     * @dev Participate in cast (called by bot)
     * @param user User address (original cast author)
     * @param fid Farcaster ID
     * @param castHash Real cast hash from Farcaster
     * @param conversationId Conversation/thread ID (derived from original cast)
     * @param castContent Content of the cast (emitted as event parameter)
     */
    function participateInCast(address user, uint256 fid, bytes32 castHash, bytes32 conversationId, string calldata castContent) 
        external 
        whenNotPaused 
        onlyOwner 
    {
        if (userBalances[user] < castCost) {
            revert InsufficientBalance();
        }
        
        // Check conversation limit for user
        uint256 currentConversationCount = userConversationCount[currentWeek][user];
        bool isNewConversation = true;
        
        // Check if this is a new conversation for the user
        CastParticipation[] memory existingParticipations = weeklyParticipations[currentWeek][user];
        for (uint256 i = 0; i < existingParticipations.length; i++) {
            if (existingParticipations[i].conversationId == conversationId) {
                isNewConversation = false;
                break;
            }
        }
        
        // If this is a new conversation, check the limit
        if (isNewConversation) {
            if (currentConversationCount >= MAX_CONVERSATIONS_PER_USER_PER_WEEK) {
                revert MaxConversationsReached();
            }
            userConversationCount[currentWeek][user] = currentConversationCount + 1;
        }
        
        // Check cast limit for conversation
        uint256 currentCastCount = conversationCastCount[currentWeek][conversationId];
        if (currentCastCount >= MAX_CASTS_PER_CONVERSATION) {
            revert MaxCastsPerConversationReached();
        }
        conversationCastCount[currentWeek][conversationId] = currentCastCount + 1;
        
        // Deduct balance and add to prize pool
        userBalances[user] -= castCost;
        currentWeekPrizePool += castCost;
        totalPrizePool += castCost;
        
        // Track participation
        CastParticipation memory participation = CastParticipation({
            user: user,
            fid: fid,
            castHash: castHash,
            conversationId: conversationId,
            timestamp: block.timestamp,
            weekNumber: currentWeek,
            usdcAmount: castCost,
            aiScore: 0, // Initialize with 0, will be set by AI evaluation
            isEvaluated: false
        });
        
        weeklyParticipations[currentWeek][user].push(participation);
        
        // Only add to participants list if this is their first participation this week
        bool isFirstParticipation = true;
        for (uint256 i = 0; i < weeklyParticipants[currentWeek].length; i++) {
            if (weeklyParticipants[currentWeek][i] == user) {
                isFirstParticipation = false;
                break;
            }
        }
        if (isFirstParticipation) {
        weeklyParticipants[currentWeek].push(user);
        }
        
        emit CastParticipated(user, fid, castHash, conversationId, castCost, castContent);
    }
    
    /**
     * @dev Record complete conversation: user cast + bot reply in one transaction
     * @param user User address (original cast author)
     * @param fid Farcaster ID
     * @param userCastHash Hash of user's original cast
     * @param botCastHash Hash of bot's reply cast
     * @param conversationId Conversation/thread ID (derived from original cast)
     * @param userCastContent User's original message content
     * @param botReplyContent Bot's generated reply content
     */
    function recordCompleteConversation(
        address user, 
        uint256 fid, 
        bytes32 userCastHash, 
        bytes32 botCastHash, 
        bytes32 conversationId, 
        string calldata userCastContent, 
        string calldata botReplyContent
    ) 
        external 
        whenNotPaused 
        onlyOwner 
    {
        if (userBalances[user] < castCost) {
            revert InsufficientBalance();
        }
        
        // Check conversation limit for user
        uint256 currentConversationCount = userConversationCount[currentWeek][user];
        bool isNewConversation = true;
        
        // Check if this is a new conversation for the user
        CastParticipation[] memory existingParticipations = weeklyParticipations[currentWeek][user];
        for (uint256 i = 0; i < existingParticipations.length; i++) {
            if (existingParticipations[i].conversationId == conversationId) {
                isNewConversation = false;
                break;
            }
        }
        
        // If this is a new conversation, check the limit
        if (isNewConversation) {
            if (currentConversationCount >= MAX_CONVERSATIONS_PER_USER_PER_WEEK) {
                revert MaxConversationsReached();
            }
            userConversationCount[currentWeek][user] = currentConversationCount + 1;
        }
        
        // Check cast limit for conversation
        uint256 currentCastCount = conversationCastCount[currentWeek][conversationId];
        if (currentCastCount >= MAX_CASTS_PER_CONVERSATION) {
            revert MaxCastsPerConversationReached();
        }
        conversationCastCount[currentWeek][conversationId] = currentCastCount + 1;
        
        // Deduct balance and add to prize pool
        userBalances[user] -= castCost;
        currentWeekPrizePool += castCost;
        
        // Create participation record (using user cast hash for compatibility)
        CastParticipation memory participation = CastParticipation({
            user: user,
            fid: fid,
            castHash: userCastHash,
            conversationId: conversationId,
            timestamp: block.timestamp,
            weekNumber: currentWeek,
            usdcAmount: castCost,
            aiScore: 0, // Initialize with 0, will be set by AI evaluation
            isEvaluated: false
        });
        
        weeklyParticipations[currentWeek][user].push(participation);
        
        // Only add to participants list if this is their first participation this week
        bool isFirstParticipation = true;
        for (uint256 i = 0; i < weeklyParticipants[currentWeek].length; i++) {
            if (weeklyParticipants[currentWeek][i] == user) {
                isFirstParticipation = false;
                break;
            }
        }
        if (isFirstParticipation) {
            weeklyParticipants[currentWeek].push(user);
        }
        
        // Emit complete conversation event with both user and bot content
        emit CompleteConversationRecorded(
            user, 
            fid, 
            userCastHash, 
            botCastHash, 
            conversationId, 
            castCost, 
            userCastContent, 
            botReplyContent, 
            block.timestamp
        );
    }

    
    /**
     * @dev Record only top AI scores after evaluating all conversations (called by owner/AI system)
     * @param topUsers Array of user addresses (top 10)
     * @param topConversationIds Array of conversation IDs (top 10)
     * @param topAiScores Array of AI scores (top 10, 0-50)
     * @param totalEvaluated Total number of conversations evaluated by AI
     */
    function recordTopAIScores(
        address[] calldata topUsers,
        bytes32[] calldata topConversationIds,
        uint256[] calldata topAiScores,
        uint256 totalEvaluated
    ) external onlyOwner {
        require(
            topUsers.length == topConversationIds.length && 
            topConversationIds.length == topAiScores.length,
            "Array lengths must match"
        );
        
        require(topUsers.length <= 10, "Maximum 10 top scores allowed");
        
        for (uint256 i = 0; i < topUsers.length; i++) {
            if (topAiScores[i] > 50) revert InvalidAIScore();
            
            address user = topUsers[i];
            bytes32 conversationId = topConversationIds[i];
            uint256 aiScore = topAiScores[i];
            
            // Find the user's participation for this conversation and update AI score
            CastParticipation[] storage participations = weeklyParticipations[currentWeek][user];
            require(participations.length > 0, "No participations found");
            
            // Find the participation with matching conversationId
            bool found = false;
            for (uint256 j = 0; j < participations.length; j++) {
                if (participations[j].conversationId == conversationId) {
                    participations[j].aiScore = aiScore;
                    participations[j].isEvaluated = true;
                    found = true;
                    
                    emit AIEvaluationCompleted(user, participations[j].fid, conversationId, aiScore);
                    break;
                }
            }
            
            if (!found) revert ConversationNotFound();
        }
        
        // Emit event with total evaluated count
        emit TopScoresRecorded(totalEvaluated, topUsers.length);
    }
    
    /**
     * @dev Get all participations for the current week
     * @return participations Array of all CastParticipation structs for current week
     */
    function getCurrentWeekParticipations() external view returns (CastParticipation[] memory) {
        address[] memory participants = weeklyParticipants[currentWeek];
        uint256 totalParticipations = 0;
        
        // Count total participations first
        for (uint256 i = 0; i < participants.length; i++) {
            totalParticipations += weeklyParticipations[currentWeek][participants[i]].length;
        }
        
        // Create array and populate it
        CastParticipation[] memory participations = new CastParticipation[](totalParticipations);
        uint256 index = 0;
        
        for (uint256 i = 0; i < participants.length; i++) {
            CastParticipation[] memory userParticipations = weeklyParticipations[currentWeek][participants[i]];
            for (uint256 j = 0; j < userParticipations.length; j++) {
                participations[index] = userParticipations[j];
                index++;
            }
        }
        
        return participations;
    }
    

    
    /**
     * @dev Get all unevaluated conversations with their details for batch AI evaluation
     * @return conversationIds Array of conversation IDs that need evaluation
     * @return users Array of user addresses for each conversation
     * @return fids Array of Farcaster IDs for each conversation
     */
    function getUnevaluatedConversationsForAI() external view returns (
        bytes32[] memory conversationIds,
        address[] memory users,
        uint256[] memory fids
    ) {
        address[] memory participants = weeklyParticipants[currentWeek];
        
        // Count unevaluated conversations
        uint256 unevaluatedCount = 0;
        bytes32[] memory tempConversationIds = new bytes32[](participants.length * 10);
        address[] memory tempUsers = new address[](participants.length * 10);
        uint256[] memory tempFids = new uint256[](participants.length * 10);
        
        for (uint256 i = 0; i < participants.length; i++) {
            CastParticipation[] memory participations = weeklyParticipations[currentWeek][participants[i]];
            for (uint256 j = 0; j < participations.length; j++) {
                if (!participations[j].isEvaluated) {
                    // Check if this conversation is already in our list
                    bool alreadyInList = false;
                    for (uint256 k = 0; k < unevaluatedCount; k++) {
                        if (tempConversationIds[k] == participations[j].conversationId) {
                            alreadyInList = true;
                            break;
                        }
                    }
                    if (!alreadyInList) {
                        tempConversationIds[unevaluatedCount] = participations[j].conversationId;
                        tempUsers[unevaluatedCount] = participations[j].user;
                        tempFids[unevaluatedCount] = participations[j].fid;
                        unevaluatedCount++;
                    }
                }
            }
        }
        
        // Create final arrays with correct size
        conversationIds = new bytes32[](unevaluatedCount);
        users = new address[](unevaluatedCount);
        fids = new uint256[](unevaluatedCount);
        
        for (uint256 i = 0; i < unevaluatedCount; i++) {
            conversationIds[i] = tempConversationIds[i];
            users[i] = tempUsers[i];
            fids[i] = tempFids[i];
        }
        
        return (conversationIds, users, fids);
    }
    
    /**
     * @dev Get all participations for a specific conversation in current week
     * @param conversationId Conversation ID to get participations for
     * @return participations Array of CastParticipation structs for the conversation (1-on-1 with original author)
     */
    function getConversationParticipations(bytes32 conversationId) external view returns (CastParticipation[] memory) {
        address[] memory participants = weeklyParticipants[currentWeek];
        uint256 totalParticipations = 0;
        
        // Count total participations for this conversation first
        for (uint256 i = 0; i < participants.length; i++) {
            CastParticipation[] memory userParticipations = weeklyParticipations[currentWeek][participants[i]];
            for (uint256 j = 0; j < userParticipations.length; j++) {
                if (userParticipations[j].conversationId == conversationId) {
                    totalParticipations++;
                }
            }
        }
        
        // Create array and populate it
        CastParticipation[] memory participations = new CastParticipation[](totalParticipations);
        uint256 index = 0;
        
        for (uint256 i = 0; i < participants.length; i++) {
            CastParticipation[] memory userParticipations = weeklyParticipations[currentWeek][participants[i]];
            for (uint256 j = 0; j < userParticipations.length; j++) {
                if (userParticipations[j].conversationId == conversationId) {
                    participations[index] = userParticipations[j];
                    index++;
                }
            }
        }
        
        return participations;
    }
    
    /**
     * @dev Automatically select winner based on highest AI score (called by admin/AI system)
     * This function finds the user with the highest AI score among all evaluated conversations
     */
    function selectWinnerByAIScore() external onlyOwner {
        if (currentWeekPrizePool == 0) {
            revert NoParticipants();
        }
        
        address[] memory participants = weeklyParticipants[currentWeek];
        address winner = address(0);
        uint256 highestScore = 0;
        
        // Find the user with the highest AI score
        for (uint256 i = 0; i < participants.length; i++) {
            address user = participants[i];
            CastParticipation[] memory participations = weeklyParticipations[currentWeek][user];
            
            for (uint256 j = 0; j < participations.length; j++) {
                if (participations[j].isEvaluated && participations[j].aiScore > highestScore) {
                    highestScore = participations[j].aiScore;
                    winner = user;
                }
            }
        }
        
        if (winner == address(0)) {
            revert NoEvaluatedConversations();
        }
        
        weeklyWinners[currentWeek] = winner;
        weeklyPrizes[currentWeek] = (currentWeekPrizePool * WINNER_PERCENTAGE) / 100;
        
        emit WinnerSelected(winner, weeklyPrizes[currentWeek], currentWeek);
    }
    
    /**
     * @dev Distribute prize to winner, rollover, and protocol fees (to owner)
     */
    function distributePrize() external onlyOwner nonReentrant {
        address winner = weeklyWinners[currentWeek];
        uint256 prize = weeklyPrizes[currentWeek];
        
        if (winner == address(0) || prize == 0) {
            revert InvalidAmount();
        }
        
        // Calculate amounts: 80% winner, 10% rollover, 10% protocol fee
        uint256 protocolFee = (currentWeekPrizePool * PROTOCOL_FEE_PERCENTAGE) / 100;
        uint256 rollover = (currentWeekPrizePool * ROLLOVER_PERCENTAGE) / 100;
        
        // Transfer prize to winner
        if (!usdcToken.transfer(winner, prize)) {
            revert TransferFailed();
        }
        
        // Transfer protocol fee to owner
        if (protocolFee > 0) {
            if (!usdcToken.transfer(owner(), protocolFee)) {
                revert TransferFailed();
            }
        }
        
        // Update rollover amount
        rolloverAmount += rollover;
        
        // Update protocol fees tracking
        totalProtocolFees += protocolFee;
        
        // Reset current week prize pool
        currentWeekPrizePool = 0;
        
        emit PrizeDistributed(winner, prize, rollover, protocolFee);
    }
    
    /**
     * @dev Start new week
     */
    function startNewWeek() external onlyOwner {
        currentWeek++;
        weekStartTime = block.timestamp;
        
        // Add rollover to new week's prize pool
        currentWeekPrizePool = rolloverAmount;
        totalPrizePool += rolloverAmount;
        
        emit NewWeekStarted(currentWeek, rolloverAmount);
        
        // Reset rollover
        rolloverAmount = 0;
    }
    
    /**
     * @dev Set the AI character for current week (only after new week starts)
     * @param name Character name (e.g., "Jordan Belfort")
     * @param task Task description (max 255 chars)
     * @param traitNames Array of trait names (1-5 traits)
     * @param traitValues Array of trait values (1-10 scale, matching traitNames)
     */
    function setWeeklyCharacter(
        string calldata name,
        string calldata task,
        string[5] calldata traitNames,
        uint8[5] calldata traitValues,
        uint8 traitCount
    ) external onlyOwner {
        if (bytes(task).length > 255) revert InvalidTaskLength();
        if (traitCount == 0 || traitCount > 5) revert InvalidTraitCount();
        if (weeklyCharacters[currentWeek].isSet) revert CharacterAlreadySet();
        
        // Validate all active trait values are 1-10
        for (uint256 i = 0; i < traitCount; i++) {
            if (traitValues[i] < 1 || traitValues[i] > 10) revert InvalidAIScore();
        }
        
        weeklyCharacters[currentWeek] = AICharacter({
            name: name,
            task: task,
            traitNames: traitNames,
            traitValues: traitValues,
            traitCount: traitCount,
            weekNumber: currentWeek,
            isSet: true
        });
        
        emit CharacterSet(currentWeek, name, task, traitCount);
    }
    

    
    // Struct for common data (prize pool, weekly info)
    struct CommonData {
        uint256 totalPrizePool;
        uint256 currentWeekPrizePool;
        uint256 rolloverAmount;
        uint256 totalContributions;
        uint256 totalProtocolFees;
        uint256 castCost;
        uint256 currentWeek;
        uint256 weekStartTime;
        uint256 weekEndTime;
        uint256 currentWeekParticipantsCount;
        address currentWeekWinner;
        uint256 currentWeekPrize;
        string characterName;
        string characterTask;
        bool characterIsSet;
    }
    
    // Struct for user-specific data
    struct UserData {
        uint256 balance;
        bool hasSufficientBalance;
        bool hasParticipatedThisWeek;
        uint256 participationsCount;
        uint256 conversationCount;
        uint256 remainingConversations;
        uint256 bestScore;
        bytes32 bestConversationId;
        uint256 totalContributions;
        CastParticipation[] participations;
    }
    
    /**
     * @dev Get all common data in one call (for frontend/dashboard)
     */
    function getCommonData() external view returns (CommonData memory) {
        AICharacter memory character = weeklyCharacters[currentWeek];
        return CommonData({
            totalPrizePool: totalPrizePool,
            currentWeekPrizePool: currentWeekPrizePool,
            rolloverAmount: rolloverAmount,
            totalContributions: totalContributions,
            totalProtocolFees: totalProtocolFees,
            castCost: castCost,
            currentWeek: currentWeek,
            weekStartTime: weekStartTime,
            weekEndTime: weekStartTime + WEEK_DURATION,
            currentWeekParticipantsCount: weeklyParticipants[currentWeek].length,
            currentWeekWinner: weeklyWinners[currentWeek],
            currentWeekPrize: weeklyPrizes[currentWeek],
            characterName: character.name,
            characterTask: character.task,
            characterIsSet: character.isSet
        });
    }
    
    /**
     * @dev Get all user-specific data in one call
     * @param user User address
     */
    function getUserData(address user) external view returns (UserData memory) {
        uint256 conversationCount = userConversationCount[currentWeek][user];
        uint256 remainingConversations = conversationCount >= MAX_CONVERSATIONS_PER_USER_PER_WEEK ? 0 : MAX_CONVERSATIONS_PER_USER_PER_WEEK - conversationCount;
        
        // Calculate best score
        CastParticipation[] memory participations = weeklyParticipations[currentWeek][user];
        uint256 bestScore = 0;
        bytes32 bestConversationId = bytes32(0);
        
        for (uint256 i = 0; i < participations.length; i++) {
            if (participations[i].isEvaluated && participations[i].aiScore > bestScore) {
                bestScore = participations[i].aiScore;
                bestConversationId = participations[i].conversationId;
            }
        }
        
        return UserData({
            balance: userBalances[user],
            hasSufficientBalance: userBalances[user] >= castCost,
            hasParticipatedThisWeek: weeklyParticipations[currentWeek][user].length > 0,
            participationsCount: weeklyParticipations[currentWeek][user].length,
            conversationCount: conversationCount,
            remainingConversations: remainingConversations,
            bestScore: bestScore,
            bestConversationId: bestConversationId,
            totalContributions: userContributions[user],
            participations: weeklyParticipations[currentWeek][user]
        });
    }
    
    /**
     * @dev Get multiple users' data in one call (for batch operations)
     * @param users Array of user addresses
     */
    function getMultipleUsersData(address[] calldata users) external view returns (UserData[] memory) {
        UserData[] memory usersData = new UserData[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            address user = users[i];
            uint256 conversationCount = userConversationCount[currentWeek][user];
            uint256 remainingConversations = conversationCount >= MAX_CONVERSATIONS_PER_USER_PER_WEEK ? 0 : MAX_CONVERSATIONS_PER_USER_PER_WEEK - conversationCount;
            
            // Calculate best score
            CastParticipation[] memory participations = weeklyParticipations[currentWeek][user];
            uint256 bestScore = 0;
            bytes32 bestConversationId = bytes32(0);
            
            for (uint256 j = 0; j < participations.length; j++) {
                if (participations[j].isEvaluated && participations[j].aiScore > bestScore) {
                    bestScore = participations[j].aiScore;
                    bestConversationId = participations[j].conversationId;
                }
            }
            
            usersData[i] = UserData({
                balance: userBalances[user],
                hasSufficientBalance: userBalances[user] >= castCost,
                hasParticipatedThisWeek: weeklyParticipations[currentWeek][user].length > 0,
                participationsCount: weeklyParticipations[currentWeek][user].length,
                conversationCount: conversationCount,
                remainingConversations: remainingConversations,
                bestScore: bestScore,
                bestConversationId: bestConversationId,
                totalContributions: userContributions[user],
                participations: weeklyParticipations[currentWeek][user]
            });
        }
        
        return usersData;
    }
    
    /**
     * @dev Get weekly summary data
     * @param week Week number
     */
    function getWeeklySummary(uint256 week) external view returns (
        address[] memory participants,
        address winner,
        uint256 prize,
        uint256 participantsCount
    ) {
        return (
            weeklyParticipants[week],
            weeklyWinners[week],
            weeklyPrizes[week],
            weeklyParticipants[week].length
        );
    }
    
    /**
     * @dev Get current week's AI character
     */
    function getCurrentCharacter() external view returns (
        string memory name,
        string memory task,
        string[5] memory traitNames,
        uint8[5] memory traitValues,
        uint8 traitCount,
        bool isSet
    ) {
        AICharacter memory character = weeklyCharacters[currentWeek];
        return (
            character.name,
            character.task,
            character.traitNames,
            character.traitValues,
            character.traitCount,
            character.isSet
        );
    }
    
    /**
     * @dev Get AI character for specific week
     * @param week Week number
     */
    function getWeeklyCharacter(uint256 week) external view returns (
        string memory name,
        string memory task,
        string[5] memory traitNames,
        uint8[5] memory traitValues,
        uint8 traitCount,
        bool isSet
    ) {
        AICharacter memory character = weeklyCharacters[week];
        return (
            character.name,
            character.task,
            character.traitNames,
            character.traitValues,
            character.traitCount,
            character.isSet
        );
    }
    

    
    /**
     * @dev Set cast cost (only owner)
     * @param newCastCost New cost for each cast in USDC (6 decimals)
     */
    function setCastCost(uint256 newCastCost) external onlyOwner {
        if (newCastCost == 0) revert InvalidAmount();
        
        uint256 oldCastCost = castCost;
        castCost = newCastCost;
        
        emit CastCostUpdated(oldCastCost, newCastCost);
    }
    
    /**
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdraw (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = usdcToken.balanceOf(address(this));
        if (balance > 0) {
            if (!usdcToken.transfer(owner(), balance)) {
                revert TransferFailed();
            }
        }
    }
}
