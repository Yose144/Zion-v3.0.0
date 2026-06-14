use crate::{
    config::AgentConfig,
    llm::{stream::StreamEvent, Message},
    memory::{AgentMemory, SessionContext},
    planner::Planner,
    safety::{AutoApproveLevel, SafetyChecker},
    tools::ToolRegistry,
};
use anyhow::Result;
use crossterm::event::{self, Event, KeyCode, KeyModifiers};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect, Position},
    style::{Color, Modifier, Style},
    text::{Line, Span, Text},
    widgets::{Block, Borders, Clear, List, ListItem, Paragraph, Wrap},
    Frame,
};
use tokio::sync::mpsc;
use std::time::Duration;

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum PermissionMode {
    Normal,       // Ask for write/execute
    AcceptEdits,  // Auto-approve file edits
    Bypass,       // Auto-approve everything
    Plan,         // Read-only planning
    Ask,          // One-shot question
}

impl PermissionMode {
    pub fn to_auto_level(&self) -> AutoApproveLevel {
        match self {
            PermissionMode::Normal => AutoApproveLevel::Safe,
            PermissionMode::AcceptEdits => AutoApproveLevel::Medium,
            PermissionMode::Bypass => AutoApproveLevel::Dangerous,
            PermissionMode::Plan => AutoApproveLevel::None,
            PermissionMode::Ask => AutoApproveLevel::None,
        }
    }
}

pub struct App {
    pub config: AgentConfig,
    pub messages: Vec<ChatMessage>,
    pub input: String,
    pub input_cursor: usize,
    pub thinking: String,
    pub activity_log: Vec<String>,
    pub permission_mode: PermissionMode,
    pub status: AppStatus,
    pub scroll: usize,
    pub exit: bool,
    pub prompt_tx: mpsc::UnboundedSender<String>,
}

