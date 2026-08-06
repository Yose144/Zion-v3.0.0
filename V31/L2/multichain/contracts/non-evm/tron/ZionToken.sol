// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ZionToken — ZION TRC-20 Token (Tron)
 * @author ZION TerraNova Core Team
 * @notice Wrapped ZION token on Tron, implementing the TRC-20 standard.
 *         1 ZION = 1 ZION locked on L1 bridge address.
 *         Only the WARP bridge contract can mint/burn.
 *
 * @dev TRC-20 is functionally identical to ERC-20 but uses Tron-specific
 *      naming conventions. This contract is compiled with Solidity and
 *      deployed on the Tron Virtual Machine (TVM).
 *
 * ZION L1 parameters (mirrored):
 *   - Total supply cap:  144,000,000,000 ZION (144B)
 *   - Decimals:          6 (matching L1 atomic units: 1 ZION = 1,000,000 atomic)
 *   - Symbol:            ZION
 *   - Name:              ZION
 *
 * Security model:
 *   - BRIDGE_ROLE can mint (on L1 lock proof) and burn (on L1 unlock request)
 *   - GUARDIAN_ROLE can pause/unpause in emergencies
 *   - DEFAULT_ADMIN_ROLE manages role assignments (multisig)
 *   - 5/5 WARP validator quorum required for bridge operations
 */
