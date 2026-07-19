//! Core types for AuxPow — coins, profiles, profit entries, config.
//!
//! These are standalone versions of the types in `zion-cosmic-harmony::profit_router`.
//! When integrated into V3, the pool server can use either this crate's types
//! or the cosmic-harmony ones (they are compatible by design).

use serde::{Deserialize, Serialize};

// ── External coin enumeration ────────────────────────────────────────

/// Coins that ZION pool can profit-switch to for the multi-algo revenue slot.
#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum ExternalCoin {
    #[default]
    DCR,
    ALPH,
    KAS,
    ERG,
    RVN,
    ETC,
    EVR,
    MEWC,
    FLUX,
    CLORE,
    XMR,
    VRSC,
    EPIC,
    PRL,
    QUAI,
    BEAM,
    KLS,
    ZCL,
    QTC,
    VTC,
    IRON,
    NEXA,
    RTM,
    DNX,
    CKB,
    CFX,
    ZEC,
    PHX,
    KRX,
}

impl ExternalCoin {
    pub fn ticker(self) -> &'static str {
        match self {
            Self::DCR => "DCR",
            Self::ALPH => "ALPH",
            Self::KAS => "KAS",
            Self::ERG => "ERG",
            Self::RVN => "RVN",
            Self::ETC => "ETC",
            Self::EVR => "EVR",
            Self::MEWC => "MEWC",
            Self::FLUX => "FLUX",
            Self::CLORE => "CLORE",
            Self::XMR => "XMR",
            Self::VRSC => "VRSC",
            Self::EPIC => "EPIC",
            Self::PRL => "PRL",
            Self::QUAI => "QUAI",
            Self::BEAM => "BEAM",
            Self::KLS => "KLS",
            Self::ZCL => "ZCL",
            Self::QTC => "QTC",
            Self::VTC => "VTC",
            Self::IRON => "IRON",
            Self::NEXA => "NEXA",
            Self::RTM => "RTM",
            Self::DNX => "DNX",
            Self::CKB => "CKB",
            Self::CFX => "CFX",
            Self::ZEC => "ZEC",
            Self::PHX => "PHX",
            Self::KRX => "KRX",
        }
    }

    pub fn algorithm(self) -> &'static str {
        match self {
            Self::DCR => "blake3",
            Self::ALPH => "blake3",
            Self::KAS => "kheavyhash",
            Self::ERG => "autolykos",
            Self::RVN => "kawpow",
            Self::ETC => "ethash",
            Self::EVR => "evrprogpow",
            Self::MEWC => "meowpow",
            Self::FLUX => "zelhash",
            Self::CLORE => "kawpow",
            Self::XMR => "randomx",
            Self::VRSC => "verushash",
            Self::EPIC => "progpow",
            Self::PRL => "pearlhash",
            Self::QUAI => "kawpow",
            Self::BEAM => "beamhash",
            Self::KLS => "karlsenhash",
            Self::ZCL => "equihashzero",
            Self::QTC => "qhash",
            Self::VTC => "verthash",
            Self::IRON => "fishhash",
            Self::NEXA => "nexapow",
            Self::RTM => "ghostrider",
            Self::DNX => "dynexsolve",
            Self::CKB => "eaglesong",
            Self::CFX => "octopus",
            Self::ZEC => "equihash",
            Self::PHX => "neoscrypt",
            Self::KRX => "keryxhash",
        }
    }

    pub fn is_blake3(self) -> bool {
        matches!(self, Self::DCR | Self::ALPH)
    }

    pub fn is_cpu(self) -> bool {
        matches!(self, Self::XMR | Self::VRSC | Self::RTM)
    }

    pub fn from_str_loose(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "dcr" | "decred" => Some(Self::DCR),
            "alph" | "alephium" => Some(Self::ALPH),
            "kas" | "kaspa" => Some(Self::KAS),
            "erg" | "ergo" => Some(Self::ERG),
            "rvn" | "ravencoin" => Some(Self::RVN),
            "etc" | "ethereum-classic" => Some(Self::ETC),
            "evr" | "evrmore" => Some(Self::EVR),
            "mewc" | "meowcoin" => Some(Self::MEWC),
            "flux" => Some(Self::FLUX),
            "clore" | "clore.ai" => Some(Self::CLORE),
            "xmr" | "monero" => Some(Self::XMR),
            "vrsc" | "verus" | "veruscoin" => Some(Self::VRSC),
            "epic" | "epiccash" => Some(Self::EPIC),
            "prl" | "pearl" => Some(Self::PRL),
            "quai" | "quainetwork" => Some(Self::QUAI),
            "beam" => Some(Self::BEAM),
            "kls" | "karlsen" => Some(Self::KLS),
            "zcl" | "zclassic" => Some(Self::ZCL),
            "qtc" | "qubitcoin" => Some(Self::QTC),
            "vtc" | "vertcoin" => Some(Self::VTC),
            "iron" | "ironfish" => Some(Self::IRON),
            "nexa" => Some(Self::NEXA),
            "rtm" | "raptoreum" => Some(Self::RTM),
            "dnx" | "dynex" => Some(Self::DNX),
            "ckb" | "nervos" | "nervos-network" => Some(Self::CKB),
            "cfx" | "conflux" => Some(Self::CFX),
            "zec" | "zcash" => Some(Self::ZEC),
            "phx" | "phoenixcoin" | "phoenix-coin" => Some(Self::PHX),
            "krx" | "keryx" | "keryxhash" => Some(Self::KRX),
            _ => None,
        }
    }

    pub fn default_pool(self) -> &'static str {
        match self {
            Self::DCR => "pool.woolypooly.com:3152",
            Self::ALPH => "pool.woolypooly.com:3106",
            Self::KAS => "kas.2miners.com:2020",
            Self::ERG => "erg.2miners.com:8888",
            Self::RVN => "rvn.2miners.com:6060",
            Self::ETC => "etc.2miners.com:1010",
            Self::EVR => "evrprogpow.eu.mine.zpool.ca:1330",
            Self::MEWC => "meowpow.eu.mine.zpool.ca:1327",
            Self::FLUX => "flux.woolypooly.com:3000",
            Self::CLORE => "clore.woolypooly.com:3090",
            Self::XMR => "gulf.moneroocean.stream:10001",
            Self::VRSC => "eu.luckpool.net:3956",
            Self::EPIC => "de.epicmine.io:3334",
            Self::PRL => "prl.2miners.com:1818",
            Self::QUAI => "quaikawpow.2miners.com:4545",
            Self::BEAM => "beam.2miners.com:5252",
            Self::KLS => "karlsencoin.cedric-crispin.com:4154",
            Self::ZCL => "equihash192.eu.mine.zpool.ca:2144",
            Self::QTC => "qtc.suprnova.cc:5555",
            Self::VTC => "verthash.eu.mine.zpool.ca:4533",
            Self::IRON => "fr.grandpool.io:2027",
            Self::NEXA => "nexa.2miners.com:5050",
            Self::RTM => "ghostrider.eu.mine.zpool.ca:5354",
            Self::DNX => "pool.deepminerz.com:3333",
            Self::CKB => "ckb.2miners.com:6464",
            Self::CFX => "cfx.2miners.com:6565",
            Self::ZEC => "zec.2miners.com:7070",
            Self::PHX => "neoscrypt.eu.mine.zpool.ca:4233",
            Self::KRX => "keryxhash.eu.mine.zpool.ca:4233",
        }
    }

    /// NiceHash stratum endpoint for supported algorithms.
    ///
    /// NiceHash uses `auto.nicehash.com:9200` for all algorithms — the
    /// algorithm name is the subdomain prefix.  One BTC wallet address
    /// works for all algorithms.
    ///
    /// Returns `None` for coins not supported by NiceHash (Blake3, ProgPow,
    /// PearlHash, GhostRider, DynexSolve, KarlsenHash, Qhash, Verthash,
    /// ZelHash/FLUX — NiceHash ZHash is 144,5, not 125,4).
    pub fn nicehash_pool(self) -> Option<&'static str> {
        Some(match self {
            Self::ETC => "etchash.auto.nicehash.com:9200",
            Self::RVN | Self::QUAI | Self::CLORE => "kawpow.auto.nicehash.com:9200",
            Self::ERG => "autolykos.auto.nicehash.com:9200",
            Self::KAS => "kheavyhash.auto.nicehash.com:9200",
            Self::VRSC => "verushash.auto.nicehash.com:9200",
            Self::NEXA => "nexapow.auto.nicehash.com:9200",
            Self::ALPH => "alephium.auto.nicehash.com:9200",
            Self::CKB => "eaglesong.auto.nicehash.com:9200",
            Self::CFX => "octopus.auto.nicehash.com:9200",
            Self::ZEC => "equihash.auto.nicehash.com:9200",
            Self::PHX => "neoscrypt.auto.nicehash.com:9200",
            Self::KRX => "keryxhash.auto.nicehash.com:9200",
            // FLUX (ZelHash = Equihash 125,4) is NOT on NiceHash.
            // NiceHash ZHash = Equihash 144,5 (BTG/ANON/BTCZ) — different algo.
            // Not on NiceHash: XMR (requires KYC), DCR (Blake3), EPIC (ProgPow),
            // EVR (EvrProgPow), MEWC (MeowPow), PRL (PearlHash), RTM (GhostRider),
            // DNX (DynexSolve), KLS (KarlsenHash), QTC (Qhash), VTC (Verthash),
            // FLUX (ZelHash 125,4 ≠ NiceHash ZHash 144,5)
            // BEAM (BeamStratum TLS protocol incompatible with NiceHash beamv3 endpoint —
            //   TLS handshake fails with rustls; NiceHash uses standard stratum, not BeamStratum)
            // IRON (IronFishStratum v2 protocol incompatible with NiceHash fishhash endpoint —
            //   connection closed by remote; NiceHash uses standard stratum, not IronFish v2)
            // ZCL (equihash192.auto.nicehash.com does not resolve — NiceHash has no equihash192 endpoint;
            //   ZCL falls back to zpool.ca which supports BTC payout)
            Self::XMR | Self::DCR | Self::EPIC | Self::EVR | Self::MEWC | Self::PRL
            | Self::KLS | Self::QTC | Self::VTC | Self::RTM | Self::DNX | Self::FLUX
            | Self::BEAM | Self::IRON | Self::ZCL
            => return None,
        })
    }

    /// Best pool endpoint based on preference.
    /// NiceHash → default_pool (fallback if NiceHash doesn't support the coin).
    pub fn best_pool(self, preference: PoolPreference) -> &'static str {
        match preference {
            PoolPreference::NiceHash => {
                self.nicehash_pool().unwrap_or_else(|| self.default_pool())
            }
            _ => self.default_pool(),
        }
    }

    /// Whether this coin's default pool supports BTC wallet payout.
    /// 2miners and zpool both support BTC payout. Others may not.
    pub fn supports_btc_payout(self) -> bool {
        matches!(
            self,
            Self::KAS | Self::ERG | Self::RVN | Self::ETC
                | Self::EVR | Self::MEWC | Self::QUAI | Self::BEAM
                | Self::ZCL | Self::NEXA | Self::RTM | Self::VTC
                | Self::CKB | Self::CFX | Self::ZEC | Self::PHX
        )
    }

    /// Whether this coin's default pool is on zpool (requires c=BTC password).
    pub fn is_zpool(self) -> bool {
        matches!(
            self,
            Self::EVR | Self::MEWC | Self::ZCL | Self::NEXA | Self::RTM | Self::VTC
                | Self::PHX
        )
    }

    pub fn all() -> &'static [ExternalCoin] {
        &[
            Self::DCR,
            Self::ALPH,
            Self::KAS,
            Self::ERG,
            Self::RVN,
            Self::ETC,
            Self::EVR,
            Self::MEWC,
            Self::FLUX,
            Self::CLORE,
            Self::XMR,
            Self::VRSC,
            Self::EPIC,
            Self::PRL,
            Self::QUAI,
            Self::BEAM,
            Self::KLS,
            Self::ZCL,
            Self::QTC,
            Self::VTC,
            Self::IRON,
            Self::NEXA,
            Self::RTM,
            Self::DNX,
            Self::CKB,
            Self::CFX,
            Self::ZEC,
            Self::PHX,
            Self::KRX,
        ]
    }

    pub fn blake3_coins() -> &'static [ExternalCoin] {
        &[Self::DCR, Self::ALPH]
    }
}

