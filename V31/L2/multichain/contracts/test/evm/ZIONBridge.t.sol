// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {WZION} from "../../src/evm/wZION.sol";
import {ZIONBridge} from "../../src/evm/ZIONBridge.sol";

/// @title ZIONBridge Test Suite
/// @notice Tests for the cross-chain bridge controller contract.
contract ZIONBridgeTest is Test {
    WZION public token;
    ZIONBridge public bridge;

    address admin = makeAddr("admin");
    address guardian = makeAddr("guardian");
    address[] validators;
    address val1 = makeAddr("val1");
    address val2 = makeAddr("val2");
    address val3 = makeAddr("val3");
    address recipient = makeAddr("recipient");

    bytes32 constant L1_TX_HASH = keccak256("l1-lock-1");
    uint256 constant MINT_AMOUNT = 100 * 1e18;

    function setUp() public {
        // Deploy wZION with test contract as admin (so we can grant roles)
        token = new WZION(address(this), address(this), guardian);

        // Set up validators (3-of-3 for easy testing)
        validators = new address[](3);
        validators[0] = val1;
        validators[1] = val2;
        validators[2] = val3;

        bridge = new ZIONBridge(admin, guardian, address(token), validators, 3);

        // Grant BRIDGE_ROLE on wZION to the bridge contract
        token.grantRole(token.BRIDGE_ROLE(), address(bridge));
    }

    // ── Constructor ──────────────────────────────────────────────────

    function test_Constructor_SetsThreshold() public view {
        assertEq(bridge.threshold(), 3);
        assertEq(bridge.validatorCount(), 3);
    }

    function test_Constructor_GrantsValidatorRoles() public view {
        assertTrue(bridge.hasRole(bridge.VALIDATOR_ROLE(), val1));
        assertTrue(bridge.hasRole(bridge.VALIDATOR_ROLE(), val2));
        assertTrue(bridge.hasRole(bridge.VALIDATOR_ROLE(), val3));
    }

    function test_Constructor_RevertInvalidThreshold() public {
        address[] memory vals = new address[](2);
        vals[0] = val1;
        vals[1] = val2;
        vm.expectRevert();
        new ZIONBridge(admin, guardian, address(token), vals, 3);
    }

    // ── submitLockProof ──────────────────────────────────────────────

    function test_SubmitLockProof_ThresholdReached_Mints() public {
        // val1 submits
        vm.prank(val1);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        // Not yet executed (1/3)
        (uint8 confirmations, bool executed, , , , ) = bridge.getLockProofStatus(L1_TX_HASH);
        assertEq(confirmations, 1);
        assertFalse(executed);

        // val2 submits
        vm.prank(val2);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        // val3 submits — threshold reached, should mint
        vm.prank(val3);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        // Check mint happened
        assertEq(token.balanceOf(recipient), MINT_AMOUNT);

        (uint8 finalConfirmations, bool finalExecuted, , , , ) = bridge.getLockProofStatus(L1_TX_HASH);
        assertEq(finalConfirmations, 3);
        assertTrue(finalExecuted);
    }

    function test_SubmitLockProof_RevertNotValidator() public {
        vm.prank(makeAddr("notval"));
        vm.expectRevert();
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
    }

    function test_SubmitLockProof_RevertDoubleConfirm() public {
        vm.prank(val1);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        vm.prank(val1);
        vm.expectRevert();
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
    }

    function test_SubmitLockProof_RevertAlreadyExecuted() public {
        // All 3 validators submit
        vm.startPrank(val1);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
        vm.stopPrank();

        vm.startPrank(val2);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
        vm.stopPrank();

        vm.startPrank(val3);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
        vm.stopPrank();

        // Try to submit again after execution
        vm.prank(val1);
        vm.expectRevert();
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
    }

    // ── confirmBurnRelease ───────────────────────────────────────────

    function test_ConfirmBurnRelease_ThresholdReached() public {
        // First mint some tokens
        _mintToRecipient();

        // Burn tokens
        vm.prank(recipient);
        token.bridgeBurn(MINT_AMOUNT, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2", keccak256("burn-1"));

        // Validators confirm burn release
        bytes32 burnId = keccak256("burn-1");
        vm.prank(val1);
        bridge.confirmBurnRelease(burnId, recipient, MINT_AMOUNT, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        vm.prank(val2);
        bridge.confirmBurnRelease(burnId, recipient, MINT_AMOUNT, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        vm.prank(val3);
        bridge.confirmBurnRelease(burnId, recipient, MINT_AMOUNT, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        // Check released
        (, bool released, , , ) = bridge.getBurnReleaseStatus(burnId);
        assertTrue(released);
    }

    function test_ConfirmBurnRelease_RevertDoubleConfirm() public {
        bytes32 burnId = keccak256("burn-1");
        vm.prank(val1);
        bridge.confirmBurnRelease(burnId, recipient, MINT_AMOUNT, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");

        vm.prank(val1);
        vm.expectRevert();
        bridge.confirmBurnRelease(burnId, recipient, MINT_AMOUNT, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
    }

    // ── Threshold management ─────────────────────────────────────────

    function test_UpdateThreshold() public {
        vm.prank(admin);
        bridge.updateThreshold(2);
        assertEq(bridge.threshold(), 2);
    }

    function test_UpdateThreshold_RevertNotAdmin() public {
        vm.prank(val1);
        vm.expectRevert();
        bridge.updateThreshold(2);
    }

    // ── Pause / Unpause ──────────────────────────────────────────────

    function test_Pause_BlocksSubmitLockProof() public {
        vm.prank(guardian);
        bridge.pause();

        vm.prank(val1);
        vm.expectRevert(); // whenNotPaused
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
    }

    // ── Helpers ──────────────────────────────────────────────────────

    function _mintToRecipient() internal {
        vm.prank(val1);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
        vm.prank(val2);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
        vm.prank(val3);
        bridge.submitLockProof(L1_TX_HASH, recipient, MINT_AMOUNT, 1000, "zion1n4k4n5e4p0z3g7z2e0z0j7c8w7y0v5m8c6hf8c2");
    }
}
