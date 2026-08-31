//! Profit routing data for AuxPoW merged mining.
//!
//! `ExternalCoin` and `CoinProfile` are canonical here so `zion-miner`
//! (and any future consumer) uses the same definitions as the profit layer.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use zion_l1_types::Amount;

/// Mining device category for a coin / algorithm.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize)]
pub enum Device {
    Cpu,
    Gpu,
    Both,
}

impl Device {
    pub fn is_compatible_with(&self, required: Device) -> bool {
        required == Device::Both || *self == required || *self == Device::Both
    }
}

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

#[derive(
    Clone, Copy, Debug, Eq, PartialEq, Hash, Default, serde::Serialize, serde::Deserialize,
)]
pub enum ExternalCoin {
    #[default]
    Kaspa,
    Alephium,
    Decred,
    Vertcoin,
    Ravencoin,
    Monero,
    EpicCash,
    Zano,
    Meowcoin,
    Clore,
    Flux,
    Neoxa,
    EthereumClassic,
    Bitcoin,
    Verus,
    Ergo,
    Evrmore,
    Pearl,
    Quai,
    Beam,
    Karlsen,
    Zclassic,
    Qubitcoin,
    IronFish,
    Nexa,
    Raptoreum,
    Dynex,
    Nervos,
    Conflux,
    Zcash,
    PhoenixCoin,
    Keryx,
}

impl ExternalCoin {
    pub const ALL: &[ExternalCoin] = &[
        ExternalCoin::Kaspa,
        ExternalCoin::Alephium,
        ExternalCoin::Decred,
        ExternalCoin::Vertcoin,
        ExternalCoin::Ravencoin,
        ExternalCoin::Monero,
        ExternalCoin::EpicCash,
        ExternalCoin::Zano,
        ExternalCoin::Meowcoin,
        ExternalCoin::Clore,
        ExternalCoin::Flux,
        ExternalCoin::Neoxa,
        ExternalCoin::EthereumClassic,
        ExternalCoin::Bitcoin,
        ExternalCoin::Verus,
        ExternalCoin::Ergo,
        ExternalCoin::Evrmore,
        ExternalCoin::Pearl,
        ExternalCoin::Quai,
        ExternalCoin::Beam,
        ExternalCoin::Karlsen,
        ExternalCoin::Zclassic,
        ExternalCoin::Qubitcoin,
        ExternalCoin::IronFish,
        ExternalCoin::Nexa,
        ExternalCoin::Raptoreum,
        ExternalCoin::Dynex,
        ExternalCoin::Nervos,
        ExternalCoin::Conflux,
        ExternalCoin::Zcash,
        ExternalCoin::PhoenixCoin,
        ExternalCoin::Keryx,
    ];

