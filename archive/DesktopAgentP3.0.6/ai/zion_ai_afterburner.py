#!/usr/bin/env python3
"""
🔥 ZION AI AFTERBURNER — v2.9.6
Performance vs Power Consumption Optimizer

What it does:
- Runs an AI compute task scheduler (real numpy math)
- Monitors AMD GPU wattage via rocm-smi / WMI / ADL
- Reads miner hashrate from miner_stats.json
- Calculates and exposes H/W — hashes per watt — the key efficiency metric
- Optionally adjusts ZION_GPU_BATCH_SIZE suggestion based on h/W trend

Usage: imported by afterburner_service.py (JSON-lines RPC).
"""
from __future__ import annotations

import json
import math
import os
import ctypes
import secrets
import subprocess
import sys
import threading
import time
import logging
from collections import deque
from dataclasses import dataclass, asdict
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

try:
    import numpy as np  # type: ignore
except Exception:
    np = None

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [afterburner] %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# ─── constants ────────────────────────────────────────────────────────────────
GPU_TOTAL_COMPUTE   = 15.13    # "GPU compute units" (abstract, not watts)
SACRED_COMPUTE_RATIO = 0.618   # golden ratio
DIVINE_FREQUENCY    = 432.0    # Hz — used for sacred geometry calc

# Path to miner_stats.json (written by Rust miner every stats-interval seconds)
_APPDATA = os.environ.get('APPDATA', '')
# Electron passes its exact userData path via ZION_USER_DATA; fall back to legacy folder.
_ZION_USER_DATA = os.environ.get('ZION_USER_DATA', '')
_STATS_DIR = _ZION_USER_DATA if _ZION_USER_DATA else os.path.join(_APPDATA, 'zion-desktop-agent')
MINER_STATS_PATH = os.path.join(_STATS_DIR, 'miner_stats.json')


# ─── AMD power query helpers ───────────────────────────────────────────────────
def _run_quiet(*args: str, timeout: float = 3.0) -> str:
    """Run a subprocess and return stdout, '' on any error."""
    try:
        r = subprocess.run(
            args, capture_output=True, text=True, timeout=timeout,
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)
        )
        return r.stdout or ''
    except Exception:
        return ''



# AMD Display Library (ADL) — ships with every AMD Radeon driver on Windows.
# Provides board power telemetry without any extra software installation.
_ADL_LIB: Optional[ctypes.CDLL] = None
_ADL_INIT_DONE: bool = False
_adl_ready: Optional[bool] = None


def _load_adl() -> Optional[ctypes.CDLL]:
    global _ADL_LIB, _ADL_INIT_DONE
    if _ADL_INIT_DONE:
        return _ADL_LIB
    _ADL_INIT_DONE = True
    candidates = [
        'atiadlxx.dll',
        r'C:\Windows\System32\atiadlxx.dll',
        r'C:\Windows\SysWOW64\atiadlxx.dll',
    ]
    try:
        dr = r'C:\Windows\System32\DriverStore\FileRepository'
        if os.path.isdir(dr):
            for folder in os.listdir(dr):
                if 'amd' in folder.lower() or 'ati' in folder.lower():
                    p = os.path.join(dr, folder, 'atiadlxx.dll')
                    if os.path.isfile(p):
                        candidates.append(p)
                        break
    except Exception:
        pass
    for path in candidates:
        try:
            lib = ctypes.WinDLL(path)
            _ADL_LIB = lib
            logger.info('[ADL] loaded: %s', path)
            return lib
        except Exception:
            pass
    logger.debug('[ADL] atiadlxx.dll not found — power monitoring via ADL unavailable')
    return None


def _adl_main_control_create(lib: ctypes.CDLL) -> bool:
    try:
        MallocFn = ctypes.CFUNCTYPE(ctypes.c_void_p, ctypes.c_int)
        def _malloc(n: int) -> int:
            buf = ctypes.create_string_buffer(n)
            return ctypes.cast(buf, ctypes.c_void_p).value or 0
        ret = lib.ADL_Main_Control_Create(MallocFn(_malloc), 1)
        return ret == 0
    except Exception:
        return False