contract ZionToken {

    // ──────────────────────────────────────────────
    //  TRC-20 Token metadata
    // ──────────────────────────────────────────────

    string public constant name = "ZION";
    string public constant symbol = "ZION";
    uint8 public constant decimals = 6;

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    /// @notice Maximum supply that can ever be minted (matches L1 total supply)
    uint256 public constant MAX_SUPPLY = 144_000_000_000 * 1e6; // 144B ZION

    /// @notice Minimum mint/burn amount to prevent dust attacks
    uint256 public constant MIN_BRIDGE_AMOUNT = 100 * 1e6; // 100 ZION

    // ──────────────────────────────────────────────
    //  Access control (simplified — no OZ on Tron)
    // ──────────────────────────────────────────────

    /// @notice Role identifiers (keccak256 hashes)
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;

    /// @notice Role → account → has role
    mapping(bytes32 => mapping(address => bool)) private _roles;

    /// @notice Role → admin role
    mapping(bytes32 => bytes32) private _roleAdmin;

    // ──────────────────────────────────────────────
    //  TRC-20 State
    // ──────────────────────────────────────────────

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;

    // ──────────────────────────────────────────────
    //  Bridge state
    // ──────────────────────────────────────────────

    /// @notice Total amount ever minted through bridge (audit trail)
    uint256 public totalBridgeMinted;

    /// @notice Total amount ever burned through bridge (audit trail)
    uint256 public totalBridgeBurned;

    /// @notice L1 lock TX hash → processed (replay protection)
    mapping(bytes32 => bool) public processedL1Locks;

    /// @notice Burn request ID → processed (replay protection)
    mapping(bytes32 => bool) public processedBurnRequests;

    /// @notice Emergency pause state
    bool public paused;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    event BridgeMint(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed l1TxHash,
        uint256 timestamp
    );

    event BridgeBurn(
        address indexed from,
        uint256 amount,
        string l1Recipient,
        bytes32 indexed burnId,
        uint256 timestamp
    );

    event EmergencyPause(address indexed guardian, string reason);
    event EmergencyUnpause(address indexed guardian);

    event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender);
    event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error ExceedsMaxSupply(uint256 requested, uint256 available);
    error BelowMinBridgeAmount(uint256 amount, uint256 minimum);
    error L1LockAlreadyProcessed(bytes32 l1TxHash);
    error BurnRequestAlreadyProcessed(bytes32 burnId);
    error InvalidL1Address(string l1Address);
    error ZeroAddress();
    error ZeroAmount();
    error EnforcedPause();
    error ExpectedPause();
    error Unauthorized(bytes32 role);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyRole(bytes32 role) {
        if (!_roles[role][msg.sender]) revert Unauthorized(role);
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert EnforcedPause();
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    /**
     * @param admin    Multisig address that manages roles (3-of-5 recommended)
     * @param bridge   Bridge relay contract address
     * @param guardian Emergency pause address (can be same multisig)
     */
    constructor(
        address admin,
        address bridge,
        address guardian
    ) {
        if (admin == address(0) || bridge == address(0) || guardian == address(0)) {
            revert ZeroAddress();
        }

        _roleAdmin[BRIDGE_ROLE] = DEFAULT_ADMIN_ROLE;
        _roleAdmin[GUARDIAN_ROLE] = DEFAULT_ADMIN_ROLE;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BRIDGE_ROLE, bridge);
        _grantRole(GUARDIAN_ROLE, guardian);
    }

    // ──────────────────────────────────────────────
    //  TRC-20 functions
    // ──────────────────────────────────────────────

    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function transfer(address to, uint256 amount) external whenNotPaused returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external whenNotPaused returns (bool) {
        uint256 currentAllowance = _allowances[from][msg.sender];
        if (currentAllowance < amount) {
            revert Unauthorized(0);
        }
        unchecked {
            _approve(from, msg.sender, currentAllowance - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    // ──────────────────────────────────────────────
    //  Bridge functions (BRIDGE_ROLE only)
    // ──────────────────────────────────────────────

    /**
     * @notice Mint ZION when ZION is locked on L1 bridge address.
     *         Called by bridge relay after L1 lock confirmation (≥60 blocks finality).
     * @param recipient  Tron address to receive ZION
     * @param amount     Amount of ZION to mint (1:1 with locked ZION on L1)
     * @param l1TxHash   Hash of the L1 lock transaction (replay protection)
     */
    function bridgeMint(
        address recipient,
        uint256 amount,
        bytes32 l1TxHash
    ) external onlyRole(BRIDGE_ROLE) whenNotPaused {
        if (recipient == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (amount < MIN_BRIDGE_AMOUNT) revert BelowMinBridgeAmount(amount, MIN_BRIDGE_AMOUNT);
        if (processedL1Locks[l1TxHash]) revert L1LockAlreadyProcessed(l1TxHash);
        if (_totalSupply + amount > MAX_SUPPLY) {
            revert ExceedsMaxSupply(amount, MAX_SUPPLY - _totalSupply);
        }

        processedL1Locks[l1TxHash] = true;
        totalBridgeMinted += amount;

        _mint(recipient, amount);

        emit BridgeMint(recipient, amount, l1TxHash, block.timestamp);
    }

    /**
     * @notice Burn ZION to unlock native ZION on L1.
     *         User calls this → bridge relay observes event → unlocks on L1.
     * @param amount       Amount of ZION to burn
     * @param l1Recipient  ZION L1 bech32 address (e.g. "zion1...")
     * @param burnId       Unique ID for this burn request (client-generated)
     */
    function bridgeBurn(
        uint256 amount,
        string calldata l1Recipient,
        bytes32 burnId
    ) external whenNotPaused {
        if (amount == 0) revert ZeroAmount();
        if (amount < MIN_BRIDGE_AMOUNT) revert BelowMinBridgeAmount(amount, MIN_BRIDGE_AMOUNT);
        if (processedBurnRequests[burnId]) revert BurnRequestAlreadyProcessed(burnId);
        if (!_isValidL1Address(l1Recipient)) revert InvalidL1Address(l1Recipient);

        processedBurnRequests[burnId] = true;
        totalBridgeBurned += amount;

        _burn(msg.sender, amount);

        emit BridgeBurn(msg.sender, amount, l1Recipient, burnId, block.timestamp);
    }

    // ──────────────────────────────────────────────
    //  Guardian functions (emergency)
    // ──────────────────────────────────────────────

    function emergencyPause(string calldata reason) external onlyRole(GUARDIAN_ROLE) {
        paused = true;
        emit EmergencyPause(msg.sender, reason);
    }

    function emergencyUnpause() external onlyRole(GUARDIAN_ROLE) {
        paused = false;
        emit EmergencyUnpause(msg.sender);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    function mintableSupply() external view returns (uint256) {
        return MAX_SUPPLY - _totalSupply;
    }

    function bridgeStats() external view returns (
        uint256 minted,
        uint256 burned,
        uint256 outstanding,
        uint256 supply,
        uint256 maxSupply
    ) {
        return (
            totalBridgeMinted,
            totalBridgeBurned,
            totalBridgeMinted - totalBridgeBurned,
            _totalSupply,
            MAX_SUPPLY
        );
    }

    function isL1LockProcessed(bytes32 l1TxHash) external view returns (bool) {
        return processedL1Locks[l1TxHash];
    }

    function hasRole(bytes32 role, address account) external view returns (bool) {
        return _roles[role][account];
    }

    // ──────────────────────────────────────────────
    //  Role management
    // ──────────────────────────────────────────────

    function grantRole(bytes32 role, address account) external onlyRole(_roleAdmin[role]) {
        _grantRole(role, account);
    }

    function revokeRole(bytes32 role, address account) external onlyRole(_roleAdmin[role]) {
        _revokeRole(role, account);
    }

    // ──────────────────────────────────────────────
    //  Internal helpers
    // ──────────────────────────────────────────────

    function _transfer(address from, address to, uint256 amount) internal {
        if (from == address(0) || to == address(0)) revert ZeroAddress();
        if (_balances[from] < amount) revert Unauthorized(0);

        unchecked {
            _balances[from] -= amount;
            _balances[to] += amount;
        }

        emit Transfer(from, to, amount);
    }

    function _mint(address account, uint256 amount) internal {
        _totalSupply += amount;
        unchecked {
            _balances[account] += amount;
        }
        emit Transfer(address(0), account, amount);
    }

    function _burn(address account, uint256 amount) internal {
        if (_balances[account] < amount) revert Unauthorized(0);

        unchecked {
            _balances[account] -= amount;
            _totalSupply -= amount;
        }
        emit Transfer(account, address(0), amount);
    }

    function _approve(address owner, address spender, uint256 amount) internal {
        if (owner == address(0) || spender == address(0)) revert ZeroAddress();
        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _grantRole(bytes32 role, address account) internal {
        _roles[role][account] = true;
        emit RoleGranted(role, account, msg.sender);
    }

    function _revokeRole(bytes32 role, address account) internal {
        _roles[role][account] = false;
        emit RoleRevoked(role, account, msg.sender);
    }

    /**
     * @dev Basic ZION L1 address validation.
     *      ZION addresses start with "zion1" and are 44-62 characters (bech32).
     */
    function _isValidL1Address(string calldata addr) internal pure returns (bool) {
        bytes memory b = bytes(addr);
        if (b.length < 40 || b.length > 62) return false;
        if (b[0] != 'z' || b[1] != 'i' || b[2] != 'o' || b[3] != 'n' || b[4] != '1') {
            return false;
        }
        return true;
    }
}