    pub fn all() -> &'static [ExternalCoin] {
        Self::ALL
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            ExternalCoin::Kaspa => "KAS",
            ExternalCoin::Alephium => "ALPH",
            ExternalCoin::Decred => "DCR",
            ExternalCoin::Vertcoin => "VTC",
            ExternalCoin::Ravencoin => "RVN",
            ExternalCoin::Monero => "XMR",
            ExternalCoin::EpicCash => "EPIC",
            ExternalCoin::Zano => "ZANO",
            ExternalCoin::Meowcoin => "MEWC",
            ExternalCoin::Clore => "CLORE",
            ExternalCoin::Flux => "FLUX",
            ExternalCoin::Neoxa => "NEOX",
            ExternalCoin::EthereumClassic => "ETC",
            ExternalCoin::Bitcoin => "BTC",
            ExternalCoin::Verus => "VRSC",
            ExternalCoin::Ergo => "ERG",
            ExternalCoin::Evrmore => "EVR",
            ExternalCoin::Pearl => "PRL",
            ExternalCoin::Quai => "QUAI",
            ExternalCoin::Beam => "BEAM",
            ExternalCoin::Karlsen => "KLS",
            ExternalCoin::Zclassic => "ZCL",
            ExternalCoin::Qubitcoin => "QTC",
            ExternalCoin::IronFish => "IRON",
            ExternalCoin::Nexa => "NEXA",
            ExternalCoin::Raptoreum => "RTM",
            ExternalCoin::Dynex => "DNX",
            ExternalCoin::Nervos => "CKB",
            ExternalCoin::Conflux => "CFX",
            ExternalCoin::Zcash => "ZEC",
            ExternalCoin::PhoenixCoin => "PHX",
            ExternalCoin::Keryx => "KRX",
        }
    }

    /// Parse a coin from its ticker string (case-insensitive).
    pub fn from_ticker(ticker: &str) -> Option<ExternalCoin> {
        let upper = ticker.trim().to_ascii_uppercase();
        Self::ALL.iter().copied().find(|c| c.as_str() == upper)
    }

    pub fn algorithm(&self) -> &'static str {
        match self {
            ExternalCoin::Kaspa => "kheavyhash",
            ExternalCoin::Alephium => "blake3_alph",
            ExternalCoin::Decred => "blake3_dcr",
            ExternalCoin::Vertcoin => "verthash",
            ExternalCoin::Ravencoin => "kawpow",
            ExternalCoin::Monero => "randomx",
            ExternalCoin::EpicCash => "progpow",
            ExternalCoin::Zano => "progpow_zano",
            ExternalCoin::Meowcoin => "meowpow",
            ExternalCoin::Clore => "kawpow",
            ExternalCoin::Flux => "zelhash",
            ExternalCoin::Neoxa => "kawpow",
            ExternalCoin::EthereumClassic => "etchash",
            ExternalCoin::Bitcoin => "sha256d",
            ExternalCoin::Verus => "verushash",
            ExternalCoin::Ergo => "autolykos",
            ExternalCoin::Evrmore => "evrprogpow",
            ExternalCoin::Pearl => "pearlhash",
            ExternalCoin::Quai => "kawpow",
            ExternalCoin::Beam => "beamhash",
            ExternalCoin::Karlsen => "karlsenhash",
            ExternalCoin::Zclassic => "equihashzero",
            ExternalCoin::Qubitcoin => "qhash",
            ExternalCoin::IronFish => "fishhash",
            ExternalCoin::Nexa => "nexapow",
            ExternalCoin::Raptoreum => "ghostrider",
            ExternalCoin::Dynex => "dynexsolve",
            ExternalCoin::Nervos => "eaglesong",
            ExternalCoin::Conflux => "octopus",
            ExternalCoin::Zcash => "equihash",
            ExternalCoin::PhoenixCoin => "neoscrypt",
            ExternalCoin::Keryx => "keryxhash",
        }
    }

    pub fn ticker(&self) -> &'static str {
        self.as_str()
    }

    pub fn is_blake3(&self) -> bool {
        matches!(self, ExternalCoin::Decred | ExternalCoin::Alephium)
    }

    pub fn is_cpu(&self) -> bool {
        matches!(
            self,
            ExternalCoin::Monero | ExternalCoin::Verus | ExternalCoin::Raptoreum
        )
    }

    pub fn is_gpu(&self) -> bool {
        !self.is_cpu()
    }

    pub fn dag_size(&self) -> Option<u64> {
        match self {
            ExternalCoin::Ravencoin => Some(4_294_967_296),
            ExternalCoin::EthereumClassic => Some(2_684_354_560),
            ExternalCoin::Evrmore => Some(2_684_354_560),
            ExternalCoin::Meowcoin => Some(4_294_967_296),
            ExternalCoin::Flux => Some(6_000_000_000),
            ExternalCoin::Clore => Some(4_294_967_296),
            ExternalCoin::EpicCash => Some(2_684_354_560),
            ExternalCoin::Zano => Some(2_684_354_560),
            ExternalCoin::Quai => Some(4_294_967_296),
            ExternalCoin::Beam => Some(2_147_483_648),
            ExternalCoin::Zclassic => Some(1_073_741_824),
            ExternalCoin::Vertcoin => Some(1_073_741_824),
            ExternalCoin::IronFish => Some(4_800_000_000),
            ExternalCoin::Nexa => Some(5_000_000_000),
            ExternalCoin::Conflux => Some(4_294_967_296),
            ExternalCoin::Zcash => Some(1_073_741_824),
            _ => None,
        }
    }

    pub fn fits_vram(&self, vram_bytes: u64) -> bool {
        match self.dag_size() {
            None => true,
            Some(dag) => dag + 512_000_000 < vram_bytes,
        }
    }

    pub fn cpu_compatible(&self, has_aes: bool, _has_avx2: bool) -> bool {
        match self {
            ExternalCoin::Verus | ExternalCoin::Raptoreum => true,
            ExternalCoin::Monero => has_aes,
            _ => false,
        }
    }

    pub fn gpu_kernel_available(&self, backend: &str) -> bool {
        match backend {
            "opencl" => matches!(
                self,
                ExternalCoin::Decred
                    | ExternalCoin::Alephium
                    | ExternalCoin::Kaspa
                    | ExternalCoin::Ergo
                    | ExternalCoin::Ravencoin
                    | ExternalCoin::Clore
                    | ExternalCoin::Quai
                    | ExternalCoin::Evrmore
                    | ExternalCoin::Meowcoin
                    | ExternalCoin::EthereumClassic
                    | ExternalCoin::Flux
                    | ExternalCoin::EpicCash
                    | ExternalCoin::Zano
                    | ExternalCoin::Pearl
                    | ExternalCoin::Beam
                    | ExternalCoin::Karlsen
                    | ExternalCoin::IronFish
                    | ExternalCoin::Vertcoin
                    | ExternalCoin::Zclassic
                    | ExternalCoin::Nexa
                    | ExternalCoin::Qubitcoin
                    | ExternalCoin::Dynex
                    | ExternalCoin::Nervos
                    | ExternalCoin::Conflux
                    | ExternalCoin::Zcash
                    | ExternalCoin::PhoenixCoin
                    | ExternalCoin::Keryx
            ),
            "cuda" => matches!(
                self,
                ExternalCoin::Decred
                    | ExternalCoin::Alephium
                    | ExternalCoin::Kaspa
                    | ExternalCoin::Ergo
                    | ExternalCoin::Ravencoin
                    | ExternalCoin::Clore
                    | ExternalCoin::Quai
                    | ExternalCoin::EthereumClassic
                    | ExternalCoin::Evrmore
                    | ExternalCoin::Meowcoin
                    | ExternalCoin::Flux
                    | ExternalCoin::EpicCash
                    | ExternalCoin::Zano
            ),
            "metal" => matches!(
                self,
                ExternalCoin::Decred | ExternalCoin::Alephium | ExternalCoin::Kaspa
            ),
            _ => false,
        }
    }

    pub fn estimated_gpu_power_watts(&self) -> f64 {
        match self {
            ExternalCoin::Kaspa => 200.0,
            ExternalCoin::Alephium | ExternalCoin::Decred => 180.0,
            ExternalCoin::Ergo => 160.0,
            ExternalCoin::Ravencoin | ExternalCoin::Clore | ExternalCoin::Quai => 220.0,
            ExternalCoin::EthereumClassic | ExternalCoin::Evrmore | ExternalCoin::Meowcoin => 210.0,
            ExternalCoin::Flux => 200.0,
            ExternalCoin::Pearl => 190.0,
            ExternalCoin::EpicCash => 210.0,
            ExternalCoin::Zano => 210.0,
            ExternalCoin::Beam => 180.0,
            ExternalCoin::Karlsen => 190.0,
            ExternalCoin::Zclassic | ExternalCoin::Qubitcoin | ExternalCoin::Vertcoin => 170.0,
            ExternalCoin::IronFish => 220.0,
            ExternalCoin::Nexa => 210.0,
            ExternalCoin::Dynex => 150.0,
            ExternalCoin::Nervos => 170.0,
            ExternalCoin::Conflux => 210.0,
            ExternalCoin::Zcash => 170.0,
            ExternalCoin::PhoenixCoin => 180.0,
            ExternalCoin::Keryx => 180.0,
            ExternalCoin::Bitcoin => 250.0,
            ExternalCoin::Neoxa => 170.0,
            _ => 0.0,
        }
    }

    pub fn estimated_cpu_power_watts(&self) -> f64 {
        match self {
            ExternalCoin::Monero => 85.0,
            ExternalCoin::Verus => 65.0,
            ExternalCoin::Raptoreum => 90.0,
            _ => 0.0,
        }
    }

    pub fn from_str_loose(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "dcr" | "decred" | "blake3-dcr" | "blake3dcr" => Some(Self::Decred),
            "alph" | "alephium" | "blake3-alph" | "blake3alph" => Some(Self::Alephium),
            "kas" | "kaspa" | "kheavyhash" => Some(Self::Kaspa),
            "erg" | "ergo" | "autolykos" => Some(Self::Ergo),
            "rvn" | "ravencoin" | "kawpow" => Some(Self::Ravencoin),
            "etc" | "ethereum-classic" | "ethash" | "etchash" => Some(Self::EthereumClassic),
            "evr" | "evrmore" | "evrprogpow" => Some(Self::Evrmore),
            "mewc" | "meowcoin" | "meowpow" => Some(Self::Meowcoin),
            "flux" | "zelhash" => Some(Self::Flux),
            "clore" | "clore.ai" => Some(Self::Clore),
            "xmr" | "monero" | "randomx" => Some(Self::Monero),
            "vrsc" | "verus" | "verushash" => Some(Self::Verus),
            "prl" | "pearl" | "pearlhash" => Some(Self::Pearl),
            "epic" | "epiccash" | "progpow" => Some(Self::EpicCash),
            "zano" | "progpowz" => Some(Self::Zano),
            "quai" | "quainetwork" => Some(Self::Quai),
            "beam" | "beamhash" => Some(Self::Beam),
            "kls" | "karlsen" | "karlsenhash" => Some(Self::Karlsen),
            "zcl" | "zclassic" | "equihashzero" => Some(Self::Zclassic),
            "qtc" | "qubitcoin" | "qhash" => Some(Self::Qubitcoin),
            "vtc" | "vertcoin" | "verthash" => Some(Self::Vertcoin),
            "iron" | "ironfish" | "fishhash" => Some(Self::IronFish),
            "nexa" | "nexapow" => Some(Self::Nexa),
            "rtm" | "raptoreum" | "ghostrider" => Some(Self::Raptoreum),
            "dnx" | "dynex" | "dynexsolve" => Some(Self::Dynex),
            "ckb" | "nervos" | "nervos-network" | "eaglesong" => Some(Self::Nervos),
            "cfx" | "conflux" | "octopus" => Some(Self::Conflux),
            "zec" | "zcash" | "equihash" => Some(Self::Zcash),
            "phx" | "phoenixcoin" | "neoscrypt" => Some(Self::PhoenixCoin),
            "krx" | "keryx" | "keryxhash" => Some(Self::Keryx),
            "neox" | "neoxa" => Some(Self::Neoxa),
            "btc" | "bitcoin" | "sha256d" => Some(Self::Bitcoin),
            _ => None,
        }
    }

    pub fn default_pool(&self) -> &'static str {
        match self {
            ExternalCoin::Decred => "pool.woolypooly.com:3152",
            ExternalCoin::Alephium => "pool.woolypooly.com:3106",
            ExternalCoin::Kaspa => "kas.2miners.com:2020",
            ExternalCoin::Ergo => "erg.2miners.com:8888",
            ExternalCoin::Ravencoin => "rvn.2miners.com:6060",
            ExternalCoin::EthereumClassic => "etc.2miners.com:1010",
            ExternalCoin::Evrmore => "evrprogpow.eu.mine.zpool.ca:1330",
            ExternalCoin::Meowcoin => "meowpow.eu.mine.zpool.ca:1327",
            ExternalCoin::Flux => "flux.woolypooly.com:3000",
            ExternalCoin::Clore => "clore.woolypooly.com:3090",
            ExternalCoin::Monero => "gulf.moneroocean.stream:10001",
            ExternalCoin::Verus => "eu.luckpool.net:3956",
            ExternalCoin::Pearl => "us2.alphapool.tech:5566",
            ExternalCoin::EpicCash => "de.epicmine.io:3334",
            ExternalCoin::Zano => "de.zano.herominers.com:1110",
            ExternalCoin::Quai => "quai.2miners.com:4848",
            ExternalCoin::Beam => "beam.2miners.com:5252",
            ExternalCoin::Karlsen => "karlsencoin.cedric-crispin.com:4154",
            ExternalCoin::Zclassic => "equihash192.eu.mine.zpool.ca:2144",
            ExternalCoin::Qubitcoin => "qtc.suprnova.cc:5555",
            ExternalCoin::Vertcoin => "verthash.eu.mine.zpool.ca:4533",
            ExternalCoin::IronFish => "fr.grandpool.io:2027",
            ExternalCoin::Nexa => "nexa.2miners.com:5050",
            ExternalCoin::Raptoreum => "ghostrider.eu.mine.zpool.ca:5354",
            ExternalCoin::Dynex => "pool.deepminerz.com:3333",
            ExternalCoin::Nervos => "ckb.2miners.com:6464",
            ExternalCoin::Conflux => "cfx.2miners.com:6565",
            ExternalCoin::Zcash => "zec.2miners.com:7070",
            ExternalCoin::PhoenixCoin => "neoscrypt.eu.mine.zpool.ca:4233",
            ExternalCoin::Keryx => "keryxhash.eu.mine.zpool.ca:4233",
            ExternalCoin::Neoxa => "neox.2miners.com:4040",
            // Bitcoin SHA-256d merge-mining is not via standard stratum pools;
            // leave empty so auxpow_runtime skips it until a real endpoint is configured.
            ExternalCoin::Bitcoin => "",
        }
    }

    pub fn nicehash_pool(&self, region: &str) -> Option<String> {
        let algo: &str = match self {
            ExternalCoin::EthereumClassic => "etchash",
            ExternalCoin::Ravencoin | ExternalCoin::Quai | ExternalCoin::Clore => "kawpow",
            ExternalCoin::Ergo => "autolykos",
            ExternalCoin::Kaspa => "kheavyhash",
            ExternalCoin::Verus => "verushash",
            ExternalCoin::Nexa => "nexapow",
            ExternalCoin::Beam => "beamv3",
            ExternalCoin::IronFish => "fishhash",
            ExternalCoin::Alephium => "alephium",
            ExternalCoin::Zclassic => "equihash192",
            ExternalCoin::Nervos => "eaglesong",
            ExternalCoin::Conflux => "octopus",
            ExternalCoin::Zcash => "equihash",
            ExternalCoin::PhoenixCoin => "neoscrypt",
            ExternalCoin::Keryx => "keryxhash",
            _ => return None,
        };
        let _ = region;
        Some(format!("{}.auto.nicehash.com:9200", algo))
    }

    pub fn herominers_pool(&self, region: &str) -> Option<String> {
        let (subdomain, port): (&str, u16) = match self {
            ExternalCoin::EthereumClassic => ("etc", 1150),
            ExternalCoin::Kaspa => ("kaspa", 1206),
            ExternalCoin::Alephium => ("alephium", 1220),
            ExternalCoin::Ergo => ("ergo", 1180),
            ExternalCoin::Ravencoin => ("ravencoin", 1140),
            ExternalCoin::IronFish => ("ironfish", 1145),
            ExternalCoin::Dynex => ("dynex", 1030),
            ExternalCoin::Nervos => ("nervos", 1160),
            ExternalCoin::Conflux => ("conflux", 1170),
            ExternalCoin::Zcash => ("zcash", 1156),
            ExternalCoin::Zano => ("zano", 1110),
            _ => return None,
        };
        let hm_region = match region.to_ascii_lowercase().as_str() {
            "eu" => "de",
            "na" | "us" => "us",
            "hk" | "sg" | "asia" => "hk",
            _ => "de",
        };
        Some(format!(
            "{}.{}.herominers.com:{}",
            hm_region, subdomain, port
        ))
    }

    pub fn zpool_pool(&self, region: &str) -> Option<String> {
        let (algo, port): (&str, u16) = match self {
            ExternalCoin::Evrmore => ("evrprogpow", 1330),
            ExternalCoin::Meowcoin => ("meowpow", 1327),
            ExternalCoin::Zclassic => ("equihash192", 2144),
            ExternalCoin::Raptoreum => ("ghostrider", 5354),
            ExternalCoin::PhoenixCoin => ("neoscrypt", 4233),
            ExternalCoin::Keryx => ("keryxhash", 4233),
            ExternalCoin::Zcash => ("equihash", 1080),
            _ => return None,
        };
        let zp_region = match region.to_ascii_lowercase().as_str() {
            "na" | "us" => "na",
            _ => "eu",
        };
        Some(format!("{}.{}.mine.zpool.ca:{}", algo, zp_region, port))
    }

    pub fn best_pool(&self, preference: PoolPreference, region: &str) -> String {
        match preference {
            PoolPreference::NiceHash => {
                if let Some(url) = self.nicehash_pool(region) {
                    return url;
                }
                if let Some(url) = self.herominers_pool(region) {
                    return url;
                }
                if let Some(url) = self.zpool_pool(region) {
                    return url;
                }
                self.default_pool().to_string()
            }
            PoolPreference::HeroMiners => {
                if let Some(url) = self.herominers_pool(region) {
                    return url;
                }
                if let Some(url) = self.zpool_pool(region) {
                    return url;
                }
                self.default_pool().to_string()
            }
            PoolPreference::ZPool => {
                if let Some(url) = self.zpool_pool(region) {
                    return url;
                }
                self.default_pool().to_string()
            }
            PoolPreference::Default => self.default_pool().to_string(),
        }
    }

    pub fn blake3_coins() -> &'static [ExternalCoin] {
        &[ExternalCoin::Decred, ExternalCoin::Alephium]
    }
}