impl std::fmt::Display for ExternalCoin {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(self.ticker())
    }
}

// ── Pool preference ──────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PoolPreference {
    NiceHash,
    HeroMiners,
    ZPool,
    Default,
}

impl PoolPreference {
    pub fn from_str_loose(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "nicehash" | "nh" => Self::NiceHash,
            "herominers" | "hm" => Self::HeroMiners,
            "zpool" => Self::ZPool,
            _ => Self::Default,
        }
    }
}

// ── Coin profile ─────────────────────────────────────────────────────

/// Complete profile for an external coin — enough to connect and mine.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoinProfile {
    pub coin: ExternalCoin,
    pub ticker: String,
    pub algorithm: String,
    pub pool_host: String,
    pub pool_port: u16,
    pub worker_name: String,
    pub password: String,
    pub enabled: bool,
}

impl CoinProfile {
    pub fn default_for(coin: ExternalCoin) -> Self {
        let (host, port) = split_host_port(coin.default_pool());
        Self {
            coin,
            ticker: coin.ticker().to_string(),
            algorithm: coin.algorithm().to_string(),
            pool_host: host,
            pool_port: port,
            worker_name: "zion_auxpow".to_string(),
            password: if coin == ExternalCoin::DCR {
                "x,d=4".to_string()
            } else {
                String::new()
            },
            enabled: true,
        }
    }

