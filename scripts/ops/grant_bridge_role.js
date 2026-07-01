const {ethers} = require('ethers');
const fs = require('fs');

// Read private key from env file
const envContent = fs.readFileSync('/root/zion-validator-key.env', 'utf8');
const keyMatch = envContent.match(/ZION_VALIDATOR_PRIVATE_KEY=(0x[a-fA-F0-9]+)/);
const privateKey = keyMatch[1];

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wallet = new ethers.Wallet(privateKey, provider);

const wzion = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function grantRole(bytes32,address) external',
  'function hasRole(bytes32,address) view returns (bool)',
  'function BRIDGE_ROLE() view returns (bytes32)'
], wallet);

const bridgeContract = '0x89504D6eD6993d726438E1A9C18aaC79e8d0eF88';

(async () => {
  const BRIDGE_ROLE = await wzion.BRIDGE_ROLE();
  const hasRole = await wzion.hasRole(BRIDGE_ROLE, bridgeContract);
  console.log('Bridge has BRIDGE_ROLE before:', hasRole);

  if (!hasRole) {
    console.log('Granting BRIDGE_ROLE to bridge contract...');
    const tx = await wzion.grantRole(BRIDGE_ROLE, bridgeContract, {
      gasLimit: 100000,
      maxPriorityFeePerGas: ethers.utils.parseUnits('0.01', 'gwei'),
      maxFeePerGas: ethers.utils.parseUnits('0.5', 'gwei')
    });
    console.log('TX submitted:', tx.hash);
    const receipt = await tx.wait(2);
    console.log('CONFIRMED! Block:', receipt.blockNumber, 'Gas:', receipt.gasUsed);

    const hasRoleAfter = await wzion.hasRole(BRIDGE_ROLE, bridgeContract);
    console.log('Bridge has BRIDGE_ROLE after:', hasRoleAfter);
  } else {
    console.log('Already has BRIDGE_ROLE, skipping');
  }
})();
