use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use anyhow::{Context, Result};
use crossterm::event::{self, Event as CEvent, KeyCode, KeyEvent, KeyEventKind, KeyModifiers};
use ratatui::layout::{Alignment, Constraint, Direction, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{
    Block, Borders, Cell, List, ListItem, ListState, Paragraph, Row, Table, Tabs, Wrap,
};
use ratatui::{DefaultTerminal, Frame};
use serde_json::Value;
use tokio::sync::mpsc;
use tokio::time::interval;
use zion_l1_types::ChainId;
use zion_multichain::MultichainService;

use crate::rpc::node_rpc;

#[derive(Clone, Copy, Debug, PartialEq)]
enum Tab {
    Status,
    Wallet,
    Node,
    Pool,
    Explorer,
}

impl Tab {
    const ALL: &'static [Tab] = &[
        Tab::Status,
        Tab::Wallet,
        Tab::Node,
        Tab::Pool,
        Tab::Explorer,
    ];

    fn title(self) -> &'static str {
        match self {
            Tab::Status => "Status",
            Tab::Wallet => "Wallet",
            Tab::Node => "Node",
            Tab::Pool => "Pool",
            Tab::Explorer => "Explorer",
        }
    }
}

#[derive(Clone, Debug)]
struct BlockItem {
    height: u64,
    hash: String,
    tx_count: usize,
    data: Value,
}

#[derive(Debug)]
enum AppUpdate {
    Loading(bool),
    Health(HashMap<String, bool>),
    Chains(Vec<String>),
    NodeStatus(Option<Value>),
    PoolStats(Option<Value>),
    Blocks(Vec<BlockItem>),
    Wallet {
        address: String,
        balance: Option<u128>,
    },
    Error(String),
}

struct App {
    service: Arc<MultichainService>,
    node_rpc: String,
    tab_index: usize,
    should_quit: bool,
    loading: bool,
    last_error: Option<String>,
    health: HashMap<String, bool>,
    chains: Vec<String>,
    node_status: Option<Value>,
    pool_stats: Option<Value>,
    blocks: Vec<BlockItem>,
    block_state: ListState,
    wallet_address: String,
    wallet_balance: Option<u128>,
    last_refresh: Option<Instant>,
    update_tx: mpsc::UnboundedSender<AppUpdate>,
}

impl App {
    fn new(
        service: Arc<MultichainService>,
        node_rpc: String,
        update_tx: mpsc::UnboundedSender<AppUpdate>,
    ) -> Self {
        let mut block_state = ListState::default();
        block_state.select(None);
        Self {
            service,
            node_rpc,
            tab_index: 0,
            should_quit: false,
            loading: false,
            last_error: None,
            health: HashMap::new(),
            chains: Vec::new(),
            node_status: None,
            pool_stats: None,
            blocks: Vec::new(),
            block_state,
            wallet_address: String::new(),
            wallet_balance: None,
            last_refresh: None,
            update_tx,
        }
    }

    fn apply(&mut self, upd: AppUpdate) {
        let is_loading = matches!(upd, AppUpdate::Loading(_));
        match upd {
            AppUpdate::Loading(v) => self.loading = v,
            AppUpdate::Health(h) => self.health = h,
            AppUpdate::Chains(c) => self.chains = c,
            AppUpdate::NodeStatus(s) => self.node_status = s,
            AppUpdate::PoolStats(s) => self.pool_stats = s,
            AppUpdate::Blocks(b) => {
                self.blocks = b;
                self.block_state.select(self.blocks.first().map(|_| 0));
            }
            AppUpdate::Wallet { address, balance } => {
                self.wallet_address = address;
                self.wallet_balance = balance;
            }
            AppUpdate::Error(e) => self.last_error = Some(e),
        }
        if !is_loading {
            self.last_refresh = Some(Instant::now());
        }
    }

