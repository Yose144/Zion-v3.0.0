//! `zion hiran` — gateway client + ZIS device-code login (B2B-3b).

use anyhow::{bail, Context, Result};
use clap::Subcommand;
use serde::Deserialize;
use std::process::Command;
use std::time::{Duration, Instant};

use crate::agent::{market_base_url, prompt, AgentConfig, HiranClient};
use crate::ui;

#[derive(Debug, Subcommand)]
pub enum HiranCmd {
    /// Device-code login via MarketPlace + ZIS (writes ~/.zion/agent.toml).
    Login {
        #[arg(long)]
        market_url: Option<String>,
        /// Do not open a browser automatically.
        #[arg(long)]
        no_browser: bool,
    },
    /// Remove api_key from ~/.zion/agent.toml.
    Logout,
    /// Show plan / usage for the configured API key (`GET /v1/usage`).
    Whoami {
        #[arg(long)]
        base_url: Option<String>,
    },
    /// Open Stripe checkout or crypto deep-link for Pro/Team.
    Subscribe {
        #[arg(long, value_parser = ["free", "pro", "team"])]
        plan: String,
        #[arg(long, default_value = "stripe", value_parser = ["stripe", "crypto"])]
        pay: String,
        #[arg(long)]
        market_url: Option<String>,
        #[arg(long)]
        base_url: Option<String>,
        /// Do not open a browser.
        #[arg(long)]
        no_browser: bool,
    },
    /// List models from the Hiran gateway (`GET /v1/models`).
    Models {
        #[arg(long)]
        base_url: Option<String>,
        #[arg(long)]
        model: Option<String>,
    },
    /// Probe gateway health via `/models`.
    Status {
        #[arg(long)]
        base_url: Option<String>,
    },
    /// Single-turn chat without tools.
    Ask {
        #[arg(short = 'p', long = "prompt", required = true)]
        prompt: String,
        #[arg(long)]
        model: Option<String>,
        #[arg(long)]
        base_url: Option<String>,
    },
    /// Remote coding agent on a vast fleet rig (`code.run`, F3).
    Agent {
        /// Prompt for the remote coding worker.
        #[arg(short = 'p', long = "prompt", required = true)]
        prompt: String,
        /// Backend: only `vast` for now (local tools = `zion agent`).
        #[arg(long, default_value = "vast", value_parser = ["vast"])]
        remote: String,
        /// Fleet rig_id (default: first live agent from /api/agent/fleet).
        #[arg(long)]
        rig: Option<String>,
        /// Control plane base (default: https://zionterranova.com).
        #[arg(long)]
        agent_url: Option<String>,
        /// Ops bearer — env `VASTCTL_AGENT_TOKEN` / `ZION_VAST_AGENT_TOKEN`.
        #[arg(long)]
        token: Option<String>,
        #[arg(long, default_value_t = 4)]
        max_turns: u32,
        /// Poll timeout seconds.
        #[arg(long, default_value_t = 600)]
        timeout: u64,
    },
}

