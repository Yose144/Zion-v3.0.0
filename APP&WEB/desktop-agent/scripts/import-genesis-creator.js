#!/usr/bin/env node
/**
 * Import Genesis Creator wallet into desktop agent
 * Script to import the canonical premine wallet (Slot 11) with 590M ZION
 *
 * Usage: node scripts/import-genesis-creator.js <password>
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const WalletGenerator = require('../src/wallet-generator');

const PASSWORD = process.argv[2];

if (!PASSWORD) {
  console.error('Usage: node scripts/import-genesis-creator.js <password>');
  process.exit(1);
}

// Genesis Creator wallet data (Slot 11)
const GENESIS_CREATOR = {
  secretKeyHex: '60a084869f413466c1bb68aaaaa617990c7a07d30ae64b229e178f8af580c0d3',
  publicKeyHex: '4608c3495ad13f1dbf68bebfbd476aa36bba797bd2da499a652b36bd75915bc5',
  address: 'zion16542q4l853a2z0u5r5w8y4m8k4558847h503736',
  balanceZION: 590_000_000, // 590 million
  purpose: 'Genesis Creator — Lifetime Rent (Slot 11)'
};

console.log('═══════════════════════════════════════════════════════════');
console.log('  Zion Desktop Agent — Genesis Creator Wallet Import');
console.log('═══════════════════════════════════════════════════════════');
console.log('');

try {
  // Step 1: Import wallet from raw secret key
  console.log('[1/4] Importing Genesis Creator wallet...');
  const wallet = WalletGenerator.importPrivateKey(GENESIS_CREATOR.secretKeyHex);

  // Verify address matches
  if (wallet.address !== GENESIS_CREATOR.address) {
    throw new Error(`Address mismatch! Expected ${GENESIS_CREATOR.address}, got ${wallet.address}`);
  }
  console.log('  ✅ Address verified:', wallet.address);
  console.log('  ✅ Public key verified:', wallet.publicKey.substring(0, 20) + '...');
  console.log('');

  // Step 2: Encrypt private key
  console.log('[2/4] Encrypting private key with password...');
  const encrypted = WalletGenerator.encryptPrivateKey(wallet.privateKey, PASSWORD);
  console.log('  ✅ Private key encrypted');

  // No mnemonic for premine wallet
  const encryptedMnemonic = null;
  console.log('  ℹ️  No mnemonic (premine wallet)');
  console.log('');

  // Step 3: Save wallet file
  console.log('[3/4] Saving wallet file...');

  // Determine USER_DATA_PATH (same as main.js)
  let USER_DATA_PATH;
  if (process.env.ZION_USER_DATA) {
    USER_DATA_PATH = process.env.ZION_USER_DATA;
  } else {
    // Electron standard userData path
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? os.homedir() + '/Library/Application Support' : os.homedir() + '/.config');
    USER_DATA_PATH = path.join(appData, 'Zion Desktop Agent');
  }

  const WALLETS_PATH = path.join(USER_DATA_PATH, 'wallets');

  // Create wallets directory if it doesn't exist
  if (!fs.existsSync(WALLETS_PATH)) {
    fs.mkdirSync(WALLETS_PATH, { recursive: true });
  }

  // Build wallet data object
  const walletData = {
    version: '2.9.6',
    name: 'Genesis Creator (590M ZION)',
    address: wallet.address,
    publicKey: wallet.publicKey,
    encryptedPrivateKey: encrypted,
    encryptedMnemonic: encryptedMnemonic, // null for premine wallet
    createdAt: wallet.importedAt,
    lastUsed: new Date().toISOString(),
    imported: true,
    walletType: 'premine',
    balanceZION: GENESIS_CREATOR.balanceZION,
    notes: GENESIS_CREATOR.purpose
  };

  // Save to file (filename = address prefix)
  const filename = `${wallet.address.substring(0, 15)}.json`;
  const filePath = path.join(WALLETS_PATH, filename);
  fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));

  console.log('  ✅ Saved to:', filePath);
  console.log('  📂 Filename:', filename);
  console.log('');

  // Step 4: Update config
  console.log('[4/4] Updating config...');
  const CONFIG_PATH = path.join(USER_DATA_PATH, 'config.json');
  let config = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.log('  ⚠️  Config file corrupted, creating new one');
    }
  }

  config.wallet = wallet.address;
  config.lastUpdated = new Date().toISOString();

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('  ✅ Config updated with wallet address');
  console.log('');

  // Success summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  ✅ SUCCESS — Genesis Creator wallet imported!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('  Wallet Address:', wallet.address);
  console.log('  Balance:       ', GENESIS_CREATOR.balanceZION.toLocaleString(), 'ZION');
  console.log('  Private Key:   Encrypted with provided password');
  console.log('  Wallet File:   ', filePath);
  console.log('  Config:        ', CONFIG_PATH);
  console.log('');
  console.log('  Next steps:');
  console.log('  1. Launch desktop agent: npm run dev:wallet');
  console.log('  2. Wallet should appear automatically');
  console.log('  3. Verify balance via RPC:');
  console.log('     node -e "const net=require(\'net\'); const s=net.connect(8443,\'77.42.71.94\',()=>{s.write(JSON.stringify({jsonrpc:\'2.0\',id:1,method:\'getBalance\',params:{address:\'' + wallet.address + '\'}})+\'\\n\');}); s.on(\'data\',c=>{console.log(c.toString()); s.end();});"');
  console.log('');

} catch (error) {
  console.error('');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('  ❌ IMPORT FAILED');
  console.error('═══════════════════════════════════════════════════════════');
  console.error('');
  console.error('Error:', error.message);
  process.exit(1);
}
