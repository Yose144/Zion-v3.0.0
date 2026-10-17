use anyhow::{ensure, Context, Result};
use num_bigint::BigUint;
use serde_json::Value;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::{timeout, Instant};

use super::pearl::PearlMineConfig;

const MAX_FRAME: usize = 4 * 1024 * 1024;
const MAX_JOB_ID_BYTES: usize = 1024;
const MAX_PROOF_B64_CHARS: usize = 2_500_000;
const IO_TIMEOUT: Duration = Duration::from_secs(10);
const SUBMIT_TIMEOUT: Duration = Duration::from_secs(30);
const AGENT: &str = "zion-miner/3.2.0-pearl-probe";

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PearlPoolJob {
    pub job_id: String,
    pub header: [u8; 76],
    pub target_be: [u8; 32],
    pub height: u64,
    pub cert_version: u32,
}

impl PearlPoolJob {
    pub fn kernel_target(&self, cfg: &PearlMineConfig) -> Result<[u8; 32]> {
        cfg.validate()?;
        let bound = BigUint::from_bytes_be(&self.target_be) * cfg.adjustment_factor();
        ensure!(
            bound.bits() <= 256,
            "external Pearl target overflows for this mining configuration"
        );
        let bytes = bound.to_bytes_be();
        let mut target = [0u8; 32];
        target[32 - bytes.len()..].copy_from_slice(&bytes);
        Ok(target)
    }

    pub fn meets_share_target(&self, cfg: &PearlMineConfig, jackpot: &[u8; 32]) -> Result<bool> {
        Ok(BigUint::from_bytes_le(jackpot) <= BigUint::from_bytes_be(&self.kernel_target(cfg)?))
    }
}

#[derive(Clone, Debug)]
pub struct PearlPoolResponse {
    pub id: u64,
    pub accepted: bool,
    pub raw: Value,
}

#[derive(Clone, Debug)]
pub enum PearlPoolEvent {
    Job(PearlPoolJob),
    Response(PearlPoolResponse),
    Other(Value),
}

pub struct PearlPoolClient {
    stream: TcpStream,
    frame: Vec<u8>,
    latest: Option<PearlPoolJob>,
    next_id: u64,
    last_request: Option<Value>,
    last_request_written: bool,
}

fn decode_hex<const N: usize>(s: &str, what: &str) -> Result<[u8; N]> {
    let bytes = hex::decode(s).with_context(|| format!("mining.notify {what} is not hex"))?;
    bytes.try_into().map_err(|v: Vec<u8>| {
        anyhow::anyhow!("mining.notify {what} must be {N} bytes, got {}", v.len())
    })
}

fn parse_notify(params: &Value) -> Result<PearlPoolJob> {
    let obj = params
        .as_object()
        .context("mining.notify params must be an object")?;
    let job_id = obj
        .get("job_id")
        .and_then(Value::as_str)
        .context("mining.notify missing job_id")?;
    ensure!(
        !job_id.is_empty() && job_id.len() <= MAX_JOB_ID_BYTES,
        "mining.notify job_id must be 1..={MAX_JOB_ID_BYTES} bytes"
    );
    let header = decode_hex::<76>(
        obj.get("header")
            .and_then(Value::as_str)
            .context("mining.notify missing header")?,
        "header",
    )?;
    let target_be = decode_hex::<32>(
        obj.get("target")
            .and_then(Value::as_str)
            .context("mining.notify missing target")?,
        "target",
    )?;
    let height = obj
        .get("height")
        .and_then(Value::as_u64)
        .context("mining.notify missing height")?;
    let cert_version = obj
        .get("cert_version")
        .and_then(Value::as_u64)
        .context("mining.notify missing cert_version")?;
    ensure!(
        (1..=3).contains(&cert_version),
        "mining.notify unsupported cert_version {cert_version}"
    );
    Ok(PearlPoolJob {
        job_id: job_id.to_string(),
        header,
        target_be,
        height,
        cert_version: cert_version as u32,
    })
}

fn json_str(s: &str) -> Value {
    Value::String(s.to_string())
}

