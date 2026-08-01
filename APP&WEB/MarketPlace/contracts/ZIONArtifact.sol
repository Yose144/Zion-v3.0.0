// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title ZIONArtifact — ERC-1155 NFT for OASIS & ZION ecosystem artifacts
/// @notice Mint avatars, ships, quest items, territories, Golden Eggs, badges
/// @dev Each token ID = one artifact type. Supply per token ID is tracked.
contract ZIONArtifact is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant GAME_ROLE = keccak256("GAME_ROLE");

    /// @dev tokenId => total supply minted
    mapping(uint256 => uint256) private _totalSupply;

    /// @dev tokenId => creator
    mapping(uint256 => address) public tokenCreator;

    /// @dev tokenId => category (avatar, ship, quest_item, etc.)
    mapping(uint256 => bytes32) public tokenCategory;

    /// @dev tokenId => rarity (common, rare, legendary, etc.)
    mapping(uint256 => bytes32) public tokenRarity;

    event ArtifactMinted(uint256 indexed tokenId, address indexed to, uint256 amount, bytes32 category, bytes32 rarity);
    event ArtifactBatchMinted(uint256[] tokenIds, address indexed to, uint256[] amounts);

    constructor(string memory _uri) ERC1155(_uri) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(GAME_ROLE, msg.sender);
    }

    /// @notice Mint a single artifact
    /// @param to Recipient address
    /// @param id Token ID (artifact type)
    /// @param amount Quantity to mint
    /// @param category Category hash (keccak256 of "avatar", "ship", etc.)
    /// @param rarity Rarity hash (keccak256 of "common", "rare", etc.)
    /// @param data Extra data (IPFS metadata URI)
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes32 category,
        bytes32 rarity,
        bytes memory data
    ) external onlyRole(MINTER_ROLE) {
        _totalSupply[id] += amount;
        if (tokenCreator[id] == address(0)) {
            tokenCreator[id] = msg.sender;
            tokenCategory[id] = category;
            tokenRarity[id] = rarity;
        }
        _mint(to, id, amount, data);
        emit ArtifactMinted(id, to, amount, category, rarity);
    }

    /// @notice Batch mint multiple artifact types
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) external onlyRole(MINTER_ROLE) {
        for (uint256 i = 0; i < ids.length; i++) {
            _totalSupply[ids[i]] += amounts[i];
            if (tokenCreator[ids[i]] == address(0)) {
                tokenCreator[ids[i]] = msg.sender;
            }
        }
        _mintBatch(to, ids, amounts, data);
        emit ArtifactBatchMinted(ids, to, amounts);
    }

    /// @notice Get total supply for a token ID
    function totalSupply(uint256 id) external view returns (uint256) {
        return _totalSupply[id];
    }

    /// @notice Check if a token ID exists (has been minted)
    function exists(uint256 id) external view returns (bool) {
        return _totalSupply[id] > 0;
    }

    /// @notice Update metadata URI (admin only)
    function setURI(string memory newuri) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
    }

    /// @notice Grant game contract permission to mint quest rewards
    function grantGameRole(address game) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(GAME_ROLE, game);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
