// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LoveallPrizePool
 * @dev Smart contract for managing the Loveall flirting bot prize pool
 * Users pay 1 USDC per cast, weekly winner gets 90% of pool, 10% rolls over
 */
contract LoveallPrizePool is Ownable, Pausable, ReentrancyGuard {
    // USDC token contract
    IERC20 public immutable usdcToken;
    
    // Constants
    uint256 public constant CAST_COST = 1e4; // 0.01 USDC (1 cent) (6 decimals)
    uint256 public constant WINNER_PERCENTAGE = 90; // 90% to winner
    uint256 public constant ROLLOVER_PERCENTAGE = 10; // 10% rollover
    
    // Weekly cycle management
    uint256 public currentWeek;
    uint256 public weekStartTime;
    uint256 public constant WEEK_DURATION = 2 hours;
    
    // Prize pool tracking
    uint256 public totalPrizePool;
    uint256 public currentWeekPrizePool;
    uint256 public rolloverAmount;
    
    // User balances
    mapping(address => uint256) public userBalances;
    
    // Weekly participation tracking
    mapping(uint256 => address[]) public weeklyParticipants;
    mapping(uint256 => mapping(address => CastParticipation[])) public weeklyParticipations;
    mapping(uint256 => mapping(address => bool)) public hasParticipatedThisWeek;
    
    // Winner tracking
    mapping(uint256 => address) public weeklyWinners;
    mapping(uint256 => uint256) public weeklyPrizes;
    
    // Struct for cast participation
    struct CastParticipation {
        address user;
        bytes32 castHash;
        uint256 timestamp;
        uint256 weekNumber;
        uint256 usdcAmount;
        bool isEvaluated;
    }
    
    // Events
    event BalanceToppedUp(address indexed user, uint256 amount);
    event BalanceWithdrawn(address indexed user, uint256 amount);
    event CastParticipated(address indexed user, bytes32 castHash, uint256 cost);
    event WinnerSelected(address indexed winner, uint256 prize, uint256 week);
    event NewWeekStarted(uint256 weekNumber, uint256 rolloverAmount);
    event PrizeDistributed(address indexed winner, uint256 prize, uint256 rollover);
    
    // Errors
    error InsufficientBalance();
    error InvalidAmount();
    error WeekNotEnded();
    error NoParticipants();
    error AlreadyParticipated();
    error TransferFailed();
    
    /**
     * @dev Constructor
     * @param _usdcToken USDC token contract address
     * @param _owner Contract owner address
     */
    constructor(address _usdcToken, address _owner) Ownable(_owner) {
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
     * @dev Participate in cast (called by bot)
     * @param user User address
     * @param castHash Hash of the cast
     */
    function participateInCast(address user, bytes32 castHash) 
        external 
        whenNotPaused 
        onlyOwner 
    {
        if (userBalances[user] < CAST_COST) {
            revert InsufficientBalance();
        }
        
        if (hasParticipatedThisWeek[currentWeek][user]) {
            revert AlreadyParticipated();
        }
        
        // Deduct balance and add to prize pool
        userBalances[user] -= CAST_COST;
        currentWeekPrizePool += CAST_COST;
        totalPrizePool += CAST_COST;
        
        // Track participation
        CastParticipation memory participation = CastParticipation({
            user: user,
            castHash: castHash,
            timestamp: block.timestamp,
            weekNumber: currentWeek,
            usdcAmount: CAST_COST,
            isEvaluated: false
        });
        
        weeklyParticipations[currentWeek][user].push(participation);
        weeklyParticipants[currentWeek].push(user);
        hasParticipatedThisWeek[currentWeek][user] = true;
        
        emit CastParticipated(user, castHash, CAST_COST);
    }
    
    /**
     * @dev Set weekly winner (called by admin based on Grok evaluation)
     * @param winner Winner address
     */
    function setWeeklyWinner(address winner) external onlyOwner {
        if (currentWeekPrizePool == 0) {
            revert NoParticipants();
        }
        
        weeklyWinners[currentWeek] = winner;
        weeklyPrizes[currentWeek] = (currentWeekPrizePool * WINNER_PERCENTAGE) / 100;
        
        emit WinnerSelected(winner, weeklyPrizes[currentWeek], currentWeek);
    }
    
    /**
     * @dev Distribute prize to winner and rollover amount
     */
    function distributePrize() external onlyOwner nonReentrant {
        address winner = weeklyWinners[currentWeek];
        uint256 prize = weeklyPrizes[currentWeek];
        
        if (winner == address(0) || prize == 0) {
            revert InvalidAmount();
        }
        
        // Calculate rollover amount
        uint256 rollover = currentWeekPrizePool - prize;
        
        // Transfer prize to winner
        if (!usdcToken.transfer(winner, prize)) {
            revert TransferFailed();
        }
        
        // Update rollover amount
        rolloverAmount += rollover;
        
        // Reset current week prize pool
        currentWeekPrizePool = 0;
        
        emit PrizeDistributed(winner, prize, rollover);
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
    

    
    // Struct for common data (prize pool, weekly info)
    struct CommonData {
        uint256 totalPrizePool;
        uint256 currentWeekPrizePool;
        uint256 rolloverAmount;
        uint256 currentWeek;
        uint256 weekStartTime;
        uint256 weekEndTime;
        uint256 currentWeekParticipantsCount;
        address currentWeekWinner;
        uint256 currentWeekPrize;
    }
    
    // Struct for user-specific data
    struct UserData {
        uint256 balance;
        bool hasSufficientBalance;
        bool hasParticipatedThisWeek;
        uint256 participationsCount;
        CastParticipation[] participations;
    }
    
    /**
     * @dev Get all common data in one call (for frontend/dashboard)
     */
    function getCommonData() external view returns (CommonData memory) {
        return CommonData({
            totalPrizePool: totalPrizePool,
            currentWeekPrizePool: currentWeekPrizePool,
            rolloverAmount: rolloverAmount,
            currentWeek: currentWeek,
            weekStartTime: weekStartTime,
            weekEndTime: weekStartTime + WEEK_DURATION,
            currentWeekParticipantsCount: weeklyParticipants[currentWeek].length,
            currentWeekWinner: weeklyWinners[currentWeek],
            currentWeekPrize: weeklyPrizes[currentWeek]
        });
    }
    
    /**
     * @dev Get all user-specific data in one call
     * @param user User address
     */
    function getUserData(address user) external view returns (UserData memory) {
        return UserData({
            balance: userBalances[user],
            hasSufficientBalance: userBalances[user] >= CAST_COST,
            hasParticipatedThisWeek: hasParticipatedThisWeek[currentWeek][user],
            participationsCount: weeklyParticipations[currentWeek][user].length,
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
            usersData[i] = UserData({
                balance: userBalances[user],
                hasSufficientBalance: userBalances[user] >= CAST_COST,
                hasParticipatedThisWeek: hasParticipatedThisWeek[currentWeek][user],
                participationsCount: weeklyParticipations[currentWeek][user].length,
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
    
    // Legacy functions for backward compatibility (deprecated)
    /**
     * @dev Get current prize pool amount (deprecated - use getCommonData)
     */
    function getCurrentPrizePool() external view returns (uint256) {
        return totalPrizePool;
    }
    
    /**
     * @dev Get current week's prize pool (deprecated - use getCommonData)
     */
    function getWeeklyPrizePool() external view returns (uint256) {
        return currentWeekPrizePool;
    }
    
    /**
     * @dev Get rollover amount (deprecated - use getCommonData)
     */
    function getRolloverAmount() external view returns (uint256) {
        return rolloverAmount;
    }
    
    /**
     * @dev Get current week number (deprecated - use getCommonData)
     */
    function getCurrentWeek() external view returns (uint256) {
        return currentWeek;
    }
    
    /**
     * @dev Get week end time (deprecated - use getCommonData)
     */
    function getWeekEndTime() external view returns (uint256) {
        return weekStartTime + WEEK_DURATION;
    }
    
    /**
     * @dev Get user balance (deprecated - use getUserData)
     */
    function getBalance(address user) external view returns (uint256) {
        return userBalances[user];
    }
    
    /**
     * @dev Check if user has sufficient balance (deprecated - use getUserData)
     */
    function hasSufficientBalance(address user) external view returns (bool) {
        return userBalances[user] >= CAST_COST;
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
