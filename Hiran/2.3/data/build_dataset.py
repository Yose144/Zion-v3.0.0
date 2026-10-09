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
                
            print(f"[READ] Loading from: {source_path}")
            with open(source_path, 'r', encoding='utf-8') as f:
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
                        print(f"[WARN]  Invalid JSON at line {line_num}")
                        continue
        
        print(f"[OK] Loaded {len(clean_data)} clean pairs from v2.1")
        print(f"[REMOVED]  Removed {removed_count} invalid/hallucinated pairs")
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
            print("[WARN]  V3/docs not found, skipping V3 documentation")
            return []
        
        print(f"[DOCS] Processing V3 documentation...")
        
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
        
        print(f"[OK] Created {len(data)} pairs from V3 docs")
        return data
    
    def _process_markdown_file(self, file_path: Path, default_domain: str) -> List[Dict]:
        """Zpracovat jeden markdown soubor"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"[WARN]  Error reading {file_path}: {e}")
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
    
    def generate_ncl_curriculum(self) -> List[Dict]:
        """Generate structured Q&A pairs from NCL (Neural Compute Layer) source knowledge.

        Extracts canonical facts from V3/L1/cosmic-harmony/src/ncl_integration.rs so Hiran
        can accurately answer operator questions about the 5th revenue stream.
        """
        pairs: List[Dict] = []
        now = datetime.now().isoformat()
        domain = "cross_domain"  # AI + ZION mining hybrid

        # --- AITaskType knowledge ---
        pairs.append({
            "instruction": "What AI task types does the ZION NCL support and what are their base rewards?",
            "input": "",
            "output": (
                "The NCL supports 7 AI task types with the following base rewards:\n"
                "- Embeddings: 0.001 ZION\n"
                "- LlmInference: 0.01 ZION\n"
                "- ImageClassification: 0.002 ZION\n"
                "- ImageGeneration: 0.02 ZION\n"
                "- SpeechToText: 0.005 ZION\n"
                "- CodeAnalysis: 0.003 ZION\n"
                "- ModelTraining: 0.1 ZION\n"
                "Rewards are further adjusted by efficiency bonus (up to +20%) and success/failure."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::AITaskType",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        pairs.append({
            "instruction": "Which NCL AI task has the highest base reward and why?",
            "input": "",
            "output": (
                "ModelTraining has the highest base reward at 0.1 ZION because it consumes the most "
                "compute and time. ImageGeneration is second at 0.02 ZION, followed by LlmInference "
                "at 0.01 ZION. Embeddings is the lowest at 0.001 ZION because it is the fastest task."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::AITaskType::base_reward",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        # --- ConsciousnessLevel (mainnet disabled) ---
        pairs.append({
            "instruction": "How do consciousness levels affect NCL rewards on ZION mainnet?",
            "input": "",
            "output": (
                "Consciousness-based reward multipliers are DISABLED for mainnet L1. "
                "All levels (Physical, Emotional, Mental, Spiritual, Cosmic, OnTheStar) return 1.0x. "
                "The original differential values (1.05x, 1.1x, 1.25x, 1.5x, 2.0x) are preserved in code "
                "comments for potential future activation on L3 post-mainnet."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::ConsciousnessLevel",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        # --- NCLScheduler ---
        pairs.append({
            "instruction": "What is the default compute allocation between mining and NCL AI tasks?",
            "input": "",
            "output": (
                "The default CH v3 compute split is 75% mining / 25% NCL AI.\n"
                "Of the 75% mining allocation: 50% goes to ZION mining and 25% to multi-algo profit-switch.\n"
                "Keccak and SHA3 intermediates from ZION mining are FREE byproducts submitted to ETC/Nexus, "
                "so they do not consume additional compute. The scheduler tracks actual time spent and "
                "switches to NPU work when mining exceeds its allocation ratio."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::NCLScheduler",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        pairs.append({
            "instruction": "How does the NCL scheduler decide when to do AI work versus mining?",
            "input": "",
            "output": (
                "The NCLScheduler compares cumulative mining_time_ms vs npu_time_ms. "
                "If the actual mining ratio exceeds the configured allocation (default 75%), "
                "it returns true from should_do_npu_work(), signaling the worker to switch to AI tasks. "
                "If mining_priority is set to true (e.g., during a high-difficulty period), "
                "NPU work is blocked entirely until the flag is cleared."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::NCLScheduler::should_do_npu_work",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        # --- NCLBonusCalculator ---
        pairs.append({
            "instruction": "How is the NCL reward calculated for a completed AI task?",
            "input": "",
            "output": (
                "The reward formula is:\n"
                "  reward = base_reward(task_type) * consciousness_multiplier * success_factor * efficiency_bonus\n"
                "Where:\n"
                "- base_reward depends on task type (e.g., Embeddings=0.001, LLM=0.01, ModelTraining=0.1)\n"
                "- consciousness_multiplier is 1.0x for all levels on mainnet L1\n"
                "- success_factor is 1.0 for success, 0.1 for failure\n"
                "- efficiency_bonus = 1.0 + efficiency() * 0.2 (up to +20%)\n"
                "Efficiency itself is a 50/50 blend of success_rate and latency_score."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::NCLBonusCalculator::calculate_reward",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        pairs.append({
            "instruction": "What determines the NCL efficiency score?",
            "input": "",
            "output": (
                "Efficiency is computed as a weighted average:\n"
                "- 50% success_rate = successful_tasks / total_tasks\n"
                "- 50% latency_score = clamp(1 - (avg_latency_ms - 100) / 900, 0..1)\n"
                "  Target latency is <100ms for a perfect 1.0 score, degrading linearly to 0.0 at >1000ms.\n"
                "If no tasks have been completed yet, efficiency defaults to 0.5."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::NCLBonusCalculator::efficiency",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        # --- CH3RevenueModel (5 streams) ---
        pairs.append({
            "instruction": "What are the 5 revenue streams in the CH v3 model?",
            "input": "",
            "output": (
                "The CH v3 revenue model has 5 streams under the 50/25/25 compute split:\n"
                "1. ZION mining (50% compute) — Keccak->SHA3->Matrix->Fusion\n"
                "2. ETC/Keccak (FREE byproduct of stream 1)\n"
                "3. Nexus/SHA3 (FREE byproduct of stream 1)\n"
                "4. Multi-Algo profit-switch (25% compute) — ERG, RVN, KAS, ALPH, etc.\n"
                "5. NCL AI inference (25% compute) — Embeddings, LLM, ImageGeneration, etc.\n"
                "Streams 2 and 3 are 'free' because they reuse intermediate hashes from ZION mining."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::CH3RevenueModel",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        # --- NPURuntime ---
        pairs.append({
            "instruction": "Which NPU runtimes does the ZION NCL detect and how?",
            "input": "",
            "output": (
                "The NCL auto-detects the best NPU runtime for the current platform:\n"
                "- Apple Silicon (macOS + aarch64): CoreML\n"
                "- Other macOS: ONNX fallback\n"
                "- Linux/Windows: ONNX (with TensorRT detection planned for NVIDIA GPUs)\n"
                "Supported runtimes in code: CoreML, TensorRT, OpenVINO, ONNX."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::NPURuntime::detect",
            "domain": domain,
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        # --- CLI reference ---
        pairs.append({
            "instruction": "What are the zion ncl CLI commands an operator should know?",
            "input": "",
            "output": (
                "The zion ncl command family provides neural compute lane visibility:\n"
                "- zion ncl status — overall NCL health and compute split\n"
                "- zion ncl jobs — list submitted AI jobs\n"
                "- zion ncl job <id> — inspect a specific job\n"
                "- zion ncl workers — view active NPU workers\n"
                "- zion ncl leaderboard — top contributors by NCL earnings\n"
                "- zion ncl schedule — view or configure task scheduling\n"
                "- zion ncl price — current price per task type\n"
                "- zion ncl submit <job.json> — submit a new AI inference job\n"
                "Quick operator views: workers, leaderboard, price."
            ),
            "source": "V3/docs/CLI_REFERENCE.md::zion ncl",
            "domain": "zion_core",
            "metadata": {"created_at": now, "source_type": "ncl_cli"}
        })

        pairs.append({
            "instruction": "What is the relationship between zion agent, WARP, and NCL?",
            "input": "",
            "output": (
                "zion agent is the L3 operator gateway to Hiranyagarbha. It exposes the AI-native runtime "
                "surface while also reflecting integration state for WARP, NCL, and future OASIS-facing bridges. "
                "NCL is the Neural Compute Layer (5th revenue stream), WARP is the cross-chain relay daemon, "
                "and the agent orchestrates them from a single CLI surface."
            ),
            "source": "V3/docs/CLI_FAQ.md",
            "domain": "zion_core",
            "metadata": {"created_at": now, "source_type": "ncl_cli"}
        })

        # --- Rust API / integration ---
        pairs.append({
            "instruction": "How does a Rust miner process an NCL task and record earnings?",
            "input": "",
            "output": (
                "Use NCLIntegration::process_task(task_type, execution_time_ms, success):\n"
                "1. Calculates reward via NCLBonusCalculator (base * multiplier * success_factor * efficiency_bonus)\n"
                "2. Increments tasks_completed or tasks_failed\n"
                "3. Adds reward to total_earnings and earnings_by_type HashMap\n"
                "4. Records NPU time in the scheduler\n"
                "5. Returns the computed reward as f64\n"
                "For telemetry, call .status() to get NCLStatus with scheduler stats, bonus stats, and totals."
            ),
            "source": "V3/L1/cosmic-harmony/src/ncl_integration.rs::NCLIntegration::process_task",
            "domain": "zion_advanced",
            "metadata": {"created_at": now, "source_type": "ncl_source"}
        })

        # Validate all generated pairs
        return [p for p in pairs if self._is_valid_pair(p)]

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
            
            with open(output_file, 'w', encoding='utf-8') as f:
                for item in items:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
            print(f"[OK] Saved {len(items)} items to {output_file}")
    
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
        print("\n[CHECK] Hallucination Check:")
        all_text = " ".join(
            i.get("instruction", "") + " " + i.get("output", "") 
            for items in categorized.values() 
            for i in items
        )
        
        hallucinations_found = 0
        for pattern in self.hallucination_patterns:
            if re.search(pattern, all_text, re.IGNORECASE):
                hallucinations_found += 1
                print(f"[WARN]  Pattern found: {pattern}")
        
        if hallucinations_found == 0:
            print("[OK] No hallucination patterns detected!")
        else:
            print(f"[WARN]  {hallucinations_found} hallucination patterns found")


def _parse_args():
    import argparse
    p = argparse.ArgumentParser(description="Hiran v2.2 Dataset Builder")
    p.add_argument("--scrape-v3", action="store_true", default=True, help="Scrape V3 docs (default: True)")
    p.add_argument("--skip-v3", action="store_true", help="Skip V3 docs scraping")
    return p.parse_args()


def main():
    """Main funkce pro build dataset"""
    args = _parse_args()
    print("[BUILD] Building Hiran v2.2 Dataset...")
    print("=" * 60)

    builder = DatasetBuilder()

    # Načíst v2.1 data
    print("\n[1/4] Loading v2.1 data...")
    v2_1_data = builder.load_v2_1_data()

    # Scrape V3 docs
    v3_data = []
    if not args.skip_v3:
        print("\n[2/4] Processing V3 documentation...")
        v3_data = builder.scrape_v3_docs()
    else:
        print("\n[2/4] Skipping V3 documentation scraping (--skip-v3)")

    # Generovat NCL curriculum
    print("\n[2.5/4] Generating NCL curriculum...")
    ncl_data = builder.generate_ncl_curriculum()
    print(f"[OK] Generated {len(ncl_data)} NCL Q&A pairs")

    # Kombinovat data
    all_data = v2_1_data + v3_data + ncl_data

    print(f"\n[STATS] Total raw data: {len(all_data)} pairs")

    # Kategorizovat
    print("\n[3/4] Categorizing and saving...")
    categorized = builder.categorize_by_stage(all_data)

    # Uložit
    builder.save_curriculum_data(categorized)

    # Report
    builder.generate_dataset_report(categorized)

    print("\n[OK] Dataset build completed!")
    print("[NEXT] Next: Validate dataset with python data/validate_dataset.py")


if __name__ == "__main__":
    main()
