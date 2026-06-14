use crate::{
    config::AgentConfig,
    llm::{LlmClient, LlmResponse},
    memory::{AgentMemory, SessionContext},
    planner::Planner,
    safety::SafetyChecker,
    tools::ToolRegistry,
    ui,
};
use anyhow::Result;
use colored::Colorize;
use tracing::{debug, warn};

pub async fn run_task(cfg: &AgentConfig, task: &str, dry_run: bool) -> Result<()> {
    ui::print_header("ZION Agent Task");
    println!("  Task: {}", task.dimmed());
    println!();

    let planner = Planner::new(cfg);
    let plan = planner.plan(task)?;
    if !plan.is_empty() {
        ui::print_info("Plan:");
        for (i, step) in plan.iter().enumerate() {
            println!("  {} {}", format!("{}.", i + 1).dimmed(), step);
        }
        println!();
    }

    if dry_run {
        ui::print_info("Dry-run mode: agent will plan but not execute.");
        println!();
    }

    let llm = LlmClient::new(&cfg.llm);
    let tools = ToolRegistry::new(cfg);
    let safety = SafetyChecker::new(cfg);
    let mut memory = AgentMemory::new(cfg);
    let mut session = SessionContext::new(task);

    for step in 0..cfg.agent.max_steps {
        debug!("Agent step {}/{}", step + 1, cfg.agent.max_steps);

        // Build prompt from session context
        let messages = session.build_messages(&memory);

        // Call LLM with tool schema
        let response = llm.chat_with_tools(&messages, &tools.schema()).await?;

        match response {
            LlmResponse::ToolCall(tc) => {
                // Safety check
                if !safety.is_allowed(&tc)? {
                    ui::print_warn(&format!(
                        "Safety blocked: {} {}",
                        tc.name.bold(),
                        format!("{:?}", tc.arguments).dimmed()
                    ));
                    session.add_safety_block(&tc);
                    continue;
                }

                if dry_run {
                    ui::print_info(&format!(
                        "[DRY-RUN] Would execute: {} {}",
                        tc.name,
                        serde_json::to_string(&tc.arguments)?
                    ));
                    if tc.name == "finish" {
                        break;
                    }
                    session.add_dry_run(&tc);
                    continue;
                }

                // Check if user approval needed
                if safety.requires_approval(&tc) && !cfg.agent.auto_approve_safe {
                    ui::print_tool_call(&tc);
                    match ui::prompt_approval()? {
                        ui::Approval::Yes => {}
                        ui::Approval::No => {
                            ui::print_info("Action cancelled by user.");
                            session.add_user_cancel(&tc);
                            continue;
                        }
                        ui::Approval::Edit => {
                            ui::print_info("Edit mode not yet implemented — skipping.");
                            continue;
                        }
                    }
                }

                // Execute tool
                ui::print_tool_call(&tc);
                let result = tools.execute(&tc).await;

                match result {
                    Ok(output) => {
                        ui::print_tool_result(&output);
                        session.add_observation(&tc, &output);
                        memory.record_success(&tc, &output);

                        // Special: finish tool
                        if tc.name == "finish" {
                            ui::print_ok("Task completed.");
                            return Ok(());
                        }
                    }
                    Err(e) => {
                        ui::print_err(&format!("Tool error: {}", e));
                        session.add_error(&tc, &e.to_string());
                        memory.record_failure(&tc, &e.to_string());
                    }
                }
            }
            LlmResponse::Message(msg) => {
                // LLM responded with text but no tool call — just thinking out loud
                ui::print_agent_message(&msg);
                session.add_assistant_message(&msg);
            }
            LlmResponse::Done => {
                ui::print_ok("Agent finished.");
                return Ok(());
            }
            LlmResponse::Error(e) => {
                warn!("LLM error: {}", e);
                ui::print_err(&format!("LLM error: {}", e));
                return Err(anyhow::anyhow!("LLM error: {}", e));
            }
        }
    }

    ui::print_warn("Max steps reached. Task may be incomplete.");
    Ok(())
}
