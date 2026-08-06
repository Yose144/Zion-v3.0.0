// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ZDXToken} from "./ZDXToken.sol";

/// @title ZionDexStaking
/// @notice LP staking for ZDX rewards — stake LP tokens, earn ZDX
contract ZionDexStaking {
    ZDXToken public immutable zdx;

    /// @notice Staking position
    struct Position {
        uint256 stakedAmount;
        uint256 rewardDebt;
        uint256 lastUpdateTime;
    }

    /// @notice Staker positions
    mapping(address => Position) public positions;

    /// @notice Total staked amount
    uint256 public totalStaked;

    /// @notice Reward rate per second (ZDX per second)
    uint256 public rewardRatePerSecond;

    /// @notice Accumulated reward per share (multiplied by 1e18)
    uint256 public accRewardPerShare;

    /// @notice Last update time for reward accumulation
    uint256 public lastRewardTime;

    /// @notice Owner (for adjusting reward rate)
    address public owner;

    // ── Events ─────────────────────────────────────────────────────────

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);

    // ── Constructor ────────────────────────────────────────────────────

    constructor(address _zdx) {
        zdx = ZDXToken(_zdx);
        owner = msg.sender;
        rewardRatePerSecond = 1 * 1e18 / 100; // 0.01 ZDX/s per staked token
        lastRewardTime = block.timestamp;
    }

    // ── Modifier ───────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    // ── Core ───────────────────────────────────────────────────────────

    /// @notice Stake LP tokens
    /// @param amount Amount to stake
    function stake(uint256 amount) external {
        require(amount > 0, "ZERO_AMOUNT");

        _updateRewards();

        Position storage pos = positions[msg.sender];
        pos.stakedAmount += amount;
        pos.rewardDebt = pos.stakedAmount * accRewardPerShare / 1e18;

        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /// @notice Unstake LP tokens
    /// @param amount Amount to unstake
    function unstake(uint256 amount) external {
        Position storage pos = positions[msg.sender];
        require(pos.stakedAmount >= amount, "INSUFFICIENT_STAKE");

        _updateRewards();

        // Claim pending rewards
        _claimRewards(pos);

        pos.stakedAmount -= amount;
        pos.rewardDebt = pos.stakedAmount * accRewardPerShare / 1e18;

        totalStaked -= amount;

        emit Unstaked(msg.sender, amount);
    }

    /// @notice Claim accumulated rewards
    function claimRewards() external {
        _updateRewards();
        Position storage pos = positions[msg.sender];
        _claimRewards(pos);
        pos.rewardDebt = pos.stakedAmount * accRewardPerShare / 1e18;
    }

    /// @notice Get pending rewards for a staker
    function pendingRewards(address user) external view returns (uint256) {
        Position storage pos = positions[user];
        if (totalStaked == 0) return 0;

        uint256 timeElapsed = block.timestamp - lastRewardTime;
        uint256 reward = timeElapsed * rewardRatePerSecond * totalStaked;
        uint256 newAccPerShare = accRewardPerShare + reward / totalStaked;

        return pos.stakedAmount * newAccPerShare / 1e18 - pos.rewardDebt;
    }

    // ── Admin ──────────────────────────────────────────────────────────

    /// @notice Update reward rate (only owner)
    function setRewardRate(uint256 newRate) external onlyOwner {
        _updateRewards();
        rewardRatePerSecond = newRate;
        emit RewardRateUpdated(newRate);
    }

    // ── Internal ───────────────────────────────────────────────────────

    function _updateRewards() internal {
        if (totalStaked == 0) {
            lastRewardTime = block.timestamp;
            return;
        }

        uint256 timeElapsed = block.timestamp - lastRewardTime;
        if (timeElapsed == 0) return;

        uint256 reward = timeElapsed * rewardRatePerSecond * totalStaked;
        accRewardPerShare += reward / totalStaked;
        lastRewardTime = block.timestamp;
    }

    function _claimRewards(Position storage pos) internal {
        uint256 pending = pos.stakedAmount * accRewardPerShare / 1e18 - pos.rewardDebt;
        if (pending > 0) {
            // Mint ZDX rewards to staker
            // Note: staking contract must be the owner of ZDXToken for minting
            zdx.mint(msg.sender, pending);
            emit RewardsClaimed(msg.sender, pending);
        }
    }
}
