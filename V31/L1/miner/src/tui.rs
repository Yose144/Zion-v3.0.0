//! Ratatui-based interactive TUI for the ZION miner.
//!
//! Activated by `--interactive` or `ZION_INTERACTIVE=1`.
//! Shows live per-stream stats, totals, and a simple event log.
//!
//! Keyboard shortcuts:
//!   q / Esc    quit
//!   p          pause / resume (NYI — placeholder)
//!   1-9        set thread count (NYI — placeholder)
//!   r          reconnect (NYI — placeholder)
//!   i          show hardware info (NYI — placeholder)
//!   v          toggle verbose (NYI — placeholder)

#![allow(dead_code)]

use std::collections::{HashMap, VecDeque};
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use crossterm::event::{self, Event, KeyCode, KeyEventKind};
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span, Text};
use ratatui::widgets::{
    Block, Borders, Cell, Paragraph, Row, Table, Wrap,
};
use ratatui::{DefaultTerminal, Frame};
use tokio::sync::{mpsc, watch};
use tokio::time::interval;

use crate::config::MinerConfig;
use crate::runtime::MinerRuntime;
use crate::stream::{StreamId, StreamStats};

const MAX_LOG_LINES: usize = 64;
const TICK_MS: u64 = 250;

/// Restore the terminal to normal mode.  Called by the main binary on exit
/// so the alternate screen / raw mode from the TUI does not outlive the process.
pub fn restore_terminal() {
    ratatui::restore();
}

/// Run the ratatui TUI until the user quits or the shutdown signal is received.
pub async fn run_tui(
    runtime: MinerRuntime,
    shutdown: watch::Receiver<bool>,
    shutdown_tx: watch::Sender<bool>,
) -> Result<()> {
    let mut terminal =
        ratatui::try_init().context("failed to initialize terminal; try without --interactive")?;
    let result = run_app(&mut terminal, runtime, shutdown, shutdown_tx).await;
    ratatui::restore();
    result
}

async fn run_app(
    terminal: &mut DefaultTerminal,
    runtime: MinerRuntime,
    mut shutdown: watch::Receiver<bool>,
    shutdown_tx: watch::Sender<bool>,
) -> Result<()> {
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<Event>();
    let reader_tx = event_tx.clone();

    // Read crossterm events in a blocking thread so the async runtime is not blocked.
    tokio::task::spawn_blocking(move || {
        while let Ok(evt) = event::read() {
            if reader_tx.send(evt).is_err() {
                break;
            }
        }
    });

    let mut app = App::new(runtime, shutdown_tx);
    let mut tick = interval(Duration::from_millis(TICK_MS));
    let _ = tick.tick().await; // skip immediate first tick

    loop {
        terminal.draw(|f| draw(f, &mut app))?;

        if app.should_quit {
            break;
        }

        tokio::select! {
            _ = tick.tick() => app.refresh().await,
            Some(evt) = event_rx.recv() => app.handle_event(evt),
            Ok(()) = shutdown.changed() => {
                if *shutdown.borrow() {
                    app.should_quit = true;
                }
            }
        }
    }

    Ok(())
}

struct App {
    runtime: MinerRuntime,
    config: MinerConfig,
    shutdown_tx: watch::Sender<bool>,
    stats: HashMap<StreamId, StreamStats>,
    last_stats: HashMap<StreamId, StreamStats>,
    logs: VecDeque<String>,
    should_quit: bool,
    start: Instant,
    paused: bool,
}

impl App {
    fn new(runtime: MinerRuntime, shutdown_tx: watch::Sender<bool>) -> Self {
        let config = runtime.config().clone();
        Self {
            runtime,
            config,
            shutdown_tx,
            stats: HashMap::new(),
            last_stats: HashMap::new(),
            logs: VecDeque::with_capacity(MAX_LOG_LINES),
            should_quit: false,
            start: Instant::now(),
            paused: false,
        }
    }

    async fn refresh(&mut self) {
        let stats = self.runtime.stats().await;

        // Detect accepted/rejected share events and append to the log pane.
        for id in [StreamId::Zion, StreamId::GpuExternal, StreamId::CpuExternal] {
            let current = stats.get(&id).cloned().unwrap_or_else(|| StreamStats::new(id));
            let prev = self.last_stats.get(&id).cloned().unwrap_or_else(|| StreamStats::new(id));

            if current.accepted > prev.accepted {
                let delta = current.accepted - prev.accepted;
                let coin = stream_coin_name(&current, id);
                let hr_unit = fmt_hashrate_unit(current.hashrate);
                self.log(format!(
                    "{} share accepted +{} ({:.2} {})",
                    coin, delta, hr_unit.0, hr_unit.1
                ));
            }
            if current.rejected > prev.rejected {
                let delta = current.rejected - prev.rejected;
                let coin = stream_coin_name(&current, id);
                self.log(format!("{} share rejected +{}", coin, delta));
            }
            if current.shares_found > prev.shares_found {
                let coin = stream_coin_name(&current, id);
                self.log(format!("{} block found", coin));
            }
        }

        self.last_stats = std::mem::take(&mut self.stats);
        self.stats = stats;
    }

