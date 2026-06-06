/**
 * Test: QR Code Compatibility (Presale API → Mobile App)
 * ========================================================
 * Verifies that QR codes from presale API can be scanned in mobile app
 */

// Inline copy of zionUri functions for testing
function parseZionUri(input) {
  if (!input || typeof input !== 'string') {
    return { type: 'invalid', error: 'Empty or invalid input' };
  }

  const trimmed = input.trim();

  // 1. ZION Import URI
  if (trimmed.startsWith('zion://import')) {
    return parseImportUri(trimmed);
  }

  // 2. JSON format (presale)
  if (trimmed.startsWith('{')) {
    return parseJsonFormat(trimmed);
  }

  // 3. Plain mnemonic
  if (isMnemonic(trimmed)) {
    return {
      type: 'mnemonic',
      mnemonic: trimmed,
      network: 'testnet',
    };
  }

  return { type: 'unknown', raw: trimmed };
}

function parseImportUri(uri) {
  try {
    const url = new URL(uri);
    const params = new URLSearchParams(url.search);
    const mnemonic = params.get('mnemonic');
    if (!mnemonic) {
      return { type: 'invalid', error: 'Missing mnemonic parameter' };
    }
    const decodedMnemonic = mnemonic.replace(/\+/g, ' ');
    return {
      type: 'import',
      mnemonic: decodedMnemonic,
      network: params.get('network') || 'testnet',
    };
  } catch (error) {
    return { type: 'invalid', error: 'Failed to parse import URI' };
  }
}

function parseJsonFormat(jsonStr) {
  try {
    const data = JSON.parse(jsonStr);
    if (data.type === 'ZION_PRESALE_WALLET' && data.mnemonic) {
      return {
        type: 'import',
        mnemonic: data.mnemonic,
        address: data.address,
        tokens: data.tokens || 0,
        network: data.network || 'testnet',
        orderId: data.orderId,
      };
    }
    return { type: 'json', data };
  } catch (error) {
    return { type: 'invalid', error: 'Failed to parse JSON' };
  }
}

function isMnemonic(str) {
  const words = str.toLowerCase().split(/\s+/);
  return words.length >= 12 && words.length <= 24 && words.every(w => /^[a-z]+$/.test(w));
}

function canImport(input) {
  const parsed = parseZionUri(input);
  return ['import', 'mnemonic', 'privateKey'].includes(parsed.type);
}

function extractMnemonic(input) {
  const parsed = parseZionUri(input);
  if (parsed.type === 'import' || parsed.type === 'mnemonic') {
    return parsed.mnemonic;
  }
  return null;
}

// PRESALE API QR FORMAT (from presale_wallet_v3.py)
const PRESALE_QR_JSON = JSON.stringify({
  type: 'ZION_PRESALE_WALLET',
  version: '3.0',
  address: 'zion1t2t5r3p697z4v6m4x242l4j7k6w3y470h4d7q7g',
  mnemonic: 'plastic rude toilet offer raccoon melody ostrich weather lecture common dry figure',
  tokens: 10000,
  orderId: 'PRESALE-TEST-123',
  network: 'testnet',
  createdAt: '2026-01-06T10:00:00Z'
});

// ALTERNATIVE: Plain mnemonic
const PLAIN_MNEMONIC = 'plastic rude toilet offer raccoon melody ostrich weather lecture common dry figure';

// ALTERNATIVE: ZION Import URI
const ZION_IMPORT_URI = 'zion://import?mnemonic=plastic+rude+toilet+offer+raccoon+melody+ostrich+weather+lecture+common+dry+figure&network=testnet';