    pub fn pool_address(&self) -> String {
        format!("{}:{}", self.pool_host, self.pool_port)
    }
}

pub fn split_host_port(addr: &str) -> (String, u16) {
    if let Some(pos) = addr.rfind(':') {
        let host = addr[..pos].to_string();
        let port = addr[pos + 1..].parse::<u16>().unwrap_or(3333);
        (host, port)
    } else {
        (addr.to_string(), 3333)
    }
}

// ── Profit entry ─────────────────────────────────────────────────────

/// A single profitability estimate for a coin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfitEntry {
    pub coin: ExternalCoin,
    pub revenue_per_day_usd: f64,
    pub power_cost_usd: f64,
}

impl ProfitEntry {
    pub fn profit_per_day_usd(&self) -> f64 {
        self.revenue_per_day_usd - self.power_cost_usd
    }
}

/// Static fallback profitability estimates (per 100 MH/s reference).
pub fn fallback_estimates() -> Vec<ProfitEntry> {
    vec![
        ProfitEntry { coin: ExternalCoin::KAS, revenue_per_day_usd: 0.85, power_cost_usd: 0.10 },
        ProfitEntry { coin: ExternalCoin::ETC, revenue_per_day_usd: 0.60, power_cost_usd: 0.12 },
        ProfitEntry { coin: ExternalCoin::ALPH, revenue_per_day_usd: 0.55, power_cost_usd: 0.08 },
        ProfitEntry { coin: ExternalCoin::FLUX, revenue_per_day_usd: 0.50, power_cost_usd: 0.10 },
        ProfitEntry { coin: ExternalCoin::DCR, revenue_per_day_usd: 0.45, power_cost_usd: 0.08 },
        ProfitEntry { coin: ExternalCoin::ERG, revenue_per_day_usd: 0.40, power_cost_usd: 0.10 },
        ProfitEntry { coin: ExternalCoin::RVN, revenue_per_day_usd: 0.35, power_cost_usd: 0.12 },
        ProfitEntry { coin: ExternalCoin::CLORE, revenue_per_day_usd: 0.30, power_cost_usd: 0.10 },
        ProfitEntry { coin: ExternalCoin::EVR, revenue_per_day_usd: 0.20, power_cost_usd: 0.08 },
        ProfitEntry { coin: ExternalCoin::MEWC, revenue_per_day_usd: 0.15, power_cost_usd: 0.06 },
        ProfitEntry { coin: ExternalCoin::XMR, revenue_per_day_usd: 0.12, power_cost_usd: 0.03 },
        ProfitEntry { coin: ExternalCoin::VRSC, revenue_per_day_usd: 0.14, power_cost_usd: 0.03 },
        ProfitEntry { coin: ExternalCoin::EPIC, revenue_per_day_usd: 0.35, power_cost_usd: 0.10 },
        ProfitEntry { coin: ExternalCoin::QUAI, revenue_per_day_usd: 0.90, power_cost_usd: 0.12 },
        ProfitEntry { coin: ExternalCoin::BEAM, revenue_per_day_usd: 0.25, power_cost_usd: 0.10 },
        // Pearl (PRL) — 22x more profitable than KAS (WhatToMine 2026-07-15).
        // RTX 4090: ~$4.33/day profit at 125 Th/s. Normalized per 100 MH/s
        // equivalent: very high revenue, moderate power (GPU MatMul).
        ProfitEntry { coin: ExternalCoin::PRL, revenue_per_day_usd: 4.33, power_cost_usd: 0.67 },
        ProfitEntry { coin: ExternalCoin::KLS, revenue_per_day_usd: 0.21, power_cost_usd: 0.22 },
        ProfitEntry { coin: ExternalCoin::ZCL, revenue_per_day_usd: 0.20, power_cost_usd: 0.26 },
        ProfitEntry { coin: ExternalCoin::QTC, revenue_per_day_usd: 0.10, power_cost_usd: 0.26 },
        ProfitEntry { coin: ExternalCoin::VTC, revenue_per_day_usd: 0.04, power_cost_usd: 0.26 },
        ProfitEntry { coin: ExternalCoin::IRON, revenue_per_day_usd: 0.04, power_cost_usd: 0.26 },
        ProfitEntry { coin: ExternalCoin::NEXA, revenue_per_day_usd: 0.03, power_cost_usd: 0.24 },
        ProfitEntry { coin: ExternalCoin::RTM, revenue_per_day_usd: 0.03, power_cost_usd: 0.24 },
        ProfitEntry { coin: ExternalCoin::DNX, revenue_per_day_usd: 0.02, power_cost_usd: 0.22 },
        ProfitEntry { coin: ExternalCoin::CKB, revenue_per_day_usd: 0.08, power_cost_usd: 0.25 },
        ProfitEntry { coin: ExternalCoin::CFX, revenue_per_day_usd: 0.15, power_cost_usd: 0.31 },
        ProfitEntry { coin: ExternalCoin::ZEC, revenue_per_day_usd: 0.10, power_cost_usd: 0.25 },
        ProfitEntry { coin: ExternalCoin::PHX, revenue_per_day_usd: 0.03, power_cost_usd: 0.27 },
    ]
}

