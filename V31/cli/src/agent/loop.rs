//! Tool-calling agent loop + simple REPL.

use anyhow::{Context, Result};
use colored::Colorize;
use std::io::{self, Write};

use super::client::{extract_tool_calls, ChatMessage, HiranClient};
use super::config::AgentConfig;
use super::policy::Policy;
use super::prompt;
use super::tools;
use crate::ui;

pub async fn run_agent_loop(cfg: &AgentConfig, user_prompt: &str) -> Result<String> {
    let key = cfg.require_api_key()?;
    let client = HiranClient::new(&cfg.base_url, key, &cfg.model)?;
    let _ = cfg.yes; // reserved: skip non-destructive confirms (already ConfirmKind::None)
    let policy = Policy::new(cfg.cwd.clone());

    let system = prompt::coding_agent_system(&cfg.cwd.display().to_string());
    let mut messages = vec![
        ChatMessage {
            role: "system".into(),
            content: Some(system),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        },
        ChatMessage {
            role: "user".into(),
            content: Some(user_prompt.into()),
            tool_calls: None,
            tool_call_id: None,
            name: None,
        },
    ];

    ui::print_info(&format!(
        "model={} cwd={} max_turns={}",
        cfg.model,
        cfg.cwd.display(),
        cfg.max_turns
    ));

    for turn in 1..=cfg.max_turns {
        ui::print_info(&format!("turn {turn}/{}", cfg.max_turns));
        let reply = client.chat(&messages, true).await.context("LLM turn")?;
        let calls = extract_tool_calls(&reply);

        if calls.is_empty() {
            let text = reply.content.clone().unwrap_or_default();
            messages.push(reply);
            return Ok(text);
        }

        // Keep assistant message (with tool_calls or fence content).
        messages.push(reply.clone());

        // If model used JSON fence (no native tool_calls), also mirror as tool role msgs.
        let native = reply.tool_calls.as_ref().map(|c| !c.is_empty()).unwrap_or(false);

        for call in &calls {
            ui::print_info(&format!("tool {} {}", call.name.cyan(), summarize_args(&call.args)));
            let result = match tools::execute_tool(&policy, call).await {
                Ok(r) => r,
                Err(e) => format!("ERROR: {e}"),
            };
            let preview: String = result.chars().take(200).collect();
            ui::print_ok(&format!("→ {}", preview.replace('\n', " ")));

            if native {
                messages.push(ChatMessage {
                    role: "tool".into(),
                    content: Some(result),
                    tool_calls: None,
                    tool_call_id: Some(call.id.clone()),
                    name: Some(call.name.clone()),
                });
            } else {
                messages.push(ChatMessage {
                    role: "user".into(),
                    content: Some(format!(
                        "TOOL_RESULT name={} id={}:\n{}",
                        call.name, call.id, result
                    )),
                    tool_calls: None,
                    tool_call_id: None,
                    name: None,
                });
            }
        }
    }

    anyhow::bail!("max turns ({}) reached without final answer", cfg.max_turns)
}

pub async fn run_repl(cfg: &AgentConfig) -> Result<()> {
    ui::print_header("ZION Hiran Agent");
    ui::print_info(&format!(
        "model={}  cwd={}",
        cfg.model,
        cfg.cwd.display()
    ));
    ui::print_info("Type a task, or /quit to exit. Empty line ignored.");
    println!();

    let stdin = io::stdin();
    loop {
        print!("{} ", "agent>".bright_yellow().bold());
        io::stdout().flush()?;
        let mut line = String::new();
        if stdin.read_line(&mut line)? == 0 {
            break;
        }
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if matches!(line, "/quit" | "/exit" | "quit" | "exit") {
            break;
        }
        match run_agent_loop(cfg, line).await {
            Ok(answer) => {
                println!();
                println!("{}", answer);
                println!();
            }
            Err(e) => ui::print_err(&format!("{e:#}")),
        }
    }
    Ok(())
}

fn summarize_args(args: &serde_json::Value) -> String {
    let s = args.to_string();
    if s.len() > 120 {
        format!("{}…", &s[..120])
    } else {
        s
    }
}
