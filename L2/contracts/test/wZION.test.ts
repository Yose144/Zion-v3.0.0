import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("wZION (Wrapped ZION ERC-20)", function () {
  // ── Deployment fixture ───────────────────────────────
  async function deployFixture() {
    const [admin, bridge, guardian, user1, user2] = await ethers.getSigners();

    const WZION = await ethers.getContractFactory("WZION");
    const wzion = await WZION.deploy(admin.address, bridge.address, guardian.address);
    await wzion.waitForDeployment();

    const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
    const GUARDIAN_ROLE = await wzion.GUARDIAN_ROLE();

    return { wzion, admin, bridge, guardian, user1, user2, BRIDGE_ROLE, GUARDIAN_ROLE };
  }

  // ── Deployment ───────────────────────────────────────
  describe("Deployment", function () {
    it("should set name and symbol correctly", async function () {
      const { wzion } = await loadFixture(deployFixture);
      expect(await wzion.name()).to.equal("Wrapped ZION");
      expect(await wzion.symbol()).to.equal("wZION");
    });

    it("should have 18 decimals", async function () {
      const { wzion } = await loadFixture(deployFixture);
      expect(await wzion.decimals()).to.equal(18);
    });

    it("should set MAX_SUPPLY to 144B", async function () {
      const { wzion } = await loadFixture(deployFixture);
      expect(await wzion.MAX_SUPPLY()).to.equal(ethers.parseEther("144000000000"));
    });

    it("should set MIN_BRIDGE_AMOUNT to 100 wZION", async function () {
      const { wzion } = await loadFixture(deployFixture);
      expect(await wzion.MIN_BRIDGE_AMOUNT()).to.equal(ethers.parseEther("100"));
    });

    it("should assign roles correctly", async function () {
      const { wzion, admin, bridge, guardian, BRIDGE_ROLE, GUARDIAN_ROLE } = await loadFixture(deployFixture);
      const DEFAULT_ADMIN = await wzion.DEFAULT_ADMIN_ROLE();

      expect(await wzion.hasRole(DEFAULT_ADMIN, admin.address)).to.be.true;
      expect(await wzion.hasRole(BRIDGE_ROLE, bridge.address)).to.be.true;
      expect(await wzion.hasRole(GUARDIAN_ROLE, guardian.address)).to.be.true;
    });

    it("should start with zero supply", async function () {
      const { wzion } = await loadFixture(deployFixture);
      expect(await wzion.totalSupply()).to.equal(0);
      expect(await wzion.totalBridgeMinted()).to.equal(0);
      expect(await wzion.totalBridgeBurned()).to.equal(0);
    });

    it("should revert on zero addresses", async function () {
      const [admin, bridge, guardian] = await ethers.getSigners();
      const WZION = await ethers.getContractFactory("WZION");
      await expect(WZION.deploy(ethers.ZeroAddress, bridge.address, guardian.address))
        .to.be.revertedWithCustomError(WZION, "ZeroAddress");
      await expect(WZION.deploy(admin.address, ethers.ZeroAddress, guardian.address))
        .to.be.revertedWithCustomError(WZION, "ZeroAddress");
      await expect(WZION.deploy(admin.address, bridge.address, ethers.ZeroAddress))
        .to.be.revertedWithCustomError(WZION, "ZeroAddress");
    });
  });

  // ── Bridge Mint ──────────────────────────────────────
  describe("bridgeMint", function () {
    it("should mint wZION to recipient (BRIDGE_ROLE)", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000"); // 1000 wZION
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_001"));

      await expect(wzion.connect(bridge).bridgeMint(user1.address, amount, l1TxHash))
        .to.emit(wzion, "BridgeMint")
        .withArgs(user1.address, amount, l1TxHash, (v: any) => v > 0);

      expect(await wzion.balanceOf(user1.address)).to.equal(amount);
      expect(await wzion.totalSupply()).to.equal(amount);
      expect(await wzion.totalBridgeMinted()).to.equal(amount);
    });

    it("should revert when called by non-bridge", async function () {
      const { wzion, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_002"));

      await expect(wzion.connect(user1).bridgeMint(user1.address, amount, l1TxHash))
        .to.be.reverted;
    });

    it("should revert on zero amount", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_003"));

      await expect(wzion.connect(bridge).bridgeMint(user1.address, 0, l1TxHash))
        .to.be.revertedWithCustomError(wzion, "ZeroAmount");
    });

    it("should revert on zero recipient", async function () {
      const { wzion, bridge } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_004"));

      await expect(wzion.connect(bridge).bridgeMint(ethers.ZeroAddress, amount, l1TxHash))
        .to.be.revertedWithCustomError(wzion, "ZeroAddress");
    });

    it("should revert below MIN_BRIDGE_AMOUNT", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("50"); // 50 < 100 min
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_005"));

      await expect(wzion.connect(bridge).bridgeMint(user1.address, amount, l1TxHash))
        .to.be.revertedWithCustomError(wzion, "BelowMinBridgeAmount");
    });

    it("should prevent replay (same L1 TX hash)", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_replay"));

      await wzion.connect(bridge).bridgeMint(user1.address, amount, l1TxHash);
      await expect(wzion.connect(bridge).bridgeMint(user1.address, amount, l1TxHash))
        .to.be.revertedWithCustomError(wzion, "L1LockAlreadyProcessed");
    });

    it("should track processedL1Locks", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_track"));

      expect(await wzion.isL1LockProcessed(l1TxHash)).to.be.false;
      await wzion.connect(bridge).bridgeMint(user1.address, ethers.parseEther("500"), l1TxHash);
      expect(await wzion.isL1LockProcessed(l1TxHash)).to.be.true;
    });

    it("should report correct mintableSupply", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const maxSupply = await wzion.MAX_SUPPLY();
      expect(await wzion.mintableSupply()).to.equal(maxSupply);

      const amount = ethers.parseEther("1000");
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_tx_supply"));
      await wzion.connect(bridge).bridgeMint(user1.address, amount, l1TxHash);
      expect(await wzion.mintableSupply()).to.equal(maxSupply - amount);
    });
  });

  // ── Bridge Burn ──────────────────────────────────────
  describe("bridgeBurn", function () {
    it("should burn wZION and emit BridgeBurn", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");
      const l1TxHash = ethers.keccak256(ethers.toUtf8Bytes("lock_for_burn_01"));
      await wzion.connect(bridge).bridgeMint(user1.address, amount, l1TxHash);

      const burnId = ethers.keccak256(ethers.toUtf8Bytes("burn_001"));
      const l1Recipient = "zion1qrecipientaddress1234567890abcdef12345";

      await expect(wzion.connect(user1).bridgeBurn(amount, l1Recipient, burnId))
        .to.emit(wzion, "BridgeBurn")
        .withArgs(user1.address, amount, l1Recipient, burnId, (v: any) => v > 0);

      expect(await wzion.balanceOf(user1.address)).to.equal(0);
      expect(await wzion.totalBridgeBurned()).to.equal(amount);
    });

    it("should revert below MIN_BRIDGE_AMOUNT", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("1000"),
        ethers.keccak256(ethers.toUtf8Bytes("lock_for_burn_02"))
      );

      const burnId = ethers.keccak256(ethers.toUtf8Bytes("burn_small"));
      await expect(
        wzion.connect(user1).bridgeBurn(ethers.parseEther("50"), "zion1qrecipientaddress1234567890abcdef12345", burnId)
      ).to.be.revertedWithCustomError(wzion, "BelowMinBridgeAmount");
    });

    it("should revert on invalid L1 address", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("500"),
        ethers.keccak256(ethers.toUtf8Bytes("lock_for_burn_03"))
      );

      const burnId = ethers.keccak256(ethers.toUtf8Bytes("burn_bad_addr"));
      await expect(
        wzion.connect(user1).bridgeBurn(ethers.parseEther("200"), "invalid_address", burnId)
      ).to.be.revertedWithCustomError(wzion, "InvalidL1Address");
    });

    it("should prevent replay burn ID", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("2000"),
        ethers.keccak256(ethers.toUtf8Bytes("lock_for_burn_04"))
      );

      const burnId = ethers.keccak256(ethers.toUtf8Bytes("burn_replay"));
      const l1Recipient = "zion1qrecipientaddress1234567890abcdef12345";

      await wzion.connect(user1).bridgeBurn(ethers.parseEther("500"), l1Recipient, burnId);
      await expect(
        wzion.connect(user1).bridgeBurn(ethers.parseEther("500"), l1Recipient, burnId)
      ).to.be.revertedWithCustomError(wzion, "BurnRequestAlreadyProcessed");
    });
  });

  // ── Emergency Pause ──────────────────────────────────
  describe("Emergency Pause", function () {
    it("should pause when guardian calls", async function () {
      const { wzion, guardian } = await loadFixture(deployFixture);
      await expect(wzion.connect(guardian).emergencyPause("Suspicious activity"))
        .to.emit(wzion, "EmergencyPause")
        .withArgs(guardian.address, "Suspicious activity");
      expect(await wzion.paused()).to.be.true;
    });

    it("should unpause when guardian calls", async function () {
      const { wzion, guardian } = await loadFixture(deployFixture);
      await wzion.connect(guardian).emergencyPause("Test");
      await expect(wzion.connect(guardian).emergencyUnpause())
        .to.emit(wzion, "EmergencyUnpause");
      expect(await wzion.paused()).to.be.false;
    });

    it("should block minting when paused", async function () {
      const { wzion, bridge, guardian, user1 } = await loadFixture(deployFixture);
      await wzion.connect(guardian).emergencyPause("Block");

      await expect(
        wzion.connect(bridge).bridgeMint(
          user1.address,
          ethers.parseEther("1000"),
          ethers.keccak256(ethers.toUtf8Bytes("paused_mint"))
        )
      ).to.be.reverted;
    });

    it("should block burning when paused", async function () {
      const { wzion, bridge, guardian, user1 } = await loadFixture(deployFixture);
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("1000"),
        ethers.keccak256(ethers.toUtf8Bytes("lock_pre_pause"))
      );
      await wzion.connect(guardian).emergencyPause("Block");

      await expect(
        wzion.connect(user1).bridgeBurn(
          ethers.parseEther("500"),
          "zion1qrecipientaddress1234567890abcdef12345",
          ethers.keccak256(ethers.toUtf8Bytes("paused_burn"))
        )
      ).to.be.reverted;
    });

    it("should revert pause from non-guardian", async function () {
      const { wzion, user1 } = await loadFixture(deployFixture);
      await expect(wzion.connect(user1).emergencyPause("Hack attempt")).to.be.reverted;
    });
  });

  // ── Bridge Stats ─────────────────────────────────────
  describe("bridgeStats", function () {
    it("should return correct stats after operations", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);

      // Mint 5000
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("5000"),
        ethers.keccak256(ethers.toUtf8Bytes("stats_lock_01"))
      );

      // Burn 1000
      await wzion.connect(user1).bridgeBurn(
        ethers.parseEther("1000"),
        "zion1qrecipientaddress1234567890abcdef12345",
        ethers.keccak256(ethers.toUtf8Bytes("stats_burn_01"))
      );

      const [minted, burned, outstanding, supply, maxSupply] = await wzion.bridgeStats();
      expect(minted).to.equal(ethers.parseEther("5000"));
      expect(burned).to.equal(ethers.parseEther("1000"));
      expect(outstanding).to.equal(ethers.parseEther("4000"));
      expect(supply).to.equal(ethers.parseEther("4000"));
      expect(maxSupply).to.equal(ethers.parseEther("144000000000"));
    });
  });

  // ── ERC-20 Standard ──────────────────────────────────
  describe("ERC-20 transfers", function () {
    it("should allow transfer of wZION between users", async function () {
      const { wzion, bridge, user1, user2 } = await loadFixture(deployFixture);
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("1000"),
        ethers.keccak256(ethers.toUtf8Bytes("transfer_lock_01"))
      );

      await wzion.connect(user1).transfer(user2.address, ethers.parseEther("400"));
      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("600"));
      expect(await wzion.balanceOf(user2.address)).to.equal(ethers.parseEther("400"));
    });

    it("should allow approve + transferFrom", async function () {
      const { wzion, bridge, user1, user2 } = await loadFixture(deployFixture);
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("1000"),
        ethers.keccak256(ethers.toUtf8Bytes("approve_lock_01"))
      );

      await wzion.connect(user1).approve(user2.address, ethers.parseEther("300"));
      await wzion.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("300"));
      expect(await wzion.balanceOf(user2.address)).to.equal(ethers.parseEther("300"));
    });
  });
});
