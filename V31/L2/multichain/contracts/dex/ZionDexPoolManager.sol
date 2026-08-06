// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IZionDexPoolManager} from "./interfaces/IZionDexPoolManager.sol";
import {IZionDexHooks} from "./interfaces/IZionDexHooks.sol";

/// @title ZionDexPoolManager
/// @notice Singleton pool manager for ZionDex AMM (Uniswap V4 pattern)
/// @dev All pools share one contract — gas-efficient, flash accounting
contract ZionDexPoolManager is IZionDexPoolManager {
    /// @notice Pool state
    struct Pool {
        uint160 sqrtPriceX96;
        int24 tick;
        uint128 liquidity;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
        bool initialized;
    }

    /// @dev Tick info for concentrated liquidity
    struct TickInfo {
        uint128 liquidityGross;
        int128 liquidityNet;
        uint256 feeGrowthOutside0X128;
        uint256 feeGrowthOutside1X128;
        bool initialized;
    }

    /// @dev Position info for LP
    struct Position {
        uint128 liquidity;
        uint256 feeGrowthInside0LastX128;
        uint256 feeGrowthInside1LastX128;
        uint128 tokensOwed0;
        uint128 tokensOwed1;
    }

    // ── State ──────────────────────────────────────────────────────────

    /// @dev poolId => Pool
    mapping(bytes32 => Pool) public pools;

    /// @dev poolId => tick => TickInfo
    mapping(bytes32 => mapping(int24 => TickInfo)) public ticks;

    /// @dev poolId => positionKey => Position
    mapping(bytes32 => mapping(bytes32 => Position)) public positions;

    /// @dev owner => poolId => liquidity (for accounting)
    mapping(address => mapping(bytes32 => uint128)) public ownerLiquidity;

    /// @notice wZION address (for fee discount detection)
    address public immutable wzion;

    /// @notice ZION pair discount fee (15 bps = 0.15%)
    uint24 public constant ZION_PAIR_FEE = 15;

    /// @notice Standard fee (30 bps = 0.30%)
    uint24 public constant STANDARD_FEE = 30;

    // ── Events ─────────────────────────────────────────────────────────

    event PoolInitialized(bytes32 indexed poolId, address indexed currency0, address indexed currency1, uint160 sqrtPriceX96);
    event Swap(bytes32 indexed poolId, address indexed sender, int256 amount0, int256 amount1, uint160 sqrtPriceX96, int24 tick);
    event LiquidityAdded(bytes32 indexed poolId, address indexed sender, int24 tickLower, int24 tickUpper, uint128 liquidity);
    event LiquidityRemoved(bytes32 indexed poolId, address indexed sender, int24 tickLower, int24 tickUpper, uint128 liquidity);

    // ── Constructor ────────────────────────────────────────────────────

    constructor(address _wzion) {
        wzion = _wzion;
    }

    // ── Pool ID ────────────────────────────────────────────────────────

    /// @inheritdoc IZionDexPoolManager
    function getPoolId(PoolKey calldata key) public pure returns (bytes32) {
        return keccak256(abi.encode(key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks));
    }

    // ── Initialize ─────────────────────────────────────────────────────

    /// @inheritdoc IZionDexPoolManager
    function initialize(PoolKey calldata key, uint160 sqrtPriceX96) external returns (int24 tick) {
        bytes32 poolId = getPoolId(key);
        require(!pools[poolId].initialized, "POOL_EXISTS");

        // Determine fee — ZION pairs get discount
        uint24 fee = key.fee;
        if (key.currency0 == wzion || key.currency1 == wzion) {
            fee = ZION_PAIR_FEE;
        }

        // Calculate tick from sqrtPriceX96
        // tick = floor(log(sqrtPriceX96^2 / 2^192) / log(1.0001))
        // Simplified: use log2 approximation
        tick = computeTickFromSqrtPrice(sqrtPriceX96);

        pools[poolId] = Pool({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            liquidity: 0,
            fee: fee,
            tickSpacing: key.tickSpacing,
            hooks: key.hooks,
            initialized: true
        });

        emit PoolInitialized(poolId, key.currency0, key.currency1, sqrtPriceX96);
    }

    // ── Swap ───────────────────────────────────────────────────────────

    /// @inheritdoc IZionDexPoolManager
    function swap(
        PoolKey calldata key,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96
    ) external returns (int256 amount0, int256 amount1) {
        bytes32 poolId = getPoolId(key);
        Pool storage pool = pools[poolId];
        require(pool.initialized, "POOL_NOT_INITIALIZED");

        // Hook: beforeSwap
        if (pool.hooks != address(0)) {
            IZionDexHooks(pool.hooks).beforeSwap(msg.sender, poolId, zeroForOne, amountSpecified);
        }

        require(amountSpecified != 0, "ZERO_AMOUNT");
        if (zeroForOne) {
            require(sqrtPriceLimitX96 < pool.sqrtPriceX96 && sqrtPriceLimitX96 > 0, "BAD_PRICE_LIMIT");
        } else {
            require(sqrtPriceLimitX96 > pool.sqrtPriceX96, "BAD_PRICE_LIMIT");
        }

        // Simplified swap — constant product on concentrated liquidity
        // In production: full tick-crossing swap logic
        uint128 liquidity = pool.liquidity;
        if (liquidity == 0) {
            // No liquidity — cannot swap
            return (0, 0);
        }

        // Compute swap output using x*y=k approximation
        // For exactInput (amountSpecified > 0):
        //   amountOut = liquidity * (sqrtPriceAfter - sqrtPriceBefore) / (sqrtPriceAfter * sqrtPriceBefore / 2^96)
        // Simplified for MVP:
        uint256 fee = pool.fee;
        if (amountSpecified > 0) {
            // Exact input
            uint256 amountIn = uint256(amountSpecified);
            uint256 amountInWithFee = amountIn * (10000 - fee) / 10000;

            if (zeroForOne) {
                amount0 = int256(amountIn);
                // amount1 = liquidity * (sqrtPriceBefore - sqrtPriceAfter) / 2^96
                // Simplified: use price ratio
                uint256 amountOut = (amountInWithFee * pool.sqrtPriceX96) / (2 ** 96);
                amount1 = -int256(amountOut);
            } else {
                amount1 = int256(amountIn);
                uint256 amountOut = (amountInWithFee * (2 ** 96)) / pool.sqrtPriceX96;
                amount0 = -int256(amountOut);
            }
        } else {
            // Exact output (amountSpecified < 0)
            uint256 amountOut = uint256(-amountSpecified);
            uint256 amountInNeeded = (amountOut * 10000) / (10000 - fee);

            if (zeroForOne) {
                amount0 = int256(amountInNeeded);
                amount1 = -int256(amountOut);
            } else {
                amount1 = int256(amountInNeeded);
                amount0 = -int256(amountOut);
            }
        }

        // Update price (simplified — real impl crosses ticks)
        // For MVP: keep price stable (no price impact in simplified mode)

        emit Swap(poolId, msg.sender, amount0, amount1, pool.sqrtPriceX96, pool.tick);

        // Hook: afterSwap
        if (pool.hooks != address(0)) {
            IZionDexHooks(pool.hooks).afterSwap(msg.sender, poolId, amount0, amount1);
        }
    }

    // ── Liquidity ──────────────────────────────────────────────────────

    /// @inheritdoc IZionDexPoolManager
    function addLiquidity(
        PoolKey calldata key,
        int24 tickLower,
        int24 tickUpper,
        uint256 amount0,
        uint256 amount1
    ) external returns (uint128 liquidity) {
        bytes32 poolId = getPoolId(key);
        Pool storage pool = pools[poolId];
        require(pool.initialized, "POOL_NOT_INITIALIZED");
        require(tickLower < tickUpper, "BAD_TICKS");

        // Hook: beforeAddLiquidity
        if (pool.hooks != address(0)) {
            IZionDexHooks(pool.hooks).beforeAddLiquidity(msg.sender, poolId, tickLower, tickUpper, amount0, amount1);
        }

        // Calculate liquidity amount (simplified — real impl uses getLiquidityForAmounts)
        // L = sqrt(amount0 * amount1) / (sqrtPriceUpper - sqrtPriceLower)
        // For MVP: use geometric mean
        liquidity = uint128(sqrt(amount0 * amount1));

        // Update tick info
        ticks[poolId][tickLower].liquidityGross += liquidity;
        ticks[poolId][tickLower].liquidityNet += int128(liquidity);
        ticks[poolId][tickUpper].liquidityGross += liquidity;
        ticks[poolId][tickUpper].liquidityNet -= int128(liquidity);

        // Update pool liquidity
        pool.liquidity += liquidity;

        // Update position
        bytes32 posKey = keccak256(abi.encode(msg.sender, tickLower, tickUpper));
        positions[poolId][posKey].liquidity += liquidity;
        ownerLiquidity[msg.sender][poolId] += liquidity;

        emit LiquidityAdded(poolId, msg.sender, tickLower, tickUpper, liquidity);

        // Hook: afterAddLiquidity
        if (pool.hooks != address(0)) {
            IZionDexHooks(pool.hooks).afterAddLiquidity(msg.sender, poolId, liquidity);
        }
    }

    /// @inheritdoc IZionDexPoolManager
    function removeLiquidity(
        PoolKey calldata key,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) external returns (uint256 amount0, uint256 amount1) {
        bytes32 poolId = getPoolId(key);
        Pool storage pool = pools[poolId];
        require(pool.initialized, "POOL_NOT_INITIALIZED");

        bytes32 posKey = keccak256(abi.encode(msg.sender, tickLower, tickUpper));
        require(positions[poolId][posKey].liquidity >= liquidity, "INSUFFICIENT_LIQUIDITY");

        // Hook: beforeRemoveLiquidity
        if (pool.hooks != address(0)) {
            IZionDexHooks(pool.hooks).beforeRemoveLiquidity(msg.sender, poolId, tickLower, tickUpper, liquidity);
        }

        // Update position
        positions[poolId][posKey].liquidity -= liquidity;
        ownerLiquidity[msg.sender][poolId] -= liquidity;

        // Update tick info
        ticks[poolId][tickLower].liquidityGross -= liquidity;
        ticks[poolId][tickLower].liquidityNet -= int128(liquidity);
        ticks[poolId][tickUpper].liquidityGross -= liquidity;
        ticks[poolId][tickUpper].liquidityNet += int128(liquidity);

        // Update pool liquidity
        pool.liquidity -= liquidity;

        // Calculate amounts to return (simplified)
        amount0 = uint256(liquidity) * pool.sqrtPriceX96 / (2 ** 96);
        amount1 = uint256(liquidity) * (2 ** 96) / pool.sqrtPriceX96;

        emit LiquidityRemoved(poolId, msg.sender, tickLower, tickUpper, liquidity);

        // Hook: afterRemoveLiquidity
        if (pool.hooks != address(0)) {
            IZionDexHooks(pool.hooks).afterRemoveLiquidity(msg.sender, poolId, amount0, amount1);
        }
    }

    // ── View ───────────────────────────────────────────────────────────

    /// @inheritdoc IZionDexPoolManager
    function slot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick) {
        Pool storage pool = pools[poolId];
        return (pool.sqrtPriceX96, pool.tick);
    }

    /// @inheritdoc IZionDexPoolManager
    function liquidity(bytes32 poolId) external view returns (uint128) {
        return pools[poolId].liquidity;
    }

    // ── Flash accounting (stub) ────────────────────────────────────────

    function unlock(bytes calldata data) external returns (bytes memory) {
        // TODO: Implement flash accounting
        return data;
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        return data;
    }

    // ── Internal ───────────────────────────────────────────────────────

    /// @dev Compute tick from sqrtPriceX96
    function computeTickFromSqrtPrice(uint160 sqrtPriceX96) internal pure returns (int24 tick) {
        // tick = floor(log_base_1.0001(price))
        // price = (sqrtPriceX96 / 2^96)^2
        // Simplified: use log2
        if (sqrtPriceX96 == 0) return 0;

        // log2(sqrtPriceX96 / 2^96) * 2 / log2(1.0001)
        // = (log2(sqrtPriceX96) - 96) * 2 / 0.000144...
        // ≈ (log2(sqrtPriceX96) - 96) * 13863
        uint256 x = sqrtPriceX96;
        int256 log2x = 0;
        while (x > 1) {
            x >>= 1;
            log2x++;
        }
        int256 logPrice = (log2x - 96) * 2;
        tick = int24(logPrice * 13863 / 1000);
    }

    /// @dev Babylonian sqrt
    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
