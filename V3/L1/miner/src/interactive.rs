//! Interactive TUI for zion-miner
//!
//! Cross-platform keyboard control using crossterm:
//!   h  = toggle hashrate dashboard
//!   a  = cycle algorithm (Lite v1 → Fire → Ekam v2)
//!   c  = toggle CPU mining
//!   g  = toggle GPU mining
//!   d  = toggle dual mode
//!   i  = show hardware info
//!   p  = pause / resume
//!   r  = reconnect to pool
//!   v  = toggle verbose wire logging
//!   1-9 = set thread count
//!   q / Esc = quit gracefully

use std::collections::VecDeque;
use std::io::{self, stdout, Write};
use std::sync::atomic::{AtomicU64, Ordering};
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
use crate::gpu_backend;

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
            mode: if gpu { MiningMode::GpuOnly } else { MiningMode::CpuOnly },
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
            (true, true, false) => MiningMode::GpuOnly, // default: GPU优先
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
/* Hashrate tracker with time windows                                        */
/* ========================================================================= */

pub struct HashrateTracker {
    pub cpu_hashes: AtomicU64,
    pub gpu_hashes: AtomicU64,
    pub total_hashes: AtomicU64,
    pub accepted_shares: AtomicU64,
    pub rejected_shares: AtomicU64,
    pub windows: Mutex<HashrateWindows>,
}

struct HashrateWindow {
    hashes: u64,
    timestamp: Instant,
}

struct HashrateWindows {
    _10s: VecDeque<HashrateWindow>,
    _60s: VecDeque<HashrateWindow>,
    _15m: VecDeque<HashrateWindow>,
}

impl HashrateTracker {
    pub fn new() -> Arc<Self> {
        Arc::new(Self {
            cpu_hashes: AtomicU64::new(0),
            gpu_hashes: AtomicU64::new(0),
            total_hashes: AtomicU64::new(0),
            accepted_shares: AtomicU64::new(0),
            rejected_shares: AtomicU64::new(0),
            windows: Mutex::new(HashrateWindows {
                _10s: VecDeque::new(),
                _60s: VecDeque::new(),
                _15m: VecDeque::new(),
            }),
        })
    }

    pub fn record_cpu_hashes(&self, n: u64) {
        self.cpu_hashes.fetch_add(n, Ordering::Relaxed);
        self.total_hashes.fetch_add(n, Ordering::Relaxed);
        self.push_window(n);
    }

    pub fn record_gpu_hashes(&self, n: u64) {
        self.gpu_hashes.fetch_add(n, Ordering::Relaxed);
        self.total_hashes.fetch_add(n, Ordering::Relaxed);
        self.push_window(n);
    }

    pub fn record_share(&self, accepted: bool) {
        if accepted {
            self.accepted_shares.fetch_add(1, Ordering::Relaxed);
        } else {
            self.rejected_shares.fetch_add(1, Ordering::Relaxed);
        }
    }

    fn push_window(&self, n: u64) {
        let now = Instant::now();
        let mut w = self.windows.lock().unwrap();
        let entry = HashrateWindow { hashes: n, timestamp: now };
        w._10s.push_back(entry);
        w._60s.push_back(HashrateWindow { hashes: n, timestamp: now });
        w._15m.push_back(HashrateWindow { hashes: n, timestamp: now });

        // Prune old entries
        while w._10s.front().map(|e| now.duration_since(e.timestamp).as_secs() > 10).unwrap_or(false) {
            w._10s.pop_front();
        }
        while w._60s.front().map(|e| now.duration_since(e.timestamp).as_secs() > 60).unwrap_or(false) {
            w._60s.pop_front();
        }
        while w._15m.front().map(|e| now.duration_since(e.timestamp).as_secs() > 900).unwrap_or(false) {
            w._15m.pop_front();
        }
    }

