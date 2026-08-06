use colored::Colorize;
use std::io::{self, Write};

pub fn print_header(title: &str) {
    println!();
    println!("  {}", title.bold().bright_white());
    println!("  {}", "─".repeat(title.len()));
}

pub fn print_ok(msg: &str) {
    println!("  {} {}", "✓".green().bold(), msg);
}

pub fn print_err(msg: &str) {
    println!("  {} {}", "✗".red().bold(), msg);
}

pub fn print_warn(msg: &str) {
    println!("  {} {}", "⚠".yellow().bold(), msg);
}

pub fn print_info(msg: &str) {
    println!("  {} {}", "◉".cyan(), msg);
}

pub fn print_row(label: &str, value: &str) {
    println!("  {:<16} {}", label.dimmed(), value.bright_white());
}

pub fn print_banner() {
    println!(
        "{}",
        r#"
████████╗██╗ ██████╗███╗   ██╗     ██████╗██╗     ██╗
╚══███╔╝██║██╔═══██╗████╗  ██║    ██╔════╝██║     ██║
  ███╔╝ ██║██║   ██║██╔██╗ ██║    ██║     ██║     ██║
 ███╔╝  ██║██║   ██║██║╚██╗██║    ██║     ██║     ██║
███████╗██║╚██████╔╝██║ ╚████║    ╚██████╗███████╗██║
╚══════╝╚═╝ ╚═════╝ ╚═╝  ╚═══╝    ╚═════╝╚══════╝╚═╝
"#
        .bright_yellow()
    );
    println!(
        "  {} {} {}",
        "Om Namo Hiranyagarbha".dimmed(),
        "·".dimmed(),
        "Peace & One Love".dimmed()
    );
    println!();
}

pub fn wait_for_enter(prompt: &str) -> io::Result<()> {
    print!("  {} {}", "↩".cyan(), prompt.dimmed());
    io::stdout().flush()?;
    let mut line = String::new();
    io::stdin().read_line(&mut line)?;
    println!();
    Ok(())
}
