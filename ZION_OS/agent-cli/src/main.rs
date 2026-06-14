use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing::{info, warn};

mod agent_loop;
mod config;
mod llm;
mod memory;
mod model_ops;
mod monitor;
mod planner;
mod reviewer;
mod safety;
mod session;
mod tools;
mod tunnel;
mod ui;

use config::AgentConfig;

#[derive(Parser)]
#[command(name = "zion-agent")]
#[command(about = "ZION Agent CLI — Autonomous AI operator")]
#[command(version)]
struct Cli {
    #[arg(short, long, help = "Path to config file", env = "ZION_AGENT_CONFIG")]
    config: Option<String>,

    #[arg(short, long, help = "Dry run — show plan but do not execute")]
    dry_run: bool,

    #[arg(long, help = "Allow edits to L1 consensus code (DANGEROUS)")]
    l1_unsafe: bool,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Run an autonomous task from a natural language description
    Run {
        /// The task description
        #[arg(help = "Natural language task, e.g. 'Refactor pool validation'")]
        task: String,

        /// Read task from a file instead of CLI argument
        #[arg(short, long)]
        file: Option<String>,

        /// Show plan but do not execute
        #[arg(long)]
        plan_only: bool,
    },

    /// Start an interactive agent session
    Session,

    /// Review code (current working tree or a branch)
    Review {
        /// Branch to review (defaults to current changes)
        #[arg(long)]
        branch: Option<String>,

        /// Output file for the review report
        #[arg(short, long)]
        output: Option<String>,
    },

    /// Check remote training status
    TrainStatus {
        /// Remote host (default from config)
        #[arg(short, long)]
        host: Option<String>,
    },

    /// Pull a checkpoint from the remote training server
    CheckpointPull {
        /// Checkpoint step number (e.g. 4000)
        step: u32,

        /// Skip verification after download
        #[arg(long)]
        no_verify: bool,
    },

    /// Merge a LoRA checkpoint into the base model and optionally convert to GGUF
    ModelMerge {
        /// Checkpoint step to merge
        #[arg(short, long)]
        checkpoint: u32,

        /// Output directory or name
        #[arg(short, long)]
        output: Option<String>,

        /// Also convert to GGUF quantization format (e.g. q5_k_m)
        #[arg(long)]
        quantize: Option<String>,

        /// Tail the merge log until completion (blocking)
        #[arg(long)]
        wait: bool,
    },

    /// Download the built GGUF model from the remote server
    ModelDownload {
        /// Checkpoint step (e.g. 8901)
        #[arg(short, long, default_value = "8901")]
        checkpoint: u32,

        /// Quantization type (q4_k_m, q5_k_m, q8_0)
        #[arg(short, long, default_value = "q5_k_m")]
        quantize: String,
    },

    /// SSH tunnel management for Hiran inference via Vast AI
    Tunnel {
        #[command(subcommand)]
        cmd: TunnelCmd,
    },

    /// Start a local inference server with the specified model
    Serve {
        /// Model path (GGUF or HF directory)
        #[arg(short, long)]
        model: String,

        /// Backend to use (auto, llama_cpp, ollama, python)
        #[arg(short, long, default_value = "auto")]
        backend: String,

        /// Port to bind
        #[arg(short, long, default_value = "8000")]
        port: u16,
    },

    /// Interactive chat with a running inference server
    Chat,

    /// Ask a single question to the inference server
    Ask {
        /// The question
        question: String,
    },

    /// Monitor infrastructure (node, pool, miner)
    Monitor {
        /// Services to watch (comma-separated: node,pool,miner)
        #[arg(short, long)]
        watch: Option<String>,

        /// Run as daemon
        #[arg(short, long)]
        daemon: bool,
    },

    /// Show agent memory / project knowledge
    Memory {
        #[command(subcommand)]
        cmd: Option<MemoryCmd>,
    },

    /// Configuration management
    Config {
        #[command(subcommand)]
        cmd: ConfigCmd,
    },
}

#[derive(Subcommand)]
enum TunnelCmd {
    /// Start SSH tunnel to inference server
    Start,
    /// Stop SSH tunnel
    Stop,
    /// Show tunnel status
    Status,
    /// Start llama-server on the remote instance
    Serve,
    /// Stop llama-server on the remote instance
    Kill,
}

