//! L3–L6 cross-layer runtime smoke tests for V31.
//!
//! This crate exercises the full L3–L6 stack in a single process:
//! - L3 NCL: an AI compute job is submitted, scheduled and completed.
//! - L3 AI-Native: the agent consciousness engine records the completed task
//!   and the Oasis bridge translates L3 XP/state into L4 Oasis units.
//! - L4 Oasis: the synced XP is applied to a player profile.
//! - L5 Free World: a humanitarian grant is recorded for the same address.
//! - L6 Issobella: a space research proposal is recorded for the same address.

#[cfg(test)]
mod tests {
    use zion_ai_native::{
        consciousness_engine::ConsciousnessEngine, oasis_bridge::OasisBridge, ConsciousnessLevel,
    };
    use zion_free_world::{FreeWorldDb, GrantRecord};
    use zion_issobella::{IssobellaDb, ResearchProposal};
    use zion_ncl::{ComputeBackend, JobScheduler, NclJob, NclTaskType, NclWorker};
    use zion_oasis::db::OasisDb;
    use zion_oasis::Player;

    /// End-to-end smoke test across L3 (NCL + AI-Native), L4 (Oasis),
    /// L5 (Free World) and L6 (Issobella).
    #[test]
    fn l3_l6_cross_layer_smoke() {
        const ADDRESS: &str = "zion1l3l6smoke";

        // ── L3 NCL: AI compute marketplace ────────────────────────────────
        let mut scheduler = JobScheduler::new(10);
        let worker = NclWorker::new(
            "worker-1".into(),
            ADDRESS.into(),
            vec![ComputeBackend::OnnxRuntime],
        );
        scheduler.register_worker(worker);

        let job = NclJob::new(
            "smoke-llm".into(),
            ComputeBackend::OnnxRuntime,
            "sha256:smoke-input".into(),
            ADDRESS.into(),
            1_000, // reward in flowers — maps L3 Sentient → L4 Mental
            30_000,
        )
        .with_task_type(NclTaskType::LlmInference);

        let job_id = scheduler.submit_job(job).unwrap();
        let assigned = scheduler.try_assign_next().unwrap();
        assert!(assigned.is_some(), "job should be assigned to a worker");

        scheduler
            .complete_job(job_id, "sha256:smoke-output".into())
            .unwrap();
        let completed_job = scheduler.get_job(&job_id).unwrap();
        assert_eq!(
            completed_job.status,
            zion_ncl::NclJobStatus::Completed,
            "NCL job must be completed"
        );

        // ── L3 AI-Native: agent consciousness + Oasis bridge ──────────────
        let mut engine = ConsciousnessEngine::new(ADDRESS);
        engine.on_task_complete("llm_inference", 1_000);
        engine.add_xp(completed_job.reward_flowers as i64);

        let status = engine.status();
        assert!(
            status.level >= ConsciousnessLevel::Sentient,
            "agent should reach at least Sentient after NCL reward, got {:?}",
            status.level
        );

        let bridge = OasisBridge::new(ADDRESS, completed_job.id.to_string());
        let profile = bridge.sync(&status);
        let request = bridge.xp_sync_request(&status);

        // Bridge must translate to a non-trivial Oasis level and scaled XP.
        assert!(
            profile.oasis_xp > 0,
            "bridge must produce positive Oasis XP"
        );
        assert_eq!(
            profile.wallet_address, ADDRESS,
            "bridge profile must reference the same address"
        );
        assert_eq!(
            request.wallet_address, ADDRESS,
            "xp sync request must reference the same address"
        );

        // ── L4 Oasis: player profile synced from bridge ───────────────────
        let oasis_db = OasisDb::in_memory().unwrap();
        let mut player = Player::new(ADDRESS.into());
        player.add_xp(profile.oasis_xp);

        // The player level derived from scaled XP must match the bridge mapping.
        let expected_oasis_level = zion_oasis::ConsciousnessLevel::from_xp(profile.oasis_xp);
        assert_eq!(
            player.level, expected_oasis_level,
            "Oasis player level must be consistent with scaled bridge XP"
        );
        assert_eq!(
            player.level as u8, profile.oasis_level as u8,
            "Oasis player level must match the bridge level mapping"
        );

        oasis_db.save_player(&player).unwrap();
        let loaded = oasis_db
            .get_player(ADDRESS)
            .unwrap()
            .expect("player exists");
        assert_eq!(loaded.total_xp, profile.oasis_xp);
        assert_eq!(loaded.address, ADDRESS);

        // ── L5 Free World: humanitarian grant tied to the same address ────
        let fw_db = FreeWorldDb::open(":memory:").unwrap();
        let mut grant = GrantRecord::new("L3-L6 Smoke Grant", "community", 1_000_000);
        grant.applicant_address = Some(ADDRESS.into());
        fw_db.insert_grant(&grant).unwrap();

        let grants = fw_db.list_grants(None).unwrap();
        assert_eq!(grants.len(), 1, "Free World should store one grant");
        assert_eq!(
            grants[0].applicant_address.as_deref(),
            Some(ADDRESS),
            "grant must reference the same L1 address"
        );

        // ── L6 Issobella: space research proposal tied to the same address ─
        let isso_db = IssobellaDb::open(":memory:").unwrap();
        let mut proposal = ResearchProposal::new("L3-L6 Space Smoke", 500_000);
        proposal.researcher = Some(ADDRESS.into());
        isso_db.insert_proposal(&proposal).unwrap();

        let proposals = isso_db.list_proposals(None).unwrap();
        assert_eq!(proposals.len(), 1, "Issobella should store one proposal");
        assert_eq!(
            proposals[0].researcher.as_deref(),
            Some(ADDRESS),
            "proposal must reference the same L1 address"
        );

        // ── Cross-layer consistency checks ────────────────────────────────
        assert_eq!(loaded.address, ADDRESS);
        assert_eq!(grants[0].applicant_address.as_deref(), Some(ADDRESS));
        assert_eq!(proposals[0].researcher.as_deref(), Some(ADDRESS));
    }

