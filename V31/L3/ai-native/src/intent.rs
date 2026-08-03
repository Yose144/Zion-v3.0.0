//! # 🧭 Hiran v2.4 Maestro — Intent Router
//!
//! Classifies natural language user input → structured [`Intent`] enum.
//! The Intent is then consumed by the Planner Engine to build a task graph.
//!
//! ## Two modes
//!
//! 1. **Rule-based** (default, no LLM needed) — keyword matching, fast, deterministic.
//!    Suitable for development, unit tests, and as a fallback when LLM is offline.
//! 2. **LLM-based** (production) — uses any [`LlmBackend`] (Qwen3-8B 4-bit recommended)
//!    for robust classification of free-form user input.
//!
//! ## Architecture
//! ```text
//! User input ──► IntentRouter ──► Intent
//!                                  │
//!                                  ▼
//!                              Planner Engine
//! ```

use crate::error::{AiError, AiResult};
use crate::llm_backend::{LlmBackend, LlmRequest};
use crate::tool_registry::Intent;
use serde::{Deserialize, Serialize};

// ============================================================================
// Router config
// ============================================================================

/// Configuration for the Intent Router.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentRouterConfig {
    /// Use LLM backend for classification. If false, only rule-based matching.
    pub use_llm: bool,
    /// Confidence threshold (0.0–1.0). Below this, fall back to rule-based.
    pub llm_confidence_threshold: f32,
    /// Maximum tokens for the LLM classification prompt response.
    pub max_tokens: u32,
    /// LLM temperature for classification (low = deterministic).
    pub temperature: f32,
}

impl Default for IntentRouterConfig {
    fn default() -> Self {
        Self {
            use_llm: false, // default: rule-based (no LLM dependency)
            llm_confidence_threshold: 0.7,
            max_tokens: 64,
            temperature: 0.1,
        }
    }
}

// ============================================================================
// Classification result
// ============================================================================

/// Result of intent classification.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentClassification {
    /// The classified intent.
    pub intent: Intent,
    /// Confidence score (0.0–1.0). Rule-based returns 1.0 for exact matches.
    pub confidence: f32,
    /// Which classifier produced this result.
    pub source: ClassifierSource,
    /// Original user input (for logging / audit).
    pub user_input: String,
}

/// Which classifier produced the classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ClassifierSource {
    /// Rule-based keyword matcher.
    RuleBased,
    /// LLM backend (Qwen3-8B or similar).
    Llm,
    /// Fallback: rule-based was used because LLM was unavailable or low confidence.
    Fallback,
}

// ============================================================================
// Intent Router
// ============================================================================

/// Routes user input → Intent. Supports rule-based and LLM-based classification.
pub struct IntentRouter {
    config: IntentRouterConfig,
    /// Optional LLM backend for production classification.
    llm: Option<Box<dyn LlmBackend>>,
}

impl IntentRouter {
    /// Create a rule-only router (no LLM dependency). Best for dev + tests.
    pub fn rule_based() -> Self {
        Self {
            config: IntentRouterConfig::default(),
            llm: None,
        }
    }

    /// Create a router with an LLM backend for production classification.
    pub fn with_llm(llm: Box<dyn LlmBackend>, config: IntentRouterConfig) -> Self {
        Self {
            config,
            llm: Some(llm),
        }
    }

