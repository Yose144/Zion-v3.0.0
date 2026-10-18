//! Coin legs — unified job-id routing, leg descriptors, status snapshots.
//!
//! F1 of `docs/3.2/ZION-POOL-NG-PLAN.md`: the pool already runs several
//! coin legs (ZION native, QTC native+upstream, PRL native+upstream,
//! bridged auxpow coins), but each dispatch point re-implemented its own
//! prefix check. This module is the single source of truth for
//!
//!   * which job-id namespace belongs to which leg (`route_job_id`), and
//!   * what every leg is (`LegDescriptor` registry + `LegStatus` snapshot).
//!
//! Behavior is unchanged — routing follows exactly the precedence the
//! submit paths used before.

use serde::Serialize;
use std::str::FromStr;
use zion_cosmic_harmony::ExternalCoin;

// ── Job-id namespaces ───────────────────────────────────────────────
//
// Served job ids are namespaced by prefix *except* Pearl-native and
// upstream auxpow jobs, whose ids are opaque (resolved by per-leg job
// maps). The constants the legs mint stay owned by their modules; we
// re-export them here so routing never duplicates the literals.

/// `qtun:` — native Quantus leg (own quantus-node over QUIC).
pub const QTC_NATIVE_JOB_PREFIX: &str = crate::qtc_native::NATIVE_JOB_PREFIX;

/// `prlu:` — Pearl upstream bridge (LuckyPool).
pub const PRL_UPSTREAM_JOB_PREFIX: &str = crate::pearl_upstream::UPSTREAM_JOB_PREFIX;

/// `PRL:` — fingerprint-only prefix for Pearl-native served jobs in
/// `StratumServer::all_external_job_ids`. Never submitted over the wire.
pub const PRL_FINGERPRINT_PREFIX: &str = "PRL:";

/// `zion_` — ZION native jobs served to stratum-v1 sessions.
pub const ZION_V1_JOB_PREFIX: &str = "zion_";

/// `v3_` — ZION native jobs served to V3-protocol sessions.
pub const ZION_V3_JOB_PREFIX: &str = "v3_";

/// `aux_` — legacy auxpow namespace `aux_<COIN>_<id>` (V1 submit compat).
pub const AUXPOW_JOB_PREFIX: &str = "aux_";

/// Which leg a served/submitted job id belongs to.
///
/// `route_job_id` classifies by *prefix* only. Opaque ids (Pearl-native
/// served ids, raw upstream job ids) resolve to [`JobRoute::Unresolved`]
/// and callers keep doing per-leg map lookups — identical to the
/// pre-F1 code.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JobRoute {
    /// `zion_*` or the legacy `j*` quirk — ZION native template job.
    ZionV1,
    /// `v3_*` — ZION native job served over the V3 protocol.
    ZionV3,
    /// `qtun:*` — Quantus native leg (own node).
    QtcNative,
    /// `prlu:*` — Pearl upstream leg.
    PearlUpstream,
    /// `aux_<COIN>_*` — bridged auxpow job (legacy V1 namespace).
    Auxpow(ExternalCoin),
    /// Pearl-native job — never produced by `route_job_id` (opaque ids);
    /// exists so lookup-resolved routes share one enum.
    PearlNative,
    /// No prefix matched — resolve through per-coin job maps.
    Unresolved,
}

/// Classify a job id by its pool-side namespace.
///
/// Precedence mirrors the historical submit paths: the dedicated leg
/// prefixes first (`qtun:`/`prlu:`), then the ZION namespaces, then the
/// legacy `aux_` namespace. Note the preserved `j*` quirk — any id
/// starting with `j` counts as a V1 ZION job (V3 pool wire format).
pub fn route_job_id(job_id: &str) -> JobRoute {
    if job_id.starts_with(QTC_NATIVE_JOB_PREFIX) {
        JobRoute::QtcNative
    } else if job_id.starts_with(PRL_UPSTREAM_JOB_PREFIX) {
        JobRoute::PearlUpstream
    } else if job_id.starts_with(ZION_V1_JOB_PREFIX) || job_id.starts_with('j') {
        JobRoute::ZionV1
    } else if job_id.starts_with(ZION_V3_JOB_PREFIX) {
        JobRoute::ZionV3
    } else if job_id.starts_with(AUXPOW_JOB_PREFIX) {
        JobRoute::Auxpow(parse_aux_coin(job_id))
    } else {
        JobRoute::Unresolved
    }
}

/// Coin inside an `aux_<COIN>_<id>` job id. Falls back to `Bitcoin` for
/// malformed ids — preserved verbatim from the pre-F1 `stratum.rs`.
pub fn parse_aux_coin(job_id: &str) -> ExternalCoin {
    let parts: Vec<&str> = job_id.split('_').collect();
    if parts.len() >= 2 {
        if let Ok(c) = ExternalCoin::from_str(parts[1]) {
            return c;
        }
    }
    ExternalCoin::Bitcoin
}

