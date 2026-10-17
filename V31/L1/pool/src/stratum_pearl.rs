use serde_json::{json, Value};
use std::io::{self, ErrorKind};
use std::mem;
use tokio::io::{AsyncBufRead, AsyncBufReadExt};

pub(crate) const MAX_FRAME_BYTES: usize = 4 * 1024 * 1024;
pub(crate) const MAX_WALLET_BYTES: usize = 256;
pub(crate) const MAX_WORKER_BYTES: usize = 128;
pub(crate) const MAX_AGENT_BYTES: usize = 128;
pub(crate) const MAX_JOB_ID_BYTES: usize = 1024;
pub(crate) const MAX_PROOF_B64_CHARS: usize = 2_500_000;

pub fn is_pearl_stratum(line: &str) -> bool {
    if line.trim_end().len() > MAX_FRAME_BYTES {
        return false;
    }
    let Ok(v) = serde_json::from_str::<Value>(line.trim()) else {
        return false;
    };
    v.get("method").and_then(|m| m.as_str()) == Some("mining.authorize")
        && v.get("params").map(|p| p.is_object()).unwrap_or(false)
}

#[derive(Debug)]
pub struct PearlAuthorize {
    pub wallet: String,
    pub worker: String,
    pub agent: String,
}

pub fn worker_name(auth: &PearlAuthorize) -> String {
    if auth.worker.is_empty() {
        auth.wallet.clone()
    } else {
        format!("{}.{}", auth.wallet, auth.worker)
    }
}

pub fn parse_authorize(line: &str) -> Option<(Value, Result<PearlAuthorize, String>)> {
    if line.trim_end().len() > MAX_FRAME_BYTES {
        return None;
    }
    let v: Value = serde_json::from_str(line.trim()).ok()?;
    if v.get("method").and_then(|m| m.as_str()) != Some("mining.authorize") {
        return None;
    }
    if !v.get("params").map(|p| p.is_object()).unwrap_or(false) {
        return None;
    }
    let id = v.get("id").cloned().unwrap_or(Value::Null);
    let p = v.get("params")?;
    let auth = (|| {
        let wallet = match p.get("wallet") {
            Some(Value::String(s)) => s,
            Some(_) => return Err("authorize.wallet must be a string".to_string()),
            None => return Err("authorize.wallet missing".to_string()),
        };
        if wallet.is_empty() || wallet.len() > MAX_WALLET_BYTES {
            return Err(format!("authorize.wallet must be 1..={MAX_WALLET_BYTES} bytes"));
        }
        let worker = match p.get("worker") {
            Some(Value::String(s)) => s.as_str(),
            Some(_) => return Err("authorize.worker must be a string".to_string()),
            None => "",
        };
        if worker.len() > MAX_WORKER_BYTES {
            return Err(format!("authorize.worker must be <= {MAX_WORKER_BYTES} bytes"));
        }
        let agent = match p.get("agent") {
            Some(Value::String(s)) => s.as_str(),
            Some(_) => return Err("authorize.agent must be a string".to_string()),
            None => "",
        };
        if agent.len() > MAX_AGENT_BYTES {
            return Err(format!("authorize.agent must be <= {MAX_AGENT_BYTES} bytes"));
        }
        Ok(PearlAuthorize {
            wallet: wallet.clone(),
            worker: worker.to_string(),
            agent: agent.to_string(),
        })
    })();
    Some((id, auth))
}

#[derive(Debug)]
pub struct PearlSubmit {
    pub job_id: String,
    pub plain_proof: String,
    /// Miner-reported hashrate (H/s). LuckyPool-style upstreams expect
    /// `hs` in submit params; pass through when present.
    pub hs: Option<u64>,
}