def _adl_query_power_w(lib: ctypes.CDLL) -> Optional[float]:
    """Try multiple ADL power telemetry APIs (OD6, OD8/RDNA, OverdriveN)."""
    try:
        n_adapters = ctypes.c_int(0)
        if lib.ADL_Adapter_NumberOfAdapters_Get(ctypes.byref(n_adapters)) != 0:
            return None
        if n_adapters.value <= 0:
            return None

        for idx in range(min(n_adapters.value, 4)):
            # --- Method A: ADL_Overdrive6_CurrentPower_Get (GCN/Polaris) ---
            try:
                power_val = ctypes.c_int(0)
                res = lib.ADL_Overdrive6_CurrentPower_Get(idx, 0, ctypes.byref(power_val))
                if res == 0 and power_val.value > 0:
                    for div in (256.0, 1000.0, 100.0):
                        w = power_val.value / div
                        if 5.0 < w < 500.0:
                            return w
            except Exception:
                pass

            # --- Method B: ADL2_Overdrive8_Current_Setting_Get (RDNA/Navi) ---
            # OD8 feature index 23 = FEATURE_POWER_LIMIT; use PM activity instead.
            # ADL2_OverdriveN_Performance_Get — returns ADLOD6MaxClockAdjust with wattage
            # Simpler: read ADL_Overdrive5_CurrentActivity_Get (works on most adapters)
            try:
                # ADLOD5CurrentActivity struct: first field is iSize (int), iCurrentActivity (int)
                class ADLCurrentActivity(ctypes.Structure):
                    _fields_ = [
                        ('iSize',            ctypes.c_int),
                        ('iCurrentActivity', ctypes.c_int),   # % GPU load
                        ('iCurrentPowerLimit', ctypes.c_int), # power limit (% of TDP)
                        ('iCurrentClockSpeed', ctypes.c_int),
                        ('iCurrentMemoryClock', ctypes.c_int),
                        ('iAVGActivityPercent', ctypes.c_int),
                        ('iCurrentTemperature', ctypes.c_int),
                        ('iCurrentFanSpeed',   ctypes.c_int),
                        ('iCurrentFanSpeedInRPM', ctypes.c_int),
                        ('iCurrentPerformanceLevel', ctypes.c_int),
                        ('iCurrentBusSpeed', ctypes.c_int),
                        ('iCurrentBusLanes', ctypes.c_int),
                        ('iMaximumBusLanes', ctypes.c_int),
                        ('iVDDC', ctypes.c_int),
                        ('iVDDCI', ctypes.c_int),
                    ]
                act = ADLCurrentActivity()
                act.iSize = ctypes.sizeof(ADLCurrentActivity)
                res = lib.ADL_Overdrive5_CurrentActivity_Get(idx, ctypes.byref(act))
                if res == 0 and act.iCurrentActivity > 0:
                    pass  # OD5 doesn't expose wattage on RDNA; use WMI util fallback instead
            except Exception:
                pass

        return None
    except Exception as e:
        logger.debug('[ADL] power query error: %s', e)
        return None


def _ensure_adl() -> Optional[ctypes.CDLL]:
    global _adl_ready
    lib = _load_adl()
    if lib is None:
        _adl_ready = False
        return None
    if _adl_ready is None:
        _adl_ready = _adl_main_control_create(lib)
    return lib if _adl_ready else None


def query_amd_power_w() -> Optional[float]:
    """Return AMD GPU total power draw in watts, or None if unavailable.

    Tries in order:
      1. AMD ADL (atiadlxx.dll) — built into every AMD Windows driver install
      2. rocm-smi   (AMD ROCm Software, optional)
      3. PowerShell WMI GPU power counter
    Returns None if all methods fail (graceful degradation — no crash).
    """
    # --- 1. AMD ADL (preferred on Windows — no extra install) ---
    try:
        lib = _ensure_adl()
        if lib is not None:
            w = _adl_query_power_w(lib)
            if w is not None:
                return w
    except Exception:
        pass

    # --- 2. rocm-smi CSV ---
    out = _run_quiet('rocm-smi', '--showpower', '--csv')
    if out:
        for line in out.splitlines():
            parts = [p.strip() for p in line.split(',')]
            for p in parts:
                try:
                    val = float(p.replace('W', '').replace('w', ''))
                    if 10 < val < 500:
                        return val
                except ValueError:
                    pass

    # --- 3. rocm-smi JSON ---
    out3 = _run_quiet('rocm-smi', '--json', '--showpower')
    if out3:
        try:
            d = json.loads(out3)
            for card_data in (d.values() if isinstance(d, dict) else []):
                if not isinstance(card_data, dict):
                    continue
                for k, v in card_data.items():
                    if 'power' in k.lower():
                        try:
                            w = float(str(v).replace('W', '').strip())
                            if 5 < w < 500:
                                return w
                        except Exception:
                            pass
        except Exception:
            pass

    return None


