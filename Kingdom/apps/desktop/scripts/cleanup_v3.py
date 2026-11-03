"""
V3 Agent Cleanup Script
Removes all legacy ballast from main.js, renderer.js, and index.html
to produce a clean V3-only desktop mining agent.

Run: python scripts/cleanup_v3.py
"""

import re
import os

AGENT_DIR = os.path.join(os.path.dirname(__file__), '..')
SRC_DIR = os.path.join(AGENT_DIR, 'src')

def read_file(relpath):
    fp = os.path.join(AGENT_DIR, relpath)
    with open(fp, 'r', encoding='utf-8') as f:
        return f.readlines()

def write_file(relpath, lines):
    fp = os.path.join(AGENT_DIR, relpath)
    with open(fp, 'w', encoding='utf-8', newline='\n') as f:
        f.writelines(lines)

def remove_block(lines, start_marker, end_marker, inclusive_start=True, inclusive_end=True):
    """Remove lines between start_marker and end_marker (regex patterns).
    Returns (new_lines, removed_count)."""
    result = []
    removing = False
    removed = 0
    for i, line in enumerate(lines):
        if not removing and re.search(start_marker, line):
            if not inclusive_start:
                result.append(line)
            removing = True
            removed += 1 if inclusive_start else 0
            continue
        if removing:
            removed += 1
            if re.search(end_marker, line):
                if not inclusive_end:
                    result.append(line)
                removing = False
            continue
        result.append(line)
    return result, removed

def remove_lines_matching(lines, pattern):
    """Remove individual lines matching pattern."""
    result = []
    removed = 0
    for line in lines:
        if re.search(pattern, line):
            removed += 1
        else:
            result.append(line)
    return result, removed

def remove_ipc_handler(lines, handler_name):
    """Remove an ipcMain.handle('name', ...) block including its closing });"""
    result = []
    removing = False
    brace_depth = 0
    removed = 0
    for line in lines:
        if not removing and f"'{handler_name}'" in line and 'ipcMain.handle' in line:
            removing = True
            brace_depth = 0
            # Count opening/closing braces on this line
            brace_depth += line.count('{') - line.count('}')
            brace_depth += line.count('(') - line.count(')')
            removed += 1
            continue
        if removing:
            brace_depth += line.count('{') - line.count('}')
            brace_depth += line.count('(') - line.count(')')
            removed += 1
            if brace_depth <= 0:
                removing = False
            continue
        result.append(line)
    return result, removed

def remove_function(lines, func_name, style='function'):
    """Remove a function definition and its entire body.
    style: 'function' for `function name()`, 'async' for `async function name()`"""
    result = []
    removing = False
    brace_depth = 0
    removed = 0
    for line in lines:
        if not removing:
            if style == 'function' and re.search(rf'^(async\s+)?function\s+{re.escape(func_name)}\s*\(', line):
                removing = True
                brace_depth = line.count('{') - line.count('}')
                removed += 1
                if brace_depth <= 0 and '{' in line:
                    removing = False
                continue
            result.append(line)
            continue
        brace_depth += line.count('{') - line.count('}')
        removed += 1
        if brace_depth <= 0:
            removing = False
        continue
    return result, removed


