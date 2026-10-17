use anyhow::{anyhow, ensure, Context, Result};
use base64::Engine;
use clap::Parser;
use serde_json::{json, Value};
use std::future::Future;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::task::JoinHandle;
use tokio::time::{sleep_until, timeout, Instant as TokioInstant};

use zion_miner::auxpow::pearl::{
    build_plain_proof, PearlMineConfig, PearlPouwNativeInput, PearlPouwNativeResult,
    PearlSeedDerivation, PEARL_SEED_LABEL_A, PEARL_SEED_LABEL_B,
};
use zion_miner::auxpow::pearl_pool::{PearlPoolClient, PearlPoolJob, PearlPoolResponse};
use zion_miner::gpu::pearl_cuda::PearlCudaMiner;

#[derive(Parser, Debug)]
#[command(name = "pearl_pool_probe")]
#[command(about = "Isolated Pearl PoUW external-pool probe (diagnostic only)")]
struct Args {
    #[arg(long)]
    pool: String,
    #[arg(long)]
    wallet: String,
    #[arg(long, default_value = "zion-prl-cuda-probe")]
    worker: String,
    #[arg(long, default_value = "x")]
    password: String,
    #[arg(long)]
    evidence_dir: PathBuf,
    #[arg(long, default_value_t = 3, value_parser = clap::value_parser!(u64).range(1..))]
    shares: u64,
    #[arg(long, default_value_t = 300, value_parser = clap::value_parser!(u64).range(1..))]
    max_seconds: u64,
    #[arg(long, default_value_t = 250)]
    idle_ms: u64,
    #[arg(long)]
    nonce_start: Option<u64>,
}

type MineTask = JoinHandle<(PearlCudaMiner, Result<Option<PearlPouwNativeResult>>)>;
type Shutdown = Pin<Box<dyn Future<Output = std::io::Result<()>> + Send>>;

#[derive(Default)]
struct Stats {
    completed_attempts: u64,
    submitted_shares: u64,
    accepted_shares: u64,
    rejected_shares: u64,
    stale_results_discarded: u64,
    reject_details: Vec<Value>,
}

