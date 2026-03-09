/// Comprehensive pool unit tests — pure logic, no Redis/PostgreSQL/network
///
/// Coverage targets: config, vardiff, reward_calculator, connection, storage serialization.

#[cfg(test)]
mod config_tests {
    use zion_pool::config::*;

    #[test]
    fn test_revenue_settings_default() {
        let rs = RevenueSettings::default();
        assert!(rs.enabled);
        assert!(rs.streams.zion.enabled);
        assert!((rs.streams.zion.target_share - 0.50).abs() < 0.001);
    }

    #[test]
    fn test_stream_config_defaults() {
        let zion = StreamConfig::default();
        assert!(zion.enabled);
        assert!((zion.target_share - 0.50).abs() < 0.001);
    }

    #[test]
    fn test_etc_config_defaults() {
        let etc = StreamEtcConfig::default();
        assert!(etc.enabled);
        assert!((etc.target_share - 0.05).abs() < 0.001);
        assert!(etc.pool.stratum.contains("2miners"));
        assert_eq!(etc.pool.worker, "zion_merged");
    }

    #[test]
    fn test_ncl_config_defaults() {
        let ncl = StreamNclConfig::default();
        assert!(ncl.enabled);
        assert!((ncl.target_share - 0.25).abs() < 0.001);
    }

    #[test]
    fn test_stream_target_shares_within_budget() {
        let streams = StreamsConfig::default();
        let total = streams.zion.target_share
            + streams.etc.target_share
            + streams.ncl.target_share
            + streams.dynamic_gpu.target_share;
        // Total should be <= 1.0 (100% of compute)
        assert!(
            total <= 1.0 + 0.001,
            "Stream targets exceed 100%: {}",
            total
        );
    }

    #[test]
    fn test_default_btc_wallet_has_bc1_prefix() {
        let wallet = default_btc_wallet();
        assert!(
            wallet.starts_with("bc1"),
            "BTC wallet doesn't start with bc1: {}",
            wallet
        );
    }

    #[test]
    fn test_default_xmr_wallet_is_long() {
        let wallet = default_xmr_wallet();
        // XMR addresses are 95 or 106 characters
        assert!(
            wallet.len() >= 90,
            "XMR wallet too short: {} chars",
            wallet.len()
        );
    }

    #[test]
    fn test_revenue_settings_deserialization() {
        let json = r#"{"enabled": false}"#;
        let rs: RevenueSettings = serde_json::from_str(json).unwrap();
        assert!(!rs.enabled);
        // Default streams should still be present
        assert!(rs.streams.zion.enabled);
    }

    #[test]
    fn test_dynamic_gpu_config_defaults() {
        let dg = StreamDynamicGpuConfig::default();
        assert!(dg.enabled);
        assert!((dg.target_share - 0.20).abs() < 0.001);
        assert!(
            !dg.pools.is_empty(),
            "Dynamic GPU should have default pools"
        );
    }

    #[test]
    fn test_dynamic_gpu_has_expected_coins() {
        let dg = StreamDynamicGpuConfig::default();
        assert!(dg.pools.contains_key("etc"), "Missing ETC pool");
        assert!(dg.pools.contains_key("erg"), "Missing ERG pool");
        assert!(dg.pools.contains_key("rvn"), "Missing RVN pool");
        assert!(dg.pools.contains_key("kas"), "Missing KAS pool");
        assert!(dg.pools.contains_key("alph"), "Missing ALPH pool");
    }

    #[test]
    fn test_nxs_config_disabled_by_default() {
        let nxs = StreamNxsConfig::default();
        assert!(!nxs.enabled);
        assert!((nxs.target_share - 0.0).abs() < 0.001);
    }
}

#[cfg(test)]
mod vardiff_tests {
    use std::time::{Duration, Instant};
    use zion_pool::vardiff::*;

    #[test]
    fn test_vardiff_default_config() {
        let cfg = VarDiffConfig::default();
        assert_eq!(cfg.target_share_time, Duration::from_secs(15));
        assert_eq!(cfg.retarget_time, Duration::from_secs(30));
        assert!((cfg.variance - 0.25).abs() < 0.001);
        assert_eq!(cfg.min_difficulty, 1000);
        assert_eq!(cfg.max_difficulty, 10_000_000_000);
    }

