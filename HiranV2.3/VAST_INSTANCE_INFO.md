# Hiran v2.3 Vast.ai Instance — Connection Info

> **Created:** 2026-06-13  
> **Instance API Key:** 68a8a213d27c1e4e5f59a4457721a0e81e15aa5900bd517a2c4cf3e3ae51a7b6

---

## Instance Details

| Field | Value |
|---|---|
| **Contract ID** | 40781743 |
| **GPU** | A100 SXM4 x2 |
| **VRAM** | 80 GB per GPU (160 GB total) |
| **CPU** | AMD EPYC 7513 32-Core |
| **CPU RAM** | ~1.4 TB |
| **Disk** | 500 GB ✅ |
| **Cost** | ~$1.04/hr |
| **Location** | Massachusetts, US |
| **CUDA** | 12.8 (driver 570.195.03) |
| **Image** | nvidia/cuda:12.1.0-devel-ubuntu22.04 |
| **SSH Port** | 21742 |
| **Status** | 🟢 Training in progress |

---

## SSH Access

### SSH Key Location
```
~/.ssh/vast/hiran_v2.3_key
~/.ssh/vast/hiran_v2.3_key.pub
```

**Fingerprint:** `SHA256:gO0g1mQJZoygHS3G99Dhg31FUrSs4pETbyJyDDQbNyU`

### Connect
```bash
ssh -p <PORT> -i ~/.ssh/vast/hiran_v2.3_key root@ssh5.vast.ai
```

> **Note:** `<PORT>` will be provided once instance finishes loading. Check Vast.ai dashboard or run the poll command below.

### Check Status
```bash
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
INSTANCE_ID="40780492"

curl -s "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f\"Status: {data.get('cur_state')}\")
print(f\"SSH: {data.get('ssh_host')}:{data.get('ssh_port')}\")
print(f\"GPU: {data.get('gpu_name')} x{data.get('num_gpus')}\")
print(f\"Disk: {data.get('disk_space')} GB\")
"
```

---

## Why 10 GB Was Not Enough

| Requirement | Size |
|---|---|
| Base model (BF16) | ~65 GB |
| Dataset | ~30 MB |
| Checkpoints (per save) | ~65 GB |
| Optimizer states (CPU offload) | ~262 GB |
| OS + dependencies | ~20 GB |
| **Total needed** | **~400+ GB** |

10 GB would have failed immediately on model download.

---

## Next Steps After SSH

```bash
# 1. Verify GPU
nvidia-smi

# 2. Check disk space
df -h /

# 3. Clone repo and setup
git clone https://github.com/Yose144/Zion-v3.0.0.git
cd Zion-v3.0.0/HiranV2.3

# 4. Install dependencies
pip install transformers accelerate datasets deepspeed
pip install bitsandbytes peft trl

# 5. Verify dataset
python data/validate_v2.3.py

# 6. Dry run
python scripts/train_v2.3_fullft.py --stage all --dry_run

# 7. Start training
deepspeed --num_gpus=2 scripts/train_v2.3_fullft.py \
  --stage all \
  --deepspeed_config config/deepspeed_zero3.json
```

---

## Destroy When Done

```bash
API_KEY="4f86b4afa3f1219cc18708d6a6a2e6476793ae088d0e4e39d2a0baacacd592fd"
INSTANCE_ID="40780492"

curl -s -X DELETE "https://console.vast.ai/api/v0/instances/${INSTANCE_ID}/?api_key=${API_KEY}"
```

Or via web dashboard: https://cloud.vast.ai/

---

## Cost Estimate

| Phase | Duration | Cost |
|---|---|---|
| Setup + model download | ~1h | ~$1 |
| Full FT (3 epochs) | ~48h | ~$50 |
| Evaluation | ~4h | ~$4 |
| **Total** | **~53h** | **~$55** |

---

*Instance created with Vast.ai API*  
*SSH key: ~/.ssh/vast/hiran_v2.3_key*