/// Pick the most profitable coin, applying hysteresis:
/// only switch away from `current` if another coin beats it by >= `hysteresis_pct`%.
pub fn select_best_coin(
    entries: &[ProfitEntry],
    current: Option<ExternalCoin>,
    hysteresis_pct: f64,
) -> Option<ExternalCoin> {
    if entries.is_empty() {
        return None;
    }

    let mut best = &entries[0];
    for entry in &entries[1..] {
        if entry.profit_per_day_usd() > best.profit_per_day_usd() {
            best = entry;
        }
    }

    if best.profit_per_day_usd() <= 0.0 {
        return None;
    }

    if let Some(cur) = current {
        if cur == best.coin {
            return Some(cur);
        }
        let cur_profit = entries
            .iter()
            .find(|e| e.coin == cur)
            .map(|e| e.profit_per_day_usd())
            .unwrap_or(0.0);

        if cur_profit > 0.0 {
            let improvement_pct =
                (best.profit_per_day_usd() - cur_profit) / cur_profit * 100.0;
            if improvement_pct < hysteresis_pct {
                return Some(cur);
            }
        }
    }

    Some(best.coin)
}

// ── AuxPow config ────────────────────────────────────────────────────

/// Top-level configuration for the AuxPow subsystem.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuxPowConfig {
    pub enabled: bool,
    /// Force a specific coin (overrides profit router). None = auto-select.
    pub force_coin: Option<ExternalCoin>,
    /// Fraction of pool compute devoted to external mining (0.0–1.0).
    pub allocation_pct: f64,
    /// Pool preference for endpoint selection.
    pub pool_preference: PoolPreference,
    /// Geographic region for pool selection.
    pub region: String,
    /// Profit check interval in seconds.
    pub check_interval_secs: u64,
    /// Hysteresis percentage for coin switching.
    pub hysteresis_pct: f64,
    /// Wallet address for external pool payout (BTC address for 2miners, etc.).
    pub payout_wallet: String,
    /// Worker name suffix.
    pub worker_name: String,
    /// Circuit breaker: consecutive failures before opening.
    pub circuit_breaker_threshold: u32,
    /// Circuit breaker: seconds before auto-reset.
    pub circuit_breaker_reset_secs: u64,
}

