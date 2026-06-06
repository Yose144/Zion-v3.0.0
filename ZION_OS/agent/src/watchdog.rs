use crate::AgentState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatchdogRule {
    pub name: String,
    pub condition: String,       // Expression string
    pub severity: String,        // warning | critical
    pub action: String,          // restart_miner | stop_miner | reboot_rig | apply_conservative_oc | switch_pool_to_failover
    pub cooldown_sec: u64,
    pub auto_resolve: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatchdogConfig {
    pub rules: Vec<WatchdogRule>,
}

#[derive(Debug, Clone)]
pub struct RuleState {
    pub last_triggered: Option<chrono::DateTime<chrono::Utc>>,
    pub triggered_count: u32,
}

pub async fn engine_loop(state: Arc<AgentState>) {
    info!("Watchdog engine spusten");
    let mut rule_states: std::collections::HashMap<String, RuleState> = std::collections::HashMap::new();

    loop {
        let interval = {
            let cfg = state.config.read().await;
            cfg.watchdog.check_interval_sec
        };

        // Nacti pravidla
        let rules = match load_rules(&state.config.read().await.watchdog.rules_file).await {
            Ok(r) => r,
            Err(e) => {
                warn!("Nemohu nacist watchdog pravidla: {}", e);
                vec![]
            }
        };

        // Sběr kontextu pro evaluaci
        let ctx = EvaluationContext::from_state(&state).await;

        for rule in &rules {
            let rule_state = rule_states.entry(rule.name.clone()).or_insert(RuleState {
                last_triggered: None,
                triggered_count: 0,
            });

            // Cooldown check
            if let Some(last) = rule_state.last_triggered {
                let elapsed = chrono::Utc::now().signed_duration_since(last).num_seconds() as u64;
                if elapsed < rule.cooldown_sec {
                    continue;
                }
            }

            // Evaluate condition
            let condition_met = evaluate_condition(&rule.condition, &ctx);

            if condition_met {
                warn!(
                    "WATCHDOG: Pravidlo '{}' spusteno (severity: {}, action: {})",
                    rule.name, rule.severity, rule.action
                );

                rule_state.last_triggered = Some(chrono::Utc::now());
                rule_state.triggered_count += 1;

                if let Err(e) = execute_action(state.clone(), &rule.action).await {
                    error!("WATCHDOG: Akce '{}' selhala: {}", rule.action, e);
                }
            }
        }

        tokio::time::sleep(tokio::time::Duration::from_secs(interval)).await;
    }
}

// ── Evaluation Context ────────────────────────────────────

struct EvaluationContext {
    miner_running: bool,
    hashrate: f64,
    shares_5min: u64,
    accepted_shares: u64,
    rejected_shares: u64,
    miner_restarts_1h: u32,
    gpu_temp_max: f32,
    gpu_power_total: f32,
    pool_connected: bool,
    internet_ok: bool,
    disk_used_percent: u32,
}

impl EvaluationContext {
    async fn from_state(state: &Arc<AgentState>) -> Self {
        let mstats = state.miner_stats.read().await;
        let miner_running = *state.miner_pid.read().await;

        // shares za poslednich 5 min (aproximace: pokud je hashrate > 0 a zadne shares)
        let shares_5min = if mstats.is_stale(300) { 0 } else { mstats.total_shares() };

        // GPU telemetry
        let gpu_temps = crate::gpu_telemetry::collect_all().await;
        let gpu_temp_max = gpu_temps
            .iter()
            .filter_map(|g| g.temperature_core)
            .max_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal))
            .unwrap_or(0.0);
        let gpu_power_total = gpu_temps.iter().map(|g| g.power_watts.unwrap_or(0.0)).sum();

        // Internet check — jednoduchy DNS probe
        let internet_ok = tokio::time::timeout(
            std::time::Duration::from_secs(3),
            tokio::net::TcpStream::connect("1.1.1.1:53"),
        )
        .await
        .is_ok();

        // Disk usage
        let disk_used_percent = get_disk_usage_percent().await.unwrap_or(0);

        Self {
            miner_running: miner_running.is_some(),
            hashrate: mstats.hashrate_60s,
            shares_5min,
            accepted_shares: mstats.accepted_shares,
            rejected_shares: mstats.rejected_shares,
            miner_restarts_1h: 0, // TODO: track restart count
            gpu_temp_max,
            gpu_power_total,
            pool_connected: miner_running.is_some(),
            internet_ok,
            disk_used_percent,
        }
    }
}

// ── Expression Evaluator ──────────────────────────────────

