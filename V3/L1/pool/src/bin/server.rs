use anyhow::{anyhow, Context, Result};
use std::fmt::Write as _;
use std::io::{BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex};
use std::thread;
use zion_core::{
    decode_rpc_response, encode_rpc_request, BlockTemplate, CoreRuntime, DifficultyTarget,
    MiningHeader, MiningSolution, RevenueSource, RpcRequest, RpcResponse,
};
use zion_pool::{decode_message, encode_message, MiningPool, PoolMessage, ShareStatus};

fn main() -> Result<()> {
    let config = ServerConfig::from_env()?;
    let pool = Arc::new(Mutex::new(MiningPool::with_job_ttl(
        CoreRuntime::default(),
        config.job_ttl_ms,
    )));
    let revenue_scheduler = Arc::new(Mutex::new(RevenueScheduler::from_env(
        config.revenue_source,
        config.revenue_value_usd,
    )?));
    let routing_stats = Arc::new(Mutex::new(RoutingStats::new(config.routing_log_every)));
    let listener = TcpListener::bind(&config.bind_addr)
        .with_context(|| format!("failed to bind pool listener on {}", config.bind_addr))?;

    println!("ZION v3 pool server");
    println!("bind_addr={}", config.bind_addr);
    println!("loop_count={}", config.loop_count);
    println!("job_ttl_ms={}", config.job_ttl_ms);
    println!(
        "accept_limit={}",
        config
            .accept_limit
            .map(|value| value.to_string())
            .unwrap_or_else(|| "unbounded".to_string())
    );
    if let Some(node_rpc_addr) = config.node_rpc_addr.as_deref() {
        println!("node_rpc_addr={node_rpc_addr}");
    }
    println!(
        "session_default_group={} backend_miner_ids={} backend_worker_hints={}",
        session_group_name(config.user_default_group),
        config.backend_miner_ids.len(),
        config.backend_worker_hints.join("|")
    );
    println!("routing_log_every={}", config.routing_log_every);
    if let Some(metrics_bind) = config.routing_metrics_bind.as_deref() {
        println!("routing_metrics_bind={metrics_bind}");
        let routing_stats = Arc::clone(&routing_stats);
        let metrics_bind = metrics_bind.to_string();
        thread::spawn(move || {
            if let Err(error) = serve_routing_metrics(&metrics_bind, routing_stats) {
                eprintln!("routing_metrics_error={error:#}");
            }
        });
    }
    {
        let scheduler = revenue_scheduler.lock().expect("revenue scheduler lock poisoned");
        println!(
            "revenue_mode={} lanes={} plan={} backend_auto_include_zion={}",
            if scheduler.multistream_enabled {
                "multistream"
            } else {
                "single"
            },
            scheduler.lanes.len(),
            scheduler.describe_plan(),
            scheduler.auto_assign_include_zion
        );
    }

    let mut handles = Vec::new();
    let mut accepted = 0u32;
    loop {
        if matches!(config.accept_limit, Some(limit) if accepted >= limit) {
            break;
        }

        let (stream, peer_addr) = listener.accept().context("failed to accept miner connection")?;
        println!("peer_addr={peer_addr}");
        let pool = Arc::clone(&pool);
        let revenue_scheduler = Arc::clone(&revenue_scheduler);
        let routing_stats = Arc::clone(&routing_stats);
        let config = config.clone();
        handles.push(thread::spawn(move || {
            handle_client(stream, pool, revenue_scheduler, routing_stats, &config)
        }));
        accepted = accepted.saturating_add(1);
    }

    for handle in handles {
        handle.join().map_err(|_| anyhow!("pool client thread panicked"))??;
    }
    {
        let snapshot = routing_stats
            .lock()
            .expect("routing stats lock poisoned")
            .snapshot_line();
        println!("routing_final {snapshot}");
    }
    Ok(())
}