enum Flow {
    Continue,
    Stop(&'static str),
}

enum Phase<T> {
    Ready(std::result::Result<T, tokio::task::JoinError>),
    Stopped(&'static str),
}

enum SubmitOutcome {
    Done(Result<PearlPoolResponse>),
    Cancelled(&'static str),
}

enum Bound<T> {
    Done(T),
    Stopped(&'static str),
}

fn map_shutdown(res: std::io::Result<()>) -> &'static str {
    match res {
        Ok(()) => "ctrl_c",
        Err(_) => "signal_error",
    }
}

async fn join_optional<T>(
    slot: &mut Option<JoinHandle<T>>,
) -> std::result::Result<T, tokio::task::JoinError> {
    match slot.as_mut() {
        Some(handle) => handle.await,
        None => std::future::pending().await,
    }
}

async fn stop_ready(deadline: Instant, shutdown: &mut Shutdown) -> Option<&'static str> {
    if Instant::now() >= deadline {
        return Some("deadline");
    }
    tokio::select! {
        biased;
        res = shutdown.as_mut() => Some(map_shutdown(res)),
        _ = std::future::ready(()) => None,
    }
}

async fn bounded<F: Future>(
    fut: F,
    deadline: Instant,
    shutdown: &mut Shutdown,
) -> Bound<F::Output> {
    if let Some(r) = stop_ready(deadline, shutdown).await {
        return Bound::Stopped(r);
    }
    let mut fut = std::pin::pin!(fut);
    tokio::select! {
        biased;
        res = shutdown.as_mut() => Bound::Stopped(map_shutdown(res)),
        _ = sleep_until(TokioInstant::from_std(deadline)) => Bound::Stopped("deadline"),
        res = &mut fut => Bound::Done(res),
    }
}

async fn wait_io<T>(
    client: &mut PearlPoolClient,
    task: &mut JoinHandle<T>,
    deadline: Instant,
    shutdown: &mut Shutdown,
) -> Phase<T> {
    loop {
        if let Some(r) = stop_ready(deadline, shutdown).await {
            return Phase::Stopped(r);
        }
        tokio::select! {
            biased;
            res = shutdown.as_mut() => return Phase::Stopped(map_shutdown(res)),
            _ = sleep_until(TokioInstant::from_std(deadline)) => return Phase::Stopped("deadline"),
            ev = client.next_event() => match ev {
                Ok(e) => println!("pearl_pool_probe: pool event: {e:?}"),
                Err(e) => {
                    println!("pearl_pool_probe: transport error: {e:#}");
                    return Phase::Stopped("transport_error");
                }
            },
            res = &mut *task => return Phase::Ready(res),
        }
    }
}

async fn drain_ready(
    client: &mut PearlPoolClient,
    deadline: Instant,
    shutdown: &mut Shutdown,
) -> Result<Flow> {
    loop {
        if let Some(r) = stop_ready(deadline, shutdown).await {
            return Ok(Flow::Stop(r));
        }
        match timeout(Duration::ZERO, client.next_event()).await {
            Err(_) => return Ok(Flow::Continue),
            Ok(Ok(e)) => println!("pearl_pool_probe: pool event: {e:?}"),
            Ok(Err(e)) => return Err(e),
        }
    }
}

async fn submit_bounded(
    client: &mut PearlPoolClient,
    job_id: &str,
    plain_proof_b64: &str,
    deadline: Instant,
    shutdown: &mut Shutdown,
) -> SubmitOutcome {
    client.reset_submit_state();
    if let Some(r) = stop_ready(deadline, shutdown).await {
        return SubmitOutcome::Cancelled(r);
    }
    tokio::select! {
        biased;
        res = shutdown.as_mut() => SubmitOutcome::Cancelled(map_shutdown(res)),
        _ = sleep_until(TokioInstant::from_std(deadline)) => SubmitOutcome::Cancelled("deadline"),
        res = client.submit_proof(job_id, plain_proof_b64, None) => SubmitOutcome::Done(res),
    }
}

fn write_evidence(dir: &Path, name: &str, value: &Value) -> Result<()> {
    let path = dir.join(name);
    let mut f = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .with_context(|| format!("create {}", path.display()))?;
    f.write_all(serde_json::to_vec_pretty(value)?.as_slice())?;
    Ok(())
}

fn ensure_fresh_dir(dir: &Path) -> Result<()> {
    if dir.exists() {
        let mut entries =
            std::fs::read_dir(dir).with_context(|| format!("read {}", dir.display()))?;
        ensure!(
            entries.next().is_none(),
            "evidence dir {} must be fresh (nonempty)",
            dir.display()
        );
    } else {
        std::fs::create_dir_all(dir).with_context(|| format!("evidence dir {}", dir.display()))?;
    }
    Ok(())
}

fn spawn_attempt(
    mut miner: PearlCudaMiner,
    cfg: PearlMineConfig,
    job_key: [u8; 32],
    target: [u8; 32],
    nonce: u64,
) -> MineTask {
    tokio::task::spawn_blocking(move || {
        let row_offsets = cfg.row_offsets();
        let col_offsets = cfg.col_offsets();
        let rows_base = cfg.rows_base();
        let cols_base = cfg.cols_base();
        let input = PearlPouwNativeInput {
            nonce,
            m: cfg.m,
            n: cfg.n,
            k: cfg.k,
            rank: cfg.rank,
            job_key,
            target,
            row_offsets: &row_offsets,
            col_offsets: &col_offsets,
            rows_base: &rows_base,
            cols_base: &cols_base,
            seed_label_a: PEARL_SEED_LABEL_A,
            seed_label_b: PEARL_SEED_LABEL_B,
            seed_derivation: PearlSeedDerivation::Salted,
        };
        let res = miner.mine_native(&input);
        (miner, res)
    })
}

fn summarize(
    args: &Args,
    stats: &mut Stats,
    start: Instant,
    run: Result<&'static str>,
) -> Result<i32> {
    let stop_reason = match run {
        Ok(r) => r,
        Err(e) => {
            stats.reject_details.push(json!({
                "probe_error": format!("{e:#}"),
            }));
            "probe_error"
        }
    };
    let summary = json!({
        "completed_attempts": stats.completed_attempts,
        "submitted_shares": stats.submitted_shares,
        "accepted_shares": stats.accepted_shares,
        "rejected_shares": stats.rejected_shares,
        "stale_results_discarded": stats.stale_results_discarded,
        "reject_details": stats.reject_details,
        "elapsed_seconds": start.elapsed().as_secs_f64(),
        "stop_reason": stop_reason,
        "node_acceptance": "not_observed",
    });
    write_evidence(&args.evidence_dir, "summary.json", &summary)?;
    println!(
        "pearl_pool_probe: {}",
        serde_json::to_string(&summary).unwrap_or_default()
    );
    let ok = stop_reason == "shares_target_met" && stats.accepted_shares >= args.shares;
    Ok(if ok { 0 } else { 1 })
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    ensure_fresh_dir(&args.evidence_dir)?;

    let start = Instant::now();
    let deadline = start + Duration::from_secs(args.max_seconds);
    let mut stats = Stats::default();
    let mut shutdown: Shutdown = Box::pin(tokio::signal::ctrl_c());

    let run = run_probe(&args, &mut stats, start, deadline, &mut shutdown).await;
    let code = summarize(&args, &mut stats, start, run)?;
    std::process::exit(code);
}

async fn run_probe(
    args: &Args,
    stats: &mut Stats,
    _start: Instant,
    deadline: Instant,
    shutdown: &mut Shutdown,
) -> Result<&'static str> {
    let cfg = PearlMineConfig::from_env()?;
    ensure!(
        (cfg.m, cfg.n, cfg.k, cfg.rank) == (1024, 1024, 2048, 128),
        "probe requires m=n=1024,k=2048,rank=128 (got m={} n={} k={} rank={})",
        cfg.m,
        cfg.n,
        cfg.k,
        cfg.rank
    );

