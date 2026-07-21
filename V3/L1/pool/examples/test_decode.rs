fn main() {
    let line = r#"{"type":"job","job_id":11755,"algorithm":"deeksha_lite_v1","start_nonce":52001048618,"nonce_count":1048576,"target_hex":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff","header_hex":"030000000000550d","height":11755,"stream_weights":"zion:35.6","external_stream":{"coin":"ALPH","algorithm":"blake3","job_id":"e9b1e58","header_hex":"00070000000000005adef4f982d2bb270c4bc2ea72502357067213d67fd0d23f27d","target_hex":"0000000400000000000000000000000000000000000000000000000000000000","height":0,"extranonce1_hex":"501d","protocol":"stratum","seed_hash_hex":"","timestamp":0},"external_stream_cpu":{"coin":"RTM","algorithm":"ghostrider","job_id":"5eae","header_hex":"00000020818ddfd","target_hex":"00031fffcdfffffffb50004b0000000707ff8f7ffffff57400a8c000000fd1ff","height":0,"extranonce1_hex":"8000061d","protocol":"stratum","seed_hash_hex":"","timestamp":1784498784}}"#;
    let result: Result<zion_pool::PoolMessage, _> = serde_json::from_str(line);
    match result {
        Ok(msg) => {
            println!("OK: decoded successfully");
            if let zion_pool::PoolMessage::Job { external_stream, .. } = &msg {
                if let Some(ext) = external_stream {
                    println!("external_stream: coin={} algo={}", ext.coin, ext.algorithm);
                }
            }
        }
        Err(e) => println!("ERROR: {e}"),
    }
}
