//! Live E2E test: connect to AlphaPool port 5571, authorize, receive mining.notify.
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() {
    let profile = zion_auxpow::types::CoinProfile::default_for(zion_auxpow::types::ExternalCoin::PRL);
    println!("Pool: {}:{}", profile.pool_host, profile.pool_port);
    println!("Protocol: {:?}", profile.coin.protocol());

    let client = zion_auxpow::auxpow_client::AuxPowClient::new(profile);

    // Use the test wallet from previous sessions
    let wallet = "prl1pk5t3amreqnqlp0q0l5zcauy2nyszlalux3rlcw93spwtr9mrlywsdesmmp";
    println!("Connecting to AlphaPool port 5571...");
    client.connect(wallet).await.expect("connect failed");
    println!("Connected and authorized!");

    // Wait for mining.notify
    for i in 0..10 {
        sleep(Duration::from_secs(2)).await;
        let job = client.current_job().await;
        if let Some(j) = job {
            println!("[{}s] Job received: id={} header_len={} height={:?} target={:.20}",
                i*2, j.job_id, j.header_bytes.len(), j.block_number, j.target_hex);
            break;
        } else {
            println!("[{}s] No job yet...", i*2);
        }
    }

    println!("E2E test complete!");
}
