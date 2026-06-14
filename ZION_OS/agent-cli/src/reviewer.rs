use crate::{config::AgentConfig, llm, ui};
use anyhow::Result;
use tokio::process::Command;

pub async fn run_review(
    cfg: &AgentConfig,
    branch: Option<String>,
    output: Option<String>,
) -> Result<()> {
    ui::print_header("ZION Agent — Code Review");

    let diff = if let Some(b) = branch {
        let output = Command::new("git")
            .args(["diff", &format!("origin/{}..HEAD", b)])
            .output()
            .await?;
        String::from_utf8_lossy(&output.stdout).into_owned()
    } else {
        let output = Command::new("git")
            .args(["diff", "HEAD"])
            .output()
            .await?;
        String::from_utf8_lossy(&output.stdout).into_owned()
    };

    if diff.is_empty() {
        ui::print_info("No changes to review.");
        return Ok(());
    }

    let lines = diff.lines().count();
    ui::print_info(&format!("Diff: {} lines. Sending to LLM...", lines));

    let llm_client = llm::LlmClient::new(&cfg.llm);
    let messages = vec![
        llm::Message::system("You are a senior Rust code reviewer for the ZION blockchain project. Focus on: safety, consensus-critical code, performance, and idiomatic Rust."),
        llm::Message::user(format!(
            "Review this git diff and produce a concise code review report.\n\n```diff\n{}\n```\n\nFormat:\n## Summary (1-2 sentences)\n## Critical Issues (if any)\n## Suggestions\n## Approval Status (APPROVE / NEEDS_WORK / COMMENT)\n\nKeep under 300 words.",
            diff
        )),
    ];

    let report = match llm_client.chat_simple(&messages).await {
        Ok(text) => text,
        Err(e) => {
            ui::print_warn(&format!("LLM review failed: {}. Falling back to template.", e));
            format!(
                "# Code Review Report (LLM unavailable)\n\n## Diff Summary\n- {} lines changed\n\n## Suggestions\n1. Add tests for new code paths\n2. Update documentation if public API changed\n3. Run cargo fmt and clippy\n4. Verify no L1 consensus changes without approval\n",
                lines
            )
        }
    };

    if let Some(path) = output {
        tokio::fs::write(&path, &report).await?;
        ui::print_ok(&format!("Review report saved to {}", path));
    } else {
        println!("\n{}", report);
    }

    Ok(())
}
