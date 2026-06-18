"""
V3 Agent Cleanup Script v2
Removes all legacy ballast from main.js, renderer.js, and index.html.
Uses unique anchor strings (not regexes) to identify section boundaries.

Run from desktop-agent/: python scripts/cleanup_v3_v2.py
"""
import os, re, sys

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
def fpath(rel): return os.path.join(BASE, rel)

def read(rel):
    with open(fpath(rel), 'r', encoding='utf-8') as f:
        return f.readlines()

def write(rel, lines):
    with open(fpath(rel), 'w', encoding='utf-8', newline='\n') as f:
        f.writelines(lines)

def find(lines, needle, start=0):
    """Find first line containing needle (literal substring). Returns 0-based index, or -1."""
    for i in range(start, len(lines)):
        if needle in lines[i]:
            return i
    return -1

def find_closing_brace_balanced(lines, start):
    """From start line, find the line where cumulative braces balance to 0."""
    depth = 0
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == '{': depth += 1
            elif ch == '}': depth -= 1
        if depth <= 0 and i > start:
            return i
    return len(lines) - 1

def find_function_end(lines, start):
    """Given start = line containing 'function name(' or 'async function name(',
    find the closing brace of the function body."""
    return find_closing_brace_balanced(lines, start)

def remove_ranges(lines, ranges, label=""):
    """Remove sorted, non-overlapping ranges from lines. Returns new list."""
    # Sort by start descending so we can pop from the end
    sorted_ranges = sorted(ranges, key=lambda r: r[0], reverse=True)
    removed = 0
    for s, e, desc in sorted_ranges:
        if s < 0 or e < s:
            print(f"  SKIP invalid range: {desc} ({s},{e})")
            continue
        n = e - s + 1
        removed += n
        lines = lines[:s] + lines[e+1:]
        print(f"  L{s+1}-{e+1}: -{n} lines ({desc})")
    if label:
        print(f"  [{label}] Removed {removed} lines in {len(sorted_ranges)} ranges")
    return lines

def remove_lines_containing(lines, needle, max_remove=100):
    """Remove all lines containing needle. Returns (new_lines, count_removed)."""
    result = []
    removed = 0
    for line in lines:
        if needle in line and removed < max_remove:
            removed += 1
        else:
            result.append(line)
    return result, removed

def remove_ipc_block(lines, handle_name):
    """Remove ipcMain.handle('handle_name', ...) { ... }); block."""
    needle = f"ipcMain.handle('{handle_name}'"
    idx = find(lines, needle)
    if idx < 0:
        return lines, 0
    # Walk backward to include preceding comment lines
    start = idx
    while start > 0 and lines[start-1].strip().startswith('//'):
        start -= 1
    end = find_closing_brace_balanced(lines, idx)
    # The handler ends with }); — include that line
    # Look for the closing ); after the brace
    if end < len(lines) - 1 and lines[end].rstrip().endswith(');'):
        pass  # already got it
    elif end + 1 < len(lines) and lines[end+1].strip().startswith(');'):
        end += 1
    n = end - start + 1
    return lines[:start] + lines[end+1:], n

def cleanup_blank_lines(lines, max_consecutive=2):
    result = []
    blank_count = 0
    for line in lines:
        if line.strip() == '':
            blank_count += 1
            if blank_count <= max_consecutive:
                result.append(line)
        else:
            blank_count = 0
            result.append(line)
    return result