/// Default BTC wallet for external pool payouts.
/// 2miners and zpool both support BTC payout — using a BTC wallet address
/// as the Stratum username routes all mining revenue to this BTC address.
pub const DEFAULT_BTC_WALLET: &str = "bc1q9c06f4wpf638xp2280j07qgdrpz0sdms7peqkh";

impl Default for AuxPowConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            force_coin: None,
            allocation_pct: 0.25,
            pool_preference: PoolPreference::Default,
            region: "eu".to_string(),
            check_interval_secs: 300,
            hysteresis_pct: 10.0,
            payout_wallet: DEFAULT_BTC_WALLET.to_string(),
            worker_name: "zion_auxpow".to_string(),
            circuit_breaker_threshold: 10,
            circuit_breaker_reset_secs: 60,
        }
    }
}

impl AuxPowConfig {
    /// Build from environment variables. Unset vars use defaults.
    pub fn from_env() -> Self {
        let mut cfg = Self::default();

        if let Ok(v) = std::env::var("ZION_AUXPOW_ENABLED") {
            cfg.enabled = v.trim().eq_ignore_ascii_case("1")
                || v.trim().eq_ignore_ascii_case("true")
                || v.trim().eq_ignore_ascii_case("yes");
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_COIN") {
            cfg.force_coin = ExternalCoin::from_str_loose(&v);
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_ALLOCATION") {
            if let Ok(pct) = v.trim().parse::<f64>() {
                cfg.allocation_pct = pct.clamp(0.0, 1.0);
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_POOL_PREFERENCE") {
            cfg.pool_preference = PoolPreference::from_str_loose(&v);
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_REGION") {
            cfg.region = v;
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_CHECK_INTERVAL") {
            if let Ok(secs) = v.trim().parse::<u64>() {
                cfg.check_interval_secs = secs;
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_HYSTERESIS_PCT") {
            if let Ok(pct) = v.trim().parse::<f64>() {
                cfg.hysteresis_pct = pct;
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_WALLET") {
            cfg.payout_wallet = v;
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_WORKER_NAME") {
            cfg.worker_name = v;
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_CB_THRESHOLD") {
            if let Ok(t) = v.trim().parse::<u32>() {
                cfg.circuit_breaker_threshold = t;
            }
        }
        if let Ok(v) = std::env::var("ZION_AUXPOW_CB_RESET_SECS") {
            if let Ok(s) = v.trim().parse::<u64>() {
                cfg.circuit_breaker_reset_secs = s;
            }
        }

        cfg
    }
}

// ── AuxPow stats ─────────────────────────────────────────────────────

/// Runtime statistics for the AuxPow subsystem — exposed via /stats API.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuxPowStats {
    pub enabled: bool,
    pub current_coin: Option<String>,
    pub current_pool: Option<String>,
    pub current_algorithm: Option<String>,
    pub shares_submitted: u64,
    pub shares_accepted: u64,
    pub shares_rejected: u64,
    pub revenue_usd: f64,
    pub consecutive_failures: u32,
    pub circuit_open: bool,
    pub uptime_secs: u64,
    pub last_switch_ts: Option<String>,
    pub coin_switches: u64,
}

// ── Pool-side multiplexing types ─────────────────────────────────────

/// A job package prepared by the pool-side multiplexer for ZION miners.
///
/// This is the B2b interface: the ZION pool stays in charge, but the job
/// content is taken from an external pool.  Miners hash `header_bytes`
/// with the algorithm specified by `algorithm` and search nonces in
/// `[start_nonce, start_nonce + nonce_count)`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobPackage {
    pub external_coin: ExternalCoin,
    pub external_job_id: String,
    pub algorithm: String,
    pub header_bytes: Vec<u8>,
    pub target_bytes: [u8; 32],
    /// Block timestamp (Unix seconds) required by kHeavyHash/KAS PowHash.
    pub timestamp: u64,
    /// Block number (height) from the external pool notify.  Used by
    /// Ethash/KawPow miners for DAG epoch derivation (epoch = height / epoch_length).
    /// None if the external pool does not provide a block height.
    pub block_number: Option<u64>,
    /// Pool-provided extranonce1 required by Alephium's 24-byte nonce.
    pub extranonce1: Vec<u8>,
    pub start_nonce: u64,
    pub nonce_count: u64,
    /// Seed hash for RandomX (XMR) — 32 bytes.  None for non-RandomX coins.
    /// Used to initialize/reinitialize the RandomX cache/dataset.
    #[serde(default)]
    pub seed_hash: Option<Vec<u8>>,
}

/// Result of forwarding a share to the external pool.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ShareForwardResult {
    /// Hash did not meet the external target — not submitted.
    BelowTarget,
    /// External pool accepted the share.
    Accepted,
    /// External pool rejected the share.
    Rejected(String),
    /// Unknown response from the external pool.
    Unknown,
    /// No active external connection.
    NotConnected,
}