impl fmt::Display for ExternalCoin {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for ExternalCoin {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.to_uppercase();
        for coin in Self::ALL {
            if coin.as_str() == s {
                return Ok(*coin);
            }
        }
        if let Some(coin) = Self::from_str_loose(s.as_str()) {
            return Ok(coin);
        }
        Err(format!("unknown external coin: {s}"))
    }
}

/// Static mining profile for an external coin.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CoinProfile {
    pub coin: ExternalCoin,
    /// Normalized hashrate unit for this algorithm (MH/s).
    pub hashrate_unit_mhs: f64,
    /// USD value of one unit of `hashrate_unit_mhs` over 24h.
    /// This is a placeholder for live profit estimates; it can be updated from an oracle.
    pub profit_per_unit_usd: f64,
    pub fee_bps: u16,
    pub enabled: bool,
    /// If true, the coin is excluded from profit switching.
    pub disabled: bool,
    /// Optional human-readable reason the coin is disabled.
    pub disabled_reason: Option<String>,
    pub stratum_urls: Vec<String>,
    /// Block reward in the coin's smallest unit.
    pub block_reward: Amount,
    /// Approximate network difficulty at 1 TH/s normalized to the unit.
    pub network_difficulty: f64,
    /// Device category this coin is mined with.
    pub device: Device,
    /// Worker name for stratum authorization.
    pub worker_name: String,
    /// Password for stratum authorization.
    pub password: String,
}