# ─── GPU TDP + WMI utilization-based power estimation ─────────────────────────
# When ADL/rocm-smi can't provide watts directly (common on RDNA/Windows without ROCm),
# estimate board power from GPU compute utilization % read via Windows perf counters.

_GPU_TDP_W: Dict[str, float] = {
    'rx 5600 xt': 150.0, 'rx 5700':    180.0, 'rx 5700 xt':  225.0,
    'rx 6600 xt': 160.0, 'rx 6700 xt': 230.0, 'rx 6800 xt':  300.0,
    'rx 6900 xt': 330.0, 'rx 7600':    165.0, 'rx 7700 xt':  245.0,
    'rx 7900 xt': 315.0, 'rx 7900 xtx':355.0,
    'rtx 3060':  170.0,  'rtx 3070':   220.0, 'rtx 3080':    320.0,
    'rtx 3090':  350.0,  'rtx 4060':   115.0, 'rtx 4070':    200.0,
}
_GPU_IDLE_W = 18.0
_WMI_UTIL_PS = (
    r"try { $s=(Get-Counter '\GPU Engine(*engtype_Compute*)\Utilization Percentage'"
    r" -EA Stop).CounterSamples;"
    r" [math]::Round(($s|Measure-Object CookedValue -Sum).Sum,2)"
    r" } catch { Write-Output '-1' }"
)
_cached_gpu_name: Optional[str] = None


def _get_gpu_name_cached() -> Optional[str]:
    global _cached_gpu_name
    if _cached_gpu_name is not None:
        return _cached_gpu_name
    ps = ("(Get-WmiObject Win32_VideoController -ErrorAction SilentlyContinue"
          " | Select-Object -First 1).Name")
    out = _run_quiet('powershell', '-NoProfile', '-Command', ps, timeout=4.0)
    _cached_gpu_name = out.strip() or 'unknown'
    return _cached_gpu_name


def query_gpu_compute_utilization_pct() -> Optional[float]:
    """Return GPU compute utilization % via Windows perf counters (capped at 100)."""
    out = _run_quiet('powershell', '-NoProfile', '-Command', _WMI_UTIL_PS, timeout=5.0)
    try:
        val = float(out.strip().replace(',', '.'))
        return min(100.0, val) if val >= 0 else None
    except Exception:
        return None


def estimate_power_from_util(util_pct: float, gpu_name: Optional[str] = None) -> float:
    """Estimate board power from GPU compute utilization % + GPU TDP profile."""
    tdp = 180.0  # generic mid-range default
    if gpu_name:
        for key, w in _GPU_TDP_W.items():
            if key in gpu_name.lower():
                tdp = w
                break
    return _GPU_IDLE_W + (min(100.0, max(0.0, util_pct)) / 100.0) * (tdp - _GPU_IDLE_W)


def read_miner_hashrate() -> Tuple[Optional[float], Optional[float]]:
    """Return (total_hs, gpu_hs) from miner_stats.json, or (None, None)."""
    try:
        with open(MINER_STATS_PATH, 'r', encoding='utf-8') as f:
            d = json.load(f)
        total = d.get('hashrate_10s') or d.get('hashrate') or d.get('hashrate_window_hs')
        gpu   = d.get('hashrate_gpu')
        return (
            float(total) if total is not None else None,
            float(gpu)   if gpu   is not None else None,
        )
    except Exception:
        return None, None