    /// WARP cross-chain smoke: an HTLC atomic swap between Base (EVM) and ZionL1.
    #[tokio::test]
    async fn warp_htlc_cross_chain_smoke() {
        use sha2::{Digest, Sha256};
        use zion_l1_types::{Address, Amount, Asset, ChainId, Hash};
        use zion_multichain::{
            swap::htlc::{HtlcSwap, SwapState},
            types::{Transfer, TransferDirection, TransferEndpoint, TransferStatus},
        };

        const SECRET: &[u8] = b"zion-smoke-secret-32bytes-long!!";
        const RECIPIENT: &str = "zion1recipient";

        let hashlock = Hash::new(Sha256::digest(SECRET).into());
        let far_future = (chrono::Utc::now().timestamp() as u64) + 86_400;

        let base_addr = Address::new(ChainId::Base, vec![0u8; 20], "0xbase").unwrap();
        let zion_addr = Address::new(ChainId::ZionL1, vec![0u8; 20], "zion1sender").unwrap();

        let source = TransferEndpoint {
            address: base_addr,
            asset: Asset::native(ChainId::Base, "ETH", 18, "Ether"),
            amount: Amount::new(1_000_000),
        };
        let target = TransferEndpoint {
            address: zion_addr,
            asset: Asset::native(ChainId::ZionL1, "ZION", 6, "ZION"),
            amount: Amount::new(1_000_000_000),
        };

        let mut transfer = Transfer::new("warp-smoke", TransferDirection::Htlc, source, target);
        transfer.hashlock = Some(hashlock);
        transfer.timelock = Some(far_future);

        let swap = HtlcSwap::new_offline();
        let initiated_hash = swap.initiate(&mut transfer).await.unwrap();
        assert_eq!(initiated_hash, hashlock);
        assert_eq!(transfer.status, TransferStatus::Executing);

        swap.claim(SECRET, RECIPIENT, &mut transfer).await.unwrap();
        assert_eq!(transfer.status, TransferStatus::Completed);

        let record = swap
            .get_record(&hashlock.to_hex())
            .await
            .expect("record exists");
        assert_eq!(record.state, SwapState::Claimed);
        assert_eq!(record.release_recipient, Some(RECIPIENT.to_string()));
        assert!(
            record.preimage_hex.is_some(),
            "preimage must be recorded after claim"
        );
    }

    /// DAO governance smoke: proposal, vote and quorum across L2 governance.
    #[test]
    fn dao_governance_proposal_smoke() {
        use zion_dao::{check_quorum, Proposal, ProposalType, VoteChoice};

        const PROPOSER: &str = "zion1proposer";
        const CIRCULATING: u64 = 100_000_000_000_000; // 100M ZION in flowers

        let mut proposal = Proposal::new(
            1,
            "L3-L6 Integration Fund".into(),
            "Fund cross-layer smoke tests".into(),
            ProposalType::Treasury {
                recipient: "zion1smoke".into(),
                amount: 1_000_000_000_000, // 1M ZION
                purpose: "cross-layer smoke testing".into(),
            },
            PROPOSER.into(),
            1_000_000_000_000,
            0,
        );

        // Required quorum for Treasury is 15 %.
        let required_votes = (CIRCULATING as f64 * 15.0 / 100.0) as u64;
        proposal.add_vote(VoteChoice::Yes, required_votes + 1);

        assert!(
            check_quorum(&proposal, CIRCULATING).is_ok(),
            "DAO proposal should reach quorum"
        );
        assert!(proposal.votes_for > proposal.votes_against);
    }
}
