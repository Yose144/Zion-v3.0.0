use crate::AgentState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
// use uuid::Uuid;

/// Command queue pro komunikaci s fleet dashboard
/// Flow:
/// 1. Dashboard POST /api/commands → enqueue
/// 2. Agent na rigu GET /api/commands/pending → poll
/// 3. Agent POST /api/commands/{id}/ack → acknowledged
/// 4. Agent POST /api/commands/{id}/result → completed/failed

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type")]
pub enum Command {
    StartMiner { flight_sheet_id: Option<String> },
    StopMiner,
    RestartMiner,
    ApplyOcProfile { profile_id: String },
    Reboot,
    UpdateAgent { version: String },
    UpdateMiner { version: String },
    ExecShell { command: String, timeout_sec: u32 },
    SetFlightSheet { id: String },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum CommandStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandResult {
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub exit_code: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CommandEnvelope {
    pub id: String,
    pub rig_id: String,
    pub command: Command,
    pub status: CommandStatus,
    pub created_at: String,
    pub acked_at: Option<String>,
    pub completed_at: Option<String>,
    pub result: Option<CommandResult>,
}

/// Agent-side: poll pending commands from fleet dashboard
pub async fn poll_commands(_state: Arc<AgentState>) -> Vec<CommandEnvelope> {
    // TODO: HTTP GET na fleet dashboard
    vec![]
}

/// Agent-side: acknowledge command
pub async fn ack_command(_state: Arc<AgentState>, command_id: &str) {
    // TODO: HTTP POST /api/commands/{id}/ack
    tracing::info!("ACK command {}", command_id);
}

/// Agent-side: submit result
pub async fn submit_result(_state: Arc<AgentState>, command_id: &str, result: CommandResult) {
    // TODO: HTTP POST /api/commands/{id}/result
    tracing::info!("Result for command {}: exit={:?}", command_id, result.exit_code);
}