#[derive(Debug, Deserialize)]
struct StartResp {
    success: bool,
    data: Option<StartData>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct StartData {
    device_code: String,
    user_code: String,
    verify_url: String,
    #[serde(default = "default_interval")]
    interval: u64,
    #[serde(default)]
    expires_in: u64,
}

fn default_interval() -> u64 {
    2
}

#[derive(Debug, Deserialize)]
struct PollResp {
    success: bool,
    data: Option<PollData>,
    #[allow(dead_code)]
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct PollData {
    status: String,
    #[serde(rename = "apiKey")]
    api_key: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SubscribeResp {
    success: bool,
    data: Option<SubscribeData>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SubscribeData {
    url: Option<String>,
    #[serde(default)]
    plan: Option<String>,
}

pub async fn run(cmd: HiranCmd) -> Result<()> {
    match cmd {
        HiranCmd::Login {
            market_url,
            no_browser,
        } => login(market_url, no_browser).await?,
        HiranCmd::Logout => {
            let path = AgentConfig::clear_api_key()?;
            ui::print_ok(&format!("logged out ({})", path.display()));
        }
        HiranCmd::Whoami { base_url } => whoami(base_url).await?,
        HiranCmd::Subscribe {
            plan,
            pay,
            market_url,
            base_url,
            no_browser,
        } => subscribe(&plan, &pay, market_url, base_url, no_browser).await?,
        HiranCmd::Models { base_url, model } => {
            let cfg = AgentConfig::load(model, None, None, true, base_url)?;
            let key = cfg.api_key.as_deref().unwrap_or("");
            let client = HiranClient::new(&cfg.base_url, key, &cfg.model)?;
            ui::print_header("Hiran models");
            ui::print_row("base", client.base_url());
            let models = client.list_models().await?;
            if models.is_empty() {
                ui::print_warn("no models returned");
            } else {
                for id in models {
                    ui::print_ok(&id);
                }
            }
        }
        HiranCmd::Status { base_url } => {
            let cfg = AgentConfig::load(None, None, None, true, base_url)?;
            let key = cfg.api_key.as_deref().unwrap_or("");
            let client = HiranClient::new(&cfg.base_url, key, &cfg.model)?;
            ui::print_header("Hiran status");
            ui::print_row("base", client.base_url());
            ui::print_row("model", client.model());
            let (code, body) = client.status().await?;
            if (200..300).contains(&code) {
                ui::print_ok(&format!("HTTP {code}"));
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&body) {
                    if let Some(arr) = v.get("data").and_then(|d| d.as_array()) {
                        let ids: Vec<_> = arr
                            .iter()
                            .filter_map(|m| m.get("id").and_then(|i| i.as_str()))
                            .collect();
                        ui::print_row("models", &ids.join(", "));
                    }
                }
            } else {
                ui::print_err(&format!("HTTP {code}: {body}"));
            }
        }
        HiranCmd::Ask {
            prompt: user,
            model,
            base_url,
        } => {
            let cfg = AgentConfig::load(model, None, None, true, base_url)?;
            let key = cfg.require_api_key()?;
            let client = HiranClient::new(&cfg.base_url, key, &cfg.model)?;
            let answer = client.ask(&prompt::ask_system(), &user).await?;
            println!("{answer}");
        }
        HiranCmd::Agent {
            prompt: user,
            remote: _,
            rig,
            agent_url,
            token,
            max_turns,
            timeout,
        } => remote_vast_agent(user, rig, agent_url, token, max_turns, timeout).await?,
    }
    Ok(())
}

async fn remote_vast_agent(
    prompt: String,
    rig: Option<String>,
    agent_url: Option<String>,
    token: Option<String>,
    max_turns: u32,
    timeout_secs: u64,
) -> Result<()> {
    let base = agent_url
        .or_else(|| std::env::var("VAST_AGENT_URL").ok())
        .unwrap_or_else(|| "https://zionterranova.com".into())
        .trim_end_matches('/')
        .to_string();
    let token = token
        .or_else(|| std::env::var("VASTCTL_AGENT_TOKEN").ok())
        .or_else(|| std::env::var("ZION_VAST_AGENT_TOKEN").ok())
        .filter(|s| !s.trim().is_empty())
        .ok_or_else(|| {
            anyhow::anyhow!(
                "ops token required: set VASTCTL_AGENT_TOKEN or pass --token \
                 (fleet enqueue is not a Hiran zis_* key)"
            )
        })?;

    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent(format!("zion-cli/{}", env!("CARGO_PKG_VERSION")))
        .build()?;

    ui::print_header("Hiran agent — remote vast");
    ui::print_row("cp", &base);

    // Metered path: mint short-lived gateway lease from stored zis_* (never enqueue the key).
    let cfg = AgentConfig::load(None, None, None, true, None)?;
    let hiran_base = cfg.base_url.trim_end_matches('/').to_string();
    let mut lease_token: Option<String> = None;
    let mut llm_model = cfg.model.clone();
    if let Some(api_key) = cfg.api_key.as_ref().filter(|k| !k.trim().is_empty()) {
        let lease_url = format!("{hiran_base}/agent/lease");
        let lease_resp = http
            .post(&lease_url)
            .header("X-API-Key", api_key)
            .json(&serde_json::json!({
                "ttl_secs": 900u64,
                "max_turns": max_turns.max(1).min(8),
            }))
            .send()
            .await
            .context("POST /v1/agent/lease")?;
        let lease_status = lease_resp.status();
        let lease_text = lease_resp.text().await.unwrap_or_default();
        if lease_status.is_success() {
            let lv: serde_json::Value = serde_json::from_str(&lease_text)
                .with_context(|| format!("parse lease: {lease_text}"))?;
            lease_token = lv
                .get("lease_token")
                .and_then(|t| t.as_str())
                .map(|s| s.to_string());
            if lease_token.is_some() {
                ui::print_ok(&format!(
                    "gateway lease minted (metered remote, model={llm_model})"
                ));
            }
        } else {
            ui::print_info(&format!(
                "lease mint failed ({lease_status}) — remote will use rig-local LLM if any"
            ));
        }
    } else {
        ui::print_info("no zis_* in ~/.zion/agent.toml — remote uses rig-local LLM only");
    }

    let rig_id = if let Some(r) = rig.filter(|s| !s.trim().is_empty()) {
        r
    } else {
        let fleet_url = format!("{base}/api/agent/fleet");
        let fleet: serde_json::Value = http
            .get(&fleet_url)
            .send()
            .await
            .context("GET /api/agent/fleet")?
            .json()
            .await
            .context("parse fleet")?;
        let rigs = fleet
            .get("rigs")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();
        let pick = rigs.iter().find(|r| {
            r.get("age_s")
                .and_then(|a| a.as_f64())
                .map(|a| a < 300.0)
                .unwrap_or(false)
        });
        match pick.and_then(|r| r.get("rig_id").and_then(|i| i.as_str())) {
            Some(id) => id.to_string(),
            None => bail!("no live fleet agent (age_s < 300); pass --rig <id> or enroll a rig"),
        }
    };
    ui::print_row("rig", &rig_id);

    let enqueue_url = format!("{base}/api/agent/enqueue");
    let mut args = serde_json::json!({
        "prompt": prompt,
        "max_turns": max_turns.max(1).min(8),
        "force": true,
    });
    if let Some(tok) = &lease_token {
        args.as_object_mut().unwrap().insert(
            "lease_token".into(),
            serde_json::Value::String(tok.clone()),
        );
        args.as_object_mut().unwrap().insert(
            "llm_base".into(),
            serde_json::Value::String(hiran_base.clone()),
        );
        args.as_object_mut().unwrap().insert(
            "model".into(),
            serde_json::Value::String(llm_model.clone()),
        );
        ui::print_row("llm", &format!("{hiran_base} model={llm_model}"));
    }
    let body = serde_json::json!({
        "rig_id": rig_id,
        "op": "code.run",
        "args": args,
    });
    let resp = http
        .post(&enqueue_url)
        .header("Authorization", format!("Bearer {token}"))
        .json(&body)
        .send()
        .await
        .context("POST /api/agent/enqueue")?;
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        bail!("enqueue failed ({status}): {text}");
    }
    let v: serde_json::Value =
        serde_json::from_str(&text).with_context(|| format!("parse enqueue: {text}"))?;
    let task_id = v
        .pointer("/task/id")
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow::anyhow!("enqueue response missing task.id: {text}"))?
        .to_string();
    ui::print_ok(&format!("queued task {task_id}"));

    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    loop {
        if Instant::now() > deadline {
            bail!("timeout waiting for task {task_id} ({timeout_secs}s)");
        }
        tokio::time::sleep(Duration::from_secs(3)).await;
        let status_url = format!("{base}/api/agent/task?rig_id={rig_id}&task_id={task_id}");
        let st_resp = http.get(&status_url).send().await.context("GET task")?;
        if !st_resp.status().is_success() {
            continue;
        }
        let st: serde_json::Value = st_resp.json().await.unwrap_or(serde_json::json!({}));
        if let Some(result) = st.get("result") {
            let rc = result.get("rc").and_then(|x| x.as_i64()).unwrap_or(1);
            let out = result
                .get("out")
                .and_then(|x| x.as_str())
                .unwrap_or("(empty)");
            println!("{out}");
            if rc != 0 {
                bail!("remote code.run rc={rc}");
            }
            ui::print_ok("done");
            if lease_token.is_some() {
                if let Ok(usage) = http
                    .get(format!("{hiran_base}/usage"))
                    .header(
                        "X-API-Key",
                        cfg.api_key.as_deref().unwrap_or(""),
                    )
                    .send()
                    .await
                {
                    if usage.status().is_success() {
                        if let Ok(u) = usage.json::<serde_json::Value>().await {
                            let plan = u.get("plan").and_then(|p| p.as_str()).unwrap_or("?");
                            let used = u
                                .get("used_today")
                                .map(|v| v.to_string())
                                .unwrap_or_else(|| "?".into());
                            ui::print_row("usage", &format!("plan={plan} used_today={used}"));
                        }
                    }
                }
            }
            return Ok(());
        }
        if let Some(state) = st.pointer("/task/state").and_then(|x| x.as_str()) {
            if state == "cancelled" {
                bail!("task cancelled");
            }
            eprint!("\rstatus: {state}   ");
        }
    }
}

async fn login(market_url: Option<String>, no_browser: bool) -> Result<()> {
    let market = market_url
        .unwrap_or_else(market_base_url)
        .trim_end_matches('/')
        .to_string();
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent(format!("zion-cli/{}", env!("CARGO_PKG_VERSION")))
        .build()?;

    ui::print_header("Hiran login");
    ui::print_row("market", &market);

    let start_url = format!("{market}/api/hiran/cli/start");
    let start_resp = http
        .post(&start_url)
        .send()
        .await
        .context("POST /api/hiran/cli/start")?;
    let start_status = start_resp.status();
    let start_body = start_resp.text().await.unwrap_or_default();
    if !start_status.is_success() {
        bail!("device start failed ({start_status}): {start_body}");
    }
    let start: StartResp = serde_json::from_str(&start_body)
        .with_context(|| format!("parse start: {start_body}"))?;
    if !start.success {
        bail!(
            "device start error: {}",
            start.error.unwrap_or_else(|| "unknown".into())
        );
    }
    let data = start.data.context("missing start data")?;

    ui::print_info(&format!("user code: {}", data.user_code));
    ui::print_info(&format!("open: {}", data.verify_url));
    println!();
    println!("  Approve in the browser, then return here.");
    println!();

    if !no_browser {
        open_browser(&data.verify_url);
    }

    let deadline = Instant::now()
        + Duration::from_secs(if data.expires_in > 0 {
            data.expires_in
        } else {
            600
        });
    let interval = Duration::from_secs(data.interval.max(1));

    loop {
        if Instant::now() > deadline {
            bail!("login timed out — run `zion hiran login` again");
        }
        tokio::time::sleep(interval).await;
        let poll_url = format!(
            "{market}/api/hiran/cli/poll?device_code={}",
            urlencoding_encode(&data.device_code)
        );
        let poll_resp = http.get(&poll_url).send().await.context("poll")?;
        let poll_status = poll_resp.status();
        let poll_body = poll_resp.text().await.unwrap_or_default();
        if !poll_status.is_success() {
            ui::print_warn(&format!("poll HTTP {poll_status}"));
            continue;
        }
        let poll: PollResp = match serde_json::from_str(&poll_body) {
            Ok(p) => p,
            Err(_) => {
                ui::print_warn("poll parse error");
                continue;
            }
        };
        if !poll.success {
            continue;
        }
        let Some(pd) = poll.data else { continue };
        match pd.status.as_str() {
            "pending" => continue,
            "expired" => bail!("device code expired"),
            "redeemed" => bail!("code already redeemed — try login again"),
            "approved" => {
                let key = pd.api_key.context("approved without apiKey")?;
                let path = AgentConfig::save_api_key(&key, Some(crate::agent::config::DEFAULT_BASE_URL), None)?;
                ui::print_ok(&format!("logged in — key saved to {}", path.display()));
                ui::print_info("try: zion hiran whoami · zion hiran models · zion agent -p \"…\"");
                return Ok(());
            }
            other => ui::print_warn(&format!("unknown status {other}")),
        }
    }
}

async fn whoami(base_url: Option<String>) -> Result<()> {
    let cfg = AgentConfig::load(None, None, None, true, base_url)?;
    let key = cfg.require_api_key()?;
    let client = HiranClient::new(&cfg.base_url, key, &cfg.model)?;
    ui::print_header("Hiran whoami");
    ui::print_row("base", client.base_url());
    ui::print_row(
        "key",
        &format!("{}…{}", &key[..key.len().min(8)], &key[key.len().saturating_sub(4)..]),
    );
    ui::print_row("toml", &AgentConfig::agent_toml_path_public().display().to_string());
    let usage = client.usage().await?;
    if let Some(plan) = usage.get("plan").and_then(|p| p.as_str()) {
        ui::print_row("plan", plan);
    }
    if let Some(lim) = usage.get("limits") {
        ui::print_row("limits", &lim.to_string());
    }
    if let Some(used) = usage.get("used_today") {
        ui::print_row("used_today", &used.to_string());
    }
    Ok(())
}

async fn subscribe(
    plan: &str,
    pay: &str,
    market_url: Option<String>,
    base_url: Option<String>,
    no_browser: bool,
) -> Result<()> {
    let cfg = AgentConfig::load(None, None, None, true, base_url)?;
    let key = cfg.require_api_key()?;
    let market = market_url
        .unwrap_or_else(market_base_url)
        .trim_end_matches('/')
        .to_string();

    ui::print_header("Hiran subscribe");
    ui::print_row("plan", plan);
    ui::print_row("pay", pay);

    if pay == "crypto" {
        if plan == "free" {
            bail!("crypto pay is for pro/team only");
        }
        let url = format!("{market}/ai?plan={plan}&pay=crypto");
        ui::print_info(&format!("open: {url}"));
        if !no_browser {
            open_browser(&url);
        }
        ui::print_info("after MetaMask confirm, run: zion hiran whoami");
        return Ok(());
    }

    // Stripe (or free) via API with existing key.
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(60))
        .user_agent(format!("zion-cli/{}", env!("CARGO_PKG_VERSION")))
        .build()?;
    let url = format!("{market}/api/stripe/hiran-subscribe");
    let resp = http
        .post(&url)
        .header("Content-Type", "application/json")
        .header("X-API-Key", key)
        .json(&serde_json::json!({ "plan": plan }))
        .send()
        .await
        .context("POST hiran-subscribe")?;
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    if !status.is_success() {
        bail!("subscribe failed ({status}): {body}");
    }
    let parsed: SubscribeResp =
        serde_json::from_str(&body).with_context(|| format!("parse subscribe: {body}"))?;
    if !parsed.success {
        bail!(
            "subscribe error: {}",
            parsed.error.unwrap_or_else(|| "unknown".into())
        );
    }
    if let Some(data) = parsed.data {
        if let Some(checkout) = data.url {
            ui::print_ok("Stripe checkout ready");
            ui::print_info(&format!("open: {checkout}"));
            if !no_browser {
                open_browser(&checkout);
            }
            ui::print_info("after payment, run: zion hiran whoami");
        } else {
            ui::print_ok(&format!(
                "plan {} ready (no checkout)",
                data.plan.as_deref().unwrap_or(plan)
            ));
        }
    }
    Ok(())
}

fn open_browser(url: &str) {
    let candidates: &[&str] = if cfg!(target_os = "macos") {
        &["open"]
    } else if cfg!(target_os = "windows") {
        &["cmd", "/C", "start"]
    } else {
        &["xdg-open"]
    };
    let _ = if candidates.len() == 1 {
        Command::new(candidates[0]).arg(url).spawn()
    } else {
        Command::new(candidates[0])
            .args(&candidates[1..])
            .arg(url)
            .spawn()
    };
}

/// Minimal query encode (device codes are hex — safe; still escape).
fn urlencoding_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}