impl CoinProfile {
    /// Estimated 24h USD profit for `hashrate` units of this algorithm.
    pub fn estimate_profit(&self, hashrate: f64) -> f64 {
        if self.fee_bps >= 10_000 || !self.enabled || self.disabled {
            return 0.0;
        }
        let gross = hashrate * self.profit_per_unit_usd;
        gross * (1.0 - self.fee_bps as f64 / 10_000.0)
    }

    /// Return the coin's ticker symbol (delegates to `ExternalCoin::as_str`).
    pub fn ticker(&self) -> &'static str {
        self.coin.as_str()
    }

    /// Return the first stratum URL for this coin, or empty string if none.
    pub fn pool_address(&self) -> String {
        self.stratum_urls.first().cloned().unwrap_or_default()
    }

    /// Mark this profile as disabled with an optional reason.
    pub fn with_disabled(mut self, reason: impl Into<String>) -> Self {
        self.disabled = true;
        self.disabled_reason = Some(reason.into());
        self.enabled = false;
        self
    }

    /// Override the default stratum pool URL for this coin. Useful for
    /// testing, failover, or region-specific endpoints.
    pub fn with_pool_address(mut self, url: impl Into<String>) -> Self {
        let url = url.into();
        let url = if url.starts_with("stratum+") || url.starts_with("stratum://") {
            url
        } else {
            format!("stratum+tcp://{}", url)
        };
        self.stratum_urls = vec![url];
        self
    }

    /// Placeholder defaults for Mainnet Alpha. These are not live quotes.
    pub fn defaults() -> Vec<Self> {
        vec![
            Self::new(ExternalCoin::Kaspa, 1000.0, 0.05, Device::Gpu),
            Self::new(ExternalCoin::Alephium, 1000.0, 0.03, Device::Gpu),
            Self::new(ExternalCoin::Ravencoin, 1000.0, 0.015, Device::Gpu),
            Self::new(ExternalCoin::Zano, 1000.0, 0.012, Device::Gpu),
            Self::new(ExternalCoin::Flux, 1000.0, 0.011, Device::Gpu),
            Self::new(ExternalCoin::Monero, 1000.0, 0.025, Device::Cpu),
            Self::new(ExternalCoin::EpicCash, 1000.0, 0.020, Device::Both),
            Self::new(ExternalCoin::Verus, 1000.0, 0.018, Device::Cpu),
            Self::new(ExternalCoin::Decred, 1000.0, 0.02, Device::Gpu),
            Self::new(ExternalCoin::Vertcoin, 1000.0, 0.01, Device::Gpu),
            // Pearl is intentionally disabled until the pool endpoint and kernel
            // are fully verified (see AGENTS.md ExternalCoin disabled_reason convention).
            Self::new(ExternalCoin::Pearl, 1000.0, 0.01, Device::Gpu)
                .with_disabled("not production-ready / placeholder pool and kernel"),
        ]
    }

    /// Find the default profile for a specific coin.
    ///
    /// Falls back to a generic profile for coins not in `defaults()`,
    /// inferring the device category from `ExternalCoin::is_cpu()`.
    pub fn for_coin(coin: ExternalCoin) -> Self {
        Self::defaults()
            .into_iter()
            .find(|p| p.coin == coin)
            .unwrap_or_else(|| {
                let device = if coin.is_cpu() {
                    Device::Cpu
                } else {
                    Device::Gpu
                };
                Self::new(coin, 1000.0, 0.01, device)
            })
    }

    /// Return a profile for every known external coin.
    pub fn all() -> Vec<Self> {
        ExternalCoin::ALL
            .iter()
            .copied()
            .map(Self::for_coin)
            .collect()
    }

    fn new(
        coin: ExternalCoin,
        hashrate_unit_mhs: f64,
        profit_per_unit_usd: f64,
        device: Device,
    ) -> Self {
        Self {
            coin,
            hashrate_unit_mhs,
            profit_per_unit_usd,
            fee_bps: 100,
            enabled: true,
            disabled: false,
            disabled_reason: None,
            stratum_urls: vec![default_pool_url(&coin)],
            block_reward: Amount::new(0),
            network_difficulty: 1.0,
            device,
            worker_name: String::new(),
            password: String::new(),
        }
    }
}