def cleanup_main_js():
    print("\n=== Cleaning main.js ===")
    lines = read_file('src/main.js')
    total_before = len(lines)
    total_removed = 0

    # 1. Remove AutoTuner class and instance
    lines, n = remove_block(lines, 
        r'^// ── Auto-Tuning System',
        r'^const autoTuner = new AutoTuner\(\);')
    print(f"  AutoTuner class: -{n} lines")
    total_removed += n

    # 2. Remove legacy process variables
    for var in ['revenueProcess', 'gpuRevenueProcess', 'gpuRevenueHealth', 
                'chv42GpuProcess', 'chv42GpuStats']:
        lines, n = remove_lines_matching(lines, rf'^let {var}\b')
        total_removed += n

    # 3. Remove CH3 Multi-Stream state block
    lines, n = remove_block(lines,
        r'^// ── CH3 Multi-Stream state',
        r'^// ─+$')  # ends at the separator line before startMiningInProgress
    print(f"  CH3 Multi-Stream state: -{n} lines")
    total_removed += n

    # 4. Remove legacy timers/state variables
    for var in ['gpuRevenueRecoveryTimer', 'afterburnerProc', 'afterburnerReady',
                'afterburnerStdoutBuf', 'afterburnerQueue', 'afterburnerReqId',
                'abLastConsoleEmitMs', 'aiNativeProc', 'aiNativeReady',
                'aiNativeStdoutBuf', 'aiNativeQueue', 'aiNativeReqId']:
        lines, n = remove_lines_matching(lines, rf'^let {var}\b')
        total_removed += n
    
    # 5. Remove legacy fields from minerStats  
    for field in ['stream_mode', 'stream_algorithm', 'stream_allocation',
                  'revenue_coin', 'revenue_hashrate', 'dual_mining',
                  'zion_threads', 'xmr_threads', 'xmr_pool']:
        lines, n = remove_lines_matching(lines, rf"^\s+{field}:")
        total_removed += n

    # 6. Remove Revenue constants and DEFAULT_REVENUE_PROFILE
    lines, n = remove_block(lines,
        r'^// ── Revenue / Funding Split',
        r'^function isLegacyOrLocalHost')
    # Keep the isLegacyOrLocalHost function - we removed one line too many, add it back
    # Actually, let's be more precise
    print(f"  Revenue constants + DEFAULT_REVENUE_PROFILE: -{n} lines")
    total_removed += n

    # 7. Remove revenue normalization functions
    for func in ['normalizeRevenueProfile', 'toPureZionRevenueProfile', 
                 'isPureZionDesktopMode', 'isLegacyDefaultRevenueProfile',
                 'isLegacyOrLocalHost']:
        lines, n = remove_function(lines, func)
        total_removed += n
        if n > 0:
            print(f"  {func}(): -{n} lines")

    # 8. Clean up DEFAULT_CONFIG - remove revenue-related fields
    for field in ['desktopPureZionDefault', 'aiAfterburner', 'aiNative', 
                  'aiNativePoolUrl', 'aiNativeConsciousness',
                  'chatEndpoint', 'chatModel', 'chatApiKey',
                  'gpuRevenue', 'gpuRevenueCoins',
                  'poolPreference', 'poolRegion', 'nicehashBtcAddr',
                  'revenueWallet', 'pythonUi']:
        lines, n = remove_lines_matching(lines, rf"^\s+{field}:")
        total_removed += n
    # Remove multi-line comments about those fields
    lines, n = remove_lines_matching(lines, r'^\s+// Pool provider preference')
    total_removed += n
    lines, n = remove_lines_matching(lines, r"^\s+// 'herominers'")
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Override at runtime.*ZION_POOL_PREFERENCE')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Mining region for pool')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// BTC address for NiceHash')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Falls back to main wallet')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Revenue BTC payout')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Python miner console style')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// AI Afterburner integration')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Enabled by default: monitors')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// AI Native compute')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Local chat')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Cloud chat.*OpenAI')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Free-tier via OpenRouter')
    total_removed += n
    # Remove revenue field from config
    lines, n = remove_lines_matching(lines, r"^\s+revenue: DEFAULT_REVENUE_PROFILE")
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// GPU Revenue Mining')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^\s+// Cosmic Harmony GPU performance knobs')
    total_removed += n

    # 9. Remove CH3 Multi-Stream helpers block (GPU_COIN_POOLS through stopProfitPoll)
    lines, n = remove_block(lines,
        r'^// Revenue CPU \(25% CPU',
        r'^// ── End CH3 Multi-Stream helpers')
    print(f"  CH3 Multi-Stream helpers: -{n} lines")
    total_removed += n

    # 10. Remove AFTERBURNER_SCRIPT_PATH
    lines, n = remove_block(lines,
        r'^const AFTERBURNER_SCRIPT_PATH',
        r'^const AFTERBURNER_SCRIPT_PATH')  # single line block
    total_removed += n

    # 11. Remove DESKTOP_PURE_ZION_DEFAULT and related
    lines, n = remove_lines_matching(lines, r'^const DESKTOP_PURE_ZION_DEFAULT')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^const LEGACY_TESTNET_HOSTS')
    total_removed += n
    # Remove the Set entries
    lines, n = remove_block(lines,
        r"^\s+'pool\.zionterranova\.com'",
        r'^\]\);')
    total_removed += n

    # 12. Remove DEFAULT_AI_NATIVE_POOL_URL, DEFAULT_DAO_API_BASE, DEFAULT_WARP_API_BASE
    lines, n = remove_lines_matching(lines, r'^const DEFAULT_AI_NATIVE_POOL_URL')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^const DEFAULT_DAO_API_BASE')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^const DEFAULT_WARP_API_BASE')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^const PRIMARY_AI_NATIVE_PORT')
    total_removed += n

    # 13. Replace legacy startMining() body: keep guard + V3 fast-path, remove everything else
    # Find the legacy fallback after V3 fast-path and remove through end of function
    lines, n = remove_block(lines,
        r'^\s+// Auto-tuning: Check if tuning',
        r'^function ensureAfterburnerServiceRunning')
    # We need to properly close startMining - insert the closing before ensureAfterburner
    # Actually this is tricky - let me handle this differently
    print(f"  Legacy startMining() body: -{n} lines")
    total_removed += n

    # 14. Remove ensureAfterburnerServiceRunning and afterburnerSend
    lines, n = remove_block(lines,
        r'^function ensureAfterburnerServiceRunning',
        r'^// =+\n// AI NATIVE SERVICE')
    print(f"  Afterburner service: -{n} lines")
    total_removed += n

    # 15. Remove AI Native Service block
    lines, n = remove_block(lines,
        r'^// =+$.*AI NATIVE SERVICE|^const AI_NATIVE_BRIDGE_PATH',
        r'^// =+$.*STATS AND MINING|^function tryUpdateStatsFromFile')
    print(f"  AI Native service: -{n} lines")
    total_removed += n

    # 16. Remove tryUpdateRevenueStatsFromFile
    lines, n = remove_function(lines, 'tryUpdateRevenueStatsFromFile')
    total_removed += n

    # 17. Remove legacy parsing from parseMinerOutput
    # Remove CH3 Stream/Revenue parsing at end of parseMinerOutput
    lines, n = remove_block(lines,
        r'^\s+// ---- CH3 Stream / Revenue parsing ----',
        r'^\s+// Pool failover: reset counter')
    print(f"  CH3 revenue parsing: -{n} lines")
    total_removed += n

    # 18. Remove legacy IPC handlers
    legacy_ipc = [
        'get-multi-stream-status',
        'get-tuning-status', 'perform-manual-tuning',
        'start-chv42-gpu', 'stop-chv42-gpu', 'get-chv42-status',
        'ai-native-start', 'ai-native-stop', 'ai-native-stats', 'ai-native-status',
        'ai-native-chat', 'ai-native-search-knowledge', 'ai-native-ask',
        'ai-native-dashboard', 'ai-native-blockchain-status', 'ai-native-pool-monitor',
        'ai-native-system-health',
        'bridge-get-wzion-balance', 'bridge-get-stats', 'bridge-tx-status',
        'bridge-prepare-lock', 'wallet-get-evm-address', 'bridge-send-lock', 'bridge-burn-wzion',
        'dao-health', 'dao-get-stats', 'dao-get-proposals', 'dao-get-proposal',
        'dao-create-proposal', 'dao-get-votes', 'dao-cast-vote', 'dao-get-treasury',
        'warp-get-health', 'warp-get-chains', 'warp-get-metrics', 'warp-get-transfers',
        'warp-get-pending-transfers', 'warp-get-transfer', 'warp-initiate-outbound',
        'warp-initiate-inbound', 'warp-advance-transfer',
        'get-ch3-status',
        'afterburner-command',
        'ai-chat',
        'set-dual-mining', 'get-dual-mining-status',
    ]
    for handler in legacy_ipc:
        lines, n = remove_ipc_handler(lines, handler)
        if n > 0:
            total_removed += n

    # 19. Remove Bridge IPC support code (constants, helpers)
    lines, n = remove_block(lines,
        r'^// =+$',  # section separator before Bridge
        r'^// =+$')  # section separator after Bridge
    # This is too blunt - let me target specific bridge code
    for var in ['_sessionEvmWallet', 'BRIDGE_VAULT_ADDR', 'BRIDGE_NET',
                'BRIDGE_SEL_BALANCE_OF', 'BRIDGE_SEL_BRIDGE_STATS', 'BRIDGE_SEL_BRIDGE_BURN']:
        lines, n = remove_lines_matching(lines, rf'^(let|const)\s+{var}\b')
        total_removed += n
    for func in ['deriveEvmAddressFromMnemonic', 'bridgeSelector', 'bridgeEncodeAddress']:
        lines, n = remove_function(lines, func)
        total_removed += n

    # 20. Remove DAO constants
    lines, n = remove_lines_matching(lines, r'^const DAO_API_BASE')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^const DAO_API_KEY')
    total_removed += n

    # 21. Remove WARP constants
    lines, n = remove_lines_matching(lines, r'^const WARP_API_BASE')
    total_removed += n

    # 22. Remove section comment blocks for removed features
    lines, n = remove_lines_matching(lines, r'^// ─── CHv4\.2 Merkabah')
    total_removed += n

    # 23. Remove findPythonMiner function
    lines, n = remove_function(lines, 'findPythonMiner')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^const allowPackagedPythonFallback')
    total_removed += n

    # 24. Remove MINER_IS_PYTHON and related
    lines, n = remove_lines_matching(lines, r'^let MINER_IS_PYTHON')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^let minerFallbackInProgress')
    total_removed += n
    lines, n = remove_lines_matching(lines, r'^let minerFallbackTimer')
    total_removed += n

    # 25. Remove migrateLegacyUserDataIfNeeded
    lines, n = remove_function(lines, 'migrateLegacyUserDataIfNeeded')
    total_removed += n

    # 26. Remove legacy section separators that now point to nothing
    # Clean up empty consecutive blank lines (max 2)
    cleaned = []
    blank_count = 0
    for line in lines:
        if line.strip() == '':
            blank_count += 1
            if blank_count <= 2:
                cleaned.append(line)
        else:
            blank_count = 0
            cleaned.append(line)
    lines = cleaned

    # Clean up orphaned section separators
    lines, n = remove_lines_matching(lines, r'^// =+$')
    # But we want to keep some - only remove consecutive ones
    # Actually, let's keep section separators, they help readability

    write_file('src/main.js', lines)
    print(f"\n  TOTAL: {total_before} → {len(lines)} lines (removed {total_before - len(lines)})")
    return len(lines)