# =============================================================================
# MAIN.JS CLEANUP
# =============================================================================
def cleanup_main():
    print("\n" + "="*60)
    print("CLEANING main.js")
    print("="*60)
    lines = read('src/main.js')
    total = len(lines)
    ranges = []

    # ── 1. AutoTuner class ──────────────────────────────────────
    s = find(lines, '// ── Auto-Tuning System')
    if s >= 0:
        # Ends at "const autoTuner = new AutoTuner();"
        e = find(lines, 'const autoTuner = new AutoTuner()', s)
        if e >= 0:
            ranges.append((s, e, 'AutoTuner class'))

    # ── 2. Legacy process variable declarations ─────────────────
    for var_line in [
        'let revenueProcess = null;',
        'let gpuRevenueProcess = null;',
        'let gpuRevenueHealth = {',
        'let chv42GpuProcess = null;',
        'let chv42GpuStats = {',
    ]:
        idx = find(lines, var_line)
        if idx >= 0:
            # gpuRevenueHealth and chv42GpuStats span multiple lines
            if '{' in lines[idx] and '};' not in lines[idx]:
                end = find(lines, '};', idx)
                if end >= 0:
                    ranges.append((idx, end, f'var: {var_line[:40]}'))
                    continue
            ranges.append((idx, idx, f'var: {var_line[:40]}'))

    # ── 3. CH3 Multi-Stream state block ─────────────────────────
    s = find(lines, '// ── CH3 Multi-Stream state (dual/triple mining)')
    if s >= 0:
        # Ends at the separator line before "let startMiningInProgress"
        e = find(lines, 'let startMiningInProgress = false;', s)
        if e >= 0:
            # Walk backward from startMiningInProgress to find the separator
            sep = e - 1
            while sep > s and lines[sep].strip() == '':
                sep -= 1
            if '────' in lines[sep]:
                e = sep
            else:
                e = e - 1
            ranges.append((s, e, 'CH3 Multi-Stream state'))

    # ── 4. Legacy timer and state vars (individual lines) ───────
    legacy_vars = [
        'let gpuRevenueRecoveryTimer',
        'let afterburnerProc = null;',
        'let afterburnerReady = false;',
        "let afterburnerStdoutBuf = '';",
        'let afterburnerQueue = [];',
        'let afterburnerReqId = 1;',
        'let abLastConsoleEmitMs = 0;',
        'let aiNativeProc = null;',
        'let aiNativeReady = false;',
        "let aiNativeStdoutBuf = '';",
        'let aiNativeQueue = [];',
        'let aiNativeReqId = 1;',
    ]
    for var in legacy_vars:
        idx = find(lines, var)
        if idx >= 0:
            ranges.append((idx, idx, f'var: {var[:30]}'))

    # ── 5. Revenue fields in minerStats ─────────────────────────
    revenue_fields = [
        '  stream_mode:',
        '  stream_algorithm:',
        '  stream_allocation:',
        '  revenue_coin:',
        '  revenue_hashrate:',
        '  dual_mining:',
        '  zion_threads:',
        '  xmr_threads:',
        '  xmr_pool:',
    ]
    for field in revenue_fields:
        idx = find(lines, field)
        if idx >= 0 and idx > find(lines, 'let minerStats = {'):
            ranges.append((idx, idx, f'minerStats field: {field.strip()}'))

    # ── 6. findPythonMiner function ─────────────────────────────
    s = find(lines, 'function findPythonMiner()')
    if s >= 0:
        e = find_function_end(lines, s)
        ranges.append((s, e, 'findPythonMiner'))

    # ── 7. Legacy miner resolution code: allowPackagedPythonFallback block ──
    s = find(lines, 'const allowPackagedPythonFallback =')
    if s >= 0:
        # This block goes: allowPackagedPythonFallback, if (rustMinerPath), else { pyFallback }
        # We want to keep the rustMinerPath block but simplify
        # Actually the whole if/else is fine since findRustMiner is kept
        # But MINER_IS_PYTHON and findPythonMiner references need cleanup
        pass  # Handle with line removals later

    # ── 8. Revenue constants and functions ──────────────────────
    s = find(lines, '// ── Revenue / Funding Split')
    if s >= 0:
        # Find end: after isLegacyDefaultRevenueProfile function
        e = find(lines, 'function isLegacyDefaultRevenueProfile', s)
        if e >= 0:
            e = find_function_end(lines, e)
            ranges.append((s, e, 'Revenue constants + functions'))

    # ── 9. Legacy DEFAULT_CONFIG fields ─────────────────────────
    cfg_start = find(lines, 'const DEFAULT_CONFIG = {')
    cfg_end = -1
    if cfg_start >= 0:
        cfg_end = find_closing_brace_balanced(lines, cfg_start)
        # Remove individual legacy fields within DEFAULT_CONFIG
        legacy_cfg_lines = []
        i = cfg_start
        while i <= cfg_end:
            line = lines[i].strip()
            if any(line.startswith(f) for f in [
                'desktopPureZionDefault:', 'aiAfterburner:', 'aiNative:',
                'aiNativePoolUrl:', 'aiNativeConsciousness:',
                'chatEndpoint:', 'chatModel:', 'chatApiKey:',
                'revenue: DEFAULT_REVENUE_PROFILE',
                'gpuRevenue:', 'gpuRevenueCoins:',
                'poolPreference:', 'poolRegion:', 'nicehashBtcAddr:',
                'revenueWallet:', 'pythonUi:',
            ]):
                # Check if it's a multi-line value (array)
                if line.endswith('['):
                    end_arr = find(lines, '],', i)
                    if end_arr >= 0 and end_arr <= cfg_end:
                        for j in range(i, end_arr + 1):
                            legacy_cfg_lines.append(j)
                        i = end_arr + 1
                        continue
                legacy_cfg_lines.append(i)
            # Also remove comment lines that describe legacy fields
            elif any(pat in line for pat in [
                'AI Afterburner integration',
                'Enabled by default: monitors GPU power',
                'AI Native compute',
                'Local chat',
                'Cloud chat (OpenAI',
                'Free-tier via OpenRouter',
                'Cosmic Harmony GPU performance',
                'GPU Revenue Mining',
                'Dynamic GPU system',
                'Pool provider preference for GPU',
                "'herominers' (default)",
                'Override at runtime: ZION_POOL_PREFERENCE',
                'Mining region for pool selection',
                'BTC address for NiceHash stratum',
                'Falls back to main wallet',
                'Revenue BTC payout wallet',
                'Python miner console style',
            ]):
                legacy_cfg_lines.append(i)
            i += 1
        for idx in legacy_cfg_lines:
            ranges.append((idx, idx, 'DEFAULT_CONFIG legacy field'))

    # ── 10. loadConfig revenue migration code ───────────────────
    # Inside loadConfig(), there's revenue profile normalization code.
    # We need to keep loadConfig but strip revenue-specific parts.
    # Mark for surgical editing after range removal.

    # ── 11. AI Native and Afterburner constants ─────────────────
    for needle in [
        'const PRIMARY_AI_NATIVE_PORT',
        'const DEFAULT_AI_NATIVE_POOL_URL',
        'const DEFAULT_DAO_API_BASE =',
        'const DEFAULT_WARP_API_BASE =',
        "const DESKTOP_PURE_ZION_DEFAULT =",
    ]:
        idx = find(lines, needle)
        if idx >= 0:
            ranges.append((idx, idx, f'const: {needle[:40]}'))

    # LEGACY_TESTNET_HOSTS multi-line
    s = find(lines, 'const LEGACY_TESTNET_HOSTS = new Set([')
    if s >= 0:
        e = find(lines, ']);', s)
        if e >= 0:
            ranges.append((s, e, 'LEGACY_TESTNET_HOSTS'))

    # ── 12. CH3 Multi-Stream helpers ────────────────────────────
    s = find(lines, '// Revenue CPU (25% CPU')
    if s < 0:
        s = find(lines, 'const GPU_COIN_POOLS = {')
    if s >= 0:
        e = find(lines, '// ── End CH3 Multi-Stream helpers', s)
        if e >= 0:
            ranges.append((s, e, 'CH3 Multi-Stream helpers'))

    # ── 13. migrateLegacyUserDataIfNeeded ───────────────────────
    s = find(lines, 'function migrateLegacyUserDataIfNeeded')
    if s >= 0:
        e = find_function_end(lines, s)
        ranges.append((s, e, 'migrateLegacyUserDataIfNeeded'))

    # ── 14. Legacy startMining body ─────────────────────────────
    # Keep the guard + V3 fast-path dispatch, remove everything after
    s = find(lines, '  // Auto-tuning: Check if tuning is needed')
    if s >= 0:
        # Find the end of startMining function: next top-level function
        e = find(lines, 'function ensureAfterburnerServiceRunning()', s)
        if e >= 0:
            e -= 1
            # Walk backward past blank lines
            while e > s and lines[e].strip() == '':
                e -= 1
            ranges.append((s, e, 'Legacy startMining body'))

    # ── 15. Afterburner service ─────────────────────────────────
    # AFTERBURNER_SCRIPT_PATH + ensureAfterburnerServiceRunning + afterburnerSend + stopAfterburnerService
    s = find(lines, 'const AFTERBURNER_SCRIPT_PATH')
    if s < 0:
        s = find(lines, 'function ensureAfterburnerServiceRunning()')
    if s >= 0:
        # Find end: just before AI NATIVE SERVICE section
        e = find(lines, '// AI NATIVE SERVICE', s)
        if e >= 0:
            # Include the separator line above it
            while e > s and ('===' in lines[e] or lines[e].strip().startswith('//')):
                e -= 1
            e += 1  # go back to first === line
            # Now find the actual end of the AI native section
            pass  # We'll handle AI native separately
            # Just end before the === AI NATIVE line
            e2 = find(lines, '// ====', s + 5)
            if e2 >= 0 and e2 < find(lines, 'AI NATIVE SERVICE', s):
                e = e2 - 1
                while e > s and lines[e].strip() == '':
                    e -= 1
            else:
                e -= 2
            ranges.append((s, e, 'Afterburner service'))

    # ── 16. AI Native Service ───────────────────────────────────
    s = find(lines, '// AI NATIVE SERVICE')
    if s >= 0:
        # Walk backward to include separator
        while s > 0 and ('===' in lines[s-1] or lines[s-1].strip() == ''):
            s -= 1
        if s > 0 and lines[s].strip() == '':
            s += 1
        # Find end: just before "// STATS AND MINING" or "function tryUpdateStatsFromFile"
        e = find(lines, 'function tryUpdateStatsFromFile()', s)
        if e >= 0:
            # Walk backward past separators and blanks
            e -= 1
            while e > s and (lines[e].strip() == '' or '===' in lines[e] or lines[e].strip().startswith('//')):
                e -= 1
            # But keep the STATS AND MINING section header
            # Check if there's a "STATS AND MINING" header after e
            ranges.append((s, e, 'AI Native service'))

    # ── 17. tryUpdateRevenueStatsFromFile ───────────────────────
    s = find(lines, 'function tryUpdateRevenueStatsFromFile()')
    if s >= 0:
        e = find_function_end(lines, s)
        ranges.append((s, e, 'tryUpdateRevenueStatsFromFile'))

    # ── 18. CH3 Stream/Revenue parsing in parseMinerOutput ──────
    s = find(lines, '// ---- CH3 Stream / Revenue parsing ----')
    if s >= 0:
        # Find end: just before "// Pool failover: reset counter"
        e = find(lines, '// Pool failover: reset counter', s)
        if e >= 0:
            e -= 1
            while e > s and lines[e].strip() == '':
                e -= 1
            ranges.append((s, e, 'CH3 revenue parsing'))

    # ── 19. Bridge section ──────────────────────────────────────
    s = find(lines, '// wZION BRIDGE IPC HANDLERS')
    if s >= 0:
        while s > 0 and ('===' in lines[s-1] or lines[s-1].strip() == ''):
            s -= 1
        if lines[s].strip() == '':
            s += 1
        # Find end: just before "// L2 DAO IPC HANDLERS" or "// TREE NODE IPC"
        e = find(lines, '// L2 DAO IPC HANDLERS', s)
        if e >= 0:
            while e > s and ('===' in lines[e-1] or lines[e-1].strip() == '' or lines[e-1].strip().startswith('//')):
                e -= 1
            ranges.append((s, e, 'Bridge IPC'))

    # ── 20. DAO section ─────────────────────────────────────────
    s = find(lines, '// L2 DAO IPC HANDLERS')
    if s >= 0:
        while s > 0 and ('===' in lines[s-1] or lines[s-1].strip() == ''):
            s -= 1
        if lines[s].strip() == '':
            s += 1
        # Find end: just before WARP section
        e = find(lines, '// L3 WARP IPC HANDLERS', s)
        if e >= 0:
            while e > s and ('===' in lines[e-1] or lines[e-1].strip() == '' or lines[e-1].strip().startswith('//')):
                e -= 1
            ranges.append((s, e, 'DAO IPC'))

    # ── 21. WARP section ────────────────────────────────────────
    s = find(lines, '// L3 WARP IPC HANDLERS')
    if s >= 0:
        while s > 0 and ('===' in lines[s-1] or lines[s-1].strip() == ''):
            s -= 1
        if lines[s].strip() == '':
            s += 1
        # Find end: just before TREE NODE IPC HANDLERS
        e = find(lines, '// TREE NODE IPC HANDLERS', s)
        if e >= 0:
            while e > s and ('===' in lines[e-1] or lines[e-1].strip() == '' or lines[e-1].strip().startswith('//')):
                e -= 1
            ranges.append((s, e, 'WARP IPC'))

    # ── 22. Legacy IPC handlers (scattered) ─────────────────────
    # These will be removed individually after range removal

    # ── 23. get-ch3-status IPC ──────────────────────────────────
    # It's between peer-list and wallet handlers

    # ── Sort, validate, remove ranges ───────────────────────────
    ranges.sort(key=lambda r: r[0])
    # Merge overlapping
    merged = []
    for r in ranges:
        if merged and r[0] <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], r[1]), merged[-1][2] + ' + ' + r[2])
        else:
            merged.append(list(r))
    ranges = [(s, e, d) for s, e, d in merged]

    print(f"\n  Phase 1: {len(ranges)} block ranges to remove")
    lines = remove_ranges(lines, ranges, "blocks")

    # ── Phase 2: Remove individual IPC handlers ─────────────────
    print(f"\n  Phase 2: Removing legacy IPC handlers")
    ipc_names = [
        'get-multi-stream-status', 'get-tuning-status', 'perform-manual-tuning',
        'start-chv42-gpu', 'stop-chv42-gpu', 'get-chv42-status',
        'ai-native-start', 'ai-native-stop', 'ai-native-stats',
        'ai-native-status', 'ai-native-chat',
        'ai-native-search-knowledge', 'ai-native-ask',
        'ai-native-dashboard', 'ai-native-blockchain-status',
        'ai-native-pool-monitor', 'ai-native-system-health',
        'bridge-get-wzion-balance', 'bridge-get-stats', 'bridge-tx-status',
        'bridge-prepare-lock', 'wallet-get-evm-address',
        'bridge-send-lock', 'bridge-burn-wzion',
        'dao-health', 'dao-get-stats', 'dao-get-proposals',
        'dao-get-proposal', 'dao-create-proposal', 'dao-get-votes',
        'dao-cast-vote', 'dao-get-treasury',
        'warp-get-health', 'warp-get-chains', 'warp-get-metrics',
        'warp-get-transfers', 'warp-get-pending-transfers', 'warp-get-transfer',
        'warp-initiate-outbound', 'warp-initiate-inbound', 'warp-advance-transfer',
        'get-ch3-status',
        'afterburner-command',
        'ai-chat',
        'set-dual-mining', 'get-dual-mining-status',
    ]
    ipc_total = 0
    for name in ipc_names:
        lines, n = remove_ipc_block(lines, name)
        if n > 0:
            ipc_total += n
            print(f"    IPC '{name}': -{n}")
    print(f"  [IPC handlers] Removed {ipc_total} lines")

    # ── Phase 3: Surgical line removals ─────────────────────────
    print(f"\n  Phase 3: Surgical line removals")

    # Remove individual lines referencing legacy features
    surgical_needles = [
        'let MINER_IS_PYTHON',
        'MINER_IS_PYTHON = true;',
        'MINER_IS_PYTHON = false;',
        'let minerFallbackInProgress',
        'let minerFallbackTimer',
        'const findPythonMiner',  # if there's a re-export
        "const pyFallback = findPythonMiner();",
        # stopMiningAsync surgical
        'void stopAfterburnerService()',
        'Stop the revenue process',
        'Stop the GPU revenue process',
        'Stop profit-status polling loop',
        'stopProfitPoll()',
        'multiStreamStatus =',
        "sendToRenderer('multi-stream-status",
        # stopMining surgical
        'gpuRevenueRecoveryTimer',
        # Afterburner stats in composeStatsPayload / heartbeat
        'afterburnerProc && afterburnerReady',
        'afterburnerSend(',
        'afterburner_temp_c',
        'afterburner_tasks_per_sec',
        'afterburner_efficiency_pct',
        'afterburner_speed_10s',
        'afterburner_speed_60s',
        'afterburner_speed_15m',
        'afterburner_success_60s_pct',
        'afterburner_latency_10s_ms',
        'afterburner_latency_60s_ms',
        'afterburner_status',
        'afterburner_compute_mode',
        'afterburner_sacred',
        'afterburner_active_tasks',
        'afterburner_completed_tasks',
        'afterburner_failed_tasks',
        'afterburner_utilization_pct',
        'afterburner_available_compute',
        'afterburner_total_compute',
        'afterburner_sacred_ratio',
        'afterburner_uptime_sec',
        'afterburner_last_error',
        'afterburner_throttle_events',
        'afterburner_queue_depth',
        'afterburner_queue_by_type',
        'afterburner_last_task_type',
        'afterburner_last_task_ms',
        'afterburner_avg_task_ms',
        'afterburner_gpu_power_w',
        'afterburner_gpu_util_pct',
        'afterburner_power_source',
        'afterburner_hashrate_per_watt',
        'hashrate_per_watt_10s',
        'hashrate_per_watt_60s',
        'afterburner_efficiency_hint',
        'efficiency_hint',
        'abLastConsoleEmitMs',
        # Revenue in loadConfig
        'merged.revenue = normalizeRevenueProfile',
        'hasExplicitRevenue',
        'shouldMigratePureZion',
        'isLegacyDefaultRevenueProfile',
        'toPureZionRevenueProfile',
        'merged.gpuRevenue',
        'merged.gpuRevenueCoins',
        'gpuRevenueCoins',
        # save-config afterburner handling
        'void stopAfterburnerService',
        'void ensureAfterburnerServiceRunning',
        'afterburnerSend({ cmd:',
        # auto-tuner in app lifecycle
        'await autoTuner.initialize()',
        'Auto-tuning system initialized',
        'autoTuner',
        # quick-setup evmAddress
        'evmAddress: wallet.mnemonic ? deriveEvmAddressFromMnemonic',
        # isLegacyOrLocalHost
        'LEGACY_TESTNET_HOSTS.has',
        # getStatsPath revenue/gpu_revenue
        "case 'revenue':",
        "case 'gpu_revenue':",
    ]

    removed_surgical = 0
    for needle in surgical_needles:
        lines, n = remove_lines_containing(lines, needle)
        if n > 0:
            removed_surgical += n

    print(f"  [surgical] Removed {removed_surgical} lines")

    # ── Phase 4: Remove big blocks that may remain ──────────────
    # stopMiningAsync: Remove revenue/afterburner stop blocks
    # These are multi-line try {} blocks that we need to find and remove

    # Revenue process stop block
    idx = find(lines, "logApp('stop-revenue-process'")
    if idx >= 0:
        # Walk backward to find the try {
        s = idx
        while s > 0 and 'try {' not in lines[s]:
            s -= 1
        # Walk forward to find matching catch {} block
        e = find_closing_brace_balanced(lines, s)
        # Skip the catch block too
        if e + 1 < len(lines) and 'catch' in lines[e+1]:
            e = find_closing_brace_balanced(lines, e+1)
        if e - s < 30:  # sanity check
            lines = lines[:s] + lines[e+1:]
            print(f"  StopMining revenue process block: -{e-s+1}")

    # GPU revenue process stop block
    idx = find(lines, "logApp('stop-gpu-revenue-process'")
    if idx >= 0:
        s = idx
        while s > 0 and 'try {' not in lines[s]:
            s -= 1
        e = find_closing_brace_balanced(lines, s)
        if e + 1 < len(lines) and 'catch' in lines[e+1]:
            e = find_closing_brace_balanced(lines, e+1)
        if e - s < 35:
            lines = lines[:s] + lines[e+1:]
            print(f"  StopMining GPU revenue process block: -{e-s+1}")

    # isLegacyOrLocalHost function
    s = find(lines, 'function isLegacyOrLocalHost(')
    if s >= 0:
        e = find_function_end(lines, s)
        lines = lines[:s] + lines[e+1:]
        print(f"  isLegacyOrLocalHost: -{e-s+1}")

    # ── Phase 5: Fix startMining after legacy body removal ──────
    # The function is now: guard → V3 fast-path → (removed legacy body)
    # We need to add a clean error fallback and close the function

    idx = find(lines, "if (v3Result) return v3Result;")
    if idx >= 0:
        # Find the next line with content
        next_content = idx + 1
        while next_content < len(lines) and lines[next_content].strip() in ('', '}', '// null return'):
            next_content += 1
        # Check if the next content is a function or already our fallback
        if next_content < len(lines) and ('function ' in lines[next_content] or 'function\n' in lines[next_content]):
            # Legacy body was removed, need to add fallback and close startMining
            fallback = [
                '      // null return → fall through to legacy path (shouldn\'t happen)\n',
                '    }\n',
                '  }\n',
                '\n',
                '  // V3 binary not found — cannot mine\n',
                '  startMiningInProgress = false;\n',
                '  if (startMiningGuardTimer) { clearTimeout(startMiningGuardTimer); startMiningGuardTimer = null; }\n',
                '  try {\n',
                "    sendToRenderer('miner-output', { stream: 'stderr', text: '[ERROR] V3 miner binary not found. Cannot start mining.\\n' });\n",
                "    sendToRenderer('miner-stopped', { code: 1 });\n",
                '  } catch {}\n',
                "  return { success: false, error: 'V3 miner not found' };\n",
                '}\n',
            ]
            # Remove the closing braces that belonged to the if/block
            # Find and remove lines between "if (v3Result)" and next function
            remove_start = idx + 1
            remove_end = next_content - 1
            lines = lines[:remove_start] + fallback + lines[next_content:]
            print(f"  startMining V3 fallback added, removed L{remove_start+1}-{remove_end+1}")

    # ── Phase 6: Remove Python fallback block in miner resolution ──
    s = find(lines, "const pyFallback = findPythonMiner")
    if s < 0:
        s = find(lines, "const pyPath = findPythonMiner")
    if s >= 0:
        # This is inside an else block that handles py fallback
        # Find the wrapping else { ... }
        else_start = s - 1
        while else_start > 0 and 'else {' not in lines[else_start]:
            else_start -= 1
        if 'else {' in lines[else_start]:
            else_end = find_closing_brace_balanced(lines, else_start)
            if else_end - else_start < 15:
                # Replace with simple throw
                indent = '  ' if lines[else_start].startswith('  ') else ''
                replacement = [
                    indent + "} else {\n",
                    indent + "  throw new Error('V3 Rust miner not found. Build V3/L1/miner release or package zion-miner.exe into resources.');\n",
                    indent + "}\n",
                ]
                lines = lines[:else_start] + replacement + lines[else_end+1:]
                print(f"  Python fallback block simplified")

    # ── Phase 7: Remove AFTERBURNER_SCRIPT_PATH if still present ──
    for needle in ['const AFTERBURNER_SCRIPT_PATH', 'const AI_NATIVE_BRIDGE_PATH']:
        idx = find(lines, needle)
        if idx >= 0:
            e = idx
            while e < len(lines) - 1 and not lines[e].rstrip().endswith(';'):
                e += 1
            lines = lines[:idx] + lines[e+1:]
            print(f"  Removed {needle[:30]}...")

    # ── Phase 8: Clean up save-config afterburner block ─────────
    s = find(lines, "config?.aiAfterburner === false")
    if s >= 0:
        # Find the try { } catch {} block wrapping it
        try_start = s
        while try_start > 0 and 'try {' not in lines[try_start]:
            try_start -= 1
        if 'try {' in lines[try_start]:
            try_end = find_closing_brace_balanced(lines, try_start)
            if try_end + 1 < len(lines) and 'catch' in lines[try_end + 1]:
                try_end = find_closing_brace_balanced(lines, try_end + 1)
            if try_end - try_start < 15:
                lines = lines[:try_start] + lines[try_end+1:]
                print(f"  save-config afterburner block removed")

    # ── Phase 9: Clean getStatsPath ─────────────────────────────
    # Already handled by surgical needle removal

    # ── Phase 10: Remove duplicate DAO/Bridge constants ─────────
    for needle in ['const DAO_API_BASE =', 'const DAO_API_KEY', 'const WARP_API_BASE',
                   'async function daoFetch(', 'async function warpFetch(',
                   'let _sessionEvmWallet', 'const BRIDGE_VAULT_ADDR',
                   'const BRIDGE_NET =', 'function deriveEvmAddressFromMnemonic',
                   'const BRIDGE_SEL_', 'function bridgeSelector(',
                   'async function bridgeRpc(', 'function bridgeEncodeAddress(']:
        idx = find(lines, needle)
        if idx >= 0:
            if 'function ' in lines[idx] or 'const BRIDGE_NET' in lines[idx]:
                e = find_function_end(lines, idx)
            else:
                e = idx
                while e < len(lines) - 1 and not lines[e].rstrip().endswith(';'):
                    e += 1
            lines = lines[:idx] + lines[e+1:]
            print(f"  Removed leftover: {needle[:40]}")

    # ── Phase 11: Remove CHv4.2 section header comment ──────────
    s = find(lines, '// ─── CHv4.2 Merkabah GPU Mining')
    if s >= 0:
        lines = lines[:s] + lines[s+1:]

    # ── Phase 12: Remove AI NATIVE section header ───────────────
    s = find(lines, '// AI NATIVE IPC HANDLERS')
    if s >= 0:
        while s > 0 and ('===' in lines[s-1] or lines[s-1].strip() == ''):
            s -= 1
        e = find(lines, '// AI NATIVE IPC HANDLERS') + 1
        while e < len(lines) and ('===' in lines[e] or lines[e].strip() == ''):
            e += 1
        lines = lines[:s] + lines[e:]

    # ── Final: Clean up blank lines ─────────────────────────────
    lines = cleanup_blank_lines(lines)

    write('src/main.js', lines)
    final = len(lines)
    print(f"\n  main.js: {total} → {final} lines (removed {total - final})")
    return final


