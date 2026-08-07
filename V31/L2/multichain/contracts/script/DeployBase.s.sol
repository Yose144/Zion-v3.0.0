// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ZionDexPoolManager} from "../src/dex/ZionDexPoolManager.sol";
import {ZionDexHooks} from "../src/dex/ZionDexHooks.sol";
import {ZionDexRouter} from "../src/dex/ZionDexRouter.sol";
import {ZDXToken} from "../src/dex/ZDXToken.sol";
import {ZionDexStaking} from "../src/dex/ZionDexStaking.sol";
import {SolverRegistry} from "../src/dex/SolverRegistry.sol";
import {IntentSettlement} from "../src/dex/IntentSettlement.sol";

/// @title DeployBase
/// @notice Deploy all ZionDex contracts on Base mainnet
contract DeployBase is Script {
    // wZION on Base
    address constant WZION = 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy ZDX Token
        ZDXToken zdx = new ZDXToken();
        console.log("ZDXToken deployed:", address(zdx));

        // 2. Deploy Pool Manager
        ZionDexPoolManager poolManager = new ZionDexPoolManager(WZION);
        console.log("ZionDexPoolManager deployed:", address(poolManager));

        // 3. Deploy Hooks
        ZionDexHooks hooks = new ZionDexHooks(WZION);
        console.log("ZionDexHooks deployed:", address(hooks));

        // 4. Deploy Router
        ZionDexRouter router = new ZionDexRouter(address(poolManager), WZION);
        console.log("ZionDexRouter deployed:", address(router));

        // 5. Deploy Staking
        ZionDexStaking staking = new ZionDexStaking(address(zdx));
        console.log("ZionDexStaking deployed:", address(staking));

        // 6. Transfer ZDX ownership to staking contract (for minting rewards)
        // Note: ZDXToken.owner is the deployer — transfer to staking
        // In production: use AccessControl with MINTER_ROLE

        // 7. Deploy SolverRegistry (Phase 4 — Intent-Based Execution)
        SolverRegistry solverRegistry = new SolverRegistry(address(zdx));
        console.log("SolverRegistry deployed:", address(solverRegistry));

        // 8. Deploy IntentSettlement
        IntentSettlement intentSettlement = new IntentSettlement(address(solverRegistry));
        console.log("IntentSettlement deployed:", address(intentSettlement));

        // 9. Authorize IntentSettlement to record solver executions
        solverRegistry.setSettlementContract(address(intentSettlement));

        // 10. Configure IntentSettlement: solverFeeBps = 10 (0.1%), feeRecipient = deployer
        intentSettlement.setSolverFeeBps(10);
        intentSettlement.setFeeRecipient(msg.sender);
        console.log("IntentSettlement configured: solverFeeBps=10, feeRecipient=deployer");

        vm.stopBroadcast();

        // Write deployment addresses
        string memory json = string(abi.encodePacked(
            '{"network":"base","chainId":8453,',
            '"contracts":{',
            '"ZDXToken":"', addressToString(address(zdx)), '",',
            '"ZionDexPoolManager":"', addressToString(address(poolManager)), '",',
            '"ZionDexHooks":"', addressToString(address(hooks)), '",',
            '"ZionDexRouter":"', addressToString(address(router)), '",',
            '"ZionDexStaking":"', addressToString(address(staking)), '",',
            '"SolverRegistry":"', addressToString(address(solverRegistry)), '",',
            '"IntentSettlement":"', addressToString(address(intentSettlement)), '"',
            '}}'
        ));
        vm.writeJson(json, "deployments/base.json");
        console.log("Deployment addresses written to deployments/base.json");
    }

    function addressToString(address addr) internal pure returns (string memory) {
        return vm.toString(addr);
    }
}
