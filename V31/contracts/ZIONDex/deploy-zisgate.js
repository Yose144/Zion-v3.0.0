/**
 * ZISGate deploy script — estimates gas and deploys ZIONDexZISGate to Base.
 *
 * Usage:
 *   node deploy-zisgate.js                    # gas estimate only (no deploy)
 *   DEPLOYER_KEY=0x... node deploy-zisgate.js # estimate + deploy
 *
 * Environment:
 *   DEPLOYER_KEY   — hex private key for the deployer wallet
 *   RPC_URL        — Base RPC (default: https://mainnet.base.org)
 *   ZIS_RELAY      — trusted relay address (set after deploy via setZisRelay)
 *   ZIS_PUBLIC_KEY — 32-byte hex ZIS Ed25519 public key (set after deploy)
 */

const fs = require('fs');
const path = require('path');

const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';
const DEPLOYER_KEY = process.env.DEPLOYER_KEY;

const buildDir = path.join(__dirname, 'build');
const abi = JSON.parse(fs.readFileSync(path.join(buildDir, 'ZIONDexZISGate_ZIONDexZISGate.abi'), 'utf8'));
const bytecode = '0x' + fs.readFileSync(path.join(buildDir, 'ZIONDexZISGate_ZIONDexZISGate.bin'), 'utf8');

async function main() {
  // ethers v6
  let ethers;
  try {
    ethers = require('ethers');
  } catch {
    console.error('ethers not installed. Run: npm install ethers');
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const network = await provider.getNetwork();
  console.log(`Connected to chainId=${network.chainId} (${RPC_URL})`);

  const deployer = DEPLOYER_KEY ? new ethers.Wallet(DEPLOYER_KEY, provider) : null;

  if (deployer) {
    const balance = await provider.getBalance(deployer.address);
    console.log(`Deployer: ${deployer.address}`);
    console.log(`Balance:  ${ethers.formatEther(balance)} ETH`);
    if (balance === 0n) {
      console.log('⚠️  Deployer has 0 ETH — cannot deploy. Fund the wallet first.');
    }
  } else {
    console.log('No DEPLOYER_KEY set — gas estimate only (no deploy).');
  }

  // ZISGate constructor takes no args.
  const factory = new ethers.ContractFactory(abi, bytecode, deployer || provider);

  // Gas estimate
  const deployTx = await factory.getDeployTransaction();
  const gasEstimate = await provider.estimateGas({
    data: deployTx.data,
    from: deployer ? deployer.address : '0x0000000000000000000000000000000000000001',
  });
  const feeData = await provider.getFeeData();

  console.log('\n── Gas Estimate ──────────────────────────────');
  console.log(`Bytecode size:     ${bytecode.length / 2 - 1} bytes`);
  console.log(`Deploy gas:        ${gasEstimate.toString()}`);

  if (feeData.gasPrice) {
    const cost = gasEstimate * feeData.gasPrice;
    console.log(`Gas price:         ${ethers.formatUnits(feeData.gasPrice, 'gwei')} gwei`);
    console.log(`Est. deploy cost:  ${ethers.formatEther(cost)} ETH`);
  }
  if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
    const cost1559 = gasEstimate * feeData.maxFeePerGas;
    console.log(`Max fee per gas:   ${ethers.formatUnits(feeData.maxFeePerGas, 'gwei')} gwei`);
    console.log(`Max deploy cost:   ${ethers.formatEther(cost1559)} ETH`);
  }
  console.log('──────────────────────────────────────────────\n');

  if (!deployer) {
    console.log('Set DEPLOYER_KEY=0x... to deploy.');
    return;
  }

  // Deploy
  console.log('Deploying ZIONDexZISGate...');
  const contract = await factory.deploy();
  console.log(`Tx hash: ${contract.deploymentTransaction()?.hash}`);
  console.log('Waiting for confirmation...');

  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log(`\n✅ ZIONDexZISGate deployed at: ${address}`);
  console.log(`\nUpdate defi-contracts.ts: ZIONDexZISGate: '${address}'`);

  // Post-deploy configuration (optional, if env vars are set)
  const zisRelay = process.env.ZIS_RELAY;
  const zisPublicKey = process.env.ZIS_PUBLIC_KEY;

  if (zisRelay) {
    console.log(`\nSetting ZIS relay to ${zisRelay}...`);
    const tx = await contract.setZisRelay(zisRelay);
    await tx.wait();
    console.log('✅ ZIS relay set');
  }

  if (zisPublicKey) {
    console.log(`\nSetting ZIS public key to ${zisPublicKey}...`);
    const tx = await contract.setZisPublicKey(zisPublicKey);
    await tx.wait();
    console.log('✅ ZIS public key set');
  }

  console.log('\n── Post-deploy checklist ─────────────────────');
  console.log('1. Update defi-contracts.ts with the deployed address');
  console.log('2. Set ZIS relay: gate.setZisRelay(relayAddress)');
  console.log('3. Set ZIS public key: gate.setZisPublicKey(bytes32)');
  console.log('4. (Optional) Enable gate: gate.setGateEnabled(true)');
  console.log('5. Whitelist users: gate.whitelist(user, true)');
  console.log('──────────────────────────────────────────────');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