/// Simple revenue split between ZION and external coins.
///
/// Used when the operator wants a fixed percentage of miner time to be
/// spent on external revenue rather than full profit switching.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct SplitConfig {
    /// Weight for normal ZION jobs (0 = everything external).
    pub zion_weight: u32,
    /// Weight for external jobs (0 = only ZION).
    pub external_weight: u32,
}

impl Default for SplitConfig {
    fn default() -> Self {
        Self {
            zion_weight: 75,
            external_weight: 25,
        }
    }
}

// ── Tests ────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dcr_is_blake3() {
        assert_eq!(ExternalCoin::DCR.algorithm(), "blake3");
        assert!(ExternalCoin::DCR.is_blake3());
    }

    #[test]
    fn alph_is_blake3() {
        assert_eq!(ExternalCoin::ALPH.algorithm(), "blake3");
        assert!(ExternalCoin::ALPH.is_blake3());
    }

    #[test]
    fn kas_is_kheavyhash() {
        assert_eq!(ExternalCoin::KAS.algorithm(), "kheavyhash");
    }

    #[test]
    fn from_str_loose_parses() {
        assert_eq!(ExternalCoin::from_str_loose("dcr"), Some(ExternalCoin::DCR));
        assert_eq!(ExternalCoin::from_str_loose("KAS"), Some(ExternalCoin::KAS));
        assert_eq!(ExternalCoin::from_str_loose("xmr"), Some(ExternalCoin::XMR));
        assert_eq!(ExternalCoin::from_str_loose("unknown"), None);
    }

    #[test]
    fn coin_profile_default_for_dcr() {
        let p = CoinProfile::default_for(ExternalCoin::DCR);
        assert_eq!(p.ticker, "DCR");
        assert_eq!(p.algorithm, "blake3");
        assert_eq!(p.pool_host, "pool.woolypooly.com");
        assert_eq!(p.pool_port, 3152);
        assert!(p.enabled);
    }

    #[test]
    fn coin_profile_default_for_alph() {
        let p = CoinProfile::default_for(ExternalCoin::ALPH);
        assert_eq!(p.ticker, "ALPH");
        assert_eq!(p.algorithm, "blake3");
        assert_eq!(p.pool_host, "pool.woolypooly.com");
        assert_eq!(p.pool_port, 3106);
        assert!(p.enabled);
    }

    #[test]
    fn clore_pool_is_woolypooly() {
        assert_eq!(ExternalCoin::CLORE.default_pool(), "clore.woolypooly.com:3090");
    }

    #[test]
    fn kas_supports_btc_payout() {
        assert!(ExternalCoin::KAS.supports_btc_payout());
        assert!(ExternalCoin::ETC.supports_btc_payout());
        assert!(ExternalCoin::EVR.supports_btc_payout());
        assert!(!ExternalCoin::CLORE.supports_btc_payout());
        assert!(!ExternalCoin::DCR.supports_btc_payout());
        assert!(!ExternalCoin::XMR.supports_btc_payout());
    }

    #[test]
    fn zpool_coins_identified() {
        assert!(ExternalCoin::EVR.is_zpool());
        assert!(ExternalCoin::MEWC.is_zpool());
        assert!(!ExternalCoin::KAS.is_zpool());
        assert!(!ExternalCoin::ETC.is_zpool());
    }

    #[test]
    fn default_wallet_is_btc() {
        let cfg = AuxPowConfig::default();
        assert_eq!(cfg.payout_wallet, DEFAULT_BTC_WALLET);
        assert!(cfg.payout_wallet.starts_with("bc1q"));
    }

    #[test]
    fn select_best_coin_picks_highest() {
        let entries = vec![
            ProfitEntry { coin: ExternalCoin::DCR, revenue_per_day_usd: 0.45, power_cost_usd: 0.08 },
            ProfitEntry { coin: ExternalCoin::KAS, revenue_per_day_usd: 0.85, power_cost_usd: 0.10 },
        ];
        let best = select_best_coin(&entries, None, 10.0);
        assert_eq!(best, Some(ExternalCoin::KAS));
    }

    #[test]
    fn select_best_coin_hysteresis_prevents_flapping() {
        let entries = vec![
            ProfitEntry { coin: ExternalCoin::DCR, revenue_per_day_usd: 0.45, power_cost_usd: 0.08 },
            ProfitEntry { coin: ExternalCoin::KAS, revenue_per_day_usd: 0.50, power_cost_usd: 0.10 },
        ];
        // Current = DCR. KAS is only 11% better. With 15% hysteresis, stay on DCR.
        let best = select_best_coin(&entries, Some(ExternalCoin::DCR), 15.0);
        assert_eq!(best, Some(ExternalCoin::DCR));
    }

    #[test]
    fn select_best_coin_switches_when_better() {
        let entries = vec![
            ProfitEntry { coin: ExternalCoin::DCR, revenue_per_day_usd: 0.45, power_cost_usd: 0.08 },
            ProfitEntry { coin: ExternalCoin::KAS, revenue_per_day_usd: 0.85, power_cost_usd: 0.10 },
        ];
        // Current = DCR. KAS is 100% better. With 10% hysteresis, switch.
        let best = select_best_coin(&entries, Some(ExternalCoin::DCR), 10.0);
        assert_eq!(best, Some(ExternalCoin::KAS));
    }

    #[test]
    fn config_from_env_defaults() {
        // No env vars set → all defaults
        let cfg = AuxPowConfig::default();
        assert!(!cfg.enabled);
        assert_eq!(cfg.allocation_pct, 0.25);
        assert_eq!(cfg.check_interval_secs, 300);
        assert_eq!(cfg.payout_wallet, DEFAULT_BTC_WALLET);
    }

    #[test]
    fn config_from_env_parses() {
        std::env::set_var("ZION_AUXPOW_ENABLED", "1");
        std::env::set_var("ZION_AUXPOW_COIN", "dcr");
        std::env::set_var("ZION_AUXPOW_ALLOCATION", "0.30");
        std::env::set_var("ZION_AUXPOW_WALLET", "bc1qtestwallet");

        let cfg = AuxPowConfig::from_env();
        assert!(cfg.enabled);
        assert_eq!(cfg.force_coin, Some(ExternalCoin::DCR));
        assert!((cfg.allocation_pct - 0.30).abs() < 0.001);
        assert_eq!(cfg.payout_wallet, "bc1qtestwallet");

        std::env::remove_var("ZION_AUXPOW_ENABLED");
        std::env::remove_var("ZION_AUXPOW_COIN");
        std::env::remove_var("ZION_AUXPOW_ALLOCATION");
        std::env::remove_var("ZION_AUXPOW_WALLET");
    }

    #[test]
    fn fallback_estimates_nonempty() {
        let est = fallback_estimates();
        assert!(!est.is_empty());
        assert!(est.len() >= 11);
    }

    // ── New coin (KLS, ZCL, QTC, VTC, IRON, NEXA, RTM, DNX) tests ───────

    #[test]
    fn from_str_loose_parses_kls() {
        assert_eq!(ExternalCoin::from_str_loose("kls"), Some(ExternalCoin::KLS));
        assert_eq!(ExternalCoin::from_str_loose("KLS"), Some(ExternalCoin::KLS));
        assert_eq!(ExternalCoin::from_str_loose("karlsen"), Some(ExternalCoin::KLS));
    }

    #[test]
    fn from_str_loose_parses_zcl() {
        assert_eq!(ExternalCoin::from_str_loose("zcl"), Some(ExternalCoin::ZCL));
        assert_eq!(ExternalCoin::from_str_loose("ZCL"), Some(ExternalCoin::ZCL));
        assert_eq!(ExternalCoin::from_str_loose("zclassic"), Some(ExternalCoin::ZCL));
    }

    #[test]
    fn from_str_loose_parses_qtc() {
        assert_eq!(ExternalCoin::from_str_loose("qtc"), Some(ExternalCoin::QTC));
        assert_eq!(ExternalCoin::from_str_loose("QTC"), Some(ExternalCoin::QTC));
        assert_eq!(ExternalCoin::from_str_loose("qubitcoin"), Some(ExternalCoin::QTC));
    }

    #[test]
    fn from_str_loose_parses_vtc() {
        assert_eq!(ExternalCoin::from_str_loose("vtc"), Some(ExternalCoin::VTC));
        assert_eq!(ExternalCoin::from_str_loose("VTC"), Some(ExternalCoin::VTC));
        assert_eq!(ExternalCoin::from_str_loose("vertcoin"), Some(ExternalCoin::VTC));
    }

    #[test]
    fn from_str_loose_parses_iron() {
        assert_eq!(ExternalCoin::from_str_loose("iron"), Some(ExternalCoin::IRON));
        assert_eq!(ExternalCoin::from_str_loose("IRON"), Some(ExternalCoin::IRON));
        assert_eq!(ExternalCoin::from_str_loose("ironfish"), Some(ExternalCoin::IRON));
    }

    #[test]
    fn from_str_loose_parses_nexa() {
        assert_eq!(ExternalCoin::from_str_loose("nexa"), Some(ExternalCoin::NEXA));
        assert_eq!(ExternalCoin::from_str_loose("NEXA"), Some(ExternalCoin::NEXA));
    }

    #[test]
    fn from_str_loose_parses_rtm() {
        assert_eq!(ExternalCoin::from_str_loose("rtm"), Some(ExternalCoin::RTM));
        assert_eq!(ExternalCoin::from_str_loose("RTM"), Some(ExternalCoin::RTM));
        assert_eq!(ExternalCoin::from_str_loose("raptoreum"), Some(ExternalCoin::RTM));
    }

    #[test]
    fn from_str_loose_parses_dnx() {
        assert_eq!(ExternalCoin::from_str_loose("dnx"), Some(ExternalCoin::DNX));
        assert_eq!(ExternalCoin::from_str_loose("DNX"), Some(ExternalCoin::DNX));
        assert_eq!(ExternalCoin::from_str_loose("dynex"), Some(ExternalCoin::DNX));
    }

    #[test]
    fn new_coin_algorithms() {
        assert_eq!(ExternalCoin::KLS.algorithm(), "karlsenhash");
        assert_eq!(ExternalCoin::ZCL.algorithm(), "equihashzero");
        assert_eq!(ExternalCoin::QTC.algorithm(), "qhash");
        assert_eq!(ExternalCoin::VTC.algorithm(), "verthash");
        assert_eq!(ExternalCoin::IRON.algorithm(), "fishhash");
        assert_eq!(ExternalCoin::NEXA.algorithm(), "nexapow");
        assert_eq!(ExternalCoin::RTM.algorithm(), "ghostrider");
        assert_eq!(ExternalCoin::DNX.algorithm(), "dynexsolve");
    }

    #[test]
    fn new_coin_tickers() {
        assert_eq!(ExternalCoin::KLS.ticker(), "KLS");
        assert_eq!(ExternalCoin::ZCL.ticker(), "ZCL");
        assert_eq!(ExternalCoin::QTC.ticker(), "QTC");
        assert_eq!(ExternalCoin::VTC.ticker(), "VTC");
        assert_eq!(ExternalCoin::IRON.ticker(), "IRON");
        assert_eq!(ExternalCoin::NEXA.ticker(), "NEXA");
        assert_eq!(ExternalCoin::RTM.ticker(), "RTM");
        assert_eq!(ExternalCoin::DNX.ticker(), "DNX");
    }

    #[test]
    fn new_coin_is_zpool() {
        assert!(ExternalCoin::ZCL.is_zpool());
        assert!(ExternalCoin::NEXA.is_zpool());
        assert!(ExternalCoin::RTM.is_zpool());
        assert!(!ExternalCoin::KLS.is_zpool());
        assert!(!ExternalCoin::QTC.is_zpool());
        assert!(ExternalCoin::VTC.is_zpool());
        assert!(!ExternalCoin::IRON.is_zpool());
        assert!(!ExternalCoin::DNX.is_zpool());
    }

    #[test]
    fn new_coin_supports_btc_payout() {
        assert!(ExternalCoin::ZCL.supports_btc_payout());
        assert!(ExternalCoin::NEXA.supports_btc_payout());
        assert!(ExternalCoin::RTM.supports_btc_payout());
        assert!(!ExternalCoin::KLS.supports_btc_payout());
        assert!(!ExternalCoin::QTC.supports_btc_payout());
        assert!(ExternalCoin::VTC.supports_btc_payout());
        assert!(!ExternalCoin::IRON.supports_btc_payout());
        assert!(!ExternalCoin::DNX.supports_btc_payout());
    }

    #[test]
    fn new_coin_default_pools() {
        assert_eq!(ExternalCoin::KLS.default_pool(), "karlsencoin.cedric-crispin.com:4154");
        assert_eq!(ExternalCoin::ZCL.default_pool(), "equihash192.eu.mine.zpool.ca:2144");
        assert_eq!(ExternalCoin::QTC.default_pool(), "qtc.suprnova.cc:5555");
        assert_eq!(ExternalCoin::VTC.default_pool(), "verthash.eu.mine.zpool.ca:4533");
        assert_eq!(ExternalCoin::IRON.default_pool(), "fr.grandpool.io:2027");
        assert_eq!(ExternalCoin::NEXA.default_pool(), "nexa.2miners.com:5050");
        assert_eq!(ExternalCoin::RTM.default_pool(), "ghostrider.eu.mine.zpool.ca:5354");
        assert_eq!(ExternalCoin::DNX.default_pool(), "pool.deepminerz.com:3333");
    }

    #[test]
    fn new_coin_all_array_complete() {
        let all = ExternalCoin::all();
        // 16 original + 8 new + 4 NiceHash + 1 Keryx = 29
        assert_eq!(all.len(), 29);
        assert!(all.contains(&ExternalCoin::KLS));
        assert!(all.contains(&ExternalCoin::ZCL));
        assert!(all.contains(&ExternalCoin::QTC));
        assert!(all.contains(&ExternalCoin::VTC));
        assert!(all.contains(&ExternalCoin::IRON));
        assert!(all.contains(&ExternalCoin::NEXA));
        assert!(all.contains(&ExternalCoin::RTM));
        assert!(all.contains(&ExternalCoin::DNX));
        assert!(all.contains(&ExternalCoin::CKB));
        assert!(all.contains(&ExternalCoin::CFX));
        assert!(all.contains(&ExternalCoin::ZEC));
        assert!(all.contains(&ExternalCoin::PHX));
    }
}