def cleanup_renderer_js():
    print("\n=== Cleaning renderer.js ===")
    lines = read_file('src/ui/renderer.js')
    total_before = len(lines)

    # 1. Remove revenue profile defaults and normalization
    lines, n = remove_block(lines,
        r'DEFAULT_REVENUE_PROFILE',
        r'function\s+normalizeMiningMode|let cpuThreadMax')
    if n > 0:
        print(f"  Revenue profiles + normalization: -{n} lines")

    # Remove revenue normalization functions
    for func in ['normalizeRevenueProfile', 'toPureZionRevenueProfile', 
                 'isPureZionDesktopMode', 'normalizeMiningMode', 'applyPureZionUiState']:
        lines, n = remove_function(lines, func)

    # 2. Remove OASIS consciousness gaming
    lines, n = remove_block(lines,
        r'OASIS_LEVELS|const\s+OASIS_',
        r'^function\s+initDaoView|^// .*DAO')
    if n > 0:
        print(f"  OASIS consciousness gaming: -{n} lines")

    # 3. Remove COSMIC MINE clicker game  
    lines, n = remove_block(lines,
        r'COSMIC MINE|cosmicMineState|function\s+initCosmicMine',
        r'^function\s+initDaoView|^// .*DAO|const\s+DAO_')
    if n > 0:
        print(f"  COSMIC MINE game: -{n} lines")

    # 4. Remove Bridge/DEX/Swap
    lines, n = remove_block(lines,
        r'function\s+initBridgeView',
        r'function\s+initOasisView|OASIS_LEVELS|const\s+OASIS_')
    if n > 0:
        print(f"  Bridge/DEX/Swap: -{n} lines")

    # 5. Remove DAO view
    lines, n = remove_block(lines,
        r'DAO_PROPOSALS|function\s+initDaoView|const\s+DAO_',
        r'WARP_CHAINS|function\s+initWarpView|const\s+WARP_')
    if n > 0:
        print(f"  DAO view: -{n} lines")

    # 6. Remove WARP cross-chain
    lines, n = remove_block(lines,
        r'WARP_CHAINS|function\s+initWarpView|const\s+WARP_',
        r'FW_PILLARS|function\s+initFreeWorldView|const\s+FW_')
    if n > 0:
        print(f"  WARP cross-chain: -{n} lines")

    # 7. Remove Free World + Issobella
    lines, n = remove_block(lines,
        r'FW_PILLARS|function\s+initFreeWorldView|const\s+FW_',
        r'function\s+initUpdateUI|function\s+_showProgress')
    if n > 0:
        print(f"  Free World + Issobella: -{n} lines")

    # 8. Remove multi-stream references
    lines, n = remove_lines_matching(lines, r'_lastMultiStreamStatus')
    lines, n2 = remove_lines_matching(lines, r'multiStreamStatus|multi-stream-status|onMultiStreamStatus|onStreamSwitch')
    lines, n3 = remove_lines_matching(lines, r'updateStreamIndicator|stream.indicator|stream-switch')
    
    # 9. Remove GPU revenue radio button handler
    lines, n = remove_lines_matching(lines, r'gpu-revenue|gpuRevenue|gpu_revenue')
    
    # 10. Remove afterburner references
    lines, n = remove_lines_matching(lines, r'afterburner|ab-card|ab-console')
    
    # 11. Remove revenue slider/toggle references
    lines, n = remove_lines_matching(lines, r'revenue-enabled|revenue-routing|revenue_|revenueProfile')

    # 12. Clean up view dispatch table - remove legacy views
    for view in ['bridge', 'defi', 'oasis', 'freeworld', 'issobella', 'dao', 'warp']:
        lines, n = remove_lines_matching(lines, rf"'{view}'.*init.*View|init{view.capitalize()}View")

    # Clean up blank lines
    cleaned = []
    blank_count = 0
    for line in lines:
        if line.strip() == '':
            blank_count += 1
            if blank_count <= 2:
                cleaned.append(line)
        else:
            blank_count = 0
            cleaned.append(line)
    lines = cleaned

    write_file('src/ui/renderer.js', lines)
    print(f"\n  TOTAL: {total_before} → {len(lines)} lines (removed {total_before - len(lines)})")
    return len(lines)