    if let Some(r) = stop_ready(deadline, shutdown).await {
        return Ok(r);
    }
    let mut init_task = tokio::task::spawn_blocking(|| PearlCudaMiner::new(32768));
    let mut miner_slot = match bounded(&mut init_task, deadline, shutdown).await {
        Bound::Done(Ok(Ok(m))) => {
            println!("pearl_pool_probe: backend=cuda device={}", m.device_name());
            Some(m)
        }
        Bound::Done(Ok(Err(e))) => return Err(e).context("CUDA init"),
        Bound::Done(Err(e)) => return Err(anyhow!(e)).context("CUDA init join"),
        Bound::Stopped(r) => {
            let _ = init_task.await;
            return Ok(r);
        }
    };

    let mut client = match bounded(
        PearlPoolClient::connect(&args.pool, &args.wallet, &args.worker, &args.password),
        deadline,
        shutdown,
    )
    .await
    {
        Bound::Done(c) => c?,
        Bound::Stopped(r) => return Ok(r),
    };
    println!(
        "pearl_pool_probe: connected pool={} worker={} latest_job={:?}",
        args.pool,
        args.worker,
        client.latest_job().map(|j| j.job_id)
    );

    let mut nonce = args.nonce_start.unwrap_or_else(|| {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos() as u64)
            .unwrap_or(0)
    });
    let mut attempt: Option<MineTask> = None;
    let mut attempt_job: Option<PearlPoolJob> = None;
    let mut attempt_nonce = 0u64;
    let mut idle_until = Instant::now();
    let mut warned_job: Option<String> = None;

    let stop_reason = 'outer: loop {
        if let Some(r) = stop_ready(deadline, shutdown).await {
            break 'outer r;
        }
        if attempt.is_none() {
            match client.latest_job() {
                Some(job) if job.cert_version != 3 => {
                    if warned_job.as_deref() != Some(job.job_id.as_str()) {
                        println!(
                            "pearl_pool_probe: refusing cert_version={} job_id={} (cert3 only)",
                            job.cert_version, job.job_id
                        );
                        warned_job = Some(job.job_id.clone());
                    }
                }
                Some(job) if Instant::now() >= idle_until => match job.kernel_target(&cfg) {
                    Ok(target) => {
                        let m = miner_slot.take().expect("miner present");
                        let job_key = cfg.job_key(&job.header);
                        attempt_nonce = nonce;
                        attempt_job = Some(job.clone());
                        attempt = Some(spawn_attempt(m, cfg.clone(), job_key, target, nonce));
                    }
                    Err(e) => {
                        println!("pearl_pool_probe: kernel_target error: {e:#}");
                        stats.reject_details.push(json!({
                            "local_error": format!("kernel_target: {e:#}"),
                            "job_id": job.job_id,
                        }));
                        break 'outer "kernel_target_error";
                    }
                },
                _ => {}
            }
        }

        let idle_pending = attempt.is_none()
            && matches!(client.latest_job(), Some(j) if j.cert_version == 3)
            && Instant::now() < idle_until;

        tokio::select! {
            biased;
            res = shutdown.as_mut() => break 'outer map_shutdown(res),
            _ = sleep_until(TokioInstant::from_std(deadline)) => break 'outer "deadline",
            ev = client.next_event() => {
                match ev {
                    Ok(e) => println!("pearl_pool_probe: pool event: {e:?}"),
                    Err(e) => {
                        println!("pearl_pool_probe: transport error: {e:#}");
                        stats.reject_details.push(json!({
                            "transport_error": format!("{e:#}"),
                        }));
                        break 'outer "transport_error";
                    }
                }
            }
            res = join_optional(&mut attempt) => {
                attempt = None;
                let mined_job = attempt_job.take().expect("job recorded");
                match res {
                    Ok((m, Ok(out))) => {
                        miner_slot = Some(m);
                        stats.completed_attempts += 1;
                        nonce = nonce.wrapping_add(1);
                        idle_until = Instant::now() + Duration::from_millis(args.idle_ms);
                        if let Some(result) = out {
                            if client.latest_job().as_ref() != Some(&mined_job) {
                                stats.stale_results_discarded += 1;
                                println!(
                                    "pearl_pool_probe: discarding result for stale job_id={}",
                                    mined_job.job_id
                                );
                            } else {
                                match mined_job.meets_share_target(&cfg, &result.jackpot_hash) {
                                    Ok(true) => {
                                        match submit_result(
                                            args,
                                            &cfg,
                                            &mut client,
                                            stats,
                                            &mined_job,
                                            &result,
                                            attempt_nonce,
                                            deadline,
                                            shutdown,
                                        )
                                        .await?
                                        {
                                            Flow::Continue => {}
                                            Flow::Stop(r) => break 'outer r,
                                        }
                                        if stats.accepted_shares >= args.shares {
                                            break 'outer "shares_target_met";
                                        }
                                    }
                                    Ok(false) => {
                                        println!(
                                            "pearl_pool_probe: integrity error: GPU winner fails local share-target check job_id={}",
                                            mined_job.job_id
                                        );
                                        stats.reject_details.push(json!({
                                            "local_error": "winner fails local share-target check",
                                            "job_id": mined_job.job_id,
                                        }));
                                        break 'outer "integrity_error";
                                    }
                                    Err(e) => {
                                        println!("pearl_pool_probe: integrity error: share target check: {e:#}");
                                        stats.reject_details.push(json!({
                                            "local_error": format!("share target check: {e:#}"),
                                            "job_id": mined_job.job_id,
                                        }));
                                        break 'outer "integrity_error";
                                    }
                                }
                            }
                        }
                    }
                    Ok((_m, Err(e))) => {
                        println!("pearl_pool_probe: mine_native error: {e:#}");
                        break 'outer "miner_error";
                    }
                    Err(e) => {
                        println!("pearl_pool_probe: mine task join error: {e:#}");
                        break 'outer "miner_task_error";
                    }
                }
            }
            _ = sleep_until(TokioInstant::from_std(idle_until)), if idle_pending => {}
        }
    };

    if let Some(h) = attempt.take() {
        match h.await {
            Ok((_m, Ok(_))) => stats.completed_attempts += 1,
            Ok((_m, Err(e))) => println!("pearl_pool_probe: final attempt error: {e:#}"),
            Err(e) => println!("pearl_pool_probe: final attempt join error: {e:#}"),
        }
    }
    Ok(stop_reason)
}

