// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ZIONDexPair} from "./ZIONDexPair.sol";

/// @title ZIONDexFactory — Creates and registers AMM pairs
/// @notice Uniswap V2 factory clone with protocol fee support.
///         Each pair is a minimal AMM contract (ZIONDexPair) that holds two
///         ERC-20 tokens and mints LP tokens to liquidity providers.
contract ZIONDexFactory {
    /// @notice keccak256(token0, token1) -> pair address
    mapping(bytes32 => address) public getPair;

    /// @notice All pairs ever created, indexed by creation order.
    address[] public allPairs;

    /// @notice Protocol fee recipient (ZION treasury).
    address public feeTo;

    /// @notice Governance — only this address can set feeTo / feeToSetter / protocolFeeBps.
    address public feeToSetter;

    /// @notice Protocol fee in basis points, taken from the 0.3% swap fee.
    ///         e.g. 5 = 0.05% of the notional goes to `feeTo` as LP mint.
    ///         Capped at 250 (25% of the 0.3% fee = 0.075% notional).
    uint256 public protocolFeeBps;

    /// @notice Emitted when a new pair is created.
    event PairCreated(address indexed token0, address indexed token1, address pair, uint256 index);

    /// @notice Emitted when feeTo changes.
    event FeeToUpdated(address indexed previousFeeTo, address indexed newFeeTo);

    /// @notice Emitted when feeToSetter changes.
    event FeeToSetterUpdated(address indexed previousSetter, address indexed newSetter);

    /// @notice Emitted when protocolFeeBps changes.
    event ProtocolFeeBpsUpdated(uint256 previousBps, uint256 newBps);

    /// @notice Maximum protocol fee share (25% of the 0.3% swap fee).
    uint256 public constant MAX_PROTOCOL_FEE_BPS = 250;

    constructor() {
        feeToSetter = msg.sender;
        feeTo = msg.sender;
        protocolFeeBps = 5; // 0.05% protocol fee
    }

    // ── Modifiers ──────────────────────────────────────────────────────

    modifier onlyFeeToSetter() {
        require(msg.sender == feeToSetter, "ZIONDex: FORBIDDEN");
        _;
    }

    // ── Pair creation ──────────────────────────────────────────────────

    /// @notice Creates a new AMM pair for `tokenA` and `tokenB` if none exists.
    /// @param tokenA First ERC-20 token.
    /// @param tokenB Second ERC-20 token.
    /// @return pair Address of the newly created pair contract.
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "ZIONDex: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(token0 != address(0), "ZIONDex: ZERO_ADDRESS");

        bytes32 key = keccak256(abi.encodePacked(token0, token1));
        require(getPair[key] == address(0), "ZIONDex: PAIR_EXISTS");

        // Deploy a ZIONDexPair via CREATE2 with a deterministic salt.
        bytes memory bytecode = type(ZIONDexPair).creationCode;
        bytes32 salt = key;
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        require(pair != address(0), "ZIONDex: CREATE2_FAILED");

        ZIONDexPair(pair).initialize(token0, token1, address(this));

        getPair[key] = pair;
        // Also register the reversed key so lookups work either direction.
        getPair[keccak256(abi.encodePacked(token1, token0))] = pair;
        allPairs.push(pair);

        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    /// @notice Returns the number of pairs created.
    function getPairCount() external view returns (uint256) {
        return allPairs.length;
    }

    /// @notice Convenience getter for the pair of two tokens.
    function pairFor(address tokenA, address tokenB) external view returns (address) {
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        return getPair[keccak256(abi.encodePacked(token0, token1))];
    }

    // ── Governance ─────────────────────────────────────────────────────

    /// @notice Sets the protocol fee recipient (ZION treasury).
    function setFeeTo(address _feeTo) external onlyFeeToSetter {
        require(_feeTo != address(0), "ZIONDex: ZERO_ADDRESS");
        emit FeeToUpdated(feeTo, _feeTo);
        feeTo = _feeTo;
    }

    /// @notice Transfers governance to a new address.
    function setFeeToSetter(address _feeToSetter) external onlyFeeToSetter {
        require(_feeToSetter != address(0), "ZIONDex: ZERO_ADDRESS");
        emit FeeToSetterUpdated(feeToSetter, _feeToSetter);
        feeToSetter = _feeToSetter;
    }

    /// @notice Sets the protocol fee in basis points (capped at MAX_PROTOCOL_FEE_BPS).
    function setProtocolFeeBps(uint256 _protocolFeeBps) external onlyFeeToSetter {
        require(_protocolFeeBps <= MAX_PROTOCOL_FEE_BPS, "ZIONDex: FEE_TOO_HIGH");
        emit ProtocolFeeBpsUpdated(protocolFeeBps, _protocolFeeBps);
        protocolFeeBps = _protocolFeeBps;
    }
}
