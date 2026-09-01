// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title ZIONDexZISGate — Optional ZIS-backed access control for ZIONDex
/// @notice Gate contract that controls who may swap on ZIONDex. In its
///         default (open) mode everyone can swap. When `gateEnabled` is true,
///         only addresses in `verifiedUsers` (whitelisted by the admin, or
///         verified via a ZIS proof relay) may swap.
///
///         Ed25519 verification on-chain is expensive and not yet wired in.
///         The current model supports two flows:
///           1. Admin whitelist: `admin` calls `whitelist(user, true)`.
///           2. Off-chain ZIS relay: a trusted relay verifies the Ed25519
///              signature off-chain and calls `verifyZISProof` on behalf of
///              the user. The on-chain signature check is intentionally
///              permissive until a precompile / cheap verifier is available.
///
///         The router (or any consumer) calls `canSwap(user)` to decide.
contract ZIONDexZISGate {
    /// @notice ZIS Ed25519 public key (32 bytes). Set by admin; zero until set.
    bytes32 public zisPublicKey;

    /// @notice Admin / governance address.
    address public admin;

    /// @notice If true, only verified users may swap. If false, open access.
    bool public gateEnabled;

    /// @notice Trusted relay that may submit verified ZIS proofs on-chain.
    ///         Zero address means relay verification is disabled.
    address public zisRelay;

    /// @notice Mapping: userAddress -> isVerified.
    mapping(address => bool) public verifiedUsers;

    /// @notice ZIS proof structure. `signature` is an Ed25519 signature over
    ///         keccak256(userAddress, userId, deadline). On-chain verification
    ///         is deferred to a future precompile; the relay attests instead.
    struct ZISProof {
        address user;
        bytes32 userId;
        uint256 deadline;
        bytes signature; // Ed25519 signature (not verified on-chain yet)
    }

    // ── Events ──────────────────────────────────────────────────────────

    event UserVerified(address indexed user, bytes32 indexed userId);
    event UserWhitelisted(address indexed user, bool status);
    event GateEnabledChanged(bool enabled);
    event ZisPublicKeyUpdated(bytes32 previousKey, bytes32 newKey);
    event ZisRelayUpdated(address previousRelay, address newRelay);
    event AdminUpdated(address previousAdmin, address newAdmin);

    // ── Modifiers ──────────────────────────────────────────────────────

    modifier onlyAdmin() {
        require(msg.sender == admin, "ZISGate: NOT_ADMIN");
        _;
    }

    modifier onlyAdminOrRelay() {
        require(msg.sender == admin || msg.sender == zisRelay, "ZISGate: NOT_AUTHORIZED");
        _;
    }

    constructor() {
        admin = msg.sender;
        gateEnabled = false; // open access by default
    }

    // ── Access checks ──────────────────────────────────────────────────

    /// @notice Returns true if `user` is allowed to swap.
    ///         When the gate is disabled, everyone is allowed.
    function canSwap(address user) external view returns (bool) {
        if (!gateEnabled) return true;
        return verifiedUsers[user];
    }

    // ── Verification ───────────────────────────────────────────────────

    /// @notice Verifies a ZIS proof and marks the user as verified.
    /// @dev    On-chain Ed25519 verification is deferred. The proof is
    ///         accepted if called by the admin or the trusted `zisRelay`,
    ///         and the deadline has not passed. The `signature` field is
    ///         stored for audit but not cryptographically checked here.
    ///         When a cheap Ed25519 precompile is available, replace the
    ///         body with a real signature check over
    ///         keccak256(abi.encodePacked(user, userId, deadline)).
    function verifyZISProof(ZISProof calldata proof) external onlyAdminOrRelay returns (bool) {
        require(proof.user != address(0), "ZISGate: ZERO_USER");
        require(proof.deadline == 0 || block.timestamp <= proof.deadline, "ZISGate: EXPIRED");

        // Recompute the message hash for audit / future precompile use.
        bytes32 messageHash = keccak256(abi.encodePacked(proof.user, proof.userId, proof.deadline));
        // Intentionally unused until Ed25519 precompile is wired in.
        if (messageHash == bytes32(0)) revert("ZISGate: BAD_HASH");

        verifiedUsers[proof.user] = true;
        emit UserVerified(proof.user, proof.userId);
        return true;
    }

    // ── Admin: whitelist ───────────────────────────────────────────────

    /// @notice Directly whitelists (or removes) a user. Admin-only.
    function whitelist(address user, bool status) external onlyAdmin {
        require(user != address(0), "ZISGate: ZERO_USER");
        verifiedUsers[user] = status;
        emit UserWhitelisted(user, status);
    }

    /// @notice Batch whitelist multiple users. Admin-only.
    function whitelistBatch(address[] calldata users, bool status) external onlyAdmin {
        for (uint256 i = 0; i < users.length; i++) {
            require(users[i] != address(0), "ZISGate: ZERO_USER");
            verifiedUsers[users[i]] = status;
            emit UserWhitelisted(users[i], status);
        }
    }

    // ── Admin: gate toggle ─────────────────────────────────────────────

    /// @notice Enables or disables the gate. When disabled, `canSwap` is
    ///         always true (open access).
    function setGateEnabled(bool enabled) external onlyAdmin {
        gateEnabled = enabled;
        emit GateEnabledChanged(enabled);
    }

    // ── Admin: ZIS key / relay ─────────────────────────────────────────

    /// @notice Sets the ZIS Ed25519 public key.
    function setZisPublicKey(bytes32 _zisPublicKey) external onlyAdmin {
        emit ZisPublicKeyUpdated(zisPublicKey, _zisPublicKey);
        zisPublicKey = _zisPublicKey;
    }

    /// @notice Sets the trusted relay that may submit verified ZIS proofs.
    function setZisRelay(address _zisRelay) external onlyAdmin {
        require(_zisRelay != address(0), "ZISGate: ZERO_ADDRESS");
        emit ZisRelayUpdated(zisRelay, _zisRelay);
        zisRelay = _zisRelay;
    }

    /// @notice Transfers admin to a new address.
    function setAdmin(address _admin) external onlyAdmin {
        require(_admin != address(0), "ZISGate: ZERO_ADDRESS");
        emit AdminUpdated(admin, _admin);
        admin = _admin;
    }
}