    pub fn compute_rates(&self) -> ComputedHashrates {
        let now = Instant::now();
        let w = self.windows.lock().unwrap();
        let total = self.total_hashes.load(Ordering::Relaxed);
        let cpu = self.cpu_hashes.load(Ordering::Relaxed);
        let gpu = self.gpu_hashes.load(Ordering::Relaxed);

        ComputedHashrates {
            total_hps: Self::rate_from_window(&w._10s, now),
            total_10s_hps: Self::rate_from_window(&w._10s, now),
            total_60s_hps: Self::rate_from_window(&w._60s, now),
            total_15m_hps: Self::rate_from_window(&w._15m, now),
            cpu_total: cpu,
            gpu_total: gpu,
            accepted: self.accepted_shares.load(Ordering::Relaxed),
            rejected: self.rejected_shares.load(Ordering::Relaxed),
        }
    }

    fn rate_from_window(window: &VecDeque<HashrateWindow>, now: Instant) -> f64 {
        if window.len() < 2 {
            return 0.0;
        }
        let total_hashes: u64 = window.iter().map(|e| e.hashes).sum();
        let first = window.front().unwrap().timestamp;
        let last = window.back().unwrap().timestamp;
        let dt = now.duration_since(first).as_secs_f64().max(0.001);
        total_hashes as f64 / dt
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
}

/* ========================================================================= */
/* Dashboard renderer                                                        */
/* ========================================================================= */

pub fn draw_dashboard(
    control: &MinerControl,
    rates: &ComputedHashrates,
    uptime_secs: u64,
    pool_height: u64,
    gpu_info: &[GpuInfoLine],
) -> io::Result<()> {
    let mut stdout = stdout();

    // Clear and move to top-left
    queue!(
        stdout,
        cursor::MoveTo(0, 0),
        terminal::Clear(ClearType::All),
    )?;

    // Title bar
    queue!(
        stdout,
        SetBackgroundColor(Color::Rgb { r: 30, g: 30, b: 50 }),
        SetForegroundColor(Color::Cyan),
        Print(" ╔══════════════════════════════════════════════════════════════════════════════╗ \n"),
        Print(" ║  ZION v3.0.1  INTERACTIVE MINER                                              ║ \n"),
        Print(" ╚══════════════════════════════════════════════════════════════════════════════╝ \n"),
        ResetColor,
    )?;

    // Status line
    let status_color = if control.pause { Color::Yellow } else { Color::Green };
    let status_text = if control.pause { "PAUSED" } else { "RUNNING" };
    let mode_str = match control.mode {
        MiningMode::CpuOnly => "CPU",
        MiningMode::GpuOnly => "GPU",
        MiningMode::Dual => "DUAL",
    };

    queue!(
        stdout,
        SetForegroundColor(status_color),
        Print(format!("  Status: {:<8}  ", status_text)),
        ResetColor,
        Print(format!("Algorithm: {:<30}  Mode: {:<6}  Threads: {}\n",
            control.algorithm, mode_str, control.threads)),
    )?;

    // Hashrate section
    let (hr_val, hr_unit) = ui::fmt_hashrate(rates.total_hps);
    let (hr10_val, hr10_unit) = ui::fmt_hashrate(rates.total_10s_hps);
    let (hr60_val, hr60_unit) = ui::fmt_hashrate(rates.total_60s_hps);
    let (cpu_val, cpu_unit) = ui::fmt_hashrate(rates.cpu_total as f64);
    let (gpu_val, gpu_unit) = ui::fmt_hashrate(rates.gpu_total as f64);

    queue!(
        stdout,
        SetForegroundColor(Color::Blue),
        Print("  ┌─ Hashrate ─────────────────────────────────────────────────────────────────┐\n"),
        ResetColor,
        Print(format!("  │  Current: {:>8} {:<4}  10s avg: {:>8} {:<4}  60s avg: {:>8} {:<4}    │\n",
            hr_val, hr_unit, hr10_val, hr10_unit, hr60_val, hr60_unit)),
        Print(format!("  │  CPU:     {:>8} {:<4}  GPU:      {:>8} {:<4}  Accepted: {}/{}          │\n",
            cpu_val, cpu_unit, gpu_val, gpu_unit, rates.accepted, rates.rejected)),
        SetForegroundColor(Color::Blue),
        Print("  └────────────────────────────────────────────────────────────────────────────┘\n"),
        ResetColor,
    )?;

    // GPU info
    if !gpu_info.is_empty() {
        queue!(stdout, SetForegroundColor(Color::Magenta), Print("  ┌─ GPU Devices ────────────────────────────────────────────────────────────────┐\n"), ResetColor)?;
        for line in gpu_info {
            queue!(stdout, Print(format!("  │  {} {:<60} │\n", line.index, line.info)))?;
        }
        queue!(stdout, SetForegroundColor(Color::Magenta), Print("  └────────────────────────────────────────────────────────────────────────────┘\n"), ResetColor)?;
    }

    // Pool / Chain info
    queue!(
        stdout,
        SetForegroundColor(Color::Yellow),
        Print(format!("  Uptime: {}  Pool Height: {}\n", ui::fmt_uptime(uptime_secs), pool_height)),
        ResetColor,
    )?;

    // Hotkey legend
    queue!(
        stdout,
        SetForegroundColor(Color::DarkGrey),
        Print("\n"),
        Print("  [h] dashboard  [a] algorithm  [c] CPU toggle  [g] GPU toggle  [d] dual mode\n"),
        Print("  [i] HW info    [p] pause      [r] reconnect   [v] verbose     [1-9] threads\n"),
        Print("  [q/Esc] quit\n"),
        ResetColor,
    )?;

    stdout.flush()?;
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
            // Poll for events with 50ms timeout
            if event::poll(Duration::from_millis(50)).unwrap_or(false) {
                if let Ok(Event::Key(KeyEvent { code, modifiers, .. })) = event::read() {
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
                        }
                        KeyCode::Char('c') => {
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
                        KeyCode::Char('i') => {
                            // Info is always visible in dashboard
                        }
                        KeyCode::Char(ch) if ch.is_ascii_digit() && ch != '0' => {
                            let n = ch as usize - '0' as usize;
                            c.thread_override = Some(n);
                            c.threads = n;
                        }
                        _ => {}
                    }

                    // Ctrl+C also quits
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
    terminal::enable_raw_mode()?;
    let mut stdout = stdout();
    execute!(stdout, cursor::Hide, terminal::EnterAlternateScreen)?;

    let input_handle = spawn_input_thread(Arc::clone(&control));

    // Dashboard refresh loop
    let dashboard_control = Arc::clone(&control);
    let dashboard_hashrate = Arc::clone(&hashrate);
    let started_at = Instant::now();
    let dashboard_handle = thread::spawn(move || {
        let mut last_gpu_query = Instant::now() - Duration::from_secs(60);
        let mut cached_gpu_info: Vec<GpuInfoLine> = Vec::new();

        loop {
            thread::sleep(Duration::from_millis(500));

            let c = dashboard_control.lock().unwrap();
            if c.requested_quit {
                break;
            }
            if !c.show_dashboard {
                continue;
            }

            // Refresh GPU info every 10s
            if last_gpu_query.elapsed().as_secs() >= 10 {
                cached_gpu_info = gpu_backend::query_gpu_details()
                    .into_iter()
                    .enumerate()
                    .map(|(i, info)| GpuInfoLine {
                index: i,
                info: format!("{} | {} CUs | {} MHz | {} MiB VRAM",
                    info.name, info.compute_units, info.max_clock_mhz,
                    info.global_mem_bytes / (1024 * 1024)),
            })
                    .collect();
                last_gpu_query = Instant::now();
            }

            let rates = dashboard_hashrate.compute_rates();
            let uptime = started_at.elapsed().as_secs();
            let _ = draw_dashboard(&c, &rates, uptime, 0, &cached_gpu_info);
        }
    });

    // Block until quit requested
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
    Ok(())
}