fn evaluate_condition(condition: &str, ctx: &EvaluationContext) -> bool {
    // Jednoduchy parser pro bězná watchdog pravidla
    // Podporuje: AND, OR, ==, !=, <, >, <=, >=

    let condition = condition.trim();

    // Split na AND/OR
    if condition.contains(" AND ") {
        let parts: Vec<&str> = condition.split(" AND ").collect();
        return parts.iter().all(|p| evaluate_condition(p.trim(), ctx));
    }
    if condition.contains(" OR ") {
        let parts: Vec<&str> = condition.split(" OR ").collect();
        return parts.iter().any(|p| evaluate_condition(p.trim(), ctx));
    }

    // Jednoduchy comparison
    let ops = ["==", "!=", "<=", ">=", "<", ">"];
    for op in &ops {
        if let Some(idx) = condition.find(op) {
            let left = condition[..idx].trim();
            let right = condition[idx + op.len()..].trim();
            let left_val = get_value(left, ctx);
            let right_val = parse_value(right);
            return compare(left_val, right_val, op);
        }
    }

    false
}

#[derive(Debug, Clone)]
enum Val {
    Bool(bool),
    Num(f64),
    Str(String),
}

fn get_value(name: &str, ctx: &EvaluationContext) -> Val {
    match name {
        "miner_running" => Val::Bool(ctx.miner_running),
        "hashrate" | "hashrate_5min" | "hashrate_10s" | "hashrate_60s" => Val::Num(ctx.hashrate),
        "shares_5min" => Val::Num(ctx.shares_5min as f64),
        "accepted_shares" => Val::Num(ctx.accepted_shares as f64),
        "rejected_shares" => Val::Num(ctx.rejected_shares as f64),
        "miner_restarts_1h" => Val::Num(ctx.miner_restarts_1h as f64),
        "gpu_temp_max" => Val::Num(ctx.gpu_temp_max as f64),
        "gpu_power_total" => Val::Num(ctx.gpu_power_total as f64),
        "pool_connected" => Val::Bool(ctx.pool_connected),
        "internet_ok" => Val::Bool(ctx.internet_ok),
        "disk_used_percent" => Val::Num(ctx.disk_used_percent as f64),
        _ => Val::Num(0.0),
    }
}

fn parse_value(s: &str) -> Val {
    if s == "true" {
        Val::Bool(true)
    } else if s == "false" {
        Val::Bool(false)
    } else if let Ok(n) = s.parse::<f64>() {
        Val::Num(n)
    } else {
        Val::Str(s.trim_matches('"').to_string())
    }
}

fn compare(left: Val, right: Val, op: &str) -> bool {
    use std::cmp::Ordering;
    match (left, right) {
        (Val::Bool(a), Val::Bool(b)) => match op {
            "==" => a == b,
            "!=" => a != b,
            _ => false,
        },
        (Val::Num(a), Val::Num(b)) => {
            let ord = a.partial_cmp(&b).unwrap_or(Ordering::Equal);
            match op {
                "==" => ord == Ordering::Equal,
                "!=" => ord != Ordering::Equal,
                "<" => ord == Ordering::Less,
                ">" => ord == Ordering::Greater,
                "<=" => ord != Ordering::Greater,
                ">=" => ord != Ordering::Less,
                _ => false,
            }
        }
        _ => false,
    }
}

// ── Helpers ───────────────────────────────────────────────

async fn load_rules(path: &str) -> anyhow::Result<Vec<WatchdogRule>> {
    let content = tokio::fs::read_to_string(path).await?;
    let config: WatchdogConfig = serde_yaml::from_str(&content)?;
    Ok(config.rules)
}

async fn get_disk_usage_percent() -> anyhow::Result<u32> {
    // Simple df -h /data or / parsing
    #[cfg(unix)]
    {
        let output = tokio::process::Command::new("df")
            .args(["-P", "/data"])
            .output()
            .await?;
        let stdout = String::from_utf8_lossy(&output.stdout);
        // Parse second line: Filesystem blocks used available use%
        for line in stdout.lines().skip(1) {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 5 {
                let pct = parts[4].trim_end_matches('%');
                if let Ok(p) = pct.parse::<u32>() {
                    return Ok(p);
                }
            }
        }
    }
    Ok(0)
}

// ── Actions ──────────────────────────────────────────────

async fn execute_action(state: Arc<AgentState>, action: &str) -> anyhow::Result<()> {
    match action {
        "restart_miner" => {
            info!("WATCHDOG: Restartuji miner...");
            crate::miner_ctl::restart_miner(state, None).await?;
        }
        "stop_miner" => {
            info!("WATCHDOG: Zastavuji miner...");
            crate::miner_ctl::stop_miner(state).await?;
        }
        "reboot_rig" => {
            info!("WATCHDOG: Rebootuji rig...");
            #[cfg(unix)]
            {
                let _ = tokio::process::Command::new("systemctl")
                    .arg("reboot")
                    .spawn()?;
            }
        }
        "apply_conservative_oc" => {
            info!("WATCHDOG: Aplikuji konzervativni OC...");
            let profile = crate::oc_manager::preset_conservative();
            if let Err(e) = crate::oc_manager::apply_profile(&profile).await {
                warn!("WATCHDOG: OC aplikace selhala: {}", e);
            }
        }
        "switch_pool_to_failover" => {
            info!("WATCHDOG: Prepinam na failover pool...");
            // TODO: Zmenit config.miner.default_pool na failover
        }
        _ => {
            warn!("WATCHDOG: Neznama akce '{}'", action);
        }
    }
    Ok(())
}