    /// Classify user input → Intent.
    pub fn classify(&self, user_input: &str) -> AiResult<IntentClassification> {
        let trimmed = user_input.trim();
        if trimmed.is_empty() {
            return Err(AiError::ToolExecutionFailed(
                "IntentRouter: empty user input".to_string(),
            ));
        }

        // Try LLM first if configured
        if self.config.use_llm {
            if let Some(llm) = &self.llm {
                if llm.is_ready() {
                    match self.classify_with_llm(llm.as_ref(), trimmed) {
                        Ok(c) if c.confidence >= self.config.llm_confidence_threshold => {
                            return Ok(c);
                        }
                        Ok(_) => {
                            // Low confidence — fall back to rule-based
                            let rule = classify_rule_based(trimmed);
                            return Ok(IntentClassification {
                                intent: rule,
                                confidence: 0.5,
                                source: ClassifierSource::Fallback,
                                user_input: trimmed.to_string(),
                            });
                        }
                        Err(_) => {
                            // LLM error — fall back to rule-based
                            let rule = classify_rule_based(trimmed);
                            return Ok(IntentClassification {
                                intent: rule,
                                confidence: 0.5,
                                source: ClassifierSource::Fallback,
                                user_input: trimmed.to_string(),
                            });
                        }
                    }
                }
            }
        }

        // Rule-based (default path)
        let intent = classify_rule_based(trimmed);
        Ok(IntentClassification {
            intent,
            confidence: 1.0,
            source: ClassifierSource::RuleBased,
            user_input: trimmed.to_string(),
        })
    }

    /// Classify using LLM backend. Returns confidence in [0.0, 1.0].
    fn classify_with_llm(
        &self,
        llm: &dyn LlmBackend,
        user_input: &str,
    ) -> Result<IntentClassification, String> {
        let system = "You are Hiran v2.4 Maestro Intent Router. \
Classify the user's request into exactly one of these intents:\n\
- SystemHealth: aggregate health, status of all services\n\
- MinerControl: start/stop/optimize mining\n\
- NodeInfo: blockchain height, peers, sync status, network info\n\
- WalletQuery: balance, UTXO, supply info\n\
- BridgeStatus: bridge validators, cross-chain tx tracking\n\
- DaoGovernance: DAO proposals, treasury, voting\n\
- SwapOperation: atomic swap status, execution, market rates\n\
- L3Query: WARP routes, NCL compute providers\n\
- L456Status: Oasis game, Free World humanitarian, Issobella satellite\n\
- SystemOps: docker restart, backup, prometheus alerts\n\n\
Respond with EXACTLY one line: <INTENT_NAME> <confidence 0.0-1.0>\n\
Example: MinerControl 0.95";

        let req = LlmRequest::new(crate::hiranyagarbha::MmlModality::Text, user_input)
            .with_system_prompt(system)
            .with_temperature(self.config.temperature)
            .with_max_tokens(self.config.max_tokens);

        let resp = llm.generate(req).map_err(|e| e.to_string())?;
        parse_llm_response(&resp.content, user_input)
    }
}

// ============================================================================
// Rule-based classifier
// ============================================================================

