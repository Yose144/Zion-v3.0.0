// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IZionDexHooks
/// @notice Hook interface for custom pool behavior (Uniswap V4 pattern)
interface IZionDexHooks {
    /// @notice Called before swap — can modify fee or revert
    function beforeSwap(
        address sender,
        bytes32 poolId,
        bool zeroForOne,
        int256 amountSpecified
    ) external returns (bytes4);

    /// @notice Called after swap — can record volume, adjust fees
    function afterSwap(
        address sender,
        bytes32 poolId,
        int256 amount0,
        int256 amount1
    ) external returns (bytes4);

    /// @notice Called before adding liquidity
    function beforeAddLiquidity(
        address sender,
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) external returns (bytes4);

    /// @notice Called after adding liquidity
    function afterAddLiquidity(
        address sender,
        bytes32 poolId,
        uint128 liquidity
    ) external returns (bytes4);

    /// @notice Called before removing liquidity
    function beforeRemoveLiquidity(
        address sender,
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external returns (bytes4);

    /// @notice Called after removing liquidity
    function afterRemoveLiquidity(
        address sender,
        bytes32 poolId,
        uint256 amount0,
        uint256 amount1
    ) external returns (bytes4);
}