    fn refresh(&mut self) {
        let _ = self.update_tx.send(AppUpdate::Loading(true));
        let service = Arc::clone(&self.service);
        let node_rpc = self.node_rpc.clone();
        let tx = self.update_tx.clone();
        tokio::spawn(async move {
            fetch_all(service, &node_rpc, tx).await;
        });
    }

    fn next_tab(&mut self) {
        self.tab_index = (self.tab_index + 1) % Tab::ALL.len();
    }

    fn prev_tab(&mut self) {
        self.tab_index = (self.tab_index + Tab::ALL.len() - 1) % Tab::ALL.len();
    }

    fn next_item(&mut self) {
        if !matches!(Tab::ALL[self.tab_index], Tab::Explorer) || self.blocks.is_empty() {
            return;
        }
        let i = self.block_state.selected().unwrap_or(0);
        let next = (i + 1).min(self.blocks.len() - 1);
        self.block_state.select(Some(next));
    }

    fn prev_item(&mut self) {
        if !matches!(Tab::ALL[self.tab_index], Tab::Explorer) || self.blocks.is_empty() {
            return;
        }
        let i = self.block_state.selected().unwrap_or(0);
        let prev = i.saturating_sub(1);
        self.block_state.select(Some(prev));
    }
}

pub async fn run_tui(service: Arc<MultichainService>, node_rpc: &str) -> Result<()> {
    let mut terminal =
        ratatui::try_init().context("failed to initialize terminal; try `zion menu` instead")?;
    let result = run_app(&mut terminal, service, node_rpc).await;
    ratatui::restore();
    result
}

async fn run_app(
    terminal: &mut DefaultTerminal,
    service: Arc<MultichainService>,
    node_rpc: &str,
) -> Result<()> {
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<CEvent>();
    let (update_tx, mut update_rx) = mpsc::unbounded_channel::<AppUpdate>();

    let reader_tx = event_tx.clone();
    tokio::task::spawn_blocking(move || {
        while let Ok(evt) = event::read() {
            if reader_tx.send(evt).is_err() {
                break;
            }
        }
    });

    let mut app = App::new(service, node_rpc.to_string(), update_tx);
    app.refresh();

    let mut tick = interval(Duration::from_secs(5));
    let _ = tick.tick().await; // skip immediate first tick

    loop {
        terminal.draw(|f| draw(f, &mut app))?;
        if app.should_quit {
            break;
        }
        tokio::select! {
            _ = tick.tick() => app.refresh(),
            Some(evt) = event_rx.recv() => handle_event(&mut app, evt),
            Some(upd) = update_rx.recv() => app.apply(upd),
            else => break,
        }
    }
    Ok(())
}

async fn fetch_all(
    service: Arc<MultichainService>,
    node_rpc: &str,
    tx: mpsc::UnboundedSender<AppUpdate>,
) {
    macro_rules! send {
        ($e:expr) => {{
            let _ = tx.send($e);
        }};
    }

    send!(AppUpdate::Loading(true));

    send!(AppUpdate::Health(service.health().await));
    send!(AppUpdate::Chains(service.chains()));

    match service.wallet_address(ChainId::ZionL1, 0, 0) {
        Ok(addr) => {
            let encoded = addr.encoded.clone();
            let balance = service.balance(&addr).await;
            let bal_opt = balance.as_ref().map(|a| a.0).ok();
            send!(AppUpdate::Wallet {
                address: encoded,
                balance: bal_opt,
            });
            if let Err(e) = balance {
                send!(AppUpdate::Error(format!("balance: {e}")));
            }
        }
        Err(e) => send!(AppUpdate::Error(format!("wallet address: {e}"))),
    }

    let status = node_rpc::call(node_rpc, "getStatus", Value::Null).await;
    match &status {
        Ok(v) => send!(AppUpdate::NodeStatus(Some(v.clone()))),
        Err(e) => send!(AppUpdate::Error(format!("node: {e}"))),
    }

    send!(AppUpdate::PoolStats(service.pool_stats()));

    let mut blocks = Vec::new();
    if let Ok(v) = &status {
        if let Some(tip) = v
            .get("result")
            .and_then(|r| r.get("chain_height"))
            .and_then(|h| h.as_u64())
        {
            let count = 15;
            let start = tip.saturating_sub(count - 1);
            for h in (start..=tip).rev() {
                if let Ok(bv) =
                    node_rpc::call(node_rpc, "getBlock", serde_json::json!({"height": h})).await
                {
                    if let Some(result) = bv.get("result") {
                        let hash = result["hash"].as_str().unwrap_or("?");
                        let txs = result["transactions"]
                            .as_array()
                            .map(|a| a.len())
                            .unwrap_or(0);
                        blocks.push(BlockItem {
                            height: h,
                            hash: hash.to_string(),
                            tx_count: txs,
                            data: result.clone(),
                        });
                    }
                }
            }
        }
    }
    send!(AppUpdate::Blocks(blocks));
    send!(AppUpdate::Loading(false));
}

