import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("ZIONFarm", function () {

  async function deployFixture() {
    const [admin, guardian, alice, bob, funder, attacker] = await ethers.getSigners();

    // Deploy wZION as reward token
    const WZION = await ethers.getContractFactory("WZION");
    const wzion = await WZION.deploy(admin.address, admin.address, guardian.address);
    await wzion.waitForDeployment();

    // Deploy mock LP token (use another wZION instance as stand-in)
    const lpToken = await WZION.deploy(admin.address, admin.address, guardian.address);
    await lpToken.waitForDeployment();

    const rewardPerSecond = ethers.parseEther("1"); // 1 wZION/s
    const halvingInterval = 90 * 24 * 3600;         // 90 days

    const Farm = await ethers.getContractFactory("ZIONFarm");
    const farm = await Farm.deploy(
      await wzion.getAddress(),
      admin.address,
      guardian.address,
      rewardPerSecond,
      halvingInterval
    );
    await farm.waitForDeployment();
    const farmAddr = await farm.getAddress();

    // Mint wZION to funder for reward funding, and LP tokens to alice/bob (unique l1TxHash required)
    await wzion.connect(admin).bridgeMint(funder.address,  ethers.parseEther("1000000"), ethers.hexlify(ethers.randomBytes(32)));
    await lpToken.connect(admin).bridgeMint(alice.address, ethers.parseEther("10000"),  ethers.hexlify(ethers.randomBytes(32)));
    await lpToken.connect(admin).bridgeMint(bob.address,   ethers.parseEther("10000"),  ethers.hexlify(ethers.randomBytes(32)));

    // Grant REWARD_FUNDER_ROLE to funder
    const REWARD_FUNDER_ROLE = await farm.REWARD_FUNDER_ROLE();
    await farm.connect(admin).grantRole(REWARD_FUNDER_ROLE, funder.address);

    // Approve
    await wzion.connect(funder).approve(farmAddr, ethers.MaxUint256);
    await lpToken.connect(alice).approve(farmAddr, ethers.MaxUint256);
    await lpToken.connect(bob).approve(farmAddr, ethers.MaxUint256);

    // Add pool 0: lpToken, 100 alloc points
    await farm.connect(admin).addPool(100, await lpToken.getAddress(), "testLP", false);

    // Fund rewards: 100k wZION
    await farm.connect(funder).fundRewards(ethers.parseEther("100000"));

    return { farm, wzion, lpToken, admin, guardian, alice, bob, funder, attacker, rewardPerSecond, halvingInterval };
  }

  // ── Deployment ───────────────────────────────────────────────────────────

  describe("Deployment", function () {
    it("sets reward token, roles, rate", async function () {
      const { farm, wzion, admin, guardian } = await loadFixture(deployFixture);
      expect(await farm.rewardToken()).to.equal(await wzion.getAddress());
      expect(await farm.rewardPerSecond()).to.equal(ethers.parseEther("1"));
      expect(await farm.hasRole(await farm.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await farm.hasRole(await farm.GUARDIAN_ROLE(), guardian.address)).to.be.true;
    });

    it("pool 0 initialised correctly", async function () {
      const { farm, lpToken } = await loadFixture(deployFixture);
      const pool = await farm.getPool(0);
      expect(pool.allocPoints).to.equal(100n);
      expect(pool.active).to.be.true;
      expect(pool.lpToken).to.equal(await lpToken.getAddress());
    });

    it("reward pool funded", async function () {
      const { farm } = await loadFixture(deployFixture);
      expect(await farm.rewardPoolBalance()).to.equal(ethers.parseEther("100000"));
    });
  });

  // ── Pool management ───────────────────────────────────────────────────────

  describe("Pool management", function () {
    it("admin can add a second pool", async function () {
      const { farm, admin, wzion } = await loadFixture(deployFixture);
      await expect(
        farm.connect(admin).addPool(200, await wzion.getAddress(), "wZION single", true)
      ).to.emit(farm, "PoolAdded");
      expect(await farm.poolCount()).to.equal(2n);
    });

    it("reverts duplicate LP token", async function () {
      const { farm, admin, lpToken } = await loadFixture(deployFixture);
      await expect(
        farm.connect(admin).addPool(50, await lpToken.getAddress(), "dup", false)
      ).to.be.revertedWithCustomError(farm, "DuplicatePool");
    });

    it("admin can update pool alloc points", async function () {
      const { farm, admin } = await loadFixture(deployFixture);
      await farm.connect(admin).updatePool(0, 300, false);
      const pool = await farm.getPool(0);
      expect(pool.allocPoints).to.equal(300n);
    });

    it("non-admin cannot add pool", async function () {
      const { farm, attacker, wzion } = await loadFixture(deployFixture);
      await expect(
        farm.connect(attacker).addPool(100, await wzion.getAddress(), "hack", false)
      ).to.be.reverted;
    });
  });

  // ── Deposit / Harvest / Withdraw ─────────────────────────────────────────

  describe("Deposit and Harvest", function () {
    it("alice deposits and earns rewards over time", async function () {
      const { farm, wzion, alice } = await loadFixture(deployFixture);

      await farm.connect(alice).deposit(0, ethers.parseEther("1000"));
      expect((await farm.getUser(0, alice.address)).staked).to.equal(ethers.parseEther("1000"));

      // Fast-forward 100 seconds → expect ~100 wZION rewards (1 wZION/s, sole staker)
      await time.increase(100);

      const pending = await farm.pendingReward(0, alice.address);
      // Allow 1-2 block tolerance
      expect(pending).to.be.closeTo(ethers.parseEther("100"), ethers.parseEther("2"));
    });

    it("harvest sends rewards to alice", async function () {
      const { farm, wzion, alice } = await loadFixture(deployFixture);

      await farm.connect(alice).deposit(0, ethers.parseEther("1000"));
      await time.increase(50);

      const before = await wzion.balanceOf(alice.address);
      await farm.connect(alice).harvest(0);
      const after  = await wzion.balanceOf(alice.address);
      expect(after - before).to.be.closeTo(ethers.parseEther("50"), ethers.parseEther("2"));
    });

    it("two stakers split rewards proportionally", async function () {
      const { farm, alice, bob } = await loadFixture(deployFixture);

      // Alice stakes 1000, Bob stakes 3000 → alice gets 25%, bob 75%
      await farm.connect(alice).deposit(0, ethers.parseEther("1000"));
      await farm.connect(bob).deposit(0, ethers.parseEther("3000"));
      await time.increase(100);

      const pendingAlice = await farm.pendingReward(0, alice.address);
      const pendingBob   = await farm.pendingReward(0, bob.address);

      // Alice should have ~25% of 100s excluding the first second solo
      // Bob should have ~75% of the joint period
      expect(pendingBob).to.be.gt(pendingAlice * 2n);
    });

    it("withdraw returns LP tokens and harvests", async function () {
      const { farm, wzion, lpToken, alice } = await loadFixture(deployFixture);
      const deposit = ethers.parseEther("500");

      await farm.connect(alice).deposit(0, deposit);
      await time.increase(30);

      const lpBefore = await lpToken.balanceOf(alice.address);
      await farm.connect(alice).withdraw(0, deposit);
      const lpAfter  = await lpToken.balanceOf(alice.address);
      expect(lpAfter - lpBefore).to.equal(deposit);
    });
  });

  // ── Emergency withdraw ────────────────────────────────────────────────────

  describe("Emergency withdraw", function () {
    it("returns LP tokens without rewards", async function () {
      const { farm, wzion, lpToken, alice } = await loadFixture(deployFixture);

      await farm.connect(alice).deposit(0, ethers.parseEther("1000"));
      await time.increase(100);

      const wzionBefore = await wzion.balanceOf(alice.address);
      await farm.connect(alice).emergencyWithdraw(0);
      const wzionAfter  = await wzion.balanceOf(alice.address);

      // No reward token
      expect(wzionAfter).to.equal(wzionBefore);
      expect((await farm.getUser(0, alice.address)).staked).to.equal(0n);
    });
  });

  // ── Halving ───────────────────────────────────────────────────────────────

  describe("Halving", function () {
    it("halves reward rate after interval", async function () {
      const { farm, halvingInterval, rewardPerSecond } = await loadFixture(deployFixture);

      const rateBefore = await farm.rewardPerSecond();
      await time.increase(halvingInterval);
      await farm.triggerHalving();
      const rateAfter = await farm.rewardPerSecond();
      expect(rateAfter).to.equal(rateBefore / 2n);
      expect(await farm.halvingCount()).to.equal(1n);
    });

    it("reverts halving before interval", async function () {
      const { farm } = await loadFixture(deployFixture);
      await expect(farm.triggerHalving()).to.be.revertedWith("halving not due");
    });
  });

  // ── Reward funding ────────────────────────────────────────────────────────

  describe("Reward funding", function () {
    it("funder can add more rewards", async function () {
      const { farm, funder } = await loadFixture(deployFixture);
      const before = await farm.rewardPoolBalance();
      await farm.connect(funder).fundRewards(ethers.parseEther("1000"));
      expect(await farm.rewardPoolBalance()).to.equal(before + ethers.parseEther("1000"));
    });

    it("non-funder cannot fund", async function () {
      const { farm, attacker } = await loadFixture(deployFixture);
      await expect(farm.connect(attacker).fundRewards(1n)).to.be.reverted;
    });
  });

  // ── Pause ─────────────────────────────────────────────────────────────────

  describe("Pause", function () {
    it("guardian pauses deposits", async function () {
      const { farm, guardian, alice } = await loadFixture(deployFixture);
      await farm.connect(guardian).pause();
      await expect(farm.connect(alice).deposit(0, ethers.parseEther("100")))
        .to.be.revertedWithCustomError(farm, "EnforcedPause");
      await farm.connect(guardian).unpause();
    });
  });
});
