use anyhow::Result;
use crossterm::{
    event::{self, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Sparkline},
    Frame, Terminal,
};
use std::{io, time::Duration};

use crate::config::Config;
use crate::rpc::{agent_rpc, node_rpc};

/// Sliding window for sparkline data (last N ticks)
const SPARK_LEN: usize = 40;

struct MonitorState {
    // L1 node
    height: u64,
    peers: u64,
    tip_hash: String,
    // L1 pool
    miners: u64,
    hashrate: f64, // H/s
    // L3 agent
    agent_online: bool,
    agent_model: String,
    agent_sessions: u64,
    // history for sparklines
    height_history: Vec<u64>,
    hashrate_history: Vec<u64>,
    // meta
    tick: u64,
    error: Option<String>,
    loading: bool,
}

impl MonitorState {
    fn new() -> Self {
        Self {
            height: 0,
            peers: 0,
            tip_hash: String::new(),
            miners: 0,
            hashrate: 0.0,
            agent_online: false,
            agent_model: String::new(),
            agent_sessions: 0,
            height_history: vec![0; SPARK_LEN],
            hashrate_history: vec![0; SPARK_LEN],
            tick: 0,
            error: None,
            loading: true,
        }
    }

    fn push_history(&mut self) {
        // height sparkline — show block increments
        if self.height_history.len() >= SPARK_LEN {
            self.height_history.remove(0);
        }
        self.height_history.push(self.height % 1000); // relative

        // hashrate sparkline (kH/s)
        if self.hashrate_history.len() >= SPARK_LEN {
            self.hashrate_history.remove(0);
        }
        self.hashrate_history.push((self.hashrate / 1000.0) as u64);
    }
}