fn handle_client(
    stream: TcpStream,
    pool: Arc<Mutex<MiningPool>>,
    revenue_scheduler: Arc<Mutex<RevenueScheduler>>,
    routing_stats: Arc<Mutex<RoutingStats>>,
    config: &ServerConfig,
) -> Result<()> {
    let reader_stream = stream.try_clone().context("failed to clone tcp stream")?;
    let mut reader = BufReader::new(reader_stream);
    let mut writer = stream;

    let (hello_line, hello_message) = read_wire_message(&mut reader)?;
    println!("wire_hello={}", hello_line);

    let (miner_id, worker_name, algorithm) = match hello_message {
        PoolMessage::Hello {
            miner_id,
            worker_name,
            algorithm,
            ..
        } => (miner_id, worker_name, algorithm),
        other => return Err(anyhow!("expected hello from miner, got {other:?}")),
    };

    if algorithm != zion_core::consensus_profile() {
        return Err(anyhow!(
            "unsupported miner algorithm: expected {}, got {}",
            zion_core::consensus_profile(),
            algorithm
        ));
    }

    let requested_group = resolve_session_group(&miner_id, &worker_name, config);
    let session_group = if requested_group == SessionGroup::Auto {
        revenue_scheduler
            .lock()
            .expect("revenue scheduler lock poisoned")
            .assign_auto_group()
    } else {
        requested_group
    };
    println!(
        "session_group_requested={} session_group={} miner_id={} worker_name={}",
        session_group_name(requested_group),
        session_group_name(session_group),
        miner_id,
        worker_name
    );

    let welcome_message = pool.lock().expect("pool lock poisoned").welcome_message();
    let welcome_line = write_wire_message(&mut writer, &welcome_message)?;
    println!("wire_welcome={welcome_line}");

    for iteration in 0..config.loop_count {
        let stale_job_ids = pool.lock().expect("pool lock poisoned").expire_stale_jobs();
        for stale_job_id in stale_job_ids {
            let stale_message = pool.lock().expect("pool lock poisoned").stale_message(stale_job_id);
            let cancel_message = pool
                .lock()
                .expect("pool lock poisoned")
                .cancel_message(stale_job_id, "stale-ttl-expired");
            let stale_line = write_wire_message(&mut writer, &stale_message)?;
            let cancel_line = write_wire_message(
                &mut writer,
                &cancel_message,
            )?;
            println!("wire_stale={stale_line}");
            println!("wire_cancel={cancel_line}");
        }

        let start_nonce = config
            .start_nonce
            .wrapping_add((iteration as u64).wrapping_mul(config.nonce_stride));
        let job = match config.node_rpc_addr.as_deref() {
            Some(node_rpc_addr) => {
                let template = fetch_node_template(node_rpc_addr)?;
                pool.lock()
                    .expect("pool lock poisoned")
                    .issue_job_from_template(&template, start_nonce, config.nonce_count)
                    .map_err(|reason| anyhow!(reason))?
            }
            None => {
                let header = MiningHeader {
                    version: 3,
                    previous_hash: [0x11; 32],
                    merkle_root: [0x22; 32],
                    timestamp: config.timestamp + iteration as u64,
                    difficulty_bits: 0x1f00ffff,
                };
                pool.lock()
                    .expect("pool lock poisoned")
                    .issue_job(header, config.target, start_nonce, config.nonce_count)
            }
        };
        let job_message = pool.lock().expect("pool lock poisoned").job_message(job);
        let job_line = write_wire_message(&mut writer, &job_message)?;

        println!("iteration={}", iteration + 1);
        println!("issued_job_id={}", job.job_id);
        println!("wire_job={job_line}");

        let (submit_line, submit_message) = read_wire_message(&mut reader)?;
        println!("wire_submit={submit_line}");

        let (decision, routed_source) = match submit_message {
            PoolMessage::Submit {
                job_id,
                miner_id: submit_miner_id,
                worker_name: submit_worker_name,
                nonce,
                hash_hex,
            } => {
                if submit_miner_id != miner_id || submit_worker_name != worker_name {
                    println!(
                        "submit_identity_mismatch session={}/{} submit={}/{}; using session identity",
                        miner_id, worker_name, submit_miner_id, submit_worker_name
                    );
                }
                let solution = MiningSolution {
                    job_id,
                    candidate: zion_core::BlockCandidate {
                        header: job.header,
                        nonce,
                        height: job.height,
                    },
                    hash: parse_hash_hex(&hash_hex)?,
                };
                let (revenue_source, revenue_value_usd) = revenue_scheduler
                    .lock()
                    .expect("revenue scheduler lock poisoned")
                    .next_lane_for_group(session_group);
                let node_rpc_addr = config.node_rpc_addr.clone();
                let decision = pool.lock().expect("pool lock poisoned").submit_solution_with(
                    miner_id.clone(),
                    worker_name.clone(),
                    solution,
                    revenue_source,
                    revenue_value_usd,
                    move |job, solution, _sealed_block| match node_rpc_addr.as_deref() {
                        Some(node_rpc_addr) => {
                            match submit_candidate_to_node(node_rpc_addr, job, solution.candidate.nonce) {
                                Ok(RpcResponse::SubmitResult {
                                    accepted: true, ..
                                }) => ShareStatus::Accepted,
                                Ok(RpcResponse::SubmitResult {
                                    accepted: false,
                                    reason,
                                    ..
                                }) => map_node_rejection(reason.as_deref()),
                                Ok(other) => {
                                    println!("node_rpc_unexpected={other:?}");
                                    ShareStatus::UpstreamRejected
                                }
                                Err(error) => {
                                    println!("node_rpc_error={error:#}");
                                    ShareStatus::UpstreamRejected
                                }
                            }
                        }
                        None => ShareStatus::Accepted,
                    },
                );
                (decision, revenue_source)
            }
            other => return Err(anyhow!("expected submit from miner, got {other:?}")),
        };

        let accepted = matches!(decision.status, ShareStatus::Accepted);
        {
            let mut stats = routing_stats.lock().expect("routing stats lock poisoned");
            let should_log = stats.record(session_group, routed_source, accepted);
            if should_log {
                println!("routing_snapshot {}", stats.snapshot_line());
            }
        }

        if matches!(decision.status, ShareStatus::StaleJob) {
            let stale_message = pool.lock().expect("pool lock poisoned").stale_message(job.job_id);
            let cancel_message = pool
                .lock()
                .expect("pool lock poisoned")
                .cancel_message(job.job_id, "submit-arrived-after-ttl");
            let stale_line = write_wire_message(&mut writer, &stale_message)?;
            let cancel_line = write_wire_message(
                &mut writer,
                &cancel_message,
            )?;
            println!("wire_stale={stale_line}");
            println!("wire_cancel={cancel_line}");
        }

        let result_message = pool.lock().expect("pool lock poisoned").result_message(&decision);
        let result_line = write_wire_message(&mut writer, &result_message)?;
        println!("share_status={:?}", decision.status);
        println!("wire_result={result_line}");
    }

    let bye_message = pool.lock().expect("pool lock poisoned").bye_message();
    let bye_line = write_wire_message(&mut writer, &bye_message)?;
    println!("session_miner_id={miner_id}");
    println!("session_worker_name={worker_name}");
    println!("wire_bye={bye_line}");
    Ok(())
}

fn read_wire_message(reader: &mut impl BufRead) -> Result<(String, PoolMessage)> {
    let mut line = String::new();
    let read = reader
        .read_line(&mut line)
        .context("failed to read wire message")?;
    if read == 0 {
        return Err(anyhow!("peer closed the connection"));
    }
    let message = decode_message(&line).context("failed to decode wire message")?;
    Ok((line.trim().to_string(), message))
}

fn write_wire_message(writer: &mut impl Write, message: &PoolMessage) -> Result<String> {
    let line = encode_message(message).context("failed to encode wire message")?;
    writer
        .write_all(line.as_bytes())
        .context("failed to write wire message")?;
    writer.flush().context("failed to flush wire message")?;
    Ok(line.trim().to_string())
}

fn fetch_node_template(node_rpc_addr: &str) -> Result<BlockTemplate> {
    match rpc_roundtrip(node_rpc_addr, &RpcRequest::GetTemplate)? {
        RpcResponse::Template { template } => Ok(template),
        other => Err(anyhow!("expected template response from node, got {other:?}")),
    }
}

fn submit_candidate_to_node(
    node_rpc_addr: &str,
    job: zion_core::MiningJob,
    nonce: u64,
) -> Result<RpcResponse> {
    rpc_roundtrip(
        node_rpc_addr,
        &RpcRequest::SubmitCandidate {
            template_id: job.job_id,
            header_hex: to_hex(&job.header.to_bytes()),
            nonce,
            target_hex: to_hex(&job.target.bytes),
        },
    )
}

fn rpc_roundtrip(node_rpc_addr: &str, request: &RpcRequest) -> Result<RpcResponse> {
    let mut stream = TcpStream::connect(node_rpc_addr)
        .with_context(|| format!("failed to connect to node rpc at {node_rpc_addr}"))?;
    let request_line = encode_rpc_request(request).context("failed to encode node rpc request")?;
    stream
        .write_all(request_line.as_bytes())
        .context("failed to write node rpc request")?;
    stream.flush().context("failed to flush node rpc request")?;

    let mut reader = BufReader::new(stream);
    let mut response_line = String::new();
    let read = reader
        .read_line(&mut response_line)
        .context("failed to read node rpc response")?;
    if read == 0 {
        return Err(anyhow!("node rpc closed the connection"));
    }

    decode_rpc_response(&response_line).context("failed to decode node rpc response")
}

