// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZDXToken} from "./interfaces/IZDXToken.sol";

/// @title SolverRegistry
/// @notice Registry for ZION DEX solvers — stake ZDX, get slashed on failure
/// @dev Solvers stake ZDX to participate in intent-based execution. Misbehavior
///      results in a slash of a percentage of their stake; repeated slashes ban them.
contract SolverRegistry {
    // ── State ──────────────────────────────────────────────────────────

    /// @notice Information tracked per solver
    struct SolverInfo {
        bool active;
        uint256 stakeAmount;
        uint256 registeredAt;
        uint256 slashedCount;
        uint256 totalExecutions;
        uint256 totalVolume; // in USD or wZION equivalent
    }

    /// @notice Solver info by address
    mapping(address => SolverInfo) public solvers;

    /// @notice List of all registered solver addresses (active and banned)
    address[] public solverList;

    /// @notice Minimum ZDX stake required to be a solver (default: 10_000 * 1e18)
    uint256 public minStake;

    /// @notice Percentage of stake slashed on failure (in bps, default: 1000 = 10%)
    uint256 public slashPercentage;

    /// @notice Number of slashes before a solver is permanently banned (default: 3)
    uint256 public maxSlashesBeforeBan;

    /// @notice ZDX token used for staking
    IZDXToken public zdxToken;

    /// @notice Contract owner (admin who can slash)
    address public owner;

    /// @notice Authorized settlement contract that can record executions
    address public settlementContract;

    // ── Events ─────────────────────────────────────────────────────────

    event SolverRegistered(address indexed solver, uint256 stake);
    event SolverUnregistered(address indexed solver);
    event SolverSlashed(address indexed solver, uint256 amount, string reason);
    event StakeUpdated(address indexed solver, uint256 newStake);
    event MinStakeUpdated(uint256 newMinStake);
    event SlashPercentageUpdated(uint256 newSlashPercentage);
    event MaxSlashesUpdated(uint256 newMaxSlashes);
    event SettlementContractUpdated(address indexed settlementContract);

    // ── Errors ─────────────────────────────────────────────────────────

    error NotOwner();
    error NotSettlementContract();
    error ZeroAddress();
    error InsufficientStake();
    error NotActive();
    error AlreadyActive();
    error SolverBanned();
    error NoStake();
    error TransferFailed();

    // ── Modifier ───────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlySettlementContract() {
        if (msg.sender != settlementContract) revert NotSettlementContract();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────

    /// @param _zdxToken Address of the ZDX token contract
    constructor(address _zdxToken) {
        if (_zdxToken == address(0)) revert ZeroAddress();
        zdxToken = IZDXToken(_zdxToken);
        owner = msg.sender;
        minStake = 10_000 * 1e18;
        slashPercentage = 1000; // 10% in bps
        maxSlashesBeforeBan = 3;
    }

    // ── Solver Management ──────────────────────────────────────────────

    /// @notice Register as a solver by staking ZDX
    /// @param stakeAmount Amount of ZDX to stake (must be >= minStake)
    function register(uint256 stakeAmount) external {
        if (stakeAmount < minStake) revert InsufficientStake();
        SolverInfo storage info = solvers[msg.sender];
        if (info.active) revert AlreadyActive();
        if (info.slashedCount >= maxSlashesBeforeBan) revert SolverBanned();

        // Pull ZDX from the solver
        if (!zdxToken.transferFrom(msg.sender, address(this), stakeAmount)) revert TransferFailed();

        info.active = true;
        info.stakeAmount = stakeAmount;
        info.registeredAt = block.timestamp;

        solverList.push(msg.sender);

        emit SolverRegistered(msg.sender, stakeAmount);
    }

    /// @notice Unregister as a solver and unstake full ZDX balance
    function unregister() external {
        SolverInfo storage info = solvers[msg.sender];
        if (!info.active) revert NotActive();
        if (info.stakeAmount == 0) revert NoStake();

        uint256 refund = info.stakeAmount;
        info.active = false;
        info.stakeAmount = 0;

        if (!zdxToken.transfer(msg.sender, refund)) revert TransferFailed();

        emit SolverUnregistered(msg.sender);
    }

    /// @notice Add more stake to an existing active solver position
    /// @param amount Additional ZDX to stake
    function addStake(uint256 amount) external {
        if (amount == 0) revert InsufficientStake();
        SolverInfo storage info = solvers[msg.sender];
        if (!info.active) revert NotActive();

        if (!zdxToken.transferFrom(msg.sender, address(this), amount)) revert TransferFailed();

        info.stakeAmount += amount;

        emit StakeUpdated(msg.sender, info.stakeAmount);
    }

    // ── Admin: Slashing ────────────────────────────────────────────────

    /// @notice Slash a solver for failed execution (only owner)
    /// @param solver Address of the solver to slash
    /// @param reason Human-readable reason for the slash
    function slash(address solver, string calldata reason) external onlyOwner {
        SolverInfo storage info = solvers[solver];
        if (info.stakeAmount == 0) revert NoStake();

        uint256 slashAmount = info.stakeAmount * slashPercentage / 10_000;
        if (slashAmount > info.stakeAmount) slashAmount = info.stakeAmount;

        info.stakeAmount -= slashAmount;
        info.slashedCount += 1;

        // Burn the slashed ZDX (removed from supply)
        zdxToken.burn(slashAmount);

        // Ban solver if they exceeded the slash threshold
        if (info.slashedCount >= maxSlashesBeforeBan) {
            info.active = false;
        }

        emit SolverSlashed(solver, slashAmount, reason);
    }

    // ── View ───────────────────────────────────────────────────────────

    /// @notice Check whether a solver is currently active
    /// @param solver Address to check
    /// @return True if the solver is active
    function isSolverActive(address solver) external view returns (bool) {
        return solvers[solver].active;
    }

    /// @notice Get the list of all currently active solvers
    /// @return Array of active solver addresses
    function getActiveSolvers() external view returns (address[] memory) {
        uint256 count = 0;
        uint256 len = solverList.length;
        for (uint256 i = 0; i < len; i++) {
            if (solvers[solverList[i]].active) {
                count++;
            }
        }
        address[] memory active = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < len; i++) {
            if (solvers[solverList[i]].active) {
                active[idx] = solverList[i];
                idx++;
            }
        }
        return active;
    }

    /// @notice Total number of solvers ever registered (active + inactive)
    /// @return Length of the solver list
    function solverCount() external view returns (uint256) {
        return solverList.length;
    }

    // ── Admin: Config ──────────────────────────────────────────────────

    /// @notice Update the minimum stake required to register (only owner)
    /// @param _minStake New minimum stake amount
    function setMinStake(uint256 _minStake) external onlyOwner {
        minStake = _minStake;
        emit MinStakeUpdated(_minStake);
    }

    /// @notice Update the slash percentage in bps (only owner)
    /// @param _slashPercentage New slash percentage (e.g. 1000 = 10%)
    function setSlashPercentage(uint256 _slashPercentage) external onlyOwner {
        require(_slashPercentage <= 10_000, "SLASH_TOO_HIGH");
        slashPercentage = _slashPercentage;
        emit SlashPercentageUpdated(_slashPercentage);
    }

    /// @notice Update the max slashes before a solver is banned (only owner)
    /// @param _maxSlashes New max slashes threshold
    function setMaxSlashesBeforeBan(uint256 _maxSlashes) external onlyOwner {
        maxSlashesBeforeBan = _maxSlashes;
        emit MaxSlashesUpdated(_maxSlashes);
    }

    /// @notice Record a successful execution by a solver (only settlement contract)
    /// @param solver Address of the solver
    /// @param volume Volume of the execution in wZION equivalent
    function recordExecution(address solver, uint256 volume) external onlySettlementContract {
        SolverInfo storage info = solvers[solver];
        if (!info.active) revert NotActive();
        info.totalExecutions += 1;
        info.totalVolume += volume;
    }

    /// @notice Set the authorized settlement contract (only owner)
    /// @param _settlementContract Address of the IntentSettlement contract
    function setSettlementContract(address _settlementContract) external onlyOwner {
        if (_settlementContract == address(0)) revert ZeroAddress();
        settlementContract = _settlementContract;
        emit SettlementContractUpdated(_settlementContract);
    }
}