#[derive(Subcommand)]
enum MemoryCmd {
    Show,
    Forget { key: String },
    Search { query: String },
}

#[derive(Subcommand)]
enum ConfigCmd {
    Show,
    Path,
    Init,
    Set { key: String, value: String },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("zion_agent_cli=info")
        .init();

    let cli = Cli::parse();
    let cfg = config::load(cli.config.as_deref())?;

    // Apply CLI overrides to config
    let cfg = apply_cli_overrides(cfg, &cli);

    info!("ZION Agent CLI starting — version {}", env!("CARGO_PKG_VERSION"));

    match cli.command {
        Commands::Run { task, file, plan_only } => {
            let task_text = if let Some(path) = file {
                std::fs::read_to_string(&path)?
            } else {
                task
            };
            if plan_only {
                ui::print_info("Plan-only mode — agent will not execute actions.");
            }
            agent_loop::run_task(&cfg, &task_text, plan_only || cli.dry_run).await?;
        }
        Commands::Session => {
            session::run_interactive(&cfg).await?;
        }
        Commands::Review { branch, output } => {
            reviewer::run_review(&cfg, branch, output).await?;
        }
        Commands::TrainStatus { host } => {
            model_ops::train_status(&cfg, host).await?;
        }
        Commands::CheckpointPull { step, no_verify } => {
            model_ops::checkpoint_pull(&cfg, step, !no_verify).await?;
        }
        Commands::ModelMerge {
            checkpoint,
            output,
            quantize,
            wait,
        } => {
            model_ops::merge_and_convert(&cfg, checkpoint, output, quantize).await?;
            if wait {
                model_ops::merge_wait(&cfg, checkpoint).await?;
            }
        }
        Commands::ModelDownload { checkpoint, quantize } => {
            model_ops::download_gguf(&cfg, checkpoint, Some(&quantize)).await?;
        }
        Commands::Tunnel { cmd } => {
            match cmd {
                TunnelCmd::Start => {
                    let handle = tunnel::start(&cfg).await?;
                    // Block until Ctrl+C
                    ui::print_info("Tunnel running. Press Ctrl+C to stop.");
                    tokio::signal::ctrl_c().await?;
                    tunnel::stop(handle).await?;
                }
                TunnelCmd::Stop => {
                    ui::print_info("(Use Ctrl+C on the running 'tunnel start' process to stop the tunnel)");
                }
                TunnelCmd::Status => {
                    tunnel::status(&cfg).await?;
                }
                TunnelCmd::Serve => {
                    tunnel::serve_remote(&cfg).await?;
                }
                TunnelCmd::Kill => {
                    tunnel::stop_remote(&cfg).await?;
                }
            }
        }
        Commands::Serve { model, backend, port } => {
            tools::inference::serve(&cfg, &model, &backend, port).await?;
        }
        Commands::Chat => {
            session::chat_repl(&cfg).await?;
        }
        Commands::Ask { question } => {
            let answer = tools::inference::ask(&cfg, &question).await?;
            println!("{}", answer);
        }
        Commands::Monitor { watch, daemon } => {
            monitor::run(&cfg, watch, daemon).await?;
        }
        Commands::Memory { cmd } => {
            match cmd {
                Some(MemoryCmd::Show) => memory::show(&cfg).await?,
                Some(MemoryCmd::Forget { key }) => memory::forget(&cfg, &key).await?,
                Some(MemoryCmd::Search { query }) => memory::search(&cfg, &query).await?,
                None => memory::show(&cfg).await?,
            }
        }
        Commands::Config { cmd } => {
            match cmd {
                ConfigCmd::Show => {
                    let text = toml::to_string_pretty(&cfg)?;
                    println!("{}", text);
                }
                ConfigCmd::Path => {
                    println!("{}", config::config_path()?.display());
                }
                ConfigCmd::Init => {
                    config::init_wizard().await?;
                }
                ConfigCmd::Set { key, value } => {
                    config::set_value(&key, &value)?;
                }
            }
        }
    }

    Ok(())
}

fn apply_cli_overrides(mut cfg: AgentConfig, cli: &Cli) -> AgentConfig {
    if cli.l1_unsafe {
        warn!("--l1-unsafe enabled. L1 consensus code edits are ALLOWED. Use with extreme caution.");
        cfg.safety.l1_protection = false;
    }
    cfg
}
