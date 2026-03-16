use anyhow::{anyhow, Context, Result};
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

    let mut handles = Vec::new();
    let mut accepted = 0u32;
    loop {
        if matches!(config.accept_limit, Some(limit) if accepted >= limit) {
            break;
        }

        let (stream, peer_addr) = listener.accept().context("failed to accept miner connection")?;
        println!("peer_addr={peer_addr}");
        let pool = Arc::clone(&pool);
        let config = config.clone();
        handles.push(thread::spawn(move || handle_client(stream, pool, &config)));
        accepted = accepted.saturating_add(1);
    }

    for handle in handles {
        handle.join().map_err(|_| anyhow!("pool client thread panicked"))??;
    }
    Ok(())
}

fn handle_client(
    stream: TcpStream,
    pool: Arc<Mutex<MiningPool>>,
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

        let decision = match submit_message {
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
                    },
                    hash: parse_hash_hex(&hash_hex)?,
                };
                let node_rpc_addr = config.node_rpc_addr.clone();
                pool.lock().expect("pool lock poisoned").submit_solution_with(
                    miner_id.clone(),
                    worker_name.clone(),
                    solution,
                    config.revenue_source,
                    config.revenue_value_usd,
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
                )
            }
            other => return Err(anyhow!("expected submit from miner, got {other:?}")),
        };

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
        })
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::SocketAddr;
    use std::thread;

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

        let handle = thread::spawn(move || -> Result<()> {
            let (stream, _) = listener.accept().context("accept pool test client")?;
            handle_client(stream, pool, &config)
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