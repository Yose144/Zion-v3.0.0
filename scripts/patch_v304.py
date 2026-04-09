#!/usr/bin/env python3
"""Patch gpu_backend.rs with stdout flushing and granular NPU logging."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

# 1) Add flush import
if 'use std::io::Write;' not in code:
    code = code.replace('use ocl::{', 'use std::io::Write;\nuse ocl::{', 1)

# 2) Add flush after each existing debug println
flush_pairs = [
    ('println!("gpu_opencl_compiled ok");',
     'println!("gpu_opencl_compiled ok"); let _ = std::io::stdout().flush();'),
    ('println!("gpu_alloc header_buf...");',
     'println!("gpu_alloc header_buf..."); let _ = std::io::stdout().flush();'),
    ('println!("gpu_alloc scratchpad ok");',
     'println!("gpu_alloc scratchpad ok"); let _ = std::io::stdout().flush();'),
    ('println!("gpu_alloc result_bufs ok");',
     'println!("gpu_alloc result_bufs ok"); let _ = std::io::stdout().flush();'),
    ('println!("gpu_alloc npu_bufs ok");',
     'println!("gpu_alloc npu_bufs ok"); let _ = std::io::stdout().flush();'),
]

for old, new in flush_pairs:
    if old in code and new not in code:
        code = code.replace(old, new)

# Flush after scratchpad size print
old_sp = 'println!("gpu_alloc scratchpad work_size={} total_mib={}", actual_work_size, actual_work_size * 262144 / (1024*1024));'
new_sp = old_sp + ' let _ = std::io::stdout().flush();'
if old_sp in code and new_sp not in code:
    code = code.replace(old_sp, new_sp)

# 3) Add granular NPU logging between result_bufs and npu_bufs
# Find the NPU section and insert prints
old_npu_start = '            let init_epoch = 0u64;\n            let packed = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_packed(init_epoch);'
new_npu_start = '            let init_epoch = 0u64;\n            println!("npu: packing epoch={}...", init_epoch); let _ = std::io::stdout().flush();\n            let packed = zion_cosmic_harmony::algorithms_npu::chv4_npu_weights_packed(init_epoch);\n            println!("npu: packed w={} b={} s={} m={}", packed.weights.len(), packed.biases.len(), packed.scales.len(), packed.meta.len()); let _ = std::io::stdout().flush();'

if old_npu_start in code and 'npu: packing' not in code:
    code = code.replace(old_npu_start, new_npu_start)
    print("Added NPU packing prints")

# Add prints after each NPU buffer allocation
npu_buf_pairs = [
    ('.copy_host_slice(&packed.weights).build()?;',
     '.copy_host_slice(&packed.weights).build()?;\n            println!("npu: weights_buf ok"); let _ = std::io::stdout().flush();'),
    ('.copy_host_slice(&packed.biases).build()?;',
     '.copy_host_slice(&packed.biases).build()?;\n            println!("npu: biases_buf ok"); let _ = std::io::stdout().flush();'),
    ('.copy_host_slice(&packed.scales).build()?;',
     '.copy_host_slice(&packed.scales).build()?;\n            println!("npu: scales_buf ok"); let _ = std::io::stdout().flush();'),
    ('.copy_host_slice(&packed.meta).build()?;',
     '.copy_host_slice(&packed.meta).build()?;\n            println!("npu: meta_buf ok"); let _ = std::io::stdout().flush();'),
]

for old, new in npu_buf_pairs:
    if old in code and 'npu: weights_buf ok' not in code:
        code = code.replace(old, new, 1)  # Only first occurrence in OpenCL section

# 4) Add print before kernel builder
old_kernel = '            let kernel = pro_que\n                .kernel_builder(opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME)'
new_kernel = '            println!("gpu: building kernel args..."); let _ = std::io::stdout().flush();\n            let kernel = pro_que\n                .kernel_builder(opencl_kernel::EKAM_DEEKSHA_KERNEL_NAME)'
if old_kernel in code and 'building kernel args' not in code:
    code = code.replace(old_kernel, new_kernel, 1)

with open(path, 'w') as f:
    f.write(code)

print("Patch v3.0.4 complete")