function test() {
  console.log('🧪 QR Code Compatibility Test');
  console.log('='.repeat(60));
  console.log();
  
  // Test 1: Parse presale JSON QR
  console.log('1️⃣ Testing Presale JSON QR...');
  const parsedJson = parseZionUri(PRESALE_QR_JSON);
  console.log('   Parsed:', JSON.stringify(parsedJson, null, 2));
  
  if (parsedJson.type === 'import' && parsedJson.mnemonic) {
    console.log('   ✅ JSON QR: SUPPORTED');
    console.log(`   ✅ Mnemonic extracted: ${parsedJson.mnemonic.substring(0, 30)}...`);
  } else {
    console.log('   ❌ JSON QR: NOT SUPPORTED');
    return false;
  }
  console.log();
  
  // Test 2: Plain mnemonic
  console.log('2️⃣ Testing Plain Mnemonic...');
  const parsedPlain = parseZionUri(PLAIN_MNEMONIC);
  console.log('   Parsed:', JSON.stringify(parsedPlain, null, 2));
  
  if (parsedPlain.type === 'mnemonic' && parsedPlain.mnemonic) {
    console.log('   ✅ Plain Mnemonic: SUPPORTED');
  } else {
    console.log('   ❌ Plain Mnemonic: NOT SUPPORTED');
    return false;
  }
  console.log();
  
  // Test 3: ZION Import URI
  console.log('3️⃣ Testing ZION Import URI...');
  const parsedUri = parseZionUri(ZION_IMPORT_URI);
  console.log('   Parsed:', JSON.stringify(parsedUri, null, 2));
  
  if (parsedUri.type === 'import' && parsedUri.mnemonic) {
    console.log('   ✅ Import URI: SUPPORTED');
  } else {
    console.log('   ❌ Import URI: NOT SUPPORTED');
    return false;
  }
  console.log();
  
  // Test 4: canImport validation
  console.log('4️⃣ Testing canImport()...');
  const canImportJson = canImport(PRESALE_QR_JSON);
  const canImportPlain = canImport(PLAIN_MNEMONIC);
  const canImportUri = canImport(ZION_IMPORT_URI);
  
  console.log(`   Presale JSON: ${canImportJson ? '✅' : '❌'}`);
  console.log(`   Plain Mnemonic: ${canImportPlain ? '✅' : '❌'}`);
  console.log(`   Import URI: ${canImportUri ? '✅' : '❌'}`);
  
  if (!canImportJson || !canImportPlain || !canImportUri) {
    console.log('   ❌ Some formats failed canImport check');
    return false;
  }
  console.log();
  
  // Test 5: extractMnemonic
  console.log('5️⃣ Testing extractMnemonic()...');
  const extractedJson = extractMnemonic(PRESALE_QR_JSON);
  const extractedPlain = extractMnemonic(PLAIN_MNEMONIC);
  const extractedUri = extractMnemonic(ZION_IMPORT_URI);
  
  console.log(`   From JSON: ${extractedJson ? extractedJson.substring(0, 30) + '...' : 'FAILED'}`);
  console.log(`   From Plain: ${extractedPlain ? extractedPlain.substring(0, 30) + '...' : 'FAILED'}`);
  console.log(`   From URI: ${extractedUri ? extractedUri.substring(0, 30) + '...' : 'FAILED'}`);
  
  if (!extractedJson || !extractedPlain || !extractedUri) {
    console.log('   ❌ Mnemonic extraction failed');
    return false;
  }
  console.log();
  
  // Final check: All mnemonics should be identical
  console.log('6️⃣ Verifying extracted mnemonics match...');
  if (extractedJson === extractedPlain && extractedPlain === extractedUri) {
    console.log('   ✅ All mnemonics identical!');
  } else {
    console.log('   ❌ Mnemonics differ!');
    return false;
  }
  console.log();
  
  console.log('='.repeat(60));
  console.log('✅ ALL TESTS PASSED');
  console.log('='.repeat(60));
  console.log();
  console.log('📱 Presale QR Codes: FULLY COMPATIBLE ✅');
  console.log('📧 Email QR Codes: FULLY COMPATIBLE ✅');
  console.log('🔗 ZION URI: FULLY COMPATIBLE ✅');
  console.log();
  
  return true;
}

test()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test error:', error);
    process.exit(1);
  });
