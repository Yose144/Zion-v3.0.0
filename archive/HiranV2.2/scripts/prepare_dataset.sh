#!/bin/bash
# Hiran v2.2 Dataset Preparation Script
# Tento skript připraví dataset pro curriculum learning

set -e

echo "========================================="
echo "Hiran v2.2 Dataset Preparation"
echo "========================================="

# Adresářová struktura
BASE_DIR="HiranV2.2"
DATA_DIR="$BASE_DIR/data/curriculum"
CURRICULUM_DIR="$BASE_DIR/curriculum"

# Vytvořit adresáře
mkdir -p "$DATA_DIR"
mkdir -p "$CURRICULUM_DIR/stages"
mkdir -p "$CURRICULUM_DIR/config"

echo "✓ Directory structure created"

# 1. Kopírovat existující v2.1 data
echo ""
echo "Step 1: Copying v2.1 data..."
if [ -d "HiranV2.1/finetune/data" ]; then
    cp -r HiranV2.1/finetune/data/* "$DATA_DIR/" 2>/dev/null || true
    echo "✓ v2.1 data copied"
else
    echo "⚠ v2.1 data directory not found, skipping..."
fi

# 2. Scrape V3 dokumentace
echo ""
echo "Step 2: Scraping V3 documentation..."
python3 "$CURRICULUM_DIR/curriculum_pipeline.py" --create-structure
python3 "$BASE_DIR/data/build_dataset.py" --scrape-v3
echo "✓ V3 documentation processed"

# 3. Validovat dataset
echo ""
echo "Step 3: Validating dataset..."
python3 "$BASE_DIR/data/validate_dataset.py"
echo "✓ Dataset validation complete"

# 4. Generovat statistiky
echo ""
echo "Step 4: Generating dataset statistics..."
python3 << 'EOF'
import json
import os
from pathlib import Path

data_dir = Path("HiranV2.2/data/curriculum")
total_pairs = 0
stage_stats = {}

for jsonl_file in data_dir.glob("*.jsonl"):
    stage_name = jsonl_file.stem
    count = 0
    with open(jsonl_file, 'r') as f:
        for line in f:
            count += 1
            total_pairs += 1
    stage_stats[stage_name] = count

print("\n" + "="*50)
print("Dataset Statistics")
print("="*50)
print(f"Total pairs: {total_pairs}")
print("\nPer stage:")
for stage, count in sorted(stage_stats.items()):
    percentage = (count / total_pairs * 100) if total_pairs > 0 else 0
    print(f"  {stage}: {count} ({percentage:.1f}%)")
print("="*50 + "\n")

# Uložit statistiky
stats = {
    "total_pairs": total_pairs,
    "stage_stats": stage_stats,
    "target_pairs": 5000,
    "progress": f"{total_pairs}/5000 ({total_pairs/5000*100:.1f}%)"
}

with open("HiranV2.2/data/dataset_stats.json", 'w') as f:
    json.dump(stats, f, indent=2)

print("✓ Statistics saved to HiranV2.2/data/dataset_stats.json")
EOF

echo ""
echo "========================================="
echo "Dataset preparation complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Review dataset statistics in HiranV2.2/data/dataset_stats.json"
echo "2. Run curriculum training: python3 HiranV2.2/scripts/train_v2.2.py"
echo "3. Monitor training progress"
echo ""