// ── Coin identity ───────────────────────────────────────────────────

/// A coin the pool serves — ZION itself plus every bridged/native
/// external coin.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PoolCoin {
    Zion,
    External(ExternalCoin),
}

impl PoolCoin {
    pub fn ticker(&self) -> &'static str {
        match self {
            PoolCoin::Zion => "ZION",
            PoolCoin::External(c) => c.as_str(),
        }
    }

    /// Stable lowercase id used in API paths (`/public/v1/coins/{id}`).
    pub fn id(&self) -> String {
        self.ticker().to_lowercase()
    }
}

// ── Leg descriptors (static registry) ───────────────────────────────

/// Where the leg's jobs come from.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LegKind {
    /// Own node/daemon authors or supplies the template.
    Native,
    /// Bridged to an upstream public pool.
    Upstream,
}

/// How miners get paid for this leg (plan §2 — inverted mining).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum PayoutKind {
    /// Coinbase is pool-authored → direct on-chain PPLNS payouts (ZION).
    OnChain,
    /// Rewards land in the node-side wallet → periodic batch payouts
    /// (QTU node wallet, PRL oyster wallet).
    NodeWalletBatch,
    /// Rewards land in our per-coin upstream wallet → batch payouts
    /// from received upstream revenue.
    BridgedBatch,
}

/// Stratum wire dialect a leg is served over.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum StratumDialect {
    /// Native V3 protocol (`"type"`-framed JSON).
    V3Native,
    /// Classic `mining.subscribe/authorize/submit` (yiimp-flavored).
    StratumV1,
    /// CryptoNote-style JSON-RPC login/job/submit (SRBMiner, XMRig).
    CryptoNoteJson,
    /// Pearl `mining.authorize` dialect (suprnova-compatible).
    PearlStratum,
}

/// Static description of one coin leg — the unit of the coin registry.
/// Runtime state lives in [`LegStatus`].
#[derive(Clone, Debug)]
pub struct LegDescriptor {
    /// Stable leg id (`"zion"`, `"qtc-native"`, `"prl-upstream"`, `aux-<ticker>`).
    pub leg_id: String,
    pub coin: PoolCoin,
    pub kind: LegKind,
    pub payout: PayoutKind,
    /// Served job-id prefix (`""` = opaque ids).
    pub job_prefix: &'static str,
    /// Dialects the leg is reachable over.
    pub dialects: &'static [StratumDialect],
    /// Human-readable hardware note for connect docs (`""` = none).
    pub hw_note: &'static str,
}

const V3_AND_V1: &[StratumDialect] = &[StratumDialect::V3Native, StratumDialect::StratumV1];
const QTU_DIALECTS: &[StratumDialect] = &[StratumDialect::CryptoNoteJson, StratumDialect::V3Native];
const PRL_DIALECTS: &[StratumDialect] = &[StratumDialect::PearlStratum, StratumDialect::V3Native];

/// Payout chain label for a coin ticker — the `payout_chain` written onto
/// native-unit `PayoutEntry`s and matched against the miner's registered
/// payout chain.  Coin tickers (`qtu`, `prl`) differ from chain labels
/// (`quantus`, `pearl`) for historical naming reasons.
pub fn payout_chain_for_coin(coin: &str) -> std::borrow::Cow<'_, str> {
    match coin.trim().to_ascii_lowercase().as_str() {
        "qtu" | "qtc" | "quantus" => "quantus".into(),
        "prl" | "pearl" => "pearl".into(),
        "zion" => "zion".into(),
        other => other.to_string().into(),
    }
}

/// Fixed legs — bridged coins are dynamic (see [`bridged_descriptor`]).
pub fn fixed_legs() -> Vec<LegDescriptor> {
    vec![
        LegDescriptor {
            leg_id: "zion".into(),
            coin: PoolCoin::Zion,
            kind: LegKind::Native,
            payout: PayoutKind::OnChain,
            job_prefix: ZION_V1_JOB_PREFIX,
            dialects: V3_AND_V1,
            hw_note: "",
        },
        LegDescriptor {
            leg_id: "qtc-native".into(),
            coin: PoolCoin::External(ExternalCoin::Quantus),
            kind: LegKind::Native,
            payout: PayoutKind::NodeWalletBatch,
            job_prefix: QTC_NATIVE_JOB_PREFIX,
            dialects: QTU_DIALECTS,
            hw_note: "",
        },
        LegDescriptor {
            leg_id: "qtc-upstream".into(),
            coin: PoolCoin::External(ExternalCoin::Quantus),
            kind: LegKind::Upstream,
            payout: PayoutKind::BridgedBatch,
            job_prefix: "",
            dialects: QTU_DIALECTS,
            hw_note: "",
        },
        LegDescriptor {
            leg_id: "prl-native".into(),
            coin: PoolCoin::External(ExternalCoin::Pearl),
            kind: LegKind::Native,
            payout: PayoutKind::NodeWalletBatch,
            job_prefix: "",
            dialects: PRL_DIALECTS,
            hw_note: "GPU only · NVIDIA SM75+ or AMD RDNA+ (Pascal unsupported)",
        },
        LegDescriptor {
            leg_id: "prl-upstream".into(),
            coin: PoolCoin::External(ExternalCoin::Pearl),
            kind: LegKind::Upstream,
            payout: PayoutKind::BridgedBatch,
            job_prefix: PRL_UPSTREAM_JOB_PREFIX,
            dialects: PRL_DIALECTS,
            hw_note: "GPU only · NVIDIA SM75+ or AMD RDNA+ (Pascal unsupported)",
        },
    ]
}