#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub role: ChatRole,
    pub content: String,
    pub tool_name: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ChatRole {
    User,
    Agent,
    Tool,
    System,
    Error,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum AppStatus {
    Idle,
    Thinking,
    ToolCall,
    WaitingApproval,
    Error,
}

impl App {
    pub fn new(cfg: AgentConfig, prompt_tx: mpsc::UnboundedSender<String>) -> Self {
        let mut messages = Vec::new();
        messages.push(ChatMessage {
            role: ChatRole::System,
            content: "ZION Agent CLI v0.1.0 — Type your task and press Enter.\nUse /mode to switch permission, /new for new session, /handoff to cloud.".into(),
            tool_name: None,
        });

        Self {
            config: cfg,
            messages,
            input: String::new(),
            input_cursor: 0,
            thinking: String::new(),
            activity_log: Vec::new(),
            permission_mode: PermissionMode::Normal,
            status: AppStatus::Idle,
            scroll: 0,
            exit: false,
            prompt_tx,
        }
    }

    pub fn add_user_message(&mut self, content: &str) {
        self.messages.push(ChatMessage {
            role: ChatRole::User,
            content: content.to_string(),
            tool_name: None,
        });
        self.scroll_to_bottom();
    }

    pub fn add_agent_message(&mut self, content: &str) {
        self.messages.push(ChatMessage {
            role: ChatRole::Agent,
            content: content.to_string(),
            tool_name: None,
        });
        self.scroll_to_bottom();
    }

    pub fn add_tool_message(&mut self, name: &str, output: &str) {
        self.messages.push(ChatMessage {
            role: ChatRole::Tool,
            content: output.to_string(),
            tool_name: Some(name.to_string()),
        });
        self.activity_log.push(format!("{}: {}", name, output.chars().take(80).collect::<String>()));
        self.scroll_to_bottom();
    }

    pub fn add_error(&mut self, error: &str) {
        self.messages.push(ChatMessage {
            role: ChatRole::Error,
            content: error.to_string(),
            tool_name: None,
        });
        self.status = AppStatus::Error;
        self.scroll_to_bottom();
    }

    pub fn set_thinking(&mut self, text: &str) {
        self.thinking = text.to_string();
        self.status = AppStatus::Thinking;
    }

    pub fn append_thinking(&mut self, text: &str) {
        self.thinking.push_str(text);
    }

    pub fn clear_thinking(&mut self) {
        self.thinking.clear();
        self.status = AppStatus::Idle;
    }

    fn scroll_to_bottom(&mut self) {
        self.scroll = self.messages.len().saturating_sub(1);
    }

    pub fn handle_input(&mut self, key: event::KeyEvent) -> bool {
        match key.code {
            KeyCode::Enter => {
                if !self.input.is_empty() {
                    let text = self.input.clone();
                    self.input.clear();
                    self.input_cursor = 0;

                    // Handle slash commands
                    if text.starts_with('/') {
                        self.handle_slash_command(&text);
                    } else {
                        self.add_user_message(&text);
                        let _ = self.prompt_tx.send(text);
                    }
                }
                true
            }
            KeyCode::Char(c) => {
                self.input.insert(self.input_cursor, c);
                self.input_cursor += 1;
                true
            }
            KeyCode::Backspace => {
                if self.input_cursor > 0 {
                    self.input_cursor -= 1;
                    self.input.remove(self.input_cursor);
                }
                true
            }
            KeyCode::Left => {
                if self.input_cursor > 0 {
                    self.input_cursor -= 1;
                }
                true
            }
            KeyCode::Right => {
                if self.input_cursor < self.input.len() {
                    self.input_cursor += 1;
                }
                true
            }
            KeyCode::Up => {
                if self.scroll > 0 {
                    self.scroll -= 1;
                }
                true
            }
            KeyCode::Down => {
                if self.scroll < self.messages.len().saturating_sub(1) {
                    self.scroll += 1;
                }
                true
            }
            KeyCode::Esc => {
                self.exit = true;
                true
            }
            _ => false,
        }
    }

    fn handle_slash_command(&mut self, cmd: &str) {
        let parts: Vec<&str> = cmd.split_whitespace().collect();
        match parts.first() {
            Some(&"/mode") => {
                if parts.len() > 1 {
                    match parts[1] {
                        "normal" => self.permission_mode = PermissionMode::Normal,
                        "accept-edits" => self.permission_mode = PermissionMode::AcceptEdits,
                        "bypass" => self.permission_mode = PermissionMode::Bypass,
                        "plan" => self.permission_mode = PermissionMode::Plan,
                        "ask" => self.permission_mode = PermissionMode::Ask,
                        _ => {}
                    }
                }
                self.add_system_message(&format!("Mode: {:?}", self.permission_mode));
            }
            Some(&"/continue") => {
                self.add_system_message("Continuing previous session... (load from DB not yet implemented)");
            }
            Some(&"/handoff") => {
                let task = if parts.len() > 1 {
                    parts[1..].join(" ")
                } else {
                    "Continue current task in cloud".to_string()
                };
                self.add_system_message(&format!("Handing off to cloud: {}", task));
                std::env::set_var("ZION_AGENT_HANDOFF", &task);
            }
            Some(&"/new") => {
                self.messages.clear();
                self.activity_log.clear();
                self.add_system_message("New session started.");
            }
            Some(&"/clear") => {
                self.messages.clear();
                self.add_system_message("Chat cleared.");
            }
            Some(&"/help") => {
                self.add_system_message(HELP_TEXT);
            }
            _ => {
                self.add_system_message(&format!("Unknown command: {}. Type /help for list.", cmd));
            }
        }
    }

    fn add_system_message(&mut self, content: &str) {
        self.messages.push(ChatMessage {
            role: ChatRole::System,
            content: content.to_string(),
            tool_name: None,
        });
        self.scroll_to_bottom();
    }
}

const HELP_TEXT: &str = r#"Available commands:
  /mode [normal|accept-edits|bypass|plan|ask]  Switch permission mode
  /continue                                   Resume last session from DB
  /handoff [task]                             Hand off to cloud agent
  /new                                        Start new session
  /clear                                      Clear chat history
  /help                                       Show this help
  Esc                                         Exit

Permission modes:
  normal        — Ask before writes and shell commands
  accept-edits  — Auto-approve file edits, ask for shell
  bypass        — Auto-approve everything (dangerous)
  plan          — Read-only planning, no changes
  ask           — One-shot question, no changes"#;

pub fn draw(f: &mut Frame, app: &App) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Min(10),      // Chat area
            Constraint::Length(8),     // Thinking / activity
            Constraint::Length(3),     // Input
            Constraint::Length(1),     // Status bar
        ])
        .split(f.area());

    draw_chat(f, app, chunks[0]);
    draw_thinking(f, app, chunks[1]);
    draw_input(f, app, chunks[2]);
    draw_status_bar(f, app, chunks[3]);
}

