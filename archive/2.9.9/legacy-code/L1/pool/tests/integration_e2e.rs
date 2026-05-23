/// End-to-end integration tests for ZION Pool
/// 
/// Tests the complete flow from miner connection to payout calculation

use tokio::net::TcpStream;
use tokio::io::{AsyncWriteExt, AsyncReadExt, BufReader, AsyncBufReadExt};
use serde_json::{json, Value};
use std::time::Duration;

const POOL_ADDR: &str = "127.0.0.1:3333";
const POOL_API_BASE: &str = "http://127.0.0.1:8080";
const TEST_WALLET: &str = "ZION_INTEGRATION_TEST";

/// Helper to connect and login a miner
async fn connect_miner(worker_name: &str) -> Result<TcpStream, anyhow::Error> {
    let mut stream = TcpStream::connect(POOL_ADDR).await?;
    
    let login = json!({
        "id": 1,
        "method": "login",
        "params": {
            "login": format!("{}.{}", TEST_WALLET, worker_name),
            "pass": "x",
            "agent": "integration_test/1.0"
        }
    });
    
    stream.write_all(login.to_string().as_bytes()).await?;
    stream.write_all(b"\n").await?;
    
    // Wait for response
    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await?;
    let response: Value = serde_json::from_slice(&buf[..n])?;
    
    if response["error"] != Value::Null {
        return Err(anyhow::anyhow!("Login failed: {:?}", response["error"]));
    }
    
    Ok(stream)
}

#[tokio::test]
#[ignore] // Requires running pool
async fn test_e2e_miner_login() {
    let result = connect_miner("test_worker").await;
    assert!(result.is_ok(), "Failed to connect and login: {:?}", result.err());
}

#[tokio::test]
#[ignore] // Requires running pool
async fn test_e2e_share_submission() {
    let mut stream = connect_miner("test_share_submit").await
        .expect("Failed to connect");
    
    // Submit a share
    let share = json!({
        "id": 2,
        "method": "submit",
        "params": {
            "id": format!("{}.test_share_submit", TEST_WALLET),
            "job_id": "test_job_123",
            "nonce": "12345678",
            "result": "0000000000000000000000000000000000000000000000000000000000000001"
        }
    });
    
    stream.write_all(share.to_string().as_bytes()).await.unwrap();
    stream.write_all(b"\n").await.unwrap();
    
    // Read response
    let mut buf = vec![0u8; 4096];
    let n = stream.read(&mut buf).await.unwrap();
    let response: Value = serde_json::from_slice(&buf[..n]).unwrap();
    
    println!("Share response: {:?}", response);
    
    // Check if share was accepted or rejected (either is valid response)
    assert!(
        response["result"].is_object() || response["error"].is_object(),
        "Invalid response format"
    );
}

#[tokio::test]
#[ignore] // Requires running pool
async fn test_e2e_multiple_miners() {
    let num_miners = 10;
    let mut handles = vec![];
    
    for i in 0..num_miners {
        let handle = tokio::spawn(async move {
            let worker = format!("worker_{}", i);
            connect_miner(&worker).await
        });
        handles.push(handle);
    }
    
    let mut successes = 0;
    for handle in handles {
        if let Ok(Ok(_)) = handle.await {
            successes += 1;
        }
    }
    
    assert_eq!(successes, num_miners, "Not all miners connected successfully");
}

