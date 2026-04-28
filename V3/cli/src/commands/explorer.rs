use anyhow::Result;
use std::io;
use std::time::Duration;

use crossterm::{
    event::{self, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Cell, Paragraph, Row, Table, TableState},
    Frame, Terminal,
};

use crate::config::Config;
use crate::rpc::node_rpc;

struct ExplorerState {
    height: u64,
    tip_hash: String,
    peers: u64,
    blocks: Vec<BlockRow>,
    table_state: TableState,
    loading: bool,
    error: Option<String>,
}

struct BlockRow {
    height: u64,
    hash: String,
    txs: u64,
    time: String,
}

impl ExplorerState {
    fn new() -> Self {
        let mut s = Self {
            height: 0,
            tip_hash: String::new(),
            peers: 0,
            blocks: vec![],
            table_state: TableState::default(),
            loading: true,
            error: None,
        };
        s.table_state.select(Some(0));
        s
    }

    fn scroll_down(&mut self) {
        let i = match self.table_state.selected() {
            Some(i) => (i + 1).min(self.blocks.len().saturating_sub(1)),
            None => 0,
        };
        self.table_state.select(Some(i));
    }

    fn scroll_up(&mut self) {
        let i = match self.table_state.selected() {
            Some(i) => i.saturating_sub(1),
            None => 0,
        };
        self.table_state.select(Some(i));
    }
}

pub async fn run(cfg: &Config) -> Result<()> {
    let host = cfg.node.rpc_host.clone();
    let port = cfg.node.rpc_port;

    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut state = ExplorerState::new();

    // Initial data load
    refresh_data(&mut state, &host, port).await;

    let tick = Duration::from_secs(10);
    let mut last_tick = std::time::Instant::now();

    loop {
        terminal.draw(|f| draw(f, &mut state))?;

        let timeout = tick
            .checked_sub(last_tick.elapsed())
            .unwrap_or(Duration::ZERO);

        if event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                match (key.code, key.modifiers) {
                    (KeyCode::Char('q'), _) | (KeyCode::Char('c'), KeyModifiers::CONTROL) => break,
                    (KeyCode::Down | KeyCode::Char('j'), _) => state.scroll_down(),
                    (KeyCode::Up | KeyCode::Char('k'), _) => state.scroll_up(),
                    (KeyCode::Char('r'), _) => {
                        state.loading = true;
                        refresh_data(&mut state, &host, port).await;
                    }
                    _ => {}
                }
            }
        }

        if last_tick.elapsed() >= tick {
            state.loading = true;
            refresh_data(&mut state, &host, port).await;
            last_tick = std::time::Instant::now();
        }
    }

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    Ok(())
}

async fn refresh_data(state: &mut ExplorerState, host: &str, port: u16) {
    // Get chain stats
    match node_rpc::call0(host, port, "getChainInfo").await {
        Ok(v) => {
            state.height = v["height"].as_u64().unwrap_or(0);
            state.tip_hash = v["tip_hash"].as_str().unwrap_or("").into();
            state.peers = v["peer_count"].as_u64().unwrap_or(0);
            state.error = None;
        }
        Err(e) => {
            state.error = Some(format!("Node unreachable: {}", e));
            state.loading = false;
            return;
        }
    }

    // Fetch last 20 blocks
    let mut blocks = vec![];
    let from = state.height.saturating_sub(19);
    for h in (from..=state.height).rev() {
        let res = node_rpc::call(
            host,
            port,
            "getBlockByHeight",
            serde_json::json!({ "height": h }),
        )
        .await;
        if let Ok(b) = res {
            let hash = b["hash_hex"]
                .as_str()
                .or_else(|| b["hash"].as_str())
                .unwrap_or("")
                .into();
            let txs = b["tx_count"]
                .as_u64()
                .or_else(|| b["transactions"].as_array().map(|a| a.len() as u64))
                .unwrap_or(0);
            let time = b["timestamp"].as_str().unwrap_or("").into();
            blocks.push(BlockRow {
                height: h,
                hash,
                txs,
                time,
            });
        }
    }
    state.blocks = blocks;
    state.loading = false;
}

fn draw(f: &mut Frame, state: &mut ExplorerState) {
    let area = f.area();

    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // header
            Constraint::Length(3), // stats bar
            Constraint::Min(5),    // block table
            Constraint::Length(2), // footer
        ])
        .split(area);

    // ── Header ────────────────────────────────────────────────────
    let title = Paragraph::new(Line::from(vec![
        Span::styled(
            "  ZION ",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled("Block Explorer", Style::default().fg(Color::White)),
        if state.loading {
            Span::styled("  ⟳ loading...", Style::default().fg(Color::DarkGray))
        } else {
            Span::raw("")
        },
    ]))
    .block(
        Block::default()
            .borders(Borders::ALL)
            .border_style(Style::default().fg(Color::Yellow)),
    );
    f.render_widget(title, chunks[0]);

    // ── Stats bar ─────────────────────────────────────────────────
    let stats_text = if let Some(ref e) = state.error {
        format!("  ✗ {}", e)
    } else {
        let short = if state.tip_hash.len() > 16 {
            &state.tip_hash[..16]
        } else {
            &state.tip_hash
        };
        format!(
            "  Height: {}   Tip: {}…   Peers: {}",
            state.height, short, state.peers
        )
    };
    let stats_style = if state.error.is_some() {
        Style::default().fg(Color::Red)
    } else {
        Style::default().fg(Color::Cyan)
    };
    let stats = Paragraph::new(stats_text)
        .style(stats_style)
        .block(Block::default().borders(Borders::ALL).title("Chain"));
    f.render_widget(stats, chunks[1]);

    // ── Block table ───────────────────────────────────────────────
    let header_cells = ["Height", "Hash", "TXs", "Timestamp"].iter().map(|h| {
        Cell::from(*h).style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        )
    });
    let header = Row::new(header_cells).height(1).bottom_margin(0);

    let rows: Vec<Row> = state
        .blocks
        .iter()
        .map(|b| {
            let short_hash = if b.hash.len() > 20 {
                format!("{}...", &b.hash[..20])
            } else {
                b.hash.clone()
            };
            Row::new(vec![
                Cell::from(b.height.to_string()),
                Cell::from(short_hash),
                Cell::from(b.txs.to_string()),
                Cell::from(b.time.clone()),
            ])
        })
        .collect();

    let widths = [
        Constraint::Length(10),
        Constraint::Min(22),
        Constraint::Length(6),
        Constraint::Min(20),
    ];
    let table = Table::new(rows, widths)
        .header(header)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Blocks (↑↓/jk to scroll, r refresh, q quit)"),
        )
        .row_highlight_style(
            Style::default()
                .bg(Color::DarkGray)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("▶ ");

    f.render_stateful_widget(table, chunks[2], &mut state.table_state);

    // ── Footer ────────────────────────────────────────────────────
    let footer = Paragraph::new("  q quit   r refresh   ↑↓ scroll   auto-refresh every 10s")
        .style(Style::default().fg(Color::DarkGray));
    f.render_widget(footer, chunks[3]);
}
