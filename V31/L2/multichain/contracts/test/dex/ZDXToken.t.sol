// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ZDXToken} from "../../src/dex/ZDXToken.sol";

/// @title ZDXToken Test Suite
contract ZDXTokenTest is Test {
    ZDXToken public token;
    address admin = address(this);
    address minter = makeAddr("minter");
    address slasher = makeAddr("slasher");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");

    function setUp() public {
        token = new ZDXToken(admin, minter, slasher);
    }

    function test_Constructor_MintsInitialSupply() public view {
        assertEq(token.totalSupply(), 10_000_000 * 1e18);
        assertEq(token.balanceOf(admin), 10_000_000 * 1e18);
        assertEq(token.hasRole(token.DEFAULT_ADMIN_ROLE(), admin), true);
        assertEq(token.hasRole(token.MINTER_ROLE(), minter), true);
        assertEq(token.hasRole(token.SLASHER_ROLE(), slasher), true);
    }

    function test_TokenMetadata() public view {
        assertEq(token.name(), "ZionDex Token");
        assertEq(token.symbol(), "ZDX");
        assertEq(token.decimals(), 18);
    }

    function test_Transfer_Success() public {
        uint256 amount = 1000 * 1e18;
        token.transfer(user1, amount);
        assertEq(token.balanceOf(user1), amount);
        assertEq(token.balanceOf(admin), 10_000_000 * 1e18 - amount);
    }

    function test_Transfer_RevertInsufficientBalance() public {
        vm.prank(user1);
        vm.expectRevert();
        token.transfer(admin, 100 * 1e18);
    }

    function test_ApproveAndTransferFrom() public {
        uint256 amount = 500 * 1e18;
        token.approve(user1, amount);

        vm.prank(user1);
        token.transferFrom(admin, user2, amount);

        assertEq(token.balanceOf(user2), amount);
        assertEq(token.allowance(admin, user1), 0);
    }

    function test_TransferFrom_InfiniteAllowance() public {
        token.approve(user1, type(uint256).max);

        vm.prank(user1);
        token.transferFrom(admin, user2, 100 * 1e18);

        assertEq(token.allowance(admin, user1), type(uint256).max);
    }

    function test_Mint_OnlyMinter() public {
        uint256 before = token.totalSupply();
        vm.prank(minter);
        token.mint(user1, 1000 * 1e18);
        assertEq(token.balanceOf(user1), 1000 * 1e18);
        assertEq(token.totalSupply(), before + 1000 * 1e18);
    }

    function test_Mint_RevertWithoutMinterRole() public {
        vm.prank(user1);
        vm.expectRevert();
        token.mint(user1, 1000 * 1e18);
    }

    function test_Mint_RevertExceedsMaxSupply() public {
        uint256 current = token.totalSupply();
        uint256 max = token.MAX_SUPPLY();
        vm.prank(minter);
        vm.expectRevert("MAX_SUPPLY_EXCEEDED");
        token.mint(user1, max - current + 1);
    }

    function test_Burn_FromSlasher() public {
        uint256 amount = 1000 * 1e18;
        token.transfer(slasher, amount);
        uint256 before = token.totalSupply();
        vm.prank(slasher);
        token.burn(amount);
        assertEq(token.balanceOf(slasher), 0);
        assertEq(token.totalSupply(), before - amount);
    }

    function test_Burn_RevertWithoutSlasherRole() public {
        vm.prank(user1);
        vm.expectRevert();
        token.burn(1000);
    }

    function test_SetMinter_ByAdmin() public {
        address newMinter = makeAddr("newMinter");
        token.setMinter(newMinter);
        assertEq(token.hasRole(token.MINTER_ROLE(), newMinter), true);
        assertEq(token.hasRole(token.MINTER_ROLE(), minter), false);
    }

    function test_SetMinter_RevertWithoutAdmin() public {
        vm.prank(user1);
        vm.expectRevert();
        token.setMinter(user2);
    }

    function test_GetMinter_ReturnsCurrentMinter() public {
        assertEq(token.getMinter(), minter);
    }
}