    #[test]
    fn test_vardiff_no_retarget_before_window() {
        let cfg = VarDiffConfig {
            retarget_time: Duration::from_secs(60),
            ..VarDiffConfig::default()
        };
        let mut st = VarDiffState::new(Some(cfg));
        // Instant::now() is within microseconds of last_retarget set in new()
        let start = Instant::now();
        // Submit shares within window (30s < 60s retarget)
        for i in 0..5 {
            let result = st.on_share(start + Duration::from_secs(i * 3), true, 1000);
            assert!(
                result.is_none(),
                "Should not retarget within window at {}s",
                i * 3
            );
        }
    }

    #[test]
    fn test_vardiff_no_change_within_variance() {
        let cfg = VarDiffConfig {
            target_share_time: Duration::from_secs(10),
            retarget_time: Duration::from_millis(1),
            variance: 0.25,
            min_difficulty: 1,
            max_difficulty: 1_000_000,
        };
        let mut st = VarDiffState::new(Some(cfg));
        let start = Instant::now();
        // Wait for retarget window to pass
        let t = start + Duration::from_secs(10);
        // 1 accepted share over 10s → avg 10s, target 10s, ratio ≈ 1.0 (within variance)
        let next = st.on_share(t, true, 1000);
        assert!(
            next.is_none(),
            "Difficulty should not change when within variance"
        );
    }

    #[test]
    fn test_vardiff_clamps_to_min() {
        let cfg = VarDiffConfig {
            target_share_time: Duration::from_secs(10),
            retarget_time: Duration::from_millis(1),
            variance: 0.0,
            min_difficulty: 500,
            max_difficulty: 1_000_000,
        };
        let mut st = VarDiffState::new(Some(cfg));
        let start = Instant::now();
        // 1 share over 5s but current_diff already at min
        let next = st.on_share(start + Duration::from_millis(5000), true, 500);
        match next {
            Some(d) => assert!(d >= 500, "Difficulty below min: {}", d),
            None => {} // No change means current diff is fine
        }
    }

    #[test]
    fn test_vardiff_clamps_to_max() {
        let cfg = VarDiffConfig {
            target_share_time: Duration::from_secs(10),
            retarget_time: Duration::from_millis(1),
            variance: 0.0,
            min_difficulty: 1,
            max_difficulty: 200,
        };
        let mut st = VarDiffState::new(Some(cfg));
        let start = Instant::now();
        // Many shares very fast → wants to increase difficulty a lot
        for i in 0..100 {
            let _ = st.on_share(start + Duration::from_millis(i * 10 + 1), true, 100);
        }
        let next = st.on_share(start + Duration::from_secs(2), true, 100);
        match next {
            Some(d) => assert!(d <= 200, "Difficulty above max: {}", d),
            None => {}
        }
    }

    #[test]
    fn test_vardiff_state_new_none_uses_env_defaults() {
        let st = VarDiffState::new(None);
        // Should construct without panicking — cfg is env-based defaults
        let _ = st;
    }
}

#[cfg(test)]
mod reward_calculator_tests {
    use rust_decimal::Decimal;
    use rust_decimal_macros::dec;
    use zion_pool::blockchain::reward_calculator::*;

    #[test]
    fn test_height_zero_reward() {
        let calc = RewardCalculator::default();
        assert_eq!(calc.calculate_block_reward_at_height(0), Decimal::ZERO);
    }

    #[test]
    fn test_decade_1_reward() {
        let calc = RewardCalculator::default();
        assert_eq!(calc.calculate_block_reward_at_height(1), dec!(5400.067));
        assert_eq!(calc.calculate_block_reward_at_height(1000), dec!(5400.067));
        assert_eq!(
            calc.calculate_block_reward_at_height(BLOCKS_PER_DECADE),
            dec!(5400.067)
        );
    }

