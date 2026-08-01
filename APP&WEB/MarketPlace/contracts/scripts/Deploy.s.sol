// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../ZIONArtifact.sol";
import "../ZIONMarketplace.sol";

contract Deploy is Script {
    // wZION address on Base Mainnet (from deployed-base.json)
    address constant WZION = 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy ERC-1155 Artifact NFT
        ZIONArtifact artifact = new ZIONArtifact("https://ipfs.io/ipfs/{id}.json");
        console.log("ZIONArtifact deployed:", address(artifact));

        // Deploy Marketplace
        ZIONMarketplace marketplace = new ZIONMarketplace(WZION);
        console.log("ZIONMarketplace deployed:", address(marketplace));

        vm.stopBroadcast();
    }
}
