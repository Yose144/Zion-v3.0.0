const {ethers} = require('ethers');
const fs = require('fs');

// Read private key from env file
const envContent = fs.readFileSync('/root/zion-validator-key.env', 'utf8');
const keyMatch = envContent.match(/ZION_VALIDATOR_PRIVATE_KEY=(0x[a-fA-F0-9]+)/);
if (!keyMatch) {
  console.error('ERROR: Could not find ZION_VALIDATOR_PRIVATE_KEY in env file');
  process.exit(1);
}
const privateKey = keyMatch[1];

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(privateKey, provider);

console.log('Signer address:', wallet.address);

const wzion = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function bridgeMint(address,uint256,bytes32) external',
  'function processedL1Locks(bytes32) view returns (bool)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
], wallet);

// Also check bridge contract for lock proof details
const bridge = new ethers.Contract('0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88', [
  'function getLockProofStatus(bytes32) view returns (uint8 confirmations, bool executed, bool timelocked, uint256 timelockExpiry, address recipient, uint256 amount)'
], provider);

// 6 large locks (5/5 confirmed, timelock expired, not executed)
const locksToMint = [
  '0x035c761db8a7e9d847ff56a8d8f8d7b37703631fac2b64453fb02fb20a1ef691',
  '0x09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1',
  '0x2cd12d90b10b3ce7218a17dd804d36ad9c8d5870f42e27132c91c33e92f8458e',
  '0x4b43e7a3623ec3d4c007c134bd831a21d6628195643c1d6a33a889324fecfe59',
  '0x6bc2aa3e2879dfb3d98b35b1a09d7abee8fa9e5f3092a464c0679e84d6519ef4',
  '0xd9ddb3c7aaf2ad3a320c2878a1822298ec438240d9a9ffdbca95d256ec637cdb',
];

const recipient = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';

(async () => {
  // Verify signer is the deployer
  if (wallet.address.toLowerCase() !== recipient.toLowerCase()) {
    console.error('ERROR: Signer address does not match expected recipient');
    console.error('Expected:', recipient);
    console.error('Got:', wallet.address);
    process.exit(1);
  }

  // Pre-flight checks
  console.log('\n=== Pre-flight checks ===');
  const balance = await provider.getBalance(wallet.address);
  console.log('ETH balance:', ethers.utils.formatEther(balance), 'ETH');
  if (balance.lt(ethers.utils.parseEther('0.001'))) {
    console.error('WARNING: Low ETH balance for gas');
  }

  const tsBefore = await wzion.totalSupply();
  console.log('wZION totalSupply before:', ethers.utils.formatEther(tsBefore));

  // Verify each lock proof on bridge contract
  let totalToMint = ethers.BigNumber.from(0);
  for (const hash of locksToMint) {
    const status = await bridge.getLockProofStatus(hash);
    const alreadyProcessed = await wzion.processedL1Locks(hash);
    console.log(`\n${hash.substring(0,16)}...`);
    console.log(`  Bridge: confirmations=${status.confirmations} executed=${status.executed} timelocked=${status.timelocked}`);
    console.log(`  Amount: ${ethers.utils.formatEther(status.amount)} wZION`);
    console.log(`  Recipient: ${status.recipient}`);
    console.log(`  wZION processed: ${alreadyProcessed}`);

    if (status.confirmations < 5) {
      console.log(`  SKIP: insufficient confirmations (${status.confirmations}/5)`);
      continue;
    }
    if (alreadyProcessed) {
      console.log(`  SKIP: already processed on wZION`);
      continue;
    }
    if (status.recipient.toLowerCase() !== recipient.toLowerCase()) {
      console.log(`  SKIP: recipient mismatch`);
      continue;
    }
    totalToMint = totalToMint.add(status.amount);
  }

  console.log('\n=== Summary ===');
  console.log('Total to mint:', ethers.utils.formatEther(totalToMint), 'wZION');
  console.log('Total TXs to send:', locksToMint.length);

  // Execute mints
  console.log('\n=== Executing emergency mints ===');
  let minted = ethers.BigNumber.from(0);

  for (const hash of locksToMint) {
    const status = await bridge.getLockProofStatus(hash);
    const alreadyProcessed = await wzion.processedL1Locks(hash);

    if (status.confirmations < 5 || alreadyProcessed) {
      console.log(`SKIP ${hash.substring(0,16)}...`);
      continue;
    }

    const amount = status.amount;
    console.log(`\nMinting ${ethers.utils.formatEther(amount)} wZION for ${hash.substring(0,16)}...`);

    try {
      const tx = await wzion.bridgeMint(recipient, amount, hash, {
        gasLimit: 200000,
        maxPriorityFeePerGas: ethers.utils.parseUnits('0.001', 'gwei'),
        maxFeePerGas: ethers.utils.parseUnits('0.15', 'gwei')
      });
      console.log(`  TX submitted: ${tx.hash}`);
      console.log(`  Waiting for confirmation...`);
      const receipt = await tx.wait(2);
      console.log(`  ✅ CONFIRMED! Block: ${receipt.blockNumber} Gas: ${receipt.gasUsed}`);
      minted = minted.add(amount);
    } catch (e) {
      console.error(`  ❌ FAILED: ${e.message}`);
      if (e.reason) console.error(`  Reason: ${e.reason}`);
    }

    // Wait between TXs to avoid nonce issues
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n=== Final ===');
  console.log('Total minted:', ethers.utils.formatEther(minted), 'wZION');
  const tsAfter = await wzion.totalSupply();
  console.log('wZION totalSupply after:', ethers.utils.formatEther(tsAfter));
  const wzionBal = await wzion.balanceOf(recipient);
  console.log('Deployer wZION balance:', ethers.utils.formatEther(wzionBal));
})();
