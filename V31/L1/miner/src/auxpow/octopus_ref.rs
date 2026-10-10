//! Octopus (Conflux / CFX) CPU reference — 1:1 port of Conflux-Rust
//! `crates/cfxcore/pow/src/compute.rs` (`hash_compute`/`light_compute`) and
//! `shared.rs` constants. Used by the KAT to consensus-verify the OpenCL
//! `octopus_mine` kernel bit-for-bit.
//!
//! Layout notes vs the OpenCL kernel:
//!   - DAG nodes are 64 bytes (same item structure as Ethash —
//!     `crate::auxpow::gpu_opencl_full::ethash_dataset_item` applies).
//!   - `num_full_pages` = full_size / 256 = dag_nodes / 4.

use sha3::{Digest, Keccak256, Keccak512};

pub const POW_MOD: u64 = 1032193;
pub const POW_MOD_B: u64 = 11;
pub const POW_N: usize = 1024;
pub const POW_WARP: u64 = 32;
pub const POW_DPT: usize = 32; // POW_DATA_PER_THREAD = POW_N / POW_WARP
const FNV_PRIME: u32 = 0x01000193;

#[inline]
fn fnv1(x: u32, y: u32) -> u32 {
    x.wrapping_mul(FNV_PRIME) ^ y
}

#[inline]
fn fnv64(x: u64, y: u64) -> u64 {
    x.wrapping_mul(FNV_PRIME as u64) ^ y
}

#[inline]
fn rotl(x: u64, b: u64) -> u64 {
    (x << b) | (x >> (64 - b))
}

struct SipHasher {
    v: [u64; 4],
}

impl SipHasher {
    fn sip_round(&mut self) {
        let v = &mut self.v;
        v[0] = v[0].wrapping_add(v[1]);
        v[2] = v[2].wrapping_add(v[3]);
        v[1] = rotl(v[1], 13);
        v[3] = rotl(v[3], 16);
        v[1] ^= v[0];
        v[3] ^= v[2];
        v[0] = rotl(v[0], 32);
        v[2] = v[2].wrapping_add(v[1]);
        v[0] = v[0].wrapping_add(v[3]);
        v[1] = rotl(v[1], 17);
        v[3] = rotl(v[3], 21);
        v[1] ^= v[2];
        v[3] ^= v[0];
        v[2] = rotl(v[2], 32);
    }

    fn hash24(&mut self, nonce: u64) {
        self.v[3] ^= nonce;
        self.sip_round();
        self.sip_round();
        self.v[0] ^= nonce;
        self.v[2] ^= 0xff;
        for _ in 0..4 {
            self.sip_round();
        }
    }

    fn xor_lanes(&self) -> u64 {
        self.v[0] ^ self.v[1] ^ self.v[2] ^ self.v[3]
    }
}

fn gcd(mut a: u64, mut b: u64) -> u64 {
    while b != 0 {
        let t = b;
        b = a % b;
        a = t;
    }
    a
}

fn power_mod(a1: u64, mut n: u64) -> u64 {
    let mut a = a1;
    let mut result = 1u64;
    while n > 0 {
        if n & 1 == 1 {
            result = result * a % POW_MOD;
        }
        a = a * a % POW_MOD;
        n >>= 1;
    }
    result
}

fn remap(h: u64) -> u64 {
    let mut e = h % (POW_MOD - 2) + 1;
    loop {
        let g = gcd(e, POW_MOD - 1);
        if g == 1 {
            break;
        }
        e /= g;
    }
    power_mod(POW_MOD_B, e)
}

fn compute_c(a: u64, b: u64, h0: u64) -> u64 {
    let mut h = h0;
    loop {
        let c = remap(h);
        if b * b % POW_MOD != 4u64 * a * c % POW_MOD {
            return c;
        }
        h = h.wrapping_add(1);
    }
}

/// Octopus cache sizing (shared.rs `get_cache_size`): 16 MiB + 64 KiB/stage,
/// rounded down to a prime count of 64-byte nodes.
pub fn octopus_cache_size(block_height: u64) -> u64 {
    let stage = block_height / 524_288;
    let mut sz: u64 = (2 << 23) + (1 << 16) * stage;
    sz -= 64;
    while !is_prime_u64(sz / 64) {
        sz -= 2 * 64;
    }
    sz
}

