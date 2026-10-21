// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../ZIONArtifact.sol";
import "../ZIONMarketplace.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock wZION ERC-20 for testing
contract MockWZION is ERC20 {
    constructor() ERC20("Wrapped ZION", "wZION") {
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }
}

contract ZIONMarketplaceTest is Test {
    ZIONArtifact artifact;
    ZIONMarketplace marketplace;
    MockWZION wzion;

    address seller = makeAddr("seller");
    address buyer = makeAddr("buyer");
    address buyer2 = makeAddr("buyer2");
    address treasury = makeAddr("treasury");

    uint256 constant E18 = 10 ** 18;

    function setUp() public {
        wzion = new MockWZION();
        artifact = new ZIONArtifact("https://ipfs.io/ipfs/{id}.json");
        marketplace = new ZIONMarketplace(address(wzion));
        marketplace.setFeeRecipient(treasury);

        // Fund buyers
        wzion.transfer(buyer, 1000 * E18);
        wzion.transfer(buyer2, 1000 * E18);

        // Mint artifact to seller (this contract is MINTER)
        artifact.mint(seller, 1, 10, keccak256("avatar"), keccak256("rare"), "");
    }

    function test_MintArtifact() public view {
        assertEq(artifact.balanceOf(seller, 1), 10);
        assertEq(artifact.tokenCreator(1), address(this));
    }

    function test_CreateAndBuyListing() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact),
            1,
            5,
            10 * E18,
            0
        );
        vm.stopPrank();

        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        marketplace.buy(listingId, 2);
        vm.stopPrank();

        assertEq(artifact.balanceOf(buyer, 1), 2);
        assertEq(artifact.balanceOf(address(marketplace), 1), 3);
    }

    /// @dev 2.5% marketplace fee is actually paid to feeRecipient
    function test_FeeTransferredToRecipient() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 5, 10 * E18, 0
        );
        vm.stopPrank();

        uint256 totalPrice = 20 * E18; // 2 items * 10
        uint256 expectedFee = (totalPrice * 250) / 10000; // 0.5

        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        marketplace.buy(listingId, 2);
        vm.stopPrank();

        assertEq(wzion.balanceOf(treasury), expectedFee);
        assertEq(wzion.balanceOf(seller), totalPrice - expectedFee);
        assertEq(wzion.balanceOf(address(marketplace)), 0);
    }

    /// @dev feeRecipient=address(0) disables the fee (seller keeps it)
    function test_FeeDisabledToZeroRecipient() public {
        marketplace.setFeeRecipient(address(0));

        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 5, 10 * E18, 0
        );
        vm.stopPrank();

        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        marketplace.buy(listingId, 2);
        vm.stopPrank();

        assertEq(wzion.balanceOf(seller), 20 * E18); // full proceeds, no fee
    }

    function test_AuctionFlow() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createAuction(
            address(artifact),
            1, 1, 5 * E18, 1 hours
        );
        vm.stopPrank();

        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        marketplace.bid(listingId, 7 * E18);
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours);
        marketplace.settleAuction(listingId);

        assertEq(artifact.balanceOf(buyer, 1), 1);
        // 2.5% fee of 7 = 0.175 to treasury, rest to seller
        uint256 fee = (7 * E18 * 250) / 10000;
        assertEq(wzion.balanceOf(treasury), fee);
        assertEq(wzion.balanceOf(seller), 7 * E18 - fee);
    }

    /// @dev Outbid bidder's funds go to pendingReturns, claimable via withdrawRefund
    function test_OutbidPullRefund() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createAuction(
            address(artifact), 1, 1, 5 * E18, 1 hours
        );
        vm.stopPrank();

        vm.prank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        vm.prank(buyer2);
        wzion.approve(address(marketplace), type(uint256).max);

        vm.prank(buyer);
        marketplace.bid(listingId, 6 * E18);
        uint256 buyerAfterBid = wzion.balanceOf(buyer);

        vm.prank(buyer2);
        marketplace.bid(listingId, 7 * E18);

        // buyer's outbid 6 is pending, not pushed back
        assertEq(marketplace.pendingReturns(buyer), 6 * E18);
        assertEq(wzion.balanceOf(buyer), buyerAfterBid);

        vm.prank(buyer);
        marketplace.withdrawRefund();
        assertEq(wzion.balanceOf(buyer), 1000 * E18);
        assertEq(marketplace.pendingReturns(buyer), 0);
    }

    function test_CancelListing() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 3, 10 * E18, 0
        );
        marketplace.cancelListing(listingId);
        vm.stopPrank();

        assertEq(artifact.balanceOf(seller, 1), 10);
        assertEq(artifact.balanceOf(address(marketplace), 1), 0);
    }

    /// @dev Token creator can set royalty; royalty paid out on buy
    function test_RoyaltyByCreator() public {
        // this contract minted token 1 → it is tokenCreator
        address creatorAddr = address(this);
        marketplace.setRoyalty(address(artifact), 1, creatorAddr, 500); // 5%

        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 5, 10 * E18, 0
        );
        vm.stopPrank();

        uint256 totalPrice = 10 * E18;
        uint256 fee = (totalPrice * 250) / 10000;
        uint256 royalty = (totalPrice * 500) / 10000;
        uint256 thisBalBefore = wzion.balanceOf(creatorAddr);

        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        marketplace.buy(listingId, 1);
        vm.stopPrank();

        assertEq(wzion.balanceOf(creatorAddr) - thisBalBefore, royalty);
        assertEq(wzion.balanceOf(treasury), fee);
        assertEq(wzion.balanceOf(seller), totalPrice - fee - royalty);
    }

    /// @dev Non-creator non-admin cannot set royalty
    function test_RoyaltyUnauthorizedReverts() public {
        vm.prank(buyer);
        vm.expectRevert("Not token creator");
        marketplace.setRoyalty(address(artifact), 1, buyer, 500);
    }

    /// @dev Admin can set royalty even when not the creator
    function test_RoyaltyByAdmin() public {
        marketplace.setRoyalty(address(artifact), 1, seller, 300);
        assertEq(marketplace.royaltyBps(address(artifact), 1), 300);
        assertEq(marketplace.royaltyRecipient(address(artifact), 1), seller);
    }

    /// @dev Non-ZION NFT (no tokenCreator fn): only admin can set royalty
    function test_RoyaltyNonZionNftAdminOnly() public {
        MockWZION fakeNft = new MockWZION(); // not ERC1155, no tokenCreator
        vm.prank(buyer);
        vm.expectRevert("Not authorized");
        marketplace.setRoyalty(address(fakeNft), 1, buyer, 100);

        marketplace.setRoyalty(address(fakeNft), 1, seller, 100); // admin ok
        assertEq(marketplace.royaltyBps(address(fakeNft), 1), 100);
    }

    /// @dev L1 hybrid payment: relayer settles a listing paid on L1
    function test_RelayerSettleL1Payment() public {
        address relayer = makeAddr("relayer");
        marketplace.grantRelayerRole(relayer);

        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 5, 10 * E18, 0
        );
        vm.stopPrank();

        vm.startPrank(relayer);
        marketplace.relayerSettle(listingId, buyer, 2);
        vm.stopPrank();

        assertEq(artifact.balanceOf(buyer, 1), 2);
        assertEq(artifact.balanceOf(address(marketplace), 1), 3);
        assertEq(wzion.balanceOf(buyer), 1000 * E18);
    }

    /// @dev Non-relayer cannot call relayerSettle
    function test_RelayerSettle_Unauthorized() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 5, 10 * E18, 0
        );
        vm.stopPrank();

        vm.startPrank(buyer);
        vm.expectRevert();
        marketplace.relayerSettle(listingId, buyer, 1);
        vm.stopPrank();
    }

    /// @dev Buying expired listing reverts
    function test_BuyExpiredReverts() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 5, 10 * E18, block.timestamp + 1 hours
        );
        vm.stopPrank();

        vm.warp(block.timestamp + 2 hours);
        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        vm.expectRevert("Listing expired");
        marketplace.buy(listingId, 1);
        vm.stopPrank();
    }

    /// @dev Second bidder must exceed highest bid
    function test_BidTooLowReverts() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createAuction(
            address(artifact), 1, 1, 5 * E18, 1 hours
        );
        vm.stopPrank();

        vm.prank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        vm.prank(buyer2);
        wzion.approve(address(marketplace), type(uint256).max);

        vm.prank(buyer);
        marketplace.bid(listingId, 6 * E18);
        vm.prank(buyer2);
        vm.expectRevert("Bid too low");
        marketplace.bid(listingId, 6 * E18);
    }
}
