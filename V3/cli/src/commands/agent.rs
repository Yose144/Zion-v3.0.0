use anyhow::Result;
use clap::Subcommand;
use std::io::{self, Write};

use crate::config::Config;
use crate::rpc::agent_rpc;
use crate::ui;

#[derive(Subcommand)]
pub enum AgentCmd {
    /// Start Hiranyagarbha AI Native runtime
    Start,
    /// Stop the agent
    Stop,
    /// Restart the agent
    Restart,
    /// Agent health + session info
    Status,
    /// Interactive REPL chat with Hiranyagarbha
    Chat,
    /// Single question, print answer, exit
    Ask { question: String },
    /// Stream agent logs
    Logs,
    /// Agent config
    Config,
    /// Memory management
    Memory {
        #[command(subcommand)]
        cmd: MemoryCmd,
    },
    /// RAG knowledge base
    Rag {
        #[command(subcommand)]
        cmd: RagCmd,
    },
    /// Active / queued tasks
    Tasks,
    /// Warp agent integration status
    Warp,
    /// NCL integration status
    Ncl,
    /// Oasis bridge status
    Oasis,
}

#[derive(Subcommand)]
pub enum MemoryCmd {
    /// List memory entries
    Ls,
    /// Flush session memory
    Flush,
}

#[derive(Subcommand)]
pub enum RagCmd {
    /// Rebuild the RAG index
    Index,
    /// Direct RAG query (no LLM)
    Query { question: String },
}

pub async fn run(cfg: &Config, cmd: AgentCmd) -> Result<()> {
    let url = &cfg.agent.url;

    match cmd {
        AgentCmd::Status => agent_status(url).await,
        AgentCmd::Chat => agent_chat(url).await,
        AgentCmd::Ask { question } => {
            ui::print_header("Hiranyagarbha");
            let answer = agent_rpc::ask(url, &question).await;
            match answer {
                Ok(a) => println!("  ◉ {}", a),
                Err(e) => ui::print_err(&format!("Agent error: {}", e)),
            }
            println!();
            Ok(())
        }
        AgentCmd::Start => {
            ui::print_info("Starting Hiranyagarbha agent...");
            ui::print_info("Use docker-compose or systemd to manage the L3/ai-native service.");
            ui::print_info("Example: zion deploy start agent");
            Ok(())
        }
        AgentCmd::Stop => {
            ui::print_info("Stopping agent via deploy layer...");
            crate::commands::deploy::stop_service(cfg, "agent").await
        }
        AgentCmd::Restart => crate::commands::deploy::restart_service(cfg, "agent").await,
        AgentCmd::Logs => crate::commands::deploy::tail_logs(cfg, "agent").await,
        AgentCmd::Config => {
            ui::print_header("Agent Config");
            ui::print_row("URL", url);
            ui::print_row("Model", &cfg.agent.model);
            // Try to fetch agent config
            let result = agent_rpc::get(url, "config").await;
            if let Ok(v) = result {
                println!("{}", serde_json::to_string_pretty(&v)?);
            }
            println!();
            Ok(())
        }
        AgentCmd::Memory { cmd } => match cmd {
            MemoryCmd::Ls => {
                ui::print_header("Agent Memory");
                let result = agent_rpc::get(url, "memory").await;
                match result {
                    Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                    Err(e) => ui::print_warn(&format!("Cannot fetch memory: {}", e)),
                }
                println!();
                Ok(())
            }
            MemoryCmd::Flush => {
                let result = agent_rpc::post(url, "memory/flush", serde_json::json!({})).await;
                match result {
                    Ok(_) => ui::print_ok("Session memory flushed"),
                    Err(e) => ui::print_warn(&format!("Flush failed: {}", e)),
                }
                println!();
                Ok(())
            }
        },
        AgentCmd::Rag { cmd } => match cmd {
            RagCmd::Index => {
                ui::print_info("Rebuilding RAG knowledge base index...");
                let result = agent_rpc::post(url, "rag/index", serde_json::json!({})).await;
                match result {
                    Ok(v) => {
                        ui::print_ok("Index rebuilt");
                        println!("  {}", v);
                    }
                    Err(e) => ui::print_warn(&format!("Index failed: {}", e)),
                }
                println!();
                Ok(())
            }
            RagCmd::Query { question } => {
                ui::print_header("RAG Query");
                let result =
                    agent_rpc::post(url, "rag/query", serde_json::json!({ "query": question }))
                        .await;
                match result {
                    Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                    Err(e) => ui::print_warn(&format!("RAG query failed: {}", e)),
                }
                println!();
                Ok(())
            }
        },
        AgentCmd::Tasks => {
            ui::print_header("Agent Tasks");
            let result = agent_rpc::get(url, "tasks").await;
            match result {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Tasks unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        AgentCmd::Warp => {
            ui::print_header("Warp Agent (L3)");
            let result = agent_rpc::get(url, "warp/status").await;
            match result {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Warp status unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        AgentCmd::Ncl => {
            ui::print_header("NCL Integration (L3)");
            let result = agent_rpc::get(url, "ncl/status").await;
            match result {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("NCL status unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        AgentCmd::Oasis => {
            ui::print_header("Oasis Bridge");
            let result = agent_rpc::get(url, "oasis/status").await;
            match result {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("Oasis status unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
    }
}

async fn agent_status(url: &str) -> Result<()> {
    ui::print_header("Hiranyagarbha — AI Native Agent");
    let alive = agent_rpc::health(url).await.unwrap_or(false);
    if alive {
        ui::print_ok(&format!("Agent online at {}", url));
        let result = agent_rpc::get(url, "status").await;
        if let Ok(v) = result {
            if let Some(sessions) = v["sessions"].as_u64() {
                ui::print_row("Sessions", &sessions.to_string());
            }
            if let Some(model) = v["model"].as_str() {
                ui::print_row("Model", model);
            }
            if let Some(uptime) = v["uptime"].as_str() {
                ui::print_row("Uptime", uptime);
            }
        }
    } else {
        ui::print_err(&format!("Agent unreachable at {}", url));
        ui::print_info("Start with: zion agent start");
    }
    println!();
    Ok(())
}

async fn agent_chat(url: &str) -> Result<()> {
    let alive = agent_rpc::health(url).await.unwrap_or(false);
    if !alive {
        ui::print_err(&format!("Agent unreachable at {}", url));
        ui::print_info("Start with: zion agent start");
        return Ok(());
    }

    println!();
    println!("  ╔══════════════════════════════════╗");
    println!("  ║  Hiranyagarbha — ZION AI Native  ║");
    println!("  ║  Om Namo Hiranyagarbha            ║");
    println!("  ╚══════════════════════════════════╝");
    println!("  Type your message. 'exit' or Ctrl+C to quit.");
    println!();

    loop {
        print!("  > ");
        io::stdout().flush()?;

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim();

        if input.eq_ignore_ascii_case("exit") || input.eq_ignore_ascii_case("quit") {
            break;
        }
        if input.is_empty() {
            continue;
        }

        let answer = agent_rpc::ask(url, input).await;
        match answer {
            Ok(a) => println!("  ◉ {}\n", a),
            Err(e) => println!("  ✗ Error: {}\n", e),
        }
    }

    println!();
    ui::print_info("Peace & One Love. Gate, Gate, Paragate.");
    println!();
    Ok(())
}
