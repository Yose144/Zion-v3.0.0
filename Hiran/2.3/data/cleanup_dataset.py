#!/usr/bin/env python3
"""
Hiran v2.2 Dataset Cleanup
Odstranit duplicity a vylepšit distribuci
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Set
from collections import Counter


class DatasetCleaner:
    """Dataset cleanup utility"""
    
    def __init__(self, data_path: str = "HiranV2.2/data/curriculum"):
        self.data_path = Path(data_path)
    
    def remove_duplicates(self) -> Dict[str, int]:
        """Odstranit duplicity z curriculum souborů"""
        print("🧹 Removing duplicates...")
        removed_count = {}
        
        for stage_file in self.data_path.glob("*.jsonl"):
            stage_name = stage_file.stem
            
            # Načíst data
            data = []
            with open(stage_file, 'r') as f:
                for line in f:
                    data.append(json.loads(line))
            
            # Odstranit duplicity
            seen = set()
            clean_data = []
            
            for item in data:
                # Vytvořit hash z instruction + output
                key = item.get("instruction", "") + "|||" + item.get("output", "")
                if key not in seen:
                    seen.add(key)
                    clean_data.append(item)
            
            removed = len(data) - len(clean_data)
            removed_count[stage_name] = removed
            
            # Uložit clean data
            with open(stage_file, 'w') as f:
                for item in clean_data:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
            print(f"  {stage_name}: removed {removed} duplicates ({len(clean_data)} remaining)")
        
        return removed_count
    
    def fix_toxic_detection(self) -> Dict[str, int]:
        """Opravit toxic detection - technické termíny jsou OK"""
        print("🔧 Fixing toxic detection...")
        
        # Technické termíny které jsou OK
        technical_terms = {
            r'\bhack\b', r'\bexploit\b', r'\bvulnerability\b',
            r'\bsecurity\b', r'\bpenetration\b', r'\battack\b',
            r'\bmalicious\b', r'\bthreat\b'
        }
        
        fixed_count = {}
        
        for stage_file in self.data_path.glob("*.jsonl"):
            stage_name = stage_file.stem
            data = []
            
            with open(stage_file, 'r') as f:
                for line in f:
                    data.append(json.loads(line))
            
            # Re-validace s lepší toxic detection
            clean_data = []
            removed = 0
            
            for item in data:
                text = item.get("instruction", "") + " " + item.get("output", "")
                
                # Check pouze skutečně toxic patterny (ne technické)
                real_toxic = False
                toxic_patterns = [
                    r'\b(hate|kill|violence|terrorist)\b',
                    r'\b(racist|discrimination|slur)\b'
                ]
                
                for pattern in toxic_patterns:
                    if re.search(pattern, text, re.IGNORECASE):
                        # Check if it's not in legitimate technical context
                        if not any(term in text.lower() for term in ['security', 'system', 'network', 'protocol']):
                            real_toxic = True
                            break
                
                if not real_toxic:
                    clean_data.append(item)
                else:
                    removed += 1
            
            fixed_count[stage_name] = removed
            
            # Uložit
            with open(stage_file, 'w') as f:
                for item in clean_data:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
            if removed > 0:
                print(f"  {stage_name}: fixed {removed} toxic classifications")
        
        return fixed_count
    
    def rebalance_dataset(self, target_distribution: Dict[str, int]):
        """Přerozdistribuit data pro lepší balance"""
        print("⚖️  Rebalancing dataset...")
        
        # Načíst aktuální distribuci
        current_data = {}
        for stage_file in self.data_path.glob("*.jsonl"):
            stage_name = stage_file.stem
            data = []
            with open(stage_file, 'r') as f:
                for line in f:
                    data.append(json.loads(line))
            current_data[stage_name] = data
        
        # Přerozdistribuit z foundation do jiných kategorií
        foundation_data = current_data.get("foundation", [])
        excess = len(foundation_data) - 1000  # Cíl je 1000 pro foundation
        
        if excess > 0:
            print(f"  Moving {excess} pairs from foundation to other stages...")
            
            # Rozdělit excess podle target distribution
            redistribution = {
                "zion_core": min(target_distribution.get("zion_core", 1500) - len(current_data.get("zion_core", [])), excess // 2),
                "cross_domain": min(target_distribution.get("cross_domain", 1000) - len(current_data.get("cross_domain", [])), excess // 2),
                "zion_advanced": min(target_distribution.get("zion_advanced", 1000) - len(current_data.get("zion_advanced", [])), excess // 4),
                "rag_synthesis": min(target_distribution.get("rag_synthesis", 500) - len(current_data.get("rag_synthesis", [])), excess // 4)
            }
            
            # Přesunout data
            moved_count = 0
            for target_stage, count in redistribution.items():
                if count > 0 and foundation_data:
                    moved = foundation_data[:count]
                    foundation_data = foundation_data[count:]
                    
                    # Aktualizovat doménu
                    for item in moved:
                        item["domain"] = target_stage
                        item["metadata"]["rebalanced_from"] = "foundation"
                    
                    # Přidat do target
                    if target_stage not in current_data:
                        current_data[target_stage] = []
                    current_data[target_stage].extend(moved)
                    
                    moved_count += count
                    print(f"    {target_stage}: +{count} pairs")
            
            # Aktualizovat foundation
            current_data["foundation"] = foundation_data
        
        # Uložit re-balanced data
        for stage_name, data in current_data.items():
            stage_file = self.data_path / f"{stage_name}.jsonl"
            with open(stage_file, 'w') as f:
                for item in data:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            print(f"  {stage_name}: {len(data)} pairs")
        
        print(f"  Total moved: {moved_count} pairs")


def main():
    """Main funkce pro cleanup"""
    print("🚀 Cleaning Hiran v2.2 Dataset...")
    
    cleaner = DatasetCleaner()
    
    # 1. Odstranit duplicity
    print("\n[1/3] Removing duplicates...")
    dup_results = cleaner.remove_duplicates()
    
    # 2. Opravit toxic detection
    print("\n[2/3] Fixing toxic detection...")
    toxic_results = cleaner.fix_toxic_detection()
    
    # 3. Rebalance dataset
    print("\n[3/3] Rebalancing dataset...")
    target_dist = {
        "foundation": 1000,
        "zion_core": 1500,
        "zion_advanced": 1000,
        "cross_domain": 1000,
        "rag_synthesis": 500
    }
    cleaner.rebalance_dataset(target_dist)
    
    print("\n✅ Cleanup completed!")
    print("📝 Run validation again: python data/validate_dataset.py")


if __name__ == "__main__":
    main()