/// Descriptor for a bridged auxpow leg — one per enabled `ExternalCoin`.
pub fn bridged_descriptor(coin: ExternalCoin) -> LegDescriptor {
    LegDescriptor {
        leg_id: format!("aux-{}", coin.as_str().to_lowercase()),
        coin: PoolCoin::External(coin),
        kind: LegKind::Upstream,
        payout: PayoutKind::BridgedBatch,
        job_prefix: "",
        dialects: V3_AND_V1,
        hw_note: "",
    }
}

// ── Runtime status snapshot ─────────────────────────────────────────

/// Point-in-time status of one leg — serialized for ops/API consumers
/// (`/stats` auxpow section, future `/public/v1/coins`).
#[derive(Clone, Debug, Serialize)]
pub struct LegStatus {
    pub leg_id: String,
    pub coin: String,
    pub kind: LegKind,
    pub enabled: bool,
    pub connected: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub job_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub job_age_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub share_pct: Option<u8>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn route_dedicated_prefixes() {
        assert_eq!(route_job_id("qtun:abc"), JobRoute::QtcNative);
        assert_eq!(route_job_id("prlu:u-1"), JobRoute::PearlUpstream);
        assert_eq!(route_job_id("zion_42"), JobRoute::ZionV1);
        assert_eq!(route_job_id("v3_7"), JobRoute::ZionV3);
    }

    #[test]
    fn route_legacy_quirks() {
        // `j*`-starting ids are V1 zion jobs (V3 wire compat).
        assert_eq!(route_job_id("j1"), JobRoute::ZionV1);
        assert_eq!(route_job_id("job123"), JobRoute::ZionV1);
        // Legacy auxpow namespace resolves the inner coin.
        assert_eq!(
            route_job_id("aux_quantus_9"),
            JobRoute::Auxpow(ExternalCoin::Quantus)
        );
        assert_eq!(
            route_job_id("aux_bitcoin_1"),
            JobRoute::Auxpow(ExternalCoin::Bitcoin)
        );
    }

    #[test]
    fn route_opaque_ids_unresolved() {
        // Raw upstream job ids and pearl-native served ids are opaque.
        assert_eq!(route_job_id("ext123"), JobRoute::Unresolved);
        assert_eq!(route_job_id("a1b2c3d4"), JobRoute::Unresolved);
        assert_eq!(route_job_id(""), JobRoute::Unresolved);
    }

    #[test]
    fn route_precedence_order() {
        // qtun:/prlu: beat everything else even though they contain no
        // 'j'/'_' quirks — and `aux_` ids can't collide with `zion_`.
        assert_eq!(route_job_id("qtun:j1"), JobRoute::QtcNative);
        assert_eq!(
            route_job_id("aux_jade_1"),
            JobRoute::Auxpow(parse_aux_coin("aux_jade_1"))
        );
    }

    #[test]
    fn registry_covers_fixed_legs() {
        let legs = fixed_legs();
        let ids: Vec<&str> = legs.iter().map(|l| l.leg_id.as_str()).collect();
        assert_eq!(
            ids,
            [
                "zion",
                "qtc-native",
                "qtc-upstream",
                "prl-native",
                "prl-upstream"
            ]
        );
        // Every leg declares a payout path — the registry must never
        // emit a leg with an undefined payout model.
        for leg in &legs {
            assert!(matches!(
                leg.payout,
                PayoutKind::OnChain | PayoutKind::NodeWalletBatch | PayoutKind::BridgedBatch
            ));
        }
        // Inverted-mining legs are marked NodeWalletBatch.
        assert_eq!(legs[1].payout, PayoutKind::NodeWalletBatch);
        assert_eq!(legs[3].payout, PayoutKind::NodeWalletBatch);
    }

    #[test]
    fn bridged_descriptor_shape() {
        let d = bridged_descriptor(ExternalCoin::Verus);
        assert_eq!(d.leg_id, "aux-vrsc");
        assert_eq!(d.coin, PoolCoin::External(ExternalCoin::Verus));
        assert_eq!(d.kind, LegKind::Upstream);
        assert_eq!(d.payout, PayoutKind::BridgedBatch);
    }
}
