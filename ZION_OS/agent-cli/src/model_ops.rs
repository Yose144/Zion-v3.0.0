use crate::{config::AgentConfig, ui};
use anyhow::Result;
use tokio::process::Command;

pub async fn train_status(cfg: &AgentConfig, host: Option<String>) -> Result<()> {
    let host = host.as_deref().unwrap_or(&cfg.hiran.remote_host);
    if host.is_empty() {
        ui::print_err("No remote host configured. Set hiran.remote_host in config.");
        return Ok(());
    }

    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw);
    let port = cfg.hiran.remote_port;

    ui::print_info(&format!("Checking training status on {}:{}", host, port));

    // Try to get latest log lines
    let log_cmd = format!(
        "tail -n 20 {}/train.log 2>/dev/null || tail -n 20 /workspace/hiran-training.log 2>/dev/null || echo 'No log found'",
        cfg.hiran.remote_workspace
    );

    let output = Command::new("ssh")
        .args([
            "-p",
            &port.to_string(),
            "-i",
            &ssh_key,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", cfg.hiran.ssh_user, host),
            &log_cmd,
        ])
        .output()
        .await;

    match output {
        Ok(o) => {
            let text = String::from_utf8_lossy(&o.stdout);
            if text.contains("step") || text.contains("loss") {
                println!("{}", text);
            } else {
                println!("{}", String::from_utf8_lossy(&o.stderr));
            }
        }
        Err(e) => {
            ui::print_err(&format!("SSH failed: {}", e));
        }
    }

    // Try nvidia-smi
    let gpu_cmd = "nvidia-smi --query-gpu=temperature.gpu,utilization.gpu,memory.used --format=csv,noheader";
    let gpu_output = Command::new("ssh")
        .args([
            "-p",
            &port.to_string(),
            "-i",
            &ssh_key,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", cfg.hiran.ssh_user, host),
            gpu_cmd,
        ])
        .output()
        .await;

    if let Ok(o) = gpu_output {
        let text = String::from_utf8_lossy(&o.stdout).trim().to_string();
        if !text.is_empty() && !text.contains("not found") {
            println!("GPU status: {}", text);
        }
    }

    Ok(())
}