#[tokio::test]
#[ignore] // Requires running pool
async fn test_e2e_vardiff_adjustment() {
    let mut stream = connect_miner("test_vardiff").await
        .expect("Failed to connect");
    
    // Submit multiple shares rapidly to trigger vardiff
    for i in 0..20 {
        let share = json!({
            "id": i + 2,
            "method": "submit",
            "params": {
                "id": format!("{}.test_vardiff", TEST_WALLET),
                "job_id": format!("job_{}", i),
                "nonce": format!("{:08x}", i),
                "result": "0000000000000000000000000000000000000000000000000000000000000001"
            }
        });
        
        stream.write_all(share.to_string().as_bytes()).await.unwrap();
        stream.write_all(b"\n").await.unwrap();
        
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    // Read responses - should see set_difficulty at some point
    let mut reader = BufReader::new(stream);
    let mut buf = String::new();
    let mut saw_difficulty = false;
    
    for _ in 0..25 {
        buf.clear();
        if reader.read_line(&mut buf).await.is_ok() {
            if let Ok(msg) = serde_json::from_str::<Value>(&buf) {
                if msg["method"] == "mining.set_difficulty" {
                    saw_difficulty = true;
                    println!("Vardiff triggered: {:?}", msg);
                    break;
                }
            }
        }
    }
    
    assert!(saw_difficulty, "Vardiff was not triggered");
}

#[tokio::test]
#[ignore] // Requires running pool + Redis
async fn test_e2e_consciousness_xp() {
    use redis::AsyncCommands;
    
    let mut stream = connect_miner("test_consciousness").await
        .expect("Failed to connect");
    
    // Submit shares to gain XP
    for i in 0..10 {
        let share = json!({
            "id": i + 2,
            "method": "submit",
            "params": {
                "id": format!("{}.test_consciousness", TEST_WALLET),
                "job_id": format!("job_{}", i),
                "nonce": format!("{:08x}", i),
                "result": "0000000000000000000000000000000000000000000000000000000000000001"
            }
        });
        
        stream.write_all(share.to_string().as_bytes()).await.unwrap();
        stream.write_all(b"\n").await.unwrap();
        
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    
    // Check XP in Redis
    let client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
    let mut con = client.get_async_connection().await.unwrap();
    
    let xp_key = format!("consciousness:{}:xp", TEST_WALLET);
    let xp: Option<u64> = con.get(&xp_key).await.unwrap();
    
    println!("XP gained: {:?}", xp);
    assert!(xp.is_some() && xp.unwrap() > 0, "No XP was recorded");
}

#[tokio::test]
#[ignore] // Requires running pool + Redis
async fn test_e2e_pplns_calculation() {
    use redis::AsyncCommands;
    
    // Submit shares from multiple miners
    let miners = vec!["alice", "bob", "charlie"];
    
    for miner in &miners {
        let mut stream = connect_miner(miner).await
            .expect("Failed to connect");
        
        // Each miner submits 5 shares
        for i in 0..5 {
            let share = json!({
                "id": i + 2,
                "method": "submit",
                "params": {
                    "id": format!("{}.{}", TEST_WALLET, miner),
                    "job_id": format!("job_{}_{}", miner, i),
                    "nonce": format!("{:08x}", i),
                    "result": "0000000000000000000000000000000000000000000000000000000000000001"
                }
            });
            
            stream.write_all(share.to_string().as_bytes()).await.unwrap();
            stream.write_all(b"\n").await.unwrap();
            
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
    }
    
    // Wait for shares to be processed
    tokio::time::sleep(Duration::from_secs(2)).await;
    
    // Check share counts in Redis
    let client = redis::Client::open("redis://127.0.0.1:6379").unwrap();
    let mut con = client.get_async_connection().await.unwrap();
    
    for miner in &miners {
        let key = format!("miner:{}:shares", format!("{}.{}", TEST_WALLET, miner));
        let shares: Option<u64> = con.get(&key).await.unwrap();
        println!("Miner {} shares: {:?}", miner, shares);
        assert!(shares.is_some() && shares.unwrap() >= 5, "Miner {} didn't get shares recorded", miner);
    }
}

#[tokio::test]
#[ignore] // Requires running pool
async fn test_e2e_metrics_endpoint() {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/metrics", POOL_API_BASE))
        .send()
        .await
        .expect("Failed to connect to metrics endpoint");
    
    assert!(response.status().is_success(), "Metrics endpoint returned error");
    
    let body = response.text().await.unwrap();
    
    // Check for key metrics
    assert!(body.contains("pool_miners_total"), "Missing miners metric");
    assert!(body.contains("pool_shares_submitted"), "Missing shares metric");
    assert!(body.contains("pool_hashrate"), "Missing hashrate metric");
    
    println!("Metrics OK: {} bytes", body.len());
}

#[tokio::test]
#[ignore] // Requires running pool
async fn test_e2e_api_health() {
    let client = reqwest::Client::new();
    let response = client
        .get(format!("{}/api/health", POOL_API_BASE))
        .send()
        .await
        .expect("Failed to connect to API");
    
    assert!(response.status().is_success());
    
    let json: Value = response.json().await.unwrap();
    assert_eq!(json["status"], "ok", "Health check failed: {:?}", json);
    println!("Health check: {:?}", json);
}

#[tokio::test]
#[ignore] // Requires running pool
async fn test_e2e_api_miner_stats() {
    let client = reqwest::Client::new();
    
    // First submit some shares
    let mut stream = connect_miner("test_api_stats").await
        .expect("Failed to connect");
    
    for i in 0..5 {
        let share = json!({
            "id": i + 2,
            "method": "submit",
            "params": {
                "id": format!("{}.test_api_stats", TEST_WALLET),
                "job_id": format!("job_{}", i),
                "nonce": format!("{:08x}", i),
                "result": "0000000000000000000000000000000000000000000000000000000000000001"
            }
        });
        
        stream.write_all(share.to_string().as_bytes()).await.unwrap();
        stream.write_all(b"\n").await.unwrap();
        
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    
    // Wait for processing
    tokio::time::sleep(Duration::from_secs(1)).await;
    
    // Query stats
    let response = client
        .get(format!("{}/api/miner/{}", POOL_API_BASE, TEST_WALLET))
        .send()
        .await
        .expect("Failed to query miner stats");
    
    assert!(response.status().is_success());
    
    let json: Value = response.json().await.unwrap();
    println!("Miner stats: {:?}", json);
    
    assert_eq!(json["ok"], true, "API returned error: {:?}", json);
}
