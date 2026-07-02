const {ethers} = require('ethers');

const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
const wzion = new ethers.Contract('0x0c493763d107ab0ABb0aee1Ca3999292d8202bb6', [
  'function hasRole(bytes32,address) view returns (bool)',
  'function DEFAULT_ADMIN_ROLE() view returns (bytes32)',
  'function BRIDGE_ROLE() view returns (bytes32)',
  'function GUARDIAN_ROLE() view returns (bytes32)',
  'function totalSupply() view returns (uint256)',
  'function totalBridgeMinted() view returns (uint256)',
  'function grantRole(bytes32,address) external',
  'function bridgeMint(address,uint256,bytes32) external',
  'function processedL1Locks(bytes32) view returns (bool)'
], provider);

(async () => {
  const ADMIN = await wzion.DEFAULT_ADMIN_ROLE();
  const BRIDGE = await wzion.BRIDGE_ROLE();
  const GUARDIAN = await wzion.GUARDIAN_ROLE();

  console.log('DEFAULT_ADMIN_ROLE:', ADMIN);
  console.log('BRIDGE_ROLE:', BRIDGE);
  console.log('GUARDIAN_ROLE:', GUARDIAN);

  const deployer = '0xdde17506BC2D2dCE1d594bD1D85B0BAbb389D186';
  // 2026-07-02: live Base ZIONBridge with wZION BRIDGE_ROLE is 0x72c8f0Dc...
  const bridge = '0x72c8f0Dc60E27aB7A83fe3B416fab4F0600a6467';

  console.log('\n=== Role assignments ===');
  console.log('Deployer has ADMIN:', await wzion.hasRole(ADMIN, deployer));
  console.log('Deployer has BRIDGE:', await wzion.hasRole(BRIDGE, deployer));
  console.log('Deployer has GUARDIAN:', await wzion.hasRole(GUARDIAN, deployer));
  console.log('Bridge contract has BRIDGE:', await wzion.hasRole(BRIDGE, bridge));

  const ts = await wzion.totalSupply();
  console.log('\nwZION totalSupply:', ethers.utils.formatEther(ts));
  const tbm = await wzion.totalBridgeMinted();
  console.log('totalBridgeMinted:', ethers.utils.formatEther(tbm));

  // Check if any of the 6 L1 lock hashes are already processed
  const lockHashes = [
    '0x035c761db8a7e9d847ff56a8d8f8d7b37703631fac2b64453fb02fb20a1ef691',
    '0x09fc9abb00c5b95e797709259731313afca5e0cc4a14f6687351e9295c1c6bc1',
    '0x2cd12d90b10b3ce7218a17dd804d36ad9c8d5870f42e27132c91c33e92f8458e',
    '0x4b43e7a3623ec3d4c007c134bd831a21d6628195643c1d6a33a889324fecfe59',
    '0x6bc2aa3e2879dfb3d98b35b1a09d7abee8fa9e5f3092a464c0679e84d6519ef4',
    '0xd9ddb3c7aaf2ad3a320c2878a1822298ec438240d9a9ffdbca95d256ec637cdb',
  ];

  console.log('\n=== processedL1Locks check ===');
  for (const h of lockHashes) {
    const processed = await wzion.processedL1Locks(h);
    console.log(`${h.substring(0,16)}...: ${processed ? 'ALREADY PROCESSED' : 'not processed'}`);
  }
})();