def cleanup_index_html():
    print("\n=== Cleaning index.html ===")
    lines = read_file('src/ui/index.html')
    total_before = len(lines)

    # 1. Remove OASIS view HTML
    lines, n = remove_block(lines,
        r'id="oasis-view"',
        r'</section>.*oasis|<!-- /oasis')
    if n > 0:
        print(f"  OASIS view HTML: -{n} lines")

    # 2. Remove Bridge view HTML
    lines, n = remove_block(lines,
        r'id="bridge-view"',
        r'</section>.*bridge|<!-- /bridge')
    if n > 0:
        print(f"  Bridge view HTML: -{n} lines")

    # 3. Remove DAO view HTML
    lines, n = remove_block(lines,
        r'id="dao-view"',
        r'</section>.*dao|<!-- /dao')
    if n > 0:
        print(f"  DAO view HTML: -{n} lines")

    # 4. Remove WARP view HTML
    lines, n = remove_block(lines,
        r'id="warp-view"',
        r'</section>.*warp|<!-- /warp')
    if n > 0:
        print(f"  WARP view HTML: -{n} lines")

    # 5. Remove DeFi view HTML
    lines, n = remove_block(lines,
        r'id="defi-view"',
        r'</section>.*defi|<!-- /defi')
    if n > 0:
        print(f"  DeFi view HTML: -{n} lines")

    # 6. Remove Free World view HTML
    lines, n = remove_block(lines,
        r'id="freeworld-view"',
        r'</section>.*freeworld|<!-- /freeworld')
    if n > 0:
        print(f"  Free World view HTML: -{n} lines")

    # 7. Remove Issobella view HTML
    lines, n = remove_block(lines,
        r'id="issobella-view"',
        r'</section>.*issobella|<!-- /issobella')
    if n > 0:
        print(f"  Issobella view HTML: -{n} lines")

    # 8. Remove legacy CSS class blocks
    css_prefixes = [
        r'\.oasis-', r'\.cosmic-', r'\.cs-', r'\.game-',
        r'\.dao-', r'\.guardian-',
        r'\.warp-', 
        r'\.fw-', r'\.iss-',
        r'\.bridge-', r'\.dex-', r'\.swap-',
        r'\.ab-', r'\.afterburner',
        r'\.revenue-', r'\.multi-stream',
        r'\.gpu-revenue',
        r'\.defi-', r'\.lp-farming',
    ]
    
    for prefix in css_prefixes:
        # Remove CSS rule blocks: .prefix-something { ... }
        new_lines = []
        skip_depth = 0
        for line in lines:
            if skip_depth == 0 and re.search(prefix, line) and ('{' in line or line.strip().endswith(',')):
                skip_depth = line.count('{') - line.count('}')
                if skip_depth <= 0:
                    skip_depth = 0
                continue
            if skip_depth > 0:
                skip_depth += line.count('{') - line.count('}')
                if skip_depth <= 0:
                    skip_depth = 0
                continue
            new_lines.append(line)
        removed = len(lines) - len(new_lines)
        if removed > 0:
            lines = new_lines

    # 9. Remove legacy keyframe animations
    keyframes = ['oasisRotate', 'csShipOrbit', 'gsUpgrade', 'cosmoFloat', 
                 'alienWalk', 'warpFlow', 'fwPulse', 'daoGlow', 'bridgePulse']
    for kf in keyframes:
        lines, n = remove_block(lines, rf'@keyframes\s+{kf}', r'^\s*\}')

    # 10. Remove nav items for removed views
    for view_id in ['oasis', 'bridge', 'dao', 'warp', 'defi', 'freeworld', 'issobella']:
        lines, n = remove_lines_matching(lines, rf'data-view="{view_id}"')

    # 11. Remove revenue/multi-stream dashboard elements
    lines, n = remove_lines_matching(lines, r'id="revenue-split-badge"')
    lines, n = remove_lines_matching(lines, r'id="multi-stream-bar"')
    lines, n = remove_lines_matching(lines, r'id="revenue-routing-section"')
    lines, n = remove_lines_matching(lines, r'id="revenue-enabled"')
    lines, n = remove_lines_matching(lines, r'id="gpu-revenue"')
    lines, n = remove_lines_matching(lines, r'mode-gpu-revenue')
    lines, n = remove_lines_matching(lines, r'id="ai-afterburner-enabled"')
    lines, n = remove_lines_matching(lines, r'ab-console|ab-card|afterburner')
    
    # Clean up blank lines
    cleaned = []
    blank_count = 0
    for line in lines:
        if line.strip() == '':
            blank_count += 1
            if blank_count <= 2:
                cleaned.append(line)
        else:
            blank_count = 0
            cleaned.append(line)
    lines = cleaned

    write_file('src/ui/index.html', lines)
    print(f"\n  TOTAL: {total_before} → {len(lines)} lines (removed {total_before - len(lines)})")
    return len(lines)


if __name__ == '__main__':
    print("ZION V3 Agent Cleanup")
    print("=" * 50)
    
    m = cleanup_main_js()
    r = cleanup_renderer_js() 
    h = cleanup_index_html()
    
    print(f"\n{'=' * 50}")
    print(f"FINAL: main.js={m}, renderer.js={r}, index.html={h}")
    print("Done! Run 'node --check src/main.js' to validate.")
