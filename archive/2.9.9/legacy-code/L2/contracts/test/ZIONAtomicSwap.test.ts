import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

const ONE_HOUR  = 3600;
const TWO_HOURS = 7200;

describe("ZIONAtomicSwap", function () {

  async function deployFixture() {
    const [admin, guardian, alice, bob, attacker] = await ethers.getSigners();

    // Deploy mock ERC-20 (wZION) for ERC-20 swap tests
    const MockERC20 = await ethers.getContractFactory("WZION");
    // Use wZION as a test token (re-deploy fresh instance)
    const token = await MockERC20.deploy(admin.address, admin.address, guardian.address);
    await token.waitForDeployment();
    // Mint tokens to alice and bob (unique l1TxHash per call required by wZION)
    await token.connect(admin).bridgeMint(alice.address, ethers.parseEther("1000"), ethers.hexlify(ethers.randomBytes(32)));
    await token.connect(admin).bridgeMint(bob.address,   ethers.parseEther("1000"), ethers.hexlify(ethers.randomBytes(32)));

    const Swap = await ethers.getContractFactory("ZIONAtomicSwap");
    const swap = await Swap.deploy(admin.address, guardian.address);
    await swap.waitForDeployment();

    // Approve swap contract
    await token.connect(alice).approve(await swap.getAddress(), ethers.MaxUint256);
    await token.connect(bob).approve(await swap.getAddress(), ethers.MaxUint256);

    return { swap, token, admin, guardian, alice, bob, attacker };
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function makeSecret(): { secret: string; hashlock: string } {
    const secret   = ethers.randomBytes(32);
    const hashlock = ethers.sha256(new Uint8Array(secret));
    return {
      secret:   ethers.hexlify(secret),
      hashlock: hashlock,
    };
  }

  function makeId(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  // ── Deployment ───────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets roles correctly", async function () {
      const { swap, admin, guardian } = await loadFixture(deployFixture);
      expect(await swap.hasRole(await swap.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await swap.hasRole(await swap.GUARDIAN_ROLE(), guardian.address)).to.be.true;
    });

    it("starts with zero feeBps", async function () {
      const { swap } = await loadFixture(deployFixture);
      expect(await swap.feeBps()).to.equal(0n);
    });

    it("has correct MIN/MAX timelock constants", async function () {
      const { swap } = await loadFixture(deployFixture);
      expect(await swap.MIN_TIMELOCK()).to.equal(1800n);   // 30 min
      expect(await swap.MAX_TIMELOCK()).to.equal(604800n); // 7 days
    });
  });

  // ── ETH HTLC ─────────────────────────────────────────────────────────────

  describe("ETH HTLC — lock / claim / refund", function () {
    it("locks ETH and emits Locked event", async function () {
      const { swap, alice } = await loadFixture(deployFixture);
      const { secret, hashlock } = makeSecret();
      const id = makeId();

      await expect(
        swap.connect(alice).lock(
          id, hashlock, ONE_HOUR,
          ethers.ZeroAddress, 0, ethers.ZeroAddress,
          "zion", "zion1aliceaddr",
          { value: ethers.parseEther("1") }
        )
      ).to.emit(swap, "Locked")
       .withArgs(id, alice.address, ethers.ZeroAddress, ethers.ZeroAddress,
                 ethers.parseEther("1"), hashlock,
                 (v: bigint) => v > 0n,
                 "zion", "zion1aliceaddr");
    });

    it("reverts on duplicate lock ID", async function () {
      const { swap, alice } = await loadFixture(deployFixture);
      const { hashlock } = makeSecret();
      const id = makeId();
      const opts = { value: ethers.parseEther("0.5") };

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "zion", "", opts);
      await expect(
        swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "zion", "", opts)
      ).to.be.revertedWithCustomError(swap, "LockExists");
    });

    it("bob claims ETH with correct preimage", async function () {
      const { swap, alice, bob } = await loadFixture(deployFixture);
      const { secret, hashlock } = makeSecret();
      const id = makeId();

      await swap.connect(alice).lock(
        id, hashlock, ONE_HOUR,
        ethers.ZeroAddress, 0, bob.address,
        "zion", "zion1aliceaddr",
        { value: ethers.parseEther("1") }
      );

      const bobBefore = await ethers.provider.getBalance(bob.address);
      const tx = await swap.connect(bob).claim(id, secret);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const bobAfter = await ethers.provider.getBalance(bob.address);

      expect(bobAfter - bobBefore + gasUsed).to.be.closeTo(
        ethers.parseEther("1"), ethers.parseEther("0.001")
      );
      expect(await swap.isClaimable(id)).to.be.false;
    });

    it("reverts claim with wrong preimage", async function () {
      const { swap, alice, bob } = await loadFixture(deployFixture);
      const { hashlock } = makeSecret();
      const id = makeId();
      const wrongSecret = ethers.hexlify(ethers.randomBytes(32));

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, bob.address, "zion", "", { value: ethers.parseEther("1") });
      await expect(swap.connect(bob).claim(id, wrongSecret))
        .to.be.revertedWithCustomError(swap, "InvalidPreimage");
    });

    it("reverts claim after timelock expired", async function () {
      const { swap, alice, bob } = await loadFixture(deployFixture);
      const { secret, hashlock } = makeSecret();
      const id = makeId();

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, bob.address, "zion", "", { value: ethers.parseEther("1") });
      await time.increase(ONE_HOUR + 1);

      await expect(swap.connect(bob).claim(id, secret))
        .to.be.revertedWithCustomError(swap, "TimelockExpired");
    });

    it("alice refunds after timelock expiry", async function () {
      const { swap, alice } = await loadFixture(deployFixture);
      const { hashlock } = makeSecret();
      const id = makeId();

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "btc", "bc1q...", { value: ethers.parseEther("2") });

      await expect(swap.connect(alice).refund(id))
        .to.be.revertedWithCustomError(swap, "TimelockNotExpired");

      await time.increase(ONE_HOUR + 1);

      const before = await ethers.provider.getBalance(alice.address);
      const tx = await swap.connect(alice).refund(id);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const after = await ethers.provider.getBalance(alice.address);

      expect(after - before + gasUsed).to.be.closeTo(
        ethers.parseEther("2"), ethers.parseEther("0.001")
      );
      expect(await swap.isRefundable(id)).to.be.false;
    });

    it("reverts double claim", async function () {
      const { swap, alice, bob } = await loadFixture(deployFixture);
      const { secret, hashlock } = makeSecret();
      const id = makeId();

      await swap.connect(alice).lock(id, hashlock, TWO_HOURS, ethers.ZeroAddress, 0, bob.address, "zion", "", { value: ethers.parseEther("1") });
      await swap.connect(bob).claim(id, secret);
      await expect(swap.connect(bob).claim(id, secret))
        .to.be.revertedWithCustomError(swap, "AlreadyClaimed");
    });

    it("reverts claim by wrong recipient", async function () {
      const { swap, alice, bob, attacker } = await loadFixture(deployFixture);
      const { secret, hashlock } = makeSecret();
      const id = makeId();

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, bob.address, "zion", "", { value: ethers.parseEther("1") });
      await expect(swap.connect(attacker).claim(id, secret))
        .to.be.revertedWithCustomError(swap, "UnauthorizedRecipient");
    });
  });

  // ── ERC-20 HTLC ──────────────────────────────────────────────────────────

  describe("ERC-20 HTLC", function () {
    it("locks and claims ERC-20 tokens", async function () {
      const { swap, token, alice, bob } = await loadFixture(deployFixture);
      const { secret, hashlock } = makeSecret();
      const id = makeId();
      const amount = ethers.parseEther("100");
      const tokenAddr = await token.getAddress();
      const swapAddr  = await swap.getAddress();

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, tokenAddr, amount, bob.address, "zion", "");
      expect(await token.balanceOf(swapAddr)).to.equal(amount);

      const bobBefore = await token.balanceOf(bob.address);
      await swap.connect(bob).claim(id, secret);
      expect(await token.balanceOf(bob.address)).to.equal(bobBefore + amount);
      expect(await token.balanceOf(swapAddr)).to.equal(0n);
    });

    it("refunds ERC-20 after expiry", async function () {
      const { swap, token, alice } = await loadFixture(deployFixture);
      const { hashlock } = makeSecret();
      const id = makeId();
      const amount = ethers.parseEther("50");
      const tokenAddr = await token.getAddress();

      const aliceBefore = await token.balanceOf(alice.address);
      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, tokenAddr, amount, ethers.ZeroAddress, "btc", "bc1q...");
      await time.increase(ONE_HOUR + 1);
      await swap.connect(alice).refund(id);
      expect(await token.balanceOf(alice.address)).to.equal(aliceBefore);
    });
  });

  // ── Fee ──────────────────────────────────────────────────────────────────

  describe("Protocol fee", function () {
    it("deducts fee from ETH lock", async function () {
      const { swap, alice, admin } = await loadFixture(deployFixture);
      await swap.connect(admin).setFeeBps(50); // 0.5%
      const { hashlock } = makeSecret();
      const id = makeId();

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "zion", "", { value: ethers.parseEther("1") });
      const lock = await swap.getLock(id);
      // 1 ETH - 0.5% = 0.995 ETH
      expect(lock.amount).to.equal(ethers.parseEther("0.995"));
      expect(await swap.accruedFees(ethers.ZeroAddress)).to.equal(ethers.parseEther("0.005"));
    });

    it("admin can withdraw fees", async function () {
      const { swap, alice, admin } = await loadFixture(deployFixture);
      await swap.connect(admin).setFeeBps(100); // 1%
      const { hashlock } = makeSecret();
      const id = makeId();

      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "zion", "", { value: ethers.parseEther("1") });
      const before = await ethers.provider.getBalance(admin.address);
      await swap.connect(admin).withdrawFees(ethers.ZeroAddress);
      const after = await ethers.provider.getBalance(admin.address);
      expect(after).to.be.gt(before - ethers.parseEther("0.001")); // net of gas
    });

    it("reverts setFeeBps above 100", async function () {
      const { swap, admin } = await loadFixture(deployFixture);
      await expect(swap.connect(admin).setFeeBps(101))
        .to.be.revertedWithCustomError(swap, "FeeTooHigh");
    });
  });

  // ── Admin / Pause ─────────────────────────────────────────────────────────

  describe("Pause", function () {
    it("guardian can pause and unpause", async function () {
      const { swap, alice, guardian } = await loadFixture(deployFixture);
      await swap.connect(guardian).pause();
      const { hashlock } = makeSecret();
      await expect(
        swap.connect(alice).lock(makeId(), hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "zion", "", { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(swap, "EnforcedPause");
      await swap.connect(guardian).unpause();
    });
  });

  // ── View helpers ─────────────────────────────────────────────────────────

  describe("isClaimable / isRefundable", function () {
    it("isClaimable returns true for active lock", async function () {
      const { swap, alice } = await loadFixture(deployFixture);
      const { hashlock } = makeSecret();
      const id = makeId();
      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "zion", "", { value: ethers.parseEther("0.1") });
      expect(await swap.isClaimable(id)).to.be.true;
      expect(await swap.isRefundable(id)).to.be.false;
    });

    it("isRefundable after expiry", async function () {
      const { swap, alice } = await loadFixture(deployFixture);
      const { hashlock } = makeSecret();
      const id = makeId();
      await swap.connect(alice).lock(id, hashlock, ONE_HOUR, ethers.ZeroAddress, 0, ethers.ZeroAddress, "zion", "", { value: ethers.parseEther("0.1") });
      await time.increase(ONE_HOUR + 1);
      expect(await swap.isClaimable(id)).to.be.false;
      expect(await swap.isRefundable(id)).to.be.true;
    });
  });
});
