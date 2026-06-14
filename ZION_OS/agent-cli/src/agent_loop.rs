use crate::{
    config::AgentConfig,
    llm::{LlmClient, LlmResponse},
    memory::{AgentMemory, SessionContext},
    planner::Planner,
    safety::SafetyChecker,
    llm::ToolCall,
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

    // Inject coding assistant system prompt if enabled
    if cfg.coding.enabled {
        session.set_system_prompt(&coding_system_prompt(cfg));
        ui::print_info("Coding assistant mode enabled.");
        ui::print_info(&format!("  Build: {}", cfg.coding.build_cmd));
        ui::print_info(&format!("  Test:  {}", cfg.coding.test_cmd));
        ui::print_info(&format!("  Lint:  {}", cfg.coding.lint_cmd));
        println!();
    }

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

                        // Auto build/test/lint after file edits in coding mode
                        if cfg.coding.enabled && (tc.name == "edit_file" || tc.name == "write_file") {
                            if let Err(e) = run_coding_checks(cfg, &tools, &tc, &mut session, &mut memory).await {
                                ui::print_warn(&format!("Coding check error: {}", e));
                            }
                        }

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

/// System prompt for coding assistant mode
fn coding_system_prompt(cfg: &AgentConfig) -> String {
    let project = &cfg.coding.project_type;
    let mut prompt = format!(
        "You are a senior {} software engineer working in the ZION monorepo.\n",
        project
    );
    prompt.push_str("Follow these rules strictly:\n\n");
    prompt.push_str("1. ALWAYS read existing code before editing (use read_file, search).\n");
    prompt.push_str("2. NEVER write comments explaining 'what' — code should be self-documenting.\n");
    prompt.push_str("3. Use existing patterns, imports, and conventions from the codebase.\n");
    prompt.push_str("4. Run build after edits to catch compilation errors immediately.\n");
    prompt.push_str("5. Run tests after build if available.\n");
    prompt.push_str("6. Run lint/format before finishing.\n");
    prompt.push_str("7. For Rust: check Cargo.toml for deps, use '?' not unwrap(), prefer Result.\n");
    prompt.push_str("8. For JS/TS: check package.json, use existing imports, prefer async/await.\n");
    prompt.push_str("9. Keep changes minimal and focused.\n");
    prompt.push_str("10. If a file is large, read specific lines (offset, limit) rather than all.\n\n");
    prompt.push_str("Available coding tools:\n");
    prompt.push_str(&format!("- build: {}\n", cfg.coding.build_cmd));
    prompt.push_str(&format!("- test:  {}\n", cfg.coding.test_cmd));
    prompt.push_str(&format!("- lint:  {}\n", cfg.coding.lint_cmd));
    prompt.push_str(&format!("- format: {}\n", cfg.coding.fmt_cmd));
    prompt.push_str("\nThink step-by-step. When you finish, call finish tool.");
    prompt
}

/// Auto-run build/test/lint after file edits in coding mode
async fn run_coding_checks(
    cfg: &AgentConfig,
    tools: &ToolRegistry,
    last_tool: &ToolCall,
    session: &mut SessionContext,
    memory: &mut AgentMemory,
) -> Result<()> {
    if !cfg.coding.enabled {
        return Ok(());
    }

    // Build
    if cfg.coding.auto_build {
        ui::print_info("Auto-running build after file edit...");
        let build_call = ToolCall {
            id: String::new(),
            name: "build".into(),
            arguments: serde_json::json!({}),
        };
        match tools.execute(&build_call).await {
            Ok(output) => {
                ui::print_tool_result(&output);
                session.add_observation(&build_call, &output);
                memory.record_success(&build_call, &output);

                // Test only if build succeeded
                if cfg.coding.auto_test && !output.contains("error") && !output.contains("failed") {
                    ui::print_info("Build OK. Auto-running tests...");
                    let test_call = ToolCall {
                        id: String::new(),
                        name: "test".into(),
                        arguments: serde_json::json!({}),
                    };
                    match tools.execute(&test_call).await {
                        Ok(test_out) => {
                            ui::print_tool_result(&test_out);
                            session.add_observation(&test_call, &test_out);
                            memory.record_success(&test_call, &test_out);
                        }
                        Err(e) => {
                            ui::print_err(&format!("Test failed: {}", e));
                            session.add_error(&test_call, &e.to_string());
                            memory.record_failure(&test_call, &e.to_string());
                        }
                    }
                }
            }
            Err(e) => {
                ui::print_err(&format!("Build failed: {}", e));
                session.add_error(&build_call, &e.to_string());
                memory.record_failure(&build_call, &e.to_string());
            }
        }
    }

    // Lint
    if cfg.coding.auto_lint {
        ui::print_info("Auto-running lint...");
        let lint_call = ToolCall {
            id: String::new(),
            name: "lint".into(),
            arguments: serde_json::json!({}),
        };
        match tools.execute(&lint_call).await {
            Ok(output) => {
                ui::print_tool_result(&output);
                session.add_observation(&lint_call, &output);
                memory.record_success(&lint_call, &output);
            }
            Err(e) => {
                ui::print_warn(&format!("Lint issues: {}", e));
                session.add_error(&lint_call, &e.to_string());
                memory.record_failure(&lint_call, &e.to_string());
            }
        }
    }

    Ok(())
}
