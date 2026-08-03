use anyhow::Result;
use clap::Subcommand;
use std::io::{self, Write};

use crate::config::Config;
use crate::rpc::hiran_rpc;
use crate::ui;

#[derive(Subcommand)]
pub enum HiranCmd {
    /// Start Hiran v2.2 inference service
    Start,
    /// Stop Hiran inference service
    Stop,
    /// Restart Hiran inference service
    Restart,
    /// Hiran inference service status
    Status,
    /// Interactive chat with Hiran v2.2
    Chat,
    /// Single question to Hiran v2.2
    Ask { question: String },
    /// Stream Hiran inference logs
    Logs,
    /// Hiran inference configuration
    Config,
    /// Start inference with specific model/backend
    Inference {
        /// Model path or variant (e.g., hiran-v2.2-q5_k_m.gguf)
        #[arg(long)]
        model: Option<String>,
        /// Backend type (llama_cpp | onnx | tensorrt)
        #[arg(long)]
        backend: Option<String>,
        /// Device type (cuda | cpu | auto)
        #[arg(long)]
        device: Option<String>,
    },
    /// Evaluate model quality
    Evaluate {
        /// Dataset path for evaluation
        #[arg(long)]
        dataset: String,
        /// Metrics to compute (comma-separated)
        #[arg(long)]
        metrics: Option<String>,
    },
    /// Quantize model to different format
    Quantize {
        /// Source model path
        #[arg(long)]
        model: String,
        /// Target quantization format (q4_k_m | q5_k_m | q8_0 | f16)
        #[arg(long)]
        format: String,
        /// Output path
        #[arg(long)]
        output: Option<String>,
    },
    /// Deploy model to platform (vast | runpod | huggingface)
    Deploy {
        /// Model to deploy
        #[arg(long)]
        model: String,
        /// Target platform
        #[arg(long)]
        platform: String,
    },
}

pub async fn run(cfg: &Config, cmd: HiranCmd) -> Result<()> {
    match cmd {
        HiranCmd::Status => hiran_status(cfg).await,
        HiranCmd::Chat => hiran_chat(cfg).await,
        HiranCmd::Ask { question } => {
            ui::print_header("Hiran v2.2 Inference");
            let url = get_hiran_url(cfg);
            let answer = hiran_rpc::ask(&url, &question).await;
            match answer {
                Ok(a) => println!("  ◉ {}", a),
                Err(e) => ui::print_err(&format!("Hiran error: {}", e)),
            }
            println!();
            Ok(())
        }
        HiranCmd::Start => {
            ui::print_info("Starting Hiran v2.2 inference service...");
            crate::commands::deploy::start_service(cfg, "hiran").await
        }
        HiranCmd::Stop => {
            ui::print_info("Stopping Hiran inference service...");
            crate::commands::deploy::stop_service(cfg, "hiran").await
        }
        HiranCmd::Restart => {
            ui::print_info("Restarting Hiran inference service...");
            crate::commands::deploy::restart_service(cfg, "hiran").await
        }
        HiranCmd::Logs => {
            ui::print_info("Tailing Hiran inference logs...");
            crate::commands::deploy::tail_logs(cfg, "hiran").await
        }
        HiranCmd::Config => {
            ui::print_header("Hiran v2.2 Config");
            hiran_config(cfg).await
        }
        HiranCmd::Inference {
            model,
            backend,
            device,
        } => {
            ui::print_header("Hiran v2.2 Inference");
            hiran_inference(cfg, model, backend, device).await
        }
        HiranCmd::Evaluate { dataset, metrics } => {
            ui::print_header("Hiran v2.2 Evaluation");
            hiran_evaluate(cfg, dataset, metrics).await
        }
        HiranCmd::Quantize {
            model,
            format,
            output,
        } => {
            ui::print_header("Hiran v2.2 Quantization");
            hiran_quantize(cfg, model, format, output).await
        }
        HiranCmd::Deploy { model, platform } => {
            ui::print_header("Hiran v2.2 Deployment");
            hiran_deploy(cfg, model, platform).await
        }
    }
}

async fn hiran_status(cfg: &Config) -> Result<()> {
    ui::print_header("Hiran v2.2 — Inference Service");
    let url = get_hiran_url(cfg);
    let alive = hiran_rpc::health(&url).await.unwrap_or(false);

    if alive {
        ui::print_ok(&format!("Hiran inference online at {}", url));
        let result = hiran_rpc::get(&url, "status").await;
        if let Ok(v) = result {
            if let Some(model) = v["model"].as_str() {
                ui::print_row("Model", model);
            }
            if let Some(backend) = v["backend"].as_str() {
                ui::print_row("Backend", backend);
            }
            if let Some(device) = v["device"].as_str() {
                ui::print_row("Device", device);
            }
            if let Some(uptime) = v["uptime"].as_str() {
                ui::print_row("Uptime", uptime);
            }
            if let Some(requests) = v["request_count"].as_u64() {
                ui::print_row("Requests", &requests.to_string());
            }
        }
    } else {
        ui::print_err(&format!("Hiran inference unreachable at {}", url));
        ui::print_info("Start with: zion hiran start");
    }
    println!();
    Ok(())
}