fn map_node_rejection(reason: Option<&str>) -> ShareStatus {
    match reason {
        Some(reason) if reason.contains("stale template") => ShareStatus::StaleJob,
        Some(reason) if reason.contains("does not match") => ShareStatus::JobMismatch,
        Some(reason) if reason.contains("low difficulty") => ShareStatus::RejectedLowDifficulty,
        _ => ShareStatus::UpstreamRejected,
    }
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
}

fn parse_hash_hex(raw: &str) -> Result<[u8; 32]> {
    parse_fixed_hex::<32>(raw, "submit hash")
}

fn parse_fixed_hex<const N: usize>(raw: &str, label: &str) -> Result<[u8; N]> {
    let normalized = raw.trim().trim_start_matches("0x");
    if normalized.len() != N * 2 {
        return Err(anyhow!("{label} must be exactly {} hex chars", N * 2));
    }

    let mut bytes = [0u8; N];
    for (index, chunk) in normalized.as_bytes().chunks(2).enumerate() {
        let pair = std::str::from_utf8(chunk).with_context(|| format!("{label} is not valid utf-8"))?;
        bytes[index] = u8::from_str_radix(pair, 16)
            .with_context(|| format!("invalid hex byte '{pair}' in {label}"))?;
    }
    Ok(bytes)
}

#[derive(Debug, Clone)]
struct ServerConfig {
    bind_addr: String,
    accept_limit: Option<u32>,
    node_rpc_addr: Option<String>,
    loop_count: u32,
    job_ttl_ms: u64,
    start_nonce: u64,
    nonce_count: u64,
    nonce_stride: u64,
    timestamp: u64,
    target: DifficultyTarget,
    revenue_source: RevenueSource,
    revenue_value_usd: f64,
    user_default_group: SessionGroup,
    backend_miner_ids: Vec<String>,
    backend_worker_hints: Vec<String>,
    routing_log_every: u64,
    routing_metrics_bind: Option<String>,
}

#[derive(Debug)]
struct RoutingStats {
    log_every: u64,
    total_submits: u64,
    total_accepted: u64,
    group_submits: [u64; 4],
    group_accepted: [u64; 4],
    source_submits: [u64; 6],
    source_accepted: [u64; 6],
}

#[derive(Debug, Clone, Copy)]
struct RevenueLane {
    source: RevenueSource,
    value_usd: f64,
    weight: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SessionGroup {
    Zion,
    Revenue,
    Ncl,
    Auto,
}

#[derive(Debug)]
struct RevenueScheduler {
    lanes: Vec<RevenueLane>,
    total_weight: u32,
    cursor: u32,
    auto_assign_cursor: u32,
    auto_assign_include_zion: bool,
    default_value_usd: f64,
    multistream_enabled: bool,
}

impl RevenueScheduler {
    fn from_env(default_source: RevenueSource, default_value_usd: f64) -> Result<Self> {
        let enabled = parse_env_bool("ZION_REVENUE_MULTISTREAM", false);
        if !enabled {
            return Ok(Self {
                lanes: vec![RevenueLane {
                    source: default_source,
                    value_usd: default_value_usd,
                    weight: 100,
                }],
                total_weight: 100,
                cursor: 0,
                auto_assign_cursor: 0,
                auto_assign_include_zion: parse_env_bool("ZION_BACKEND_AUTO_INCLUDE_ZION", false),
                default_value_usd,
                multistream_enabled: false,
            });
        }

        let mut lanes = Vec::new();
        // Canonical pool-side 50/25/25 distribution.
        push_lane_from_env(
            &mut lanes,
            RevenueSource::Zion,
            "ZION_STREAM_ZION_PCT",
            "ZION_STREAM_ZION_USD",
            50,
            default_value_usd,
        )?;
        push_lane_from_env(
            &mut lanes,
            RevenueSource::Blake3External,
            "ZION_STREAM_BLAKE3_PCT",
            "ZION_STREAM_BLAKE3_USD",
            25,
            default_value_usd,
        )?;
        push_lane_from_env(
            &mut lanes,
            RevenueSource::NclAi,
            "ZION_STREAM_NCL_PCT",
            "ZION_STREAM_NCL_USD",
            25,
            default_value_usd,
        )?;

        let total_weight: u32 = lanes.iter().map(|l| l.weight).sum();
        if total_weight == 0 {
            return Err(anyhow!(
                "ZION_REVENUE_MULTISTREAM=true but all stream weights are zero"
            ));
        }

        Ok(Self {
            lanes,
            total_weight,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: parse_env_bool("ZION_BACKEND_AUTO_INCLUDE_ZION", false),
            default_value_usd,
            multistream_enabled: true,
        })
    }

    fn assign_auto_group(&mut self) -> SessionGroup {
        let mut choices: Vec<(SessionGroup, u32)> = Vec::new();
        for lane in &self.lanes {
            if lane.weight == 0 {
                continue;
            }
            match lane.source {
                RevenueSource::Zion => {
                    if self.auto_assign_include_zion {
                        choices.push((SessionGroup::Zion, lane.weight));
                    }
                }
                RevenueSource::Blake3External => choices.push((SessionGroup::Revenue, lane.weight)),
                RevenueSource::NclAi => choices.push((SessionGroup::Ncl, lane.weight)),
                _ => {}
            }
        }

        if choices.is_empty() {
            return SessionGroup::Zion;
        }

        let total: u32 = choices.iter().map(|(_, w)| *w).sum();
        if total == 0 {
            return SessionGroup::Zion;
        }

        let mut position = self.auto_assign_cursor % total;
        self.auto_assign_cursor = self.auto_assign_cursor.wrapping_add(1);
        for (group, weight) in choices {
            if position < weight {
                return group;
            }
            position -= weight;
        }

        SessionGroup::Zion
    }

    fn next_lane(&mut self) -> (RevenueSource, f64) {
        if self.lanes.len() == 1 {
            let lane = self.lanes[0];
            return (lane.source, lane.value_usd);
        }

        let mut position = self.cursor % self.total_weight;
        self.cursor = self.cursor.wrapping_add(1);
        for lane in &self.lanes {
            if position < lane.weight {
                return (lane.source, lane.value_usd);
            }
            position -= lane.weight;
        }

        let lane = self.lanes[0];
        (lane.source, lane.value_usd)
    }