impl PearlPoolClient {
    pub async fn connect(
        endpoint: &str,
        wallet: &str,
        worker: &str,
        password: &str,
    ) -> Result<Self> {
        ensure!(
            !endpoint.contains("://"),
            "unsupported URL scheme; expected plain host:port TCP endpoint"
        );
        let (host, port) = endpoint
            .rsplit_once(':')
            .context("endpoint must be host:port")?;
        ensure!(
            !host.is_empty() && port.parse::<u16>().is_ok(),
            "endpoint must be host:port"
        );
        let stream = timeout(IO_TIMEOUT, TcpStream::connect(endpoint))
            .await
            .context("connect timeout")?
            .with_context(|| format!("connect {endpoint}"))?;
        let mut client = Self {
            stream,
            frame: Vec::new(),
            latest: None,
            next_id: 2,
            last_request: None,
            last_request_written: false,
        };
        let req = format!(
            "{{\"id\":1,\"method\":\"mining.authorize\",\"params\":{{\"wallet\":{},\"worker\":{},\"pass\":{},\"agent\":\"{AGENT}\",\"type\":\"v2\"}}}}\n",
            json_str(wallet),
            json_str(worker),
            json_str(password),
        );
        client.write_line(&req).await?;
        let deadline = Instant::now() + IO_TIMEOUT;
        loop {
            let ev = timeout(
                deadline.saturating_duration_since(Instant::now()),
                client.next_event(),
            )
            .await
            .context("authorize timeout")??;
            if let PearlPoolEvent::Response(resp) = ev {
                if resp.id == 1 {
                    ensure!(
                        resp.accepted,
                        "mining.authorize rejected: {}",
                        serde_json::to_string(&resp.raw).unwrap_or_default()
                    );
                    return Ok(client);
                }
            }
        }
    }

    pub fn latest_job(&self) -> Option<PearlPoolJob> {
        self.latest.clone()
    }

    pub fn last_request(&self) -> Option<Value> {
        self.last_request.clone()
    }

    pub fn last_request_written(&self) -> bool {
        self.last_request_written
    }

    pub fn reset_submit_state(&mut self) {
        self.last_request = None;
        self.last_request_written = false;
    }

    pub async fn next_event(&mut self) -> Result<PearlPoolEvent> {
        loop {
            let line = self.read_frame().await?;
            if line.iter().all(|b| b.is_ascii_whitespace()) {
                continue;
            }
            let value: Value = serde_json::from_slice(&line).context("invalid JSON frame")?;
            return self.dispatch(value);
        }
    }

    pub async fn submit_proof(
        &mut self,
        job_id: &str,
        plain_proof_b64: &str,
        hashrate_hps: Option<u64>,
    ) -> Result<PearlPoolResponse> {
        self.reset_submit_state();
        ensure!(
            plain_proof_b64.len() <= MAX_PROOF_B64_CHARS,
            "plain_proof exceeds {MAX_PROOF_B64_CHARS} base64 chars"
        );
        let id = self.next_id;
        self.next_id = self
            .next_id
            .checked_add(1)
            .context("rpc id space exhausted")?;
        let params = serde_json::json!({
            "job_id": job_id,
            "plain_proof": plain_proof_b64,
            "hs": hashrate_hps.unwrap_or(0),
        });
        let request = serde_json::json!({"id": id, "method": "mining.submit", "params": params});
        self.last_request = Some(request.clone());
        let line = format!("{}\n", serde_json::to_string(&request)?);
        self.write_line(&line).await?;
        self.last_request_written = true;
        let deadline = Instant::now() + SUBMIT_TIMEOUT;
        loop {
            let ev = timeout(
                deadline.saturating_duration_since(Instant::now()),
                self.next_event(),
            )
            .await
            .context("submit response timeout")??;
            if let PearlPoolEvent::Response(resp) = ev {
                if resp.id == id {
                    return Ok(resp);
                }
            }
        }
    }

    async fn write_line(&mut self, line: &str) -> Result<()> {
        timeout(IO_TIMEOUT, self.stream.write_all(line.as_bytes()))
            .await
            .context("write deadline")?
            .context("write")
    }

    async fn read_frame(&mut self) -> Result<Vec<u8>> {
        loop {
            if let Some(pos) = self.frame.iter().position(|&b| b == b'\n') {
                ensure!(pos <= MAX_FRAME, "frame exceeds 4 MiB cap");
                let mut line = self.frame.split_off(pos + 1);
                std::mem::swap(&mut self.frame, &mut line);
                line.truncate(line.len() - 1);
                return Ok(line);
            }
            let remaining = MAX_FRAME + 1 - self.frame.len();
            ensure!(remaining > 0, "frame exceeds 4 MiB cap");
            let n = {
                let mut limited = (&mut self.stream).take(remaining as u64);
                limited.read_buf(&mut self.frame).await.context("read")?
            };
            ensure!(n > 0, "connection closed by peer");
        }
    }