/// Octopus dataset sizing (shared.rs `get_data_size`): 4 GiB + 16 MiB/stage,
/// prime count of 256-byte pages.
pub fn octopus_data_size(block_height: u64) -> u64 {
    let stage = block_height / 524_288;
    let mut sz: u64 = (2 << 31) + (1 << 24) * stage;
    sz -= 256;
    while !is_prime_u64(sz / 256) {
        sz -= 2 * 256;
    }
    sz
}

/// ident = stage seedhash: keccak256 chained `stage` times from 32 zero bytes
/// (same construction as the ethash epoch seed).
pub fn octopus_ident(stage: u64) -> [u8; 32] {
    let mut seed = [0u8; 32];
    for _ in 0..stage {
        let mut h = Keccak256::new();
        h.update(seed);
        seed = h.finalize().into();
    }
    seed
}

/// Octopus memory cache — identical structure to the ethash light cache
/// (keccak512 chain + 3 randmemhash rounds), seeded by `ident`.
pub fn octopus_make_cache(num_nodes: usize, ident: &[u8; 32]) -> Vec<u8> {
    let n = num_nodes.max(1);
    let mut cache = vec![0u8; n * 64];
    {
        let mut h = Keccak512::new();
        h.update(ident);
        cache[..64].copy_from_slice(&h.finalize());
    }
    for i in 1..n {
        let mut h = Keccak512::new();
        h.update(&cache[(i - 1) * 64..i * 64]);
        cache[i * 64..(i + 1) * 64].copy_from_slice(&h.finalize());
    }
    for _ in 0..3 {
        for i in 0..n {
            let w0 = u32::from_le_bytes(cache[i * 64..i * 64 + 4].try_into().unwrap()) as usize;
            let idx = w0 % n;
            let prev = (n - 1 + i) % n;
            let mut data = [0u8; 64];
            for j in 0..8 {
                let a = u64::from_le_bytes(
                    cache[prev * 64 + j * 8..prev * 64 + j * 8 + 8]
                        .try_into()
                        .unwrap(),
                );
                let b = u64::from_le_bytes(
                    cache[idx * 64 + j * 8..idx * 64 + j * 8 + 8]
                        .try_into()
                        .unwrap(),
                );
                data[j * 8..j * 8 + 8].copy_from_slice(&(a ^ b).to_le_bytes());
            }
            let mut h = Keccak512::new();
            h.update(&data);
            cache[i * 64..(i + 1) * 64].copy_from_slice(&h.finalize());
        }
    }
    cache
}

fn is_prime_u64(n: u64) -> bool {
    if n < 2 {
        return false;
    }
    if n % 2 == 0 {
        return n == 2;
    }
    let mut d = 3u64;
    while d * d <= n {
        if n % d == 0 {
            return false;
        }
        d += 2;
    }
    true
}