    fn log(&mut self, msg: String) {
        if self.logs.len() >= MAX_LOG_LINES {
            self.logs.pop_front();
        }
        let ts = chrono::Local::now().format("%H:%M:%S").to_string();
        self.logs.push_back(format!("[{}] {}", ts, msg));
    }

    fn handle_event(&mut self, event: Event) {
        if let Event::Key(key) = event {
            if key.kind != KeyEventKind::Press && key.kind != KeyEventKind::Repeat {
                return;
            }
            match (key.code, key.modifiers) {
                (KeyCode::Char('q' | 'Q'), _) | (KeyCode::Esc, _) => {
                    self.should_quit = true;
                    let _ = self.shutdown_tx.send(true);
                }
                (KeyCode::Char('p' | 'P'), _) => {
                    self.paused = !self.paused;
                    self.log(format!("Pause {} (pause/resume not yet wired)", if self.paused { "ON" } else { "OFF" }));
                }
                (KeyCode::Char('r' | 'R'), _) => {
                    self.log("Reconnect requested (not yet wired)".to_string());
                }
                (KeyCode::Char('i' | 'I'), _) => {
                    self.log("Hardware info (not yet wired)".to_string());
                }
                (KeyCode::Char('v' | 'V'), _) => {
                    self.log("Verbose toggle (not yet wired)".to_string());
                }
                (KeyCode::Char(c @ '1'..='9'), _) => {
                    self.log(format!("Thread count {} requested (not yet wired)", c));
                }
                _ => {}
            }
        }
    }
}

fn draw(frame: &mut Frame, app: &mut App) {
    let area = frame.area();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(5),
            Constraint::Min(8),
            Constraint::Length(3),
            Constraint::Length(7),
            Constraint::Length(1),
        ])
        .split(area);

    draw_header(frame, app, chunks[0]);
    draw_streams_table(frame, app, chunks[1]);
    draw_totals(frame, app, chunks[2]);
    draw_log(frame, app, chunks[3]);
    draw_footer(frame, app, chunks[4]);
}

