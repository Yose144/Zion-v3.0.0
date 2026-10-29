//! `zion agent` — Hiran coding agent REPL / one-shot (B2B-3b).

use anyhow::Result;
use clap::Parser;
use std::path::PathBuf;

use crate::agent::{run_agent_loop, run_repl, AgentConfig};
use crate::ui;

#[derive(Debug, Parser)]
#[command(about = "Hiran coding agent (REPL or one-shot with -p)")]
pub struct AgentCmd {
    /// One-shot prompt (omit for interactive REPL).
    #[arg(short = 'p', long = "prompt")]
    pub prompt: Option<String>,

    /// Model id (default: hiran-mini).
    #[arg(long)]
    pub model: Option<String>,

    /// Working directory jail (default: cwd).
    #[arg(long)]
    pub cwd: Option<PathBuf>,

    /// Skip confirm prompts for read-only tools (writes/shell still confirm unless FORCE_YES).
    #[arg(long)]
    pub yes: bool,

    /// Max LLM↔tool turns (default: 12).
    #[arg(long)]
    pub max_turns: Option<u32>,

    /// Override gateway base URL (default: https://market.zionterranova.com/v1).
    #[arg(long)]
    pub base_url: Option<String>,
}

pub async fn run(cmd: AgentCmd) -> Result<()> {
    let cfg = AgentConfig::load(cmd.model, cmd.cwd, cmd.max_turns, cmd.yes, cmd.base_url)?;

    match cmd.prompt {
        Some(p) if !p.trim().is_empty() => {
            let answer = run_agent_loop(&cfg, &p).await?;
            println!();
            println!("{answer}");
            Ok(())
        }
        Some(_) => {
            ui::print_err("empty --prompt");
            Ok(())
        }
        None => run_repl(&cfg).await,
    }
}
