use crate::config::AgentConfig;
use anyhow::Result;
use tokio::process::{Child, Command};

pub async fn serve(cfg: &AgentConfig, model: &str, backend: &str, port: u16) -> Result<()> {
    let mut child: Option<Child> = None;

    match backend {
        "llama_cpp" | "llama-cpp" => {
            child = Some(start_llama_cpp(model, port).await?);
        }
        "ollama" => {
            println!("Ollama backend: ensure model is loaded with 'ollama run {}'", model);
        }
        "auto" => {
            if let Ok(c) = try_llama_cpp(model, port).await {
                child = Some(c);
                println!("Auto-selected backend: llama.cpp");
            } else {
                println!("No local backend found. Please start inference manually.");
                return Ok(());
            }
        }
        _ => {
            println!("Unknown backend: {}. Supported: auto, llama_cpp, ollama", backend);
            return Ok(());
        }
    }

    if let Some(mut c) = child {
        println!("Inference server started on http://localhost:{}", port);
        println!("Press Ctrl+C to stop.");

        // Wait for Ctrl+C
        tokio::signal::ctrl_c().await?;
        println!("\nShutting down inference server...");
        let _ = c.kill().await;
    }

    Ok(())
}

pub async fn ask(cfg: &AgentConfig, question: &str) -> Result<String> {
    let client = reqwest::Client::new();
    let url = format!("{}/chat/completions", cfg.llm.api_url.trim_end_matches('/'));

    let body = serde_json::json!({
        "model": cfg.llm.model,
        "messages": [
            {"role": "user", "content": question}
        ],
        "temperature": cfg.llm.temperature,
        "max_tokens": 2048,
    });

    let mut req = client.post(&url).header("Content-Type", "application/json");
    if !cfg.llm.api_key.is_empty() {
        req = req.bearer_auth(&cfg.llm.api_key);
    }

    let resp = req.json(&body).send().await?;
    let data: serde_json::Value = resp.json().await?;

    let answer = data["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("No response")
        .to_string();

    Ok(answer)
}

async fn start_llama_cpp(model: &str, port: u16) -> Result<Child> {
    let child = Command::new("llama-server")
        .args([
            "-m", model,
            "--port", &port.to_string(),
            "-c", "8192",
            "--temp", "0.7",
        ])
        .spawn()?;
    Ok(child)
}

async fn try_llama_cpp(model: &str, port: u16) -> Result<Child> {
    // Check if llama-server is in PATH
    let check = Command::new("which")
        .arg("llama-server")
        .output()
        .await?;

    if !check.status.success() {
        return Err(anyhow::anyhow!("llama-server not found in PATH"));
    }

    start_llama_cpp(model, port).await
}