    #[test]
    fn test_all_decade_rewards_monotonic_decrease() {
        let calc = RewardCalculator::default();
        let mut prev = dec!(999999999);
        for decade in 0..MAX_DECAY_DECADES {
            let height = decade * BLOCKS_PER_DECADE + 1;
            let reward = calc.calculate_block_reward_at_height(height);
            assert!(
                reward < prev,
                "Decade {} reward {} >= prev {}",
                decade + 1,
                reward,
                prev
            );
            prev = reward;
        }
    }

    #[test]
    fn test_tail_emission_after_max_decades() {
        let calc = RewardCalculator::default();
        let tail_height = MAX_DECAY_DECADES * BLOCKS_PER_DECADE + 1;
        assert_eq!(
            calc.calculate_block_reward_at_height(tail_height),
            TAIL_REWARD
        );
        // Way beyond
        assert_eq!(
            calc.calculate_block_reward_at_height(tail_height + 1_000_000),
            TAIL_REWARD
        );
    }

    #[test]
    fn test_tail_emission_never_zero() {
        assert!(TAIL_REWARD > Decimal::ZERO, "Tail reward must be positive");
    }

    #[test]
    fn test_custom_fee_breakdown() {
        let calc = RewardCalculator::new(Some(2.0), Some(10.0));
        let breakdown = calc.calculate_reward_breakdown_at_height(1);

        let total: Decimal = breakdown.total_reward.parse().unwrap();
        let miner: Decimal = breakdown.miner_share.parse().unwrap();
        let tithe: Decimal = breakdown.humanitarian_tithe.parse().unwrap();
        let issobella: Decimal = breakdown.issobella_fund.parse().unwrap();
        let fee: Decimal = breakdown.pool_fee.parse().unwrap();

        assert_eq!(
            total,
            miner + tithe + issobella + fee,
            "Breakdown must sum to total"
        );

        // 2% pool fee + 10% tithe + 5% issobella = 17% → miner = 83%
        let miner_pct = (miner / total) * dec!(100);
        assert!(
            (miner_pct - dec!(83)).abs() < dec!(0.1),
            "Miner should get 83%, got {}",
            miner_pct
        );
    }

    #[test]
    fn test_breakdown_adds_up_all_decades() {
        let calc = RewardCalculator::default();
        for decade in 0..=MAX_DECAY_DECADES {
            let height = if decade == 0 {
                1
            } else {
                decade * BLOCKS_PER_DECADE + 1
            };
            let breakdown = calc.calculate_reward_breakdown_at_height(height);

            let total: Decimal = breakdown.total_reward.parse().unwrap();
            let miner: Decimal = breakdown.miner_share.parse().unwrap();
            let tithe: Decimal = breakdown.humanitarian_tithe.parse().unwrap();
            let issobella: Decimal = breakdown.issobella_fund.parse().unwrap();
            let fee: Decimal = breakdown.pool_fee.parse().unwrap();

            assert_eq!(
                total,
                miner + tithe + issobella + fee,
                "Breakdown doesn't add up at decade {} (height {})",
                decade,
                height
            );
        }
    }

    #[test]
    fn test_pplns_payout_proportional() {
        let calc = RewardCalculator::default();
        let payout_full = calc.calculate_pplns_payout(1000, 1000).unwrap();
        let payout_half = calc.calculate_pplns_payout(500, 1000).unwrap();
        assert_eq!(
            payout_full,
            payout_half * dec!(2),
            "Full share should be 2x half share"
        );
    }

    #[test]
    fn test_pool_fee_and_tithe_accessors() {
        let calc = RewardCalculator::new(Some(2.5), Some(7.0));
        assert_eq!(calc.pool_fee_percent(), dec!(2.5));
        assert_eq!(calc.tithe_percent(), dec!(7.0));
    }

    #[test]
    fn test_default_pool_fee_and_tithe() {
        let calc = RewardCalculator::default();
        assert_eq!(calc.pool_fee_percent(), dec!(1.0));
        assert_eq!(calc.tithe_percent(), dec!(5.0));
    }

    #[test]
    fn test_calculate_block_reward_backward_compat() {
        let calc = RewardCalculator::default();
        // Backward compat method should return decade 1 reward
        assert_eq!(calc.calculate_block_reward(), dec!(5400.067));
    }
}