async fn hiran_chat(cfg: &Config) -> Result<()> {
    let url = get_hiran_url(cfg);
    let alive = hiran_rpc::health(&url).await.unwrap_or(false);

    if !alive {
        ui::print_err(&format!("Hiran inference unreachable at {}", url));
        ui::print_info("Start with: zion hiran start");
        return Ok(());
    }

    println!();
    println!("  ╔══════════════════════════════════╗");
    println!("  ║     Hiran v2.2 Inference        ║");
    println!("  ║  Multi-Domain AI Native Agent    ║");
    println!("  ╚══════════════════════════════════╝");
    println!("  Type your message. 'exit' or Ctrl+C to quit.");
    println!();

    loop {
        print!("  hiran> ");
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

        let answer = hiran_rpc::ask(&url, input).await;
        match answer {
            Ok(a) => println!("  ◉ {}\n", a),
            Err(e) => println!("  ✗ Error: {}\n", e),
        }
    }

    println!();
    ui::print_info("Session ended. Gate, Gate, Paragate.");
    println!();
    Ok(())
}

async fn hiran_config(cfg: &Config) -> Result<()> {
    let url = get_hiran_url(cfg);
    ui::print_row("URL", &url);

    if let Some(hiran_cfg) = &cfg.hiran {
        ui::print_row("Model", &hiran_cfg.model_path);
        ui::print_row("Backend", &hiran_cfg.backend);
        ui::print_row("Device", &hiran_cfg.device);
        ui::print_row("Port", &hiran_cfg.port.to_string());
        ui::print_row("Max Context", &hiran_cfg.max_context.to_string());
    }

    // Try to fetch runtime config
    let result = hiran_rpc::get(&url, "config").await;
    if let Ok(v) = result {
        println!();
        println!("  Runtime config:");
        println!("{}", serde_json::to_string_pretty(&v)?);
    }
    println!();
    Ok(())
}

async fn hiran_inference(
    cfg: &Config,
    model: Option<String>,
    backend: Option<String>,
    device: Option<String>,
) -> Result<()> {
    let url = get_hiran_url(cfg);

    // Build inference request
    let mut payload = serde_json::json!({});
    if let Some(m) = model {
        payload["model"] = serde_json::Value::String(m);
    }
    if let Some(b) = backend {
        payload["backend"] = serde_json::Value::String(b);
    }
    if let Some(d) = device {
        payload["device"] = serde_json::Value::String(d);
    }

    ui::print_info(&format!("Starting inference with config: {}", payload));
    let result = hiran_rpc::post(&url, "inference/start", payload).await;

    match result {
        Ok(v) => {
            ui::print_ok("Inference started");
            println!("  {}", serde_json::to_string_pretty(&v)?);
        }
        Err(e) => ui::print_err(&format!("Inference start failed: {}", e)),
    }
    println!();
    Ok(())
}

async fn hiran_evaluate(cfg: &Config, dataset: String, metrics: Option<String>) -> Result<()> {
    let url = get_hiran_url(cfg);

    let mut payload = serde_json::json!({
        "dataset": dataset
    });
    if let Some(m) = metrics {
        payload["metrics"] = serde_json::Value::String(m);
    }

    ui::print_info(&format!("Evaluating model on dataset: {}", dataset));
    let result = hiran_rpc::post(&url, "evaluate", payload).await;

    match result {
        Ok(v) => {
            ui::print_ok("Evaluation completed");
            println!("  {}", serde_json::to_string_pretty(&v)?);
        }
        Err(e) => ui::print_err(&format!("Evaluation failed: {}", e)),
    }
    println!();
    Ok(())
}

async fn hiran_quantize(
    cfg: &Config,
    model: String,
    format: String,
    output: Option<String>,
) -> Result<()> {
    let url = get_hiran_url(cfg);

    let mut payload = serde_json::json!({
        "model": model,
        "format": format
    });
    if let Some(o) = output {
        payload["output"] = serde_json::Value::String(o);
    }

    ui::print_info(&format!("Quantizing model to {} format", format));
    let result = hiran_rpc::post(&url, "quantize", payload).await;

    match result {
        Ok(v) => {
            ui::print_ok("Quantization completed");
            println!("  {}", serde_json::to_string_pretty(&v)?);
        }
        Err(e) => ui::print_err(&format!("Quantization failed: {}", e)),
    }
    println!();
    Ok(())
}

async fn hiran_deploy(cfg: &Config, model: String, platform: String) -> Result<()> {
    let url = get_hiran_url(cfg);

    let payload = serde_json::json!({
        "model": model,
        "platform": platform
    });

    ui::print_info(&format!("Deploying model to {}", platform));
    let result = hiran_rpc::post(&url, "deploy", payload).await;

    match result {
        Ok(v) => {
            ui::print_ok("Deployment initiated");
            println!("  {}", serde_json::to_string_pretty(&v)?);
        }
        Err(e) => ui::print_err(&format!("Deployment failed: {}", e)),
    }
    println!();
    Ok(())
}

fn get_hiran_url(cfg: &Config) -> String {
    if let Some(hiran_cfg) = &cfg.hiran {
        format!("http://{}:{}", cfg.node.rpc_host, hiran_cfg.port)
    } else {
        // Fallback to default
        format!("http://{}:8002", cfg.node.rpc_host)
    }
}
