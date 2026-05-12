#!/usr/bin/env python3
"""
Hiran v2.2 Dataset Validator
Validate dataset quality and detect hallucinations
"""

import json
import re
from pathlib import Path
from typing import List, Dict, Set
from collections import Counter


class DatasetValidator:
    """Validator pro kontrolu kvality datasetu"""
    
    def __init__(self, data_path: str = "HiranV2.2/data/curriculum"):
        self.data_path = Path(data_path)
        
        # Halucinace patterny
        self.hallucination_patterns = [
            r'https?://(zion\.io|zion\.com|github\.com/zion-core)',
            r'github\.com/zion-core/cli',
            r'zion\.io/docs/cli',
            r'www\.zion\.io',
            r'zion\.io',
            r'docs\.zion\.io',
            r'api\.zion\.io'
        ]
        
        # Toxic patterny (vyjma technické termíny)
        self.toxic_patterns = [
            r'\b(hate|kill|violence|terrorist)\b',
            r'\b(racist|discrimination|slur)\b'
        ]
        
        # Valid domain values
        self.valid_domains = {
            "foundation", "zion_core", "zion_advanced", 
            "cross_domain", "rag_synthesis"
        }
    
    def validate_all_stages(self) -> Dict[str, Dict]:
        """Validovat všechny curriculum fáze"""
        results = {}
        
        for stage_file in self.data_path.glob("*.jsonl"):
            stage_name = stage_file.stem
            results[stage_name] = self.validate_stage(stage_file)
        
        return results
    
    def validate_stage(self, stage_file: Path) -> Dict:
        """Validovat jednu fázi"""
        data = []
        with open(stage_file, 'r', encoding='utf-8') as f:
            for line in f:
                try:
                    data.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        
        if not data:
            return {
                "status": "ERROR",
                "message": "No valid data found",
                "total_pairs": 0
            }
        
        return {
            "status": "OK",
            "total_pairs": len(data),
            "avg_instruction_length": self._avg_length(data, "instruction"),
            "avg_output_length": self._avg_length(data, "output"),
            "missing_fields": self._check_missing_fields(data),
            "duplicates": self._check_duplicates(data),
            "hallucinations": self._check_hallucinations(data),
            "toxic_content": self._check_toxicity(data),
            "invalid_domains": self._check_invalid_domains(data),
            "empty_responses": self._check_empty_responses(data),
            "extreme_lengths": self._check_extreme_lengths(data),
            "balance_score": self._check_balance(data)
        }
    
    def _avg_length(self, data: List[Dict], field: str) -> float:
        """Vypočítat průměrnou délku pole"""
        lengths = [len(item.get(field, "")) for item in data]
        return sum(lengths) / len(lengths) if lengths else 0
    
    def _check_missing_fields(self, data: List[Dict]) -> int:
        """Zkontrolovat chybějící pole"""
        required_fields = ["instruction", "output", "domain"]
        missing = 0
        
        for item in data:
            for field in required_fields:
                if field not in item or not item[field]:
                    missing += 1
        
        return missing
    
    def _check_duplicates(self, data: List[Dict]) -> int:
        """Zkontrolovat duplicity"""
        seen = set()
        duplicates = 0
        
        for item in data:
            # Vytvořit hash z instruction + output
            key = item.get("instruction", "") + "|||" + item.get("output", "")
            if key in seen:
                duplicates += 1
            seen.add(key)
        
        return duplicates
    
    def _check_hallucinations(self, data: List[Dict]) -> int:
        """Zkontrolovat halucinované odkazy"""
        hallucination_count = 0
        affected_items = []
        
        for idx, item in enumerate(data):
            text = item.get("instruction", "") + " " + item.get("output", "")
            
            for pattern in self.hallucination_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    hallucination_count += 1
                    affected_items.append(idx)
                    break
        
        return hallucination_count
    
    def _check_toxicity(self, data: List[Dict]) -> int:
        """Zkontrolovat toxický obsah"""
        toxic_count = 0
        
        for item in data:
            text = item.get("instruction", "") + " " + item.get("output", "")
            
            for pattern in self.toxic_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    # Check if it's in technical context
                    if "hack" not in text.lower() or "security" in text.lower():
                        toxic_count += 1
                    break
        
        return toxic_count
    
    def _check_invalid_domains(self, data: List[Dict]) -> int:
        """Zkontrolovat nevalidní domény"""
        invalid_count = 0
        
        for item in data:
            domain = item.get("domain", "")
            if domain not in self.valid_domains:
                invalid_count += 1
        
        return invalid_count
    
    def _check_empty_responses(self, data: List[Dict]) -> int:
        """Zkontrolovat prázdné nebo minimální odpovědi"""
        empty_count = 0
        
        for item in data:
            output = item.get("output", "").strip()
            if len(output) < 20:  # příliš krátká odpověď
                empty_count += 1
        
        return empty_count
    
    def _check_extreme_lengths(self, data: List[Dict]) -> int:
        """Zkontrolovat extrémně dlouhé texty"""
        extreme_count = 0
        
        for item in data:
            instruction_len = len(item.get("instruction", ""))
            output_len = len(item.get("output", ""))
            
            if instruction_len > 2000 or output_len > 3000:
                extreme_count += 1
        
        return extreme_count
    
    def _check_balance(self, data: List[Dict]) -> float:
        """Zkontrolovat vyváženost dat"""
        output_lengths = [len(item.get("output", "")) for item in data]
        
        if not output_lengths:
            return 0.0
        
        avg_length = sum(output_lengths) / len(output_lengths)
        variance = sum((x - avg_length) ** 2 for x in output_lengths) / len(output_lengths)
        std_dev = variance ** 0.5
        
        # Nižší std_dev = lepší vyváženost
        balance_score = 1.0 / (1.0 + std_dev / avg_length) if avg_length > 0 else 0
        return balance_score
    
    def print_validation_report(self, results: Dict[str, Dict]):
        """Vypsat validation report"""
        print("\n" + "=" * 60)
        print("HIRAN V2.2 DATASET VALIDATION REPORT")
        print("=" * 60)
        
        total_pairs = 0
        total_issues = 0
        
        for stage, metrics in results.items():
            if metrics.get("status") == "ERROR":
                print(f"\n❌ {stage.upper()}: {metrics['message']}")
                continue
                
            print(f"\n📊 {stage.upper()}:")
            print(f"   Total pairs: {metrics['total_pairs']}")
            print(f"   Avg instruction: {metrics['avg_instruction_length']:.0f} chars")
            print(f"   Avg output: {metrics['avg_output_length']:.0f} chars")
            
            # Issues
            issues = []
            if metrics['missing_fields'] > 0:
                issues.append(f"Missing fields: {metrics['missing_fields']}")
            if metrics['duplicates'] > 0:
                issues.append(f"Duplicates: {metrics['duplicates']}")
            if metrics['hallucinations'] > 0:
                issues.append(f"Hallucinations: {metrics['hallucinations']}")
            if metrics['toxic_content'] > 0:
                issues.append(f"Toxic: {metrics['toxic_content']}")
            if metrics['invalid_domains'] > 0:
                issues.append(f"Invalid domains: {metrics['invalid_domains']}")
            if metrics['empty_responses'] > 0:
                issues.append(f"Empty responses: {metrics['empty_responses']}")
            if metrics['extreme_lengths'] > 0:
                issues.append(f"Extreme lengths: {metrics['extreme_lengths']}")
            
            if issues:
                print(f"   ⚠️  Issues: {', '.join(issues)}")
                total_issues += sum([
                    metrics['missing_fields'], metrics['duplicates'], 
                    metrics['hallucinations'], metrics['toxic_content'],
                    metrics['invalid_domains'], metrics['empty_responses'],
                    metrics['extreme_lengths']
                ])
            else:
                print(f"   ✅ No issues detected")
            
            print(f"   📈 Balance score: {metrics['balance_score']:.3f}")
            total_pairs += metrics['total_pairs']
        
        print(f"\n{'='*60}")
        print(f"SUMMARY:")
        print(f"   Total pairs: {total_pairs}")
        print(f"   Total issues: {total_issues}")
        print(f"   Target: 5000+ pairs")
        
        if total_pairs >= 5000:
            print(f"   ✅ Dataset size target met!")
        else:
            print(f"   ⚠️  Need {5000 - total_pairs} more pairs")
        
        if total_issues == 0:
            print(f"   ✅ No quality issues!")
        else:
            print(f"   ⚠️  {total_issues} quality issues to fix")
        
        print(f"{'='*60}")


def main():
    """Main funkce pro validaci"""
    print("🔍 Validating Hiran v2.2 Dataset...")
    
    validator = DatasetValidator()
    results = validator.validate_all_stages()
    
    validator.print_validation_report(results)
    
    # Check pokud jsou kritické problémy
    total_hallucinations = sum(r.get('hallucinations', 0) for r in results.values())
    
    if total_hallucinations > 0:
        print(f"\n❌ CRITICAL: Found {total_hallucinations} hallucinated references!")
        print("🔧 Fix: Run data cleanup or remove affected pairs")
        return 1
    
    print("\n✅ Validation completed!")
    return 0


if __name__ == "__main__":
    exit(main())