#[cfg(test)]
mod connection_tests {
    use std::net::{IpAddr, Ipv4Addr, SocketAddr};
    use std::time::Duration;
    use zion_pool::stratum::connection_v2::*;

    fn test_addr() -> SocketAddr {
        SocketAddr::new(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)), 12345)
    }

    #[test]
    fn test_acceptance_rate_zero_shares() {
        let conn = Connection::new("s1".to_string(), test_addr());
        assert_eq!(conn.acceptance_rate(), 0.0);
    }

    #[test]
    fn test_acceptance_rate_all_accepted() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        for _ in 0..10 {
            conn.record_share(true);
        }
        assert!((conn.acceptance_rate() - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn test_acceptance_rate_all_rejected() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        for _ in 0..10 {
            conn.record_share(false);
        }
        assert_eq!(conn.acceptance_rate(), 0.0);
    }

    #[test]
    fn test_acceptance_rate_mixed() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        for _ in 0..7 {
            conn.record_share(true);
        }
        for _ in 0..3 {
            conn.record_share(false);
        }
        assert!((conn.acceptance_rate() - 0.7).abs() < 0.001);
    }

    #[test]
    fn test_is_authenticated_states() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        assert!(!conn.is_authenticated());

        conn.state = ConnectionState::Subscribed;
        assert!(!conn.is_authenticated());

        conn.state = ConnectionState::Authenticated;
        assert!(conn.is_authenticated());

        conn.state = ConnectionState::Disconnecting;
        assert!(!conn.is_authenticated());
    }

    #[test]
    fn test_protocol_detection_idempotent() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        conn.detect_protocol("login");
        assert_eq!(conn.protocol, Protocol::XMRig);

        // Second detection should not override
        conn.detect_protocol("mining.subscribe");
        assert_eq!(
            conn.protocol,
            Protocol::XMRig,
            "Protocol changed after first detection"
        );
    }

    #[test]
    fn test_extranonce1_format() {
        let conn = Connection::new("session-abc".to_string(), test_addr());
        assert_eq!(
            conn.extranonce1.len(),
            8,
            "extranonce1 should be 8 hex chars"
        );
        assert!(
            conn.extranonce1.chars().all(|c| c.is_ascii_hexdigit()),
            "extranonce1 must be hex: {}",
            conn.extranonce1
        );
    }

    #[test]
    fn test_extranonce1_uniqueness() {
        let c1 = Connection::new("session-1".to_string(), test_addr());
        let c2 = Connection::new("session-2".to_string(), test_addr());
        let c3 = Connection::new("session-3".to_string(), test_addr());
        assert_ne!(c1.extranonce1, c2.extranonce1);
        assert_ne!(c2.extranonce1, c3.extranonce1);
    }

    #[test]
    fn test_default_difficulty() {
        let conn = Connection::new("s1".to_string(), test_addr());
        // Default 500 — CPU-friendly starting point; VarDiff calibrates up for GPU miners.
        // Changed from 500_000 (GPU-only) which caused CPU miners to never submit a share.
        assert_eq!(conn.difficulty, 500);
    }

    #[test]
    fn test_record_share_counters() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        conn.record_share(true);
        conn.record_share(true);
        conn.record_share(false);
        conn.record_share(true);
        conn.record_share(false);

        assert_eq!(conn.shares_submitted, 5);
        assert_eq!(conn.shares_accepted, 3);
        assert_eq!(conn.shares_rejected, 2);
    }

    #[test]
    fn test_uptime_is_non_negative() {
        let conn = Connection::new("s1".to_string(), test_addr());
        assert!(conn.uptime() >= Duration::ZERO);
    }

    #[test]
    fn test_worker_id_no_wallet() {
        let conn = Connection::new("s1".to_string(), test_addr());
        assert!(conn.worker_id().is_none());
    }

    #[test]
    fn test_worker_id_wallet_only() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        conn.wallet_address = Some("zion1abc".to_string());
        assert_eq!(conn.worker_id(), Some("zion1abc".to_string()));
    }

    #[test]
    fn test_worker_id_wallet_and_worker() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        conn.wallet_address = Some("zion1abc".to_string());
        conn.worker_name = Some("rig01".to_string());
        assert_eq!(conn.worker_id(), Some("zion1abc.rig01".to_string()));
    }

    #[test]
    fn test_protocol_unknown_methods() {
        let mut conn = Connection::new("s1".to_string(), test_addr());
        conn.detect_protocol("garbage");
        assert_eq!(conn.protocol, Protocol::Unknown);

        conn.detect_protocol("eth_submitWork");
        assert_eq!(conn.protocol, Protocol::Unknown);
    }

    #[test]
    fn test_stratum_protocol_keywords() {
        let methods = ["mining.subscribe", "mining.authorize", "mining.submit"];
        for method in methods {
            let mut conn = Connection::new(format!("s-{}", method), test_addr());
            conn.detect_protocol(method);
            assert_eq!(
                conn.protocol,
                Protocol::Stratum,
                "Method '{}' should be Stratum",
                method
            );
        }
    }

    #[test]
    fn test_xmrig_protocol_keywords() {
        let methods = ["login", "keepalived", "getjob"];
        for method in methods {
            let mut conn = Connection::new(format!("s-{}", method), test_addr());
            conn.detect_protocol(method);
            assert_eq!(
                conn.protocol,
                Protocol::XMRig,
                "Method '{}' should be XMRig",
                method
            );
        }
    }

    #[test]
    fn test_not_stale_on_creation() {
        let conn = Connection::new("s1".to_string(), test_addr());
        assert!(!conn.is_stale(Duration::from_secs(60)));
        assert!(!conn.is_stale(Duration::from_secs(1)));
    }
}

