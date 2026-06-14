use crate::{
    config::AgentConfig,
    llm::{LlmClient, LlmResponse, ToolCall},
    memory::{AgentMemory, SessionContext},
    planner::Planner,
    safety::SafetyChecker,
    tools::ToolRegistry,
    ui,
};
use anyhow::Result;
use colored::Colorize;
use tracing::{debug, info, warn};

const MAX_BUILD_RETRIES: u32 = 3;

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

    // Initialize persistent state
    memory.save_state(task, cfg.agent.max_steps);
    memory.set_status("running");

    // Inject coding assistant system prompt if enabled
    if cfg.coding.enabled {
        session.set_system_prompt(&coding_system_prompt(cfg));
        ui::print_info("Coding assistant mode enabled.");
        ui::print_info(&format!("  Build: {}", cfg.coding.build_cmd));
        ui::print_info(&format!("  Test:  {}", cfg.coding.test_cmd));
        ui::print_info(&format!("  Lint:  {}", cfg.coding.lint_cmd));
        println!();
    }

    info!("Session {} started", memory.session_id());

    for _step in 0..cfg.agent.max_steps {
        let current_step = memory.increment_step();
        debug!("Agent step {}/{}", current_step, cfg.agent.max_steps);

        // Persist messages before LLM call
        memory.save_messages(&session.build_messages(&memory));

        // Build prompt from session context
        let messages = session.build_messages(&memory);

        // Call LLM with tool schema
        let response = match llm.chat_with_tools(&messages, &tools.schema()).await {
            Ok(r) => r,
            Err(e) => {
                warn!("LLM connection error: {}. Retrying in 5s...", e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                match llm.chat_with_tools(&messages, &tools.schema()).await {
                    Ok(r) => r,
                    Err(e2) => {
                        ui::print_err(&format!("LLM failed twice: {}", e2));
                        memory.set_status("failed");
                        return Err(e2);
                    }
                }
            }
        };

        match response {
            LlmResponse::ToolCall(tc) => {
                // Safety check
                if !safety.is_allowed(&tc)? {
                    let reason = safety.approval_reason(&tc);
                    ui::print_warn(&format!(
                        "Safety blocked ({}): {} {}",
                        reason.red(),
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
                if safety.requires_approval(&tc) {
                    let risk = safety.classify(&tc);
                    ui::print_tool_call(&tc);
                    println!("  Risk level: {:?}", risk);
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
                            if let Err(e) = run_coding_checks_with_retry(
                                cfg, &tools, &mut session, &mut memory, &llm
                            ).await {
                                ui::print_warn(&format!("Coding check could not resolve: {}", e));
                            }
                        }

                        // Special: finish tool
                        if tc.name == "finish" {
                            ui::print_ok("Task completed.");
                            memory.set_status("completed");
                            return Ok(());
                        }
                    }
                    Err(e) => {
                        let err_msg = e.to_string();
                        ui::print_err(&format!("Tool error: {}", err_msg));
                        session.add_error(&tc, &err_msg);
                        memory.record_failure(&tc, &err_msg);

                        // Self-correction: add instruction to fix the error
                        session.add_self_correction_hint(&tc, &err_msg);
                    }
                }
            }
            LlmResponse::Message(msg) => {
                ui::print_agent_message(&msg);
                session.add_assistant_message(&msg);
            }
            LlmResponse::Done => {
                ui::print_ok("Agent finished.");
                memory.set_status("completed");
                return Ok(());
            }
            LlmResponse::Error(e) => {
                warn!("LLM error: {}", e);
                ui::print_err(&format!("LLM error: {}", e));
                memory.set_status("failed");
                return Err(anyhow::anyhow!("LLM error: {}", e));
            }
        }
    }

    ui::print_warn("Max steps reached. Task may be incomplete.");
    memory.set_status("incomplete");
    Ok(())
}

/// Auto-run build/test/lint with self-healing retry
async fn run_coding_checks_with_retry(
    cfg: &AgentConfig,
    tools: &ToolRegistry,
    session: &mut SessionContext,
    memory: &mut AgentMemory,
    llm: &LlmClient,
) -> Result<()> {
    if !cfg.coding.enabled {
        return Ok(());
    }

    // Build
    let mut build_ok = false;
    for attempt in 0..=MAX_BUILD_RETRIES {
        if attempt > 0 {
            ui::print_info(&format!("Build retry {}/{} — asking LLM to fix...", attempt, MAX_BUILD_RETRIES));
            memory.increment_retry();
            // Ask LLM to fix
            session.add_user_message("The previous build failed. Please analyze the errors and fix them. Use read_file to inspect the error locations, then edit_file to fix the issues.");
            let messages = session.build_messages(memory);
            let response = llm.chat_with_tools(&messages, &tools.schema()).await?;
            if let LlmResponse::ToolCall(tc) = response {
                if tc.name == "read_file" || tc.name == "edit_file" || tc.name == "write_file" {
                    ui::print_tool_call(&tc);
                    match tools.execute(&tc).await {
                        Ok(out) => {
                            ui::print_tool_result(&out);
                            session.add_observation(&tc, &out);
                        }
                        Err(e) => {
                            session.add_error(&tc, &e.to_string());
                        }
                    }
                }
            }
        }

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

                if output.contains("error") || output.contains("failed") || output.contains("FAILED") {
                    if attempt == MAX_BUILD_RETRIES {
                        ui::print_err("Build failed after all retries. Manual fix needed.");
                        return Err(anyhow::anyhow!("Build failed after {} retries", MAX_BUILD_RETRIES));
                    }
                    // Will retry
                    continue;
                }

                build_ok = true;

                // Test only if build succeeded
                if cfg.coding.auto_test {
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
                            if test_out.contains("FAILED") || test_out.contains("failures:") {
                                ui::print_warn("Some tests failed — review output above.");
                            }
                        }
                        Err(e) => {
                            ui::print_err(&format!("Test failed: {}", e));
                            session.add_error(&test_call, &e.to_string());
                            memory.record_failure(&test_call, &e.to_string());
                        }
                    }
                }
                break;
            }
            Err(e) => {
                ui::print_err(&format!("Build failed: {}", e));
                session.add_error(&build_call, &e.to_string());
                memory.record_failure(&build_call, &e.to_string());
                if attempt == MAX_BUILD_RETRIES {
                    return Err(anyhow::anyhow!("Build failed after {} retries", MAX_BUILD_RETRIES));
                }
            }
        }
    }

    // Lint
    if cfg.coding.auto_lint && build_ok {
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
    prompt.push_str("\nWhen build fails, the agent will automatically retry with your fixes. ");
    prompt.push_str("Think step-by-step. When you finish, call finish tool.");
    prompt
}