    fn next_lane_for_group(&mut self, group: SessionGroup) -> (RevenueSource, f64) {
        match group {
            SessionGroup::Zion => (
                RevenueSource::Zion,
                self.value_for_source(RevenueSource::Zion)
                    .unwrap_or(self.default_value_usd),
            ),
            SessionGroup::Revenue => (
                RevenueSource::Blake3External,
                self.value_for_source(RevenueSource::Blake3External)
                    .unwrap_or(self.default_value_usd),
            ),
            SessionGroup::Ncl => (
                RevenueSource::NclAi,
                self.value_for_source(RevenueSource::NclAi)
                    .unwrap_or(self.default_value_usd),
            ),
            SessionGroup::Auto => self.next_lane(),
        }
    }

    fn value_for_source(&self, source: RevenueSource) -> Option<f64> {
        self.lanes
            .iter()
            .find(|lane| lane.source == source)
            .map(|lane| lane.value_usd)
    }

    fn describe_plan(&self) -> String {
        self.lanes
            .iter()
            .map(|lane| {
                format!(
                    "{}:{}%:${:.2}",
                    revenue_source_name(lane.source),
                    lane.weight,
                    lane.value_usd
                )
            })
            .collect::<Vec<_>>()
            .join(",")
    }
}

impl RoutingStats {
    fn new(log_every: u64) -> Self {
        Self {
            log_every,
            total_submits: 0,
            total_accepted: 0,
            group_submits: [0; 4],
            group_accepted: [0; 4],
            source_submits: [0; 6],
            source_accepted: [0; 6],
        }
    }

    fn record(&mut self, group: SessionGroup, source: RevenueSource, accepted: bool) -> bool {
        self.total_submits = self.total_submits.saturating_add(1);
        self.group_submits[group_index(group)] =
            self.group_submits[group_index(group)].saturating_add(1);
        self.source_submits[source_index(source)] =
            self.source_submits[source_index(source)].saturating_add(1);

        if accepted {
            self.total_accepted = self.total_accepted.saturating_add(1);
            self.group_accepted[group_index(group)] =
                self.group_accepted[group_index(group)].saturating_add(1);
            self.source_accepted[source_index(source)] =
                self.source_accepted[source_index(source)].saturating_add(1);
        }

        self.log_every > 0 && self.total_submits % self.log_every == 0
    }

    fn snapshot_line(&self) -> String {
        let total = self.total_submits.max(1);
        let total_rejected = self.total_submits.saturating_sub(self.total_accepted);
        let total_accept_rate = self.total_accepted as f64 * 100.0 / total as f64;

        let mut out = String::new();
        let _ = write!(
            out,
            "submits={} accepted={} rejected={} accept_rate={:.2}%",
            self.total_submits, self.total_accepted, total_rejected, total_accept_rate
        );

        for group in [
            SessionGroup::Zion,
            SessionGroup::Revenue,
            SessionGroup::Ncl,
            SessionGroup::Auto,
        ] {
            let idx = group_index(group);
            let submits = self.group_submits[idx];
            let accepted = self.group_accepted[idx];
            let pct = submits as f64 * 100.0 / total as f64;
            let _ = write!(
                out,
                " {}={{submits:{},accepted:{},pct:{:.1}%}}",
                session_group_name(group),
                submits,
                accepted,
                pct
            );
        }

        for source in [
            RevenueSource::Zion,
            RevenueSource::Blake3External,
            RevenueSource::NclAi,
        ] {
            let idx = source_index(source);
            let submits = self.source_submits[idx];
            let accepted = self.source_accepted[idx];
            let pct = submits as f64 * 100.0 / total as f64;
            let _ = write!(
                out,
                " src_{}={{submits:{},accepted:{},pct:{:.1}%}}",
                revenue_source_name(source),
                submits,
                accepted,
                pct
            );
        }

        out
    }

    fn snapshot_json(&self) -> String {
        let total_rejected = self.total_submits.saturating_sub(self.total_accepted);
        let accept_rate = if self.total_submits == 0 {
            0.0
        } else {
            self.total_accepted as f64 * 100.0 / self.total_submits as f64
        };

        format!(
            "{{\"submits\":{},\"accepted\":{},\"rejected\":{},\"accept_rate_pct\":{:.2},\"groups\":{{\"zion\":{{\"submits\":{},\"accepted\":{}}},\"revenue\":{{\"submits\":{},\"accepted\":{}}},\"ncl\":{{\"submits\":{},\"accepted\":{}}},\"auto\":{{\"submits\":{},\"accepted\":{}}}}},\"sources\":{{\"zion\":{{\"submits\":{},\"accepted\":{}}},\"blake3\":{{\"submits\":{},\"accepted\":{}}},\"ncl\":{{\"submits\":{},\"accepted\":{}}}}}}}",
            self.total_submits,
            self.total_accepted,
            total_rejected,
            accept_rate,
            self.group_submits[group_index(SessionGroup::Zion)],
            self.group_accepted[group_index(SessionGroup::Zion)],
            self.group_submits[group_index(SessionGroup::Revenue)],
            self.group_accepted[group_index(SessionGroup::Revenue)],
            self.group_submits[group_index(SessionGroup::Ncl)],
            self.group_accepted[group_index(SessionGroup::Ncl)],
            self.group_submits[group_index(SessionGroup::Auto)],
            self.group_accepted[group_index(SessionGroup::Auto)],
            self.source_submits[source_index(RevenueSource::Zion)],
            self.source_accepted[source_index(RevenueSource::Zion)],
            self.source_submits[source_index(RevenueSource::Blake3External)],
            self.source_accepted[source_index(RevenueSource::Blake3External)],
            self.source_submits[source_index(RevenueSource::NclAi)],
            self.source_accepted[source_index(RevenueSource::NclAi)],
        )
    }
}

fn serve_routing_metrics(bind_addr: &str, routing_stats: Arc<Mutex<RoutingStats>>) -> Result<()> {
    let listener = TcpListener::bind(bind_addr)
        .with_context(|| format!("failed to bind routing metrics listener on {bind_addr}"))?;

    for stream in listener.incoming() {
        let mut stream = match stream {
            Ok(stream) => stream,
            Err(error) => {
                eprintln!("routing_metrics_accept_error={error}");
                continue;
            }
        };

        let payload = {
            let stats = routing_stats
                .lock()
                .expect("routing stats lock poisoned");
            stats.snapshot_json()
        };

        if let Err(error) = stream.write_all(payload.as_bytes()) {
            eprintln!("routing_metrics_write_error={error}");
            continue;
        }
        if let Err(error) = stream.write_all(b"\n") {
            eprintln!("routing_metrics_newline_error={error}");
        }
    }

    Ok(())
}

fn group_index(group: SessionGroup) -> usize {
    match group {
        SessionGroup::Zion => 0,
        SessionGroup::Revenue => 1,
        SessionGroup::Ncl => 2,
        SessionGroup::Auto => 3,
    }
}

fn source_index(source: RevenueSource) -> usize {
    match source {
        RevenueSource::Zion => 0,
        RevenueSource::KeccakBonus => 1,
        RevenueSource::Sha3Bonus => 2,
        RevenueSource::ProfitSwitch => 3,
        RevenueSource::Blake3External => 4,
        RevenueSource::NclAi => 5,
    }
}

fn revenue_source_name(source: RevenueSource) -> &'static str {
    match source {
        RevenueSource::Zion => "zion",
        RevenueSource::KeccakBonus => "keccak",
        RevenueSource::Sha3Bonus => "sha3",
        RevenueSource::ProfitSwitch => "profit",
        RevenueSource::Blake3External => "blake3",
        RevenueSource::NclAi => "ncl",
    }
}

