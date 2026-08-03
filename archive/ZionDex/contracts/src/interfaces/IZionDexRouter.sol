// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IZionDexRouter {
    /// @notice Swap exact input amount
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param amountIn Exact input amount
    /// @param minAmountOut Minimum output (slippage protection)
    /// @param deadline Transaction deadline (unix timestamp)
    function swapExactIn(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external returns (uint256 amountOut);

    /// @notice Swap exact output amount
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param amountOut Exact output amount
    /// @param maxAmountIn Maximum input (slippage protection)
    /// @param deadline Transaction deadline
    function swapExactOut(
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint256 maxAmountIn,
        uint256 deadline
    ) external returns (uint256 amountIn);

    /// @notice Add liquidity to a pool
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
    ) external returns (uint128 liquidity);

    /// @notice Remove liquidity from a pool
    function removeLiquidity(
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 minAmountA,
        uint256 minAmountB,
        uint256 deadline
    ) external returns (uint256 amountA, uint256 amountB);
}
