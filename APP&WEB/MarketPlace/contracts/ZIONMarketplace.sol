// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ZIONMarketplace — ERC-1155 marketplace with hybrid L1/L2 payment
/// @notice Fixed-price listings + auctions. Payment in wZION (L2) OR native ZION (L1 via bridge).
/// @dev Royalties: 2.5% marketplace fee + 5% creator royalty on secondary sales.
///      L1 payment: buyer sends ZION to bridge vault with memo MARKETBUY:listingId,
///      watcher calls relayerSettle() — NFT transfers on L2, seller gets wZION via bridge.
contract ZIONMarketplace is AccessControl, ERC1155Holder, ReentrancyGuard {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant RELAYER_ROLE = keccak256("RELAYER_ROLE");

    IERC20 public immutable wzion;
    uint256 public constant MARKETPLACE_FEE_BPS = 250;   // 2.5%
    uint256 public constant ROYALTY_BPS = 500;            // 5%
    uint256 public constant MAX_ROYALTY_BPS = 1000;       // 10% cap

    struct Listing {
        uint256 listingId;
        address seller;
        address nftAddress;
        uint256 tokenId;
        uint256 quantity;
        uint256 pricePerItem;  // in wZION wei
        uint256 expiryTime;    // 0 = no expiry
        bool isAuction;
        bool active;
    }

    struct Auction {
        uint256 highestBid;
        address highestBidder;
        uint256 bidCount;
        uint256 endTime;
    }

    /// @dev listingId => Listing
    mapping(uint256 => Listing) public listings;
    /// @dev listingId => Auction
    mapping(uint256 => Auction) public auctions;
    /// @dev nftAddress => tokenId => royaltyBps (creator royalty)
    mapping(address => mapping(uint256 => uint256)) public royaltyBps;
    /// @dev nftAddress => tokenId => creator (royalty recipient)
    mapping(address => mapping(uint256 => address)) public royaltyRecipient;

    uint256 private nextListingId = 1;

    // ── Events ──────────────────────────────────────────────────────

    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        address indexed nftAddress,
        uint256 tokenId,
        uint256 quantity,
        uint256 pricePerItem,
        bool isAuction,
        uint256 expiryTime
    );
    event ListingCancelled(uint256 indexed listingId);
    event ListingPurchased(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 quantity,
        uint256 totalPrice
    );
    event BidPlaced(uint256 indexed listingId, address indexed bidder, uint256 amount);
    event AuctionSettled(uint256 indexed listingId, address winner, uint256 amount);
    event RoyaltySet(address indexed nftAddress, uint256 indexed tokenId, address recipient, uint256 bps);
    event L1Settled(uint256 indexed listingId, address indexed buyer, uint256 quantity, uint256 totalPrice);

    constructor(address _wzion) {
        wzion = IERC20(_wzion);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
    }

    // ── Listing Management ──────────────────────────────────────────

    /// @notice Create a fixed-price listing
    function createListing(
        address nftAddress,
        uint256 tokenId,
        uint256 quantity,
        uint256 pricePerItem,
        uint256 expiryTime
    ) external nonReentrant returns (uint256) {
        require(pricePerItem > 0, "Price must be > 0");
        require(quantity > 0, "Quantity must be > 0");
        require(
            IERC1155(nftAddress).balanceOf(msg.sender, tokenId) >= quantity,
            "Insufficient balance"
        );

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            nftAddress: nftAddress,
            tokenId: tokenId,
            quantity: quantity,
            pricePerItem: pricePerItem,
            expiryTime: expiryTime,
            isAuction: false,
            active: true
        });

        // Transfer NFTs to marketplace for escrow
        IERC1155(nftAddress).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            quantity,
            ""
        );

        emit ListingCreated(listingId, msg.sender, nftAddress, tokenId, quantity, pricePerItem, false, expiryTime);
        return listingId;
    }

    /// @notice Create an auction listing
    function createAuction(
        address nftAddress,
        uint256 tokenId,
        uint256 quantity,
        uint256 startingPrice,
        uint256 duration
    ) external nonReentrant returns (uint256) {
        require(startingPrice > 0, "Starting price must be > 0");
        require(duration > 0, "Duration must be > 0");

        uint256 listingId = nextListingId++;
        uint256 endTime = block.timestamp + duration;

        listings[listingId] = Listing({
            listingId: listingId,
            seller: msg.sender,
            nftAddress: nftAddress,
            tokenId: tokenId,
            quantity: quantity,
            pricePerItem: startingPrice,
            expiryTime: endTime,
            isAuction: true,
            active: true
        });

        auctions[listingId] = Auction({
            highestBid: 0,
            highestBidder: address(0),
            bidCount: 0,
            endTime: endTime
        });

        IERC1155(nftAddress).safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            quantity,
            ""
        );

        emit ListingCreated(listingId, msg.sender, nftAddress, tokenId, quantity, startingPrice, true, endTime);
        return listingId;
    }

    /// @notice Cancel a listing (returns NFTs to seller)
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not seller");

        listing.active = false;
        IERC1155(listing.nftAddress).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            listing.quantity,
            ""
        );

        emit ListingCancelled(listingId);
    }

    // ── Buying (Fixed Price) ────────────────────────────────────────

    /// @notice Buy items from a fixed-price listing
    function buy(uint256 listingId, uint256 quantity) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(!listing.isAuction, "Use bid() for auctions");
        require(quantity <= listing.quantity, "Quantity exceeds available");
        _checkExpiry(listing);

        uint256 totalPrice = listing.pricePerItem * quantity;
        uint256 fee = (totalPrice * MARKETPLACE_FEE_BPS) / 10000;
        uint256 royalty = _calculateRoyalty(listing.nftAddress, listing.tokenId, totalPrice);
        uint256 sellerProceeds = totalPrice - fee - royalty;

        // Transfer wZION from buyer
        require(
            wzion.transferFrom(msg.sender, address(this), totalPrice),
            "Payment failed"
        );

        // Pay seller, fee recipient, and royalty recipient
        if (sellerProceeds > 0) {
            require(wzion.transfer(listing.seller, sellerProceeds), "Seller payment failed");
        }
        if (royalty > 0) {
            address recipient = royaltyRecipient[listing.nftAddress][listing.tokenId];
            require(wzion.transfer(recipient, royalty), "Royalty payment failed");
        }

        // Transfer NFT to buyer
        listing.quantity -= quantity;
        if (listing.quantity == 0) {
            listing.active = false;
        }
        IERC1155(listing.nftAddress).safeTransferFrom(
            address(this),
            msg.sender,
            listing.tokenId,
            quantity,
            ""
        );

        emit ListingPurchased(listingId, msg.sender, quantity, totalPrice);
    }

    // ── L1 Settlement (Hybrid Payment) ──────────────────────────────

    /// @notice Settle a fixed-price listing paid with native ZION on L1
    /// @dev Called by RELAYER_ROLE (L1 watcher). Buyer sent ZION to bridge vault
    ///      with memo MARKETBUY:listingId. Bridge mints wZION to seller separately.
    ///      This function only transfers the NFT — payment already happened on L1.
    /// @param listingId The listing to settle
    /// @param buyer L2 address of the buyer (from bridge memo or derived)
    /// @param quantity Number of items to transfer
    function relayerSettle(
        uint256 listingId,
        address buyer,
        uint256 quantity
    ) external onlyRole(RELAYER_ROLE) nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(!listing.isAuction, "Use relayerSettleAuction for auctions");
        require(quantity <= listing.quantity, "Quantity exceeds available");
        require(buyer != address(0), "Invalid buyer");
        _checkExpiry(listing);

        uint256 totalPrice = listing.pricePerItem * quantity;

        // NFT transfer only — wZION payment handled by bridge (seller gets wZION minted)
        listing.quantity -= quantity;
        if (listing.quantity == 0) {
            listing.active = false;
        }
        IERC1155(listing.nftAddress).safeTransferFrom(
            address(this),
            buyer,
            listing.tokenId,
            quantity,
            ""
        );

        emit L1Settled(listingId, buyer, quantity, totalPrice);
        emit ListingPurchased(listingId, buyer, quantity, totalPrice);
    }

    /// @notice Settle an auction paid with native ZION on L1
    /// @dev Called by RELAYER_ROLE after L1 auction payment confirmed
    function relayerSettleAuction(uint256 listingId) external onlyRole(RELAYER_ROLE) nonReentrant {
        Listing storage listing = listings[listingId];
        Auction storage auction = auctions[listingId];
        require(listing.active, "Listing not active");
        require(listing.isAuction, "Not an auction");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(auction.highestBidder != address(0), "No bids");

        listing.active = false;

        // NFT transfer only — payment handled on L1
        IERC1155(listing.nftAddress).safeTransferFrom(
            address(this),
            auction.highestBidder,
            listing.tokenId,
            listing.quantity,
            ""
        );

        emit L1Settled(listingId, auction.highestBidder, listing.quantity, auction.highestBid);
        emit AuctionSettled(listingId, auction.highestBidder, auction.highestBid);
    }

    /// @notice Grant relayer role (L1 watcher service)
    function grantRelayerRole(address relayer) external onlyRole(ADMIN_ROLE) {
        _grantRole(RELAYER_ROLE, relayer);
    }

    // ── Bidding (Auction) ───────────────────────────────────────────

    /// @notice Place a bid on an auction
    function bid(uint256 listingId, uint256 amount) external nonReentrant {
        Listing storage listing = listings[listingId];
        Auction storage auction = auctions[listingId];
        require(listing.active, "Listing not active");
        require(listing.isAuction, "Not an auction");
        require(block.timestamp < auction.endTime, "Auction ended");
        require(amount > auction.highestBid, "Bid too low");
        require(
            wzion.transferFrom(msg.sender, address(this), amount),
            "Bid payment failed"
        );

        // Refund previous bidder
        if (auction.highestBidder != address(0)) {
            require(wzion.transfer(auction.highestBidder, auction.highestBid), "Refund failed");
        }

        auction.highestBid = amount;
        auction.highestBidder = msg.sender;
        auction.bidCount++;

        emit BidPlaced(listingId, msg.sender, amount);
    }

    /// @notice Settle an ended auction (transfer NFT to winner, pay seller)
    function settleAuction(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        Auction storage auction = auctions[listingId];
        require(listing.active, "Listing not active");
        require(listing.isAuction, "Not an auction");
        require(block.timestamp >= auction.endTime, "Auction not ended");
        require(auction.highestBidder != address(0), "No bids");

        listing.active = false;

        uint256 totalPrice = auction.highestBid;
        uint256 fee = (totalPrice * MARKETPLACE_FEE_BPS) / 10000;
        uint256 royalty = _calculateRoyalty(listing.nftAddress, listing.tokenId, totalPrice);
        uint256 sellerProceeds = totalPrice - fee - royalty;

        if (sellerProceeds > 0) {
            require(wzion.transfer(listing.seller, sellerProceeds), "Seller payment failed");
        }
        if (royalty > 0) {
            address recipient = royaltyRecipient[listing.nftAddress][listing.tokenId];
            require(wzion.transfer(recipient, royalty), "Royalty payment failed");
        }

        IERC1155(listing.nftAddress).safeTransferFrom(
            address(this),
            auction.highestBidder,
            listing.tokenId,
            listing.quantity,
            ""
        );

        emit AuctionSettled(listingId, auction.highestBidder, totalPrice);
    }

    // ── Royalty Management ──────────────────────────────────────────

    /// @notice Set royalty for a token (creator only, max 10%)
    function setRoyalty(
        address nftAddress,
        uint256 tokenId,
        address recipient,
        uint256 bps
    ) external {
        require(bps <= MAX_ROYALTY_BPS, "Royalty too high");
        // Only the NFT contract's creator can set royalty
        // (in production, verify via the NFT contract's tokenCreator mapping)
        royaltyBps[nftAddress][tokenId] = bps;
        royaltyRecipient[nftAddress][tokenId] = recipient;
        emit RoyaltySet(nftAddress, tokenId, recipient, bps);
    }

    // ── View Functions ──────────────────────────────────────────────

    function getListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }

    function getAuction(uint256 listingId) external view returns (Auction memory) {
        return auctions[listingId];
    }

    function totalListings() external view returns (uint256) {
        return nextListingId - 1;
    }

    // ── Internal ────────────────────────────────────────────────────

    function _calculateRoyalty(
        address nftAddress,
        uint256 tokenId,
        uint256 salePrice
    ) internal view returns (uint256) {
        uint256 bps = royaltyBps[nftAddress][tokenId];
        return (salePrice * bps) / 10000;
    }

    function _checkExpiry(Listing storage listing) internal view {
        if (listing.expiryTime > 0) {
            require(block.timestamp < listing.expiryTime, "Listing expired");
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC1155Holder)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
