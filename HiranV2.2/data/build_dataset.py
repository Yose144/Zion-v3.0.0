#!/usr/bin/env python3
"""
Hiran v2.2 Dataset Builder
Build high-quality dataset without hallucinations for v2.2
"""

import json
import re
import os
from pathlib import Path
from typing import List, Dict, Optional, Set
from datetime import datetime


class DatasetBuilder:
    """Dataset builder pro v2.2 s důrazem na kvalitu"""
    
    def __init__(self, output_dir: str = "HiranV2.2/data/curriculum"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Doménové mapování pro curriculum
        self.domain_mapping = {
            "general": "foundation",
            "zion_basics": "zion_core", 
            "zion_cli": "zion_core",
            "zion_architecture": "zion_core",
            "zion_deployment": "zion_advanced",
            "zion_monitoring": "zion_advanced",
            "rust_programming": "zion_advanced",
            "cross_domain": "cross_domain",
            "rag_context": "rag_synthesis"
        }
        
        # Blacklist pro halucinované patterny
        self.hallucination_patterns = [
            r'https?://(zion\.io|zion\.com|github\.com/zion-core)',
            r'github\.com/zion-core/cli',
            r'zion\.io/docs/cli',
            r'www\.zion\.io',
            r'zion\.io',
            r'docs\.zion\.io'
        ]
        
    def load_v2_1_data(self) -> List[Dict]:
        """Načíst a vyčistit existující v2.1 training data"""
        v2_1_path = Path("HiranV2.1/data")
        clean_data = []
        removed_count = 0
        
        # Načíst z různých zdrojů
        data_sources = [
            v2_1_path / "hiran_curriculum_v2.1.jsonl",
            v2_1_path / "shards" / "zion_train_hiran_v2.jsonl",
            v2_1_path / "shards" / "zion_train.jsonl"
        ]
        
        for source_path in data_sources:
            if not source_path.exists():
                continue
                
            print(f"📖 Loading from: {source_path}")
            with open(source_path, 'r') as f:
                for line_num, line in enumerate(f, 1):
                    try:
                        item = json.loads(line)
                        
                        # Převést messages formát na instruction/output
                        converted_item = self._convert_messages_format(item)
                        if converted_item:
                            # Validace a čištění
                            if self._is_valid_pair(converted_item):
                                # Kategorizovat podle domény
                                categorized_item = self._categorize_item(converted_item, source_path.name)
                                if categorized_item:
                                    clean_data.append(categorized_item)
                            else:
                                removed_count += 1
                            
                    except json.JSONDecodeError:
                        print(f"⚠️  Invalid JSON at line {line_num}")
                        continue
        
        print(f"✅ Loaded {len(clean_data)} clean pairs from v2.1")
        print(f"🗑️  Removed {removed_count} invalid/hallucinated pairs")
        return clean_data
    
    def _convert_messages_format(self, item: Dict) -> Optional[Dict]:
        """Převést messages formát na instruction/output"""
        if "messages" in item:
            messages = item["messages"]
            
            # Najít system, user a assistant messages
            system_msg = next((m for m in messages if m.get("role") == "system"), None)
            user_msg = next((m for m in messages if m.get("role") == "user"), None)
            assistant_msg = next((m for m in messages if m.get("role") == "assistant"), None)
            
            if not user_msg or not assistant_msg:
                return None
            
            # Sestavit instruction z system + user
            instruction_parts = []
            if system_msg:
                instruction_parts.append(system_msg.get("content", ""))
            instruction_parts.append(user_msg.get("content", ""))
            
            instruction = "\n".join(instruction_parts)
            output = assistant_msg.get("content", "")
            
            # Zachovat metadata pokud existují
            metadata = item.get("metadata", {})
            
            return {
                "instruction": instruction,
                "input": "",
                "output": output,
                "source": "v2.1_curriculum",
                "domain": "zion_core",  # default, přepíše se později
                "metadata": {
                    **metadata,
                    "original_format": "messages",
                    "converted_at": datetime.now().isoformat()
                }
            }
        
        # Pokud už je ve správném formátu, vrátit jako je
        elif "instruction" in item and "output" in item:
            return item
        
        return None
    
    def scrape_v3_docs(self) -> List[Dict]:
        """Scrape V3 dokumentaci a vytvořit kvalitní Q&A pairs"""
        v3_docs = Path("V3/docs")
        data = []
        
        if not v3_docs.exists():
            print("⚠️  V3/docs not found, skipping V3 documentation")
            return []
        
        print(f"📚 Processing V3 documentation...")
        
        # Prioritizované soubory
        priority_files = [
            "CLI_GUIDE.md",
            "README.md", 
            "ROADMAP.md",
            "DEPLOYMENT.md"
        ]
        
        # Nejprve priority soubory
        for filename in priority_files:
            file_path = v3_docs / filename
            if file_path.exists():
                data.extend(self._process_markdown_file(file_path, "zion_core"))
        
        # Přidat CLI specifické soubory
        cli_files = list(v3_docs.glob("CLI_*.md"))
        for cli_file in cli_files:
            data.extend(self._process_markdown_file(cli_file, "zion_core"))
        
        # Přidat všechny ostatní markdown soubory
        for md_file in v3_docs.glob("*.md"):
            if md_file.name not in priority_files and md_file not in cli_files:
                # Rozdělit do kategorií podle názvu
                if "monitoring" in md_file.name.lower() or "deploy" in md_file.name.lower():
                    data.extend(self._process_markdown_file(md_file, "zion_advanced"))
                elif "ai" in md_file.name.lower() or "rag" in md_file.name.lower():
                    data.extend(self._process_markdown_file(md_file, "cross_domain"))
                else:
                    data.extend(self._process_markdown_file(md_file, "zion_core"))
        
        print(f"✅ Created {len(data)} pairs from V3 docs")
        return data
    
    def _process_markdown_file(self, file_path: Path, default_domain: str) -> List[Dict]:
        """Zpracovat jeden markdown soubor"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"⚠️  Error reading {file_path}: {e}")
            return []
        
        # Rozdělit na sekce
        sections = self._parse_markdown_sections(content)
        data = []
        
        for section in sections:
            if len(section) > 100:  # Minimální délka sekce
                qa_pair = self._create_qa_pair(section, str(file_path), default_domain)
                if qa_pair and self._is_valid_pair(qa_pair):
                    data.append(qa_pair)
        
        return data
    
    def _parse_markdown_sections(self, content: str) -> List[str]:
        """Rozdělit markdown na sekce podle headerů"""
        lines = content.split('\n')
        sections = []
        current_section = []
        
        for line in lines:
            if line.startswith('#'):
                if current_section:
                    section_text = '\n'.join(current_section).strip()
                    if section_text:
                        sections.append(section_text)
                current_section = [line]
            else:
                current_section.append(line)
        
        if current_section:
            section_text = '\n'.join(current_section).strip()
            if section_text:
                sections.append(section_text)
        
        return sections
    
    def _create_qa_pair(self, section: str, source: str, domain: str) -> Optional[Dict]:
        """Vytvořit Q&A pair ze sekce - bez halucinací"""
        # Odstraňit markdown formátování pro čistší text
        clean_section = re.sub(r'[#*`\[\]]', '', section)
        clean_section = ' '.join(clean_section.split())  # normalizovat whitespace
        
        # Prvních 400 znaků jako kontext
        context = clean_section[:400]
        
        # Vytvořit relevantní instruction na základě domény
        if domain == "zion_core":
            instruction = f"Explain this ZION concept: {context[:100]}..."
        elif domain == "zion_advanced":
            instruction = f"How does this advanced ZION feature work: {context[:100]}..."
        elif domain == "cross_domain":
            instruction = f"What is the relationship between this AI concept and ZION: {context[:100]}..."
        else:
            instruction = f"Summarize the following: {context[:100]}..."
        
        return {
            "instruction": instruction,
            "input": "",
            "output": clean_section[:1000],  # Zvýšeno z 800
            "source": source,
            "domain": domain,
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "source_type": "v3_docs"
            }
        }
    
    def _is_valid_pair(self, item: Dict) -> bool:
        """Validovat Q&A pair - odstranit halucinace"""
        # Základní validace
        if not item.get("instruction") or not item.get("output"):
            return False
        
        instruction = item.get("instruction", "")
        output = item.get("output", "")
        
        # Uvolněná kritéria pro vývoj
        self.min_instruction_length = 5
        self.min_output_length = 5
        self.max_output_length = 5000  # zvýšeno z 2000
        
        # Kontrola halucinovaných odkazů
        combined_text = instruction + " " + output
        for pattern in self.hallucination_patterns:
            if re.search(pattern, combined_text, re.IGNORECASE):
                return False
        
        # Kontrola délky s uvolněnými kritérii
        if len(instruction) < self.min_instruction_length or len(output) < self.min_output_length:
            return False
        
        # Kontrola extrémně dlouhých textů
        if len(output) > self.max_output_length:
            return False
        
        return True
    
    def _categorize_item(self, item: Dict, source_file: str) -> Optional[Dict]:
        """Kategorizovat item podle domény"""
        text = item.get("instruction", "") + " " + item.get("output", "")
        
        # Heuristika pro kategorizaci
        if "rust" in text.lower() or "cargo" in text.lower() or "crate" in text.lower():
            domain = "zion_advanced"
        elif "cli" in text.lower() or "zion " in text.lower() or "command" in text.lower():
            domain = "zion_core"
        elif "deploy" in text.lower() or "monitoring" in text.lower() or "docker" in text.lower():
            domain = "zion_advanced"
        elif "ai" in text.lower() or "rag" in text.lower() or "inference" in text.lower():
            domain = "cross_domain"
        else:
            domain = "foundation"
        
        # Mapovat na curriculum stage
        curriculum_domain = self.domain_mapping.get(domain, "foundation")
        
        # Přidat metadata
        item["domain"] = curriculum_domain
        item["metadata"] = item.get("metadata", {})
        item["metadata"]["source_file"] = source_file
        item["metadata"]["original_domain"] = domain
        
        return item
    
    def categorize_by_stage(self, data: List[Dict]) -> Dict[str, List[Dict]]:
        """Kategorizovat data podle curriculum fází"""
        categorized = {
            "foundation": [],
            "zion_core": [],
            "zion_advanced": [],
            "cross_domain": [],
            "rag_synthesis": []
        }
        
        for item in data:
            domain = item.get("domain", "foundation")
            if domain in categorized:
                categorized[domain].append(item)
            else:
                categorized["foundation"].append(item)
        
        return categorized
    
    def save_curriculum_data(self, categorized: Dict[str, List[Dict]]):
        """Uložit data do curriculum souborů"""
        for stage, items in categorized.items():
            output_file = self.output_dir / f"{stage}.jsonl"
            
            with open(output_file, 'w') as f:
                for item in items:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
            print(f"✅ Saved {len(items)} items to {output_file}")
    
    def generate_dataset_report(self, categorized: Dict[str, List[Dict]]):
        """Generovat report o datasetu"""
        print("\n" + "=" * 60)
        print("DATASET BUILD REPORT")
        print("=" * 60)
        
        total = 0
        for stage, items in categorized.items():
            count = len(items)
            total += count
            print(f"\n{stage.upper()}: {count} pairs")
            
            if items:
                # Statistiky
                avg_instr_len = sum(len(i.get("instruction", "")) for i in items) / count
                avg_output_len = sum(len(i.get("output", "")) for i in items) / count
                
                print(f"  Avg instruction length: {avg_instr_len:.0f} chars")
                print(f"  Avg output length: {avg_output_len:.0f} chars")
        
        print(f"\n{'='*60}")
        print(f"TOTAL: {total} pairs")
        print(f"Target: 5000+ pairs")
        print(f"Gap: {5000 - total if total < 5000 else 0} pairs needed")
        print(f"{'='*60}")
        
        # Check zda je halucinace-free
        print("\n🔍 Hallucination Check:")
        all_text = " ".join(
            i.get("instruction", "") + " " + i.get("output", "") 
            for items in categorized.values() 
            for i in items
        )
        
        hallucinations_found = 0
        for pattern in self.hallucination_patterns:
            if re.search(pattern, all_text, re.IGNORECASE):
                hallucinations_found += 1
                print(f"⚠️  Pattern found: {pattern}")
        
        if hallucinations_found == 0:
            print("✅ No hallucination patterns detected!")
        else:
            print(f"⚠️  {hallucinations_found} hallucination patterns found")


def main():
    """Main funkce pro build dataset"""
    print("🚀 Building Hiran v2.2 Dataset...")
    print("=" * 60)
    
    builder = DatasetBuilder()
    
    # Načíst v2.1 data
    print("\n[1/3] Loading v2.1 data...")
    v2_1_data = builder.load_v2_1_data()
    
    # Scrape V3 docs
    print("\n[2/3] Processing V3 documentation...")
    v3_data = builder.scrape_v3_docs()
    
    # Kombinovat data
    all_data = v2_1_data + v3_data
    
    print(f"\n📊 Total raw data: {len(all_data)} pairs")
    
    # Kategorizovat
    print("\n[3/3] Categorizing and saving...")
    categorized = builder.categorize_by_stage(all_data)
    
    # Uložit
    builder.save_curriculum_data(categorized)
    
    # Report
    builder.generate_dataset_report(categorized)
    
    print("\n✅ Dataset build completed!")
    print("📝 Next: Validate dataset with python data/validate_dataset.py")


if __name__ == "__main__":
    main()
