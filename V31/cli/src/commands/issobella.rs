use anyhow::Result;
use clap::{Args, Subcommand};
use serde_json::{json, Value};

use crate::rpc::agent_rpc;
use crate::ui;

/// Issobella layer commands (L6 — space science, missions, observations, research proposals).
#[derive(Subcommand)]
pub enum IssobellaCmd {
    /// Issobella service status
    Status,
    /// Show Issobella parameters
    Params,
    /// List missions (optionally filter by status)
    Missions {
        #[arg(short, long)]
        status: Option<String>,
    },
    /// Show a single mission by ID
    Mission {
        #[arg()]
        id: String,
    },
    /// Create a new mission
    CreateMission(CreateMissionArgs),
    /// Mark a mission as launched
    Launch {
        #[arg()]
        id: String,
    },
    /// Update mission status
    UpdateStatus {
        #[arg()]
        id: String,
        #[arg(short, long)]
        status: String,
    },
    /// Spend from a mission budget
    Spend(SpendArgs),
    /// Submit a mission funding proposal to the DAO
    SubmitToDao {
        #[arg()]
        id: String,
    },
    /// List research proposals (optionally filter by status)
    Proposals {
        #[arg(short, long)]
        status: Option<String>,
    },
    /// Show a single proposal by ID
    Proposal {
        #[arg()]
        id: String,
    },
    /// Create a new research proposal
    CreateProposal(CreateProposalArgs),
    /// Approve a research proposal
    ApproveProposal(ApproveRejectArgs),
    /// Reject a research proposal
    RejectProposal(ApproveRejectArgs),
    /// List observations (optionally filter by mission_id)
    Observations {
        #[arg(short, long)]
        mission_id: Option<String>,
    },
    /// List observations for a specific mission
    MissionObservations {
        #[arg()]
        id: String,
    },
    /// Record a new observation
    CreateObservation(CreateObservationArgs),
    /// Show current L6 fund balance
    Balance,
    /// List fund disbursements
    Disbursements,
    /// Hiran AI bridge health
    HiranHealth,
    /// Ask Hiran to evaluate a mission plan
    HiranEvaluate(HiranEvaluateArgs),
    /// Ask Hiran to analyze a research proposal
    HiranAnalyze(HiranAnalyzeArgs),
    /// Ask Hiran to optimize a satellite network
    HiranOptimize(HiranOptimizeArgs),
    /// Ask Hiran to generate a mission log entry
    HiranMissionLog(HiranMissionLogArgs),
}

#[derive(Args)]
pub struct CreateMissionArgs {
    #[arg(short, long)]
    name: String,
    #[arg(short, long)]
    mission_type: String,
    #[arg(short, long)]
    budget_zion: u64,
    #[arg(long)]
    description: Option<String>,
    #[arg(long)]
    orbit_altitude_km: Option<f64>,
    #[arg(long)]
    target_launch_date: Option<String>,
    #[arg(long)]
    funding_address: Option<String>,
}

#[derive(Args)]
pub struct CreateProposalArgs {
    #[arg(short, long)]
    title: String,
    #[arg(short, long)]
    requested_budget: u64,
    #[arg(long)]
    researcher: Option<String>,
    #[arg(long)]
    institution: Option<String>,
    #[arg(long)]
    abstract_text: Option<String>,
}

#[derive(Args)]
pub struct ApproveRejectArgs {
    #[arg()]
    id: String,
    #[arg(short, long)]
    note: Option<String>,
}

#[derive(Args)]
pub struct CreateObservationArgs {
    #[arg(short, long)]
    mission_id: String,
    #[arg(short, long)]
    observation_type: String,
    #[arg(long)]
    data_url: Option<String>,
    #[arg(long)]
    metadata: Option<String>,
    #[arg(long)]
    recorded_at: Option<String>,
    #[arg(long)]
    published: bool,
}

#[derive(Args)]
pub struct SpendArgs {
    #[arg()]
    id: String,
    #[arg()]
    amount: u64,
    #[arg(long)]
    tx_hash: Option<String>,
    #[arg(long)]
    recipient: Option<String>,
    #[arg(long)]
    satellite_count: Option<i64>,
}

#[derive(Args)]
pub struct HiranEvaluateArgs {
    #[arg(short, long)]
    name: String,
    #[arg(short, long)]
    description: String,
    #[arg(short, long)]
    budget_zion: u64,
}

