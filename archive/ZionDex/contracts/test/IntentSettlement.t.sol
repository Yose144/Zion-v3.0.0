// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZDXToken} from "../src/ZDXToken.sol";
import {SolverRegistry} from "../src/SolverRegistry.sol";
import {IntentSettlement} from "../src/IntentSettlement.sol";
import {IZDXToken} from "../src/interfaces/IZDXToken.sol";

/// @title MockZDX
/// @notice ZDX-like token with a burn function for solver slashing tests
contract MockZDX is ZDXToken {
    constructor() ZDXToken() {}

    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "INSUFFICIENT_BALANCE");
        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        emit Transfer(msg.sender, address(0), amount);
    }
}

contract IntentSettlementTest is Test {
    MockZDX zdx;
    SolverRegistry solverRegistry;
    IntentSettlement intentSettlement;

    address deployer = address(0xDEAD);
    address solver = address(0xB0B);
    address user = address(0xCAFE);

    // EIP-712 constants (must match IntentSettlement)
    bytes32 private constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant SWAP_INTENT_TYPEHASH = keccak256(
        "SwapIntent(address user,uint256 nonce,string fromChain,string toChain,address fromToken,address toToken,uint256 amountIn,uint256 minAmountOut,uint256 deadline)"
    );

    uint256 constant MIN_STAKE = 10_000 * 1e18;

    function setUp() public {
        vm.startPrank(deployer);
        zdx = new MockZDX();
        solverRegistry = new SolverRegistry(address(zdx));
        intentSettlement = new IntentSettlement(address(solverRegistry));
        // Authorize the settlement contract to record solver executions
        solverRegistry.setSettlementContract(address(intentSettlement));
        vm.stopPrank();

        // Fund the solver with ZDX
        vm.startPrank(deployer);
        zdx.transfer(solver, 100_000 * 1e18);
        vm.stopPrank();
    }

    // ── SolverRegistry tests ───────────────────────────────────────────

    function test_SolverRegistry_Register() public {
        // Solver approves registry and registers
        vm.startPrank(solver);
        zdx.approve(address(solverRegistry), MIN_STAKE);
        solverRegistry.register(MIN_STAKE);
        vm.stopPrank();

        assertTrue(solverRegistry.isSolverActive(solver), "solver should be active");
        (bool active, uint256 stakeAmount,,,,) = solverRegistry.solvers(solver);
        assertTrue(active, "active flag");
        assertEq(stakeAmount, MIN_STAKE, "stake amount");
        assertEq(solverRegistry.solverCount(), 1, "solver count");
    }

    function test_SolverRegistry_Slash() public {
        vm.startPrank(solver);
        zdx.approve(address(solverRegistry), MIN_STAKE);
        solverRegistry.register(MIN_STAKE);
        vm.stopPrank();

        uint256 stakeBefore = zdx.balanceOf(address(solverRegistry));

        vm.prank(deployer);
        vm.expectEmit(true, true, false, true);
        emit SolverRegistry.SolverSlashed(solver, MIN_STAKE * 1000 / 10_000, "failed execution");
        solverRegistry.slash(solver, "failed execution");

        (, uint256 stakeAfter, , uint256 slashedCount,,) = solverRegistry.solvers(solver);
        assertEq(slashedCount, 1, "slashed count");
        // 10% of stake burned
        assertEq(stakeAfter, MIN_STAKE - MIN_STAKE * 1000 / 10_000, "stake after slash");
        // Registry ZDX balance reduced by burned amount
        assertEq(
            zdx.balanceOf(address(solverRegistry)),
            stakeBefore - MIN_STAKE * 1000 / 10_000,
            "registry balance after slash"
        );
    }

    function test_SolverRegistry_Unregister() public {
        vm.startPrank(solver);
        zdx.approve(address(solverRegistry), MIN_STAKE);
        solverRegistry.register(MIN_STAKE);
        vm.stopPrank();

        uint256 solverBalBefore = zdx.balanceOf(solver);

        vm.prank(solver);
        solverRegistry.unregister();

        assertFalse(solverRegistry.isSolverActive(solver), "should be inactive");
        // Solver got their stake back
        assertEq(zdx.balanceOf(solver), solverBalBefore + MIN_STAKE, "stake returned");
    }

    function test_SolverRegistry_MinStake() public {
        vm.startPrank(solver);
        zdx.approve(address(solverRegistry), MIN_STAKE - 1);
        vm.expectRevert(SolverRegistry.InsufficientStake.selector);
        solverRegistry.register(MIN_STAKE - 1);
        vm.stopPrank();
    }

    function test_SolverRegistry_BanAfterMaxSlashes() public {
        vm.startPrank(solver);
        zdx.approve(address(solverRegistry), MIN_STAKE);
        solverRegistry.register(MIN_STAKE);
        vm.stopPrank();

        // Slash 3 times -> banned
        for (uint256 i = 0; i < 3; i++) {
            vm.prank(deployer);
            solverRegistry.slash(solver, "failure");
        }

        (bool active, , , uint256 slashedCount,,) = solverRegistry.solvers(solver);
        assertEq(slashedCount, 3, "slashed count");
        assertFalse(active, "solver should be banned");
        assertFalse(solverRegistry.isSolverActive(solver), "isSolverActive false");
    }

    // ── IntentSettlement: hashing ──────────────────────────────────────

    function test_IntentSettlement_HashIntent() public {
        IntentSettlement.SwapIntent memory intent = _makeIntent(0);
        bytes32 contractHash = intentSettlement.hashIntent(intent);

        // Independently compute the expected EIP-712 digest
        bytes32 structHash = keccak256(
            abi.encode(
                SWAP_INTENT_TYPEHASH,
                intent.user,
                intent.nonce,
                keccak256(bytes(intent.fromChain)),
                keccak256(bytes(intent.toChain)),
                intent.fromToken,
                intent.toToken,
                intent.amountIn,
                intent.minAmountOut,
                intent.deadline
            )
        );
        bytes32 domain = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("ZionDex")),
                keccak256(bytes("1")),
                block.chainid,
                address(intentSettlement)
            )
        );
        bytes32 expected = keccak256(abi.encodePacked("\x19\x01", domain, structHash));

        assertEq(contractHash, expected, "hashIntent should match EIP-712 digest");
    }

    // ── IntentSettlement: signature verification ───────────────────────

    function test_IntentSettlement_VerifySignature() public {
        // Generate a user with a known private key
        uint256 userPk = 0xA11CE;
        address userAddr = vm.addr(userPk);

        IntentSettlement.SwapIntent memory intent = _makeIntentFor(userAddr, 0);
        bytes32 digest = intentSettlement.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        assertTrue(intentSettlement.verifyIntentSignature(intent, sig), "signature should verify");

        // Wrong signer should fail
        uint256 otherPk = 0xB0B;
        (v, r, s) = vm.sign(otherPk, digest);
        bytes memory badSig = abi.encodePacked(r, s, v);
        assertFalse(intentSettlement.verifyIntentSignature(intent, badSig), "wrong signer should fail");
    }

    // ── IntentSettlement: full settlement flow ─────────────────────────

    function test_IntentSettlement_Settle() public {
        // 1. Register solver
        vm.startPrank(solver);
        zdx.approve(address(solverRegistry), MIN_STAKE);
        solverRegistry.register(MIN_STAKE);
        vm.stopPrank();

        // 2. User signs intent
        uint256 userPk = 0xA11CE;
        address userAddr = vm.addr(userPk);
        IntentSettlement.SwapIntent memory intent = _makeIntentFor(userAddr, 0);
        bytes32 digest = intentSettlement.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        // 3. Solver settles
        uint256 amountOut = intent.minAmountOut;
        bytes memory proof = bytes("0xabc");

        vm.prank(solver);
        vm.expectEmit(true, true, true, false);
        emit IntentSettlement.IntentSettled(
            digest, userAddr, solver, intent.amountIn, amountOut
        );
        intentSettlement.settleIntent(intent, sig, amountOut, proof);

        // 4. Verify state
        assertTrue(intentSettlement.isSettled(digest), "should be marked settled");
        assertEq(intentSettlement.userNonces(userAddr), 1, "nonce advanced");

        (bytes32 ih, address sv, uint256 out, uint256 at, bytes32 txh) =
            intentSettlement.settlements(digest);
        assertEq(ih, digest, "settlement intent hash");
        assertEq(sv, solver, "settlement solver");
        assertEq(out, amountOut, "settlement amountOut");
        assertEq(at, block.timestamp, "settlement executedAt");
        assertEq(txh, keccak256(proof), "settlement txHash");
    }

    // ── IntentSettlement: replay protection ────────────────────────────

    function test_IntentSettlement_ReplayProtection() public {
        _registerSolver();

        uint256 userPk = 0xA11CE;
        address userAddr = vm.addr(userPk);
        IntentSettlement.SwapIntent memory intent = _makeIntentFor(userAddr, 0);
        bytes32 digest = intentSettlement.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.startPrank(solver);
        intentSettlement.settleIntent(intent, sig, intent.minAmountOut, bytes("proof"));
        vm.expectRevert(IntentSettlement.AlreadyExecuted.selector);
        intentSettlement.settleIntent(intent, sig, intent.minAmountOut, bytes("proof"));
        vm.stopPrank();
    }

    // ── IntentSettlement: deadline expired ─────────────────────────────

    function test_IntentSettlement_DeadlineExpired() public {
        _registerSolver();

        uint256 userPk = 0xA11CE;
        address userAddr = vm.addr(userPk);
        IntentSettlement.SwapIntent memory intent = _makeIntentFor(userAddr, 0);
        // Set deadline in the past
        intent.deadline = block.timestamp - 1;

        bytes32 digest = intentSettlement.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(solver);
        vm.expectRevert(IntentSettlement.DeadlineExpired.selector);
        intentSettlement.settleIntent(intent, sig, intent.minAmountOut, bytes("proof"));
    }

    // ── IntentSettlement: insufficient output ──────────────────────────

    function test_IntentSettlement_InsufficientOutput() public {
        _registerSolver();

        uint256 userPk = 0xA11CE;
        address userAddr = vm.addr(userPk);
        IntentSettlement.SwapIntent memory intent = _makeIntentFor(userAddr, 0);
        bytes32 digest = intentSettlement.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        // amountOut below minAmountOut
        uint256 badOut = intent.minAmountOut - 1;

        vm.prank(solver);
        vm.expectRevert(IntentSettlement.InsufficientOutput.selector);
        intentSettlement.settleIntent(intent, sig, badOut, bytes("proof"));
    }

    // ── IntentSettlement: only active solvers can settle ───────────────

    function test_IntentSettlement_OnlyActiveSolver() public {
        // Do NOT register solver
        uint256 userPk = 0xA11CE;
        address userAddr = vm.addr(userPk);
        IntentSettlement.SwapIntent memory intent = _makeIntentFor(userAddr, 0);
        bytes32 digest = intentSettlement.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(solver);
        vm.expectRevert(IntentSettlement.NotActiveSolver.selector);
        intentSettlement.settleIntent(intent, sig, intent.minAmountOut, bytes("proof"));
    }

    // ── IntentSettlement: nonce mismatch ───────────────────────────────

    function test_IntentSettlement_NonceMismatch() public {
        _registerSolver();

        uint256 userPk = 0xA11CE;
        address userAddr = vm.addr(userPk);
        // Use nonce 5 when expected is 0
        IntentSettlement.SwapIntent memory intent = _makeIntentFor(userAddr, 5);
        bytes32 digest = intentSettlement.hashIntent(intent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(userPk, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(solver);
        vm.expectRevert(IntentSettlement.NonceMismatch.selector);
        intentSettlement.settleIntent(intent, sig, intent.minAmountOut, bytes("proof"));
    }

    // ── Helpers ────────────────────────────────────────────────────────

    function _registerSolver() internal {
        vm.startPrank(solver);
        zdx.approve(address(solverRegistry), MIN_STAKE);
        solverRegistry.register(MIN_STAKE);
        vm.stopPrank();
    }

    function _makeIntent(uint256 nonce)
        internal
        view
        returns (IntentSettlement.SwapIntent memory)
    {
        return _makeIntentFor(user, nonce);
    }

    function _makeIntentFor(address userAddr, uint256 nonce)
        internal
        view
        returns (IntentSettlement.SwapIntent memory)
    {
        return IntentSettlement.SwapIntent({
            user: userAddr,
            nonce: nonce,
            fromChain: "base",
            toChain: "ethereum",
            fromToken: 0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6, // wZION
            toToken: 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2, // USDT
            amountIn: 1_000 * 1e18,
            minAmountOut: 990 * 1e6,
            deadline: block.timestamp + 3600
        });
    }
}
