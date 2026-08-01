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
    uint256 sellerKey = 1;
    uint256 buyerKey = 2;

    function setUp() public {
        wzion = new MockWZION();
        artifact = new ZIONArtifact("https://ipfs.io/ipfs/{id}.json");
        marketplace = new ZIONMarketplace(address(wzion));

        // Fund buyer
        wzion.transfer(buyer, 1000 * 10 ** 18);

        // Mint artifact to seller
        vm.startPrank(address(this));
        artifact.mint(seller, 1, 10, keccak256("avatar"), keccak256("rare"), "");
        vm.stopPrank();
    }

    function test_MintArtifact() public view {
        assertEq(artifact.balanceOf(seller, 1), 10);
        assertEq(artifact.tokenCreator(1), address(this));
    }

    function test_CreateAndBuyListing() public {
        // Seller approves marketplace
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);

        uint256 listingId = marketplace.createListing(
            address(artifact),
            1,      // tokenId
            5,      // quantity
            10 * 10 ** 18,  // price per item
            0       // no expiry
        );
        vm.stopPrank();

        // Buyer approves wZION spending
        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        marketplace.buy(listingId, 2);
        vm.stopPrank();

        assertEq(artifact.balanceOf(buyer, 1), 2);
        assertEq(artifact.balanceOf(address(marketplace), 1), 3);
    }

    function test_AuctionFlow() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createAuction(
            address(artifact),
            1, 1, 5 * 10 ** 18, 1 hours
        );
        vm.stopPrank();

        // Buyer bids
        vm.startPrank(buyer);
        wzion.approve(address(marketplace), type(uint256).max);
        marketplace.bid(listingId, 7 * 10 ** 18);
        vm.stopPrank();

        // Warp past auction end
        vm.warp(block.timestamp + 2 hours);

        marketplace.settleAuction(listingId);

        assertEq(artifact.balanceOf(buyer, 1), 1);
    }

    function test_CancelListing() public {
        vm.startPrank(seller);
        artifact.setApprovalForAll(address(marketplace), true);
        uint256 listingId = marketplace.createListing(
            address(artifact), 1, 3, 10 * 10 ** 18, 0
        );
        marketplace.cancelListing(listingId);
        vm.stopPrank();

        // NFTs returned to seller
        assertEq(artifact.balanceOf(seller, 1), 10);
        assertEq(artifact.balanceOf(address(marketplace), 1), 0);
    }
}
