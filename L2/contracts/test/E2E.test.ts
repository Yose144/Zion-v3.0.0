import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

/**
 * 🌉 End-to-End Bridge Test
 *
 * Tests the FULL bridge lifecycle on a local Hardhat fork:
 *
 *   Flow A: L1 → EVM (Lock → Mint)
 *     1. Simulate L1 lock (memo: BRIDGE:base:0xRecipient)
 *     2. Validators submit lock proofs → threshold reached
 *     3. wZION auto-minted to recipient
 *
 *   Flow B: EVM → L1 (Burn → Unlock)
 *     4. User burns wZION with L1 address
 *     5. Validators confirm burn release → threshold reached
 *     6. L1 unlock triggered (simulated)
 *
 *   Flow C: Timelock for large amounts (> 1M wZION)
 *     7. Large lock proof → timelocked
 *     8. Wait 24h → execute
 *
 *   Flow D: Round-trip integrity
 *     9. Lock 1000 ZION → mint 1000 wZION → burn 1000 wZION → unlock
 *     10. Verify supply invariant: locked_L1 ≥ total_wZION_supply
 */
describe("🌉 E2E: Full Bridge Lifecycle", function () {

  async function deployFixture() {
    const [admin, guardian, v1, v2, v3, v4, v5, user1, user2] = await ethers.getSigners();

    // Deploy wZION with admin as temp bridge
    const WZION = await ethers.getContractFactory("WZION");
    const wzion = await WZION.deploy(admin.address, admin.address, guardian.address);
    await wzion.waitForDeployment();

    // Deploy ZIONBridge (3-of-5)
    const validators = [v1.address, v2.address, v3.address, v4.address, v5.address];
    const threshold = 3;
    const ZIONBridge = await ethers.getContractFactory("ZIONBridge");
    const bridge = await ZIONBridge.deploy(
      admin.address,
      guardian.address,
      await wzion.getAddress(),
      validators,
      threshold
    );
    await bridge.waitForDeployment();

    // Grant BRIDGE_ROLE to ZIONBridge, revoke from admin
    const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
    await wzion.connect(admin).grantRole(BRIDGE_ROLE, await bridge.getAddress());
    await wzion.connect(admin).revokeRole(BRIDGE_ROLE, admin.address);

    return { wzion, bridge, admin, guardian, v1, v2, v3, v4, v5, user1, user2, threshold };
  }

  // ═══════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════

  /** Convert ZION L1 atomic (6 dec) → wZION (18 dec) */
  function l1ToEvm(l1Amount: bigint): bigint {
    return l1Amount * 10n ** 12n;
  }

  /** Convert wZION (18 dec) → ZION L1 atomic (6 dec) */
  function evmToL1(evmAmount: bigint): bigint {
    return evmAmount / 10n ** 12n;
  }

  /** Generate a unique L1 TX hash */
  function l1TxHash(label: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(`l1tx:${label}:${Date.now()}`));
  }

  /** Generate a unique burn ID */
  function burnId(label: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(`burn:${label}:${Date.now()}`));
  }

  /** Valid L1 address (40-62 chars, starts with zion1) */
  const L1_USER1 = "zion1q2w3e4r5t6y7u8i9o0pmnbvcxzasdfgh12345";     // 46 chars
  const L1_USER2 = "zion1recipient0000000000000000000000000addr2";     // 46 chars
  const L1_SENDER = "zion1sender00000000000000000000000000000abc1";    // 46 chars
  const L1_WHALE  = "zion1whale000000000000000000000000000000whal";    // 46 chars
  const L1_BIG2   = "zion1big20000000000000000000000000000000big2";    // 46 chars
  const L1_BIG3   = "zion1big30000000000000000000000000000000big3";    // 46 chars
  const L1_A      = "zion1aaaa0000000000000000000000000000000aaaa";    // 46 chars
  const L1_B      = "zion1bbbb0000000000000000000000000000000bbbb";    // 46 chars

  // ═══════════════════════════════════════════════════════════════
  // FLOW A: L1 → EVM (Lock → Mint)
  // ═══════════════════════════════════════════════════════════════

  describe("Flow A: L1 → EVM (Lock → Mint)", function () {

    it("should mint wZION after 3-of-5 validators confirm lock", async function () {
      const { wzion, bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      const txHash = l1TxHash("lock_1000");
      const amount = ethers.parseEther("1000"); // 1000 wZION (18 dec)
      const l1Block = 10000n;

      // Validator 1 submits
      await expect(
        bridge.connect(v1).submitLockProof(txHash, user1.address, amount, l1Block, L1_SENDER)
      ).to.emit(bridge, "LockProofSubmitted")
        .withArgs(txHash, v1.address, 1, 3);

      // No mint yet (1/3)
      expect(await wzion.balanceOf(user1.address)).to.equal(0);

      // Validator 2 submits
      await bridge.connect(v2).submitLockProof(txHash, user1.address, amount, l1Block, L1_SENDER);

      // Still no mint (2/3)
      expect(await wzion.balanceOf(user1.address)).to.equal(0);

      // Validator 3 → threshold reached → auto-mint!
      await expect(
        bridge.connect(v3).submitLockProof(txHash, user1.address, amount, l1Block, L1_SENDER)
      ).to.emit(bridge, "LockExecuted")
        .withArgs(txHash, user1.address, amount);

      // ✅ User1 now has 1000 wZION
      expect(await wzion.balanceOf(user1.address)).to.equal(amount);

      // Bridge stats updated
      const stats = await wzion.bridgeStats();
      expect(stats.minted).to.equal(amount);
      expect(stats.outstanding).to.equal(amount);
    });

    it("should reject duplicate validator confirmation", async function () {
      const { bridge, v1, user1 } = await loadFixture(deployFixture);

      const txHash = l1TxHash("dup_test");
      const amount = ethers.parseEther("500");

      await bridge.connect(v1).submitLockProof(txHash, user1.address, amount, 10000n, L1_SENDER);

      await expect(
        bridge.connect(v1).submitLockProof(txHash, user1.address, amount, 10000n, L1_SENDER)
      ).to.be.revertedWithCustomError(bridge, "AlreadyConfirmed");
    });

    it("should reject already-executed lock proof", async function () {
      const { bridge, v1, v2, v3, v4, user1 } = await loadFixture(deployFixture);

      const txHash = l1TxHash("already_exec");
      const amount = ethers.parseEther("100");

      // Execute (3/3)
      await bridge.connect(v1).submitLockProof(txHash, user1.address, amount, 10000n, L1_SENDER);
      await bridge.connect(v2).submitLockProof(txHash, user1.address, amount, 10000n, L1_SENDER);
      await bridge.connect(v3).submitLockProof(txHash, user1.address, amount, 10000n, L1_SENDER);

      // V4 tries → already executed
      await expect(
        bridge.connect(v4).submitLockProof(txHash, user1.address, amount, 10000n, L1_SENDER)
      ).to.be.revertedWithCustomError(bridge, "AlreadyExecuted");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FLOW B: EVM → L1 (Burn → Unlock)
  // ═══════════════════════════════════════════════════════════════

  describe("Flow B: EVM → L1 (Burn → Unlock)", function () {

    it("should burn wZION and confirm release after validator threshold", async function () {
      const { wzion, bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      // First: mint some wZION via lock (so user has tokens to burn)
      const lockHash = l1TxHash("pre_burn_lock");
      const amount = ethers.parseEther("500");

      await bridge.connect(v1).submitLockProof(lockHash, user1.address, amount, 10000n, L1_SENDER);
      await bridge.connect(v2).submitLockProof(lockHash, user1.address, amount, 10000n, L1_SENDER);
      await bridge.connect(v3).submitLockProof(lockHash, user1.address, amount, 10000n, L1_SENDER);

      expect(await wzion.balanceOf(user1.address)).to.equal(amount);

      // User burns wZION → wants ZION on L1
      const bId = burnId("burn_500");
      await expect(
        wzion.connect(user1).bridgeBurn(amount, L1_USER2, bId)
      ).to.emit(wzion, "BridgeBurn");

      // User's wZION balance is now 0
      expect(await wzion.balanceOf(user1.address)).to.equal(0);

      // Validators confirm burn release
      await bridge.connect(v1).confirmBurnRelease(bId, user1.address, amount, L1_USER2);
      await bridge.connect(v2).confirmBurnRelease(bId, user1.address, amount, L1_USER2);
      await expect(
        bridge.connect(v3).confirmBurnRelease(bId, user1.address, amount, L1_USER2)
      ).to.emit(bridge, "BurnReleaseConfirmed")
        .withArgs(bId, L1_USER2, amount);

      // Bridge stats: burned matches minted → outstanding = 0
      const stats = await wzion.bridgeStats();
      expect(stats.minted).to.equal(amount);
      expect(stats.burned).to.equal(amount);
      expect(stats.outstanding).to.equal(0n);
    });

    it("should reject burn below minimum", async function () {
      const { wzion, bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      // Mint some wZION for user
      const lockHash = l1TxHash("min_burn_test");
      const mintAmount = ethers.parseEther("200");
      await bridge.connect(v1).submitLockProof(lockHash, user1.address, mintAmount, 10000n, L1_SENDER);
      await bridge.connect(v2).submitLockProof(lockHash, user1.address, mintAmount, 10000n, L1_SENDER);
      await bridge.connect(v3).submitLockProof(lockHash, user1.address, mintAmount, 10000n, L1_SENDER);

      // Try to burn 10 wZION (< 100 minimum)
      const bId = burnId("too_small");
      await expect(
        wzion.connect(user1).bridgeBurn(ethers.parseEther("10"), L1_USER1, bId)
      ).to.be.revertedWithCustomError(wzion, "BelowMinBridgeAmount");
    });

    it("should reject burn with invalid L1 address", async function () {
      const { wzion, bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      // Mint some wZION
      const lockHash = l1TxHash("invalid_addr_test");
      const amount = ethers.parseEther("200");
      await bridge.connect(v1).submitLockProof(lockHash, user1.address, amount, 10000n, L1_SENDER);
      await bridge.connect(v2).submitLockProof(lockHash, user1.address, amount, 10000n, L1_SENDER);
      await bridge.connect(v3).submitLockProof(lockHash, user1.address, amount, 10000n, L1_SENDER);

      // Burn with invalid L1 address (no zion1 prefix)
      const bId = burnId("bad_addr");
      await expect(
        wzion.connect(user1).bridgeBurn(amount, "0xNotAnL1Address", bId)
      ).to.be.revertedWithCustomError(wzion, "InvalidL1Address");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FLOW C: Timelock for Large Amounts
  // ═══════════════════════════════════════════════════════════════

  describe("Flow C: Timelock (> 1M wZION)", function () {

    it("should timelock large amounts and execute after 24h", async function () {
      const { wzion, bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      const txHash = l1TxHash("large_lock");
      const amount = ethers.parseEther("2000000"); // 2M wZION (> 1M threshold)

      // First validator → timelocked event emits immediately (amount > 1M)
      await expect(
        bridge.connect(v1).submitLockProof(txHash, user1.address, amount, 10000n, L1_WHALE)
      ).to.emit(bridge, "LockTimelocked");

      await bridge.connect(v2).submitLockProof(txHash, user1.address, amount, 10000n, L1_WHALE);
      // Third validator → threshold reached, but mint skipped (timelocked)
      await bridge.connect(v3).submitLockProof(txHash, user1.address, amount, 10000n, L1_WHALE);

      // User has NO wZION yet (timelocked)
      expect(await wzion.balanceOf(user1.address)).to.equal(0);

      // Try to execute before timelock expires → fail
      await expect(
        bridge.executeTimelockedMint(txHash)
      ).to.be.revertedWithCustomError(bridge, "TimelockNotExpired");

      // Fast-forward 24 hours
      await time.increase(24 * 60 * 60 + 1);

      // Now execute → mint!
      await expect(
        bridge.executeTimelockedMint(txHash)
      ).to.emit(bridge, "LockExecuted")
        .withArgs(txHash, user1.address, amount);

      expect(await wzion.balanceOf(user1.address)).to.equal(amount);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FLOW D: Full Round-Trip Integrity
  // ═══════════════════════════════════════════════════════════════

  describe("Flow D: Full Round-Trip (Lock → Mint → Burn → Release)", function () {

    it("should maintain supply invariant through complete cycle", async function () {
      const { wzion, bridge, v1, v2, v3, user1, user2 } = await loadFixture(deployFixture);

      // ── Phase 1: Lock 1000 ZION on L1 → Mint 1000 wZION ──────
      const lockHash1 = l1TxHash("roundtrip_lock");
      const amount = ethers.parseEther("1000");

      await bridge.connect(v1).submitLockProof(lockHash1, user1.address, amount, 10000n, L1_USER1);
      await bridge.connect(v2).submitLockProof(lockHash1, user1.address, amount, 10000n, L1_USER1);
      await bridge.connect(v3).submitLockProof(lockHash1, user1.address, amount, 10000n, L1_USER1);

      let stats = await wzion.bridgeStats();
      expect(stats.minted).to.equal(amount);
      expect(stats.outstanding).to.equal(amount);
      expect(await wzion.totalSupply()).to.equal(amount);

      // ── Phase 2: User1 transfers 300 wZION to User2 (ERC-20) ──
      await wzion.connect(user1).transfer(user2.address, ethers.parseEther("300"));
      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("700"));
      expect(await wzion.balanceOf(user2.address)).to.equal(ethers.parseEther("300"));

      // ── Phase 3: User1 burns 700 wZION → L1 unlock ────────────
      const bId1 = burnId("roundtrip_burn_1");
      await wzion.connect(user1).bridgeBurn(ethers.parseEther("700"), L1_USER1, bId1);

      stats = await wzion.bridgeStats();
      expect(stats.burned).to.equal(ethers.parseEther("700"));
      expect(stats.outstanding).to.equal(ethers.parseEther("300")); // 300 still held by user2

      // ── Phase 4: User2 burns 300 wZION → L1 unlock ────────────
      const bId2 = burnId("roundtrip_burn_2");
      await wzion.connect(user2).bridgeBurn(ethers.parseEther("300"), L1_USER2, bId2);

      stats = await wzion.bridgeStats();
      expect(stats.minted).to.equal(amount); // 1000 total minted
      expect(stats.burned).to.equal(amount); // 1000 total burned
      expect(stats.outstanding).to.equal(0n); // perfectly balanced

      // ── Supply invariant: totalSupply == 0 ──────────────────────
      expect(await wzion.totalSupply()).to.equal(0n);
    });

    it("should handle multiple independent lock-burn cycles", async function () {
      const { wzion, bridge, v1, v2, v3, user1, user2 } = await loadFixture(deployFixture);

      // Cycle 1: 500 wZION for user1
      const lock1 = l1TxHash("cycle1_lock");
      await bridge.connect(v1).submitLockProof(lock1, user1.address, ethers.parseEther("500"), 10000n, L1_A);
      await bridge.connect(v2).submitLockProof(lock1, user1.address, ethers.parseEther("500"), 10000n, L1_A);
      await bridge.connect(v3).submitLockProof(lock1, user1.address, ethers.parseEther("500"), 10000n, L1_A);

      // Cycle 2: 200 wZION for user2
      const lock2 = l1TxHash("cycle2_lock");
      await bridge.connect(v1).submitLockProof(lock2, user2.address, ethers.parseEther("200"), 10100n, L1_B);
      await bridge.connect(v2).submitLockProof(lock2, user2.address, ethers.parseEther("200"), 10100n, L1_B);
      await bridge.connect(v3).submitLockProof(lock2, user2.address, ethers.parseEther("200"), 10100n, L1_B);

      expect(await wzion.totalSupply()).to.equal(ethers.parseEther("700"));
      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("500"));
      expect(await wzion.balanceOf(user2.address)).to.equal(ethers.parseEther("200"));

      // Burn all independently
      await wzion.connect(user1).bridgeBurn(ethers.parseEther("500"), L1_A, burnId("c1burn"));
      await wzion.connect(user2).bridgeBurn(ethers.parseEther("200"), L1_B, burnId("c2burn"));

      expect(await wzion.totalSupply()).to.equal(0n);

      const stats = await wzion.bridgeStats();
      expect(stats.outstanding).to.equal(0n);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // FLOW E: Emergency & Security
  // ═══════════════════════════════════════════════════════════════

  describe("Flow E: Emergency Pause & Recovery", function () {

    it("should block all operations when paused", async function () {
      const { wzion, bridge, guardian, v1, user1 } = await loadFixture(deployFixture);

      // Guardian pauses the BRIDGE contract
      await bridge.connect(guardian).pause();

      // Minting blocked (bridge is paused)
      const txHash = l1TxHash("paused_lock");
      await expect(
        bridge.connect(v1).submitLockProof(txHash, user1.address, ethers.parseEther("100"), 10000n, L1_SENDER)
      ).to.be.reverted;

      // Unpause
      await bridge.connect(guardian).unpause();

      // Now it works again
      await expect(
        bridge.connect(v1).submitLockProof(txHash, user1.address, ethers.parseEther("100"), 10000n, L1_SENDER)
      ).to.emit(bridge, "LockProofSubmitted");
    });

    it("should enforce daily limit", async function () {
      const { wzion, bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      // Mint 10 batches of 990K (each under 1M timelock threshold)
      // Total: 9.9M (under 10M daily limit)
      for (let i = 0; i < 10; i++) {
        const lock = l1TxHash(`daily_batch_${i}`);
        const amt = ethers.parseEther("990000"); // 990K < 1M timelock
        await bridge.connect(v1).submitLockProof(lock, user1.address, amt, BigInt(10000 + i * 10), L1_BIG2);
        await bridge.connect(v2).submitLockProof(lock, user1.address, amt, BigInt(10000 + i * 10), L1_BIG2);
        await bridge.connect(v3).submitLockProof(lock, user1.address, amt, BigInt(10000 + i * 10), L1_BIG2);
      }

      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("9900000"));

      // Try another 200K (would exceed 10M limit)
      const lock2 = l1TxHash("daily_exceed");
      const amt2 = ethers.parseEther("200000");
      await bridge.connect(v1).submitLockProof(lock2, user1.address, amt2, 10200n, L1_BIG2);
      await bridge.connect(v2).submitLockProof(lock2, user1.address, amt2, 10200n, L1_BIG2);
      await expect(
        bridge.connect(v3).submitLockProof(lock2, user1.address, amt2, 10200n, L1_BIG2)
      ).to.be.revertedWithCustomError(bridge, "DailyLimitExceeded");

      // Wait 1 day → limit resets
      await time.increase(24 * 60 * 60 + 1);

      // Now it works
      const lock3 = l1TxHash("daily_new_day");
      await bridge.connect(v1).submitLockProof(lock3, user1.address, amt2, 10300n, L1_BIG3);
      await bridge.connect(v2).submitLockProof(lock3, user1.address, amt2, 10300n, L1_BIG3);
      await bridge.connect(v3).submitLockProof(lock3, user1.address, amt2, 10300n, L1_BIG3);

      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("9900000") + amt2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // DECIMAL CONVERSION INVARIANT
  // ═══════════════════════════════════════════════════════════════

  describe("Decimal Conversion Invariant", function () {

    it("L1 6-decimal → EVM 18-decimal → L1 6-decimal is lossless", function () {
      // 1 ZION = 1_000_000 L1 atomic
      const l1 = 1_000_000n;
      const evm = l1ToEvm(l1);
      expect(evm).to.equal(1_000_000_000_000_000_000n); // 1e18
      const back = evmToL1(evm);
      expect(back).to.equal(l1); // lossless round-trip
    });

    it("fractional amounts round correctly", function () {
      // 0.5 ZION = 500_000 L1 atomic
      const l1 = 500_000n;
      const evm = l1ToEvm(l1);
      expect(evm).to.equal(500_000_000_000_000_000n); // 0.5e18
      expect(evmToL1(evm)).to.equal(l1);
    });

    it("max supply converts correctly", function () {
      // 144B ZION = 144_000_000_000 * 1_000_000 L1 atomic
      const maxL1 = 144_000_000_000n * 1_000_000n;
      const maxEvm = l1ToEvm(maxL1);
      expect(maxEvm).to.equal(144_000_000_000n * 10n ** 18n);
      expect(evmToL1(maxEvm)).to.equal(maxL1);
    });
  });
});
