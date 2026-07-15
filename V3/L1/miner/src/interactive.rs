//! Interactive TUI for zion-miner
//!
//! Cross-platform keyboard control using crossterm:
//!   h  = toggle hashrate dashboard
//!   a  = cycle algorithm (Lite v1 -> Fire -> Ekam v2)
//!   c  = toggle CPU mining
//!   g  = toggle GPU mining
//!   d  = toggle dual mode
//!   i  = show hardware info
//!   p  = pause / resume
//!   r  = reconnect to pool
//!   v  = toggle verbose wire logging
//!   1-9 = set thread count
//!   q / Esc = quit gracefully

#![allow(dead_code)]

use std::collections::VecDeque;
use std::io::{self, stdout, Write};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use crossterm::{
    cursor,
    event::{self, Event, KeyCode, KeyEvent, KeyModifiers},
    execute, queue,
    style::{Color, Print, ResetColor, SetBackgroundColor, SetForegroundColor},
    terminal::{self, ClearType},
};

use crate::ui;

/* ========================================================================= */
/* Shared control state                                                      */
/* ========================================================================= */

#[derive(Debug, Clone)]
pub enum MiningMode {
    CpuOnly,
    GpuOnly,
    Dual,
}

#[derive(Debug, Clone)]
pub struct MinerControl {
    pub pause: bool,
    pub algorithm: String,
    pub mode: MiningMode,
    pub cpu_enabled: bool,
    pub gpu_enabled: bool,
    pub dual_mode: bool,
    pub threads: usize,
    pub show_dashboard: bool,
    pub verbose: bool,
    pub requested_reconnect: bool,
    pub requested_quit: bool,
    pub thread_override: Option<usize>,
}

impl MinerControl {
    pub fn new(algorithm: &str, threads: usize, gpu: bool) -> Self {
        Self {
            pause: false,
            algorithm: algorithm.to_string(),
            mode: if gpu {
                MiningMode::GpuOnly
            } else {
                MiningMode::CpuOnly
            },
            cpu_enabled: !gpu,
            gpu_enabled: gpu,
            dual_mode: false,
            threads,
            show_dashboard: true,
            verbose: false,
            requested_reconnect: false,
            requested_quit: false,
            thread_override: None,
        }
    }

    pub fn cycle_algorithm(&mut self) {
        const ALGOS: &[&str] = &[
            "deeksha_lite_v1",
            "deeksha_lite_fire",
            "cosmic_harmony_ekam_deeksha_v2",
        ];
        let idx = ALGOS.iter().position(|&a| a == self.algorithm).unwrap_or(0);
        self.algorithm = ALGOS[(idx + 1) % ALGOS.len()].to_string();
    }

    pub fn toggle_cpu(&mut self) {
        self.cpu_enabled = !self.cpu_enabled;
        self.recompute_mode();
    }

    pub fn toggle_gpu(&mut self) {
        self.gpu_enabled = !self.gpu_enabled;
        self.recompute_mode();
    }

    pub fn toggle_dual(&mut self) {
        self.dual_mode = !self.dual_mode;
        if self.dual_mode {
            self.cpu_enabled = true;
            self.gpu_enabled = true;
        }
        self.recompute_mode();
    }

    fn recompute_mode(&mut self) {
        self.mode = match (self.cpu_enabled, self.gpu_enabled, self.dual_mode) {
            (true, true, true) => MiningMode::Dual,
            (true, true, false) => MiningMode::GpuOnly,
            (true, false, _) => MiningMode::CpuOnly,
            (false, true, _) => MiningMode::GpuOnly,
            (false, false, _) => {
                self.cpu_enabled = true;
                MiningMode::CpuOnly
            }
        };
    }
}

/* ========================================================================= */
/* Global TUI mode flag                                                      */
/* ========================================================================= */

/// Set to true when interactive TUI is active.
/// maybe_print_status() and print_speed_table() check this to suppress
/// stdout output that would interfere with the alternate-screen dashboard.
pub static TUI_ACTIVE: AtomicBool = AtomicBool::new(false);

/* ========================================================================= */
/* Hashrate tracker with sliding time windows                                */
/* ========================================================================= */

/// One sample: (timestamp, cumulative total hashes at that moment)
struct Sample {
    ts: Instant,
    total: u64,
}