/// Default Stratum pool URL (with `stratum+tcp://` prefix) for a coin.
/// Wraps `ExternalCoin::default_pool()`; coins with no known pool (empty
/// string) get a placeholder so the profile is still constructable —
/// `auxpow_runtime` skips placeholder endpoints.
fn default_pool_url(coin: &ExternalCoin) -> String {
    let host_port = coin.default_pool();
    if host_port.is_empty() {
        format!(
            "stratum+tcp://{}.pool.example:3333",
            coin.as_str().to_lowercase()
        )
    } else if host_port.starts_with("stratum+") {
        host_port.to_string()
    } else {
        format!("stratum+tcp://{}", host_port)
    }
}

/// One profit entry produced for a specific rig configuration.
#[derive(Clone, Debug)]
pub struct ProfitEntry {
    pub coin: ExternalCoin,
    pub device: Device,
    pub hashrate: f64,
    pub profit_usd_per_day: f64,
    /// Whether the coin is disabled and should be skipped by the router.
    pub is_disabled: bool,
}

impl ProfitEntry {
    pub fn from_profile(profile: &CoinProfile, hashrate: f64) -> Self {
        Self {
            coin: profile.coin,
            device: profile.device,
            hashrate,
            profit_usd_per_day: profile.estimate_profit(hashrate),
            is_disabled: profile.disabled,
        }
    }
}