fn push_lane_from_env(
    lanes: &mut Vec<RevenueLane>,
    source: RevenueSource,
    weight_key: &str,
    value_key: &str,
    default_weight: u32,
    default_value_usd: f64,
) -> Result<()> {
    let weight = parse_env_u32(weight_key, default_weight)?;
    if weight == 0 {
        return Ok(());
    }
    let value_usd = parse_env_f64(value_key, default_value_usd)?;
    lanes.push(RevenueLane {
        source,
        value_usd,
        weight,
    });
    Ok(())
}

impl ServerConfig {
    fn from_env() -> Result<Self> {
        Ok(Self {
            bind_addr: env_or_default("ZION_POOL_BIND", "127.0.0.1:8444"),
            accept_limit: parse_optional_env_u32("ZION_ACCEPT_LIMIT")?,
            node_rpc_addr: std::env::var("ZION_NODE_RPC_ADDR").ok(),
            loop_count: parse_env_u32("ZION_POOL_LOOP_COUNT", 1)?,
            job_ttl_ms: parse_env_u64("ZION_JOB_TTL_MS", 15_000)?,
            start_nonce: parse_env_u64("ZION_START_NONCE", 42)?,
            nonce_count: parse_env_u64("ZION_NONCE_COUNT", 1024)?,
            nonce_stride: parse_env_u64("ZION_NONCE_STRIDE", 1_024)?,
            timestamp: parse_env_u64("ZION_TIMESTAMP", 1_762_000_200)?,
            target: parse_target_env("ZION_TARGET")?,
            revenue_source: parse_revenue_source(
                &std::env::var("ZION_REVENUE_SOURCE").unwrap_or_else(|_| "zion".to_string()),
            )?,
            revenue_value_usd: parse_env_f64("ZION_REVENUE_USD", 1.25)?,
            user_default_group: parse_session_group(
                &std::env::var("ZION_USER_DEFAULT_GROUP")
                    .unwrap_or_else(|_| "zion".to_string()),
            )?,
            backend_miner_ids: parse_env_csv_lower("ZION_BACKEND_MINER_IDS"),
            backend_worker_hints: {
                let values = parse_env_csv_lower("ZION_BACKEND_WORKER_HINTS");
                if values.is_empty() {
                    vec!["backend".to_string(), "revenue".to_string(), "ncl".to_string()]
                } else {
                    values
                }
            },
            routing_log_every: parse_env_u64("ZION_ROUTING_LOG_EVERY", 25)?,
            routing_metrics_bind: parse_optional_env_string("ZION_ROUTING_METRICS_BIND"),
        })
    }
}

fn parse_optional_env_string(key: &str) -> Option<String> {
    match std::env::var(key) {
        Ok(value) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        Err(_) => None,
    }
}

fn resolve_session_group(miner_id: &str, worker_name: &str, config: &ServerConfig) -> SessionGroup {
    if let Some(group) = extract_group_hint(worker_name).or_else(|| extract_group_hint(miner_id)) {
        return group;
    }

    let miner_id_lc = miner_id.trim().to_ascii_lowercase();
    if !miner_id_lc.is_empty() && config.backend_miner_ids.iter().any(|id| id == &miner_id_lc) {
        return SessionGroup::Auto;
    }

    let worker_name_lc = worker_name.to_ascii_lowercase();
    if config
        .backend_worker_hints
        .iter()
        .any(|hint| !hint.is_empty() && worker_name_lc.contains(hint.as_str()))
    {
        return SessionGroup::Auto;
    }

    config.user_default_group
}

fn extract_group_hint(raw: &str) -> Option<SessionGroup> {
    let lower = raw.to_ascii_lowercase();
    if lower.contains("g=zion") || lower.contains("group=zion") {
        return Some(SessionGroup::Zion);
    }
    if lower.contains("g=revenue") || lower.contains("group=revenue") {
        return Some(SessionGroup::Revenue);
    }
    if lower.contains("g=ncl") || lower.contains("group=ncl") {
        return Some(SessionGroup::Ncl);
    }
    if lower.contains("g=auto") || lower.contains("group=auto") {
        return Some(SessionGroup::Auto);
    }
    None
}

fn session_group_name(group: SessionGroup) -> &'static str {
    match group {
        SessionGroup::Zion => "zion",
        SessionGroup::Revenue => "revenue",
        SessionGroup::Ncl => "ncl",
        SessionGroup::Auto => "auto",
    }
}

fn env_or_default(key: &str, default: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| default.to_string())
}