struct Window {
    samples: VecDeque<Sample>,
    max_age_secs: u64,
}

impl Window {
    fn new(max_age_secs: u64) -> Self {
        Self {
            samples: VecDeque::new(),
            max_age_secs,
        }
    }

    fn push(&mut self, total: u64) {
        let now = Instant::now();
        self.samples.push_back(Sample { ts: now, total });
        // Prune samples older than window
        while self.samples.len() > 1 {
            let age = now
                .duration_since(self.samples.front().unwrap().ts)
                .as_secs();
            if age > self.max_age_secs {
                self.samples.pop_front();
            } else {
                break;
            }
        }
    }

    /// Compute hashes/sec over the window span.
    fn rate_hps(&self) -> f64 {
        if self.samples.len() < 2 {
            return 0.0;
        }
        let first = self.samples.front().unwrap();
        let last = self.samples.back().unwrap();
        let dt = last.ts.duration_since(first.ts).as_secs_f64();
        if dt < 0.1 {
            return 0.0;
        }
        let hash_delta = last.total.saturating_sub(first.total) as f64;
        hash_delta / dt
    }
}

/// Triple sliding windows (10s / 60s / 15m) for a single stream.
struct StreamWindows {
    w10s: Window,
    w60s: Window,
    w15m: Window,
}

impl StreamWindows {
    fn new() -> Self {
        Self {
            w10s: Window::new(10),
            w60s: Window::new(60),
            w15m: Window::new(900),
        }
    }

    fn push(&mut self, total: u64) {
        self.w10s.push(total);
        self.w60s.push(total);
        self.w15m.push(total);
    }

    fn rates(&self) -> (f64, f64, f64) {
        (
            self.w10s.rate_hps(),
            self.w60s.rate_hps(),
            self.w15m.rate_hps(),
        )
    }
}

pub struct HashrateTracker {
    pub cpu_hashes: AtomicU64,
    pub gpu_hashes: AtomicU64,
    pub total_hashes: AtomicU64,
    pub accepted_shares: AtomicU64,
    pub rejected_shares: AtomicU64,
    // ── Per-stream share counters (3-stream parallel mining) ──
    /// Stream 1: ZION Deeksha accepted shares
    pub zion_accepted: AtomicU64,
    /// Stream 1: ZION Deeksha rejected shares
    pub zion_rejected: AtomicU64,
    /// Stream 2: GPU external profit coin accepted shares
    pub gpu_ext_accepted: AtomicU64,
    /// Stream 2: GPU external profit coin rejected shares
    pub gpu_ext_rejected: AtomicU64,
    /// Stream 3: CPU external (Verus/RandomX/etc) accepted shares
    pub cpu_ext_accepted: AtomicU64,
    /// Stream 3: CPU external (Verus/RandomX/etc) rejected shares
    pub cpu_ext_rejected: AtomicU64,
    // ── Per-stream hash counters ──
    pub zion_hashes: AtomicU64,
    pub gpu_ext_hashes: AtomicU64,
    pub cpu_ext_hashes: AtomicU64,
    /// Pool height — updated by mining loop via set_pool_height()
    pub pool_height: AtomicU64,
    /// GPU device info set by mining loop after gpu_init (via set_gpu_info)
    pub gpu_info: Mutex<Vec<GpuInfoLine>>,
    /// Aggregate windows protected by a single mutex
    windows: Mutex<(Window, Window, Window)>, // 10s, 60s, 15m
    /// Per-stream windows
    zion_windows: Mutex<StreamWindows>,
    gpu_ext_windows: Mutex<StreamWindows>,
    cpu_ext_windows: Mutex<StreamWindows>,
}

