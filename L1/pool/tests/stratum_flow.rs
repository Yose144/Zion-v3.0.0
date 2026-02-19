use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use zion_pool::blockchain::{BlockTemplateManager, ZionRPCClient};
use zion_pool::shares::{RedisStorage, ShareProcessor, ShareValidator};
use zion_pool::session::SessionManager;
use zion_pool::stratum::StratumServer;

#[tokio::test]
async fn stratum_subscribe_authorize() {
    // Pick a free port to reduce flakiness.
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);

    let session_manager = Arc::new(SessionManager::new());

    let storage = Arc::new(RedisStorage::new("redis://localhost", 100_000).unwrap());
    let validator = Arc::new(ShareValidator::new("little"));
    let share_processor = Arc::new(ShareProcessor::new(
        validator,
        storage,
        None,
        None,
        "ZION_TEST_WALLET".to_string(),
        100_000, // pplns_window_shares
    ));

    let rpc_client = Arc::new(ZionRPCClient::new(
        "127.0.0.1".to_string(),
        18081,
        None,
        None,
        None,
        None,
    ));
    let template_manager = Arc::new(BlockTemplateManager::new(
        rpc_client,
        "ZION_TEST_WALLET".to_string(),
        Some(Duration::from_secs(10)),
    ));

    let server = Arc::new(StratumServer::new(
        "127.0.0.1".to_string(),
        port,
        session_manager.clone(),
        share_processor,
        Some(128),
        0.20,
    ));
    
    server.set_template_manager(template_manager);

    tokio::spawn({
        let server = Arc::clone(&server);
        async move {
            let _ = server.start().await;
        }
    });

    tokio::time::sleep(Duration::from_millis(200)).await;
    let mut s = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    s.write_all(b"{\"id\":1,\"method\":\"mining.subscribe\"}\n").await.unwrap();
    let mut buf = vec![0u8; 256]; let _ = s.readable().await; let n = s.read(&mut buf).await.unwrap_or(0);
    assert!(n > 0);
}

#[tokio::test]
async fn stratum_pushes_set_difficulty_on_vardiff_retarget() {
    // Fast retarget for test.
    std::env::set_var("ZION_VARDIFF_RETARGET_SECS", "0");
    std::env::set_var("ZION_VARDIFF_TARGET_SHARE_SECS", "10");
    std::env::set_var("ZION_VARDIFF_VARIANCE", "0");

    // Pick a free port.
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);

    let session_manager = Arc::new(SessionManager::new());

    let storage = Arc::new(RedisStorage::new("redis://localhost", 100_000).unwrap());
    let validator = Arc::new(ShareValidator::new("little"));
    let share_processor = Arc::new(ShareProcessor::new(
        validator,
        storage,
        None,
        None,
        "ZION_TEST_WALLET".to_string(),
        100_000, // pplns_window_shares
    ));

    let rpc_client = Arc::new(ZionRPCClient::new(
        "127.0.0.1".to_string(),
        18081,
        None,
        None,
        None,
        None,
    ));
    let template_manager = Arc::new(BlockTemplateManager::new(
        rpc_client,
        "ZION_TEST_WALLET".to_string(),
        Some(Duration::from_secs(10)),
    ));

    let server = Arc::new(StratumServer::new(
        "127.0.0.1".to_string(),
        port,
        session_manager.clone(),
        share_processor,
        Some(128),
        0.20,
    ));
    
    server.set_template_manager(template_manager);

    tokio::spawn({
        let server = Arc::clone(&server);
        async move {
            let _ = server.start().await;
        }
    });

    tokio::time::sleep(Duration::from_millis(200)).await;
    let mut s = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.unwrap();

    // Subscribe + authorize with easy diff=1 (job_target becomes max, any hash meets).
    s.write_all(b"{\"id\":1,\"method\":\"mining.subscribe\"}\n")
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_millis(50)).await;
    s.write_all(b"{\"id\":2,\"method\":\"mining.authorize\",\"params\":[\"ZION_TEST.wallet\",\"d=1\"]}\n")
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_millis(50)).await;

    // Submit a share: result=00.. passes any target.
    // Params layout (minimal for our parser): [worker, job_id, extranonce2, ntime, nonce, result]
    s.write_all(
        b"{\"id\":3,\"method\":\"mining.submit\",\"params\":[\"ZION_TEST.wallet\",\"current\",\"00\",\"00\",\"00000001\",\"0000000000000000000000000000000000000000000000000000000000000000\"]}\n",
    )
    .await
    .unwrap();

    let mut buf = vec![0u8; 2048];
    tokio::time::sleep(Duration::from_millis(200)).await;
    let n = s.read(&mut buf).await.unwrap_or(0);
    assert!(n > 0);
    let out = String::from_utf8_lossy(&buf[..n]);
    assert!(out.contains("mining.set_difficulty"), "out was: {out}");
}
