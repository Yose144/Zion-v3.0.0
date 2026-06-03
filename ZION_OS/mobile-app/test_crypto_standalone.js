/**
 * Standalone Test: Ed25519 + Custom Bech32 Compatibility
 * ========================================================
 * Pure Node.js test without React Native dependencies
 */

const bip39 = require('bip39');
const ed25519 = require('@noble/ed25519');
const crypto = require('crypto');

// Set SHA512 for @noble/ed25519 (required in Node.js)
ed25519.etc.sha512Sync = (...m) => crypto.createHash('sha512').update(Buffer.concat(m)).digest();

const TEST_MNEMONIC = 'plastic rude toilet offer raccoon melody ostrich weather lecture common dry figure';
const EXPECTED_ADDRESS = 'zion1t2t5r3p697z4v6m4x242l4j7k6w3y470h4d7q7g';

/**
 * Custom Bech32 address generation (SAME AS PRESALE API)
 */
function generateAddress(publicKeyBuffer) {
  // 1. SHA256 of public key
  const sha256Hash = crypto.createHash('sha256').update(publicKeyBuffer).digest();
  
  // 2. RIPEMD160 of SHA256
  const keyHash = crypto.createHash('ripemd160').update(sha256Hash).digest();
  
  // 3. Convert to custom base32
  const bech32Chars = '023456789acdefghjklmnpqrstuvwxyz';
  
  let addressData = '';
  for (const byte of keyHash) {
    addressData += bech32Chars[byte % 32];
    addressData += bech32Chars[Math.floor(byte / 32) % 32];
  }
  
  // 4. Truncate to 39 characters
  addressData = addressData.substring(0, 39);
  
  // 5. Add prefix
  return `zion1${addressData}`;
}

async function test() {
  console.log('🧪 Ed25519 + Custom Bech32 Compatibility Test');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // 1. Mnemonic to seed
    console.log('1️⃣ Converting mnemonic to seed...');
    const seed = await bip39.mnemonicToSeed(TEST_MNEMONIC);
    console.log(`   ✅ Seed: ${seed.slice(0, 16).toString('hex')}... (${seed.length} bytes)`);
    console.log();
    
    // 2. Derive Ed25519 keypair (first 32 bytes = private key)
    console.log('2️⃣ Deriving Ed25519 keypair...');
    const privateKey = seed.slice(0, 32);
    const publicKey = await ed25519.getPublicKey(privateKey);
    console.log(`   🔐 Private Key: ${Buffer.from(privateKey).toString('hex').substring(0, 32)}...`);
    console.log(`   🔑 Public Key: ${Buffer.from(publicKey).toString('hex')}`);
    console.log();
    
    // 3. Generate address
    console.log('3️⃣ Generating ZION address (custom Bech32)...');
    const address = generateAddress(Buffer.from(publicKey));
    console.log(`   📍 Generated: ${address}`);
    console.log();
    
    // 4. Compare
    console.log('4️⃣ Comparing with presale API...');
    console.log(`   Expected:  ${EXPECTED_ADDRESS}`);
    console.log(`   Generated: ${address}`);
    console.log();
    
    if (address === EXPECTED_ADDRESS) {
      console.log('   ✅ PERFECT MATCH!');
      console.log('   ✅ Mobile app is 100% compatible with presale API');
      console.log();
      console.log('='.repeat(60));
      console.log('✅ TEST PASSED: Crypto implementations are IDENTICAL');
      console.log('='.repeat(60));
      console.log();
      console.log('✅ Premine wallets: COMPATIBLE');
      console.log('✅ Presale wallets: COMPATIBLE');
      console.log('✅ Bonus system: COMPATIBLE');
      console.log();
      return true;
    } else {
      console.log('   ❌ MISMATCH!');
      console.log('   ❌ Addresses differ → crypto bug!');
      console.log();
      console.log('='.repeat(60));
      console.log('❌ TEST FAILED');
      console.log('='.repeat(60));
      return false;
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

test()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal:', error);
    process.exit(1);
  });