/// Rule-based intent classification via keyword matching.
/// Deterministic, fast, no LLM dependency.
pub fn classify_rule_based(input: &str) -> Intent {
    let lower = input.to_lowercase();

    // Order matters: more specific patterns first.

    // Miner control — start/stop/optimize mining
    if matches_any(
        &lower,
        &[
            "těž",
            "tez",
            "mine",
            "miner",
            "mining",
            "hashrate",
            "hash rate",
            "algoritmus",
            "algorithm",
            "ekam",
            "fire",
            "deeksha lite",
            "optimalizuj",
            "optimize",
            "benchmark",
            "těžba",
            "teztba",
            "start mining",
            "stop mining",
            "gpu temp",
            "teplota",
        ],
    ) {
        return Intent::MinerControl;
    }

    // Bridge status
    if matches_any(
        &lower,
        &[
            "bridge",
            "most",
            "validátor",
            "validator",
            "konsenzus",
            "consensus",
            "cross-chain",
            "přes most",
            "bridge tx",
        ],
    ) {
        return Intent::BridgeStatus;
    }

    // DAO governance
    if matches_any(
        &lower,
        &[
            "dao", "návrh", "proposal", "hlasuj", "vote", "voting", "treasury", "pokladna",
            "tithe", "desátek", "guardian",
        ],
    ) {
        return Intent::DaoGovernance;
    }

    // Swap operations
    if matches_any(
        &lower,
        &[
            "swap",
            "htlc",
            "atomic swap",
            "výměna",
            "vymena",
            "trh",
            "likvidita",
            "liquidity",
            "rates",
            "kurz",
        ],
    ) {
        return Intent::SwapOperation;
    }

    // L3 queries — WARP, NCL
    if matches_any(
        &lower,
        &[
            "warp",
            "ncl",
            "compute provider",
            "výpočet",
            "cross-chain route",
            "routing",
            "7-chain",
            "sedm řetězců",
        ],
    ) {
        return Intent::L3Query;
    }

    // L4-L6 status — Oasis, Free World, Issobella
    if matches_any(
        &lower,
        &[
            "oasis",
            "oáza",
            "game",
            "hra",
            "npc",
            "free world",
            "svobodný svět",
            "humanitarian",
            "humanitární",
            "donation",
            "dar",
            "impact",
            "issobella",
            "satellite",
            "satelit",
            "orbital",
            "data quality",
        ],
    ) {
        return Intent::L456Status;
    }

    // DeFi status — staking, farm, treasury, APR, Base Mainnet
    if matches_any(
        &lower,
        &[
            "defi",
            "de-fi",
            "staking",
            "stake",
            "farm",
            "farming",
            "apr",
            "apy",
            "tvl",
            "rewards",
            "reward",
            "wzion",
            "w-zion",
            "base mainnet",
            "basescan",
            "governance contract",
            "treasury contract",
        ],
    ) {
        return Intent::DefiStatus;
    }

    // Backup query — backup status, list backups, restore (NOT "udělej zálohu" = trigger)
    if matches_any(
        &lower,
        &[
            "backup status",
            "stav zálohy",
            "stav zalohy",
            "list backups",
            "seznam záloh",
            "seznam zaloh",
            "last backup",
            "poslední záloha",
            "posledni zaloha",
            "obnovit",
            "restore",
            "obnova",
            "backups",
            "zálohy",
            "zalohy", // plural = list
        ],
    ) {
        return Intent::BackupQuery;
    }

    // Database inspect — tables, DB, sqlite, inspect
    if matches_any(
        &lower,
        &[
            "databáze",
            "databaze",
            "database",
            "db",
            "tabulky",
            "tables",
            "table",
            "inspect db",
            "prozkoumat db",
            "sql",
            "schema",
            "rows",
            "řádky",
            "radky",
        ],
    ) {
        return Intent::DatabaseInspect;
    }

    // Watchdog status — watchdog, autoheal, alert history
    if matches_any(
        &lower,
        &[
            "watchdog",
            "auto-heal",
            "autoheal",
            "auto heal",
            "alert history",
            "historie alertů",
            "historie alertu",
            "timer status",
            "health check",
        ],
    ) {
        return Intent::WatchdogStatus;
    }

    // System ops — docker, backup trigger, prometheus (catch-all for ops)
    if matches_any(
        &lower,
        &[
            "docker",
            "container",
            "kontejner",
            "restartuj",
            "restart",
            "backup",
            "záloha",
            "zaloha",
            "zálohu",
            "zalohu",
            "zálohy",
            "zalohy",
            "prometheus",
            "alert",
            "alertmanager",
            "update",
            "aktualizuj",
            "nginx",
            "reload",
        ],
    ) {
        return Intent::SystemOps;
    }

    // Wallet query — balance, supply
    if matches_any(
        &lower,
        &[
            "kolik mám",
            "balance",
            "zůstatek",
            "zustatek",
            "utxo",
            "supply",
            "nabídka",
            "kolik zion",
            "account",
        ],
    ) {
        return Intent::WalletQuery;
    }

    // Node info — height, peers, sync
    if matches_any(
        &lower,
        &[
            "výška",
            "vyska",
            "height",
            "blok",
            "block",
            "peer",
            "uzel",
            "node",
            "sync",
            "synchroniz",
            "network info",
            "síť",
            "sit",
            "difficult",
            "obtížnost",
        ],
    ) {
        return Intent::NodeInfo;
    }

    // System health — default for "is everything OK?" style queries
    if matches_any(
        &lower,
        &[
            "zdravé",
            "zdrave",
            "health",
            "healthy",
            "ok",
            "status",
            "vše",
            "vse",
            "everything",
            "all good",
            "funguje",
            "je vše",
            "je vse",
            "stav",
            "state of",
        ],
    ) {
        return Intent::SystemHealth;
    }

    // Default: SystemHealth (safest catch-all — aggregates everything)
    Intent::SystemHealth
}