pub async fn checkpoint_pull(cfg: &AgentConfig, step: u32, verify: bool) -> Result<()> {
    let host = &cfg.hiran.remote_host;
    if host.is_empty() {
        ui::print_err("No remote host configured.");
        return Ok(());
    }

    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw);
    let port = cfg.hiran.remote_port;
    let remote_path = format!(
        "{}/checkpoints/stage1_factual/checkpoint-{}/adapter_model.safetensors",
        cfg.hiran.remote_workspace, step
    );
    let local_dir = cfg
        .paths
        .checkpoints_dir
        .join(format!("checkpoint-{}", step));
    let local_path = local_dir.join("adapter_model.safetensors");

    std::fs::create_dir_all(&local_dir)?;

    ui::print_info(&format!("Downloading checkpoint-{}...", step));

    // Split on remote
    let split_cmd = format!(
        "cd $(dirname {}) && if [ ! -f adapter-{}.part-aa ]; then split -b 100M $(basename {}) adapter-{}.part- && echo 'SPLIT_OK'; else echo 'ALREADY_SPLIT'; fi",
        remote_path, step, remote_path, step
    );

    let _ = Command::new("ssh")
        .args([
            "-p",
            &port.to_string(),
            "-i",
            &ssh_key,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", cfg.hiran.ssh_user, host),
            &split_cmd,
        ])
        .output()
        .await?;

    // Download parts
    let parts_cmd = format!(
        "ls $(dirname {})/adapter-{}.part-*",
        remote_path, step
    );
    let parts_output = Command::new("ssh")
        .args([
            "-p",
            &port.to_string(),
            "-i",
            &ssh_key,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", cfg.hiran.ssh_user, host),
            &parts_cmd,
        ])
        .output()
        .await?;

    let parts_text = String::from_utf8_lossy(&parts_output.stdout);
    for line in parts_text.lines() {
        let part = line.trim();
        if part.is_empty() {
            continue;
        }
        let basename = std::path::Path::new(part)
            .file_name()
            .unwrap_or_default()
            .to_string_lossy();
        let local_part = local_dir.join(&*basename);

        if local_part.exists() {
            ui::print_info(&format!("SKIP {}", basename));
            continue;
        }

        let scp_result = Command::new("scp")
            .args([
                "-P",
                &port.to_string(),
                "-i",
                &ssh_key,
                "-o",
                "StrictHostKeyChecking=no",
                "-o",
                "UserKnownHostsFile=/dev/null",
                &format!("{}@{}:{}", cfg.hiran.ssh_user, host, part),
                &local_part.to_string_lossy(),
            ])
            .output()
            .await?;

        if scp_result.status.success() {
            ui::print_ok(&format!("OK {}", basename));
        } else {
            ui::print_err(&format!(
                "FAILED {}: {}",
                basename,
                String::from_utf8_lossy(&scp_result.stderr)
            ));
        }
    }

    // Assemble
    let part_files: Vec<_> = std::fs::read_dir(&local_dir)?
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.starts_with(&format!("adapter-{}.part-", step))
        })
        .collect();

    if part_files.is_empty() {
        ui::print_err("No parts downloaded.");
        return Ok(());
    }

    {
        use std::io::Write;
        let mut out = std::fs::File::create(&local_path)?;
        let mut parts = part_files;
        parts.sort_by_key(|a| a.file_name());
        for part in parts {
            let bytes = std::fs::read(part.path())?;
            out.write_all(&bytes)?;
        }
    }

    // Clean up parts
    for entry in std::fs::read_dir(&local_dir)? {
        if let Ok(e) = entry {
            let name = e.file_name().to_string_lossy().to_string();
            if name.starts_with(&format!("adapter-{}.part-", step)) {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }

    let meta = std::fs::metadata(&local_path)?;
    ui::print_ok(&format!(
        "Assembled {} ({:.2} GB)",
        local_path.display(),
        meta.len() as f64 / 1e9
    ));

    if verify {
        let remote_size = get_remote_file_size(cfg, &remote_path).await?;
        if remote_size == meta.len() {
            ui::print_ok("Verification PASSED — size matches remote.");
        } else {
            ui::print_err(&format!(
                "Verification FAILED — remote: {} bytes, local: {} bytes",
                remote_size, meta.len()
            ));
        }
    }

    // Clean up remote parts
    let cleanup_cmd = format!(
        "rm -f $(dirname {})/adapter-{}.part-*",
        remote_path, step
    );
    let _ = Command::new("ssh")
        .args([
            "-p",
            &port.to_string(),
            "-i",
            &ssh_key,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", cfg.hiran.ssh_user, host),
            &cleanup_cmd,
        ])
        .output()
        .await;

    Ok(())
}

async fn get_remote_file_size(cfg: &AgentConfig, remote_path: &str) -> Result<u64> {
    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw);
    let output = Command::new("ssh")
        .args([
            "-p",
            &cfg.hiran.remote_port.to_string(),
            "-i",
            &ssh_key,
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "UserKnownHostsFile=/dev/null",
            &format!(
                "{}@{}",
                cfg.hiran.ssh_user, cfg.hiran.remote_host
            ),
            &format!("stat -c%s {}", remote_path),
        ])
        .output()
        .await?;

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(text.parse().unwrap_or(0))
}

pub async fn merge_and_convert(
    _cfg: &AgentConfig,
    _checkpoint: u32,
    _output: Option<String>,
    _quantize: Option<String>,
) -> Result<()> {
    ui::print_info("Merge & convert: (not yet implemented — requires Python scripts)");
    ui::print_info("Manual steps:");
    ui::print_info("  1. Merge: python scripts/merge_lora.py --adapter checkpoint-XXXX --base Qwen/Qwen3-32B");
    ui::print_info("  2. Convert: python llama.cpp/convert_hf_to_gguf.py --input-dir merged --outfile output.gguf");
    Ok(())
}