# =============================================================================
# RENDERER.JS CLEANUP
# =============================================================================
def cleanup_renderer():
    print("\n" + "="*60)
    print("CLEANING renderer.js")
    print("="*60)
    lines = read('src/ui/renderer.js')
    total = len(lines)
    ranges = []

    # ── 1. Revenue profile code ─────────────────────────────────
    s = find(lines, 'DEFAULT_REVENUE_PROFILE')
    if s >= 0:
        e = find(lines, '};', s)
        if e >= 0 and e - s < 50:
            ranges.append((s, e, 'DEFAULT_REVENUE_PROFILE'))

    for fn_name in ['normalizeRevenueProfile', 'toPureZionRevenueProfile',
                    'isPureZionDesktopMode', 'normalizeMiningMode', 'applyPureZionUiState']:
        idx = find(lines, f'function {fn_name}')
        if idx >= 0:
            e = find_function_end(lines, idx)
            ranges.append((idx, e, f'fn: {fn_name}'))

    # ── 2. Bridge/DEX/Swap view ─────────────────────────────────
    s = find(lines, 'function initBridgeView')
    if s >= 0:
        e_marker = find(lines, 'function initOasisView', s + 1)
        if e_marker < 0:
            e_marker = find(lines, 'OASIS_LEVELS', s + 1)
        if e_marker < 0:
            e_marker = find(lines, 'function initDaoView', s + 1)
        if e_marker >= 0:
            ranges.append((s, e_marker - 1, 'Bridge/DEX/Swap view'))

    # ── 3. OASIS + COSMIC MINE ──────────────────────────────────
    s = find(lines, 'OASIS_LEVELS')
    if s < 0:
        s = find(lines, 'function initOasisView')
    if s >= 0:
        e_marker = find(lines, 'function initDaoView', s + 1)
        if e_marker < 0:
            e_marker = find(lines, 'DAO_PROPOSALS', s + 1)
        if e_marker >= 0:
            ranges.append((s, e_marker - 1, 'OASIS + COSMIC MINE'))

    # ── 4. DAO view ─────────────────────────────────────────────
    s = find(lines, 'DAO_PROPOSALS')
    if s < 0:
        s = find(lines, 'function initDaoView')
    if s >= 0:
        e_marker = find(lines, 'function initWarpView', s + 1)
        if e_marker < 0:
            e_marker = find(lines, 'WARP_CHAINS', s + 1)
        if e_marker >= 0:
            ranges.append((s, e_marker - 1, 'DAO view'))

    # ── 5. WARP cross-chain ─────────────────────────────────────
    s = find(lines, 'WARP_CHAINS')
    if s < 0:
        s = find(lines, 'function initWarpView')
    if s >= 0:
        e_marker = find(lines, 'function initFreeWorldView', s + 1)
        if e_marker < 0:
            e_marker = find(lines, 'FW_PILLARS', s + 1)
        if e_marker >= 0:
            ranges.append((s, e_marker - 1, 'WARP view'))

    # ── 6. Free World + Issobella ───────────────────────────────
    s = find(lines, 'FW_PILLARS')
    if s < 0:
        s = find(lines, 'function initFreeWorldView')
    if s >= 0:
        e_marker = find(lines, 'function initUpdateUI', s + 1)
        if e_marker < 0:
            e_marker = find(lines, 'function _showProgress', s + 1)
        if e_marker >= 0:
            ranges.append((s, e_marker - 1, 'Free World + Issobella'))

    # Sort and remove
    ranges.sort(key=lambda r: r[0])
    merged = []
    for r in ranges:
        if merged and r[0] <= merged[-1][1] + 1:
            merged[-1] = (merged[-1][0], max(merged[-1][1], r[1]), merged[-1][2] + ' + ' + r[2])
        else:
            merged.append(list(r))
    ranges = [(s, e, d) for s, e, d in merged]

    print(f"\n  Phase 1: {len(ranges)} block ranges to remove")
    lines = remove_ranges(lines, ranges, "blocks")

    # ── Phase 2: Remove individual legacy references ────────────
    print(f"\n  Phase 2: Surgical line removals")
    needles = [
        '_lastMultiStreamStatus',
        'multiStreamStatus',
        'multi-stream-status',
        'onMultiStreamStatus',
        'updateStreamIndicator',
        'stream-indicator',
        'stream-switch',
        'gpu-revenue',
        'gpuRevenue',
        'mode-gpu-revenue-pill',
        'afterburner',
        'ab-card',
        'ab-console',
        'revenue-enabled',
        'revenue-routing',
        'revenueProfile',
        'revenue_',
        'initBridgeView',
        'initDefiView',
        'initOasisView',
        'initFreeWorldView',
        'initIssobellaView',
        'initDaoView',
        'initWarpView',
        # Nav view case blocks
    ]
    total_surgical = 0
    for needle in needles:
        lines, n = remove_lines_containing(lines, needle)
        total_surgical += n
    print(f"  [surgical] Removed {total_surgical} lines")

    lines = cleanup_blank_lines(lines)
    write('src/ui/renderer.js', lines)
    final = len(lines)
    print(f"\n  renderer.js: {total} → {final} lines (removed {total - final})")
    return final


