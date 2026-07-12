// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {SolverRegistry} from "./SolverRegistry.sol";

/// @title IntentSettlement
/// @notice Settles SwapIntents — verifies user signature, executes swap via solver, handles slashing
/// @dev Uses EIP-712 typed data for intent signatures. Solvers registered in SolverRegistry
///      submit settlements on-chain after fulfilling the user's intent off-chain.
contract IntentSettlement {
    // ── Types ──────────────────────────────────────────────────────────

    /// @notice A user's cross-chain swap intent
    struct SwapIntent {
        address user;
        uint256 nonce;
        string fromChain;
        string toChain;
        address fromToken; // on this chain
        address toToken; // on this chain (or bridge destination)
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
    }

    /// @notice Record of a settled intent
    struct Settlement {
        bytes32 intentHash;
        address solver;
        uint256 amountOut;
        uint256 executedAt;
        bytes32 txHash;
    }

    // ── State ──────────────────────────────────────────────────────────

    /// @notice Solver registry used to verify solver eligibility
    SolverRegistry public solverRegistry;

    /// @notice Settlement record by intent hash
    mapping(bytes32 => Settlement) public settlements;

    /// @notice Next nonce per user
    mapping(address => uint256) public userNonces;

    /// @notice Replay protection — intent hashes that have been executed
    mapping(bytes32 => bool) public executedIntents;

    /// @notice Solver fee in basis points (default: 10 = 0.1%)
    uint256 public solverFeeBps;

    /// @notice Address that collects solver fees
    address public feeRecipient;

    /// @notice Contract owner
    address public owner;

    // ── EIP-712 Constants ──────────────────────────────────────────────

    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    bytes32 private constant SWAP_INTENT_TYPEHASH = keccak256(
        "SwapIntent(address user,uint256 nonce,string fromChain,string toChain,address fromToken,address toToken,uint256 amountIn,uint256 minAmountOut,uint256 deadline)"
    );

    // ── Events ─────────────────────────────────────────────────────────

    event IntentSettled(
        bytes32 indexed intentHash,
        address indexed user,
        address indexed solver,
        uint256 amountIn,
        uint256 amountOut
    );
    event IntentSlashed(bytes32 indexed intentHash, address indexed solver, string reason);
    event SolverFeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    // ── Errors ─────────────────────────────────────────────────────────

    error NotOwner();
    error NotActiveSolver();
    error InvalidSignature();
    error DeadlineExpired();
    error InsufficientOutput();
    error AlreadyExecuted();
    error NonceMismatch();
    error ZeroAddress();

    // ── Modifier ───────────────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────

    /// @param _solverRegistry Address of the SolverRegistry contract
    constructor(address _solverRegistry) {
        if (_solverRegistry == address(0)) revert ZeroAddress();
        solverRegistry = SolverRegistry(_solverRegistry);
        owner = msg.sender;
        solverFeeBps = 10; // 0.1%
        feeRecipient = msg.sender;
    }

    // ── Settlement ─────────────────────────────────────────────────────

    /// @notice Settle a user's swap intent (only callable by active solvers)
    /// @param intent The signed SwapIntent
    /// @param userSignature User's EIP-712 signature over the intent
    /// @param amountOut Actual output amount the solver delivered
    /// @param proof Execution proof (tx receipt hash or witness) — logged for attestation
    function settleIntent(
        SwapIntent calldata intent,
        bytes calldata userSignature,
        uint256 amountOut,
        bytes calldata proof
    ) external {
        // 1. Caller must be an active solver
        if (!solverRegistry.isSolverActive(msg.sender)) revert NotActiveSolver();

        // 2. Verify the user actually signed this intent
        if (!verifyIntentSignature(intent, userSignature)) revert InvalidSignature();

        // 3. Deadline must not have passed
        if (block.timestamp > intent.deadline) revert DeadlineExpired();

        // 4. Output must meet the user's minimum
        if (amountOut < intent.minAmountOut) revert InsufficientOutput();

        // 5. Compute intent hash and enforce replay protection (before nonce advance)
        bytes32 intentHash = hashIntent(intent);
        if (executedIntents[intentHash]) revert AlreadyExecuted();

        // 6. Nonce must match the user's expected next nonce
        if (intent.nonce != userNonces[intent.user]) revert NonceMismatch();

        // 7. Mark executed and advance nonce
        executedIntents[intentHash] = true;
        userNonces[intent.user] = intent.nonce + 1;

        // 8. Record settlement
        bytes32 proofHash = proof.length > 0 ? keccak256(proof) : bytes32(0);
        settlements[intentHash] = Settlement({
            intentHash: intentHash,
            solver: msg.sender,
            amountOut: amountOut,
            executedAt: block.timestamp,
            txHash: proofHash
        });

        // 9. Record execution stats on the solver registry
        solverRegistry.recordExecution(msg.sender, amountOut);

        emit IntentSettled(intentHash, intent.user, msg.sender, intent.amountIn, amountOut);
    }

    // ── EIP-712 ────────────────────────────────────────────────────────

    /// @notice Compute the EIP-712 typed data hash (the digest signed by the user)
    /// @param intent The SwapIntent to hash
    /// @return EIP-712 digest: keccak256("\x19\x01" || domainSeparator || structHash)
    function hashIntent(SwapIntent calldata intent) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                SWAP_INTENT_TYPEHASH,
                intent.user,
                intent.nonce,
                keccak256(bytes(intent.fromChain)),
                keccak256(bytes(intent.toChain)),
                intent.fromToken,
                intent.toToken,
                intent.amountIn,
                intent.minAmountOut,
                intent.deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    /// @notice Verify that a signature was produced by the intent's user over the EIP-712 digest
    /// @param intent The SwapIntent
    /// @param sig The signature to verify
    /// @return True if the signature is valid and recovers to intent.user
    function verifyIntentSignature(SwapIntent calldata intent, bytes calldata sig)
        public
        view
        returns (bool)
    {
        bytes32 digest = hashIntent(intent);
        (address recovered, ECDSAError err,) = _tryRecover(digest, sig);
        if (err != ECDSAError.NoError) return false;
        return recovered == intent.user;
    }

    /// @notice EIP-712 domain separator for this contract
    /// @return The domain separator hash
    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("ZionDex")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ── View ───────────────────────────────────────────────────────────

    /// @notice Check whether an intent has been settled
    /// @param intentHash Hash of the intent
    /// @return True if the intent has been executed
    function isSettled(bytes32 intentHash) external view returns (bool) {
        return executedIntents[intentHash];
    }

    // ── Admin ──────────────────────────────────────────────────────────

    /// @notice Update the solver fee in basis points (only owner)
    /// @param _feeBps New fee in bps (max 1000 = 10%)
    function setSolverFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "FEE_TOO_HIGH");
        solverFeeBps = _feeBps;
        emit SolverFeeUpdated(_feeBps);
    }

    /// @notice Update the fee recipient (only owner)
    /// @param _feeRecipient New fee recipient address
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        feeRecipient = _feeRecipient;
        emit FeeRecipientUpdated(_feeRecipient);
    }

    // ── Internal: minimal ECDSA recovery ───────────────────────────────

    enum ECDSAError { NoError, InvalidSignatureLength, InvalidSignatureS, InvalidSignatureV }

    /// @dev Minimal ecrecover wrapper with basic validation. Avoids importing OZ.
    function _tryRecover(bytes32 hash, bytes calldata sig)
        internal
        pure
        returns (address recovered, ECDSAError err, bytes32 dummy)
    {
        if (sig.length != 65) {
            return (address(0), ECDSAError.InvalidSignatureLength, bytes32(0));
        }
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        // EIP-2: s must be in lower half
        if (uint256(s) > 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0) {
            return (address(0), ECDSAError.InvalidSignatureS, bytes32(0));
        }
        if (v != 27 && v != 28) {
            return (address(0), ECDSAError.InvalidSignatureV, bytes32(0));
        }
        address signer = ecrecover(hash, v, r, s);
        return (signer, ECDSAError.NoError, bytes32(0));
    }
}
