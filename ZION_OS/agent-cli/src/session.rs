use crate::{
    agent_loop::run_task,
    config::AgentConfig,
    tools::inference,
    ui,
};
use anyhow::Result;
use colored::Colorize;
use std::io::{self, Write};

pub async fn run_interactive(cfg: &AgentConfig) -> Result<()> {
    ui::print_header("ZION Agent — Interactive Session");
    println!(
        "  Model: {} | API: {}",
        cfg.llm.model.dimmed(),
        cfg.llm.api_url.dimmed()
    );
    println!("  Type 'exit' or press Ctrl+C to quit.");
    println!();

    loop {
        print!("{} ", "zion-agent>".bold().cyan());
        io::stdout().flush()?;

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim();

        if input.eq_ignore_ascii_case("exit")
            || input.eq_ignore_ascii_case("quit")
            || input.eq_ignore_ascii_case("q")
        {
            ui::print_info("Session ended.");
            break;
        }

        if input.is_empty() {
            continue;
        }

        if input.eq_ignore_ascii_case("status") {
            ui::print_info(&format!(
                "Model: {} | API: {} | Max steps: {}",
                cfg.llm.model, cfg.llm.api_url, cfg.agent.max_steps
            ));
            continue;
        }

        if let Err(e) = run_task(cfg, input, false).await {
            ui::print_err(&format!("Task failed: {}", e));
        }

        println!();
    }

    Ok(())
}

pub async fn chat_repl(cfg: &AgentConfig) -> Result<()> {
    ui::print_header("ZION Agent — Chat Mode");
    println!(
        "  Connected to: {} | Model: {}",
        cfg.llm.api_url.dimmed(),
        cfg.llm.model.dimmed()
    );
    println!("  Type 'exit' or press Ctrl+C to quit.");
    println!();

    let mut history: Vec<(String, String)> = Vec::new();

    loop {
        print!("{} ", "you>".bold().green());
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

        // Build context from history
        let mut full_prompt = String::new();
        for (q, a) in &history {
            full_prompt.push_str(&format!("User: {}\nAgent: {}\n", q, a));
        }
        full_prompt.push_str(&format!("User: {}\nAgent:", input));

        match inference::ask(cfg, &full_prompt).await {
            Ok(answer) => {
                println!("{} {}", "agent>".bold().cyan(), answer);
                history.push((input.to_string(), answer));
                if history.len() > 10 {
                    history.remove(0);
                }
            }
            Err(e) => {
                ui::print_err(&format!("Error: {}", e));
            }
        }

        println!();
    }

    ui::print_info("Chat session ended.");
    Ok(())
}
