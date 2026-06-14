#!/bin/bash
STEP=6500
LOCAL_DIR="/mnt/c/Users/yosef/HiranV2.3-Checkpoints/checkpoint-${STEP}"
mkdir -p "$LOCAL_DIR"

PARTS=(aa ab ac ad ae af ag ah ai aj ak al am an ao ap aq ar as at au)

for part in "${PARTS[@]}"; do
  FILE="adapter-${STEP}.part-${part}"
  LOCAL="$LOCAL_DIR/$FILE"
  REMOTE="root@ssh1.vast.ai:/workspace/hiran-v2.3/checkpoints/stage1_factual/checkpoint-${STEP}/$FILE"

  if [ -f "$LOCAL" ]; then
    echo "SKIP $FILE"
    continue
  fi

  scp -P 31384 -i /root/.ssh/vast/hiran_v2.4_key -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "$REMOTE" "$LOCAL"
  if [ $? -eq 0 ]; then
    echo "OK $FILE"
  else
    echo "FAILED $FILE"
  fi
done

echo "---ASSEMBLE---"
cat "$LOCAL_DIR"/adapter-${STEP}.part-* > "$LOCAL_DIR/adapter_model.safetensors"
rm "$LOCAL_DIR"/adapter-${STEP}.part-*
ls -lh "$LOCAL_DIR/adapter_model.safetensors"
echo "DONE"