fn handle_event(app: &mut App, evt: CEvent) {
    if let CEvent::Key(KeyEvent {
        code,
        kind: KeyEventKind::Press,
        modifiers,
        ..
    }) = evt
    {
        match (code, modifiers) {
            (KeyCode::Char('q'), _) | (KeyCode::Esc, _) => app.should_quit = true,
            (KeyCode::Char('c'), KeyModifiers::CONTROL) => app.should_quit = true,
            (KeyCode::Right | KeyCode::Tab, _) => app.next_tab(),
            (KeyCode::Left, _) | (KeyCode::BackTab, _) => app.prev_tab(),
            (KeyCode::Char('r'), _) => app.refresh(),
            (KeyCode::Char('1'), _) => app.tab_index = 0,
            (KeyCode::Char('2'), _) => app.tab_index = 1,
            (KeyCode::Char('3'), _) => app.tab_index = 2,
            (KeyCode::Char('4'), _) => app.tab_index = 3,
            (KeyCode::Char('5'), _) => app.tab_index = 4,
            (KeyCode::Down, _) => app.next_item(),
            (KeyCode::Up, _) => app.prev_item(),
            _ => {}
        }
    }
}

fn draw(frame: &mut Frame, app: &mut App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(0),
            Constraint::Length(1),
        ])
        .split(frame.area());

    draw_header(frame, app, chunks[0]);
    draw_body(frame, app, chunks[1]);
    draw_footer(frame, app, chunks[2]);
}

fn draw_header(frame: &mut Frame, app: &App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(1),
            Constraint::Length(1),
            Constraint::Length(1),
        ])
        .split(area);

    let title = Line::from(vec![
        Span::styled(
            "ZION ",
            Style::default()
                .fg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            "V31",
            Style::default()
                .fg(Color::White)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" Operator TUI "),
        Span::styled("v3.1.0-beta", Style::default().fg(Color::DarkGray)),
    ]);
    frame.render_widget(
        Paragraph::new(title).alignment(Alignment::Center),
        chunks[0],
    );

    let titles: Vec<String> = Tab::ALL.iter().map(|t| t.title().to_string()).collect();
    let tabs = Tabs::new(titles)
        .select(app.tab_index)
        .highlight_style(
            Style::default()
                .fg(Color::Black)
                .bg(Color::Cyan)
                .add_modifier(Modifier::BOLD),
        )
        .divider("|");
    frame.render_widget(tabs, chunks[1]);

    frame.render_widget(Block::default().borders(Borders::BOTTOM), chunks[2]);
}

