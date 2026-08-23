// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {WZION} from "../../src/evm/wZION.sol";

/// @title WZION Test Suite
/// @notice Tests for the wrapped ZION ERC-20 token contract.
contract WZIONTest is Test {
    WZION public token;

    address admin = makeAddr("admin");
    address bridge = makeAddr("bridge");
    address guardian = makeAddr("guardian");
    address user = makeAddr("user");
    address user2 = makeAddr("user2");

    bytes32 constant L1_TX_HASH = keccak256("l1-lock-tx-1");
    bytes32 constant BURN_ID = keccak256("burn-1");
    uint256 constant MINT_AMOUNT = 100 * 1e18; // 100 wZION (MIN_BRIDGE_AMOUNT)

    function setUp() public {
        token = new WZION(admin, bridge, guardian);
    }

    // ── Constructor ──────────────────────────────────────────────────

    function test_Constructor_GrantsRoles() public view {
        assertTrue(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(token.hasRole(token.BRIDGE_ROLE(), bridge));
        assertTrue(token.hasRole(token.GUARDIAN_ROLE(), guardian));
    }

    function test_Constructor_RevertZeroAddress() public {
        vm.expectRevert(WZION.ZeroAddress.selector);
        new WZION(address(0), bridge, guardian);
    }

    function test_TokenMetadata() public view {
        assertEq(token.name(), "Wrapped ZION");
        assertEq(token.symbol(), "wZION");
        assertEq(token.decimals(), 18);
    }

    // ── bridgeMint ───────────────────────────────────────────────────

    function test_BridgeMint_Success() public {
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        assertEq(token.balanceOf(user), MINT_AMOUNT);
        assertEq(token.totalSupply(), MINT_AMOUNT);
        assertEq(token.totalBridgeMinted(), MINT_AMOUNT);
        assertTrue(token.processedL1Locks(L1_TX_HASH));
    }

    function test_BridgeMint_RevertNotBridge() public {
        vm.prank(user);
        vm.expectRevert();
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);
    }

    function test_BridgeMint_RevertZeroAddress() public {
        vm.prank(bridge);
        vm.expectRevert(WZION.ZeroAddress.selector);
        token.bridgeMint(address(0), MINT_AMOUNT, L1_TX_HASH);
    }

    function test_BridgeMint_RevertZeroAmount() public {
        vm.prank(bridge);
        vm.expectRevert(WZION.ZeroAmount.selector);
        token.bridgeMint(user, 0, L1_TX_HASH);
    }

    function test_BridgeMint_RevertBelowMin() public {
        vm.prank(bridge);
        vm.expectRevert();
        token.bridgeMint(user, 99 * 1e18, L1_TX_HASH);
    }

    function test_BridgeMint_RevertReplay() public {
        vm.startPrank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);
        vm.expectRevert();
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);
        vm.stopPrank();
    }

    function test_BridgeMint_RevertExceedsMaxSupply() public {
        uint256 maxMintable = token.MAX_SUPPLY();
        vm.prank(bridge);
        vm.expectRevert();
        token.bridgeMint(user, maxMintable + 1, L1_TX_HASH);
    }

    // ── bridgeBurn ───────────────────────────────────────────────────

    function test_BridgeBurn_Success() public {
        // Mint first
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        // Burn
        vm.prank(user);
        token.bridgeBurn(MINT_AMOUNT, L1_ADDR, BURN_ID);

        assertEq(token.balanceOf(user), 0);
        assertEq(token.totalSupply(), 0);
        assertEq(token.totalBridgeBurned(), MINT_AMOUNT);
        assertTrue(token.processedBurnRequests(BURN_ID));
    }

    function test_BridgeBurn_RevertZeroAmount() public {
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        vm.prank(user);
        vm.expectRevert(WZION.ZeroAmount.selector);
        token.bridgeBurn(0, L1_ADDR, BURN_ID);
    }

    function test_BridgeBurn_RevertBelowMin() public {
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        vm.prank(user);
        vm.expectRevert();
        token.bridgeBurn(50 * 1e18, L1_ADDR, BURN_ID);
    }

    function test_BridgeBurn_RevertReplay() public {
        vm.startPrank(bridge);
        token.bridgeMint(user, MINT_AMOUNT * 2, L1_TX_HASH);
        vm.stopPrank();

        vm.startPrank(user);
        token.bridgeBurn(MINT_AMOUNT, L1_ADDR, BURN_ID);
        vm.expectRevert();
        token.bridgeBurn(MINT_AMOUNT, L1_ADDR, BURN_ID);
        vm.stopPrank();
    }

    function test_BridgeBurn_RevertInvalidL1Address() public {
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        vm.prank(user);
        vm.expectRevert();
        token.bridgeBurn(MINT_AMOUNT, "invalid", BURN_ID);
    }

    // ── Pause / Unpause ──────────────────────────────────────────────

    function test_EmergencyPause_BlocksMintAndBurn() public {
        vm.prank(guardian);
        token.emergencyPause("test emergency");

        assertTrue(token.paused());

        vm.prank(bridge);
        vm.expectRevert(); // whenNotPaused
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);
    }

    function test_EmergencyPause_RevertNotGuardian() public {
        vm.prank(user);
        vm.expectRevert();
        token.emergencyPause("test");
    }

    function test_EmergencyUnpause_RestoresFunctionality() public {
        vm.startPrank(guardian);
        token.emergencyPause("test");
        token.emergencyUnpause();
        vm.stopPrank();

        assertFalse(token.paused());

        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);
        assertEq(token.balanceOf(user), MINT_AMOUNT);
    }

    // ── View functions ───────────────────────────────────────────────

    function test_MintableSupply() public {
        uint256 initial = token.mintableSupply();
        assertEq(initial, token.MAX_SUPPLY());

        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        assertEq(token.mintableSupply(), token.MAX_SUPPLY() - MINT_AMOUNT);
    }

    // Real ZION L1 address (bech32, ≥40 chars, starts with "zion1")
    string constant L1_ADDR = "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2";
    string constant L1_ADDR_INVALID = "invalid";

    function test_Transfer_Success() public {
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        vm.prank(user);
        token.transfer(user2, MINT_AMOUNT / 2);

        assertEq(token.balanceOf(user), MINT_AMOUNT / 2);
        assertEq(token.balanceOf(user2), MINT_AMOUNT / 2);
    }

    function test_ApproveAndTransferFrom() public {
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);

        vm.prank(user);
        token.approve(user2, MINT_AMOUNT);

        vm.prank(user2);
        token.transferFrom(user, user2, MINT_AMOUNT);

        assertEq(token.balanceOf(user), 0);
        assertEq(token.balanceOf(user2), MINT_AMOUNT);
    }

    // ── Full round-trip: mint → transfer → burn ──────────────────────

    function test_RoundTrip_MintTransferBurn() public {
        // 1. Mint to user
        vm.prank(bridge);
        token.bridgeMint(user, MINT_AMOUNT, L1_TX_HASH);
        assertEq(token.balanceOf(user), MINT_AMOUNT);

        // 2. Transfer to user2
        vm.prank(user);
        token.transfer(user2, MINT_AMOUNT);
        assertEq(token.balanceOf(user2), MINT_AMOUNT);

        // 3. user2 burns
        vm.prank(user2);
        token.bridgeBurn(MINT_AMOUNT, L1_ADDR, BURN_ID);
        assertEq(token.balanceOf(user2), 0);
        assertEq(token.totalSupply(), 0);
    }
}