/// Full Octopus hash — `light_compute` equivalent. `dag_nodes` is the
/// dataset node count (full_size / 64), i.e. `num_full_pages = dag_nodes / 4`;
/// `dag_item` supplies 64-byte dataset nodes on demand (e.g.
/// `octopus_dag_item` over the light cache).
pub fn octopus_hash_ref(
    header_hash: &[u8; 32],
    nonce: u64,
    dag_nodes: u64,
    dag_item: &dyn Fn(u64) -> [u8; 64],
) -> [u8; 32] {
    let gu64 = |b: &[u8], i: usize| u64::from_le_bytes(b[i * 8..i * 8 + 8].try_into().unwrap());
    let v = [
        gu64(header_hash, 0),
        gu64(header_hash, 1),
        gu64(header_hash, 2),
        gu64(header_hash, 3),
    ];

    let a = remap(v[0]);
    let b = remap(v[1]);
    let c = compute_c(a, b, v[2]);
    let w = remap(v[3]);

    // d matrix: POW_N u32 entries
    let mut d = [0u32; POW_N];
    let warp_id = nonce / POW_WARP;
    for i in 0..POW_WARP {
        let mut hasher = SipHasher { v };
        hasher.hash24(warp_id * POW_WARP + i);
        for j in 0..POW_DPT {
            hasher.sip_round();
            d[j * POW_WARP as usize + i as usize] =
                ((hasher.xor_lanes() & 0xFFFF_FFFF) % POW_MOD) as u32;
        }
    }

    let w2 = w * w % POW_MOD;
    let mut wpow = 1u64;
    let mut w2pow = 1u64;
    for _ in 0..nonce % POW_WARP {
        wpow = wpow * w % POW_MOD;
        w2pow = w2pow * w2 % POW_MOD;
    }
    let mut full_wpow = wpow;
    let mut full_w2pow = w2pow;
    for _ in nonce % POW_WARP..POW_WARP {
        full_wpow = full_wpow * w % POW_MOD;
        full_w2pow = full_w2pow * w2 % POW_MOD;
    }

    let mut res_buf = [0u32; POW_DPT];
    let mut result = 0u64;
    for i in 0..POW_DPT {
        let x = (a * w2pow + b * wpow + c) % POW_MOD;
        let mut pv = 0u64;
        for j in 0..POW_N {
            pv = (pv * x + d[POW_N - j - 1] as u64) % POW_MOD;
        }
        res_buf[i] = pv as u32;
        result = fnv64(result, pv);
        if i + 1 < POW_DPT {
            wpow = wpow * full_wpow % POW_MOD;
            w2pow = w2pow * full_w2pow % POW_MOD;
        }
    }

    // half_mix = keccak512(header_hash || result_le)
    let mut h = Keccak512::new();
    h.update(&header_hash[..]);
    h.update(result.to_ne_bytes());
    let half_mix: [u8; 64] = h.finalize().into();

    // mix = half_mix x4 -> 64 u32 words
    let gu32 = |m: &[u8], i: usize| u32::from_le_bytes(m[i * 4..i * 4 + 4].try_into().unwrap());
    let mut mix = [0u32; 64];
    for n in 0..4 {
        for j in 0..16 {
            mix[n * 16 + j] = gu32(&half_mix, j);
        }
    }
    let first_val = mix[0];
    let num_pages = dag_nodes / 4;

    // 32 accesses, each fnv-mixes four consecutive 64B nodes into mix[n].
    for i in 0..POW_DPT {
        let index = (fnv1(first_val ^ i as u32 ^ res_buf[i], mix[i]) as u64 % num_pages) as u32;
        for n in 0..4 {
            let node = dag_item(index as u64 * 4 + n as u64);
            for k in 0..16 {
                mix[n * 16 + k] = fnv1(mix[n * 16 + k], gu32(&node, k));
            }
        }
    }

    // compress
    let mut cmix = [0u8; 32];
    for i in 0..8 {
        let mut r1 = mix[4 * i];
        r1 = r1.wrapping_mul(FNV_PRIME) ^ mix[4 * i + 1];
        r1 = r1.wrapping_mul(FNV_PRIME) ^ mix[4 * i + 2];
        r1 = r1.wrapping_mul(FNV_PRIME) ^ mix[4 * i + 3];
        let mut r2 = mix[32 + 4 * i];
        r2 = r2.wrapping_mul(FNV_PRIME) ^ mix[32 + 4 * i + 1];
        r2 = r2.wrapping_mul(FNV_PRIME) ^ mix[32 + 4 * i + 2];
        r2 = r2.wrapping_mul(FNV_PRIME) ^ mix[32 + 4 * i + 3];
        cmix[i * 4..i * 4 + 4].copy_from_slice(&(r1.wrapping_mul(FNV_PRIME) ^ r2).to_le_bytes());
    }

    // final = keccak256(half_mix || cmix)
    let mut h = Keccak256::new();
    h.update(&half_mix);
    h.update(&cmix);
    h.finalize().into()
}

/// One 64-byte Octopus DAG item — `calculate_dag_item` (identical item
/// structure to Ethash: 256 FNV-1 parent mixes between two keccak512s).
/// `cache` = flat 64B node array from `octopus_make_cache`.
pub fn octopus_dag_item(cache: &[u8], index: u64) -> [u8; 64] {
    let n = cache.len() / 64;
    let gu32 = |m: &[u8; 64], i: usize| u32::from_le_bytes(m[i * 4..i * 4 + 4].try_into().unwrap());

    let mut mix: [u8; 64] = cache[(index as usize % n) * 64..(index as usize % n) * 64 + 64]
        .try_into()
        .unwrap();
    let w0 = gu32(&mix, 0) ^ index as u32;
    mix[0..4].copy_from_slice(&w0.to_le_bytes());
    {
        let mut h = Keccak512::new();
        h.update(&mix);
        mix = h.finalize().into();
    }
    for j in 0..256u32 {
        let p = (fnv1(index as u32 ^ j, gu32(&mix, (j % 16) as usize)) as usize) % n;
        for w in 0..16 {
            let v = fnv1(
                gu32(&mix, w),
                gu32(&cache[p * 64..p * 64 + 64].try_into().unwrap(), w),
            );
            mix[w * 4..w * 4 + 4].copy_from_slice(&v.to_le_bytes());
        }
    }
    let mut h = Keccak512::new();
    h.update(&mix);
    h.finalize().into()
}
