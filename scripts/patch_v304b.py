#!/usr/bin/env python3
"""Patch gpu_backend.rs: fix NPU buffer allocation hang on AMD gfx900.
Replace copy_host_slice pattern with create-then-write to avoid CL_MEM_COPY_HOST_PTR driver bug."""

path = '/root/zion-2.9.6/V3/L1/miner/src/gpu_backend.rs'
with open(path, 'r') as f:
    code = f.read()

# Find and replace the NPU buffer allocation section
# The current code (after v3.0.4 patch) looks like:
#   npu: packing epoch=0...
#   let packed = ...
#   npu: packed w=...
#   let npu_weights = Buffer::<i8>::builder().queue(...).len(...).copy_host_slice(...).build()?;
#   npu: weights_buf ok  (this printed fine)
#   let npu_biases = Buffer::<i8>::builder().queue(...).len(...).copy_host_slice(...).build()?;
#   <HANGS HERE>

# Replace all 4 NPU buffer allocations with create-then-write pattern
old_block = """            let npu_weights = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.weights.len().max(1))
                .copy_host_slice(&packed.weights).build()?;
            println!("npu: weights_buf ok"); let _ = std::io::stdout().flush();
            let npu_biases = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.biases.len().max(1))
                .copy_host_slice(&packed.biases).build()?;
            let npu_scales = Buffer::<i16>::builder()
                .queue(q.clone()).len(packed.scales.len().max(1))
                .copy_host_slice(&packed.scales).build()?;
            let npu_meta = Buffer::<u32>::builder()
                .queue(q.clone()).len(packed.meta.len())
                .copy_host_slice(&packed.meta).build()?;"""

new_block = """            // Create NPU buffers WITHOUT copy_host_slice (AMD gfx900 driver bug workaround)
            let npu_weights = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.weights.len().max(1)).build()?;
            if !packed.weights.is_empty() {
                npu_weights.write(&packed.weights).enq()?;
            }
            println!("npu: weights_buf ok len={}", packed.weights.len()); let _ = std::io::stdout().flush();

            let npu_biases = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.biases.len().max(1)).build()?;
            if !packed.biases.is_empty() {
                npu_biases.write(&packed.biases).enq()?;
            }
            println!("npu: biases_buf ok len={}", packed.biases.len()); let _ = std::io::stdout().flush();

            let npu_scales = Buffer::<i16>::builder()
                .queue(q.clone()).len(packed.scales.len().max(1)).build()?;
            if !packed.scales.is_empty() {
                npu_scales.write(&packed.scales).enq()?;
            }
            println!("npu: scales_buf ok len={}", packed.scales.len()); let _ = std::io::stdout().flush();

            let npu_meta = Buffer::<u32>::builder()
                .queue(q.clone()).len(packed.meta.len()).build()?;
            npu_meta.write(&packed.meta).enq()?;
            println!("npu: meta_buf ok len={}", packed.meta.len()); let _ = std::io::stdout().flush();"""

if old_block in code:
    code = code.replace(old_block, new_block, 1)
    print("Replaced NPU buffer allocation with create-then-write pattern")
else:
    # Maybe the intermediate prints weren't all added -- try original form
    old_block2 = """            let npu_weights = Buffer::<i8>::builder()
                .queue(q.clone()).len(packed.weights.len().max(1))
                .copy_host_slice(&packed.weights).build()?;"""
    if old_block2 in code:
        # Find the full NPU section and replace
        import re
        # Match from first npu_weights to the npu_meta build
        pattern = r'(            let npu_weights = Buffer::<i8>::builder\(\)\n.*?\.copy_host_slice\(&packed\.meta\)\.build\(\)\?;)'
        match = re.search(pattern, code, re.DOTALL)
        if match:
            old_full = match.group(1)
            # Remove any existing intermediate prints
            code = code.replace(old_full, new_block, 1)
            print("Replaced NPU buffer section (regex match)")
        else:
            print("ERROR: Could not find NPU buffer section to replace")
    else:
        print("ERROR: NPU buffer section not found at all")

with open(path, 'w') as f:
    f.write(code)

# Verify
with open(path, 'r') as f:
    content = f.read()
if 'npu_weights.write(&packed.weights).enq()' in content:
    print("Verification OK: write-enq pattern present")
if 'copy_host_slice(&packed.weights)' not in content:
    print("Verification OK: copy_host_slice removed for weights")
else:
    print("WARNING: copy_host_slice still present for weights")

print("Patch v3.0.4b complete")
