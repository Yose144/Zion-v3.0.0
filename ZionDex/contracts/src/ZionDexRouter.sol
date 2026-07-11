// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZionDexRouter} from "./interfaces/IZionDexRouter.sol";
import {IZionDexPoolManager} from "./interfaces/IZionDexPoolManager.sol";
import {ZionDexPoolManager} from "./ZionDexPoolManager.sol";

/// @title ZionDexRouter
/// @notice User-facing router for ZionDex AMM
contract ZionDexRouter is IZionDexRouter {
    ZionDexPoolManager public immutable poolManager;

    /// @notice wZION address
    address public immutable wzion;

    /// @notice Default tick spacing
    int24 public constant DEFAULT_TICK_SPACING = 60;

    /// @notice Default fee for ZION pairs (0.15%)
    uint24 public constant ZION_FEE = 15;

    /// @notice Default fee for standard pairs (0.30%)
    uint24 public constant STANDARD_FEE = 30;

    // ── Events ─────────────────────────────────────────────────────────

    event SwapExecuted(address indexed sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed sender, address tokenA, address tokenB, uint128 liquidity);
    event LiquidityRemoved(address indexed sender, bytes32 poolId, uint128 liquidity);

    constructor(address _poolManager, address _wzion) {
        poolManager = ZionDexPoolManager(_poolManager);
        wzion = _wzion;
    }

    /// @inheritdoc IZionDexRouter
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 amountOut) {
        require(block.timestamp <= deadline, "DEADLINE_EXPIRED");
        require(amountIn > 0, "ZERO_AMOUNT");

        // Build pool key
        IZionDexPoolManager.PoolKey memory key = _getPoolKey(tokenIn, tokenOut);
        bool zeroForOne = tokenIn < tokenOut;

        // Execute swap
        (int256 amount0, int256 amount1) = poolManager.swap(
            key,
            zeroForOne,
            int256(amountIn),
            zeroForOne ? uint160(1) : type(uint160).max
        );

        amountOut = zeroForOne ? uint256(-amount1) : uint256(-amount0);
        require(amountOut >= minAmountOut, "SLIPPAGE_EXCEEDED");

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /// @inheritdoc IZionDexRouter
    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 maxAmountIn,
        uint256 deadline
    ) external returns (uint256 amountIn) {
        require(block.timestamp <= deadline, "DEADLINE_EXPIRED");
        require(amountOut > 0, "ZERO_AMOUNT");

        IZionDexPoolManager.PoolKey memory key = _getPoolKey(tokenIn, tokenOut);
        bool zeroForOne = tokenIn < tokenOut;

        (int256 amount0, int256 amount1) = poolManager.swap(
            key,
            zeroForOne,
            -int256(amountOut),
            zeroForOne ? uint160(1) : type(uint160).max
        );

        amountIn = zeroForOne ? uint256(amount0) : uint256(amount1);
        require(amountIn <= maxAmountIn, "SLIPPAGE_EXCEEDED");

        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /// @inheritdoc IZionDexRouter
    function addLiquidity(
        address tokenA,
        address tokenB,
        int24 tickLower,
        int24 tickUpper,
        uint256 amountA,
        uint256 amountB,
        uint256 minAmountA,
        uint256 minAmountB,
        uint256 deadline
    ) external returns (uint128 liquidity) {
        require(block.timestamp <= deadline, "DEADLINE_EXPIRED");

        IZionDexPoolManager.PoolKey memory key = _getPoolKey(tokenA, tokenB);

        liquidity = poolManager.addLiquidity(key, tickLower, tickUpper, amountA, amountB);

        emit LiquidityAdded(msg.sender, tokenA, tokenB, liquidity);
    }

    /// @inheritdoc IZionDexRouter
    function removeLiquidity(
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 minAmountA,
        uint256 minAmountB,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB) {
        require(block.timestamp <= deadline, "DEADLINE_EXPIRED");

        // Reconstruct pool key from poolId — in production, store key mapping
        // For MVP: use placeholder
        IZionDexPoolManager.PoolKey memory key = IZionDexPoolManager.PoolKey({
            currency0: address(0),
            currency1: address(0),
            fee: STANDARD_FEE,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: address(0)
        });

        (amountA, amountB) = poolManager.removeLiquidity(key, tickLower, tickUpper, liquidity);

        require(amountA >= minAmountA, "SLIPPAGE_A");
        require(amountB >= minAmountB, "SLIPPAGE_B");

        emit LiquidityRemoved(msg.sender, poolId, liquidity);
    }

    // ── Internal ───────────────────────────────────────────────────────

    function _getPoolKey(address tokenA, address tokenB) internal view returns (IZionDexPoolManager.PoolKey memory) {
        // Sort tokens
        (address currency0, address currency1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);

        // ZION pairs get discount fee
        uint24 fee = (currency0 == wzion || currency1 == wzion) ? ZION_FEE : STANDARD_FEE;

        return IZionDexPoolManager.PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: fee,
            tickSpacing: DEFAULT_TICK_SPACING,
            hooks: address(0)
        });
    }
}
