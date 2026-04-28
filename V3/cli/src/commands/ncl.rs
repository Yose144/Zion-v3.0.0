use anyhow::Result;
use clap::Subcommand;

use crate::config::Config;
use crate::rpc::agent_rpc;
use crate::ui;

fn ncl_base(cfg: &Config) -> String {
    // NCL routes live inside the AI Native agent at /ncl/*
    cfg.agent.url.trim_end_matches('/').to_string()
}

#[derive(Subcommand)]
pub enum NclCmd {
    /// NCL health + scheduler status
    Status,
    /// Submit a compute job
    Submit {
        #[arg(long)]
        model: String,
        #[arg(long)]
        input: String,
        /// Max price in ZION
        #[arg(long, default_value = "1.0")]
        max_price: f64,
    },
    /// Get job status/result by ID
    Job { id: String },
    /// List active jobs (yours or all)
    Jobs,
    /// List registered compute workers
    Workers,
    /// Worker leaderboard (reputation)
    Leaderboard,
    /// Scheduler queue + slot utilization
    Schedule,
    /// NCL pricing for a given model
    Price { model: String },
}

pub async fn run(cfg: &Config, cmd: NclCmd) -> Result<()> {
    let base = ncl_base(cfg);

    match cmd {
        NclCmd::Status => {
            ui::print_header("ZION NCL — Neural Compute Layer (L3)");
            let alive = agent_rpc::health(&base).await.unwrap_or(false);
            if !alive {
                ui::print_err(&format!("AI Native agent unreachable at {}", base));
                ui::print_info("Start with: zion agent start");
                return Ok(());
            }
            let v = agent_rpc::get(&base, "ncl/health").await;
            match v {
                Ok(v) => {
                    if let Some(workers) = v["active_workers"].as_u64() {
                        ui::print_row("Active workers", &workers.to_string());
                    }
                    if let Some(jobs) = v["queued_jobs"].as_u64() {
                        ui::print_row("Queued jobs", &jobs.to_string());
                    }
                    if let Some(cap) = v["total_capacity"].as_str() {
                        ui::print_row("Total capacity", cap);
                    }
                    if let Some(tflops) = v["total_tflops"].as_f64() {
                        ui::print_row("Total TFLOPS", &format!("{:.1}", tflops));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_warn(&format!("NCL status unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        NclCmd::Submit {
            model,
            input,
            max_price,
        } => {
            ui::print_header("NCL — Submit Job");
            ui::print_row("Model", &model);
            ui::print_row("Max price", &format!("{} ZION", max_price));
            let payload = serde_json::json!({
                "model": model,
                "input": input,
                "max_price_zion": max_price,
                "wallet": cfg.miner.wallet,
            });
            let v = agent_rpc::post(&base, "ncl/jobs", payload).await;
            match v {
                Ok(v) => {
                    let id = v["job_id"].as_str().unwrap_or("?");
                    ui::print_ok(&format!("Job submitted! ID: {}", id));
                    ui::print_info(&format!("Check status: zion ncl job {}", id));
                }
                Err(e) => ui::print_err(&format!("Submit failed: {}", e)),
            }
            println!();
            Ok(())
        }
        NclCmd::Job { id } => {
            ui::print_header(&format!("NCL Job: {}", id));
            let v = agent_rpc::get(&base, &format!("ncl/jobs/{}", id)).await;
            match v {
                Ok(v) => {
                    if let Some(status) = v["status"].as_str() {
                        ui::print_row("Status", status);
                    }
                    if let Some(result) = v["result"].as_str() {
                        ui::print_row("Result", result);
                    }
                    if let Some(cost) = v["cost_zion"].as_f64() {
                        ui::print_row("Cost", &format!("{:.6} ZION", cost));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_warn(&format!("Job not found: {}", e)),
            }
            println!();
            Ok(())
        }
        NclCmd::Jobs => {
            ui::print_header("NCL — Active Jobs");
            let v = agent_rpc::get(&base, "ncl/jobs").await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("NCL unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        NclCmd::Workers => {
            ui::print_header("NCL — Compute Workers");
            let v = agent_rpc::get(&base, "ncl/workers").await;
            match v {
                Ok(v) => {
                    if let Some(arr) = v.as_array() {
                        for w in arr {
                            let id = w["worker_id"].as_str().unwrap_or("?");
                            let rep = w["reputation"].as_f64().unwrap_or(0.0);
                            let cap = w["capacity"].as_str().unwrap_or("-");
                            println!("  {id}  reputation={rep:.1}  {cap}");
                        }
                        if arr.is_empty() {
                            ui::print_info("No workers registered.");
                        }
                    } else {
                        println!("{}", serde_json::to_string_pretty(&v)?);
                    }
                }
                Err(e) => ui::print_warn(&format!("NCL unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        NclCmd::Leaderboard => {
            ui::print_header("NCL — Worker Leaderboard");
            let v = agent_rpc::get(&base, "ncl/leaderboard").await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("NCL unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        NclCmd::Schedule => {
            ui::print_header("NCL — Scheduler");
            let v = agent_rpc::post(&base, "ncl/schedule", serde_json::json!({})).await;
            match v {
                Ok(v) => println!("{}", serde_json::to_string_pretty(&v)?),
                Err(e) => ui::print_warn(&format!("NCL unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
        NclCmd::Price { model } => {
            ui::print_header(&format!("NCL Price: {}", model));
            let v = agent_rpc::get(&base, &format!("ncl/price?model={}", model)).await;
            match v {
                Ok(v) => {
                    if let Some(price) = v["price_per_token"].as_f64() {
                        ui::print_row("Price/token", &format!("{:.8} ZION", price));
                    }
                    if let Some(price) = v["price_per_job"].as_f64() {
                        ui::print_row("Price/job", &format!("{:.6} ZION", price));
                    }
                    println!("{}", serde_json::to_string_pretty(&v)?);
                }
                Err(e) => ui::print_warn(&format!("NCL unavailable: {}", e)),
            }
            println!();
            Ok(())
        }
    }
}