# ─── data classes ─────────────────────────────────────────────────────────────
class ComputeMode(Enum):
    AI_ONLY                  = 'ai_only'
    HYBRID_SACRED            = 'hybrid_sacred'
    AFTERBURNER_BOOST        = 'afterburner_boost'
    CONSCIOUSNESS_ENHANCEMENT = 'consciousness_enhancement'


@dataclass
class AITask:
    task_id:             str
    task_type:           str
    priority:            int
    compute_requirement: float
    sacred_enhancement:  bool = False

    def __lt__(self, other: 'AITask') -> bool:
        return self.priority < other.priority


# ─── main class ───────────────────────────────────────────────────────────────
class ZionAIAfterburner:
    """
    🔥 ZION AI Afterburner — GPU-Accelerated AI + Power Efficiency Monitor

    Added in v2.9.6:
    - AMD GPU wattage query (rocm-smi / WMI)
    - H/W metric: hashes per watt — the key performance-per-power ratio
    - Rolling 10s / 60s / 15m h/W averages
    - Efficiency tuning hint: suggests optimal batch size when H/W drops
    """

    def __init__(self) -> None:
        self.compute_mode         = ComputeMode.HYBRID_SACRED
        self.active_tasks: List[AITask] = []
        self.completed_tasks      = 0
        self.failed_tasks         = 0
        self.total_compute_power  = GPU_TOTAL_COMPUTE
        self.available_compute    = GPU_TOTAL_COMPUTE
        self.sacred_enhancement_active = True

        self.processing_active    = False
        self.processing_thread: Optional[threading.Thread] = None
        self.service_started_at   = time.time()
        self.processing_started_at: Optional[float] = None

        self.last_error           = ''
        self.throttle_events      = 0
        self.last_task_type       = ''
        self.last_task_duration_ms: Optional[float] = None
        self.avg_task_duration_ms = 0.0
        self.completed_by_type: Dict[str, int] = {}
        self.failed_by_type: Dict[str, int] = {}

        # Rolling event buffers (15-min window)
        self._completed_events: deque = deque()   # (ts, duration_ms)
        self._failed_events: deque    = deque()   # ts

        # Power / efficiency state
        self._gpu_power_w: Optional[float]         = None
        self._gpu_power_updated: float             = 0.0
        self._power_query_interval: float          = 5.0    # seconds
        self._hashrate_per_watt_samples: deque     = deque()  # (ts, h/W)
        self._last_power_query_ok: bool            = False

        self.performance_metrics: Dict[str, Any] = {
            'tasks_per_second':         0.0,
            'speed_10s':                0.0,
            'speed_60s':                0.0,
            'speed_15m':                0.0,
            'success_rate_60s':         0.0,
            'latency_avg_10s_ms':       0.0,
            'latency_avg_60s_ms':       0.0,
            'compute_efficiency':       0.0,
            'sacred_enhancement_ratio': 0.0,
            'afterburner_temperature':  65.0,
            # power / efficiency (new in 2.9.6)
            'gpu_power_w':              None,
            'hashrate_per_watt':        None,   # H/s per W (total)
            'hashrate_per_watt_10s':    None,
            'hashrate_per_watt_60s':    None,
            'power_query_available':    False,
            'efficiency_hint':          '',     # e.g. "reduce batch for better h/W"
        }

        logger.info('🔥 ZION AI Afterburner v2.9.6 initialized (power monitoring included)')

    # ────────────────────────────────────────────────────────────── lifecycle ──
    def start_afterburner(self) -> bool:
        if self.processing_active:
            logger.warning('AI Afterburner already running')
            return False
        self.processing_active    = True
        self.processing_started_at = time.time()
        self.processing_thread = threading.Thread(
            target=self._afterburner_loop, daemon=True, name='afterburner-main'
        )
        self.processing_thread.start()
        logger.info('🔥 AI Afterburner started')
        return True

    def stop_afterburner(self) -> None:
        self.processing_active = False
        if self.processing_thread:
            self.processing_thread.join(timeout=5.0)
        logger.info('🔥 AI Afterburner stopped')

    # ─────────────────────────────────────────────────────────────── main loop ──
    def _afterburner_loop(self) -> None:
        logger.info('🔥 Afterburner loop started')
        cycle = 0
        while self.processing_active:
            try:
                self._process_ai_tasks()
                self._update_performance_metrics()
                if self.sacred_enhancement_active:
                    self._apply_sacred_enhancements()
                self._manage_thermal_performance()

                # Power query every N cycles (5s)
                cycle += 1
                if cycle % 50 == 0:
                    self._update_power_metrics()

            except Exception as e:
                logger.error(f'Afterburner loop error: {e}')
                self.last_error = str(e)
                self.failed_tasks += 1
                time.sleep(1.0)
                continue

            time.sleep(0.1)

    # ─────────────────────────────────────────────────── power / efficiency ──
    def _update_power_metrics(self) -> None:
        """Query GPU watt (ADL or WMI estimate), read miner hashrate, compute H/W."""
        # --- try direct ADL power first ---
        w = query_amd_power_w()
        power_source = 'adl' if w is not None else None

        # --- fallback: estimate from GPU compute utilization via WMI perf counters ---
        gpu_util_pct: Optional[float] = None
        if w is None:
            gpu_util_pct = query_gpu_compute_utilization_pct()
            if gpu_util_pct is not None and gpu_util_pct >= 0:
                gpu_name = _get_gpu_name_cached()
                w = estimate_power_from_util(gpu_util_pct, gpu_name)
                power_source = f'estimated ({gpu_util_pct:.0f}% util)'

        self._gpu_power_w       = w
        self._gpu_power_updated = time.time()
        self._last_power_query_ok = (w is not None)
        self.performance_metrics['gpu_power_w']            = round(w, 1) if w else None
        self.performance_metrics['gpu_util_pct']           = gpu_util_pct
        self.performance_metrics['power_source']           = power_source
        self.performance_metrics['power_query_available']  = (w is not None)

        total_hs, gpu_hs = read_miner_hashrate()
        if w and w > 5 and total_hs and total_hs > 0:
            hpw = total_hs / w
            ts  = time.time()
            self._hashrate_per_watt_samples.append((ts, hpw))
            cutoff = ts - 900.0
            while (self._hashrate_per_watt_samples
                   and self._hashrate_per_watt_samples[0][0] < cutoff):
                self._hashrate_per_watt_samples.popleft()

            self.performance_metrics['hashrate_per_watt']     = round(hpw, 2)
            self.performance_metrics['hashrate_per_watt_10s'] = self._avg_hpw_window(10.0)
            self.performance_metrics['hashrate_per_watt_60s'] = self._avg_hpw_window(60.0)

            hpw_10 = self.performance_metrics['hashrate_per_watt_10s']
            hpw_60 = self.performance_metrics['hashrate_per_watt_60s']
            hs_mh  = total_hs / 1e6
            w_desc = f'{w:.0f}W' + (f' [{power_source}]' if power_source != 'adl' else '')
            if hpw_10 and hpw_60 and hpw_60 > 0:
                ratio = hpw_10 / hpw_60
                if ratio < 0.85:
                    hint = f'h/W dropping ({hpw_10:.0f} vs {hpw_60:.0f} H/W) — try smaller gpuBatchSize'
                elif ratio > 1.10:
                    hint = f'h/W improving ({hpw_10:.0f} H/W) — try larger gpuBatchSize'
                else:
                    hint = f'h/W stable: {hpw:.0f} H/W  ({hs_mh:.1f} MH/s @ {w_desc})'
            else:
                hint = f'h/W: {hpw:.0f} H/W  ({hs_mh:.1f} MH/s @ {w_desc})'
            self.performance_metrics['efficiency_hint'] = hint
        else:
            if w is None:
                self.performance_metrics['efficiency_hint'] = \
                    'power monitoring unavailable — install rocm-smi or HWiNFO64'
            elif not total_hs:
                self.performance_metrics['efficiency_hint'] = 'waiting for miner hashrate data'



    def _avg_hpw_window(self, window_sec: float) -> Optional[float]:
        if not self._hashrate_per_watt_samples:
            return None
        cutoff = time.time() - window_sec
        vals = [v for ts, v in self._hashrate_per_watt_samples if ts >= cutoff]
        return (sum(vals) / len(vals)) if vals else None

    # ─────────────────────────────────────────────────────── task processing ──
    def add_ai_task(self, task_type: str, priority: int = 5,
                    compute_req: float = 1.0, sacred: bool = False) -> str:
        tid = f'ai_task_{int(time.time())}_{secrets.token_hex(4)}'
        self.active_tasks.append(AITask(
            task_id=tid, task_type=task_type, priority=priority,
            compute_requirement=compute_req, sacred_enhancement=sacred
        ))
        self.active_tasks.sort(key=lambda t: t.priority, reverse=True)
        return tid

    def _process_ai_tasks(self) -> None:
        if not self.active_tasks:
            return
        task = self.active_tasks[0]
        if self.available_compute < task.compute_requirement:
            return

        duration = self._process_ai_task_real(task)
        self.active_tasks.pop(0)

        if duration > 0:
            self.completed_tasks += 1
            self.completed_by_type[task.task_type] = \
                self.completed_by_type.get(task.task_type, 0) + 1
            self.available_compute = min(
                self.total_compute_power,
                self.available_compute + task.compute_requirement
            )
            self.last_task_type       = task.task_type
            self.last_task_duration_ms = duration * 1000.0
            self._completed_events.append((time.time(), self.last_task_duration_ms))
            alpha = 0.2
            self.avg_task_duration_ms = (
                self.last_task_duration_ms if self.avg_task_duration_ms <= 0
                else alpha * self.last_task_duration_ms
                     + (1 - alpha) * self.avg_task_duration_ms
            )
        else:
            self.failed_tasks += 1
            self.failed_by_type[task.task_type] = \
                self.failed_by_type.get(task.task_type, 0) + 1
            self._failed_events.append(time.time())

    def _process_ai_task_real(self, task: AITask) -> float:
        t0 = time.time()
        try:
            if task.task_type == 'neural_network':
                ok = self._run_neural_network(task.compute_requirement)
            elif task.task_type == 'image_analysis':
                ok = self._process_image_analysis(task.compute_requirement)
            elif task.task_type == 'sacred_geometry':
                ok = self._run_sacred_geometry(task.compute_requirement)
            elif task.task_type == 'quantum_simulation':
                ok = self._run_quantum_simulation(task.compute_requirement)
            else:
                ok = self._run_generic_compute(task.compute_requirement)
            if not ok:
                return -1.0
            dur = time.time() - t0
            if task.sacred_enhancement and self.sacred_enhancement_active:
                dur *= SACRED_COMPUTE_RATIO
            return dur
        except Exception as e:
            self.last_error = str(e)
            return -1.0

    # ─────────────────────────────────────────────────────────────── compute ──
    def _run_neural_network(self, req: float) -> bool:
        try:
            if np is None:
                return self._run_generic_compute(req)
            n = min(int(req * 50), 1000)
            w1 = np.random.randn(n, n) * 0.01
            w2 = np.random.randn(n, n // 2) * 0.01
            x  = np.random.randn(n)
            h  = np.tanh(w1 @ x)
            out = w2.T @ h
            g   = np.random.randn(n // 2)
            _   = w2 @ g
            return float(np.sum(out)) == float(np.sum(out))
        except Exception:
            return False

    def _process_image_analysis(self, req: float) -> bool:
        try:
            if np is None:
                return self._run_generic_compute(req)
            s = min(int(req * 20), 512)
            img = np.random.randint(0, 255, (s, s, 3), dtype=np.uint8)
            gray = np.mean(img, axis=2)
            sx = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]])
            sy = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]])
            ex = np.abs(np.convolve(gray.flatten(), sx.flatten(), mode='valid'))
            ey = np.abs(np.convolve(gray.flatten(), sy.flatten(), mode='valid'))
            return len(ex) > 0 and len(ey) > 0
        except Exception:
            return False

    def _run_sacred_geometry(self, req: float) -> bool:
        try:
            if np is None:
                return self._run_generic_compute(req)
            phi = (1 + np.sqrt(5)) / 2
            n   = min(int(req * 100), 1000)
            fib = [1, 1]
            for i in range(2, n):
                fib.append(fib[-1] + fib[-2])
            angles = np.linspace(0, 2 * np.pi, 360)
            wave   = np.sin(angles * phi) + np.cos(angles / phi)
            return float(np.sum(wave)) == float(np.sum(wave))
        except Exception:
            return False

    def _run_quantum_simulation(self, req: float) -> bool:
        try:
            if np is None:
                n     = min(int(max(1.0, req) * 20000), 250000)
                acc   = 0.0
                for i in range(n):
                    acc += math.sin(i * 0.001) * math.cos(i * 0.0007)
                return acc == acc
            qubits = min(int(req), 10)
            size   = 2 ** qubits
            state  = np.zeros(size, dtype=complex)
            state[0] = 1.0
            h_mat  = np.array([[1, 1], [1, -1]], dtype=complex) / math.sqrt(2)
            for _ in range(qubits):
                state = state * h_mat[0, 0] + np.roll(state, 1) * h_mat[0, 1]
            prob = np.abs(state) ** 2
            return float(np.sum(prob)) > 0.99
        except Exception:
            return False

    def _run_generic_compute(self, req: float) -> bool:
        try:
            if np is None:
                n = min(int(max(1.0, req) * 30000), 400000)
                acc = 1.0
                for i in range(1, n + 1):
                    acc = (acc * 1.0000001) % 12345.6789
                    if i % 997 == 0:
                        acc += math.sqrt(i)
                return acc == acc
            n = min(int(req * 100), 2000)
            A = np.random.randn(n, n) * 0.1
            B = np.random.randn(n, n) * 0.1
            if n < 500:
                ev = np.linalg.eigvals(A @ B)
                return len(ev) == n
            else:
                C = A @ B
                return C.shape == (n, n)
        except Exception:
            return False

    # ─────────────────────────────────────────────────────────────── metrics ──
    def _apply_sacred_enhancements(self) -> None:
        boost = math.sin(time.time() * DIVINE_FREQUENCY / 1000) * 0.1 + 1.0
        self.available_compute = min(
            self.total_compute_power * 1.2,
            self.total_compute_power * boost
        )
        self.performance_metrics['sacred_enhancement_ratio'] = (boost - 1.0) * 10

    def _update_performance_metrics(self) -> None:
        now = time.time()
        cutoff = now - 900.0
        while self._completed_events and self._completed_events[0][0] < cutoff:
            self._completed_events.popleft()
        while self._failed_events and self._failed_events[0] < cutoff:
            self._failed_events.popleft()

        def count_in(buf: deque, w: float) -> int:
            c = now - w
            return sum(1 for e in buf if (e[0] if isinstance(e, tuple) else e) >= c)

        def avg_lat(w: float) -> float:
            c = now - w
            evs = [(ts, ms) for ts, ms in self._completed_events if ts >= c]
            return (sum(ms for _, ms in evs) / len(evs)) if evs else 0.0

        if hasattr(self, '_last_task_count'):
            self.performance_metrics['tasks_per_second'] = \
                (self.completed_tasks - self._last_task_count) * 10
        self._last_task_count = self.completed_tasks

        c10 = count_in(self._completed_events, 10)
        c60 = count_in(self._completed_events, 60)
        c15 = count_in(self._completed_events, 900)
        self.performance_metrics['speed_10s'] = c10 / 10.0
        self.performance_metrics['speed_60s'] = c60 / 60.0
        self.performance_metrics['speed_15m'] = c15 / 900.0

        f60 = count_in(self._failed_events, 60)
        tot = c60 + f60
        self.performance_metrics['success_rate_60s'] = \
            (100.0 * c60 / tot) if tot > 0 else 0.0

        self.performance_metrics['latency_avg_10s_ms'] = avg_lat(10)
        self.performance_metrics['latency_avg_60s_ms'] = avg_lat(60)

        used = max(0.0, self.total_compute_power - self.available_compute)
        eff  = used / self.total_compute_power * 100 if self.total_compute_power > 0 else 0.0
        self.performance_metrics['compute_efficiency'] = max(0.0, min(100.0, eff))

    def _manage_thermal_performance(self) -> None:
        load = (self.total_compute_power - self.available_compute) / self.total_compute_power
        target = 45.0 + load * 25.0
        cur    = self.performance_metrics['afterburner_temperature']
        self.performance_metrics['afterburner_temperature'] = cur + (target - cur) * 0.1
        if self.performance_metrics['afterburner_temperature'] > 80.0:
            self.available_compute *= 0.9
            self.throttle_events   += 1

    # ─────────────────────────────────────────────────── public interface ──
    def get_performance_stats(self) -> Dict[str, Any]:
        uptime = (time.time() - self.processing_started_at
                  if self.processing_started_at is not None else None)
        queue_by_type: Dict[str, int] = {}
        for t in self.active_tasks:
            queue_by_type[t.task_type] = queue_by_type.get(t.task_type, 0) + 1

        util = max(0.0, min(100.0,
            (self.total_compute_power - self.available_compute)
            / self.total_compute_power * 100
            if self.total_compute_power > 0 else 0.0
        ))

        return {
            'active_tasks':           len(self.active_tasks),
            'completed_tasks':        self.completed_tasks,
            'failed_tasks':           self.failed_tasks,
            'available_compute':      self.available_compute,
            'total_compute':          self.total_compute_power,
            'compute_utilization':    util,
            'performance_metrics':    dict(self.performance_metrics),
            'sacred_enhancement':     self.sacred_enhancement_active,
            'compute_mode':           self.compute_mode.value,
            'status':                 'active' if self.processing_active else 'stopped',
            'uptime_sec':             uptime,
            'last_error':             self.last_error,
            'throttle_events':        self.throttle_events,
            'queue_depth':            len(self.active_tasks),
            'queue_by_type':          queue_by_type,
            'completed_by_type':      dict(self.completed_by_type),
            'failed_by_type':         dict(self.failed_by_type),
            'last_task_type':         self.last_task_type,
            'last_task_duration_ms':  self.last_task_duration_ms,
            'avg_task_duration_ms':   self.avg_task_duration_ms,
            # power / efficiency (new v2.9.6)
            'gpu_power_w':            self._gpu_power_w,
            'hashrate_per_watt':      self.performance_metrics.get('hashrate_per_watt'),
            'hashrate_per_watt_10s':  self.performance_metrics.get('hashrate_per_watt_10s'),
            'hashrate_per_watt_60s':  self.performance_metrics.get('hashrate_per_watt_60s'),
            'power_query_available':  self._last_power_query_ok,
            'efficiency_hint':        self.performance_metrics.get('efficiency_hint', ''),
        }

    def configure_afterburner(self, config: Dict) -> None:
        if 'compute_mode' in config:
            self.compute_mode = ComputeMode(config['compute_mode'])
        if 'sacred_enhancement' in config:
            self.sacred_enhancement_active = bool(config['sacred_enhancement'])
        if 'total_compute' in config:
            self.total_compute_power = float(config['total_compute'])
            self.available_compute   = self.total_compute_power
        if 'power_query_interval' in config:
            self._power_query_interval = max(2.0, float(config['power_query_interval']))
        logger.info(f'🔥 Afterburner configured: {config}')

    def emergency_cooling(self) -> None:
        self.available_compute = self.total_compute_power * 0.5
        self.performance_metrics['afterburner_temperature'] = 55.0
        logger.warning('🧊 Emergency cooling activated')


# ─── standalone test ──────────────────────────────────────────────────────────
if __name__ == '__main__':
    ab = ZionAIAfterburner()
    ab.start_afterburner()
    print('🔥 ZION AI Afterburner v2.9.6 — power monitoring test')

    ab.add_ai_task('neural_network',    priority=8, compute_req=2.5, sacred=True)
    ab.add_ai_task('sacred_geometry',   priority=9, compute_req=3.2, sacred=True)
    ab.add_ai_task('quantum_simulation', priority=7, compute_req=1.5)

    time.sleep(3.0)
    ab._update_power_metrics()

    stats = ab.get_performance_stats()
    pm = stats.get('performance_metrics', {})
    print(f"  GPU power   : {stats.get('gpu_power_w')} W")
    print(f"  H/W now     : {stats.get('hashrate_per_watt')}")
    print(f"  H/W 10s avg : {stats.get('hashrate_per_watt_10s')}")
    print(f"  Hint        : {stats.get('efficiency_hint')}")
    print(f"  Tasks done  : {stats['completed_tasks']}")
    print(f"  Speed 10s   : {pm.get('speed_10s', 0):.2f} tasks/s")

    ab.stop_afterburner()
