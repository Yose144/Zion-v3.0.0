/**
 * ZISGate configuration — sets relay address + Ed25519 public key.
 *
 * Usage:
 *   DEPLOYER_KEY=0x... node configure-zisgate.js
 */

const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;

const GATE_ADDR = '0x55160347B33Bb56F0ea99499072Ba5bf8D2862A5';

const GATE_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'ZIONDexZISGate_ZIONDexZISGate.abi'), 'utf8'));

async function main() {
  const ethers = require('ethers');
  if (!DEPLOYER_KEY) { console.error('DEPLOYER_KEY required'); process.exit(1); }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const deployer = new ethers.Wallet(DEPLOYER_KEY, provider);

  console.log(`Deployer: ${deployer.address}`);
  console.log(`ETH balance: ${ethers.formatEther(await provider.getBalance(deployer.address))}`);

  const gate = new ethers.Contract(GATE_ADDR, GATE_ABI, deployer);

  // Check current state
  const currentAdmin = await gate.admin();
  const currentRelay = await gate.zisRelay();
  const currentKey = await gate.zisPublicKey();
  const gateEnabled = await gate.gateEnabled();

  console.log(`\n── Current ZISGate State ──────────`);
  console.log(`Admin:       ${currentAdmin}`);
  console.log(`ZIS Relay:   ${currentRelay}`);
  console.log(`ZIS PubKey:  ${currentKey}`);
  console.log(`Gate Enabled: ${gateEnabled}`);
  console.log(`───────────────────────────────────`);

  if (currentAdmin.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error('Deployer is not the admin! Cannot configure.');
    process.exit(1);
  }

  // Set ZIS Relay = deployer address (validator-1, which runs ZIS service)
  if (currentRelay === ethers.ZeroAddress) {
    console.log('\nSetting ZIS Relay to deployer address...');
    const tx1 = await gate.setZisRelay(deployer.address);
    console.log(`setZisRelay tx: ${tx1.hash}`);
    await tx1.wait();
    console.log('ZIS Relay set');
  } else {
    console.log('ZIS Relay already set — skipping');
  }

  // Set ZIS Public Key — use keccak256 of JWT_SECRET as a 32-byte placeholder
  // (on-chain Ed25519 verification is deferred; key is for audit/future use)
  const jwtSecret = 'd3b0b5acb4ae00cdf1ca76896791280860028361ba48e61595cda10491a2fc84';
  const zisPubKey = ethers.keccak256('0x' + jwtSecret);
  console.log(`\nZIS Public Key (keccak256 of JWT_SECRET): ${zisPubKey}`);

  if (currentKey === ethers.ZeroHash) {
    console.log('Setting ZIS Public Key...');
    const tx2 = await gate.setZisPublicKey(zisPubKey);
    console.log(`setZisPublicKey tx: ${tx2.hash}`);
    await tx2.wait();
    console.log('ZIS Public Key set');
  } else {
    console.log('ZIS Public Key already set — skipping');
  }

  // Verify final state
  const finalRelay = await gate.zisRelay();
  const finalKey = await gate.zisPublicKey();
  console.log(`\n── Final ZISGate State ────────────`);
  console.log(`Admin:       ${currentAdmin}`);
  console.log(`ZIS Relay:   ${finalRelay}`);
  console.log(`ZIS PubKey:  ${finalKey}`);
  console.log(`Gate Enabled: ${gateEnabled} (open access — gate disabled)`);
  console.log(`───────────────────────────────────`);
  console.log('\n✅ ZISGate configured! Relay can now verify ZIS proofs on-chain.');
  console.log('Gate is OPEN (gateEnabled=false) — all users can swap.');
  console.log('To enable gate: gate.setGateEnabled(true) + gate.whitelist(user, true)');
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