fn stop_without_request(outcome: SubmitOutcome, stats: &mut Stats, job_id: &str) -> Flow {
    match outcome {
        SubmitOutcome::Cancelled(r) => Flow::Stop(r),
        SubmitOutcome::Done(Err(e)) => {
            stats.reject_details.push(json!({
                "local_error": format!("submit: {e:#}"),
                "job_id": job_id,
            }));
            println!("pearl_pool_probe: local proof-submission error job_id={job_id}: {e:#}");
            Flow::Stop("local_submit_error")
        }
        SubmitOutcome::Done(Ok(_)) => {
            stats.reject_details.push(json!({
                "local_error": "submit returned a response without a formed request",
                "job_id": job_id,
            }));
            println!("pearl_pool_probe: submit response without request job_id={job_id}");
            Flow::Stop("integrity_error")
        }
    }
}

async fn submit_result(
    args: &Args,
    cfg: &PearlMineConfig,
    client: &mut PearlPoolClient,
    stats: &mut Stats,
    job: &PearlPoolJob,
    result: &PearlPouwNativeResult,
    nonce: u64,
    deadline: Instant,
    shutdown: &mut Shutdown,
) -> Result<Flow> {
    if let Some(r) = stop_ready(deadline, shutdown).await {
        return Ok(Flow::Stop(r));
    }
    let job_key = cfg.job_key(&job.header);
    let cfg2 = cfg.clone();
    let matrix_a = result.matrix_a.clone();
    let matrix_bt = result.matrix_bt.clone();
    let tile_index = result.tile_index;
    let mut proof_task: JoinHandle<Result<Vec<u8>>> = tokio::task::spawn_blocking(move || {
        let row_offsets = cfg2.row_offsets();
        let col_offsets = cfg2.col_offsets();
        build_plain_proof(
            &cfg2,
            &job_key,
            &matrix_a,
            &matrix_bt,
            tile_index,
            &row_offsets,
            &col_offsets,
        )
    });
    let proof = match wait_io(client, &mut proof_task, deadline, shutdown).await {
        Phase::Ready(res) => match res {
            Ok(Ok(p)) => p,
            Ok(Err(e)) => {
                println!("pearl_pool_probe: proof build error: {e:#}");
                stats.reject_details.push(json!({
                    "local_error": format!("proof build: {e:#}"),
                    "job_id": job.job_id,
                }));
                return Ok(Flow::Stop("proof_error"));
            }
            Err(e) => {
                println!("pearl_pool_probe: proof task join error: {e:#}");
                return Ok(Flow::Stop("proof_task_error"));
            }
        },
        Phase::Stopped(reason) => {
            let _ = proof_task.await;
            return Ok(Flow::Stop(reason));
        }
    };
    match drain_ready(client, deadline, shutdown).await {
        Ok(Flow::Continue) => {}
        Ok(Flow::Stop(r)) => return Ok(Flow::Stop(r)),
        Err(e) => {
            println!("pearl_pool_probe: transport error during drain: {e:#}");
            return Ok(Flow::Stop("transport_error"));
        }
    }
    if client.latest_job().as_ref() != Some(job) {
        stats.stale_results_discarded += 1;
        println!(
            "pearl_pool_probe: discarding proof for stale job_id={}",
            job.job_id
        );
        return Ok(Flow::Continue);
    }
    let plain_proof_b64 = base64::engine::general_purpose::STANDARD.encode(&proof);
    let outcome = submit_bounded(client, &job.job_id, &plain_proof_b64, deadline, shutdown).await;
    if client.last_request_written() {
        stats.submitted_shares += 1;
    }
    let Some(request) = client.last_request() else {
        return Ok(stop_without_request(outcome, stats, &job.job_id));
    };
    let rpc_id = request
        .get("id")
        .and_then(Value::as_u64)
        .unwrap_or(u64::MAX);
    let kernel_target_hex = job
        .kernel_target(cfg)
        .map(hex::encode)
        .unwrap_or_else(|_| String::new());
    let (response, transport_error) = match &outcome {
        SubmitOutcome::Done(Ok(r)) => (r.raw.clone(), Value::Null),
        SubmitOutcome::Done(Err(e)) => (Value::Null, json!(format!("{e:#}"))),
        SubmitOutcome::Cancelled(r) => (Value::Null, json!(format!("cancelled: {r}"))),
    };
    write_evidence(
        &args.evidence_dir,
        &format!("submit-{rpc_id}.json"),
        &json!({
            "pool": args.pool,
            "worker": args.worker,
            "external_job_id": job.job_id,
            "height": job.height,
            "header_hex": hex::encode(job.header),
            "target_hex": hex::encode(job.target_be),
            "kernel_target_hex": kernel_target_hex,
            "cert_version": job.cert_version,
            "m": cfg.m,
            "n": cfg.n,
            "k": cfg.k,
            "rank": cfg.rank,
            "nonce": nonce,
            "tile_index": result.tile_index,
            "jackpot_hex": hex::encode(result.jackpot_hash),
            "plain_proof_b64": plain_proof_b64,
            "request": request,
            "request_written": client.last_request_written(),
            "response": response,
            "transport_error": transport_error,
        }),
    )?;
    match outcome {
        SubmitOutcome::Done(Ok(resp)) if resp.accepted => {
            stats.accepted_shares += 1;
            println!("pearl_pool_probe: share accepted id={rpc_id}");
            Ok(Flow::Continue)
        }
        SubmitOutcome::Done(Ok(resp)) => {
            stats.rejected_shares += 1;
            stats.reject_details.push(resp.raw.clone());
            println!(
                "pearl_pool_probe: share rejected id={rpc_id}: {}",
                serde_json::to_string(&resp.raw).unwrap_or_default()
            );
            Ok(Flow::Stop("share_rejected"))
        }
        SubmitOutcome::Done(Err(e)) => {
            println!("pearl_pool_probe: submit transport error: {e:#}");
            Ok(Flow::Stop("submit_transport_error"))
        }
        SubmitOutcome::Cancelled(reason) => {
            println!("pearl_pool_probe: submit cancelled: {reason}");
            Ok(Flow::Stop(reason))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::anyhow;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::{TcpListener, TcpStream};
    use tokio::sync::oneshot;
    use tokio::time::sleep;

    fn pending_shutdown() -> Shutdown {
        Box::pin(std::future::pending::<std::io::Result<()>>())
    }

    fn ready_shutdown() -> Shutdown {
        Box::pin(std::future::ready(Ok(())))
    }

    fn oneshot_shutdown() -> (Shutdown, oneshot::Sender<()>) {
        let (tx, rx) = oneshot::channel::<()>();
        let fut = async move {
            rx.await
                .map(|_| ())
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::BrokenPipe, e))
        };
        (Box::pin(fut), tx)
    }

    async fn server_line(stream: &mut TcpStream) -> String {
        let mut buf = Vec::new();
        loop {
            let mut b = [0u8; 1];
            stream.read_exact(&mut b).await.unwrap();
            if b[0] == b'\n' {
                break;
            }
            buf.push(b[0]);
        }
        String::from_utf8(buf).unwrap()
    }

    async fn probe_client_pair() -> (PearlPoolClient, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let server = tokio::spawn(async move {
            let (mut s, _) = listener.accept().await.unwrap();
            let _ = server_line(&mut s).await;
            s.write_all(b"{\"id\":1,\"result\":true,\"error\":null}\n")
                .await
                .unwrap();
            s
        });
        let client = PearlPoolClient::connect(&addr.to_string(), "w", "w", "x")
            .await
            .unwrap();
        (client, server.await.unwrap())
    }

    async fn accepted_prior_submit(client: &mut PearlPoolClient, server: &mut TcpStream) {
        let (resp, _) = tokio::join!(client.submit_proof("j", "QUJD", None), async {
            let _ = server_line(server).await;
            server
                .write_all(b"{\"id\":2,\"result\":true,\"error\":null}\n")
                .await
                .unwrap();
        });
        assert!(resp.unwrap().accepted);
        assert!(client.last_request_written());
    }

    fn notify_frame(job_id: &str) -> String {
        let params = serde_json::json!({
            "job_id": job_id,
            "header": hex::encode([0xabu8; 76]),
            "target": hex::encode([0x11u8; 32]),
            "height": 1u64,
            "cert_version": 3u64,
            "extra_merge": {"nockchain": true},
        });
        let mut s =
            serde_json::to_string(&json!({"method": "mining.notify", "params": params})).unwrap();
        s.push('\n');
        s
    }

    fn test_args(dir: &Path) -> Args {
        Args {
            pool: "127.0.0.1:0".into(),
            wallet: "w".into(),
            worker: "w".into(),
            password: "x".into(),
            evidence_dir: dir.to_path_buf(),
            shares: 3,
            max_seconds: 300,
            idle_ms: 250,
            nonce_start: None,
        }
    }

    fn temp_dir(tag: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("pearl-probe-test-{tag}-{nanos}"))
    }

    #[tokio::test]
    async fn expired_deadline_submit_writes_nothing() {
        let (mut client, mut server) = probe_client_pair().await;
        accepted_prior_submit(&mut client, &mut server).await;
        let mut shutdown = pending_shutdown();
        let past = Instant::now() - Duration::from_secs(1);
        let outcome = submit_bounded(&mut client, "job-x", "QUJD", past, &mut shutdown).await;
        match outcome {
            SubmitOutcome::Cancelled(r) => assert_eq!(r, "deadline"),
            _ => panic!("expected deadline cancel"),
        }
        assert!(client.last_request().is_none());
        assert!(!client.last_request_written());
        let mut buf = vec![0u8; 16];
        let got = timeout(Duration::from_millis(150), server.read(&mut buf)).await;
        assert!(got.is_err(), "no bytes may be written after cancel");
    }

    #[tokio::test]
    async fn ready_shutdown_submit_writes_nothing() {
        let (mut client, mut server) = probe_client_pair().await;
        accepted_prior_submit(&mut client, &mut server).await;
        let mut shutdown = ready_shutdown();
        let outcome = submit_bounded(
            &mut client,
            "job-x",
            "QUJD",
            Instant::now() + Duration::from_secs(60),
            &mut shutdown,
        )
        .await;
        match outcome {
            SubmitOutcome::Cancelled(r) => assert_eq!(r, "ctrl_c"),
            _ => panic!("expected ctrl_c cancel"),
        }
        assert!(client.last_request().is_none());
        assert!(!client.last_request_written());
        let mut buf = vec![0u8; 16];
        let got = timeout(Duration::from_millis(150), server.read(&mut buf)).await;
        assert!(got.is_err(), "no bytes may be written after cancel");
    }

    #[tokio::test]
    async fn submit_deadline_cancels_without_false_accept() {
        let (mut client, mut server) = probe_client_pair().await;
        tokio::spawn(async move {
            let _ = server_line(&mut server).await;
            sleep(Duration::from_millis(50)).await;
            let _ = server
                .write_all(b"{\"id\":99,\"result\":true,\"error\":null}\n")
                .await;
            sleep(Duration::from_secs(5)).await;
        });
        let mut shutdown = pending_shutdown();
        let deadline = Instant::now() + Duration::from_millis(300);
        let outcome = submit_bounded(&mut client, "job-x", "QUJD", deadline, &mut shutdown).await;
        match outcome {
            SubmitOutcome::Cancelled(r) => assert_eq!(r, "deadline"),
            _ => panic!("expected deadline cancel"),
        }
        assert!(client.last_request_written());
        assert_eq!(client.last_request().unwrap()["id"], 2);
    }

    #[tokio::test]
    async fn submit_ctrl_c_cancels_after_write() {
        let (mut client, mut server) = probe_client_pair().await;
        let (mut shutdown, tx) = oneshot_shutdown();
        tokio::spawn(async move {
            let _ = server_line(&mut server).await;
            sleep(Duration::from_millis(50)).await;
            let _ = tx.send(());
            sleep(Duration::from_secs(5)).await;
        });
        let deadline = Instant::now() + Duration::from_secs(30);
        let outcome = submit_bounded(&mut client, "job-x", "QUJD", deadline, &mut shutdown).await;
        match outcome {
            SubmitOutcome::Cancelled(r) => assert_eq!(r, "ctrl_c"),
            _ => panic!("expected ctrl_c cancel"),
        }
        assert!(client.last_request_written());
        assert_eq!(client.last_request().unwrap()["id"], 2);
    }

    #[tokio::test]
    async fn wait_io_expired_deadline_beats_queued_event_and_ready_task() {
        let (mut client, mut server) = probe_client_pair().await;
        server
            .write_all(notify_frame("queued").as_bytes())
            .await
            .unwrap();
        let mut task = tokio::spawn(async { 1u64 });
        tokio::task::yield_now().await;
        assert!(task.is_finished());
        let mut shutdown = pending_shutdown();
        let past = Instant::now() - Duration::from_secs(1);
        match wait_io(&mut client, &mut task, past, &mut shutdown).await {
            Phase::Stopped(r) => assert_eq!(r, "deadline"),
            _ => panic!("expected Stopped(deadline)"),
        }
        assert!(client.latest_job().is_none());
        assert_eq!(task.await.unwrap(), 1);
    }

    #[tokio::test]
    async fn wait_io_ready_shutdown_beats_queued_event_and_ready_task() {
        let (mut client, mut server) = probe_client_pair().await;
        server
            .write_all(notify_frame("queued").as_bytes())
            .await
            .unwrap();
        let mut task = tokio::spawn(async { 1u64 });
        tokio::task::yield_now().await;
        assert!(task.is_finished());
        let mut shutdown = ready_shutdown();
        match wait_io(
            &mut client,
            &mut task,
            Instant::now() + Duration::from_secs(60),
            &mut shutdown,
        )
        .await
        {
            Phase::Stopped(r) => assert_eq!(r, "ctrl_c"),
            _ => panic!("expected Stopped(ctrl_c)"),
        }
        assert!(client.latest_job().is_none());
        assert_eq!(task.await.unwrap(), 1);
    }

    #[tokio::test]
    async fn notify_flood_cannot_starve_deadline() {
        let (mut client, mut server) = probe_client_pair().await;
        let writer = tokio::spawn(async move {
            loop {
                if server
                    .write_all(notify_frame("flood").as_bytes())
                    .await
                    .is_err()
                {
                    return;
                }
            }
        });
        let mut task = tokio::spawn(async {
            sleep(Duration::from_secs(30)).await;
            0u64
        });
        let mut shutdown = pending_shutdown();
        let deadline = Instant::now() + Duration::from_millis(300);
        let outcome = timeout(
            Duration::from_secs(1),
            wait_io(&mut client, &mut task, deadline, &mut shutdown),
        )
        .await;
        writer.abort();
        match outcome {
            Ok(Phase::Stopped(r)) => assert_eq!(r, "deadline"),
            _ => panic!("expected Stopped(deadline) within watchdog"),
        }
        task.abort();
    }

    #[tokio::test]
    async fn notify_flood_cannot_starve_shutdown() {
        let (mut client, mut server) = probe_client_pair().await;
        let writer = tokio::spawn(async move {
            loop {
                if server
                    .write_all(notify_frame("flood").as_bytes())
                    .await
                    .is_err()
                {
                    return;
                }
            }
        });
        let mut task = tokio::spawn(async {
            sleep(Duration::from_secs(30)).await;
            0u64
        });
        let (mut shutdown, tx) = oneshot_shutdown();
        let deadline = Instant::now() + Duration::from_secs(60);
        let waiter = tokio::spawn(async move {
            let phase = wait_io(&mut client, &mut task, deadline, &mut shutdown).await;
            task.abort();
            let _ = task.await;
            phase
        });
        sleep(Duration::from_millis(100)).await;
        tx.send(()).unwrap();
        let outcome = timeout(Duration::from_secs(1), waiter).await.unwrap();
        writer.abort();
        match outcome {
            Ok(Phase::Stopped(r)) => assert_eq!(r, "ctrl_c"),
            _ => panic!("expected Stopped(ctrl_c) within watchdog"),
        }
    }

    #[tokio::test]
    async fn drain_ready_expired_deadline_and_ready_shutdown() {
        let (mut client, mut server) = probe_client_pair().await;
        server
            .write_all(notify_frame("queued").as_bytes())
            .await
            .unwrap();
        let mut shutdown = pending_shutdown();
        let past = Instant::now() - Duration::from_secs(1);
        match drain_ready(&mut client, past, &mut shutdown).await.unwrap() {
            Flow::Stop(r) => assert_eq!(r, "deadline"),
            Flow::Continue => panic!("expected Stop(deadline)"),
        }
        assert_eq!(client.latest_job(), None);
        let mut shutdown = ready_shutdown();
        match drain_ready(
            &mut client,
            Instant::now() + Duration::from_secs(60),
            &mut shutdown,
        )
        .await
        .unwrap()
        {
            Flow::Stop(r) => assert_eq!(r, "ctrl_c"),
            Flow::Continue => panic!("expected Stop(ctrl_c)"),
        }
        assert_eq!(client.latest_job(), None);
    }

    #[test]
    fn stop_without_request_maps_outcomes() {
        let mut stats = Stats::default();
        match stop_without_request(SubmitOutcome::Cancelled("deadline"), &mut stats, "j") {
            Flow::Stop(r) => assert_eq!(r, "deadline"),
            Flow::Continue => panic!("expected Stop"),
        }
        match stop_without_request(SubmitOutcome::Cancelled("ctrl_c"), &mut stats, "j") {
            Flow::Stop(r) => assert_eq!(r, "ctrl_c"),
            Flow::Continue => panic!("expected Stop"),
        }
        assert_eq!(stats.submitted_shares, 0);
        assert_eq!(stats.accepted_shares, 0);
        assert_eq!(stats.rejected_shares, 0);
        assert!(stats.reject_details.is_empty());

        match stop_without_request(
            SubmitOutcome::Done(Err(anyhow!("synthetic submit failure"))),
            &mut stats,
            "j",
        ) {
            Flow::Stop(r) => assert_eq!(r, "local_submit_error"),
            Flow::Continue => panic!("expected Stop"),
        }
        assert!(stats.reject_details[0]["local_error"]
            .as_str()
            .unwrap()
            .contains("synthetic submit failure"));

        let resp = PearlPoolResponse {
            id: 2,
            accepted: true,
            raw: json!({"id": 2, "result": true, "error": null}),
        };
        match stop_without_request(SubmitOutcome::Done(Ok(resp)), &mut stats, "j") {
            Flow::Stop(r) => assert_eq!(r, "integrity_error"),
            Flow::Continue => panic!("expected Stop"),
        }
        assert_eq!(stats.accepted_shares, 0);
        assert_eq!(stats.submitted_shares, 0);
    }

    #[tokio::test]
    async fn bounded_never_polls_work_when_stopped() {
        use std::sync::atomic::{AtomicBool, Ordering};
        use std::sync::Arc;

        let hit = Arc::new(AtomicBool::new(false));
        let hit2 = Arc::clone(&hit);
        let work = async move {
            hit2.store(true, Ordering::SeqCst);
            1u64
        };
        let mut shutdown = pending_shutdown();
        let past = Instant::now() - Duration::from_secs(1);
        match bounded(work, past, &mut shutdown).await {
            Bound::Stopped(r) => assert_eq!(r, "deadline"),
            Bound::Done(_) => panic!("work future polled past deadline"),
        }
        assert!(!hit.load(Ordering::SeqCst));

        let hit = Arc::new(AtomicBool::new(false));
        let hit2 = Arc::clone(&hit);
        let work = async move {
            hit2.store(true, Ordering::SeqCst);
            1u64
        };
        let mut shutdown = ready_shutdown();
        match bounded(
            work,
            Instant::now() + Duration::from_secs(60),
            &mut shutdown,
        )
        .await
        {
            Bound::Stopped(r) => assert_eq!(r, "ctrl_c"),
            Bound::Done(_) => panic!("work future polled under ready shutdown"),
        }
        assert!(!hit.load(Ordering::SeqCst));
    }

    #[tokio::test]
    async fn join_optional_none_then_completed_then_idle() {
        let mut slot: Option<JoinHandle<u64>> = None;
        for _ in 0..3 {
            tokio::select! {
                res = join_optional(&mut slot) => panic!("None slot resolved: {res:?}"),
                _ = sleep(Duration::from_millis(5)) => {}
            }
        }
        slot = Some(tokio::spawn(async { 42u64 }));
        let res = tokio::select! {
            r = join_optional(&mut slot) => r.unwrap(),
            _ = sleep(Duration::from_secs(5)) => panic!("completed task not polled"),
        };
        assert_eq!(res, 42);
        slot = None;
        for _ in 0..3 {
            tokio::select! {
                res = join_optional(&mut slot) => panic!("slot resolved after consumption: {res:?}"),
                _ = sleep(Duration::from_millis(5)) => {}
            }
        }
    }

    #[tokio::test]
    async fn notify_during_pending_work_discards_stale_result() {
        let (mut client, mut server) = probe_client_pair().await;
        let mined_job = PearlPoolJob {
            job_id: "old-job".into(),
            header: [0xabu8; 76],
            target_be: [0x11u8; 32],
            height: 1,
            cert_version: 3,
        };
        let mut task = tokio::spawn(async {
            sleep(Duration::from_millis(150)).await;
            7u64
        });
        server
            .write_all(notify_frame("new-job").as_bytes())
            .await
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(5);
        let mut shutdown = pending_shutdown();
        match wait_io(&mut client, &mut task, deadline, &mut shutdown).await {
            Phase::Ready(r) => assert_eq!(r.unwrap(), 7),
            Phase::Stopped(r) => panic!("stopped: {r}"),
        }
        match drain_ready(&mut client, deadline, &mut shutdown)
            .await
            .unwrap()
        {
            Flow::Continue => {}
            Flow::Stop(r) => panic!("stopped: {r}"),
        }
        assert_eq!(client.latest_job().unwrap().job_id, "new-job");
        assert_ne!(client.latest_job().as_ref(), Some(&mined_job));
    }

    #[tokio::test]
    async fn summary_boundary_records_probe_error() {
        let dir = temp_dir("boundary");
        ensure_fresh_dir(&dir).unwrap();
        let args = test_args(&dir);
        let mut stats = Stats::default();
        let start = Instant::now();
        let code = summarize(
            &args,
            &mut stats,
            start,
            Err(anyhow!("synthetic setup failure")),
        )
        .unwrap();
        assert_eq!(code, 1);
        let raw = std::fs::read_to_string(dir.join("summary.json")).unwrap();
        let summary: Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(summary["stop_reason"], "probe_error");
        assert_eq!(summary["accepted_shares"], 0);
        assert_eq!(summary["submitted_shares"], 0);
        assert_eq!(summary["node_acceptance"], "not_observed");
        assert!(summary["reject_details"][0]["probe_error"]
            .as_str()
            .unwrap()
            .contains("synthetic setup failure"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn fresh_dir_rejects_nonempty() {
        let dir = temp_dir("nonempty");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("old.json"), "{}").unwrap();
        assert!(ensure_fresh_dir(&dir).is_err());
        std::fs::remove_dir_all(&dir).unwrap();
        let dir = temp_dir("empty");
        std::fs::create_dir_all(&dir).unwrap();
        ensure_fresh_dir(&dir).unwrap();
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