# =============================================================================
# INDEX.HTML CLEANUP
# =============================================================================
def cleanup_html():
    print("\n" + "="*60)
    print("CLEANING index.html")
    print("="*60)
    lines = read('src/ui/index.html')
    total = len(lines)

    # ── 1. Remove entire view sections by id ────────────────────
    views = ['oasis-view', 'bridge-view', 'dao-view', 'warp-view',
             'defi-view', 'freeworld-view', 'issobella-view']
    for view_id in views:
        idx = find(lines, f'id="{view_id}"')
        if idx < 0:
            continue
        # Walk backward to the opening <section or <div tag
        s = idx
        while s > 0 and not re.search(r'<(section|div)\b', lines[s]):
            s -= 1
        tag = 'section' if '<section' in lines[s] else 'div'
        depth = 0
        e = s
        for i in range(s, len(lines)):
            depth += len(re.findall(rf'<{tag}[\s>]', lines[i]))
            depth -= len(re.findall(rf'</{tag}>', lines[i]))
            if depth <= 0 and i > s:
                e = i
                break
        n = e - s + 1
        lines = lines[:s] + lines[e+1:]
        print(f"  {view_id}: -{n} lines")

    # ── 2. Remove nav items for removed views ───────────────────
    for view_name in ['oasis', 'bridge', 'dao', 'warp', 'defi', 'freeworld', 'issobella']:
        idx = find(lines, f'data-view="{view_name}"')
        if idx < 0:
            continue
        # Find the wrapping element (usually 2-5 lines)
        s = idx
        while s > 0 and '<' not in lines[s].strip()[:1]:
            s -= 1
        # Count tags
        e = idx
        depth = 0
        for i in range(s, min(len(lines), s + 10)):
            depth += len(re.findall(r'<(?!\/)[\w]', lines[i]))
            depth -= len(re.findall(r'</[\w]', lines[i]))
            if depth <= 0 and i >= idx:
                e = i
                break
        lines = lines[:s] + lines[e+1:]
        print(f"  nav-{view_name}: -{e-s+1} lines")

    # ── 3. Remove CSS blocks for legacy class families ──────────
    css_prefixes = [
        '.oasis', '.cosmic-', '.cs-', '.game-',
        '.dao-', '.guardian-',
        '.warp-', '.fw-', '.iss-',
        '.bridge-', '.dex-', '.swap-',
        '.ab-', '.afterburner',
        '.revenue-', '.multi-stream',
        '.gpu-revenue', '.defi-', '.lp-farming',
        '.gm-', '.gs-',
    ]
    removed_css = 0
    for prefix in css_prefixes:
        i = 0
        while i < len(lines):
            if prefix in lines[i] and '{' in lines[i]:
                # CSS rule block
                start = i
                depth = lines[i].count('{') - lines[i].count('}')
                end = i
                while depth > 0 and end < len(lines) - 1:
                    end += 1
                    depth += lines[end].count('{') - lines[end].count('}')
                n = end - start + 1
                removed_css += n
                lines = lines[:start] + lines[end+1:]
                continue
            i += 1
    print(f"  CSS legacy classes: -{removed_css} lines")

    # ── 4. Remove @keyframes for legacy animations ──────────────
    keyframes = ['oasisRotate', 'csShipOrbit', 'gsUpgrade', 'cosmoFloat',
                 'alienWalk', 'warpFlow', 'fwPulse', 'daoGlow', 'bridgePulse',
                 'cosmicBounce', 'gameSpin', 'alienFloat', 'saucerFloat',
                 'cosmicFloat', 'shipOrbit', 'moonHover', 'starTwinkle']
    for kf in keyframes:
        idx = find(lines, f'@keyframes {kf}')
        if idx < 0:
            continue
        depth = 0
        e = idx
        for i in range(idx, len(lines)):
            depth += lines[i].count('{') - lines[i].count('}')
            if depth <= 0 and i > idx:
                e = i
                break
        lines = lines[:idx] + lines[e+1:]
        print(f"  @keyframes {kf}: -{e-idx+1}")

    # ── 5. Remove inline legacy HTML elements ───────────────────
    for elem_id in ['revenue-split-badge', 'multi-stream-bar', 'revenue-routing-section',
                     'revenue-enabled', 'ai-afterburner-enabled', 'ab-console-status',
                     'mode-gpu-revenue-pill']:
        idx = find(lines, f'id="{elem_id}"')
        if idx < 0:
            continue
        s = idx
        while s > 0 and not re.search(r'<(div|section|label|input|span)\b', lines[s]):
            s -= 1
        tag_m = re.search(r'<(\w+)', lines[s])
        if not tag_m:
            continue
        tag = tag_m.group(1)
        depth = 0
        e = s
        for i in range(s, min(len(lines), s + 50)):
            depth += len(re.findall(rf'<{tag}[\s>]', lines[i]))
            depth -= len(re.findall(rf'</{tag}>', lines[i]))
            if depth <= 0:
                e = i
                break
        lines = lines[:s] + lines[e+1:]
        print(f"  #{elem_id}: -{e-s+1}")

    # ── 6. Remove legacy JS references in inline scripts ────────
    legacy_needles = [
        'afterburner', 'multiStream', 'multi-stream',
        'gpuRevenue', 'gpu-revenue', 'revenueProfile',
        'oasis', 'cosmicMine', 'cosmic-mine',
        'daoView', 'warpView', 'bridgeView',
        'freeWorld', 'issobella',
    ]
    for needle in legacy_needles:
        i = 0
        while i < len(lines):
            if needle in lines[i] and '<script' not in lines[i]:
                # Don't remove structural CSS/HTML that might have partial matches
                # Only remove if it's clearly a JS reference or a standalone element
                stripped = lines[i].strip()
                if stripped.startswith('//') or stripped.startswith('case ') or 'addEventListener' in stripped or needle + '(' in stripped:
                    lines = lines[:i] + lines[i+1:]
                    continue
            i += 1

    lines = cleanup_blank_lines(lines)
    write('src/ui/index.html', lines)
    final = len(lines)
    print(f"\n  index.html: {total} → {final} lines (removed {total - final})")
    return final


# =============================================================================
# MAIN
# =============================================================================
if __name__ == '__main__':
    print("ZION V3 Agent Cleanup v2")
    print("=" * 60)

    # Verify backups exist
    for f in ['src/main.js.bak', 'src/ui/renderer.js.bak', 'src/ui/index.html.bak']:
        if not os.path.exists(fpath(f)):
            print(f"ERROR: Backup not found: {f}")
            print("Run first: copy src/main.js src/main.js.bak (etc)")
            sys.exit(1)

    m = cleanup_main()
    r = cleanup_renderer()
    h = cleanup_html()
    print(f"\n{'=' * 60}")
    print(f"DONE: main.js={m}, renderer.js={r}, index.html={h}")
    print(f"Validate: node --check src/main.js")
    print(f"Restore:  copy src/main.js.bak src/main.js (etc)")
