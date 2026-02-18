import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ZIONBridge (Multisig Validator Controller)", function () {
  // ── Deployment fixture ───────────────────────────────
  async function deployFixture() {
    const [admin, guardian, v1, v2, v3, v4, v5, user1, user2] = await ethers.getSigners();

    // Deploy wZION
    const WZION = await ethers.getContractFactory("WZION");
    const wzion = await WZION.deploy(admin.address, admin.address, guardian.address);
    await wzion.waitForDeployment();

    // Deploy ZIONBridge (3-of-5 multisig)
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

    // Grant BRIDGE_ROLE to ZIONBridge contract on wZION
    const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
    await wzion.connect(admin).grantRole(BRIDGE_ROLE, await bridge.getAddress());
    // Revoke temp bridge role from admin
    await wzion.connect(admin).revokeRole(BRIDGE_ROLE, admin.address);

    return { wzion, bridge, admin, guardian, v1, v2, v3, v4, v5, user1, user2, threshold };
  }

  // ── Deployment ───────────────────────────────────────
  describe("Deployment", function () {
    it("should set threshold and validator count", async function () {
      const { bridge } = await loadFixture(deployFixture);
      expect(await bridge.threshold()).to.equal(3);
      expect(await bridge.validatorCount()).to.equal(5);
    });

    it("should assign VALIDATOR_ROLE to all validators", async function () {
      const { bridge, v1, v2, v3, v4, v5 } = await loadFixture(deployFixture);
      const VALIDATOR_ROLE = await bridge.VALIDATOR_ROLE();
      for (const v of [v1, v2, v3, v4, v5]) {
        expect(await bridge.hasRole(VALIDATOR_ROLE, v.address)).to.be.true;
      }
    });

    it("should revert with threshold > validators", async function () {
      const [admin, guardian, v1, v2] = await ethers.getSigners();
      const WZION = await ethers.getContractFactory("WZION");
      const wzion = await WZION.deploy(admin.address, admin.address, guardian.address);

      const ZIONBridge = await ethers.getContractFactory("ZIONBridge");
      await expect(
        ZIONBridge.deploy(admin.address, guardian.address, await wzion.getAddress(), [v1.address, v2.address], 5)
      ).to.be.reverted;
    });

    it("should revert with threshold < 2", async function () {
      const [admin, guardian, v1, v2, v3] = await ethers.getSigners();
      const WZION = await ethers.getContractFactory("WZION");
      const wzion = await WZION.deploy(admin.address, admin.address, guardian.address);

      const ZIONBridge = await ethers.getContractFactory("ZIONBridge");
      await expect(
        ZIONBridge.deploy(admin.address, guardian.address, await wzion.getAddress(), [v1.address, v2.address, v3.address], 1)
      ).to.be.reverted;
    });

    it("should set correct constants", async function () {
      const { bridge } = await loadFixture(deployFixture);
      expect(await bridge.TIMELOCK_THRESHOLD()).to.equal(ethers.parseEther("1000000"));
      expect(await bridge.TIMELOCK_DELAY()).to.equal(24 * 60 * 60); // 24h
      expect(await bridge.DAILY_LIMIT()).to.equal(ethers.parseEther("10000000"));
      expect(await bridge.L1_FINALITY_BLOCKS()).to.equal(60);
    });
  });

  // ── L1 → EVM (submitLockProof) ──────────────────────
  describe("submitLockProof (L1→EVM mint)", function () {
    const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("l1_lock_tx_001"));
    const amount = ethers.parseEther("5000"); // 5000 wZION
    const l1BlockHeight = 1000n;
    const l1Sender = "zion1qsender123456789012345678901234567890";

    it("should accept first validator proof", async function () {
      const { bridge, v1, user1 } = await loadFixture(deployFixture);

      await expect(bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender))
        .to.emit(bridge, "LockProofSubmitted")
        .withArgs(l1TxHash, v1.address, 1, 3);
    });

    it("should auto-mint on threshold (3/3)", async function () {
      const { bridge, wzion, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);

      // 3rd confirmation should trigger auto-mint
      await expect(bridge.connect(v3).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender))
        .to.emit(bridge, "LockExecuted")
        .withArgs(l1TxHash, user1.address, amount);

      // wZION should be minted
      expect(await wzion.balanceOf(user1.address)).to.equal(amount);
    });

    it("should reject duplicate confirmation from same validator", async function () {
      const { bridge, v1, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);
      await expect(
        bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender)
      ).to.be.revertedWithCustomError(bridge, "AlreadyConfirmed");
    });

    it("should reject non-validator", async function () {
      const { bridge, user1 } = await loadFixture(deployFixture);
      await expect(
        bridge.connect(user1).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender)
      ).to.be.reverted;
    });

    it("should reject re-execution of already executed lock", async function () {
      const { bridge, v1, v2, v3, v4, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);
      await bridge.connect(v3).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);
      // Already executed with 3 confirmations

      await expect(
        bridge.connect(v4).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender)
      ).to.be.revertedWithCustomError(bridge, "AlreadyExecuted");
    });

    it("should return correct lock proof status", async function () {
      const { bridge, v1, v2, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, amount, l1BlockHeight, l1Sender);

      const [confirmations, executed, timelocked, , recipient, proofAmount] =
        await bridge.getLockProofStatus(l1TxHash);

      expect(confirmations).to.equal(2);
      expect(executed).to.be.false;
      expect(timelocked).to.be.false;
      expect(recipient).to.equal(user1.address);
      expect(proofAmount).to.equal(amount);
    });
  });

  // ── Timelock (large amounts) ─────────────────────────
  describe("Timelock (>1M wZION)", function () {
    const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("l1_lock_timelock"));
    const largeAmount = ethers.parseEther("2000000"); // 2M wZION
    const l1BlockHeight = 2000n;
    const l1Sender = "zion1qsenderlarge12345678901234567890123456";

    it("should timelock large mint (>1M)", async function () {
      const { bridge, v1, user1 } = await loadFixture(deployFixture);

      await expect(
        bridge.connect(v1).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender)
      ).to.emit(bridge, "LockTimelocked");

      const [, , timelocked, timelockExpiry, ,] = await bridge.getLockProofStatus(l1TxHash);
      expect(timelocked).to.be.true;
      expect(timelockExpiry).to.be.greaterThan(0);
    });

    it("should NOT auto-mint on threshold if timelocked", async function () {
      const { bridge, wzion, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);
      await bridge.connect(v3).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);

      // Still NOT minted because of timelock
      expect(await wzion.balanceOf(user1.address)).to.equal(0);
    });

    it("should revert executeTimelockedMint before delay", async function () {
      const { bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);
      await bridge.connect(v3).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);

      await expect(bridge.executeTimelockedMint(l1TxHash))
        .to.be.revertedWithCustomError(bridge, "TimelockNotExpired");
    });

    it("should allow executeTimelockedMint after 24h delay", async function () {
      const { bridge, wzion, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);
      await bridge.connect(v3).submitLockProof(l1TxHash, user1.address, largeAmount, l1BlockHeight, l1Sender);

      // Fast forward 24 hours + 1 second
      await time.increase(24 * 60 * 60 + 1);

      await expect(bridge.executeTimelockedMint(l1TxHash))
        .to.emit(bridge, "LockExecuted")
        .withArgs(l1TxHash, user1.address, largeAmount);

      expect(await wzion.balanceOf(user1.address)).to.equal(largeAmount);
    });
  });

  // ── EVM → L1 (confirmBurnRelease) ───────────────────
  describe("confirmBurnRelease (EVM→L1 unlock)", function () {
    const burnId = ethers.keccak256(ethers.toUtf8Bytes("burn_001"));
    const amount = ethers.parseEther("1000");
    const l1Recipient = "zion1qrecipientaddress1234567890abcdef12345";

    it("should accept burn confirmation from validator", async function () {
      const { bridge, v1, user1 } = await loadFixture(deployFixture);

      await expect(bridge.connect(v1).confirmBurnRelease(burnId, user1.address, amount, l1Recipient))
        .to.emit(bridge, "BurnConfirmationSubmitted")
        .withArgs(burnId, v1.address, 1, 3);
    });

    it("should emit BurnReleaseConfirmed on threshold", async function () {
      const { bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);
      await bridge.connect(v2).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);

      await expect(bridge.connect(v3).confirmBurnRelease(burnId, user1.address, amount, l1Recipient))
        .to.emit(bridge, "BurnReleaseConfirmed")
        .withArgs(burnId, l1Recipient, amount);
    });

    it("should reject duplicate burn confirmation", async function () {
      const { bridge, v1, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);
      await expect(
        bridge.connect(v1).confirmBurnRelease(burnId, user1.address, amount, l1Recipient)
      ).to.be.revertedWithCustomError(bridge, "AlreadyConfirmed");
    });

    it("should reject already released burn", async function () {
      const { bridge, v1, v2, v3, v4, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);
      await bridge.connect(v2).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);
      await bridge.connect(v3).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);

      await expect(
        bridge.connect(v4).confirmBurnRelease(burnId, user1.address, amount, l1Recipient)
      ).to.be.revertedWithCustomError(bridge, "AlreadyExecuted");
    });

    it("should return correct burn release status", async function () {
      const { bridge, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      await bridge.connect(v1).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);
      await bridge.connect(v2).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);
      await bridge.connect(v3).confirmBurnRelease(burnId, user1.address, amount, l1Recipient);

      const [confirmations, released, evmBurner, relAmount, l1Addr] =
        await bridge.getBurnReleaseStatus(burnId);

      expect(confirmations).to.equal(3);
      expect(released).to.be.true;
      expect(evmBurner).to.equal(user1.address);
      expect(relAmount).to.equal(amount);
      expect(l1Addr).to.equal(l1Recipient);
    });
  });

  // ── Daily Limits ─────────────────────────────────────
  describe("Daily limits", function () {
    it("should report daily remaining correctly", async function () {
      const { bridge } = await loadFixture(deployFixture);
      const [mintRemaining, burnRemaining] = await bridge.dailyRemaining();
      expect(mintRemaining).to.equal(ethers.parseEther("10000000"));
      expect(burnRemaining).to.equal(ethers.parseEther("10000000"));
    });

    it("should enforce daily limit on minting", async function () {
      const { bridge, v1, v2, v3, user1, user2 } = await loadFixture(deployFixture);

      // Mint 11 batches of 900K each (all under 1M timelock threshold)
      // Total: 11 × 900K = 9.9M (under 10M daily limit)
      for (let i = 0; i < 11; i++) {
        const hash = ethers.keccak256(ethers.toUtf8Bytes(`daily_batch_${i}`));
        const amt = ethers.parseEther("900000"); // 900K wZION (under timelock)
        const recipient = i % 2 === 0 ? user1.address : user2.address;
        await bridge.connect(v1).submitLockProof(hash, recipient, amt, BigInt(100 + i), "zion1qsender");
        await bridge.connect(v2).submitLockProof(hash, recipient, amt, BigInt(100 + i), "zion1qsender");
        await bridge.connect(v3).submitLockProof(hash, recipient, amt, BigInt(100 + i), "zion1qsender");
      }

      // Now dailyMinted = 9.9M. Try 200K more → 9.9M + 200K = 10.1M > 10M limit
      const overflowHash = ethers.keccak256(ethers.toUtf8Bytes("daily_overflow"));
      const overflowAmt = ethers.parseEther("200000"); // 200K
      await bridge.connect(v1).submitLockProof(overflowHash, user1.address, overflowAmt, 999n, "zion1qsender");
      await bridge.connect(v2).submitLockProof(overflowHash, user1.address, overflowAmt, 999n, "zion1qsender");

      // 3rd confirmation triggers _executeMint → should revert due to daily limit
      await expect(
        bridge.connect(v3).submitLockProof(overflowHash, user1.address, overflowAmt, 999n, "zion1qsender")
      ).to.be.revertedWithCustomError(bridge, "DailyLimitExceeded");
    });
  });

  // ── Admin Functions ──────────────────────────────────
  describe("Admin functions", function () {
    it("should update threshold", async function () {
      const { bridge, admin } = await loadFixture(deployFixture);

      await expect(bridge.connect(admin).updateThreshold(4))
        .to.emit(bridge, "ThresholdUpdated")
        .withArgs(3, 4);

      expect(await bridge.threshold()).to.equal(4);
    });

    it("should revert threshold below 2", async function () {
      const { bridge, admin } = await loadFixture(deployFixture);
      await expect(bridge.connect(admin).updateThreshold(1))
        .to.be.revertedWithCustomError(bridge, "InvalidThreshold");
    });

    it("should revert threshold above validator count", async function () {
      const { bridge, admin } = await loadFixture(deployFixture);
      await expect(bridge.connect(admin).updateThreshold(6))
        .to.be.revertedWithCustomError(bridge, "InvalidThreshold");
    });

    it("should add a new validator", async function () {
      const { bridge, admin, user1 } = await loadFixture(deployFixture);

      await expect(bridge.connect(admin).addValidator(user1.address))
        .to.emit(bridge, "ValidatorAdded")
        .withArgs(user1.address);

      expect(await bridge.validatorCount()).to.equal(6);
    });

    it("should remove a validator (if threshold allows)", async function () {
      const { bridge, admin, v5 } = await loadFixture(deployFixture);

      await expect(bridge.connect(admin).removeValidator(v5.address))
        .to.emit(bridge, "ValidatorRemoved")
        .withArgs(v5.address);

      expect(await bridge.validatorCount()).to.equal(4);
    });

    it("should revert removing validator if it would break threshold", async function () {
      const { bridge, admin, v3, v4, v5 } = await loadFixture(deployFixture);

      // Remove down to 3 validators (threshold=3), then removing one more should fail
      await bridge.connect(admin).removeValidator(v5.address); // 4
      await bridge.connect(admin).removeValidator(v4.address); // 3

      await expect(bridge.connect(admin).removeValidator(v3.address)).to.be.reverted;
    });

    it("should reject admin ops from non-admin", async function () {
      const { bridge, user1 } = await loadFixture(deployFixture);
      await expect(bridge.connect(user1).updateThreshold(4)).to.be.reverted;
      await expect(bridge.connect(user1).addValidator(user1.address)).to.be.reverted;
    });
  });

  // ── Pause ────────────────────────────────────────────
  describe("Pause/Unpause", function () {
    it("should pause from guardian", async function () {
      const { bridge, guardian } = await loadFixture(deployFixture);
      await bridge.connect(guardian).pause();
      expect(await bridge.paused()).to.be.true;
    });

    it("should block submitLockProof when paused", async function () {
      const { bridge, guardian, v1, user1 } = await loadFixture(deployFixture);
      await bridge.connect(guardian).pause();

      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("paused_lock"));
      await expect(
        bridge.connect(v1).submitLockProof(l1TxHash, user1.address, ethers.parseEther("1000"), 100n, "zion1q")
      ).to.be.reverted;
    });

    it("should block confirmBurnRelease when paused", async function () {
      const { bridge, guardian, v1, user1 } = await loadFixture(deployFixture);
      await bridge.connect(guardian).pause();

      const burnId = ethers.keccak256(ethers.toUtf8Bytes("paused_burn"));
      await expect(
        bridge.connect(v1).confirmBurnRelease(burnId, user1.address, ethers.parseEther("500"), "zion1qrec")
      ).to.be.reverted;
    });
  });

  // ── Full E2E Flow ────────────────────────────────────
  describe("End-to-end flow", function () {
    it("L1→EVM: lock → 3/5 validators → auto-mint → user has wZION", async function () {
      const { bridge, wzion, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("e2e_lock"));
      const amount = ethers.parseEther("10000"); // 10K wZION

      // 3 validators submit proof
      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, 5000n, "zion1qe2esender");
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, amount, 5000n, "zion1qe2esender");
      await bridge.connect(v3).submitLockProof(l1TxHash, user1.address, amount, 5000n, "zion1qe2esender");

      // User now has wZION
      expect(await wzion.balanceOf(user1.address)).to.equal(amount);

      // Bridge stats updated
      expect(await bridge.totalLocksProcessed()).to.equal(1);
    });

    it("EVM→L1: burn wZION → 3/5 validators confirm → released", async function () {
      const { bridge, wzion, v1, v2, v3, user1 } = await loadFixture(deployFixture);

      // First mint some wZION
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("e2e_lock_for_burn"));
      const amount = ethers.parseEther("5000");
      await bridge.connect(v1).submitLockProof(l1TxHash, user1.address, amount, 6000n, "zion1qsender");
      await bridge.connect(v2).submitLockProof(l1TxHash, user1.address, amount, 6000n, "zion1qsender");
      await bridge.connect(v3).submitLockProof(l1TxHash, user1.address, amount, 6000n, "zion1qsender");

      // User burns wZION
      const burnId = ethers.keccak256(ethers.toUtf8Bytes("e2e_burn"));
      const burnAmount = ethers.parseEther("2000");
      const l1Recipient = "zion1qe2erecipient12345678901234567890123";

      await wzion.connect(user1).bridgeBurn(burnAmount, l1Recipient, burnId);
      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("3000"));

      // Validators confirm burn release (after submitting L1 unlock TX)
      await bridge.connect(v1).confirmBurnRelease(burnId, user1.address, burnAmount, l1Recipient);
      await bridge.connect(v2).confirmBurnRelease(burnId, user1.address, burnAmount, l1Recipient);
      await bridge.connect(v3).confirmBurnRelease(burnId, user1.address, burnAmount, l1Recipient);

      // Verify release
      const [confirmations, released, , , ] = await bridge.getBurnReleaseStatus(burnId);
      expect(confirmations).to.equal(3);
      expect(released).to.be.true;
      expect(await bridge.totalBurnsProcessed()).to.equal(1);
    });
  });
});