/// Profit-switching router for AuxPoW mining.
#[derive(Clone, Debug, Default)]
pub struct ProfitRouter {
    entries: Vec<ProfitEntry>,
}

impl ProfitRouter {
    pub fn new(entries: Vec<ProfitEntry>) -> Self {
        Self { entries }
    }

    pub fn update(&mut self, entries: Vec<ProfitEntry>) {
        self.entries = entries;
    }

    /// Return placeholder default estimates for all coins (V3 compatibility).
    ///
    /// In V3 this was `fetch_live_profit_estimates()` which called an oracle.
    /// V31 returns hardcoded placeholder estimates until a live oracle is wired.
    pub fn default_estimates() -> Vec<ProfitEntry> {
        CoinProfile::defaults()
            .into_iter()
            .map(|p| ProfitEntry::from_profile(&p, 1.0))
            .collect()
    }

    /// Return the most profitable active coin, if any.
    pub fn best(&self) -> Option<&ProfitEntry> {
        self.entries
            .iter()
            .filter(|e| !e.is_disabled)
            .max_by(|a, b| a.profit_usd_per_day.total_cmp(&b.profit_usd_per_day))
    }

    /// Return the most profitable active coin compatible with `device`.
    pub fn best_for(&self, device: Device) -> Option<&ProfitEntry> {
        self.entries
            .iter()
            .filter(|e| !e.is_disabled && e.device.is_compatible_with(device))
            .max_by(|a, b| a.profit_usd_per_day.total_cmp(&b.profit_usd_per_day))
    }