pub async fn run(cfg: &Config) -> Result<()> {
    let node_host = cfg.node.rpc_host.clone();
    let node_port = cfg.node.rpc_port;
    let agent_url = cfg.agent.url.clone();

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut state = MonitorState::new();
    refresh(&mut state, &node_host, node_port, &agent_url).await;

    let tick_interval = Duration::from_secs(5);
    let mut last_tick = std::time::Instant::now();

    loop {
        terminal.draw(|f| draw(f, &state))?;

        let remaining = tick_interval
            .checked_sub(last_tick.elapsed())
            .unwrap_or(Duration::ZERO);

        if event::poll(remaining)? {
            if let Event::Key(key) = event::read()? {
                match (key.code, key.modifiers) {
                    (KeyCode::Char('q'), _) | (KeyCode::Char('c'), KeyModifiers::CONTROL) => break,
                    (KeyCode::Char('r'), _) => {
                        state.loading = true;
                        refresh(&mut state, &node_host, node_port, &agent_url).await;
                    }
                    _ => {}
                }
            }
        }

        if last_tick.elapsed() >= tick_interval {
            state.loading = true;
            refresh(&mut state, &node_host, node_port, &agent_url).await;
            last_tick = std::time::Instant::now();
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;
    Ok(())
}

async fn refresh(state: &mut MonitorState, host: &str, port: u16, agent_url: &str) {
    state.error = None;

    // Node stats
    match node_rpc::call0(host, port, "getChainInfo").await {
        Ok(v) => {
            state.height = v["chain_height"].as_u64().unwrap_or(state.height);
            state.peers = 0; // will fetch from getNodeInfo
            state.tip_hash = v["tip_hash"].as_str().unwrap_or("").into();
            // peers
            if let Ok(ni) = node_rpc::call0(host, port, "getNodeInfo").await {
                state.peers = ni["known_peers"].as_u64().unwrap_or(0);
            }
        }
        Err(e) => {
            state.error = Some(format!("Node: {}", e));
        }
    }

    // Pool stats
    match node_rpc::call0(host, port, "getMempoolInfo").await {
        Ok(v) => {
            state.miners = v["mempool_transactions"].as_u64().unwrap_or(0);
            state.hashrate = 0.0; // hashrate from pool HTTP API, not node RPC
        }
        Err(_) => {
            // pool may not be running — leave values as-is
        }
    }

    // Agent health
    state.agent_online = agent_rpc::health(agent_url).await.unwrap_or(false);
    if state.agent_online {
        if let Ok(v) = agent_rpc::get(agent_url, "status").await {
            state.agent_model = v["model"].as_str().unwrap_or("").into();
            state.agent_sessions = v["sessions"].as_u64().unwrap_or(0);
        }
    }

    state.push_history();
    state.tick += 1;
    state.loading = false;
}

fn draw(f: &mut Frame, s: &MonitorState) {
    let area = f.area();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // title bar
            Constraint::Length(7), // node panel
            Constraint::Length(7), // pool panel
            Constraint::Length(7), // agent panel
            Constraint::Min(3),    // sparklines
            Constraint::Length(2), // footer
        ])
        .split(area);

    // ── Title ─────────────────────────────────────────────────────
    let loading_span = if s.loading {
        Span::styled("  ⟳", Style::default().fg(Color::DarkGray))
    } else {
        Span::raw(format!("  tick #{}", s.tick))
    };
    let title = Paragraph::new(Line::from(vec![
        Span::styled(
            "  ZION ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            "Stack Monitor",
            Style::default()
                .fg(Color::White)
                .add_modifier(Modifier::BOLD),
        ),
        loading_span,
    ]))
    .alignment(Alignment::Left)
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Yellow)),
    );
    f.render_widget(title, chunks[0]);

    // ── L1 Node ───────────────────────────────────────────────────
    let tip = if s.tip_hash.len() > 16 {
        &s.tip_hash[..16]
    } else {
        &s.tip_hash
    };
    let node_color = if s.error.is_some() {
        Color::Red
    } else {
        Color::Green
    };
    let node_status = if s.error.is_some() {
        s.error.as_deref().unwrap_or("error").to_string()
    } else {
        format!(
            "online  height={}  peers={}  tip={}…",
            s.height, s.peers, tip
        )
    };
    let node_text = vec![
        Line::from(Span::styled(
            format!("  ● L1 Core Node   {}", node_status),
            Style::default().fg(node_color),
        )),
        Line::from(Span::styled(
            "  ● L1 Seed Node   (p2p connected)".to_string(),
            Style::default().fg(Color::DarkGray),
        )),
    ];
    let node_panel =
        Paragraph::new(node_text).block(Block::default().borders(Borders::ALL).title("L1 — Core"));
    f.render_widget(node_panel, chunks[1]);

    // ── L1 Pool ───────────────────────────────────────────────────
    let hs_kh = s.hashrate / 1000.0;
    let pool_text = vec![Line::from(Span::styled(
        format!(
            "  ● Stratum pool   miners={}  hashrate={:.1} kH/s",
            s.miners, hs_kh
        ),
        Style::default().fg(Color::Cyan),
    ))];

    let max_hash = s.hashrate_history.iter().copied().max().unwrap_or(1).max(1);
    let pool_panel =
        Paragraph::new(pool_text).block(Block::default().borders(Borders::ALL).title("L1 — Pool"));
    f.render_widget(pool_panel, chunks[2]);

    // ── L3 Agent ──────────────────────────────────────────────────
    let agent_color = if s.agent_online {
        Color::Magenta
    } else {
        Color::Red
    };
    let agent_status = if s.agent_online {
        format!(
            "online  model={}  sessions={}",
            if s.agent_model.is_empty() {
                "?"
            } else {
                &s.agent_model
            },
            s.agent_sessions
        )
    } else {
        "unreachable — start with: zion agent start".into()
    };
    let agent_text = vec![
        Line::from(Span::styled(
            format!("  ● Hiranyagarbha   {}", agent_status),
            Style::default().fg(agent_color),
        )),
        Line::from(Span::styled(
            "  ● Warp / NCL     (via agent)",
            Style::default().fg(Color::DarkGray),
        )),
    ];
    let agent_panel = Paragraph::new(agent_text).block(
        Block::default()
            .borders(Borders::ALL)
            .title("L3 — AI Native"),
    );
    f.render_widget(agent_panel, chunks[3]);

    // ── Sparklines ────────────────────────────────────────────────
    let spark_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(chunks[4]);

    let height_spark = Sparkline::default()
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Block height (relative)"),
        )
        .data(&s.height_history)
        .style(Style::default().fg(Color::Green));
    f.render_widget(height_spark, spark_chunks[0]);

    let hash_spark = Sparkline::default()
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Hashrate (kH/s)"),
        )
        .data(&s.hashrate_history)
        .max(max_hash + 1)
        .style(Style::default().fg(Color::Cyan));
    f.render_widget(hash_spark, spark_chunks[1]);

    // ── Footer ────────────────────────────────────────────────────
    let footer = Paragraph::new("  q quit   r refresh   auto-refresh every 5s")
        .style(Style::default().fg(Color::DarkGray));
    f.render_widget(footer, chunks[5]);
}
