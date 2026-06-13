use crate::llm::ToolCall;
use colored::Colorize;

pub fn print_header(title: &str) {
    println!();
    println!("  ╔══════════════════════════════════════╗");
    println!("  ║ {:<36} ║", title.bright_white().bold());
    println!("  ╚══════════════════════════════════════╝");
    println!();
}

pub fn print_info(msg: &str) {
    println!("  {} {}", "ℹ".blue(), msg);
}

pub fn print_ok(msg: &str) {
    println!("  {} {}", "✓".green(), msg.green());
}

pub fn print_warn(msg: &str) {
    println!("  {} {}", "⚠".yellow(), msg.yellow());
}

pub fn print_err(msg: &str) {
    println!("  {} {}", "✗".red(), msg.red());
}

pub fn print_tool_call(call: &ToolCall) {
    println!(
        "  {} {} {}",
        "▶".cyan(),
        call.name.bold().cyan(),
        serde_json::to_string(&call.arguments).unwrap_or_default().dimmed()
    );
}

pub fn print_tool_result(result: &str) {
    let preview: String = result.chars().take(300).collect();
    let truncated = if result.len() > 300 {
        format!("{}... ({} more chars)", preview, result.len() - 300)
    } else {
        preview
    };
    println!("  {} {}", "◀".dimmed(), truncated.dimmed());
}

pub fn print_agent_message(msg: &str) {
    println!("  {} {}", "🤖".dimmed(), msg.dimmed());
}

#[derive(Debug, Clone, Copy)]
pub enum Approval {
    Yes,
    No,
    Edit,
}

pub fn prompt_approval() -> Result<Approval, std::io::Error> {
    use std::io::{self, Write};

    print!(
        "  {} {} ",
        "?".yellow(),
        "Approve this action? [Y/n/e]".yellow()
    );
    io::stdout().flush()?;

    let mut input = String::new();
    io::stdin().read_line(&mut input)?;
    let input = input.trim().to_lowercase();

    match input.as_str() {
        "y" | "yes" | "" => Ok(Approval::Yes),
        "n" | "no" => Ok(Approval::No),
        "e" | "edit" => Ok(Approval::Edit),
        _ => {
            println!("  {} Invalid input. Defaulting to 'no'.", "!".red());
            Ok(Approval::No)
        }
    }
}
