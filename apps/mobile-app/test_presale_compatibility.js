/**
 * Test: Mobile App Crypto Compatibility with Presale API
 * ========================================================
 * Verifies that mobile app generates same address as presale API
 * 
 * Test Mnemonic (from presale API):
 * plastic rude toilet offer raccoon melody ostrich weather lecture common dry figure
 * 
 * Expected Address:
 * zion1t2t5r3p697z4v6m4x242l4j7k6w3y470h4d7q7g
 */

const CryptoService = require('./src/services/CryptoService').default;

const TEST_MNEMONIC = 'plastic rude toilet offer raccoon melody ostrich weather lecture common dry figure';
const EXPECTED_ADDRESS = 'zion1t2t5r3p697z4v6m4x242l4j7k6w3y470h4d7q7g';
const TEST_PASSWORD = 'Test1234';

async function testPresaleCompatibility() {
  console.log('🧪 Mobile App Crypto Compatibility Test');
  console.log('='.repeat(60));
  console.log();
  
  try {
    // Test 1: Import presale mnemonic
    console.log('1️⃣ Importing presale mnemonic...');
    console.log(`   Mnemonic: ${TEST_MNEMONIC}`);
    console.log();
    
    const wallet = await CryptoService.importFromMnemonic(
      TEST_MNEMONIC,
      TEST_PASSWORD
    );
    
    console.log(`   ✅ Import successful!`);
    console.log(`   📍 Generated Address: ${wallet.address}`);
    console.log(`   🔑 Public Key: ${wallet.publicKey.substring(0, 32)}...`);
    console.log(`   🔐 Key Type: ${wallet.keyType}`);
    console.log();
    
    // Test 2: Compare with expected address
    console.log('2️⃣ Comparing with presale API address...');
    console.log(`   Expected: ${EXPECTED_ADDRESS}`);
    console.log(`   Generated: ${wallet.address}`);
    console.log();
    
    if (wallet.address === EXPECTED_ADDRESS) {
      console.log('   ✅ MATCH! Addresses are IDENTICAL!');
      console.log('   ✅ Mobile app is COMPATIBLE with presale API');
      console.log();
      console.log('='.repeat(60));
      console.log('✅ TEST PASSED: 100% Compatibility');
      console.log('='.repeat(60));
      return true;
    } else {
      console.log('   ❌ MISMATCH! Addresses are DIFFERENT!');
      console.log('   ❌ Mobile app is NOT compatible with presale API');
      console.log();
      console.log('='.repeat(60));
      console.log('❌ TEST FAILED: Crypto implementation differs');
      console.log('='.repeat(60));
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
    console.log();
    console.log('='.repeat(60));
    console.log('❌ TEST FAILED: Exception occurred');
    console.log('='.repeat(60));
    return false;
  }
}

// Run test
testPresaleCompatibility()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
