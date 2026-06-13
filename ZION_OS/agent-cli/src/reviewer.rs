use crate::{config::AgentConfig, ui};
use anyhow::Result;
use tokio::process::Command;

pub async fn run_review(
    _cfg: &AgentConfig,
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
    ui::print_info(&format!("Analyzing diff ({} lines)...", lines));

    // Placeholder: would send diff to LLM for review
    let report = format!(
        "# Code Review Report\n\n## Diff Summary\n- {} lines changed\n\n## Findings\n(Stub — LLM review not yet implemented)\n\n## Suggestions\n1. Add tests for new code paths\n2. Update documentation if public API changed\n3. Ensure cargo fmt and clippy pass\n",
        lines
    );

    if let Some(path) = output {
        tokio::fs::write(&path, &report).await?;
        ui::print_ok(&format!("Review report saved to {}", path));
    } else {
        println!("{}", report);
    }

    Ok(())
}
