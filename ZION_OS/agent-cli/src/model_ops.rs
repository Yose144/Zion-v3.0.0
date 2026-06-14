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

/// Run merge + GGUF export on the remote Vast AI server
pub async fn merge_and_convert(
    cfg: &AgentConfig,
    checkpoint: u32,
    output: Option<String>,
    quantize: Option<String>,
) -> Result<()> {
    let host = &cfg.hiran.remote_host;
    if host.is_empty() {
        ui::print_err("No remote host configured. Set hiran.remote_host in config.");
        return Ok(());
    }

    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw).to_string();
    let port = cfg.hiran.remote_port;
    let ssh_user = &cfg.hiran.ssh_user;
    let workspace = &cfg.hiran.remote_workspace;

    let quant = quantize.as_deref().unwrap_or("q5_k_m");
    let merged_dir = output
        .clone()
        .unwrap_or_else(|| format!("{}-merged", workspace.trim_end_matches("/hiran-v2.3")));
    let gguf_out = format!(
        "{}/hiran-v2.3-{}-{}.gguf",
        workspace.trim_end_matches("/hiran-v2.3"),
        checkpoint,
        quant
    );
    let checkpoint_dir = format!("{}/checkpoints/stage1_factual/checkpoint-{}", workspace, checkpoint);
    let merge_script = format!("{}/scripts/merge_and_export.py", workspace);

    // Check the script exists on remote
    let check_cmd = format!("test -f {} && echo EXISTS || echo MISSING", merge_script);
    let check = Command::new("ssh")
        .args([
            "-p", &port.to_string(),
            "-i", &ssh_key,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", ssh_user, host),
            &check_cmd,
        ])
        .output()
        .await?;

    if String::from_utf8_lossy(&check.stdout).contains("MISSING") {
        ui::print_err(&format!("merge_and_export.py not found on server: {}", merge_script));
        ui::print_info("Upload it with: scp HiranV2.3/scripts/merge_and_export_server.py root@...:merge_and_export.py");
        return Ok(());
    }

    ui::print_info(&format!(
        "Starting merge + GGUF export on {} (checkpoint-{}, quant: {})",
        host, checkpoint, quant
    ));
    ui::print_info("This will take ~30-60 min (base model download + merge + GGUF conversion).");
    ui::print_info(&format!("Output GGUF: {}", gguf_out));

    let run_cmd = format!(
        "cd {} && nohup python {} --checkpoint {} --output {} --gguf-output {} --quantization {} \
         > /tmp/hiran_merge_{}.log 2>&1 & echo \"MERGE_PID=$!\"",
        workspace, merge_script, checkpoint_dir, merged_dir, gguf_out, quant, checkpoint
    );

    let output_spawn = Command::new("ssh")
        .args([
            "-p", &port.to_string(),
            "-i", &ssh_key,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", ssh_user, host),
            &run_cmd,
        ])
        .output()
        .await?;

    let stdout = String::from_utf8_lossy(&output_spawn.stdout);
    if stdout.contains("MERGE_PID") {
        ui::print_ok(&format!("Merge job started: {}", stdout.trim()));
        ui::print_info(&format!("Monitor progress: ssh -p {} root@{} 'tail -f /tmp/hiran_merge_{}.log'", port, host, checkpoint));
        ui::print_info(&format!("When done, download GGUF: zion-agent model-download --checkpoint {}", checkpoint));
    } else {
        ui::print_err(&format!("Failed to start merge job: {}", stdout));
        let stderr = String::from_utf8_lossy(&output_spawn.stderr);
        if !stderr.is_empty() {
            ui::print_err(&format!("stderr: {}", stderr));
        }
    }

    Ok(())
}

/// Wait for merge job and tail log
pub async fn merge_wait(cfg: &AgentConfig, checkpoint: u32) -> Result<()> {
    let host = &cfg.hiran.remote_host;
    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw).to_string();
    let port = cfg.hiran.remote_port;
    let ssh_user = &cfg.hiran.ssh_user;

    let tail_cmd = format!("tail -f /tmp/hiran_merge_{}.log", checkpoint);
    ui::print_info(&format!("Tailing merge log (checkpoint-{})... Ctrl+C to detach.", checkpoint));

    let _ = Command::new("ssh")
        .args([
            "-t",
            "-p", &port.to_string(),
            "-i", &ssh_key,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", ssh_user, host),
            &tail_cmd,
        ])
        .spawn()?
        .wait()
        .await?;

    Ok(())
}