    pub fn entries(&self) -> &[ProfitEntry] {
        &self.entries
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coin_from_str() {
        assert_eq!("KAS".parse::<ExternalCoin>().unwrap(), ExternalCoin::Kaspa);
        assert!("unknown".parse::<ExternalCoin>().is_err());
    }

    #[test]
    fn router_picks_highest_profit() {
        let profiles = CoinProfile::defaults();
        let entries: Vec<_> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, 100.0))
            .collect();
        let router = ProfitRouter::new(entries);
        let best = router.best().expect("has best");
        assert_eq!(best.coin, ExternalCoin::Kaspa); // highest profit_per_unit in defaults
    }

    #[test]
    fn router_filters_by_device() {
        let profiles = CoinProfile::defaults();
        let entries: Vec<_> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, 100.0))
            .collect();
        let router = ProfitRouter::new(entries);
        let gpu = router.best_for(Device::Gpu).expect("has gpu");
        let cpu = router.best_for(Device::Cpu).expect("has cpu");
        assert_eq!(gpu.coin, ExternalCoin::Kaspa);
        assert_eq!(cpu.coin, ExternalCoin::Monero);
    }

    #[test]
    fn router_skips_disabled_coin() {
        let mut profiles = CoinProfile::defaults();
        profiles[0] = profiles[0].clone().with_disabled("test");
        let entries: Vec<_> = profiles
            .iter()
            .map(|p| ProfitEntry::from_profile(p, 100.0))
            .collect();
        let router = ProfitRouter::new(entries);
        let best = router.best().expect("has best");
        assert_ne!(best.coin, ExternalCoin::Kaspa);
    }
}
