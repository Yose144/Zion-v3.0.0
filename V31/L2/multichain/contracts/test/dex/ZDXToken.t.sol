// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {ZDXToken} from "../../src/dex/ZDXToken.sol";

/// @title ZDXToken Test Suite
contract ZDXTokenTest is Test {
    ZDXToken public token;
    address owner = address(this);
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");

    function setUp() public {
        token = new ZDXToken();
    }

    function test_Constructor_MintsInitialSupply() public view {
        assertEq(token.totalSupply(), 10_000_000 * 1e18);
        assertEq(token.balanceOf(owner), 10_000_000 * 1e18);
        assertEq(token.owner(), owner);
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
        assertEq(token.balanceOf(owner), 10_000_000 * 1e18 - amount);
    }

    function test_Transfer_RevertInsufficientBalance() public {
        vm.expectRevert();
        token.transfer(user1, 100_000_000 * 1e18);
    }

    function test_ApproveAndTransferFrom() public {
        uint256 amount = 500 * 1e18;
        token.approve(user1, amount);

        vm.prank(user1);
        token.transferFrom(owner, user2, amount);

        assertEq(token.balanceOf(user2), amount);
        assertEq(token.allowance(owner, user1), 0);
    }

    function test_TransferFrom_InfiniteAllowance() public {
        token.approve(user1, type(uint256).max);

        vm.prank(user1);
        token.transferFrom(owner, user2, 100 * 1e18);

        // Infinite allowance should not decrease
        assertEq(token.allowance(owner, user1), type(uint256).max);
    }

    function test_Mint_OnlyOwner() public {
        uint256 before = token.totalSupply();
        token.mint(user1, 1000 * 1e18);
        assertEq(token.balanceOf(user1), 1000 * 1e18);
        assertEq(token.totalSupply(), before + 1000 * 1e18);
    }

    function test_Mint_RevertNotOwner() public {
        vm.prank(user1);
        vm.expectRevert("NOT_OWNER");
        token.mint(user1, 1000 * 1e18);
    }

    function test_Mint_RevertExceedsMaxSupply() public {
        uint256 current = token.totalSupply();
        uint256 max = token.MAX_SUPPLY();
        vm.expectRevert("MAX_SUPPLY_EXCEEDED");
        token.mint(user1, max - current + 1);
    }
}