#[cfg(test)]
mod storage_serialization_tests {
    use zion_pool::shares::storage::*;

    #[test]
    fn test_stored_share_roundtrip() {
        let share = StoredShare {
            job_id: "h100-abc-1234".to_string(),
            miner_address: "zion1test".to_string(),
            nonce: "deadbeef".to_string(),
            hash: "00000fff".to_string(),
            difficulty: 500_000,
            algorithm: "cosmic_harmony".to_string(),
            timestamp: 1708300000,
            is_block: false,
            job_blob: Some("aabb".to_string()),
            height: Some(42),
        };
        let json = serde_json::to_string(&share).unwrap();
        let back: StoredShare = serde_json::from_str(&json).unwrap();
        assert_eq!(back.job_id, "h100-abc-1234");
        assert_eq!(back.difficulty, 500_000);
        assert_eq!(back.height, Some(42));
        assert!(!back.is_block);
    }

    #[test]
    fn test_miner_stats_roundtrip() {
        let stats = MinerStats {
            address: "zion1abc".to_string(),
            total_shares: 10_000,
            valid_shares: 9_500,
            invalid_shares: 500,
            blocks_found: 3,
            last_share_time: 1708300000,
            hashrate_1h: 42.5,
            hashrate_24h: 40.0,
            total_paid: 1_000_000_000,
            pending_balance: 50_000_000,
        };
        let json = serde_json::to_string(&stats).unwrap();
        let back: MinerStats = serde_json::from_str(&json).unwrap();
        assert_eq!(back.total_shares, 10_000);
        assert_eq!(back.valid_shares, 9_500);
        assert_eq!(back.blocks_found, 3);
        assert!((back.hashrate_1h - 42.5).abs() < 0.01);
    }

    #[test]
    fn test_block_found_roundtrip() {
        let block = BlockFound {
            height: 12345,
            hash: "0000abcd".to_string(),
            miner_address: "zion1miner".to_string(),
            reward: 5_400_067_000_000,
            timestamp: 1708300000,
            difficulty: 1_000_000,
        };
        let json = serde_json::to_string(&block).unwrap();
        let back: BlockFound = serde_json::from_str(&json).unwrap();
        assert_eq!(back.height, 12345);
        assert_eq!(back.reward, 5_400_067_000_000);
    }

