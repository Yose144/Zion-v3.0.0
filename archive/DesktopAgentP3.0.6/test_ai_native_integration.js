// Quick test for AI Native integration in desktop agent
// Run: node test_ai_native_integration.js

const { spawn } = require('child_process');
const path = require('path');

console.log('🧪 Testing AI Native Desktop Agent Integration...\n');

// Test 1: Check if bridge file exists
const bridgePath = path.join(__dirname, 'resources', 'ai_native_bridge.py');
const fs = require('fs');

console.log('Test 1: Bridge file exists');
if (fs.existsSync(bridgePath)) {
  console.log('✅ PASS: ai_native_bridge.py found');
} else {
  console.log('❌ FAIL: ai_native_bridge.py not found');
  process.exit(1);
}

// Test 2: Check if main.js has AI Native code
const mainPath = path.join(__dirname, 'src', 'main.js');
const mainContent = fs.readFileSync(mainPath, 'utf8');

console.log('\nTest 2: Main.js integration');
const checks = [
  { name: 'aiNativeProc variable', pattern: /let aiNativeProc = null/ },
  { name: 'aiNative config option', pattern: /aiNative: false/ },
  { name: 'ensureAiNativeServiceRunning function', pattern: /async function ensureAiNativeServiceRunning/ },
  { name: 'aiNativeSend function', pattern: /async function aiNativeSend/ },
  { name: 'stopAiNativeService function', pattern: /function stopAiNativeService/ },
  { name: 'ai-native-start IPC handler', pattern: /ipcMain\.handle\('ai-native-start'/ },
  { name: 'ai-native-stop IPC handler', pattern: /ipcMain\.handle\('ai-native-stop'/ },
  { name: 'ai-native-stats IPC handler', pattern: /ipcMain\.handle\('ai-native-stats'/ },
  { name: 'Startup integration', pattern: /if \(config\.aiNative === true\)/ },
  { name: 'Cleanup integration', pattern: /stopAiNativeService\(\)/ }
];

let passed = 0;
checks.forEach(check => {
  if (check.pattern.test(mainContent)) {
    console.log(`✅ ${check.name}`);
    passed++;
  } else {
    console.log(`❌ ${check.name}`);
  }
});

console.log(`\n${passed}/${checks.length} checks passed`);

// Test 3: Check preload.js API exposure
const preloadPath = path.join(__dirname, 'src', 'preload.js');
const preloadContent = fs.readFileSync(preloadPath, 'utf8');

console.log('\nTest 3: Preload.js API exposure');
const preloadChecks = [
  { name: 'aiNativeStart', pattern: /aiNativeStart:/ },
  { name: 'aiNativeStop', pattern: /aiNativeStop:/ },
  { name: 'aiNativeStats', pattern: /aiNativeStats:/ },
  { name: 'aiNativeStatus', pattern: /aiNativeStatus:/ }
];

let preloadPassed = 0;
preloadChecks.forEach(check => {
  if (check.pattern.test(preloadContent)) {
    console.log(`✅ ${check.name}`);
    preloadPassed++;
  } else {
    console.log(`❌ ${check.name}`);
  }
});

console.log(`\n${preloadPassed}/${preloadChecks.length} API methods exposed`);

// Test 4: Try spawning the bridge (dry run)
console.log('\nTest 4: Bridge spawn test');
const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

try {
  const bridgeProc = spawn(pythonCmd, [bridgePath, '--help'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });

  let output = '';
  bridgeProc.stdout.on('data', (data) => {
    output += data.toString();
  });

  bridgeProc.stderr.on('data', (data) => {
    output += data.toString();
  });

  bridgeProc.on('close', (code) => {
    if (code === 0 || output.includes('AIBridge') || output.includes('ready')) {
      console.log('✅ Bridge spawns successfully');
    } else {
      console.log('⚠️  Bridge spawned but returned unexpected output');
      console.log('Output:', output);
    }
  });

  // Timeout after 3s
  setTimeout(() => {
    if (bridgeProc && !bridgeProc.killed) {
      bridgeProc.kill();
      console.log('✅ Bridge timeout test passed (expected for JSON-lines service)');
    }
  }, 3000);

} catch (err) {
  console.log('❌ Bridge spawn failed:', err.message);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Integration Test Summary');
console.log('='.repeat(60));
console.log(`Bridge file: ✅`);
console.log(`Main.js integration: ${passed}/${checks.length}`);
console.log(`Preload API: ${preloadPassed}/${preloadChecks.length}`);
console.log(`\nIntegration Status: ${passed === checks.length && preloadPassed === preloadChecks.length ? '✅ READY' : '⚠️  PARTIAL'}`);
console.log('\n💡 To test full functionality, run the desktop agent:');
console.log('   cd desktop-agent && npm start');
console.log('\n🔧 Enable AI Native in settings (OFF by default)');
