//! Simple metrics for zion-issobella.

use std::sync::atomic::{AtomicU64, Ordering};

#[derive(Default)]
pub struct IssobellaMetrics {
    pub blocks_scanned: AtomicU64,
    pub missions_planning: AtomicU64,
    pub missions_launched: AtomicU64,
    pub missions_operational: AtomicU64,
    pub observations_recorded: AtomicU64,
    pub proposals_submitted: AtomicU64,
    pub total_accumulated_zion: AtomicU64,
    pub total_disbursed_zion: AtomicU64,
}

impl IssobellaMetrics {
    pub fn new() -> Self {
        Self::default()
    }
}

/// Serve Prometheus-style metrics text.
pub fn serve_metrics_text(metrics: &IssobellaMetrics) -> String {
    format!(
        "# HELP zion_issobella_blocks_scanned Total L1 blocks scanned\n\
         # TYPE zion_issobella_blocks_scanned counter\n\
         zion_issobella_blocks_scanned {}\n\n\
         # HELP zion_issobella_missions_planning Number of missions in planning\n\
         # TYPE zion_issobella_missions_planning gauge\n\
         zion_issobella_missions_planning {}\n\n\
         # HELP zion_issobella_missions_launched Number of launched missions\n\
         # TYPE zion_issobella_missions_launched gauge\n\
         zion_issobella_missions_launched {}\n\n\
         # HELP zion_issobella_missions_operational Number of operational missions\n\
         # TYPE zion_issobella_missions_operational gauge\n\
         zion_issobella_missions_operational {}\n\n\
         # HELP zion_issobella_observations_recorded Number of observations recorded\n\
         # TYPE zion_issobella_observations_recorded gauge\n\
         zion_issobella_observations_recorded {}\n\n\
         # HELP zion_issobella_proposals_submitted Number of research proposals submitted\n\
         # TYPE zion_issobella_proposals_submitted gauge\n\
         zion_issobella_proposals_submitted {}\n\n\
         # HELP zion_issobella_total_accumulated_zion Total ZION accumulated\n\
         # TYPE zion_issobella_total_accumulated_zion gauge\n\
         zion_issobella_total_accumulated_zion {}\n\n\
         # HELP zion_issobella_total_disbursed_zion Total ZION disbursed\n\
         # TYPE zion_issobella_total_disbursed_zion gauge\n\
         zion_issobella_total_disbursed_zion {}\n",
        metrics.blocks_scanned.load(Ordering::Relaxed),
        metrics.missions_planning.load(Ordering::Relaxed),
        metrics.missions_launched.load(Ordering::Relaxed),
        metrics.missions_operational.load(Ordering::Relaxed),
        metrics.observations_recorded.load(Ordering::Relaxed),
        metrics.proposals_submitted.load(Ordering::Relaxed),
        metrics.total_accumulated_zion.load(Ordering::Relaxed),
        metrics.total_disbursed_zion.load(Ordering::Relaxed),
    )
}