pub fn parse_submit(line: &str) -> Option<(Value, Result<PearlSubmit, String>)> {
    let v: Value = serde_json::from_str(line.trim()).ok()?;
    if v.get("method").and_then(|m| m.as_str()) != Some("mining.submit") {
        return None;
    }
    let id = v.get("id").cloned().unwrap_or(Value::Null);
    let Some(p) = v.get("params").filter(|p| p.is_object()) else {
        return Some((id, Err("submit.params must be an object".to_string())));
    };
    let job_id = p.get("job_id").and_then(|j| j.as_str()).unwrap_or("");
    let proof = p.get("plain_proof").and_then(|x| x.as_str()).unwrap_or("");
    let parsed = if job_id.is_empty() || job_id.len() > MAX_JOB_ID_BYTES {
        Err(format!("submit.job_id must be 1..={MAX_JOB_ID_BYTES} bytes"))
    } else if proof.is_empty() || proof.len() > MAX_PROOF_B64_CHARS {
        Err(format!(
            "submit.plain_proof must be 1..={MAX_PROOF_B64_CHARS} base64 chars"
        ))
    } else {
        Ok(PearlSubmit {
            job_id: job_id.to_string(),
            plain_proof: proof.to_string(),
            hs: p
                .get("hs")
                .and_then(|x| x.as_u64().or_else(|| x.as_f64().map(|f| f as u64))),
        })
    };
    Some((id, parsed))
}

/// LuckyPool-compatible `diff` for the notify frame. Upstream job ids carry
/// the pool difficulty as a `_N` suffix (`8c822b51_500000`); native jobs
/// advertise `1` (the eased share target is fully described by `target`,
/// and a permissive diff only affects client-side share metering).
fn job_diff(job_id: &str) -> u64 {
    job_id
        .rsplit('_')
        .next()
        .and_then(|s| s.parse::<u64>().ok())
        .filter(|d| *d > 0)
        .unwrap_or(1)
}

pub fn notify_params(job: &crate::v3_protocol::ExternalStreamJob) -> Value {
    json!({
        "job_id": job.job_id,
        "header": job.header_hex,
        "target": job.target_hex,
        "height": job.height,
        "cert_version": job.eq_params.parse::<u64>().unwrap_or(0),
        "diff": job_diff(&job.job_id),
    })
}

pub fn notify_frame(params: &Value) -> String {
    format!(
        "{}\n",
        serde_json::json!({"jsonrpc":"2.0","method":"mining.notify","params":params})
    )
}

pub fn auth_ok(id: &Value) -> String {
    format!(
        "{}\n",
        serde_json::json!({"id":id,"result":true,"error":null,"type":"v2"})
    )
}

pub fn auth_err(id: &Value, msg: &str) -> String {
    format!(
        "{}\n",
        serde_json::json!({"id":id,"result":false,"error":{"code":-1,"message":msg}})
    )
}

pub fn submit_ok(id: &Value) -> String {
    format!("{}\n", serde_json::json!({"id":id,"result":true,"error":null}))
}

pub fn submit_err(id: &Value, msg: &str) -> String {
    format!(
        "{}\n",
        serde_json::json!({"id":id,"result":false,"error":{"code":-1,"message":msg}})
    )
}

pub fn method_err(id: &Value) -> String {
    format!(
        "{}\n",
        serde_json::json!({"id":id,"result":null,"error":{"code":-32601,"message":"method not found"}})
    )
}

