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

  // ── Supply cap ───────────────────────────────────────
  describe("Supply cap (ExceedsMaxSupply)", function () {
    it("should revert when minting would exceed MAX_SUPPLY", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const maxSupply = await wzion.MAX_SUPPLY();

      // First fill up to near max (MAX - 200 wZION)
      const nearMax = maxSupply - ethers.parseEther("200");
      // We can't actually mint this in one TX (gas), so test with a very small cap contract
      // Instead just test that minting exactly max works fine and mintableSupply goes to 0
      // We'll test ExceedsMaxSupply by minting exactly max in two steps that would overflow.
      // Since we can't mint 144B in tests, we verify the guard logic via mint that would set supply to max + 1.

      // Mint 200 wZION (valid)
      await wzion.connect(bridge).bridgeMint(
        user1.address,
        ethers.parseEther("200"),
        ethers.keccak256(ethers.toUtf8Bytes("cap_lock_01"))
      );

      // Attempt to mint (MAX_SUPPLY) — totalSupply would become MAX+200, should revert
      await expect(
        wzion.connect(bridge).bridgeMint(
          user1.address,
          maxSupply,
          ethers.keccak256(ethers.toUtf8Bytes("cap_lock_02"))
        )
      ).to.be.revertedWithCustomError(wzion, "ExceedsMaxSupply");
    });

    it("mintableSupply decreases correctly with each mint", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const max = await wzion.MAX_SUPPLY();

      await wzion.connect(bridge).bridgeMint(
        user1.address, ethers.parseEther("1000"),
        ethers.keccak256(ethers.toUtf8Bytes("mintable_01"))
      );
      expect(await wzion.mintableSupply()).to.equal(max - ethers.parseEther("1000"));

      await wzion.connect(bridge).bridgeMint(
        user1.address, ethers.parseEther("5000"),
        ethers.keccak256(ethers.toUtf8Bytes("mintable_02"))
      );
      expect(await wzion.mintableSupply()).to.equal(max - ethers.parseEther("6000"));
    });
  });

  // ── Decimal invariant ─────────────────────────────────
  describe("Decimal invariant (L1 6-dec ↔ EVM 18-dec)", function () {
    it("1 ZION L1 atomic = 1e12 wZION wei (scale factor check)", async function () {
      // 1 ZION on L1 = 1_000_000 atomic units (6 decimals)
      // 1 wZION on EVM = 1e18 wei (18 decimals)
      // Scale: 1e18 / 1e6 = 1e12
      const SCALE = BigInt(1e12);
      const l1Atomic = BigInt(1_000_000); // 1 ZION in L1 atoms
      const expectedWzionWei = l1Atomic * SCALE;
      expect(expectedWzionWei).to.equal(ethers.parseEther("1"));
    });

    it("MIN_BRIDGE_AMOUNT 100 wZION = 100 ZION on L1 (scale)", async function () {
      const { wzion } = await loadFixture(deployFixture);
      const minWzionWei = await wzion.MIN_BRIDGE_AMOUNT();
      const SCALE = BigInt(1e12);
      // 100 wZION wei / 1e12 = 100_000_000 L1 atomic = 100 ZION
      expect(minWzionWei / SCALE).to.equal(BigInt(100_000_000));
    });

    it("round-trip: mint 1e3 wZION → burn 1e3 wZION → supply back to 0", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("1000");

      await wzion.connect(bridge).bridgeMint(
        user1.address, amount,
        ethers.keccak256(ethers.toUtf8Bytes("rt_lock_01"))
      );
      expect(await wzion.totalSupply()).to.equal(amount);

      await wzion.connect(user1).bridgeBurn(
        amount,
        "zion1qrecipientaddress1234567890abcdef12345",
        ethers.keccak256(ethers.toUtf8Bytes("rt_burn_01"))
      );
      expect(await wzion.totalSupply()).to.equal(0);

      const [minted, burned, outstanding] = await wzion.bridgeStats();
      expect(minted).to.equal(amount);
      expect(burned).to.equal(amount);
      expect(outstanding).to.equal(0);
    });
  });

  // ── L1 address edge cases ─────────────────────────────
  describe("L1 address validation edge cases", function () {
    async function mintForBurn(wzion: any, bridge: any, user: any, suffix: string) {
      await wzion.connect(bridge).bridgeMint(
        user.address, ethers.parseEther("500"),
        ethers.keccak256(ethers.toUtf8Bytes(`l1addr_lock_${suffix}`))
      );
    }

    it("should accept minimum valid L1 address (40 chars, zion1 prefix)", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await mintForBurn(wzion, bridge, user1, "min");
      // 40 chars: "zion1" (5) + 35 chars
      const addr40 = "zion1" + "a".repeat(35); // length 40
      await expect(
        wzion.connect(user1).bridgeBurn(
          ethers.parseEther("200"), addr40,
          ethers.keccak256(ethers.toUtf8Bytes("l1addr_burn_min"))
        )
      ).to.emit(wzion, "BridgeBurn");
    });

    it("should accept maximum valid L1 address (62 chars, zion1 prefix)", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await mintForBurn(wzion, bridge, user1, "max");
      const addr62 = "zion1" + "b".repeat(57); // length 62
      await expect(
        wzion.connect(user1).bridgeBurn(
          ethers.parseEther("200"), addr62,
          ethers.keccak256(ethers.toUtf8Bytes("l1addr_burn_max"))
        )
      ).to.emit(wzion, "BridgeBurn");
    });

    it("should reject address shorter than 40 chars", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await mintForBurn(wzion, bridge, user1, "short");
      const shortAddr = "zion1" + "c".repeat(30); // 35 chars — too short
      await expect(
        wzion.connect(user1).bridgeBurn(
          ethers.parseEther("200"), shortAddr,
          ethers.keccak256(ethers.toUtf8Bytes("l1addr_burn_short"))
        )
      ).to.be.revertedWithCustomError(wzion, "InvalidL1Address");
    });

    it("should reject address longer than 62 chars", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await mintForBurn(wzion, bridge, user1, "long");
      const longAddr = "zion1" + "d".repeat(58); // 63 chars — too long
      await expect(
        wzion.connect(user1).bridgeBurn(
          ethers.parseEther("200"), longAddr,
          ethers.keccak256(ethers.toUtf8Bytes("l1addr_burn_long"))
        )
      ).to.be.revertedWithCustomError(wzion, "InvalidL1Address");
    });

    it("should reject address with wrong prefix (not zion1)", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await mintForBurn(wzion, bridge, user1, "prefix");
      const badPrefix = "addr1" + "e".repeat(35); // correct length, wrong prefix
      await expect(
        wzion.connect(user1).bridgeBurn(
          ethers.parseEther("200"), badPrefix,
          ethers.keccak256(ethers.toUtf8Bytes("l1addr_burn_prefix"))
        )
      ).to.be.revertedWithCustomError(wzion, "InvalidL1Address");
    });

    it("should reject empty string as L1 address", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await mintForBurn(wzion, bridge, user1, "empty");
      await expect(
        wzion.connect(user1).bridgeBurn(
          ethers.parseEther("200"), "",
          ethers.keccak256(ethers.toUtf8Bytes("l1addr_burn_empty"))
        )
      ).to.be.revertedWithCustomError(wzion, "InvalidL1Address");
    });
  });

  // ── bridgeBurn extra guards ───────────────────────────
  describe("bridgeBurn extra guards", function () {
    it("should revert on zero amount", async function () {
      const { wzion, user1 } = await loadFixture(deployFixture);
      await expect(
        wzion.connect(user1).bridgeBurn(
          0,
          "zion1qrecipientaddress1234567890abcdef12345",
          ethers.keccak256(ethers.toUtf8Bytes("burn_zero"))
        )
      ).to.be.revertedWithCustomError(wzion, "ZeroAmount");
    });

    it("should allow partial burns from same user", async function () {
      const { wzion, bridge, user1 } = await loadFixture(deployFixture);
      await wzion.connect(bridge).bridgeMint(
        user1.address, ethers.parseEther("2000"),
        ethers.keccak256(ethers.toUtf8Bytes("partial_burn_lock"))
      );
      const l1Addr = "zion1qrecipientaddress1234567890abcdef12345";

      await wzion.connect(user1).bridgeBurn(
        ethers.parseEther("500"), l1Addr,
        ethers.keccak256(ethers.toUtf8Bytes("pb_01"))
      );
      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("1500"));

      await wzion.connect(user1).bridgeBurn(
        ethers.parseEther("700"), l1Addr,
        ethers.keccak256(ethers.toUtf8Bytes("pb_02"))
      );
      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("800"));

      expect(await wzion.totalBridgeBurned()).to.equal(ethers.parseEther("1200"));
    });
  });

  // ── Multi-user flow ───────────────────────────────────
  describe("Multi-user flow", function () {
    it("mint to user1, transfer to user2, user2 burns", async function () {
      const { wzion, bridge, user1, user2 } = await loadFixture(deployFixture);

      // Mint 1000 to user1
      await wzion.connect(bridge).bridgeMint(
        user1.address, ethers.parseEther("1000"),
        ethers.keccak256(ethers.toUtf8Bytes("mu_lock_01"))
      );

      // user1 → user2: 600 wZION
      await wzion.connect(user1).transfer(user2.address, ethers.parseEther("600"));
      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("400"));
      expect(await wzion.balanceOf(user2.address)).to.equal(ethers.parseEther("600"));

      // user2 burns 500
      await wzion.connect(user2).bridgeBurn(
        ethers.parseEther("500"),
        "zion1qrecipientaddress1234567890abcdef12345",
        ethers.keccak256(ethers.toUtf8Bytes("mu_burn_01"))
      );
      expect(await wzion.balanceOf(user2.address)).to.equal(ethers.parseEther("100"));
      expect(await wzion.totalSupply()).to.equal(ethers.parseEther("500"));
    });

    it("independent mints to multiple users do not interfere", async function () {
      const { wzion, bridge, user1, user2 } = await loadFixture(deployFixture);

      await wzion.connect(bridge).bridgeMint(
        user1.address, ethers.parseEther("300"),
        ethers.keccak256(ethers.toUtf8Bytes("multi_lock_u1"))
      );
      await wzion.connect(bridge).bridgeMint(
        user2.address, ethers.parseEther("700"),
        ethers.keccak256(ethers.toUtf8Bytes("multi_lock_u2"))
      );

      expect(await wzion.balanceOf(user1.address)).to.equal(ethers.parseEther("300"));
      expect(await wzion.balanceOf(user2.address)).to.equal(ethers.parseEther("700"));
      expect(await wzion.totalSupply()).to.equal(ethers.parseEther("1000"));
      expect(await wzion.totalBridgeMinted()).to.equal(ethers.parseEther("1000"));
    });
  });

  // ── EIP-2612 Permit ───────────────────────────────────
  describe("EIP-2612 Permit (gasless approve)", function () {
    it("should have correct EIP-712 domain name", async function () {
      const { wzion } = await loadFixture(deployFixture);
      // ERC20Permit stores domain name equal to token name
      const domain = await wzion.eip712Domain();
      expect(domain.name).to.equal("Wrapped ZION");
    });

    it("should allow permit-based gasless approve", async function () {
      const { wzion, bridge, user1, user2 } = await loadFixture(deployFixture);

      // Mint some tokens so user1 has balance
      await wzion.connect(bridge).bridgeMint(
        user1.address, ethers.parseEther("500"),
        ethers.keccak256(ethers.toUtf8Bytes("permit_lock_01"))
      );

      const amount = ethers.parseEther("200");
      const latestBlock = await ethers.provider.getBlock("latest");
      const deadline = BigInt(latestBlock!.timestamp + 3600);
      const nonce = await wzion.nonces(user1.address);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      // Build EIP-712 permit signature
      const domain = {
        name: "Wrapped ZION",
        version: "1",
        chainId,
        verifyingContract: await wzion.getAddress()
      };
      const types = {
        Permit: [
          { name: "owner",   type: "address" },
          { name: "spender", type: "address" },
          { name: "value",   type: "uint256" },
          { name: "nonce",   type: "uint256" },
          { name: "deadline",type: "uint256" }
        ]
      };
      const value = {
        owner:   user1.address,
        spender: user2.address,
        value:   amount,
        nonce,
        deadline
      };

      const sig = await user1.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(sig);

      // Execute permit (user2 pays gas, user1 signs off-chain)
      await wzion.connect(user2).permit(user1.address, user2.address, amount, deadline, v, r, s);
      expect(await wzion.allowance(user1.address, user2.address)).to.equal(amount);

      // Now user2 can transferFrom without separate approve TX
      await wzion.connect(user2).transferFrom(user1.address, user2.address, amount);
      expect(await wzion.balanceOf(user2.address)).to.equal(amount);
    });

    it("should revert permit with expired deadline", async function () {
      const { wzion, user1, user2 } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("100");
      const deadline = BigInt(1); // already expired
      const nonce = await wzion.nonces(user1.address);
      const chainId = (await ethers.provider.getNetwork()).chainId;

      const domain = {
        name: "Wrapped ZION",
        version: "1",
        chainId,
        verifyingContract: await wzion.getAddress()
      };
      const types = {
        Permit: [
          { name: "owner",   type: "address" },
          { name: "spender", type: "address" },
          { name: "value",   type: "uint256" },
          { name: "nonce",   type: "uint256" },
          { name: "deadline",type: "uint256" }
        ]
      };
      const value = { owner: user1.address, spender: user2.address, value: amount, nonce, deadline };
      const sig = await user1.signTypedData(domain, types, value);
      const { v, r, s } = ethers.Signature.from(sig);

      await expect(
        wzion.connect(user2).permit(user1.address, user2.address, amount, deadline, v, r, s)
      ).to.be.revertedWithCustomError(wzion, "ERC2612ExpiredSignature");
    });
  });

  // ── Role management ───────────────────────────────────
  describe("Role management", function () {
    it("should allow admin to grant BRIDGE_ROLE to another address", async function () {
      const { wzion, admin, user1, user2, BRIDGE_ROLE } = await loadFixture(deployFixture);

      await wzion.connect(admin).grantRole(BRIDGE_ROLE, user1.address);
      expect(await wzion.hasRole(BRIDGE_ROLE, user1.address)).to.be.true;

      // New bridge can now mint
      await expect(
        wzion.connect(user1).bridgeMint(
          user2.address, ethers.parseEther("500"),
          ethers.keccak256(ethers.toUtf8Bytes("role_grant_mint"))
        )
      ).to.emit(wzion, "BridgeMint");
    });

    it("should allow admin to revoke BRIDGE_ROLE", async function () {
      const { wzion, admin, bridge, user1, BRIDGE_ROLE } = await loadFixture(deployFixture);

      await wzion.connect(admin).revokeRole(BRIDGE_ROLE, bridge.address);
      expect(await wzion.hasRole(BRIDGE_ROLE, bridge.address)).to.be.false;

      await expect(
        wzion.connect(bridge).bridgeMint(
          user1.address, ethers.parseEther("500"),
          ethers.keccak256(ethers.toUtf8Bytes("revoke_mint_attempt"))
        )
      ).to.be.reverted;
    });

    it("should not allow non-admin to grant roles", async function () {
      const { wzion, user1, user2, BRIDGE_ROLE } = await loadFixture(deployFixture);
      await expect(
        wzion.connect(user1).grantRole(BRIDGE_ROLE, user2.address)
      ).to.be.reverted;
    });
  });
});