fn draw_header(frame: &mut Frame, app: &App, area: Rect) {
    let pool = app
        .config
        .pool_url
        .as_deref()
        .or(app.config.node_rpc_url.as_deref())
        .unwrap_or("solo")
        .to_string();

    let wallet = app.config.reward_address.encoded.clone();
    let worker = app.config.worker.clone();
    let backend = app.config.gpu_backend.clone();
    let consensus = zion_core::node_runtime::consensus_profile();
    let uptime = app.start.elapsed().as_secs();

    let lines = vec![
        Line::from(vec![
            Span::styled("ZION Miner ", Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            Span::raw(format!("v3.1.0-beta | consensus={} backend={}", consensus, backend)),
        ]),
        Line::from(vec![
            Span::styled("Pool: ", Style::default().fg(Color::Yellow)),
            Span::raw(pool),
        ]),
        Line::from(vec![
            Span::styled("Wallet: ", Style::default().fg(Color::Yellow)),
            Span::raw(wallet),
            Span::raw(" | "),
            Span::styled("Worker: ", Style::default().fg(Color::Yellow)),
            Span::raw(worker),
            Span::raw(" | "),
            Span::styled("Uptime: ", Style::default().fg(Color::Yellow)),
            Span::raw(fmt_uptime(uptime)),
        ]),
    ];

    let paragraph = Paragraph::new(Text::from(lines))
        .block(Block::default().borders(Borders::ALL).title("ZION Miner"))
        .alignment(Alignment::Left);
    frame.render_widget(paragraph, area);
}

fn draw_streams_table(frame: &mut Frame, app: &App, area: Rect) {
    let rows: Vec<Row> = [StreamId::Zion, StreamId::GpuExternal, StreamId::CpuExternal]
        .iter()
        .map(|id| {
            let s = app.stats.get(id).cloned().unwrap_or_else(|| StreamStats::new(*id));
            let (value, unit) = fmt_hashrate_unit(s.hashrate);
            let accept_rate = if s.accepted + s.rejected > 0 {
                (s.accepted as f64 / (s.accepted + s.rejected) as f64) * 100.0
            } else {
                0.0
            };
            let status = if s.active { "active".to_string() } else { "idle".to_string() };
            let coin = if s.active {
                stream_coin_name(&s, *id)
            } else {
                "idle".to_string()
            };
            let algo = s.algorithm.clone().unwrap_or_else(|| {
                if *id == StreamId::Zion {
                    zion_core::node_runtime::consensus_profile().to_string()
                } else {
                    "-".to_string()
                }
            });

            let color = if s.active { Color::Green } else { Color::Gray };

            Row::new(vec![
                Cell::from(Span::styled(stream_label(*id), Style::default().fg(color))),
                Cell::from(Span::styled(status, Style::default().fg(color))),
                Cell::from(coin),
                Cell::from(algo),
                Cell::from(format!("{:.2} {}", value, unit)),
                Cell::from(format!("{}", s.accepted)),
                Cell::from(format!("{}", s.rejected)),
                Cell::from(format!("{:.1}%", accept_rate)),
            ])
        })
        .collect();

    let header = Row::new(vec!["Stream", "Status", "Coin", "Algo", "Hashrate", "Acc", "Rej", "AR%"])
        .style(Style::default().fg(Color::Yellow).add_modifier(Modifier::BOLD));

    let table = Table::new(
        rows,
        [
            Constraint::Length(9),
            Constraint::Length(7),
            Constraint::Length(8),
            Constraint::Length(14),
            Constraint::Length(10),
            Constraint::Length(7),
            Constraint::Length(7),
            Constraint::Length(7),
        ],
    )
    .header(header)
    .block(Block::default().borders(Borders::ALL).title("Streams"));

    frame.render_widget(table, area);
}

fn draw_totals(frame: &mut Frame, app: &App, area: Rect) {
    let mut total_hr = 0.0;
    let mut total_acc = 0u64;
    let mut total_rej = 0u64;
    for s in app.stats.values() {
        if s.active {
            total_hr += s.hashrate;
        }
        total_acc += s.accepted;
        total_rej += s.rejected;
    }
    let (value, unit) = fmt_hashrate_unit(total_hr);
    let accept_rate = if total_acc + total_rej > 0 {
        (total_acc as f64 / (total_acc + total_rej) as f64) * 100.0
    } else {
        0.0
    };

    let line = Line::from(vec![
        Span::styled("Total: ", Style::default().fg(Color::Yellow)),
        Span::raw(format!("{:.2} {} | ", value, unit)),
        Span::styled("Accepted: ", Style::default().fg(Color::Green)),
        Span::raw(format!("{} | ", total_acc)),
        Span::styled("Rejected: ", Style::default().fg(Color::Red)),
        Span::raw(format!("{} | ", total_rej)),
        Span::styled("Accept Rate: ", Style::default().fg(Color::Yellow)),
        Span::raw(format!("{:.1}%", accept_rate)),
    ]);

    let paragraph = Paragraph::new(line)
        .block(Block::default().borders(Borders::ALL).title("Totals"))
        .alignment(Alignment::Center);
    frame.render_widget(paragraph, area);
}

fn draw_log(frame: &mut Frame, app: &App, area: Rect) {
    let lines: Vec<Line> = app.logs.iter().map(|l| Line::from(l.as_str())).collect();
    let text = Text::from(lines);
    let paragraph = Paragraph::new(text)
        .block(Block::default().borders(Borders::ALL).title("Events"))
        .wrap(Wrap { trim: true });
    frame.render_widget(paragraph, area);
}

fn draw_footer(frame: &mut Frame, _app: &App, area: Rect) {
    let line = Line::from(vec![
        Span::styled("q", Style::default().fg(Color::Yellow)),
        Span::raw(" quit  "),
        Span::styled("p", Style::default().fg(Color::Yellow)),
        Span::raw(" pause  "),
        Span::styled("1-9", Style::default().fg(Color::Yellow)),
        Span::raw(" threads  "),
        Span::styled("r", Style::default().fg(Color::Yellow)),
        Span::raw(" reconnect  "),
        Span::styled("i", Style::default().fg(Color::Yellow)),
        Span::raw(" info  "),
        Span::styled("v", Style::default().fg(Color::Yellow)),
        Span::raw(" verbose"),
    ]);
    let paragraph = Paragraph::new(line).alignment(Alignment::Center);
    frame.render_widget(paragraph, area);
}

fn stream_label(id: StreamId) -> &'static str {
    match id {
        StreamId::Zion => "ZION",
        StreamId::GpuExternal => "GPU",
        StreamId::CpuExternal => "CPU",
    }
}

fn stream_coin_name(s: &StreamStats, id: StreamId) -> String {
    #[cfg(feature = "public_build")]
    {
        match id {
            StreamId::Zion => "ZION".to_string(),
            StreamId::GpuExternal => "BOOST 1".to_string(),
            StreamId::CpuExternal => "BOOST 2".to_string(),
        }
    }
    #[cfg(not(feature = "public_build"))]
    {
        s.coin
            .as_ref()
            .map(|c| c.to_string())
            .unwrap_or_else(|| id.as_str().to_string())
    }
}

fn fmt_hashrate_unit(hps: f64) -> (String, &'static str) {
    crate::ui::fmt_hashrate(hps)
}

fn fmt_uptime(secs: u64) -> String {
    let h = secs / 3600;
    let m = (secs % 3600) / 60;
    let s = secs % 60;
    if h > 0 {
        format!("{}h {:02}m {:02}s", h, m, s)
    } else {
        format!("{}m {:02}s", m, s)
    }
}