#[derive(Args)]
pub struct HiranAnalyzeArgs {
    #[arg(short, long)]
    title: String,
    #[arg(short, long)]
    abstract_text: String,
}

#[derive(Args)]
pub struct HiranOptimizeArgs {
    #[arg(short, long)]
    nodes: Vec<String>,
    #[arg(short, long)]
    constraints: String,
}

#[derive(Args)]
pub struct HiranMissionLogArgs {
    #[arg(short, long)]
    mission_name: String,
    #[arg(short, long)]
    event: String,
    #[arg(short, long)]
    timestamp: String,
}

pub async fn run(cmd: IssobellaCmd, issobella_url: &str) -> Result<()> {
    let base = issobella_url.trim_end_matches('/');

    match cmd {
        IssobellaCmd::Status => {
            ui::print_header("Issobella (L6)");
            match agent_rpc::health(base).await {
                Ok(true) => ui::print_ok(&format!("Issobella online at {base}")),
                _ => ui::print_err(&format!("Issobella unreachable at {base}")),
            }
            if let Ok(v) = agent_rpc::get(base, "api/v1/fund/balance").await {
                if let Some(data) = extract_data(&v) {
                    if let Some(total) = data.get("total_accumulated").and_then(|v| v.as_u64()) {
                        ui::print_row("Fund accumulated", &format!("{total} ZION"));
                    }
                    if let Some(block) = data.get("last_block_height").and_then(|v| v.as_u64()) {
                        ui::print_row("Last scanned block", &block.to_string());
                    }
                }
            }
            println!();
        }

        IssobellaCmd::Params => {
            ui::print_header("Issobella Parameters");
            ui::print_row("Default bind", "127.0.0.1:8097");
            ui::print_row("Default L1 RPC", "http://127.0.0.1:9445/jsonrpc");
            ui::print_row("Default DB", "./issobella.db");
            ui::print_row(
                "Canonical fund",
                "zion1z4s3a54266f2x7j4x7c27297k49752t7k52l0f0",
            );
            ui::print_info("DAO bridge: disabled unless ZION_DAO_PROPOSER is set");
            ui::print_info("Hiran AI: disabled unless ISSOBELLA_HIRAN_ENABLED=true");
            println!();
        }

        IssobellaCmd::Missions { status } => {
            ui::print_header("L6 Missions");
            match agent_rpc::get(base, "api/v1/missions").await {
                Ok(v) => print_mission_list(&v, status.as_deref()),
                Err(e) => ui::print_warn(&format!("Issobella unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::Mission { id } => {
            ui::print_header(&format!("Mission {id}"));
            match agent_rpc::get(base, "api/v1/missions").await {
                Ok(v) => find_and_print(&v, |m| m.get("id").and_then(|v| v.as_str()) == Some(&id)),
                Err(e) => ui::print_warn(&format!("Issobella unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::CreateMission(args) => {
            ui::print_header("Create Mission");
            let body = json!({
                "name": args.name,
                "mission_type": args.mission_type,
                "budget_zion": args.budget_zion,
                "description": args.description,
                "orbit_altitude_km": args.orbit_altitude_km,
                "target_launch_date": args.target_launch_date,
                "funding_address": args.funding_address,
            });
            match agent_rpc::post(base, "api/v1/missions", body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Create failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::Launch { id } => {
            ui::print_header("Launch Mission");
            match agent_rpc::post(base, &format!("api/v1/missions/{id}/launch"), json!({})).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Launch failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::UpdateStatus { id, status } => {
            ui::print_header("Update Mission Status");
            let body = json!({ "status": status });
            match agent_rpc::post(base, &format!("api/v1/missions/{id}/status"), body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Status update failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::Spend(args) => {
            ui::print_header("Spend Mission Budget");
            let body = json!({
                "amount": args.amount,
                "tx_hash": args.tx_hash,
                "recipient": args.recipient,
                "satellite_count": args.satellite_count,
            });
            match agent_rpc::post(
                base,
                &format!("api/v1/missions/{id}/spend", id = args.id),
                body,
            )
            .await
            {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Spend failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::SubmitToDao { id } => {
            ui::print_header("Submit Mission to DAO");
            match agent_rpc::post(
                base,
                &format!("api/v1/missions/{id}/submit-to-dao"),
                json!({}),
            )
            .await
            {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("DAO submission failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::Proposals { status } => {
            ui::print_header("L6 Research Proposals");
            match agent_rpc::get(base, "api/v1/proposals").await {
                Ok(v) => print_proposal_list(&v, status.as_deref()),
                Err(e) => ui::print_warn(&format!("Issobella unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::Proposal { id } => {
            ui::print_header(&format!("Proposal {id}"));
            match agent_rpc::get(base, "api/v1/proposals").await {
                Ok(v) => find_and_print(&v, |p| p.get("id").and_then(|v| v.as_str()) == Some(&id)),
                Err(e) => ui::print_warn(&format!("Issobella unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::CreateProposal(args) => {
            ui::print_header("Create Research Proposal");
            let body = json!({
                "title": args.title,
                "requested_budget": args.requested_budget,
                "researcher": args.researcher,
                "institution": args.institution,
                "abstract_text": args.abstract_text,
            });
            match agent_rpc::post(base, "api/v1/proposals", body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Create failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::ApproveProposal(args) => {
            ui::print_header("Approve Proposal");
            let body = json!({ "reviewer_notes": args.note });
            match agent_rpc::post(
                base,
                &format!("api/v1/proposals/{id}/approve", id = args.id),
                body,
            )
            .await
            {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Approve failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::RejectProposal(args) => {
            ui::print_header("Reject Proposal");
            let body = json!({ "reviewer_notes": args.note });
            match agent_rpc::post(
                base,
                &format!("api/v1/proposals/{id}/reject", id = args.id),
                body,
            )
            .await
            {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Reject failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::Observations { mission_id } => {
            ui::print_header("L6 Observations");
            match agent_rpc::get(base, "api/v1/observations").await {
                Ok(v) => print_observation_list(&v, mission_id.as_deref()),
                Err(e) => ui::print_warn(&format!("Issobella unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::MissionObservations { id } => {
            ui::print_header(&format!("Observations for Mission {id}"));
            match agent_rpc::get(base, &format!("api/v1/missions/{id}/observations")).await {
                Ok(v) => print_observation_list(&v, None),
                Err(e) => ui::print_warn(&format!("Issobella unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::CreateObservation(args) => {
            ui::print_header("Record Observation");
            let body = json!({
                "mission_id": args.mission_id,
                "observation_type": args.observation_type,
                "data_url": args.data_url,
                "metadata": args.metadata,
                "recorded_at": args.recorded_at,
                "published": args.published,
            });
            match agent_rpc::post(base, "api/v1/observations", body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Record failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::Balance => {
            ui::print_header("L6 Fund Balance");
            match agent_rpc::get(base, "api/v1/fund/balance").await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Fund balance unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::Disbursements => {
            ui::print_header("L6 Fund Disbursements");
            match agent_rpc::get(base, "api/v1/fund/disbursements").await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Disbursements unavailable: {e}")),
            }
            println!();
        }

        IssobellaCmd::HiranHealth => {
            ui::print_header("Hiran AI Health");
            match agent_rpc::get(base, "api/v1/ai/hiran-health").await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Hiran health check failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::HiranEvaluate(args) => {
            ui::print_header("Hiran Evaluate Mission");
            let body = json!({
                "mission_name": args.name,
                "description": args.description,
                "budget_zion": args.budget_zion,
            });
            match agent_rpc::post(base, "api/v1/ai/evaluate-mission", body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Hiran evaluation failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::HiranAnalyze(args) => {
            ui::print_header("Hiran Analyze Proposal");
            let body = json!({
                "title": args.title,
                "abstract_text": args.abstract_text,
            });
            match agent_rpc::post(base, "api/v1/ai/analyze-proposal", body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Hiran analysis failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::HiranOptimize(args) => {
            ui::print_header("Hiran Optimize Network");
            let body = json!({
                "nodes": args.nodes,
                "constraints": args.constraints,
            });
            match agent_rpc::post(base, "api/v1/ai/optimize-network", body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Hiran optimize failed: {e}")),
            }
            println!();
        }

        IssobellaCmd::HiranMissionLog(args) => {
            ui::print_header("Hiran Mission Log");
            let body = json!({
                "mission_name": args.mission_name,
                "event": args.event,
                "timestamp": args.timestamp,
            });
            match agent_rpc::post(base, "api/v1/ai/mission-log", body).await {
                Ok(v) => print_data_or_err(&v),
                Err(e) => ui::print_warn(&format!("Hiran mission log failed: {e}")),
            }
            println!();
        }
    }

    Ok(())
}

fn extract_data(value: &Value) -> Option<&Value> {
    value
        .get("success")
        .and_then(|s| s.as_bool())
        .and_then(|success| if success { value.get("data") } else { None })
}

fn print_data_or_err(value: &Value) {
    if let Some(success) = value.get("success").and_then(|v| v.as_bool()) {
        if success {
            if let Some(data) = value.get("data") {
                println!("{}", serde_json::to_string_pretty(data).unwrap_or_default());
                return;
            }
        } else if let Some(err) = value.get("error").and_then(|v| v.as_str()) {
            ui::print_err(err);
            return;
        }
    }
    println!(
        "{}",
        serde_json::to_string_pretty(value).unwrap_or_default()
    );
}

fn print_mission_list(value: &Value, filter_status: Option<&str>) {
    if let Some(data) = extract_data(value).and_then(|v| v.as_array()) {
        let rows: Vec<&Value> = data
            .iter()
            .filter(|m| {
                filter_status.is_none_or(|s| m.get("status").and_then(|v| v.as_str()) == Some(s))
            })
            .collect();
        for m in &rows {
            let id = m.get("id").and_then(|v| v.as_str()).unwrap_or("?");
            let name = m
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("(no name)");
            let status = m.get("status").and_then(|v| v.as_str()).unwrap_or("?");
            let budget = m.get("budget_zion").and_then(|v| v.as_u64()).unwrap_or(0);
            let spent = m.get("spent_zion").and_then(|v| v.as_u64()).unwrap_or(0);
            println!("  [{id}] {name} — status={status}, budget={budget} ZION, spent={spent} ZION");
        }
        if rows.is_empty() {
            ui::print_info("No missions found.");
        }
    } else {
        print_data_or_err(value);
    }
}

fn print_proposal_list(value: &Value, filter_status: Option<&str>) {
    if let Some(data) = extract_data(value).and_then(|v| v.as_array()) {
        let rows: Vec<&Value> = data
            .iter()
            .filter(|p| {
                filter_status.is_none_or(|s| p.get("status").and_then(|v| v.as_str()) == Some(s))
            })
            .collect();
        for p in &rows {
            let id = p.get("id").and_then(|v| v.as_str()).unwrap_or("?");
            let title = p
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("(no title)");
            let status = p.get("status").and_then(|v| v.as_str()).unwrap_or("?");
            let budget = p
                .get("requested_budget")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            println!("  [{id}] {title} — status={status}, budget={budget} ZION");
        }
        if rows.is_empty() {
            ui::print_info("No proposals found.");
        }
    } else {
        print_data_or_err(value);
    }
}

fn print_observation_list(value: &Value, filter_mission: Option<&str>) {
    if let Some(data) = extract_data(value).and_then(|v| v.as_array()) {
        let rows: Vec<&Value> = data
            .iter()
            .filter(|o| {
                filter_mission
                    .is_none_or(|m| o.get("mission_id").and_then(|v| v.as_str()) == Some(m))
            })
            .collect();
        for o in &rows {
            let id = o.get("id").and_then(|v| v.as_str()).unwrap_or("?");
            let mission_id = o.get("mission_id").and_then(|v| v.as_str()).unwrap_or("?");
            let kind = o
                .get("observation_type")
                .and_then(|v| v.as_str())
                .unwrap_or("?");
            let published = o
                .get("published")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            let recorded = o.get("recorded_at").and_then(|v| v.as_str()).unwrap_or("?");
            println!("  [{id}] mission={mission_id}, type={kind}, published={published}, recorded={recorded}");
        }
        if rows.is_empty() {
            ui::print_info("No observations found.");
        }
    } else {
        print_data_or_err(value);
    }
}

fn find_and_print<F>(value: &Value, predicate: F)
where
    F: Fn(&Value) -> bool,
{
    if let Some(data) = extract_data(value).and_then(|v| v.as_array()) {
        if let Some(found) = data.iter().find(|item| predicate(item)) {
            println!(
                "{}",
                serde_json::to_string_pretty(found).unwrap_or_default()
            );
        } else {
            ui::print_warn("Not found.");
        }
    } else {
        print_data_or_err(value);
    }
}