fn draw_chat(f: &mut Frame, app: &App, area: Rect) {
    let items: Vec<ListItem> = app
        .messages
        .iter()
        .skip(app.scroll)
        .map(|msg| {
            let (prefix, style) = match msg.role {
                ChatRole::User => ("You", Style::default().fg(Color::Cyan)),
                ChatRole::Agent => ("Agent", Style::default().fg(Color::Green)),
                ChatRole::Tool => ("Tool", Style::default().fg(Color::Yellow)),
                ChatRole::System => ("", Style::default().fg(Color::Gray)),
                ChatRole::Error => ("Error", Style::default().fg(Color::Red)),
            };

            let text = if !prefix.is_empty() {
                format!("{}: {}", prefix, msg.content)
            } else {
                msg.content.clone()
            };

            let lines: Vec<Line> = text
                .split('\n')
                .map(|l| Line::from(vec![Span::styled(l.to_string(), style)]))
                .collect();

            ListItem::new(Text::from(lines))
        })
        .collect();

    let chat = List::new(items)
        .block(Block::default().borders(Borders::ALL).title("Chat"))
        .highlight_style(Style::default().add_modifier(Modifier::BOLD));

    f.render_widget(chat, area);
}

fn draw_thinking(f: &mut Frame, app: &App, area: Rect) {
    let content = if app.thinking.is_empty() {
        app.activity_log.last().cloned().unwrap_or_default()
    } else {
        app.thinking.clone()
    };

    let style = match app.status {
        AppStatus::Thinking => Style::default().fg(Color::Blue),
        AppStatus::ToolCall => Style::default().fg(Color::Yellow),
        AppStatus::WaitingApproval => Style::default().fg(Color::Magenta),
        AppStatus::Error => Style::default().fg(Color::Red),
        AppStatus::Idle => Style::default().fg(Color::Gray),
    };

    let paragraph = Paragraph::new(content)
        .block(Block::default().borders(Borders::ALL).title("Activity"))
        .style(style)
        .wrap(Wrap { trim: true });

    f.render_widget(paragraph, area);
}

fn draw_input(f: &mut Frame, app: &App, area: Rect) {
    let input_text = format!("{} ", app.input);
    let paragraph = Paragraph::new(input_text)
        .block(Block::default().borders(Borders::ALL).title("Prompt (Enter to send, Esc to exit)"))
        .style(Style::default().fg(Color::White));

    f.render_widget(paragraph, area);

    // Cursor
    let x = area.x + app.input_cursor as u16 + 1;
    let y = area.y + 1;
    f.set_cursor_position(Position::new(x, y));
}

fn draw_status_bar(f: &mut Frame, app: &App, area: Rect) {
    let mode = format!("{:?}", app.permission_mode);
    let status = format!("{:?}", app.status);
    let model = &app.config.llm.model;

    let spans = vec![
        Span::styled(format!(" Mode: {} ", mode), Style::default().bg(Color::Blue).fg(Color::White)),
        Span::raw(" "),
        Span::styled(format!(" Status: {} ", status), Style::default().bg(Color::DarkGray).fg(Color::White)),
        Span::raw(" "),
        Span::styled(format!(" Model: {} ", model), Style::default().bg(Color::DarkGray).fg(Color::White)),
    ];

    let paragraph = Paragraph::new(Line::from(spans));
    f.render_widget(paragraph, area);
}