pub(crate) async fn read_frame<R: AsyncBufRead + Unpin>(
    reader: &mut R,
    pending: &mut Vec<u8>,
) -> io::Result<Option<String>> {
    loop {
        let buf = reader.fill_buf().await?;
        if buf.is_empty() {
            return if pending.is_empty() {
                Ok(None)
            } else {
                Err(io::Error::new(ErrorKind::InvalidData, "eof with partial frame"))
            };
        }
        let nl = buf.iter().position(|b| *b == b'\n');
        let (plen, consumed) = match nl {
            Some(i) => (i, i + 1),
            None => (buf.len(), buf.len()),
        };
        if pending.len() + plen > MAX_FRAME_BYTES {
            return Err(io::Error::new(
                ErrorKind::InvalidData,
                format!("pearl frame exceeds {MAX_FRAME_BYTES} bytes"),
            ));
        }
        pending.extend_from_slice(&buf[..plen]);
        reader.consume(consumed);
        if nl.is_some() {
            return Ok(Some(String::from_utf8(mem::take(pending)).map_err(|e| {
                io::Error::new(ErrorKind::InvalidData, format!("invalid UTF-8: {e}"))
            })?));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::BufReader;

    fn auth_line(wallet: &str, worker: &str) -> String {
        format!(
            "{{\"id\":1,\"method\":\"mining.authorize\",\"params\":{{\"wallet\":\"{wallet}\",\"worker\":\"{worker}\",\"pass\":\"x\",\"agent\":\"zion-miner/3.2.0-pearl-probe\"}}}}"
        )
    }

    fn submit_line(id: u64, job: &str, proof: &str) -> String {
        format!(
            "{{\"id\":{id},\"method\":\"mining.submit\",\"params\":{{\"job_id\":\"{job}\",\"plain_proof\":\"{proof}\"}}}}"
        )
    }

    #[test]
    fn detects_object_param_authorize_only() {
        assert!(is_pearl_stratum(&auth_line("prl1abc", "rig1")));
        assert!(is_pearl_stratum(
            "{\"id\":1,\"method\":\"mining.authorize\",\"params\":{\"wallet\":42}}"
        ));
        assert!(!is_pearl_stratum(
            "{\"id\":1,\"method\":\"mining.authorize\",\"params\":[\"prl1abc\",\"x\"]}"
        ));
        assert!(!is_pearl_stratum(
            "{\"id\":1,\"method\":\"login\",\"params\":{\"login\":\"q.w\"}}"
        ));
        assert!(!is_pearl_stratum(
            "{\"id\":1,\"method\":\"mining.submit\",\"params\":{}}"
        ));
        assert!(!is_pearl_stratum("{\"method\":\"mining.authorize\"}"));
        assert!(!is_pearl_stratum("not json"));
        assert!(!is_pearl_stratum(""));

        let huge = format!(
            "{{\"id\":1,\"method\":\"mining.authorize\",\"params\":{{\"wallet\":\"{}\"}}}}",
            "w".repeat(MAX_FRAME_BYTES)
        );
        assert!(!is_pearl_stratum(&huge));
    }

    #[test]
    fn parses_authorize_fields_and_identity() {
        let (id, auth) = parse_authorize(&auth_line("prl1abc", "rig1")).unwrap();
        let auth = auth.unwrap();
        assert_eq!(id, json!(1));
        assert_eq!(auth.wallet, "prl1abc");
        assert_eq!(auth.worker, "rig1");
        assert_eq!(auth.agent, "zion-miner/3.2.0-pearl-probe");
        assert_eq!(worker_name(&auth), "prl1abc.rig1");

        let no_worker = format!(
            "{{\"id\":2,\"method\":\"mining.authorize\",\"params\":{{\"wallet\":\"prl1abc\"}}}}"
        );
        let (_, auth2) = parse_authorize(&no_worker).unwrap();
        let auth2 = auth2.unwrap();
        assert_eq!(auth2.worker, "");
        assert_eq!(auth2.agent, "");
        assert_eq!(worker_name(&auth2), "prl1abc");
    }

    #[test]
    fn rejects_bad_authorize_fields() {
        let (_, bad) = parse_authorize(
            "{\"id\":1,\"method\":\"mining.authorize\",\"params\":{\"worker\":\"r\"}}",
        )
        .unwrap();
        assert!(bad.unwrap_err().contains("wallet"));

        let (_, bad) = parse_authorize(&auth_line("", "rig1")).unwrap();
        assert!(bad.unwrap_err().contains("wallet"));

        let long = auth_line(&"w".repeat(257), "r");
        let (_, bad) = parse_authorize(&long).unwrap();
        assert!(bad.unwrap_err().contains("wallet"));

        let long_w = auth_line("prl1abc", &"r".repeat(129));
        let (_, bad) = parse_authorize(&long_w).unwrap();
        assert!(bad.unwrap_err().contains("worker"));

        let bad_worker =
            "{\"id\":1,\"method\":\"mining.authorize\",\"params\":{\"wallet\":\"prl1abc\",\"worker\":42}}";
        let (_, bad) = parse_authorize(bad_worker).unwrap();
        assert_eq!(bad.unwrap_err(), "authorize.worker must be a string");

        let bad_agent =
            "{\"id\":1,\"method\":\"mining.authorize\",\"params\":{\"wallet\":\"prl1abc\",\"agent\":true}}";
        let (_, bad) = parse_authorize(bad_agent).unwrap();
        assert_eq!(bad.unwrap_err(), "authorize.agent must be a string");

        let bad_wallet =
            "{\"id\":1,\"method\":\"mining.authorize\",\"params\":{\"wallet\":42}}";
        let (_, bad) = parse_authorize(bad_wallet).unwrap();
        assert_eq!(bad.unwrap_err(), "authorize.wallet must be a string");

        let huge = format!(
            "{{\"id\":1,\"method\":\"mining.authorize\",\"params\":{{\"wallet\":\"{}\"}}}}",
            "w".repeat(MAX_FRAME_BYTES)
        );
        assert!(parse_authorize(&huge).is_none());
    }

    #[test]
    fn parses_submit_object_params() {
        let (id, sub) = parse_submit(&submit_line(7, "job_abc", "QUJD")).unwrap();
        let sub = sub.unwrap();
        assert_eq!(id, json!(7));
        assert_eq!(sub.job_id, "job_abc");
        assert_eq!(sub.plain_proof, "QUJD");
        assert!(parse_submit("{\"id\":1,\"method\":\"mining.subscribe\"}").is_none());
    }

    #[test]
    fn rejects_bad_submit_fields() {
        let (_, bad) = parse_submit(
            "{\"id\":2,\"method\":\"mining.submit\",\"params\":[\"job\",\"AA\"]}",
        )
        .unwrap();
        assert!(bad.is_err());

        let (_, bad) = parse_submit(&submit_line(2, "", "QUJD")).unwrap();
        assert!(bad.unwrap_err().contains("job_id"));

        let (_, bad) = parse_submit(&submit_line(2, "job", "")).unwrap();
        assert!(bad.unwrap_err().contains("plain_proof"));
    }

    #[test]
    fn notify_wire_maps_ext_stream_job() {
        let j = crate::v3_protocol::ExternalStreamJob {
            coin: "PRL".into(),
            algorithm: "pearlhash".into(),
            job_id: "j1".into(),
            header_hex: hex::encode([0xabu8; 76]),
            target_hex: hex::encode([0x01u8; 32]),
            height: 0,
            extranonce1_hex: String::new(),
            protocol: String::new(),
            seed_hash_hex: String::new(),
            timestamp: 0,
            ntime_hex: String::new(),
            eq_params: "3".into(),
            eq_pers: String::new(),
        };
        let p = notify_params(&j);
        assert_eq!(p["job_id"], "j1");
        assert_eq!(p["header"].as_str().unwrap().len(), 152);
        assert_eq!(p["target"].as_str().unwrap().len(), 64);
        assert_eq!(p["height"], 0);
        assert_eq!(p["cert_version"], 3);
        let frame = notify_frame(&p);
        assert!(frame.ends_with('\n'));
        let v: Value = serde_json::from_str(&frame).unwrap();
        assert_eq!(v["method"], "mining.notify");
        assert_eq!(v["params"]["cert_version"], 3);
    }

    #[test]
    fn response_shapes() {
        let v: Value = serde_json::from_str(&auth_ok(&json!(1))).unwrap();
        assert_eq!(v["result"], json!(true));
        assert!(v["error"].is_null());
        let v: Value = serde_json::from_str(&submit_ok(&json!(2))).unwrap();
        assert_eq!(v["result"], json!(true));
        let v: Value = serde_json::from_str(&submit_err(&json!(2), "stale")).unwrap();
        assert_eq!(v["result"], json!(false));
        assert_eq!(v["error"]["message"], "stale");
        let v: Value = serde_json::from_str(&auth_err(&json!(1), "pearl_not_enabled")).unwrap();
        assert_eq!(v["result"], json!(false));
        assert_eq!(v["error"]["message"], "pearl_not_enabled");
        let v: Value = serde_json::from_str(&method_err(&json!(9))).unwrap();
        assert_eq!(v["error"]["code"], -32601);
    }

    #[tokio::test]
    async fn read_frame_concatenated_and_fragmented() {
        let data = b"{\"a\":1}\n{\"b\":2}\n{\"c\":".to_vec();
        let (mut a, b) = tokio::io::duplex(64);
        tokio::spawn(async move {
            use tokio::io::AsyncWriteExt;
            a.write_all(&data).await.unwrap();
            sleep_ms(20).await;
            a.write_all(b"3}\n").await.unwrap();
        });
        let mut pending = Vec::new();
        let mut reader = BufReader::new(b);
        assert_eq!(
            read_frame(&mut reader, &mut pending).await.unwrap().unwrap(),
            "{\"a\":1}"
        );
        assert_eq!(
            read_frame(&mut reader, &mut pending).await.unwrap().unwrap(),
            "{\"b\":2}"
        );
        assert_eq!(
            read_frame(&mut reader, &mut pending).await.unwrap().unwrap(),
            "{\"c\":3}"
        );
    }

    async fn sleep_ms(ms: u64) {
        tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
    }

    #[tokio::test]
    async fn read_frame_partial_survives_cancelled_future() {
        let (mut a, b) = tokio::io::duplex(64);
        let mut pending = Vec::new();
        let mut reader = BufReader::new(b);
        {
            use tokio::io::AsyncWriteExt;
            a.write_all(b"{\"partial\"").await.unwrap();
        }
        {
            let fut = read_frame(&mut reader, &mut pending);
            tokio::pin!(fut);
            tokio::select! {
                _ = &mut fut => panic!("frame is incomplete"),
                _ = sleep_ms(30) => {}
            }
        }
        {
            use tokio::io::AsyncWriteExt;
            a.write_all(b":1}\n").await.unwrap();
        }
        assert_eq!(
            read_frame(&mut reader, &mut pending).await.unwrap().unwrap(),
            "{\"partial\":1}"
        );
    }

    #[tokio::test]
    async fn read_frame_cap_before_overread() {
        use tokio::io::AsyncWriteExt;
        let big = vec![b'x'; MAX_FRAME_BYTES + 1];
        let (mut a2, b2) = tokio::io::duplex(big.len() * 2);
        let big2 = big.clone();
        tokio::spawn(async move {
            let _ = a2.write_all(&big2).await;
        });
        let mut reader2 = BufReader::new(b2);
        let mut pending2 = Vec::new();
        let err = read_frame(&mut reader2, &mut pending2).await.unwrap_err();
        assert!(err.to_string().contains("exceeds"));
        assert!(pending2.len() <= MAX_FRAME_BYTES);
    }

    #[tokio::test]
    async fn read_frame_cap_boundary_accepts_exact() {
        let payload = vec![b'y'; MAX_FRAME_BYTES];
        let mut data = payload.clone();
        data.push(b'\n');
        let mut data2 = payload.clone();
        data2.extend_from_slice(b"zz\n");
        let (mut a, b) = tokio::io::duplex(data.len() + data2.len() + 16);
        tokio::spawn(async move {
            use tokio::io::AsyncWriteExt;
            a.write_all(&data).await.unwrap();
            a.write_all(&data2).await.unwrap();
        });
        let mut pending = Vec::new();
        let mut reader = BufReader::new(b);
        let f = read_frame(&mut reader, &mut pending).await.unwrap().unwrap();
        assert_eq!(f.len(), MAX_FRAME_BYTES);
        let err = read_frame(&mut reader, &mut pending).await.unwrap_err();
        assert!(err.to_string().contains("exceeds"));
    }

    #[tokio::test]
    async fn read_frame_eof() {
        let (a, b) = tokio::io::duplex(64);
        drop(a);
        let mut pending = Vec::new();
        let mut reader = BufReader::new(b);
        assert!(read_frame(&mut reader, &mut pending).await.unwrap().is_none());
        pending.extend_from_slice(b"{\"x\":1}");
        let err = read_frame(&mut reader, &mut pending).await.unwrap_err();
        assert!(err.to_string().contains("partial"));
    }
}
