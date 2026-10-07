//! Qhash (QubitCoin QTC) CPU reference — bit-exact port of
//! `csrc/opencl/qhash_kernel.cl`.
//!
//! Algorithm: SHA-256(header80 with nonce LE at bytes 0..3) → 64 nibbles
//! → 16-qubit, 2-layer circuit simulation (65536 f32 complex amplitudes;
//! RY/RZ rotations keyed by nibbles, CNOT chain) → Z-basis expectations
//! → int16 fixed-point → SHA-256(initial_hash ‖ expectations_LE).

use sha2::Digest;

const NUM_QUBITS: usize = 16;
const NUM_LAYERS: usize = 2;
const STATE_SIZE: usize = 1 << NUM_QUBITS;
const PI32: f32 = std::f32::consts::PI;

fn apply_ry(state: &mut [[f32; 2]], q: usize, theta: f32) {
    let c = (theta * 0.5).cos();
    let s = (theta * 0.5).sin();
    let stride = 1usize << q;
    let mut i = 0;
    while i < STATE_SIZE {
        for j in i..i + stride {
            let a0 = state[j];
            let a1 = state[j + stride];
            state[j][0] = c * a0[0] - s * a1[0];
            state[j][1] = c * a0[1] - s * a1[1];
            state[j + stride][0] = s * a0[0] + c * a1[0];
            state[j + stride][1] = s * a0[1] + c * a1[1];
        }
        i += stride << 1;
    }
}

fn apply_rz(state: &mut [[f32; 2]], q: usize, theta: f32) {
    let c = (theta * 0.5).cos();
    let s = (theta * 0.5).sin();
    let stride = 1usize << q;
    let mut i = 0;
    while i < STATE_SIZE {
        for j in i..i + stride {
            let a0 = state[j];
            let a1 = state[j + stride];
            state[j][0] = c * a0[0] + s * a0[1];
            state[j][1] = c * a0[1] - s * a0[0];
            state[j + stride][0] = c * a1[0] - s * a1[1];
            state[j + stride][1] = c * a1[1] + s * a1[0];
        }
        i += stride << 1;
    }
}

fn apply_cnot(state: &mut [[f32; 2]], q_ctrl: usize, q_tgt: usize) {
    let s_ctrl = 1usize << q_ctrl;
    let s_tgt = 1usize << q_tgt;
    for i in 0..STATE_SIZE {
        if (i & s_ctrl) != 0 && (i & s_tgt) == 0 {
            let j = i | s_tgt;
            state.swap(i, j);
        }
    }
}

fn compute_expectation(state: &[[f32; 2]], q: usize) -> f32 {
    let stride = 1usize << q;
    let mut exp_val = 0.0f32;
    let mut i = 0;
    while i < STATE_SIZE {
        for j in i..i + stride {
            let p0 = state[j][0] * state[j][0] + state[j][1] * state[j][1];
            let p1 = state[j + stride][0] * state[j + stride][0]
                + state[j + stride][1] * state[j + stride][1];
            exp_val += p0 - p1;
        }
        i += stride << 1;
    }
    exp_val
}

/// Full qhash for one nonce. `header` is the ≤80-byte template; the nonce
/// is injected little-endian into bytes 0..3 (QubitCoin convention — note
/// only the low 32 bits of the nonce are used by the kernel).
pub fn qhash_hash_ref(header: &[u8], nonce: u64) -> [u8; 32] {
    let mut hdr = [0u8; 80];
    let copy = header.len().min(80);
    hdr[..copy].copy_from_slice(&header[..copy]);
    hdr[0..4].copy_from_slice(&(nonce as u32).to_le_bytes());

    let initial_hash: [u8; 32] = sha2::Sha256::digest(hdr).into();

    let mut nibbles = [0u8; 64];
    for (i, b) in initial_hash.iter().enumerate() {
        nibbles[2 * i] = b >> 4;
        nibbles[2 * i + 1] = b & 0xF;
    }

    let mut state = vec![[0f32; 2]; STATE_SIZE];
    state[0][0] = 1.0;

    for l in 0..NUM_LAYERS {
        for i in 0..NUM_QUBITS {
            let idx = (2 * l * NUM_QUBITS + i) % 64;
            apply_ry(&mut state, i, -(nibbles[idx] as f32) * PI32 / 16.0);
        }
        for i in 0..NUM_QUBITS {
            let idx = ((2 * l + 1) * NUM_QUBITS + i) % 64;
            apply_rz(&mut state, i, -(nibbles[idx] as f32) * PI32 / 16.0);
        }
        for i in 0..NUM_QUBITS - 1 {
            apply_cnot(&mut state, i, i + 1);
        }
    }

    let mut buf = [0u8; 64];
    buf[..32].copy_from_slice(&initial_hash);
    for i in 0..NUM_QUBITS {
        let scaled = compute_expectation(&state, i) * 32768.0;
        let fixed = if scaled >= 0.0 {
            (scaled + 0.5) as i32 as i16
        } else {
            (scaled - 0.5) as i32 as i16
        };
        buf[32 + i * 2..32 + i * 2 + 2].copy_from_slice(&fixed.to_le_bytes());
    }

    sha2::Sha256::digest(buf).into()
}
