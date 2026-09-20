// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WZION} from "../src/evm/wZION.sol";
import {ZIONBridge} from "../src/evm/ZIONBridge.sol";

/// @title DeployRobinhood
/// @notice Deploy wZION + ZIONBridge on Robinhood Chain (Arbitrum Orbit L2,
///         chain ID 4663) from the canonical deployer EOA at nonce 0/1 so the
///         contracts land on the same addresses as every other EVM chain:
///           wZION      = CREATE nonce0 = 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6
///           ZIONBridge = CREATE nonce1 = 0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721
///
///         REQUIRED before running:
///           - PRIVATE_KEY = deployer key (validator-1 /etc/zion/keys/validator.key)
///           - deployer 0xdde17506…D186 funded with ETH on chain 4663
///           - deployer nonce on 4663 MUST be 0 (verified 2026-09-20)
///
///         Run:
///           forge script script/DeployRobinhood.s.sol \
///             --rpc-url https://rpc.mainnet.chain.robinhood.com \
///             --broadcast --verify -vvvv
///
///         Post-deploy:
///           - set enabled=true for [chains.robinhood] in warp.toml, restart warpd
///           - add BRIDGE_CONTRACTS_ROBINHOOD wiring on the website
contract DeployRobinhood is Script {
    address constant EXPECTED_WZION = 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6;
    address constant EXPECTED_BRIDGE = 0xa5a09b2C09A7182BBA9623A2D2cd46cD7D041721;

    // Canonical 5-validator set (see L2contracts.md §Bridge Validators).
    address[5] VALIDATORS = [
        0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186,
        0x24d986841E56e5571489B25951eE8C1Ae761FA82,
        0x665c55eDCF25c2c5A1dfF1B20eE950cBDC58d3d0,
        0x8E644b3E9FaBf52eE321DC5B3D5AA06d6e3E66C6,
        0x7e0D2eD71d78B9CFB5034A83333e82e304bc4CB2
    ];

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        require(deployer == VALIDATORS[0], "not the canonical deployer");

        uint256 nonce = vm.getNonce(deployer);
        require(nonce == 0, "deployer nonce != 0 - canonical addresses would change");
        require(block.chainid == 4663, "not robinhood mainnet (4663)");

        vm.startBroadcast(deployerKey);

        // nonce 0 → wZION (bridge arg = the predicted CREATE@nonce1 address)
        WZION wzion = new WZION(deployer, EXPECTED_BRIDGE, deployer);
        require(address(wzion) == EXPECTED_WZION, "wZION address mismatch");
        console.log("wZION deployed:", address(wzion));

        // nonce 1 → ZIONBridge (4/5 threshold — older chains still run 5/5)
        ZIONBridge bridge = new ZIONBridge(
            deployer,
            deployer,
            address(wzion),
            _validators(),
            4
        );
        require(address(bridge) == EXPECTED_BRIDGE, "bridge address mismatch");
        console.log("ZIONBridge deployed:", address(bridge));

        vm.stopBroadcast();

        vm.writeJson(
            string(abi.encodePacked(
                '{"network":"robinhood","chainId":4663,',
                '"contracts":{"WZION":"', vm.toString(address(wzion)),
                '","ZIONBridge":"', vm.toString(address(bridge)), '"}}'
            )),
            "deployments/robinhood.json"
        );
    }

    function _validators() internal view returns (address[] memory v) {
        v = new address[](5);
        for (uint256 i = 0; i < 5; i++) v[i] = VALIDATORS[i];
    }
}