    fn dispatch(&mut self, value: Value) -> Result<PearlPoolEvent> {
        if value.get("method").and_then(Value::as_str) == Some("mining.notify") {
            let job = parse_notify(value.get("params").unwrap_or(&Value::Null))?;
            self.latest = Some(job.clone());
            return Ok(PearlPoolEvent::Job(job));
        }
        if let Some(id) = value.get("id").and_then(Value::as_u64) {
            let accepted = value.get("result") == Some(&Value::Bool(true))
                && value.get("error").map_or(true, Value::is_null);
            return Ok(PearlPoolEvent::Response(PearlPoolResponse {
                id,
                accepted,
                raw: value,
            }));
        }
        Ok(PearlPoolEvent::Other(value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::net::TcpListener;

    async fn client_pair() -> (PearlPoolClient, TcpStream) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let stream = TcpStream::connect(addr).await.unwrap();
        let (server, _) = listener.accept().await.unwrap();
        (
            PearlPoolClient {
                stream,
                frame: Vec::new(),
                latest: None,
                next_id: 2,
                last_request: None,
                last_request_written: false,
            },
            server,
        )
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

    fn notify_value(params: Value) -> String {
        let mut s =
            serde_json::to_string(&json!({"method": "mining.notify", "params": params})).unwrap();
        s.push('\n');
        s
    }

    fn valid_params() -> Value {
        json!({
            "job_id": "job-7f3a",
            "header": hex::encode([0xabu8; 76]),
            "target": hex::encode([0x11u8; 32]),
            "height": 127309u64,
            "cert_version": 3u64,
            "nockchain_parent": {"commitment": "deadbeef", "extra": [1, 2, 3]},
            "extranonce": "00"
        })
    }

    fn default_cfg() -> PearlMineConfig {
        PearlMineConfig {
            m: 1024,
            n: 1024,
            k: 2048,
            rank: 128,
            rows_pattern: super::super::pearl::PeriodicPattern::from_list(&[0, 8, 64, 72]).unwrap(),
            cols_pattern: super::super::pearl::PeriodicPattern::from_list(&[
                0, 1, 8, 9, 64, 65, 72, 73,
            ])
            .unwrap(),
        }
    }

    #[tokio::test]
    async fn notify_parses_job_with_extra_fields() {
        let (mut client, mut server) = client_pair().await;
        server
            .write_all(notify_value(valid_params()).as_bytes())
            .await
            .unwrap();
        match client.next_event().await.unwrap() {
            PearlPoolEvent::Job(job) => {
                assert_eq!(job.job_id, "job-7f3a");
                assert_eq!(job.header, [0xabu8; 76]);
                assert_eq!(job.target_be, [0x11u8; 32]);
                assert_eq!(job.height, 127309);
                assert_eq!(job.cert_version, 3);
            }
            other => panic!("expected Job, got {other:?}"),
        }
        assert_eq!(client.latest_job().unwrap().job_id, "job-7f3a");
    }

    #[tokio::test]
    async fn notify_rejects_malformed() {
        let cases = vec![
            json!({"job_id":"j","header":hex::encode([0u8;75]),"target":hex::encode([0u8;32]),"height":1,"cert_version":3}),
            json!({"job_id":"j","header":hex::encode([0u8;76]),"target":hex::encode([0u8;31]),"height":1,"cert_version":3}),
            json!({"job_id":"j","header":"zz","target":hex::encode([0u8;32]),"height":1,"cert_version":3}),
            json!({"job_id":"","header":hex::encode([0u8;76]),"target":hex::encode([0u8;32]),"height":1,"cert_version":3}),
            json!({"job_id":"j","header":hex::encode([0u8;76]),"target":hex::encode([0u8;32]),"height":1}),
            json!({"job_id":"j","header":hex::encode([0u8;76]),"target":hex::encode([0u8;32]),"height":1,"cert_version":4}),
            json!({"job_id":"j","header":hex::encode([0u8;76]),"target":hex::encode([0u8;32]),"height":1,"cert_version":0}),
            json!({"job_id":"j","header":hex::encode([0u8;76]),"target":hex::encode([0u8;32]),"height":1,"cert_version":4294967297u64}),
            json!({"job_id":"j","header":hex::encode([0u8;76]),"target":hex::encode([0u8;32]),"height":1,"cert_version":4294967299u64}),
            json!({"job_id":"j","header":hex::encode([0u8;76]),"target":hex::encode([0u8;32]),"height":1,"cert_version":18446744073709551615u64}),
        ];
        for params in cases {
            let (mut client, mut server) = client_pair().await;
            server
                .write_all(notify_value(params).as_bytes())
                .await
                .unwrap();
            assert!(client.next_event().await.is_err());
            assert!(client.latest_job().is_none());
        }
    }

    #[tokio::test]
    async fn kernel_target_scales_by_factor() {
        let cfg = default_cfg();
        let mut target_be = [0u8; 32];
        target_be[31] = 1;
        let job = PearlPoolJob {
            job_id: "j".into(),
            header: [0u8; 76],
            target_be,
            height: 0,
            cert_version: 3,
        };
        let kt = job.kernel_target(&cfg).unwrap();
        assert_eq!(BigUint::from_bytes_be(&kt), BigUint::from(65536u64));
        let mut jackpot = [0u8; 32];
        jackpot[2] = 0x01;
        assert!(job.meets_share_target(&cfg, &jackpot).unwrap());
        let mut over = [0u8; 32];
        over[0] = 0x01;
        over[2] = 0x01;
        assert!(!job.meets_share_target(&cfg, &over).unwrap());
    }

    #[test]
    fn kernel_target_overflow_rejected() {
        let cfg = default_cfg();
        let job = PearlPoolJob {
            job_id: "j".into(),
            header: [0u8; 76],
            target_be: [0xffu8; 32],
            height: 0,
            cert_version: 3,
        };
        assert!(job.kernel_target(&cfg).is_err());
        assert!(job.meets_share_target(&cfg, &[0u8; 32]).is_err());
    }

    #[tokio::test]
    async fn connect_sends_authorize_and_caches_prenotify() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let handle = tokio::spawn(async move {
            let (mut server, _) = listener.accept().await.unwrap();
            let auth = server_line(&mut server).await;
            let parsed: Value = serde_json::from_str(&auth).unwrap();
            assert_eq!(parsed["method"], "mining.authorize");
            assert!(parsed["params"].is_object());
            assert_eq!(parsed["params"]["wallet"], "prl1wallet");
            assert_eq!(parsed["params"]["worker"], "w1");
            assert_eq!(parsed["params"]["pass"], "secret");
            assert!(!auth.contains("mining.subscribe"));
            server
                .write_all(notify_value(valid_params()).as_bytes())
                .await
                .unwrap();
            server
                .write_all(b"{\"id\":1,\"result\":true,\"error\":null}\n")
                .await
                .unwrap();
            server
        });
        let client = PearlPoolClient::connect(&addr.to_string(), "prl1wallet", "w1", "secret")
            .await
            .unwrap();
        assert_eq!(client.latest_job().unwrap().job_id, "job-7f3a");
        handle.await.unwrap();
    }

    #[tokio::test]
    async fn connect_auth_rejection_fails() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut server, _) = listener.accept().await.unwrap();
            let _ = server_line(&mut server).await;
            server
                .write_all(
                    b"{\"id\":1,\"result\":false,\"error\":{\"code\":-1,\"msg\":\"bad worker\"}}\n",
                )
                .await
                .unwrap();
        });
        let err = match PearlPoolClient::connect(&addr.to_string(), "w", "w", "x").await {
            Ok(_) => panic!("rejected authorize should fail"),
            Err(e) => e,
        };
        assert!(err.to_string().contains("authorize rejected"));
    }

    #[tokio::test]
    async fn endpoint_schemes_rejected() {
        for ep in [
            "stratum+tcp://pool.example:4444",
            "tls://pool.example:4444",
            "ssl://x:1",
            "no-port",
            ":1234",
            "host:notaport",
        ] {
            assert!(
                PearlPoolClient::connect(ep, "w", "w", "x").await.is_err(),
                "{ep} should be rejected"
            );
        }
    }

    #[tokio::test]
    async fn submit_ignores_wrong_id_and_updates_job() {
        let (mut client, mut server) = client_pair().await;
        let handle = tokio::spawn(async move {
            let line = server_line(&mut server).await;
            let parsed: Value = serde_json::from_str(&line).unwrap();
            assert_eq!(parsed["method"], "mining.submit");
            assert_eq!(parsed["params"]["job_id"], "job-7f3a");
            assert_eq!(parsed["params"]["plain_proof"], "QUJD");
            assert_eq!(parsed["id"], 2);
            server
                .write_all(b"{\"id\":99,\"result\":true,\"error\":null}\n")
                .await
                .unwrap();
            let mut p2 = valid_params();
            p2["job_id"] = json!("job-aaaa");
            server.write_all(notify_value(p2).as_bytes()).await.unwrap();
            server
                .write_all(
                    b"{\"id\":2,\"result\":false,\"error\":{\"code\":21,\"msg\":\"stale\"}}\n",
                )
                .await
                .unwrap();
        });
        let resp = client.submit_proof("job-7f3a", "QUJD", Some(1_000_000)).await.unwrap();
        handle.await.unwrap();
        assert_eq!(resp.id, 2);
        assert!(!resp.accepted);
        assert_eq!(resp.raw["error"]["code"], 21);
        assert_eq!(resp.raw["error"]["msg"], "stale");
        assert_eq!(client.latest_job().unwrap().job_id, "job-aaaa");
    }

    #[tokio::test]
    async fn string_true_and_error_with_result_not_accepted() {
        let (mut client, mut server) = client_pair().await;
        tokio::spawn(async move {
            let _ = server_line(&mut server).await;
            server
                .write_all(b"{\"id\":2,\"result\":\"true\",\"error\":null}\n")
                .await
                .unwrap();
        });
        let resp = client.submit_proof("j", "QUJD", None).await.unwrap();
        assert!(!resp.accepted);

        let (mut client, mut server) = client_pair().await;
        tokio::spawn(async move {
            let _ = server_line(&mut server).await;
            server
                .write_all(b"{\"id\":2,\"result\":true,\"error\":{\"code\":5,\"msg\":\"weird\"}}\n")
                .await
                .unwrap();
        });
        let resp = client.submit_proof("j", "QUJD", None).await.unwrap();
        assert!(!resp.accepted);
    }

    #[tokio::test]
    async fn partial_frame_survives_cancellation() {
        let (mut client, mut server) = client_pair().await;
        let frame = notify_value(valid_params());
        let half = frame.len() / 2;
        server.write_all(&frame.as_bytes()[..half]).await.unwrap();
        let fut = client.next_event();
        assert!(timeout(Duration::from_millis(100), fut).await.is_err());
        server.write_all(&frame.as_bytes()[half..]).await.unwrap();
        match client.next_event().await.unwrap() {
            PearlPoolEvent::Job(job) => assert_eq!(job.job_id, "job-7f3a"),
            other => panic!("expected Job, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn frame_cap_errors() {
        let (mut client, mut server) = client_pair().await;
        let mut big = vec![b'a'; MAX_FRAME + 16];
        big.push(b'\n');
        let writer = tokio::spawn(async move {
            let _ = server.write_all(&big).await;
        });
        let err = client.next_event().await.unwrap_err();
        assert!(err.to_string().contains("4 MiB"));
        writer.abort();
    }

    #[tokio::test]
    async fn concatenated_frames_parse_in_order() {
        let (mut client, mut server) = client_pair().await;
        let mut p2 = valid_params();
        p2["job_id"] = json!("job-bbbb");
        let wire = format!("{}{}", notify_value(valid_params()), notify_value(p2));
        server.write_all(wire.as_bytes()).await.unwrap();
        match client.next_event().await.unwrap() {
            PearlPoolEvent::Job(j) => assert_eq!(j.job_id, "job-7f3a"),
            other => panic!("expected Job, got {other:?}"),
        }
        match client.next_event().await.unwrap() {
            PearlPoolEvent::Job(j) => assert_eq!(j.job_id, "job-bbbb"),
            other => panic!("expected Job, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn oversized_proof_rejected_before_write() {
        let (mut client, mut server) = client_pair().await;
        let (resp, _) = tokio::join!(client.submit_proof("j", "QUJD", None), async {
            let _ = server_line(&mut server).await;
            server
                .write_all(b"{\"id\":2,\"result\":true,\"error\":null}\n")
                .await
                .unwrap();
        });
        let resp = resp.unwrap();
        assert!(resp.accepted);
        assert!(client.last_request_written());
        assert_eq!(client.last_request().unwrap()["id"], 2);

        let huge = "A".repeat(MAX_PROOF_B64_CHARS + 1);
        let err = client.submit_proof("j", &huge, None).await.unwrap_err();
        assert!(err.to_string().contains("base64"));
        assert!(!client.last_request_written());
        assert!(client.last_request().is_none());
        let mut buf = vec![0u8; 16];
        let got = timeout(Duration::from_millis(150), server.read(&mut buf)).await;
        assert!(got.is_err(), "nothing should reach the wire");
    }

    #[tokio::test]
    async fn written_flag_set_after_wire_write() {
        let (mut client, mut server) = client_pair().await;
        tokio::spawn(async move {
            let _ = server_line(&mut server).await;
            drop(server);
        });
        let err = client.submit_proof("j", "QUJD", None).await.unwrap_err();
        assert!(err.to_string().contains("closed") || err.to_string().contains("read"));
        assert!(client.last_request_written());
        assert_eq!(client.last_request().unwrap()["id"], 2);
    }
}