fn parse_env_u64(key: &str, default: u64) -> Result<u64> {
    match std::env::var(key) {
        Ok(value) => value
            .parse::<u64>()
            .with_context(|| format!("invalid u64 in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn parse_env_u32(key: &str, default: u32) -> Result<u32> {
    match std::env::var(key) {
        Ok(value) => value
            .parse::<u32>()
            .with_context(|| format!("invalid u32 in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn parse_env_f64(key: &str, default: f64) -> Result<f64> {
    match std::env::var(key) {
        Ok(value) => value
            .parse::<f64>()
            .with_context(|| format!("invalid f64 in {key}: {value}")),
        Err(_) => Ok(default),
    }
}

fn parse_target_env(key: &str) -> Result<DifficultyTarget> {
    let raw = match std::env::var(key) {
        Ok(value) => value,
        Err(_) => return Ok(DifficultyTarget::MAX),
    };

    Ok(DifficultyTarget {
        bytes: parse_fixed_hex::<32>(&raw, key)?,
    })
}

fn parse_revenue_source(value: &str) -> Result<RevenueSource> {
    match value.trim().to_ascii_lowercase().as_str() {
        "zion" => Ok(RevenueSource::Zion),
        "keccak" | "keccak_bonus" => Ok(RevenueSource::KeccakBonus),
        "sha3" | "sha3_bonus" => Ok(RevenueSource::Sha3Bonus),
        "profit" | "profit_switch" => Ok(RevenueSource::ProfitSwitch),
        "blake3" | "blake3_external" | "dcr" | "alph" => Ok(RevenueSource::Blake3External),
        "ncl" | "ncl_ai" => Ok(RevenueSource::NclAi),
        other => Err(anyhow!("unsupported revenue source: {other}")),
    }
}

fn parse_session_group(value: &str) -> Result<SessionGroup> {
    match value.trim().to_ascii_lowercase().as_str() {
        "zion" => Ok(SessionGroup::Zion),
        "revenue" => Ok(SessionGroup::Revenue),
        "ncl" => Ok(SessionGroup::Ncl),
        "auto" => Ok(SessionGroup::Auto),
        other => Err(anyhow!("unsupported session group: {other}")),
    }
}

fn parse_env_csv_lower(key: &str) -> Vec<String> {
    match std::env::var(key) {
        Ok(raw) => raw
            .split(',')
            .map(|entry| entry.trim().to_ascii_lowercase())
            .filter(|entry| !entry.is_empty())
            .collect(),
        Err(_) => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::SocketAddr;
    use std::sync::{Mutex, OnceLock};
    use std::thread;

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn sample_template() -> BlockTemplate {
        let header = MiningHeader {
            version: 3,
            previous_hash: [0x31; 32],
            merkle_root: [0x42; 32],
            timestamp: 1_762_100_100,
            difficulty_bits: 0x1f00ffff,
        };

        BlockTemplate {
            template_id: 91,
            height: 2,
            header_hex: to_hex(&header.to_bytes()),
            target_hex: DifficultyTarget::MAX.to_hex(),
            reward_zion: 5_400,
            transaction_ids: Vec::new(),
            transaction_count: 0,
            total_fees_zion: 0,
            body_hash_hex: "00".repeat(32),
            estimated_miner_reward_zion: 5_400,
            utxo_transaction_ids: Vec::new(),
            utxo_transaction_count: 0,
            total_utxo_fees: 0,
        }
    }

    fn spawn_mock_node(
        submit_response: RpcResponse,
    ) -> Result<(String, thread::JoinHandle<Result<Vec<RpcRequest>>>)> {
        let listener = TcpListener::bind("127.0.0.1:0").context("bind mock node")?;
        let addr = listener.local_addr().context("mock node addr")?;
        let template = sample_template();

        let handle = thread::spawn(move || -> Result<Vec<RpcRequest>> {
            let mut requests = Vec::new();
            for response in [
                RpcResponse::Template {
                    template: template.clone(),
                },
                submit_response,
            ] {
                let (stream, _) = listener.accept().context("accept mock node client")?;
                let reader_stream = stream.try_clone().context("clone mock node stream")?;
                let mut reader = BufReader::new(reader_stream);
                let mut writer = stream;

                let mut line = String::new();
                let read = reader
                    .read_line(&mut line)
                    .context("read mock node request")?;
                if read == 0 {
                    return Err(anyhow!("mock node client closed before request"));
                }

                requests.push(
                    zion_core::decode_rpc_request(&line).context("decode mock node request")?,
                );

                let response_line =
                    zion_core::encode_rpc_response(&response).context("encode mock node response")?;
                writer
                    .write_all(response_line.as_bytes())
                    .context("write mock node response")?;
                writer.flush().context("flush mock node response")?;
            }
            Ok(requests)
        });

        Ok((addr.to_string(), handle))
    }

    fn spawn_pool_server(config: ServerConfig) -> Result<(SocketAddr, thread::JoinHandle<Result<()>>)> {
        let listener = TcpListener::bind("127.0.0.1:0").context("bind pool test listener")?;
        let addr = listener.local_addr().context("pool test addr")?;
        let pool = Arc::new(Mutex::new(MiningPool::with_job_ttl(
            CoreRuntime::default(),
            config.job_ttl_ms,
        )));
        let revenue_scheduler = Arc::new(Mutex::new(RevenueScheduler::from_env(
            config.revenue_source,
            config.revenue_value_usd,
        )?));
        let routing_stats = Arc::new(Mutex::new(RoutingStats::new(config.routing_log_every)));

        let handle = thread::spawn(move || -> Result<()> {
            let (stream, _) = listener.accept().context("accept pool test client")?;
            handle_client(stream, pool, revenue_scheduler, routing_stats, &config)
        });

        Ok((addr, handle))
    }

    fn run_bridge_session(submit_response: RpcResponse) -> Result<(Vec<PoolMessage>, Vec<RpcRequest>)> {
        let (node_rpc_addr, node_handle) = spawn_mock_node(submit_response)?;
        let config = ServerConfig {
            bind_addr: "127.0.0.1:0".to_string(),
            accept_limit: Some(1),
            node_rpc_addr: Some(node_rpc_addr),
            loop_count: 1,
            job_ttl_ms: 15_000,
            start_nonce: 42,
            nonce_count: 64,
            nonce_stride: 64,
            timestamp: 1_762_100_200,
            target: DifficultyTarget::MAX,
            revenue_source: RevenueSource::Zion,
            revenue_value_usd: 1.25,
            user_default_group: SessionGroup::Zion,
            backend_miner_ids: Vec::new(),
            backend_worker_hints: Vec::new(),
            routing_log_every: 0,
            routing_metrics_bind: None,
        };
        let (pool_addr, pool_handle) = spawn_pool_server(config)?;

        let mut stream = TcpStream::connect(pool_addr).context("connect test miner to pool")?;
        let reader_stream = stream.try_clone().context("clone test miner stream")?;
        let mut reader = BufReader::new(reader_stream);

        write_wire_message(
            &mut stream,
            &PoolMessage::Hello {
                miner_id: "test-miner".to_string(),
                worker_name: "rig-test".to_string(),
                algorithm: zion_core::consensus_profile().to_string(),
            },
        )?;

        let mut messages = Vec::new();
        let (_, welcome) = read_wire_message(&mut reader)?;
        messages.push(welcome);

        let (_, job_message) = read_wire_message(&mut reader)?;
        let job_id = match &job_message {
            PoolMessage::Job { job_id, .. } => *job_id,
            other => return Err(anyhow!("expected job from pool, got {other:?}")),
        };
        messages.push(job_message);

        write_wire_message(
            &mut stream,
            &PoolMessage::Submit {
                job_id,
                miner_id: "test-miner".to_string(),
                worker_name: "rig-test".to_string(),
                nonce: 42,
                hash_hex: "00".repeat(32),
            },
        )?;

        loop {
            let (_, message) = read_wire_message(&mut reader)?;
            let is_bye = matches!(message, PoolMessage::Bye { .. });
            messages.push(message);
            if is_bye {
                break;
            }
        }

        pool_handle
            .join()
            .map_err(|_| anyhow!("pool test thread panicked"))??;
        let requests = node_handle
            .join()
            .map_err(|_| anyhow!("mock node thread panicked"))??;

        Ok((messages, requests))
    }

    #[test]
    fn pool_bridge_maps_stale_template_into_stale_cancel_result_flow() {
        let (messages, requests) = run_bridge_session(RpcResponse::SubmitResult {
            accepted: false,
            template_id: 91,
            block_height: None,
            hash_hex: "ab".repeat(32),
            reason: Some("stale template: expected 92, got 91".to_string()),
        })
        .expect("stale bridge session should succeed");

        assert!(matches!(messages[0], PoolMessage::Welcome { .. }));
        assert!(matches!(messages[1], PoolMessage::Job { job_id: 91, .. }));
        assert!(matches!(messages[2], PoolMessage::Stale { job_id: 91 }));
        assert!(matches!(messages[3], PoolMessage::Cancel { job_id: 91, .. }));
        assert!(matches!(
            messages[4],
            PoolMessage::Result {
                accepted: false,
                ref status
            } if status == "StaleJob"
        ));
        assert!(matches!(
            messages[5],
            PoolMessage::Bye {
                accepted_shares: 0,
                rejected_shares: 1,
                ..
            }
        ));

        assert!(matches!(requests[0], RpcRequest::GetTemplate));
        assert!(matches!(
            requests[1],
            RpcRequest::SubmitCandidate { template_id: 91, nonce: 42, .. }
        ));
    }

    #[test]
    fn pool_bridge_maps_unknown_upstream_rejection_into_rejected_result() {
        let (messages, requests) = run_bridge_session(RpcResponse::SubmitResult {
            accepted: false,
            template_id: 91,
            block_height: None,
            hash_hex: "cd".repeat(32),
            reason: Some("node maintenance window".to_string()),
        })
        .expect("upstream rejection bridge session should succeed");

        assert!(matches!(messages[0], PoolMessage::Welcome { .. }));
        assert!(matches!(messages[1], PoolMessage::Job { job_id: 91, .. }));
        assert!(matches!(
            messages[2],
            PoolMessage::Result {
                accepted: false,
                ref status
            } if status == "UpstreamRejected"
        ));
        assert!(matches!(
            messages[3],
            PoolMessage::Bye {
                accepted_shares: 0,
                rejected_shares: 1,
                ..
            }
        ));

        assert_eq!(requests.len(), 2);
        assert!(matches!(requests[0], RpcRequest::GetTemplate));
        assert!(matches!(
            requests[1],
            RpcRequest::SubmitCandidate { template_id: 91, nonce: 42, .. }
        ));
    }

    #[test]
    fn revenue_scheduler_defaults_to_single_lane() {
        let _guard = env_lock().lock().expect("env lock");
        std::env::remove_var("ZION_REVENUE_MULTISTREAM");
        let scheduler = RevenueScheduler::from_env(RevenueSource::Zion, 1.25).expect("scheduler");
        assert!(!scheduler.multistream_enabled);
        assert_eq!(scheduler.lanes.len(), 1);
        assert_eq!(scheduler.total_weight, 100);
        assert!(scheduler.describe_plan().contains("zion:100%"));
    }

    #[test]
    fn revenue_scheduler_weighted_round_robin() {
        let _guard = env_lock().lock().expect("env lock");
        std::env::set_var("ZION_REVENUE_MULTISTREAM", "true");
        std::env::set_var("ZION_STREAM_ZION_PCT", "2");
        std::env::set_var("ZION_STREAM_BLAKE3_PCT", "1");
        std::env::set_var("ZION_STREAM_NCL_PCT", "1");

        let mut scheduler = RevenueScheduler::from_env(RevenueSource::Zion, 1.0).expect("scheduler");
        let mut picks = Vec::new();
        for _ in 0..4 {
            picks.push(scheduler.next_lane().0);
        }

        assert_eq!(picks[0], RevenueSource::Zion);
        assert_eq!(picks[1], RevenueSource::Zion);
        assert_eq!(picks[2], RevenueSource::Blake3External);
        assert_eq!(picks[3], RevenueSource::NclAi);

        std::env::remove_var("ZION_REVENUE_MULTISTREAM");
        std::env::remove_var("ZION_STREAM_ZION_PCT");
        std::env::remove_var("ZION_STREAM_BLAKE3_PCT");
        std::env::remove_var("ZION_STREAM_NCL_PCT");
    }

    #[test]
    fn resolve_session_group_defaults_to_zion_for_user_sessions() {
        let config = ServerConfig {
            bind_addr: "127.0.0.1:0".to_string(),
            accept_limit: Some(1),
            node_rpc_addr: None,
            loop_count: 1,
            job_ttl_ms: 15_000,
            start_nonce: 1,
            nonce_count: 64,
            nonce_stride: 64,
            timestamp: 1,
            target: DifficultyTarget::MAX,
            revenue_source: RevenueSource::Zion,
            revenue_value_usd: 1.25,
            user_default_group: SessionGroup::Zion,
            backend_miner_ids: vec!["backend-miner-1".to_string()],
            backend_worker_hints: vec!["backend".to_string()],
            routing_log_every: 0,
            routing_metrics_bind: None,
        };

        let group = resolve_session_group("user-miner", "rig-01", &config);
        assert_eq!(group, SessionGroup::Zion);
    }

    #[test]
    fn resolve_session_group_routes_backend_allowlist_to_auto() {
        let config = ServerConfig {
            bind_addr: "127.0.0.1:0".to_string(),
            accept_limit: Some(1),
            node_rpc_addr: None,
            loop_count: 1,
            job_ttl_ms: 15_000,
            start_nonce: 1,
            nonce_count: 64,
            nonce_stride: 64,
            timestamp: 1,
            target: DifficultyTarget::MAX,
            revenue_source: RevenueSource::Zion,
            revenue_value_usd: 1.25,
            user_default_group: SessionGroup::Zion,
            backend_miner_ids: vec!["backend-miner-1".to_string()],
            backend_worker_hints: vec!["backend".to_string()],
            routing_log_every: 0,
            routing_metrics_bind: None,
        };

        let group = resolve_session_group("backend-miner-1", "rig-01", &config);
        assert_eq!(group, SessionGroup::Auto);
    }

    #[test]
    fn resolve_session_group_routes_backend_worker_hint_to_auto() {
        let config = ServerConfig {
            bind_addr: "127.0.0.1:0".to_string(),
            accept_limit: Some(1),
            node_rpc_addr: None,
            loop_count: 1,
            job_ttl_ms: 15_000,
            start_nonce: 1,
            nonce_count: 64,
            nonce_stride: 64,
            timestamp: 1,
            target: DifficultyTarget::MAX,
            revenue_source: RevenueSource::Zion,
            revenue_value_usd: 1.25,
            user_default_group: SessionGroup::Zion,
            backend_miner_ids: vec![],
            backend_worker_hints: vec!["backend".to_string(), "revenue".to_string()],
            routing_log_every: 0,
            routing_metrics_bind: None,
        };

        let group = resolve_session_group("miner-a", "backend-revenue-1", &config);
        assert_eq!(group, SessionGroup::Auto);
    }

    #[test]
    fn revenue_scheduler_group_pin_overrides_round_robin() {
        let mut scheduler = RevenueScheduler {
            lanes: vec![
                RevenueLane {
                    source: RevenueSource::Zion,
                    value_usd: 1.0,
                    weight: 2,
                },
                RevenueLane {
                    source: RevenueSource::Blake3External,
                    value_usd: 2.0,
                    weight: 1,
                },
                RevenueLane {
                    source: RevenueSource::NclAi,
                    value_usd: 3.0,
                    weight: 1,
                },
            ],
            total_weight: 4,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: true,
            default_value_usd: 1.25,
            multistream_enabled: true,
        };

        let (source, usd) = scheduler.next_lane_for_group(SessionGroup::Revenue);
        assert_eq!(source, RevenueSource::Blake3External);
        assert!((usd - 2.0).abs() < f64::EPSILON);

        let (source, usd) = scheduler.next_lane_for_group(SessionGroup::Ncl);
        assert_eq!(source, RevenueSource::NclAi);
        assert!((usd - 3.0).abs() < f64::EPSILON);

        let (source, usd) = scheduler.next_lane_for_group(SessionGroup::Auto);
        assert_eq!(source, RevenueSource::Zion);
        assert!((usd - 1.0).abs() < f64::EPSILON);
    }

    #[test]
    fn routing_stats_tracks_groups_and_sources() {
        let mut stats = RoutingStats::new(2);
        assert!(!stats.record(SessionGroup::Zion, RevenueSource::Zion, true));
        assert!(stats.record(SessionGroup::Auto, RevenueSource::Blake3External, false));

        assert_eq!(stats.total_submits, 2);
        assert_eq!(stats.total_accepted, 1);
        assert_eq!(stats.group_submits[group_index(SessionGroup::Zion)], 1);
        assert_eq!(stats.group_submits[group_index(SessionGroup::Auto)], 1);
        assert_eq!(stats.source_submits[source_index(RevenueSource::Zion)], 1);
        assert_eq!(
            stats.source_submits[source_index(RevenueSource::Blake3External)],
            1
        );

        let snapshot = stats.snapshot_line();
        assert!(snapshot.contains("submits=2 accepted=1 rejected=1"));
        assert!(snapshot.contains("zion={submits:1,accepted:1"));
        assert!(snapshot.contains("auto={submits:1,accepted:0"));

        let snapshot_json = stats.snapshot_json();
        assert!(snapshot_json.contains("\"submits\":2"));
        assert!(snapshot_json.contains("\"groups\""));
        assert!(snapshot_json.contains("\"sources\""));
    }

    #[test]
    fn auto_assignment_is_weighted_and_session_pinned() {
        let mut scheduler = RevenueScheduler {
            lanes: vec![
                RevenueLane {
                    source: RevenueSource::Zion,
                    value_usd: 1.0,
                    weight: 2,
                },
                RevenueLane {
                    source: RevenueSource::Blake3External,
                    value_usd: 2.0,
                    weight: 1,
                },
                RevenueLane {
                    source: RevenueSource::NclAi,
                    value_usd: 3.0,
                    weight: 1,
                },
            ],
            total_weight: 4,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: true,
            default_value_usd: 1.25,
            multistream_enabled: true,
        };

        // Session allocation follows 2:1:1
        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Zion);
        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Zion);
        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Revenue);
        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Ncl);

        // Once session is pinned to revenue, submit routing stays revenue (no per-share rotation).
        let (src1, _) = scheduler.next_lane_for_group(SessionGroup::Revenue);
        let (src2, _) = scheduler.next_lane_for_group(SessionGroup::Revenue);
        assert_eq!(src1, RevenueSource::Blake3External);
        assert_eq!(src2, RevenueSource::Blake3External);
    }

    #[test]
    fn auto_assignment_can_exclude_zion() {
        let mut scheduler = RevenueScheduler {
            lanes: vec![
                RevenueLane {
                    source: RevenueSource::Zion,
                    value_usd: 1.0,
                    weight: 2,
                },
                RevenueLane {
                    source: RevenueSource::Blake3External,
                    value_usd: 2.0,
                    weight: 1,
                },
                RevenueLane {
                    source: RevenueSource::NclAi,
                    value_usd: 3.0,
                    weight: 1,
                },
            ],
            total_weight: 4,
            cursor: 0,
            auto_assign_cursor: 0,
            auto_assign_include_zion: false,
            default_value_usd: 1.25,
            multistream_enabled: true,
        };

        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Revenue);
        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Ncl);
        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Revenue);
        assert_eq!(scheduler.assign_auto_group(), SessionGroup::Ncl);
    }
}

fn parse_optional_env_u32(key: &str) -> Result<Option<u32>> {
    match std::env::var(key) {
        Ok(value) => {
            let parsed = value
                .parse::<u32>()
                .with_context(|| format!("invalid u32 in {key}: {value}"))?;
            if parsed == 0 {
                Ok(None)
            } else {
                Ok(Some(parsed))
            }
        }
        Err(_) => Ok(None),
    }
}

fn parse_env_bool(key: &str, default: bool) -> bool {
    match std::env::var(key) {
        Ok(value) => {
            let normalized = value.trim().to_ascii_lowercase();
            !(normalized == "0"
                || normalized == "false"
                || normalized == "no"
                || normalized == "off")
        }
        Err(_) => default,
    }
}