    #[test]
    fn test_pool_stats_roundtrip() {
        let stats = PoolStats {
            hash_rate: 1500.0,
            miners: 42,
            miners_paid: 30,
            total_blocks: 100,
            network_diff: 50_000_000.0,
        };
        let json = serde_json::to_string(&stats).unwrap();
        let back: PoolStats = serde_json::from_str(&json).unwrap();
        assert_eq!(back.miners, 42);
        assert_eq!(back.total_blocks, 100);
        assert!((back.hash_rate - 1500.0).abs() < 0.01);
    }

    #[test]
    fn test_payout_record_roundtrip() {
        let payout = PayoutRecord {
            id: 1,
            address: "zion1payee".to_string(),
            amount_atomic: 1_000_000_000,
            amount: 1.0,
            status: "pending".to_string(),
            tx_id: None,
            created_ts: 1708300000,
            updated_ts: 1708300000,
            error: None,
        };
        let json = serde_json::to_string(&payout).unwrap();
        let back: PayoutRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(back.status, "pending");
        assert!(back.tx_id.is_none());
        assert!(back.error.is_none());
        assert_eq!(back.amount_atomic, 1_000_000_000);
    }

    #[test]
    fn test_stored_share_optional_fields_missing() {
        let json = r#"{
            "job_id": "j1", "miner_address": "m1", "nonce": "n1",
            "hash": "h1", "difficulty": 100, "algorithm": "a1",
            "timestamp": 0, "is_block": false
        }"#;
        let share: StoredShare = serde_json::from_str(json).unwrap();
        assert!(share.job_blob.is_none());
        assert!(share.height.is_none());
    }

    #[test]
    fn test_stored_share_is_block_flag() {
        let mut share = StoredShare {
            job_id: "j1".to_string(),
            miner_address: "m1".to_string(),
            nonce: "n1".to_string(),
            hash: "00000000".to_string(),
            difficulty: 50_000_000,
            algorithm: "cosmic_harmony".to_string(),
            timestamp: 1708300000,
            is_block: true,
            job_blob: None,
            height: Some(100),
        };
        let json = serde_json::to_string(&share).unwrap();
        let back: StoredShare = serde_json::from_str(&json).unwrap();
        assert!(back.is_block);
        assert_eq!(back.height, Some(100));
    }

    #[test]
    fn test_payout_record_with_tx_id() {
        let payout = PayoutRecord {
            id: 42,
            address: "zion1abc".to_string(),
            amount_atomic: 5_000_000_000,
            amount: 5.0,
            status: "confirmed".to_string(),
            tx_id: Some("abcdef1234567890".to_string()),
            created_ts: 1708300000,
            updated_ts: 1708310000,
            error: None,
        };
        let json = serde_json::to_string(&payout).unwrap();
        let back: PayoutRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(back.status, "confirmed");
        assert_eq!(back.tx_id.as_deref(), Some("abcdef1234567890"));
        assert!(back.updated_ts > back.created_ts);
    }

    #[test]
    fn test_payout_record_with_error() {
        let payout = PayoutRecord {
            id: 99,
            address: "zion1fail".to_string(),
            amount_atomic: 100,
            amount: 0.0001,
            status: "failed".to_string(),
            tx_id: None,
            created_ts: 1708300000,
            updated_ts: 1708300000,
            error: Some("insufficient balance".to_string()),
        };
        let json = serde_json::to_string(&payout).unwrap();
        let back: PayoutRecord = serde_json::from_str(&json).unwrap();
        assert_eq!(back.error.as_deref(), Some("insufficient balance"));
    }
}

#[cfg(test)]
mod reward_breakdown_tests {
    use zion_pool::blockchain::reward_calculator::RewardBreakdown;

    #[test]
    fn test_reward_breakdown_json_roundtrip() {
        let rb = RewardBreakdown {
            total_reward: "5400.067".to_string(),
            miner_share: "4806.059630".to_string(),
            humanitarian_tithe: "270.003350".to_string(),
            issobella_fund: "270.003350".to_string(),
            pool_fee: "54.000670".to_string(),
        };
        let json = serde_json::to_string(&rb).unwrap();
        let back: RewardBreakdown = serde_json::from_str(&json).unwrap();
        assert_eq!(back.total_reward, "5400.067");
        assert_eq!(back.pool_fee, "54.000670");
    }
}