/// Check if `lower` contains any of the keywords.
fn matches_any(lower: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|k| lower.contains(k))
}

// ============================================================================
// LLM response parser
// ============================================================================

/// Parse LLM response line "<INTENT_NAME> <confidence>".
fn parse_llm_response(content: &str, user_input: &str) -> Result<IntentClassification, String> {
    let line = content.trim().lines().next().ok_or("empty LLM response")?;
    let line = line.trim();

    // Try to split "INTENT confidence"
    let mut parts = line.split_whitespace();
    let intent_str = parts.next().ok_or("no intent in LLM response")?;
    let confidence_str = parts.next();

    let intent = parse_intent_name(intent_str)
        .ok_or_else(|| format!("unknown intent name: {}", intent_str))?;

    let confidence = confidence_str
        .and_then(|s| s.parse::<f32>().ok())
        .map(|c| c.clamp(0.0, 1.0))
        .unwrap_or(0.8); // default confidence if not parseable

    Ok(IntentClassification {
        intent,
        confidence,
        source: ClassifierSource::Llm,
        user_input: user_input.to_string(),
    })
}

/// Parse intent name string → Intent enum.
fn parse_intent_name(s: &str) -> Option<Intent> {
    let lower = s.to_lowercase();
    Some(match lower.as_str() {
        "systemhealth" | "system_health" | "system health" | "health" => Intent::SystemHealth,
        "minercontrol" | "miner_control" | "miner" => Intent::MinerControl,
        "nodeinfo" | "node_info" | "node" => Intent::NodeInfo,
        "walletquery" | "wallet_query" | "wallet" => Intent::WalletQuery,
        "bridgestatus" | "bridge_status" | "bridge" => Intent::BridgeStatus,
        "daogovernance" | "dao_governance" | "dao" => Intent::DaoGovernance,
        "swapoperation" | "swap_operation" | "swap" => Intent::SwapOperation,
        "l3query" | "l3_query" | "l3" => Intent::L3Query,
        "l456status" | "l456_status" | "l456" => Intent::L456Status,
        "systemops" | "system_ops" => Intent::SystemOps,
        "defistatus" | "defi_status" | "defi" => Intent::DefiStatus,
        "backupquery" | "backup_query" => Intent::BackupQuery,
        "databaseinspect" | "database_inspect" => Intent::DatabaseInspect,
        "watchdogstatus" | "watchdog_status" | "watchdog" => Intent::WatchdogStatus,
        _ => return None,
    })
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn classify(input: &str) -> Intent {
        classify_rule_based(input)
    }

    // ── Rule-based: MinerControl ──────────────────────────────────────────────

    #[test]
    fn test_rule_miner_start() {
        assert_eq!(
            classify("Začni těžit s optimálními nastaveními"),
            Intent::MinerControl
        );
    }

    #[test]
    fn test_rule_miner_english() {
        assert_eq!(
            classify("start mining with fire algorithm"),
            Intent::MinerControl
        );
    }

    #[test]
    fn test_rule_miner_benchmark() {
        assert_eq!(
            classify("proveď benchmark všech algoritmů"),
            Intent::MinerControl
        );
    }

    #[test]
    fn test_rule_miner_temp() {
        assert_eq!(classify("jaká je teplota GPU?"), Intent::MinerControl);
    }

    // ── Rule-based: SystemHealth ──────────────────────────────────────────────

    #[test]
    fn test_rule_health_czech() {
        assert_eq!(classify("je vše zdravé?"), Intent::SystemHealth);
    }

    #[test]
    fn test_rule_health_english() {
        assert_eq!(classify("is everything healthy?"), Intent::SystemHealth);
    }

    #[test]
    fn test_rule_health_status() {
        assert_eq!(classify("overall system status"), Intent::SystemHealth);
    }

    // ── Rule-based: NodeInfo ──────────────────────────────────────────────────

    #[test]
    fn test_rule_node_height() {
        assert_eq!(classify("jaká je výška bloku?"), Intent::NodeInfo);
    }

    #[test]
    fn test_rule_node_peers() {
        assert_eq!(classify("kolik peerů je připojeno?"), Intent::NodeInfo);
    }

    #[test]
    fn test_rule_node_sync() {
        assert_eq!(classify("is the node synced?"), Intent::NodeInfo);
    }

    // ── Rule-based: WalletQuery ───────────────────────────────────────────────

    #[test]
    fn test_rule_wallet_balance() {
        assert_eq!(classify("kolik mám na účtu?"), Intent::WalletQuery);
    }

    #[test]
    fn test_rule_wallet_supply() {
        assert_eq!(classify("what's the current supply?"), Intent::WalletQuery);
    }

    // ── Rule-based: BridgeStatus ──────────────────────────────────────────────

    #[test]
    fn test_rule_bridge_validators() {
        assert_eq!(
            classify("kolik validátorů je aktivních na bridge?"),
            Intent::BridgeStatus
        );
    }

    #[test]
    fn test_rule_bridge_english() {
        assert_eq!(classify("bridge consensus status"), Intent::BridgeStatus);
    }

    // ── Rule-based: DaoGovernance ─────────────────────────────────────────────

    #[test]
    fn test_rule_dao_proposals() {
        assert_eq!(
            classify("jaké jsou aktivní DAO návrhy?"),
            Intent::DaoGovernance
        );
    }

    #[test]
    fn test_rule_dao_vote() {
        assert_eq!(classify("hlasuj pro návrh 42"), Intent::DaoGovernance);
    }

    // ── Rule-based: SwapOperation ─────────────────────────────────────────────

    #[test]
    fn test_rule_swap_status() {
        assert_eq!(classify("stav atomic swapu"), Intent::SwapOperation);
    }

    #[test]
    fn test_rule_swap_rates() {
        assert_eq!(classify("jaké jsou tržní kurzy?"), Intent::SwapOperation);
    }

    // ── Rule-based: L3Query ───────────────────────────────────────────────────

    #[test]
    fn test_rule_l3_warp() {
        assert_eq!(classify("WARP routes status"), Intent::L3Query);
    }

    #[test]
    fn test_rule_l3_ncl() {
        assert_eq!(classify("list NCL compute providers"), Intent::L3Query);
    }

    // ── Rule-based: L456Status ────────────────────────────────────────────────

    #[test]
    fn test_rule_l4_oasis() {
        assert_eq!(classify("stav Oasis ekonomiky"), Intent::L456Status);
    }

    #[test]
    fn test_rule_l5_free_world() {
        assert_eq!(classify("Free World donation status"), Intent::L456Status);
    }

    #[test]
    fn test_rule_l6_issobella() {
        assert_eq!(
            classify("Issobella satellite link status"),
            Intent::L456Status
        );
    }

    // ── Rule-based: SystemOps ─────────────────────────────────────────────────

    #[test]
    fn test_rule_system_docker() {
        assert_eq!(classify("restartuj kontejner zion-web"), Intent::SystemOps);
    }

    #[test]
    fn test_rule_system_backup() {
        assert_eq!(classify("udělej zálohu"), Intent::SystemOps);
    }

    #[test]
    fn test_rule_system_prometheus() {
        assert_eq!(classify("show prometheus alerts"), Intent::SystemOps);
    }

    // ── Default fallback ──────────────────────────────────────────────────────

    #[test]
    fn test_rule_default_health() {
        // Unknown input → SystemHealth (safest catch-all)
        assert_eq!(classify("xyzzy frobnicate the quux"), Intent::SystemHealth);
    }

    // ── IntentRouter (rule-based mode) ────────────────────────────────────────

    #[test]
    fn test_router_rule_based() {
        let router = IntentRouter::rule_based();
        let c = router.classify("je vše zdravé?").unwrap();
        assert_eq!(c.intent, Intent::SystemHealth);
        assert_eq!(c.source, ClassifierSource::RuleBased);
        assert_eq!(c.confidence, 1.0);
    }

    #[test]
    fn test_router_empty_input() {
        let router = IntentRouter::rule_based();
        assert!(router.classify("").is_err());
        assert!(router.classify("   ").is_err());
    }

    // ── LLM response parser ───────────────────────────────────────────────────

    #[test]
    fn test_parse_llm_response_ok() {
        let c = parse_llm_response("MinerControl 0.95", "start mining").unwrap();
        assert_eq!(c.intent, Intent::MinerControl);
        assert_eq!(c.confidence, 0.95);
        assert_eq!(c.source, ClassifierSource::Llm);
    }

    #[test]
    fn test_parse_llm_response_no_confidence() {
        let c = parse_llm_response("SystemHealth", "is everything ok?").unwrap();
        assert_eq!(c.intent, Intent::SystemHealth);
        assert_eq!(c.confidence, 0.8); // default
    }

    #[test]
    fn test_parse_llm_response_unknown_intent() {
        assert!(parse_llm_response("UnknownIntent 0.5", "test").is_err());
    }

    #[test]
    fn test_parse_llm_response_empty() {
        assert!(parse_llm_response("", "test").is_err());
    }

    #[test]
    fn test_parse_llm_response_clamps_confidence() {
        let c = parse_llm_response("NodeInfo 1.5", "height?").unwrap();
        assert_eq!(c.confidence, 1.0);
        let c = parse_llm_response("NodeInfo -0.5", "height?").unwrap();
        assert_eq!(c.confidence, 0.0);
    }

    // ── parse_intent_name ─────────────────────────────────────────────────────

    #[test]
    fn test_parse_intent_name_variants() {
        assert_eq!(
            parse_intent_name("SystemHealth"),
            Some(Intent::SystemHealth)
        );
        assert_eq!(
            parse_intent_name("system_health"),
            Some(Intent::SystemHealth)
        );
        assert_eq!(
            parse_intent_name("system health"),
            Some(Intent::SystemHealth)
        );
        assert_eq!(
            parse_intent_name("MinerControl"),
            Some(Intent::MinerControl)
        );
        assert_eq!(parse_intent_name("dao"), Some(Intent::DaoGovernance));
        assert_eq!(parse_intent_name("nonsense"), None);
    }

    // ── IntentRouter with LLM (using EchoBackend) ─────────────────────────────

    #[test]
    fn test_router_with_llm_fallback() {
        use crate::llm_backend::EchoBackend;
        let config = IntentRouterConfig {
            use_llm: true,
            llm_confidence_threshold: 0.99, // force fallback (echo won't return valid format)
            ..Default::default()
        };
        let llm: Box<dyn LlmBackend> = Box::new(EchoBackend::new("echo"));
        let router = IntentRouter::with_llm(llm, config);
        let c = router.classify("je vše zdravé?").unwrap();
        // EchoBackend returns the prompt back — won't parse as intent → fallback
        assert_eq!(c.source, ClassifierSource::Fallback);
        assert_eq!(c.intent, Intent::SystemHealth);
    }

    #[test]
    fn test_router_llm_not_ready_falls_back() {
        use crate::llm_backend::LlamaCppBackend;
        let config = IntentRouterConfig {
            use_llm: true,
            ..Default::default()
        };
        // LlamaCppBackend::new() returns a stub that is_ready() == false
        if let Some(llm) = LlamaCppBackend::new("dummy") {
            let router = IntentRouter::with_llm(Box::new(llm), config);
            let c = router.classify("start mining").unwrap();
            assert_eq!(c.source, ClassifierSource::RuleBased);
            assert_eq!(c.intent, Intent::MinerControl);
        }
    }

    // ── Rule-based: DefiStatus ────────────────────────────────────────────────

    #[test]
    fn test_rule_defi_staking() {
        assert_eq!(
            classify("jaká je aktuální APR pro staking?"),
            Intent::DefiStatus
        );
    }

    #[test]
    fn test_rule_defi_farm() {
        assert_eq!(classify("show me farm rewards status"), Intent::DefiStatus);
    }

    #[test]
    fn test_rule_defi_wzion() {
        assert_eq!(
            classify("what is the wZION contract address?"),
            Intent::DefiStatus
        );
    }

    #[test]
    fn test_rule_defi_tvl() {
        assert_eq!(
            classify("jaká je TVL v DeFi kontraktech?"),
            Intent::DefiStatus
        );
    }

    // ── Rule-based: BackupQuery ───────────────────────────────────────────────

    #[test]
    fn test_rule_backup_status() {
        assert_eq!(classify("backup status prosím"), Intent::BackupQuery);
    }

    #[test]
    fn test_rule_backup_list_czech() {
        assert_eq!(
            classify("seznam záloh za poslední týden"),
            Intent::BackupQuery
        );
    }

    #[test]
    fn test_rule_backup_last() {
        assert_eq!(classify("when was the last backup?"), Intent::BackupQuery);
    }

    #[test]
    fn test_rule_backup_restore() {
        assert_eq!(classify("obnovit databázi ze zálohy"), Intent::BackupQuery);
    }

    // ── Rule-based: DatabaseInspect ───────────────────────────────────────────

    #[test]
    fn test_rule_db_inspect() {
        assert_eq!(classify("inspect db edge-state"), Intent::DatabaseInspect);
    }

    #[test]
    fn test_rule_db_tables_czech() {
        assert_eq!(
            classify("jaké tabulky jsou v databázi?"),
            Intent::DatabaseInspect
        );
    }

    #[test]
    fn test_rule_db_schema() {
        assert_eq!(
            classify("show me the schema of the database"),
            Intent::DatabaseInspect
        );
    }

    // ── Rule-based: WatchdogStatus ────────────────────────────────────────────

    #[test]
    fn test_rule_watchdog_status() {
        assert_eq!(classify("watchdog status report"), Intent::WatchdogStatus);
    }

    #[test]
    fn test_rule_watchdog_autoheal() {
        assert_eq!(classify("is autoheal running?"), Intent::WatchdogStatus);
    }

    #[test]
    fn test_rule_watchdog_alert_history() {
        assert_eq!(
            classify("historie alertů za posledních 24h"),
            Intent::WatchdogStatus
        );
    }

    // ── parse_intent_name: new intents ────────────────────────────────────────

    #[test]
    fn test_parse_intent_name_new_intents() {
        assert_eq!(parse_intent_name("DefiStatus"), Some(Intent::DefiStatus));
        assert_eq!(parse_intent_name("defi_status"), Some(Intent::DefiStatus));
        assert_eq!(parse_intent_name("defi"), Some(Intent::DefiStatus));
        assert_eq!(parse_intent_name("BackupQuery"), Some(Intent::BackupQuery));
        assert_eq!(parse_intent_name("backup_query"), Some(Intent::BackupQuery));
        assert_eq!(
            parse_intent_name("DatabaseInspect"),
            Some(Intent::DatabaseInspect)
        );
        assert_eq!(
            parse_intent_name("database_inspect"),
            Some(Intent::DatabaseInspect)
        );
        assert_eq!(
            parse_intent_name("WatchdogStatus"),
            Some(Intent::WatchdogStatus)
        );
        assert_eq!(
            parse_intent_name("watchdog_status"),
            Some(Intent::WatchdogStatus)
        );
        assert_eq!(parse_intent_name("watchdog"), Some(Intent::WatchdogStatus));
    }
}
