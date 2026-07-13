use zion_auxpow::external_hashers::{hash_blake3, hash_blake3_alph, meets_target_little_endian};

fn main() -> anyhow::Result<()> {
    #[cfg(feature = "gpu-opencl")]
    {
        use zion_auxpow::gpu_miner::GpuMiner;

        // A real 180-byte DCR header template from the local test pool.
        let header_hex = "0b00000000cf231da84f6a363c050e690a7377381241b4678eedad46a1f97fab41a7e8ad5209e5b13081f1854d83232211ac43faf27f5bf06a42963e65ea836721586050c2f2d8ce7a10a32702a8d1e326a921a69dbd0860168fbd5998c01a769841cbf001005ad72d2ce83d0500040002a00000c2970b1a1eb63c790600000080bd100051ac01005d20556a0000000030000068000000000000000000000000000000000000000000000000000000000b000000";
        let header = hex::decode(header_hex).unwrap();
        let header_zero = vec![0u8; 180];
        let target = [0xffu8; 32];

        println!("header_len={}", header.len());
        let mut gpu = GpuMiner::new()?;
        let mut ok = true;
        // Test nonce=0 on zero header with batch_size=1 for deterministic compare.
        let zero0 = gpu
            .mine_simple("blake3_dcr", &header_zero, &target, 0, 1)
            .expect("gpu mine nonce0 failed");
        if let Some(share) = zero0 {
            let cpu0 = hash_blake3(&header_zero, 0, 0);
            println!("zero nonce0 gpu={} cpu={} match={}",
                hex::encode(&share.hash), hex::encode(&cpu0), share.hash == cpu0);
            if share.hash != cpu0 { ok = false; }
        } else {
            eprintln!("ERROR: GPU did not return nonce0");
            ok = false;
        }

        for (label, hdr) in [("real", &header), ("zero", &header_zero)] {
            println!("\n--- {} header ---", label);
            let found = gpu
                .mine_simple("blake3_dcr", hdr, &target, 0, 1_000_000)
                .expect("gpu mine failed");

            // Also sanity-check the ALPH kernel against the CPU reference on
            // the same header to make sure the OpenCL compress functions are
            // not fundamentally broken.
            for alph_len in [40usize, 80usize] {
                let alph_blob = &hdr[..alph_len.min(hdr.len())];
                let alph_found = gpu
                    .mine_simple("blake3", alph_blob, &target, 0, 1_000_000)
                    .expect("alph gpu mine failed");
                if let Some(share) = alph_found {
                    let cpu_alph = hash_blake3_alph(alph_blob, &[], share.nonce);
                    println!("alph_len={} gpu nonce={} match={}", alph_len, share.nonce, cpu_alph == share.hash);
                    if cpu_alph != share.hash {
                        eprintln!("ERROR: ALPH GPU/CPU hash mismatch alph_len={}", alph_len);
                        ok = false;
                    }
                }
            }
            if let Some(share) = found {
                println!(
                    "gpu_found nonce={} hash={}",
                    share.nonce,
                    hex::encode(&share.hash)
                );
                let cpu_hash = hash_blake3(hdr, 0, share.nonce);
                println!("cpu_hash      ={} match_gpu={}", hex::encode(&cpu_hash), cpu_hash == share.hash);
                let mut legacy_input = hdr.to_vec();
                let n = share.nonce;
                legacy_input.extend_from_slice(&[n as u8, (n>>8) as u8, (n>>16) as u8, (n>>24) as u8, (n>>32) as u8, (n>>40) as u8, (n>>48) as u8, (n>>56) as u8]);
                let legacy_hash = zion_auxpow::external_hashers::hash_blake3_raw(&legacy_input);
                println!("legacy_hash   ={} match_gpu={}", hex::encode(&legacy_hash), legacy_hash == share.hash);
                let meets = meets_target_little_endian(&cpu_hash, &target);
                println!("cpu_meets_target={}", meets);
                // Search for a CPU nonce that yields the GPU hash (to expose an offset bug)
                for n in 0..10_000u64 {
                    let h = hash_blake3(hdr, 0, n);
                    if h == share.hash {
                        println!("cpu_matches_gpu at nonce={}", n);
                        break;
                    }
                }
                println!("cpu_hash_nonce0={}", hex::encode(&hash_blake3(hdr, 0, 0)));
                println!("cpu_hash_nonce_share={}", hex::encode(&cpu_hash));
                if !meets {
                    eprintln!("ERROR: CPU hash does not meet all-ones target");
                    ok = false;
                }
                if cpu_hash != share.hash {
                    eprintln!("ERROR: GPU/CPU hash mismatch");
                    ok = false;
                }
            } else {
                eprintln!("ERROR: GPU found no nonce with all-ones target in 1M");
                ok = false;
            }
        }
        if ok {
            println!("\nOK: GPU DCR kernel matches CPU reference");
        } else {
            std::process::exit(1);
        }
    }
    #[cfg(not(feature = "gpu-opencl"))]
    {
        eprintln!("run with --features gpu-opencl");
        std::process::exit(1);
    }
    Ok(())
}
