#!/usr/bin/env python3
"""
V3 Documentation Scraper for Hiran v2.2 Dataset
Scrapes V3 documentation and creates Q&A pairs for training
"""

import json
import os
import re
from pathlib import Path
from typing import List, Dict, Optional
import hashlib

class V3DocsScraper:
    def __init__(self, v3_path: str = "V3", output_dir: str = "HiranV2.2/data/curriculum"):
        self.v3_path = Path(v3_path)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Domain mapping pro kategorizaci
        self.domain_mapping = {
            "CLI": "zion_core",
            "cli": "zion_core",
            "docker": "zion_core",
            "deploy": "zion_advanced",
            "mining": "zion_core",
            "pool": "zion_core",
            "node": "zion_core",
            "bridge": "zion_advanced",
            "dao": "zion_advanced",
            "ai": "cross_domain",
            "agent": "cross_domain",
            "hiran": "cross_domain",
            "warp": "zion_advanced",
            "ncl": "zion_advanced"
        }
        
    def scrape_all_v3_docs(self) -> List[Dict]:
        """Scrape všechny V3 dokumenty"""
        all_data = []
        
        # 1. Scrape V3/docs/
        if self.v3_path.exists():
            docs_path = self.v3_path / "docs"
            if docs_path.exists():
                print(f"Scraping V3/docs from {docs_path}...")
                all_data.extend(self._scrape_directory(docs_path, "zion_core"))
            
            # 2. Scrape V3 README.md
            readme_path = self.v3_path / "README.md"
            if readme_path.exists():
                print(f"Scraping V3/README.md...")
                all_data.extend(self._scrape_markdown_file(readme_path, "zion_core"))
            
            # 3. Scrape V3 ROADMAP.md
            roadmap_path = self.v3_path / "ROADMAP.md"
            if roadmap_path.exists():
                print(f"Scraping V3/ROADMAP.md...")
                all_data.extend(self._scrape_markdown_file(roadmap_path, "zion_advanced"))
            
            # 4. Scrape V3 docker dokumentace
            docker_readme = self.v3_path / "docker" / "DOCKER.md"
            if docker_readme.exists():
                print(f"Scraping V3/docker/DOCKER.md...")
                all_data.extend(self._scrape_markdown_file(docker_readme, "zion_core"))
        
        print(f"Total scraped documents: {len(all_data)}")
        return all_data
    
    def _scrape_directory(self, directory: Path, default_domain: str) -> List[Dict]:
        """Scrape všechny markdown soubory v adresáři"""
        data = []
        
        for md_file in directory.glob("*.md"):
            domain = self._infer_domain_from_filename(md_file.name, default_domain)
            file_data = self._scrape_markdown_file(md_file, domain)
            data.extend(file_data)
        
        return data
    
    def _scrape_markdown_file(self, file_path: Path, domain: str) -> List[Dict]:
        """Scrape jeden markdown soubor"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return []
        
        # Rozdělit na sekce
        sections = self._parse_markdown_sections(content)
        
        # Vytvořit Q&A pairs
        qa_pairs = []
        for i, section in enumerate(sections):
            if len(section.strip()) > 100:  # Minimální délka sekce
                qa_pair = self._create_qa_pair(section, str(file_path), domain, i)
                if qa_pair:
                    qa_pairs.append(qa_pair)
        
        return qa_pairs
    
    def _parse_markdown_sections(self, content: str) -> List[str]:
        """Rozdělit markdown na sekce podle headers"""
        lines = content.split('\n')
        sections = []
        current_section = []
        current_header = ""
        
        for line in lines:
            if line.startswith('#'):
                # Uložit předchozí sekci
                if current_section:
                    section_text = '\n'.join(current_section).strip()
                    if section_text:
                        sections.append(section_text)
                
                # Začít novou sekci
                current_header = line
                current_section = [line]
            else:
                current_section.append(line)
        
        # Uložit poslední sekci
        if current_section:
            section_text = '\n'.join(current_section).strip()
            if section_text:
                sections.append(section_text)
        
        return sections
    
    def _infer_domain_from_filename(self, filename: str, default_domain: str) -> str:
        """Inferovat domain z názvu souboru"""
        for keyword, domain in self.domain_mapping.items():
            if keyword.lower() in filename.lower():
                return domain
        return default_domain
    
    def _create_qa_pair(self, section: str, source: str, domain: str, index: int) -> Optional[Dict]:
        """Vytvořit Q&A pair ze sekce"""
        # Odstranit markdown syntax
        clean_text = self._clean_markdown(section)
        
        if len(clean_text) < 50:
            return None
        
        # Vytvořit instruction
        instruction = self._generate_instruction(clean_text, source)
        
        # Vytvořit unique ID
        content_hash = hashlib.md5(clean_text.encode()).hexdigest()[:8]
        unique_id = f"v3_{source.replace('/', '_')}_{index}_{content_hash}"
        
        return {
            "id": unique_id,
            "instruction": instruction,
            "input": "",
            "output": clean_text,
            "source": source,
            "domain": domain,
            "metadata": {
                "section_index": index,
                "length": len(clean_text),
                "created_at": "2026-05-12"
            }
        }
    
    def _clean_markdown(self, text: str) -> str:
        """Vyčistit markdown syntax"""
        # Odstranit code blocks
        text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
        
        # Odstranit inline code
        text = re.sub(r'`([^`]+)`', r'\1', text)
        
        # Odstranit bold/italic
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)
        text = re.sub(r'\*([^*]+)\*', r'\1', text)
        
        # Odstranit links
        text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
        
        # Vyčistit nadbytečné whitespace
        text = re.sub(r'\n+', '\n', text)
        text = text.strip()
        
        return text
    
    def _generate_instruction(self, text: str, source: str) -> str:
        """Generovat instruction pro daný text"""
        # Jednoduchá heuristika - v reálném nasazení by byl LLM generátor
        source_name = Path(source).stem
        
        instructions = [
            f"Explain the following from {source_name}:",
            f"Describe what this section from {source_name} covers:",
            f"Summarize the key points from this {source_name} documentation:",
            f"What does this section from {source_name} explain?"
        ]
        
        # Vybrat instruction na základě délky textu
        if len(text) < 200:
            return instructions[0]
        elif len(text) < 500:
            return instructions[1]
        else:
            return instructions[2]
    
    def save_to_curriculum_files(self, data: List[Dict]):
        """Uložit data do curriculum souborů podle domain"""
        # Group by domain
        domain_data = {}
        for item in data:
            domain = item.get("domain", "zion_core")
            if domain not in domain_data:
                domain_data[domain] = []
            domain_data[domain].append(item)
        
        # Map domain na curriculum stage
        domain_to_stage = {
            "zion_core": "zion_core",
            "zion_advanced": "zion_advanced",
            "cross_domain": "cross_domain"
        }
        
        # Uložit do příslušných souborů
        for domain, items in domain_data.items():
            stage = domain_to_stage.get(domain, "zion_core")
            output_file = self.output_dir / f"{stage}.jsonl"
            
            # Append mode pokud soubor existuje
            mode = 'a' if output_file.exists() else 'w'
            
            with open(output_file, mode, encoding='utf-8') as f:
                for item in items:
                    f.write(json.dumps(item, ensure_ascii=False) + '\n')
            
            print(f"Saved {len(items)} items to {output_file}")
    
    def generate_statistics(self, data: List[Dict]) -> Dict:
        """Generovat statistiky o scraped data"""
        domain_counts = {}
        total_length = 0
        
        for item in data:
            domain = item.get("domain", "unknown")
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
            total_length += len(item.get("output", ""))
        
        return {
            "total_documents": len(data),
            "domain_distribution": domain_counts,
            "average_section_length": total_length / len(data) if data else 0,
            "sources": list(set(item.get("source", "") for item in data))
        }

def main():
    print("="*60)
    print("V3 Documentation Scraper for Hiran v2.2")
    print("="*60)
    
    scraper = V3DocsScraper()
    
    # Scrape dokumenty
    print("\nScraping V3 documentation...")
    scraped_data = scraper.scrape_all_v3_docs()
    
    if not scraped_data:
        print("⚠ No data scraped. Check V3 directory structure.")
        return
    
    # Uložit do curriculum souborů
    print("\nSaving to curriculum files...")
    scraper.save_to_curriculum_files(scraped_data)
    
    # Generovat statistiky
    print("\nGenerating statistics...")
    stats = scraper.generate_statistics(scraped_data)
    
    print("\n" + "="*60)
    print("Scraping Statistics")
    print("="*60)
    print(f"Total documents: {stats['total_documents']}")
    print(f"Average section length: {stats['average_section_length']:.0f} characters")
    print("\nDomain distribution:")
    for domain, count in sorted(stats['domain_distribution'].items()):
        percentage = (count / stats['total_documents'] * 100) if stats['total_documents'] > 0 else 0
        print(f"  {domain}: {count} ({percentage:.1f}%)")
    print(f"\nUnique sources: {len(stats['sources'])}")
    print("="*60)
    
    # Uložit statistiky
    stats_file = scraper.output_dir / "scraping_stats.json"
    with open(stats_file, 'w') as f:
        json.dump(stats, f, indent=2)
    
    print(f"\n✓ Statistics saved to {stats_file}")
    print("✓ Scraping complete!")

if __name__ == "__main__":
    main()