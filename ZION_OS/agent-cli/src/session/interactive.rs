use crate::{
    config::AgentConfig,
    llm::{stream::StreamEvent, Message},
    memory::{AgentMemory, SessionContext},
    planner::Planner,
    safety::{AutoApproveLevel, SafetyChecker},
    tools::ToolRegistry,
    tui::{app::App, Tui},
};
use anyhow::Result;
use crossterm::event::{self, Event, KeyCode};
use ratatui::Frame;
use std::time::Duration;
use tokio::sync::mpsc;

/// Run the interactive TUI session
pub async fn run(cfg: &AgentConfig) -> Result<()> {
    let (prompt_tx, mut prompt_rx) = mpsc::unbounded_channel::<String>();
    let (event_tx, mut event_rx) = mpsc::unbounded_channel::<AppEvent>();

    let mut app = App::new(cfg.clone(), prompt_tx.clone());
    let mut tui = Tui::new()?;

    // Health check LLM API
    let health = reqwest::get(format!("{}/models", cfg.llm.api_url.trim_end_matches("/v1"))).await;
    match health {
        Ok(resp) if resp.status().is_success() => {
            app.activity_log.push(format!("Connected to {}", cfg.llm.api_url));
        }
        _ => {
            app.add_error(&format!(
                "LLM API not available at {}.\nPlease start LM Studio (Developer > Start Server) or Ollama.",
                cfg.llm.api_url
            ));
        }
    }

    // Spawn background task for keyboard events
    let event_tx_clone = event_tx.clone();
    tokio::spawn(async move {
        loop {
            if let Ok(true) = event::poll(Duration::from_millis(100)) {
                if let Ok(Event::Key(key)) = event::read() {
                    if event_tx_clone.send(AppEvent::Key(key)).is_err() {
                        break;
                    }
                }
            }
        }
    });

    // Initial prompt if provided (not implemented yet)
    let initial_task = std::env::var("ZION_AGENT_INITIAL_TASK").ok();
    if let Some(task) = initial_task {
        app.add_user_message(&task);
        let _ = event_tx.send(AppEvent::Prompt(task));
    }

    // Main event loop
    let llm = crate::llm::LlmClient::new(&cfg.llm);
    let tools = ToolRegistry::new(cfg);
    let safety = SafetyChecker::new(cfg);
    let mut memory = AgentMemory::new(cfg);
    let mut session = SessionContext::new("Interactive session");

    let mut current_stream: Option<mpsc::UnboundedReceiver<StreamEvent>> = None;
    let mut streaming = false;

    loop {
        // Draw TUI
        if let Err(e) = tui.draw(&app) {
            eprintln!("TUI draw error: {}", e);
            break;
        }

        // Wait for next event
        tokio::select! {
            Some(key_event) = event_rx.recv() => {
                match key_event {
                    AppEvent::Key(key) => {
                        if app.handle_input(key) {
                            // Input was consumed
                        }
                        if app.exit {
                            break;
                        }
                    }
                    AppEvent::Prompt(text) => {
                        // Handle prompt from initial task or slash command
                        app.set_thinking("Thinking...");
                        streaming = true;

                        let messages = session.build_messages(&memory);
                        let schema = tools.schema();
                        let client = crate::llm::stream::StreamingClient::new(&cfg.llm);
                        match client.stream_with_tools(&messages, &schema).await {
                            Ok(rx) => {
                                current_stream = Some(rx);
                            }
                            Err(e) => {
                                app.add_error(&format!("LLM error: {}", e));
                                streaming = false;
                            }
                        }
                    }
                    _ => {}
                }
            }

            Some(text) = prompt_rx.recv(), if !streaming => {
                // User submitted a prompt
                app.set_thinking("Thinking...");
                streaming = true;
                session.add_user_message(&text);

                let messages = session.build_messages(&memory);
                let schema = tools.schema();
                let client = crate::llm::stream::StreamingClient::new(&cfg.llm);
                match client.stream_with_tools(&messages, &schema).await {
                    Ok(rx) => {
                        current_stream = Some(rx);
                    }
                    Err(e) => {
                        app.add_error(&format!("LLM error: {}", e));
                        streaming = false;
                    }
                }
            }

            Some(event) = async {
                if let Some(ref mut rx) = current_stream {
                    rx.recv().await
                } else {
                    None
                }
            }, if streaming => {
                match event {
                    StreamEvent::Content(text) => {
                        app.append_thinking(&text);
                    }
                    StreamEvent::ToolCallStart { id, name } => {
                        app.status = crate::tui::app::AppStatus::ToolCall;
                        app.activity_log.push(format!("Calling tool: {}", name));
                    }
                    StreamEvent::ToolCallArgs { .. } => {
                        // Accumulating args, no UI update needed
                    }
                    StreamEvent::ToolCallEnd { id, name, arguments } => {
                        // Execute the tool
                        app.status = crate::tui::app::AppStatus::ToolCall;
                        let call = crate::llm::ToolCall {
                            id,
                            name: name.clone(),
                            arguments,
                        };

                        // Safety check
                        if !safety.is_allowed(&call).unwrap_or(false) {
                            app.add_error(&format!("Tool '{}' blocked by safety", name));
                            session.add_safety_block(&call);
                            streaming = false;
                            app.clear_thinking();
                            continue;
                        }

                        // Check approval
                        let auto_level = app.permission_mode.to_auto_level();
                        let safety_with_level = SafetyChecker::new_with_level(cfg, auto_level);
                        if safety_with_level.requires_approval(&call) {
                            app.status = crate::tui::app::AppStatus::WaitingApproval;
                            app.activity_log.push(format!("Waiting approval for: {}", name));
                            // In TUI mode, we auto-approve for now (user can see what happened)
                            // TODO: Add approval dialog in TUI
                        }

                        // Execute
                        match tools.execute(&call).await {
                            Ok(output) => {
                                app.add_tool_message(&name, &output);
                                session.add_observation(&call, &output);
                                memory.record_success(&call, &output);

                                if name == "finish" {
                                    app.clear_thinking();
                                    streaming = false;
                                }
                            }
                            Err(e) => {
                                app.add_error(&format!("Tool error: {}", e));
                                session.add_error(&call, &e.to_string());
                                memory.record_failure(&call, &e.to_string());
                            }
                        }

                        streaming = false;
                        app.clear_thinking();
                    }
                    StreamEvent::Done => {
                        app.clear_thinking();
                        streaming = false;
                    }
                    StreamEvent::Error(e) => {
                        app.add_error(&format!("Stream error: {}", e));
                        streaming = false;
                    }
                    _ => {}
                }
            }

            else => {
                // No events, just continue the loop (will redraw)
            }
        }
    }

    tui.restore()?;
    Ok(())
}

enum AppEvent {
    Key(event::KeyEvent),
    Prompt(String),
}