impl HashrateTracker {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            cpu_hashes: AtomicU64::new(0),
            gpu_hashes: AtomicU64::new(0),
            total_hashes: AtomicU64::new(0),
            accepted_shares: AtomicU64::new(0),
            rejected_shares: AtomicU64::new(0),
            zion_accepted: AtomicU64::new(0),
            zion_rejected: AtomicU64::new(0),
            gpu_ext_accepted: AtomicU64::new(0),
            gpu_ext_rejected: AtomicU64::new(0),
            cpu_ext_accepted: AtomicU64::new(0),
            cpu_ext_rejected: AtomicU64::new(0),
            zion_hashes: AtomicU64::new(0),
            gpu_ext_hashes: AtomicU64::new(0),
            cpu_ext_hashes: AtomicU64::new(0),
            pool_height: AtomicU64::new(0),
            gpu_info: Mutex::new(Vec::new()),
            windows: Mutex::new((Window::new(10), Window::new(60), Window::new(900))),
            zion_windows: Mutex::new(StreamWindows::new()),
            gpu_ext_windows: Mutex::new(StreamWindows::new()),
            cpu_ext_windows: Mutex::new(StreamWindows::new()),
        })
    }

    /// Called once by mining loop after successful GPU init.
    pub fn set_gpu_info(&self, info: Vec<GpuInfoLine>) {
        if let Ok(mut g) = self.gpu_info.lock() {
            *g = info;
        }
    }

    pub fn get_gpu_info(&self) -> Vec<GpuInfoLine> {
        self.gpu_info.lock().map(|g| g.clone()).unwrap_or_default()
    }

    pub fn record_cpu_hashes(&self, n: u64) {
        self.cpu_hashes.fetch_add(n, Ordering::Relaxed);
        let total = self.total_hashes.fetch_add(n, Ordering::Relaxed) + n;
        self.push_windows(total);
    }

    pub fn record_gpu_hashes(&self, n: u64) {
        self.gpu_hashes.fetch_add(n, Ordering::Relaxed);
        let total = self.total_hashes.fetch_add(n, Ordering::Relaxed) + n;
        self.push_windows(total);
    }

    /// Stream 1 (ZION Deeksha) hash progress.
    pub fn record_zion_hashes(&self, n: u64) {
        self.zion_hashes.fetch_add(n, Ordering::Relaxed);
        let total = self.zion_hashes.load(Ordering::Relaxed);
        if let Ok(mut w) = self.zion_windows.lock() {
            w.push(total);
        }
    }

    /// Stream 2 (GPU external profit coin) hash progress.
    pub fn record_gpu_ext_hashes(&self, n: u64) {
        self.gpu_ext_hashes.fetch_add(n, Ordering::Relaxed);
        let total = self.gpu_ext_hashes.load(Ordering::Relaxed);
        if let Ok(mut w) = self.gpu_ext_windows.lock() {
            w.push(total);
        }
    }

    /// Stream 3 (CPU external Verus/RandomX/etc) hash progress.
    pub fn record_cpu_ext_hashes(&self, n: u64) {
        self.cpu_ext_hashes.fetch_add(n, Ordering::Relaxed);
        let total = self.cpu_ext_hashes.load(Ordering::Relaxed);
        if let Ok(mut w) = self.cpu_ext_windows.lock() {
            w.push(total);
        }
    }

    pub fn record_share(&self, accepted: bool) {
        if accepted {
            self.accepted_shares.fetch_add(1, Ordering::Relaxed);
        } else {
            self.rejected_shares.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Record a Stream 1 (ZION Deeksha) share result.
    pub fn record_zion_share(&self, accepted: bool) {
        if accepted {
            self.zion_accepted.fetch_add(1, Ordering::Relaxed);
            self.accepted_shares.fetch_add(1, Ordering::Relaxed);
        } else {
            self.zion_rejected.fetch_add(1, Ordering::Relaxed);
            self.rejected_shares.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Record a Stream 2 (GPU external profit coin) share result.
    pub fn record_gpu_ext_share(&self, accepted: bool) {
        if accepted {
            self.gpu_ext_accepted.fetch_add(1, Ordering::Relaxed);
            self.accepted_shares.fetch_add(1, Ordering::Relaxed);
        } else {
            self.gpu_ext_rejected.fetch_add(1, Ordering::Relaxed);
            self.rejected_shares.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Record a Stream 3 (CPU external Verus/RandomX/etc) share result.
    pub fn record_cpu_ext_share(&self, accepted: bool) {
        if accepted {
            self.cpu_ext_accepted.fetch_add(1, Ordering::Relaxed);
            self.accepted_shares.fetch_add(1, Ordering::Relaxed);
        } else {
            self.cpu_ext_rejected.fetch_add(1, Ordering::Relaxed);
            self.rejected_shares.fetch_add(1, Ordering::Relaxed);
        }
    }

    pub fn set_pool_height(&self, h: u64) {
        self.pool_height.store(h, Ordering::Relaxed);
    }

    fn push_windows(&self, total: u64) {
        if let Ok(mut w) = self.windows.lock() {
            w.0.push(total);
            w.1.push(total);
            w.2.push(total);
        }
    }

    pub fn compute_rates(&self) -> ComputedHashrates {
        let (r10, r60, r15m) = if let Ok(w) = self.windows.lock() {
            (w.0.rate_hps(), w.1.rate_hps(), w.2.rate_hps())
        } else {
            (0.0, 0.0, 0.0)
        };
        let (z10, z60, z15m) = if let Ok(w) = self.zion_windows.lock() {
            w.rates()
        } else {
            (0.0, 0.0, 0.0)
        };
        let (g10, g60, g15m) = if let Ok(w) = self.gpu_ext_windows.lock() {
            w.rates()
        } else {
            (0.0, 0.0, 0.0)
        };
        let (c10, c60, c15m) = if let Ok(w) = self.cpu_ext_windows.lock() {
            w.rates()
        } else {
            (0.0, 0.0, 0.0)
        };
        ComputedHashrates {
            total_hps: r10, // "current" = most recent 10s window
            total_10s_hps: r10,
            total_60s_hps: r60,
            total_15m_hps: r15m,
            cpu_total: self.cpu_hashes.load(Ordering::Relaxed),
            gpu_total: self.gpu_hashes.load(Ordering::Relaxed),
            accepted: self.accepted_shares.load(Ordering::Relaxed),
            rejected: self.rejected_shares.load(Ordering::Relaxed),
            zion_accepted: self.zion_accepted.load(Ordering::Relaxed),
            zion_rejected: self.zion_rejected.load(Ordering::Relaxed),
            gpu_ext_accepted: self.gpu_ext_accepted.load(Ordering::Relaxed),
            gpu_ext_rejected: self.gpu_ext_rejected.load(Ordering::Relaxed),
            cpu_ext_accepted: self.cpu_ext_accepted.load(Ordering::Relaxed),
            cpu_ext_rejected: self.cpu_ext_rejected.load(Ordering::Relaxed),
            zion_10s_hps: z10,
            zion_60s_hps: z60,
            zion_15m_hps: z15m,
            gpu_ext_10s_hps: g10,
            gpu_ext_60s_hps: g60,
            gpu_ext_15m_hps: g15m,
            cpu_ext_10s_hps: c10,
            cpu_ext_60s_hps: c60,
            cpu_ext_15m_hps: c15m,
            zion_total: self.zion_hashes.load(Ordering::Relaxed),
            gpu_ext_total: self.gpu_ext_hashes.load(Ordering::Relaxed),
            cpu_ext_total: self.cpu_ext_hashes.load(Ordering::Relaxed),
        }
    }
}

#[derive(Debug, Clone)]
pub struct ComputedHashrates {
    pub total_hps: f64,
    pub total_10s_hps: f64,
    pub total_60s_hps: f64,
    pub total_15m_hps: f64,
    pub cpu_total: u64,
    pub gpu_total: u64,
    pub accepted: u64,
    pub rejected: u64,
    /// Stream 1: ZION Deeksha
    pub zion_accepted: u64,
    pub zion_rejected: u64,
    /// Stream 2: GPU external profit coin
    pub gpu_ext_accepted: u64,
    pub gpu_ext_rejected: u64,
    /// Stream 3: CPU external Verus/RandomX/etc
    pub cpu_ext_accepted: u64,
    pub cpu_ext_rejected: u64,
    /// Per-stream hashrates (10s / 60s / 15m)
    pub zion_10s_hps: f64,
    pub zion_60s_hps: f64,
    pub zion_15m_hps: f64,
    pub gpu_ext_10s_hps: f64,
    pub gpu_ext_60s_hps: f64,
    pub gpu_ext_15m_hps: f64,
    pub cpu_ext_10s_hps: f64,
    pub cpu_ext_60s_hps: f64,
    pub cpu_ext_15m_hps: f64,
    pub zion_total: u64,
    pub gpu_ext_total: u64,
    pub cpu_ext_total: u64,
}

/* ========================================================================= */
/* Dashboard renderer                                                        */
/* ========================================================================= */

/// Number of rows the dashboard always occupies.
/// Must match the actual number of printed lines below.
const DASHBOARD_ROWS: u16 = 23;

/// Short display names for algorithms
fn algo_display(algo: &str) -> &str {
    match algo {
        "deeksha_lite_v1" => "Deeksha Lite v1",
        "deeksha_lite_fire" => "Deeksha Lite Fire",
        "cosmic_harmony_ekam_deeksha_v2" => "Ekam Deeksha v2",
        other => other,
    }
}

pub fn draw_dashboard(
    control: &MinerControl,
    rates: &ComputedHashrates,
    uptime_secs: u64,
    pool_height: u64,
    gpu_info: &[GpuInfoLine],
) -> io::Result<()> {
    let mut out = stdout();

    // Move to top-left; clear from cursor down so stale lines are wiped
    queue!(
        out,
        cursor::MoveTo(0, 0),
        terminal::Clear(ClearType::FromCursorDown),
    )?;

    // ── Title bar ──
    let title = format!(
        " ZION v3.0.6  Triple Parallel  |  {}",
        algo_display(&control.algorithm)
    );
    let title_padded = format!("{:<78}", title);
    queue!(
        out,
        SetBackgroundColor(Color::Rgb {
            r: 20,
            g: 20,
            b: 50
        }),
        SetForegroundColor(Color::Cyan),
        Print(format!(" {title_padded}\n")),
        ResetColor,
    )?;

    // ── Status line ──
    let status_color = if control.pause {
        Color::Yellow
    } else {
        Color::Green
    };
    let status_text = if control.pause { "PAUSED " } else { "RUNNING" };
    let mode_str = match control.mode {
        MiningMode::CpuOnly => "CPU ",
        MiningMode::GpuOnly => "GPU ",
        MiningMode::Dual => "DUAL",
    };
    queue!(
        out,
        Print("  "),
        SetForegroundColor(status_color),
        Print(status_text.to_string()),
        ResetColor,
        Print(format!(
            "  algo={:<32}  mode={mode_str}  threads={}\n",
            algo_display(&control.algorithm),
            control.threads
        )),
    )?;

    // ── Separator ──
    queue!(
        out,
        SetForegroundColor(Color::DarkGrey),
        Print("  ----------------------------------------------------------------\n"),
        ResetColor,
    )?;

    // ── Hashrate ──
    let (v10, u10) = ui::fmt_hashrate(rates.total_10s_hps);
    let (v60, u60) = ui::fmt_hashrate(rates.total_60s_hps);
    let (v15m, u15m) = ui::fmt_hashrate(rates.total_15m_hps);
    queue!(
        out,
        Print(format!(
            "  Hashrate  10s {:>9}{:<4}  60s {:>9}{:<4}  15m {:>9}{:<4}\n",
            v10, u10, v60, u60, v15m, u15m
        )),
    )?;
    let cpu_hps = if uptime_secs > 0 {
        rates.cpu_total as f64 / uptime_secs as f64
    } else {
        0.0
    };
    let gpu_hps = if uptime_secs > 0 {
        rates.gpu_total as f64 / uptime_secs as f64
    } else {
        0.0
    };
    let (vcpu_tot, ucpu_tot) = ui::fmt_hashrate(cpu_hps);
    let (vgpu_tot, ugpu_tot) = ui::fmt_hashrate(gpu_hps);
    queue!(
        out,
        Print(format!(
            "  CPU total {:>9}{:<4}  GPU total {:>9}{:<4}\n",
            vcpu_tot, ucpu_tot, vgpu_tot, ugpu_tot
        )),
    )?;

    // ── Triple Stream Shares (Claymore-style per-stream breakdown) ──
    let zion_total = rates.zion_accepted + rates.zion_rejected;
    let zion_pct = if zion_total > 0 {
        rates.zion_accepted as f64 * 100.0 / zion_total as f64
    } else {
        100.0
    };
    let gpu_ext_total = rates.gpu_ext_accepted + rates.gpu_ext_rejected;
    let gpu_ext_pct = if gpu_ext_total > 0 {
        rates.gpu_ext_accepted as f64 * 100.0 / gpu_ext_total as f64
    } else {
        100.0
    };
    let cpu_ext_total = rates.cpu_ext_accepted + rates.cpu_ext_rejected;
    let cpu_ext_pct = if cpu_ext_total > 0 {
        rates.cpu_ext_accepted as f64 * 100.0 / cpu_ext_total as f64
    } else {
        100.0
    };

    // Stream 1: ZION Deeksha
    let (zion_hr, zion_unit) = ui::fmt_hashrate(rates.zion_10s_hps);
    queue!(
        out,
        Print("  Stream 1 "),
        SetForegroundColor(Color::Cyan),
        Print(format!("ZION")),
        ResetColor,
        Print(format!(
            "  {:>7.2}{:<3} {:>5} acc / {:>3} rej ({:>5.1}%)",
            zion_hr, zion_unit, rates.zion_accepted, rates.zion_rejected, zion_pct
        )),
    )?;
    // Stream 2: GPU external profit coin
    let (gpu_ext_hr, gpu_ext_unit) = ui::fmt_hashrate(rates.gpu_ext_10s_hps);
    queue!(
        out,
        Print("  |  "),
        SetForegroundColor(Color::Magenta),
        Print(format!("GPU PROFIT")),
        ResetColor,
        Print(format!(
            "  {:>7.2}{:<3} {:>5} acc / {:>3} rej ({:>5.1}%)",
            gpu_ext_hr, gpu_ext_unit, rates.gpu_ext_accepted, rates.gpu_ext_rejected, gpu_ext_pct
        )),
    )?;
    // Stream 3: CPU external Verus/RandomX/etc
    let (cpu_ext_hr, cpu_ext_unit) = ui::fmt_hashrate(rates.cpu_ext_10s_hps);
    queue!(
        out,
        Print("  |  "),
        SetForegroundColor(Color::Yellow),
        Print(format!("CPU PROFIT")),
        ResetColor,
        Print(format!(
            "  {:>7.2}{:<3} {:>5} acc / {:>3} rej ({:>5.1}%)\n",
            cpu_ext_hr, cpu_ext_unit, rates.cpu_ext_accepted, rates.cpu_ext_rejected, cpu_ext_pct
        )),
    )?;

    // ── Total Shares ──
    let acc = rates.accepted;
    let rej = rates.rejected;
    let total = acc + rej;
    let pct = if total > 0 {
        acc as f64 * 100.0 / total as f64
    } else {
        100.0
    };
    let rej_col = if rej > 0 { Color::Red } else { Color::DarkGrey };
    queue!(
        out,
        Print("  Total     "),
        SetForegroundColor(Color::Green),
        Print(format!("{acc} accepted")),
        ResetColor,
        Print("  /  "),
        SetForegroundColor(rej_col),
        Print(format!("{rej} rejected")),
        ResetColor,
        Print(format!("  ({pct:.1}%)\n")),
    )?;

    // ── Pool info ──
    queue!(
        out,
        Print(format!(
            "  Pool      height={pool_height}  uptime={}\n",
            ui::fmt_uptime(uptime_secs)
        )),
    )?;

    // ── Separator ──
    queue!(
        out,
        SetForegroundColor(Color::DarkGrey),
        Print("  ----------------------------------------------------------------\n"),
        ResetColor,
    )?;

    // ── GPU devices (max 2) ──
    if gpu_info.is_empty() {
        queue!(out, Print("  GPU       (no devices)\n"))?;
        queue!(out, Print("\n"))?;
    } else {
        for g in gpu_info.iter().take(2) {
            queue!(out, Print(format!("  GPU #{:<2}   {}\n", g.index, g.info)),)?;
        }
        if gpu_info.len() == 1 {
            queue!(out, Print("\n"))?; // keep fixed height
        }
    }

    // ── Separator ──
    queue!(
        out,
        SetForegroundColor(Color::DarkGrey),
        Print("  ----------------------------------------------------------------\n"),
        ResetColor,
    )?;

    // ── Hotkeys ──
    queue!(
        out,
        SetForegroundColor(Color::DarkGrey),
        Print("  [a] algo  [c] CPU  [g] GPU  [p] pause  [r] reconnect  [v] verbose  [q] quit\n"),
        ResetColor,
    )?;

    out.flush()?;
    Ok(())
}

#[derive(Clone)]
pub struct GpuInfoLine {
    pub index: usize,
    pub info: String,
}

/* ========================================================================= */
/* Keyboard handler                                                          */
/* ========================================================================= */

pub fn spawn_input_thread(control: Arc<Mutex<MinerControl>>) -> thread::JoinHandle<()> {
    thread::spawn(move || {
        loop {
            if event::poll(Duration::from_millis(50)).unwrap_or(false) {
                if let Ok(Event::Key(KeyEvent {
                    code, modifiers, ..
                })) = event::read()
                {
                    let mut c = control.lock().unwrap();

                    if c.requested_quit {
                        break;
                    }

                    match code {
                        KeyCode::Char('q') | KeyCode::Esc => {
                            c.requested_quit = true;
                        }
                        KeyCode::Char('h') => {
                            c.show_dashboard = !c.show_dashboard;
                        }
                        KeyCode::Char('p') => {
                            c.pause = !c.pause;
                        }
                        KeyCode::Char('a') => {
                            c.cycle_algorithm();
                            // Reconnect so pool gets new algo in Hello
                            c.requested_reconnect = true;
                        }
                        KeyCode::Char('c') if modifiers != KeyModifiers::CONTROL => {
                            c.toggle_cpu();
                        }
                        KeyCode::Char('g') => {
                            c.toggle_gpu();
                        }
                        KeyCode::Char('d') => {
                            c.toggle_dual();
                        }
                        KeyCode::Char('r') => {
                            c.requested_reconnect = true;
                        }
                        KeyCode::Char('v') => {
                            c.verbose = !c.verbose;
                        }
                        KeyCode::Char(ch) if ch.is_ascii_digit() && ch != '0' => {
                            let n = ch as usize - '0' as usize;
                            c.thread_override = Some(n);
                            c.threads = n;
                        }
                        _ => {}
                    }

                    // Ctrl+C quits
                    if code == KeyCode::Char('c') && modifiers == KeyModifiers::CONTROL {
                        c.requested_quit = true;
                    }
                }
            }
        }
    })
}

/* ========================================================================= */
/* Entry point                                                               */
/* ========================================================================= */

/// Run the interactive TUI (blocks until user presses q/Esc).
/// Mining loop should be running in a separate thread.
pub fn run_interactive(
    control: Arc<Mutex<MinerControl>>,
    hashrate: Arc<HashrateTracker>,
) -> io::Result<()> {
    TUI_ACTIVE.store(true, Ordering::Relaxed);

    terminal::enable_raw_mode()?;
    let mut stdout = stdout();
    execute!(stdout, cursor::Hide, terminal::EnterAlternateScreen)?;

    let input_handle = spawn_input_thread(Arc::clone(&control));

    let dashboard_control = Arc::clone(&control);
    let dashboard_hashrate = Arc::clone(&hashrate);
    let started_at = Instant::now();

    let dashboard_handle = thread::spawn(move || {
        // Initial full clear
        let _ = execute!(
            io::stdout(),
            cursor::MoveTo(0, 0),
            terminal::Clear(ClearType::All),
        );

        loop {
            thread::sleep(Duration::from_millis(800));

            let c = dashboard_control.lock().unwrap();
            if c.requested_quit {
                break;
            }
            let show = c.show_dashboard;
            let control_snapshot = c.clone();
            drop(c);

            if !show {
                continue;
            }

            // GPU info comes from HashrateTracker (set by mining loop after gpu_init)
            // We never call query_gpu_details() from TUI thread — that requires OpenCL
            // context which lives in the mining thread.
            let cached_gpu_info = dashboard_hashrate.get_gpu_info();

            let rates = dashboard_hashrate.compute_rates();
            let pool_height = dashboard_hashrate.pool_height.load(Ordering::Relaxed);
            let uptime = started_at.elapsed().as_secs();
            let _ = draw_dashboard(
                &control_snapshot,
                &rates,
                uptime,
                pool_height,
                &cached_gpu_info,
            );
        }
    });

    // Block until quit
    loop {
        thread::sleep(Duration::from_millis(100));
        if control.lock().unwrap().requested_quit {
            break;
        }
    }

    // Cleanup
    let _ = input_handle.join();
    let _ = dashboard_handle.join();
    execute!(stdout, cursor::Show, terminal::LeaveAlternateScreen)?;
    terminal::disable_raw_mode()?;

    TUI_ACTIVE.store(false, Ordering::Relaxed);
    Ok(())
}