/// Download the built GGUF file from remote server
pub async fn download_gguf(cfg: &AgentConfig, checkpoint: u32, quantize: Option<&str>) -> Result<()> {
    let host = &cfg.hiran.remote_host;
    if host.is_empty() {
        ui::print_err("No remote host configured.");
        return Ok(());
    }

    let ssh_key_raw = cfg.hiran.ssh_key.to_string_lossy().to_string();
    let ssh_key = shellexpand::tilde(&ssh_key_raw).to_string();
    let port = cfg.hiran.remote_port;
    let ssh_user = &cfg.hiran.ssh_user;
    let workspace = cfg.hiran.remote_workspace.trim_end_matches("/hiran-v2.3");
    let quant = quantize.unwrap_or("q5_k_m");

    // Determine remote GGUF path
    let remote_gguf = if !cfg.hiran.gguf_path.is_empty() {
        cfg.hiran.gguf_path.clone()
    } else {
        format!("{}/hiran-v2.3-{}-{}.gguf", workspace, checkpoint, quant)
    };

    // Check it exists and get size
    let size_cmd = format!("stat -c%s {} 2>/dev/null || echo MISSING", remote_gguf);
    let size_out = Command::new("ssh")
        .args([
            "-p", &port.to_string(),
            "-i", &ssh_key,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            &format!("{}@{}", ssh_user, host),
            &size_cmd,
        ])
        .output()
        .await?;

    let size_str = String::from_utf8_lossy(&size_out.stdout).trim().to_string();
    if size_str == "MISSING" || size_str.is_empty() {
        ui::print_err(&format!("GGUF not found on server: {}", remote_gguf));
        ui::print_info("Run 'zion-agent model-merge' first to build the GGUF.");
        return Ok(());
    }

    let size_bytes: u64 = size_str.parse().unwrap_or(0);
    let size_gb = size_bytes as f64 / 1e9;

    std::fs::create_dir_all(&cfg.paths.models_dir)?;
    let filename = format!("hiran-v2.3-{}-{}.gguf", checkpoint, quant);
    let local_path = cfg.paths.models_dir.join(&filename);

    if local_path.exists() {
        let local_size = std::fs::metadata(&local_path)?.len();
        if local_size == size_bytes {
            ui::print_ok(&format!("GGUF already downloaded and complete: {}", local_path.display()));
            return Ok(());
        }
        ui::print_warn(&format!("Partial download detected ({:.2} GB / {:.2} GB). Re-downloading.", local_size as f64 / 1e9, size_gb));
        std::fs::remove_file(&local_path)?;
    }

    ui::print_info(&format!(
        "Downloading {:.1} GB → {}",
        size_gb,
        local_path.display()
    ));
    ui::print_info("This will take 20-40 min on a typical connection...");

    let scp = Command::new("scp")
        .args([
            "-P", &port.to_string(),
            "-i", &ssh_key,
            "-o", "StrictHostKeyChecking=no",
            "-o", "UserKnownHostsFile=/dev/null",
            &format!("{}@{}:{}", ssh_user, host, remote_gguf),
            &local_path.to_string_lossy(),
        ])
        .spawn()?
        .wait()
        .await?;

    if scp.success() {
        let local_size = std::fs::metadata(&local_path)?.len();

        // Verify MD5
        let md5_cmd = format!("md5sum {}", remote_gguf);
        let remote_md5 = Command::new("ssh")
            .args([
                "-p", &port.to_string(),
                "-i", &ssh_key,
                "-o", "StrictHostKeyChecking=no",
                "-o", "UserKnownHostsFile=/dev/null",
                &format!("{}@{}", ssh_user, host),
                &md5_cmd,
            ])
            .output()
            .await
            .map(|o| String::from_utf8_lossy(&o.stdout).split_whitespace().next().unwrap_or("").to_string())
            .unwrap_or_default();

        ui::print_ok(&format!(
            "Downloaded: {} ({:.2} GB)",
            local_path.display(),
            local_size as f64 / 1e9
        ));

        if !remote_md5.is_empty() {
            ui::print_info(&format!("Remote MD5: {}", remote_md5));
            ui::print_info("To verify locally: Get-FileHash -Algorithm MD5 <path> (PowerShell) or md5sum <path> (Linux)");
        }

        ui::print_ok("Download complete. You can now:");
        ui::print_info("  1. Load in LM Studio (drag GGUF file)");
        ui::print_info("  2. Start local llama-server: llama-server --model <path> --port 8080");
        ui::print_info("  3. Connect zion-agent: config set llm.api_url http://localhost:8080/v1");
    } else {
        ui::print_err("scp failed. Check your SSH connection and disk space.");
    }

    Ok(())
}
