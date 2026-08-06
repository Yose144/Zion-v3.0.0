// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IZionDexPoolManager
/// @notice Interface for ZionDex singleton pool manager (Uniswap V4 pattern)
interface IZionDexPoolManager {
    /// @notice Pool key identifying a unique pool
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }

    /// @notice Pool ID = hash of PoolKey
    function getPoolId(PoolKey calldata key) external pure returns (bytes32);

    /// @notice Initialize a new pool with starting price
    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick);

    /// @notice Swap in a pool
    /// @param key Pool key
    /// @param zeroForOne Direction: true = currency0 → currency1
    /// @param amountSpecified Positive = exact input, negative = exact output
    /// @param sqrtPriceLimitX96 Price limit for slippage protection
    function swap(
        PoolKey calldata key,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96
    ) external returns (int256 amount0, int256 amount1);

    /// @notice Add liquidity to a pool
    function addLiquidity(
        PoolKey calldata key,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) external returns (uint128 liquidity);

    /// @notice Remove liquidity from a pool
    function removeLiquidity(
        PoolKey calldata key,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external returns (uint256 amount0, uint256 amount1);

    /// @notice Get current pool slot0 (price + tick)
    function slot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick);

    /// @notice Get pool liquidity
    function liquidity(bytes32 poolId) external view returns (uint128);

    /// @notice Lock callback for flash accounting
    function unlock(bytes calldata data) external returns (bytes memory);

    /// @notice Callback after unlock
    function unlockCallback(bytes calldata data) external returns (bytes memory);
}
