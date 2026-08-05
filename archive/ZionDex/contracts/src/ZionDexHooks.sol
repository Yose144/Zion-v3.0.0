// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZionDexHooks} from "./interfaces/IZionDexHooks.sol";

/// @title ZionDexHooks
/// @notice Custom hooks for ZION pairs — lower fees + volume tracking
contract ZionDexHooks is IZionDexHooks {
    /// @notice wZION address
    address public immutable wzion;

    /// @notice Volume tracking per pool (for dynamic fees)
    mapping(bytes32 => uint256) public poolVolume24h;

    /// @notice Volume-based fee tiers
    /// @dev If 24h volume > threshold, fee is reduced
    uint256 public constant VOLUME_THRESHOLD = 100_000 * 1e18; // 100K units
    uint24 public constant HIGH_VOLUME_FEE = 10; // 0.10% for high-volume ZION pairs

    // ── Callback selectors ─────────────────────────────────────────────

    bytes4 private constant BEFORE_SWAP_SELECTOR = IZionDexHooks.beforeSwap.selector;
    bytes4 private constant AFTER_SWAP_SELECTOR = IZionDexHooks.afterSwap.selector;
    bytes4 private constant BEFORE_ADD_LIQUIDITY_SELECTOR = IZionDexHooks.beforeAddLiquidity.selector;
    bytes4 private constant AFTER_ADD_LIQUIDITY_SELECTOR = IZionDexHooks.afterAddLiquidity.selector;
    bytes4 private constant BEFORE_REMOVE_LIQUIDITY_SELECTOR = IZionDexHooks.beforeRemoveLiquidity.selector;
    bytes4 private constant AFTER_REMOVE_LIQUIDITY_SELECTOR = IZionDexHooks.afterRemoveLiquidity.selector;

    constructor(address _wzion) {
        wzion = _wzion;
    }

    /// @inheritdoc IZionDexHooks
    function beforeSwap(
        address sender,
        bytes32 poolId,
        bool zeroForOne,
        int256 amountSpecified
    ) external returns (bytes4) {
        // Could apply dynamic fees here based on volume
        // For now: just validate
        require(amountSpecified != 0, "ZERO_AMOUNT");
        return BEFORE_SWAP_SELECTOR;
    }

    /// @inheritdoc IZionDexHooks
    function afterSwap(
        address sender,
        bytes32 poolId,
        int256 amount0,
        int256 amount1
    ) external returns (bytes4) {
        // Track volume for dynamic fee adjustment
        uint256 volume = uint256(amount0 > 0 ? amount0 : -amount0);
        poolVolume24h[poolId] += volume;

        return AFTER_SWAP_SELECTOR;
    }

    /// @inheritdoc IZionDexHooks
    function beforeAddLiquidity(
        address sender,
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) external returns (bytes4) {
        require(tickLower < tickUpper, "BAD_TICKS");
        return BEFORE_ADD_LIQUIDITY_SELECTOR;
    }

    /// @inheritdoc IZionDexHooks
    function afterAddLiquidity(
        address sender,
        bytes32 poolId,
        uint128 liquidity
    ) external returns (bytes4) {
        return AFTER_ADD_LIQUIDITY_SELECTOR;
    }

    /// @inheritdoc IZionDexHooks
    function beforeRemoveLiquidity(
        address sender,
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external returns (bytes4) {
        return BEFORE_REMOVE_LIQUIDITY_SELECTOR;
    }

    /// @inheritdoc IZionDexHooks
    function afterRemoveLiquidity(
        address sender,
        bytes32 poolId,
        uint256 amount0,
        uint256 amount1
    ) external returns (bytes4) {
        return AFTER_REMOVE_LIQUIDITY_SELECTOR;
    }
}
