use crate::AgentState;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WatchdogRule {
    pub name: String,
    pub condition: String,       // Jednoduchy expression (hashrate_5min < 1000)
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

            // Evaluate condition (stub — plna implementace potrebuje expression parser)
            let condition_met = evaluate_condition_stub(rule);

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

async fn load_rules(path: &str) -> anyhow::Result<Vec<WatchdogRule>> {
    let content = tokio::fs::read_to_string(path).await?;
    let config: WatchdogConfig = serde_yaml::from_str(&content)?;
    Ok(config.rules)
}

fn evaluate_condition_stub(rule: &WatchdogRule) -> bool {
    // TODO: Implementovat expression engine
    // Napr.: "shares_5min == 0 AND hashrate_5min > 0"
    // Prozatim vzdy false, aby se pri vychozi konfiguraci nic nestalo
    false
}

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
            // TODO: OC manager integration
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