fn draw_footer(frame: &mut Frame, app: &App, area: Rect) {
    let status = if app.loading { "[loading]" } else { "[ready]" };
    let refresh = app
        .last_refresh
        .map(|t| format!("{}s", t.elapsed().as_secs()))
        .unwrap_or_else(|| "-".to_string());
    let line = Line::from(vec![
        Span::styled(
            "q",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" quit "),
        Span::styled(
            "<->",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" tab "),
        Span::styled(
            "r",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" refresh "),
        Span::styled(
            "1-5",
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
        Span::raw(" jump "),
        Span::raw(format!("| {} | refresh {}s ago", status, refresh)),
    ]);
    frame.render_widget(Paragraph::new(line), area);
}

fn draw_body(frame: &mut Frame, app: &mut App, area: Rect) {
    let content_area = if let Some(ref e) = app.last_error {
        let chunks = Layout::default()
            .direction(Direction::Vertical)
            .constraints([Constraint::Length(3), Constraint::Min(0)])
            .split(area);
        let error = Paragraph::new(Line::from(vec![
            Span::styled(
                "! ",
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            ),
            Span::styled(e.clone(), Style::default().fg(Color::Red)),
        ]))
        .wrap(Wrap { trim: true })
        .block(Block::default().borders(Borders::ALL).title("Error"));
        frame.render_widget(error, chunks[0]);
        chunks[1]
    } else {
        area
    };

    match Tab::ALL[app.tab_index] {
        Tab::Status => draw_status(frame, app, content_area),
        Tab::Wallet => draw_wallet(frame, app, content_area),
        Tab::Node => draw_node(frame, app, content_area),
        Tab::Pool => draw_pool(frame, app, content_area),
        Tab::Explorer => draw_explorer(frame, app, content_area),
    }
}

fn draw_status(frame: &mut Frame, app: &App, area: Rect) {
    if app.health.is_empty() {
        let p = Paragraph::new(
            "No adapters configured. Create a multichain.toml to connect to chains.",
        )
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Adapter Health"),
        );
        frame.render_widget(p, area);
        return;
    }

    let mut items: Vec<_> = app.health.iter().collect();
    items.sort_by(|a, b| a.0.cmp(b.0));

    let rows: Vec<Row> = items
        .into_iter()
        .map(|(chain, ok)| {
            let (status, color) = if *ok {
                ("ok", Color::Green)
            } else {
                ("unreachable", Color::Red)
            };
            Row::new(vec![
                Cell::from(chain.as_str()),
                Cell::from(Span::styled(status, Style::default().fg(color))),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [Constraint::Percentage(50), Constraint::Percentage(50)],
    )
    .header(
        Row::new(vec!["Chain", "Status"]).style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
    )
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title("Adapter Health"),
    );
    frame.render_widget(table, area);
}

fn draw_wallet(frame: &mut Frame, app: &App, area: Rect) {
    let balance = match app.wallet_balance {
        Some(b) => format!("{:.6} ZION ({} flowers)", b as f64 / 1_000_000.0, b),
        None => "Loading...".to_string(),
    };
    let text = format!("Address: {}\n\nBalance: {}", app.wallet_address, balance);
    let p = Paragraph::new(text)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Default Wallet (account 0 / index 0)"),
        )
        .wrap(Wrap { trim: true });
    frame.render_widget(p, area);
}

fn draw_node(frame: &mut Frame, app: &App, area: Rect) {
    let mut rows = Vec::new();
    if let Some(ref v) = app.node_status {
        let fields = [
            ("Chain Height", metric_value(v, "chain_height")),
            ("Peers", metric_value(v, "peers")),
            ("Difficulty", metric_f64(v, "difficulty", 4)),
            ("Hashrate", metric_f64(v, "hashrate", 2)),
            ("Protocol Version", metric_value(v, "protocol_version")),
        ];
        for (k, val) in fields {
            rows.push(Row::new(vec![Cell::from(k), Cell::from(val)]));
        }
    }
    if rows.is_empty() {
        rows.push(Row::new(vec![
            Cell::from("Status"),
            Cell::from("unavailable"),
        ]));
    }

    let table = Table::new(
        rows,
        [Constraint::Percentage(40), Constraint::Percentage(60)],
    )
    .header(
        Row::new(vec!["Metric", "Value"]).style(
            Style::default()
                .fg(Color::Yellow)
                .add_modifier(Modifier::BOLD),
        ),
    )
    .block(
        Block::default()
            .borders(Borders::ALL)
            .title("L1 Node Status"),
    );
    frame.render_widget(table, area);
}

fn draw_pool(frame: &mut Frame, app: &App, area: Rect) {
    if let Some(ref v) = app.pool_stats {
        let mut rows = Vec::new();
        let fields = [
            ("Accepted", get_json_str(v, "accepted")),
            ("Rejected", get_json_str(v, "rejected")),
            ("Pool Fee (bps)", get_json_str(v, "pool_fee_bps")),
            ("PPLNS Window", get_json_str(v, "pplns_window_size")),
            ("PPLNS Blocks", get_json_str(v, "pplns_window_blocks")),
            ("Pool Address", get_json_str(v, "pool_address")),
        ];
        for (k, val) in fields {
            rows.push(Row::new(vec![Cell::from(k), Cell::from(val)]));
        }
        let table = Table::new(
            rows,
            [Constraint::Percentage(40), Constraint::Percentage(60)],
        )
        .header(
            Row::new(vec!["Metric", "Value"]).style(
                Style::default()
                    .fg(Color::Yellow)
                    .add_modifier(Modifier::BOLD),
            ),
        )
        .block(Block::default().borders(Borders::ALL).title("Pool Stats"));
        frame.render_widget(table, area);
    } else {
        let p = Paragraph::new("Pool not configured or not running.")
            .block(Block::default().borders(Borders::ALL).title("Pool Stats"));
        frame.render_widget(p, area);
    }
}

fn draw_explorer(frame: &mut Frame, app: &mut App, area: Rect) {
    let chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(40), Constraint::Percentage(60)])
        .split(area);

    let items: Vec<ListItem> = app
        .blocks
        .iter()
        .map(|b| {
            let short = if b.hash.len() > 16 {
                &b.hash[..16]
            } else {
                &b.hash
            };
            ListItem::new(format!("{:>8}  0x{}  {} txs", b.height, short, b.tx_count))
        })
        .collect();

    let list = List::new(items)
        .block(
            Block::default()
                .borders(Borders::ALL)
                .title("Latest Blocks"),
        )
        .highlight_style(
            Style::default()
                .bg(Color::DarkGray)
                .add_modifier(Modifier::BOLD),
        )
        .highlight_symbol("> ");
    frame.render_stateful_widget(list, chunks[0], &mut app.block_state);

    let detail = if let Some(i) = app.block_state.selected() {
        app.blocks
            .get(i)
            .map(|b| serde_json::to_string_pretty(&b.data).unwrap_or_default())
            .unwrap_or_default()
    } else {
        String::new()
    };
    let p = Paragraph::new(detail)
        .block(Block::default().borders(Borders::ALL).title("Block Detail"))
        .wrap(Wrap { trim: true });
    frame.render_widget(p, chunks[1]);
}

fn get_json<'a>(v: &'a Value, key: &str) -> Option<&'a Value> {
    v.get("result")?.get(key)
}

fn fmt_value(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Null => "null".to_string(),
        _ => v.to_string(),
    }
}

fn metric_value(v: &Value, key: &str) -> String {
    if let Some(n) = get_json(v, key).and_then(|x| x.as_u64()) {
        n.to_string()
    } else {
        get_json(v, key)
            .map(fmt_value)
            .unwrap_or_else(|| "-".to_string())
    }
}

fn metric_f64(v: &Value, key: &str, decimals: usize) -> String {
    get_json(v, key)
        .and_then(|x| x.as_f64())
        .map(|n| format!("{:.*}", decimals, n))
        .unwrap_or_else(|| metric_value(v, key))
}

fn get_json_str(v: &Value, key: &str) -> String {
    v.get(key).map(fmt_value).unwrap_or_else(|| "-".to_string())
}
