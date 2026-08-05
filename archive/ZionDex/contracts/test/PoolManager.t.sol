// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZionDexPoolManager} from "../src/ZionDexPoolManager.sol";
import {ZionDexHooks} from "../src/ZionDexHooks.sol";
import {ZionDexRouter} from "../src/ZionDexRouter.sol";
import {ZDXToken} from "../src/ZDXToken.sol";
import {ZionDexStaking} from "../src/ZionDexStaking.sol";
import {IZionDexPoolManager} from "../src/interfaces/IZionDexPoolManager.sol";

contract PoolManagerTest is Test {
    ZionDexPoolManager poolManager;
    ZionDexHooks hooks;
    ZionDexRouter router;
    ZDXToken zdx;
    ZionDexStaking staking;

    address constant WZION = 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6;
    address constant USDT = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;

    address deployer = address(0xDEAD);

    function setUp() public {
        vm.startPrank(deployer);

        zdx = new ZDXToken();
        poolManager = new ZionDexPoolManager(WZION);
        hooks = new ZionDexHooks(WZION);
        router = new ZionDexRouter(address(poolManager), WZION);
        staking = new ZionDexStaking(address(zdx));

        vm.stopPrank();
    }

    function test_PoolIdDeterministic() public pure {
        IZionDexPoolManager.PoolKey memory key = IZionDexPoolManager.PoolKey({
            currency0: WZION,
            currency1: USDT,
            fee: 30,
            tickSpacing: 60,
            hooks: address(0)
        });

        bytes32 id1 = _getPoolId(key);
        bytes32 id2 = _getPoolId(key);
        assertEq(id1, id2);
    }

    function test_InitializePool() public {
        IZionDexPoolManager.PoolKey memory key = IZionDexPoolManager.PoolKey({
            currency0: WZION,
            currency1: USDT,
            fee: 30,
            tickSpacing: 60,
            hooks: address(0)
        });

        // sqrtPriceX96 for 1:1 ratio = 2^96
        uint160 sqrtPriceX96 = 2 ** 96;

        vm.prank(deployer);
        poolManager.initialize(key, sqrtPriceX96);

        bytes32 poolId = poolManager.getPoolId(key);
        (uint160 price, int24 tick) = poolManager.slot0(poolId);
        assertEq(price, sqrtPriceX96);
    }

    function test_ZionPairFeeDiscount() public {
        IZionDexPoolManager.PoolKey memory key = IZionDexPoolManager.PoolKey({
            currency0: WZION,
            currency1: USDT,
            fee: 30, // Request 0.30%
            tickSpacing: 60,
            hooks: address(0)
        });

        vm.prank(deployer);
        poolManager.initialize(key, 2 ** 96);

        bytes32 poolId = poolManager.getPoolId(key);
        // Pool should have ZION_PAIR_FEE (15 bps) not standard 30
        // Read fee from pool struct via auto-generated getter
        (uint160 sqrtPriceX96, int24 tick, uint128 liq, uint24 fee, int24 tickSpacing, address hook, bool initialized)
            = poolManager.pools(poolId);
        assertEq(fee, 15, "ZION pair should get discount fee");
    }

    function test_AddLiquidity() public {
        IZionDexPoolManager.PoolKey memory key = IZionDexPoolManager.PoolKey({
            currency0: WZION,
            currency1: USDT,
            fee: 30,
            tickSpacing: 60,
            hooks: address(0)
        });

        vm.startPrank(deployer);
        poolManager.initialize(key, 2 ** 96);

        uint128 liquidity = poolManager.addLiquidity(
            key,
            -887220, // min tick
            887220,  // max tick
            1_000_000 * 1e18,
            1_000_000 * 1e6
        );
        vm.stopPrank();

        assertTrue(liquidity > 0, "Should have liquidity");

        bytes32 poolId = poolManager.getPoolId(key);
        assertEq(poolManager.liquidity(poolId), liquidity);
    }

    function test_ZDXTokenMint() public {
        // Initial supply should be 10M
        assertEq(zdx.totalSupply(), 10_000_000 * 1e18);
        assertEq(zdx.balanceOf(deployer), 10_000_000 * 1e18);
    }

    function test_ZDXMaxSupply() public {
        vm.startPrank(deployer);
        // Try to mint beyond max supply
        vm.expectRevert("MAX_SUPPLY_EXCEEDED");
        zdx.mint(deployer, 91_000_000 * 1e18); // 91M + 10M = 101M > 100M
        vm.stopPrank();
    }

    function test_Staking() public {
        // Transfer ZDX ownership to staking for minting
        // Note: In current impl, ZDXToken.owner = deployer
        // For testing: deployer stakes and claims

        vm.startPrank(deployer);

        // Stake some tokens (simulated)
        staking.stake(1000 * 1e18);

        // Wait some time
        vm.warp(block.timestamp + 3600); // 1 hour

        // Check pending rewards
        uint256 pending = staking.pendingRewards(deployer);
        assertTrue(pending > 0, "Should have pending rewards");

        vm.stopPrank();
    }

    // ── Helpers ────────────────────────────────────────────────────────

    function _getPoolId(IZionDexPoolManager.PoolKey memory key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks));
    }
}
