#!/usr/bin/env python3
"""
🧠 ZION Conversation Knowledge Extractor
Extracts structured knowledge from Claude conversation logs (SESSION_REPORT_*.md)

This is Phase 1 of building self-learning AI:
1. Parse all our conversations with Claude
2. Extract Q&A pairs, code snippets, decisions, patterns
3. Store in vector database for semantic search
4. Use this knowledge to make ZION AI Native smarter

Input: SESSION_REPORT_*.md files
Output: Vector database (ChromaDB) with searchable knowledge

Usage:
    python conversation_knowledge_extractor.py --extract
    python conversation_knowledge_extractor.py --query "How do we fix mining?"
"""

import re
import json
import hashlib
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass, asdict
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - 🧠 Knowledge - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    import chromadb
    from chromadb.config import Settings
    CHROMA_AVAILABLE = True
except ImportError:
    CHROMA_AVAILABLE = False
    logger.warning("⚠️  ChromaDB not installed. Install with: pip install chromadb")

try:
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
except ImportError:
    EMBEDDINGS_AVAILABLE = False
    logger.warning("⚠️  sentence-transformers not installed. Install with: pip install sentence-transformers")


@dataclass
class QAPair:
    """Question-Answer pair from conversation"""
    question: str
    answer: str
    source_file: str
    timestamp: Optional[str] = None
    context: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    def get_id(self) -> str:
        """Generate unique ID for this Q&A pair"""
        content = f"{self.question}{self.answer}"
        return hashlib.md5(content.encode()).hexdigest()


@dataclass
class CodeSnippet:
    """Code snippet from conversation"""
    code: str
    language: str
    source_file: str
    context: Optional[str] = None
    explanation: Optional[str] = None
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    def get_id(self) -> str:
        """Generate unique ID for this snippet"""
        return hashlib.md5(self.code.encode()).hexdigest()


@dataclass
class DesignDecision:
    """Design or architectural decision"""
    decision: str
    rationale: Optional[str]
    source_file: str
    alternatives_considered: Optional[List[str]] = None
    
    def to_dict(self) -> dict:
        return asdict(self)


class ConversationParser:
    """Parse SESSION_REPORT_*.md files and extract knowledge"""
    
    def __init__(self):
        self.qa_pairs: List[QAPair] = []
        self.code_snippets: List[CodeSnippet] = []
        self.decisions: List[DesignDecision] = []
        self.patterns: List[str] = []
        
    def parse_file(self, file_path: Path) -> Dict:
        """Parse a single SESSION_REPORT file"""
        logger.info(f"📖 Parsing {file_path.name}...")
        
        content = file_path.read_text(encoding='utf-8')
        
        # Extract different types of knowledge
        self._extract_qa_from_markdown(content, file_path.name)
        self._extract_code_snippets(content, file_path.name)
        self._extract_decisions(content, file_path.name)
        self._extract_patterns(content, file_path.name)
        
        stats = {
            "file": file_path.name,
            "qa_pairs": len(self.qa_pairs),
            "code_snippets": len(self.code_snippets),
            "decisions": len(self.decisions),
            "patterns": len(self.patterns)
        }
        
        logger.info(f"✅ Extracted: {stats['qa_pairs']} Q&A, {stats['code_snippets']} code, {stats['decisions']} decisions")
        
        return stats
    
    def _extract_qa_from_markdown(self, content: str, source: str):
        """Extract Q&A pairs from markdown headers and content"""
        
        # Pattern 1: Look for conversation-like structure
        # "User: ..." followed by "Assistant: ..." or similar
        user_keywords = ['user', 'you', 'request', 'asked', 'question']
        ai_keywords = ['assistant', 'claude', 'ai', 'response', 'answer']
        
        lines = content.split('\n')
        current_q = None
        current_a = []
        
        for i, line in enumerate(lines):
            line_lower = line.lower()
            
            # Check if this looks like a question
            if any(kw in line_lower for kw in user_keywords) or line.endswith('?'):
                if current_q and current_a:
                    # Store previous Q&A
                    self.qa_pairs.append(QAPair(
                        question=current_q,
                        answer='\n'.join(current_a).strip(),
                        source_file=source
                    ))
                current_q = line.strip()
                current_a = []
            
            # Check if this looks like an answer
            elif current_q and (any(kw in line_lower for kw in ai_keywords) or i > 0):
                current_a.append(line)
        
        # Don't forget last Q&A
        if current_q and current_a:
            self.qa_pairs.append(QAPair(
                question=current_q,
                answer='\n'.join(current_a).strip(),
                source_file=source
            ))
        
        # Pattern 2: Extract from headers (## Task: ... ### Solution: ...)
        task_pattern = r'##+ Task:?\s*(.+?)(?=##|\Z)'
        solution_pattern = r'##+ Solution:?\s*(.+?)(?=##|\Z)'
        
        tasks = re.findall(task_pattern, content, re.DOTALL | re.IGNORECASE)
        solutions = re.findall(solution_pattern, content, re.DOTALL | re.IGNORECASE)
        
        for task, solution in zip(tasks, solutions):
            self.qa_pairs.append(QAPair(
                question=f"Task: {task.strip()}",
                answer=f"Solution: {solution.strip()}",
                source_file=source
            ))
    
    def _extract_code_snippets(self, content: str, source: str):
        """Extract code blocks with language tags"""
        
        # Pattern: ```language\ncode\n```
        pattern = r'```(\w+)\n(.+?)\n```'
        matches = re.findall(pattern, content, re.DOTALL)
        
        for lang, code in matches:
            # Get context (text before code block)
            context_pattern = rf'(.{{0,200}})```{lang}'
            context_match = re.search(context_pattern, content, re.DOTALL)
            context = context_match.group(1).strip() if context_match else None
            
            self.code_snippets.append(CodeSnippet(
                code=code.strip(),
                language=lang,
                source_file=source,
                context=context
            ))
    
    def _extract_decisions(self, content: str, source: str):
        """Extract design decisions and architectural choices"""
        
        # Keywords indicating decisions
        decision_keywords = [
            r'decided to',
            r'chose to',
            r'selected',
            r'went with',
            r'approach:',
            r'strategy:',
            r'solution:',
            r'fixed by',
            r'implemented'
        ]
        
        pattern = '|'.join(decision_keywords)
        
        for line in content.split('\n'):
            if re.search(pattern, line, re.IGNORECASE):
                # Clean up markdown formatting
                clean_line = re.sub(r'[#*`]', '', line).strip()
                if len(clean_line) > 20:  # Skip very short lines
                    self.decisions.append(DesignDecision(
                        decision=clean_line,
                        rationale=None,  # Could extract from following lines
                        source_file=source
                    ))
    
    def _extract_patterns(self, content: str, source: str):
        """Extract coding patterns and best practices"""
        
        # Keywords indicating patterns/best practices
        pattern_keywords = [
            r'always',
            r'never',
            r'should',
            r'must',
            r'best practice',
            r'pattern:',
            r'use.*for',
            r'avoid',
            r'prefer'
        ]
        
        pattern = '|'.join(pattern_keywords)
        
        for line in content.split('\n'):
            if re.search(pattern, line, re.IGNORECASE):
                clean_line = re.sub(r'[#*`]', '', line).strip()
                if len(clean_line) > 20:
                    self.patterns.append(clean_line)


class ZionKnowledgeBase:
    """Vector database for ZION knowledge"""
    
    def __init__(self, db_path: str = "./zion_knowledge_db"):
        if not CHROMA_AVAILABLE:
            raise ImportError("ChromaDB not available. Install with: pip install chromadb")
        
        if not EMBEDDINGS_AVAILABLE:
            raise ImportError("sentence-transformers not available. Install with: pip install sentence-transformers")
        
        self.db_path = Path(db_path)
        self.db_path.mkdir(exist_ok=True)
        
        # Initialize ChromaDB
        self.client = chromadb.PersistentClient(
            path=str(self.db_path),
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Create collections
        self.qa_collection = self._get_or_create_collection("qa_pairs")
        self.code_collection = self._get_or_create_collection("code_snippets")
        self.decision_collection = self._get_or_create_collection("decisions")
        
        # Initialize embedding model
        logger.info("🔧 Loading embedding model...")
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("✅ Embedding model ready")
    
    def _get_or_create_collection(self, name: str):
        """Get existing collection or create new one"""
        try:
            return self.client.get_collection(name)
        except:
            return self.client.create_collection(
                name=name,
                metadata={"description": f"ZION {name}"}
            )
    
    def add_qa_pairs(self, qa_pairs: List[QAPair]):
        """Add Q&A pairs to vector database"""
        if not qa_pairs:
            return
        
        logger.info(f"💾 Storing {len(qa_pairs)} Q&A pairs...")
        
        documents = []
        metadatas = []
        ids = []
        
        for qa in qa_pairs:
            # Combine Q&A for better semantic search
            doc = f"Question: {qa.question}\n\nAnswer: {qa.answer}"
            documents.append(doc)
            
            metadatas.append({
                "type": "qa",
                "source": qa.source_file,
                "timestamp": qa.timestamp or "unknown"
            })
            
            ids.append(f"qa_{qa.get_id()}")
        
        # ChromaDB will auto-generate embeddings if we don't provide them
        self.qa_collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
        logger.info(f"✅ Stored {len(qa_pairs)} Q&A pairs")
    
    def add_code_snippets(self, snippets: List[CodeSnippet]):
        """Add code snippets to vector database"""
        if not snippets:
            return
        
        logger.info(f"💾 Storing {len(snippets)} code snippets...")
        
        documents = []
        metadatas = []
        ids = []
        
        for snippet in snippets:
            # Include context if available
            doc = snippet.code
            if snippet.context:
                doc = f"{snippet.context}\n\n```{snippet.language}\n{snippet.code}\n```"
            
            documents.append(doc)
            
            metadatas.append({
                "type": "code",
                "language": snippet.language,
                "source": snippet.source_file
            })
            
            ids.append(f"code_{snippet.get_id()}")
        
        self.code_collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
        logger.info(f"✅ Stored {len(snippets)} code snippets")
    
    def add_decisions(self, decisions: List[DesignDecision]):
        """Add design decisions to vector database"""
        if not decisions:
            return
        
        logger.info(f"💾 Storing {len(decisions)} design decisions...")
        
        documents = []
        metadatas = []
        ids = []
        
        for i, decision in enumerate(decisions):
            documents.append(decision.decision)
            
            metadatas.append({
                "type": "decision",
                "source": decision.source_file
            })
            
            ids.append(f"decision_{i}_{decision.source_file}")
        
        self.decision_collection.add(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
        logger.info(f"✅ Stored {len(decisions)} decisions")
    
    def query(self, query_text: str, n_results: int = 5, search_type: str = "all") -> Dict:
        """Query knowledge base with natural language"""
        results = {}
        
        if search_type in ["all", "qa"]:
            logger.info(f"🔍 Searching Q&A pairs for: '{query_text}'")
            qa_results = self.qa_collection.query(
                query_texts=[query_text],
                n_results=n_results
            )
            results["qa"] = qa_results
        
        if search_type in ["all", "code"]:
            logger.info(f"🔍 Searching code snippets for: '{query_text}'")
            code_results = self.code_collection.query(
                query_texts=[query_text],
                n_results=n_results
            )
            results["code"] = code_results
        
        if search_type in ["all", "decisions"]:
            logger.info(f"🔍 Searching decisions for: '{query_text}'")
            decision_results = self.decision_collection.query(
                query_texts=[query_text],
                n_results=n_results
            )
            results["decisions"] = decision_results
        
        return results
    
    def get_stats(self) -> Dict:
        """Get statistics about knowledge base"""
        return {
            "qa_pairs": self.qa_collection.count(),
            "code_snippets": self.code_collection.count(),
            "decisions": self.decision_collection.count(),
            "total": self.qa_collection.count() + self.code_collection.count() + self.decision_collection.count()
        }


def extract_all_knowledge(reports_dir: Path, kb: ZionKnowledgeBase):
    """Extract knowledge from all SESSION_REPORT files"""
    
    parser = ConversationParser()
    
    # Find all session report files
    report_files = list(reports_dir.glob("SESSION_REPORT_*.md"))
    report_files.extend(reports_dir.glob("FINAL_REPORT_*.md"))
    report_files.extend(reports_dir.glob("*_REPORT*.md"))
    
    if not report_files:
        logger.warning(f"⚠️  No report files found in {reports_dir}")
        return
    
    logger.info(f"📚 Found {len(report_files)} report files")
    
    total_stats = {
        "files": 0,
        "qa_pairs": 0,
        "code_snippets": 0,
        "decisions": 0
    }
    
    for report_file in report_files:
        try:
            stats = parser.parse_file(report_file)
            total_stats["files"] += 1
            total_stats["qa_pairs"] += stats["qa_pairs"]
            total_stats["code_snippets"] += stats["code_snippets"]
            total_stats["decisions"] += stats["decisions"]
        except Exception as e:
            logger.error(f"❌ Error parsing {report_file.name}: {e}")
    
    # Store in knowledge base
    kb.add_qa_pairs(parser.qa_pairs)
    kb.add_code_snippets(parser.code_snippets)
    kb.add_decisions(parser.decisions)
    
    logger.info("\n" + "="*60)
    logger.info("📊 EXTRACTION COMPLETE")
    logger.info("="*60)
    logger.info(f"Files processed: {total_stats['files']}")
    logger.info(f"Q&A pairs: {total_stats['qa_pairs']}")
    logger.info(f"Code snippets: {total_stats['code_snippets']}")
    logger.info(f"Decisions: {total_stats['decisions']}")
    logger.info("="*60 + "\n")


def interactive_query(kb: ZionKnowledgeBase):
    """Interactive query mode"""
    
    print("\n" + "="*60)
    print("🔍 ZION KNOWLEDGE BASE - QUERY MODE")
    print("="*60)
    print("\nCommands:")
    print("  search <query>     - Search knowledge base")
    print("  stats              - Show statistics")
    print("  quit               - Exit")
    print("\n" + "="*60 + "\n")
    
    while True:
        try:
            user_input = input("🌟 Query: ").strip()
            
            if user_input.lower() in ["quit", "exit", "q"]:
                print("\n🙏 Jah bless!")
                break
            
            if user_input.lower() == "stats":
                stats = kb.get_stats()
                print(f"\n📊 Knowledge Base Stats:")
                print(f"  Q&A pairs: {stats['qa_pairs']}")
                print(f"  Code snippets: {stats['code_snippets']}")
                print(f"  Decisions: {stats['decisions']}")
                print(f"  Total: {stats['total']}\n")
                continue
            
            if user_input.lower().startswith("search "):
                query = user_input[7:].strip()
                results = kb.query(query, n_results=3)
                
                print(f"\n🎯 Results for: '{query}'")
                print("-"*60)
                
                if "qa" in results and results["qa"]["documents"]:
                    print("\n📖 Q&A Pairs:")
                    for i, (doc, meta) in enumerate(zip(results["qa"]["documents"][0], results["qa"]["metadatas"][0])):
                        print(f"\n{i+1}. Source: {meta['source']}")
                        print(f"   {doc[:300]}...")
                
                if "code" in results and results["code"]["documents"]:
                    print("\n💻 Code Snippets:")
                    for i, (doc, meta) in enumerate(zip(results["code"]["documents"][0], results["code"]["metadatas"][0])):
                        print(f"\n{i+1}. Language: {meta['language']}, Source: {meta['source']}")
                        print(f"   {doc[:200]}...")
                
                print("\n" + "-"*60 + "\n")
            else:
                print("💡 Use: search <your query> or stats")
        
        except KeyboardInterrupt:
            print("\n\n🙏 Jah bless!")
            break
        except Exception as e:
            logger.error(f"Error: {e}")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Extract knowledge from ZION conversation logs")
    parser.add_argument("--extract", action="store_true", help="Extract knowledge from SESSION_REPORT files")
    parser.add_argument("--query", type=str, help="Query the knowledge base")
    parser.add_argument("--interactive", action="store_true", help="Interactive query mode")
    parser.add_argument("--reports-dir", type=str, default=".", help="Directory containing SESSION_REPORT files")
    parser.add_argument("--db-path", type=str, default="./zion_knowledge_db", help="Path to knowledge database")
    
    args = parser.parse_args()
    
    # Initialize knowledge base
    try:
        kb = ZionKnowledgeBase(db_path=args.db_path)
    except ImportError as e:
        logger.error(str(e))
        logger.info("\n📦 Install dependencies:")
        logger.info("   pip install chromadb sentence-transformers")
        exit(1)
    
    # Extract knowledge
    if args.extract:
        reports_dir = Path(args.reports_dir)
        extract_all_knowledge(reports_dir, kb)
    
    # Query
    if args.query:
        results = kb.query(args.query, n_results=5)
        print(json.dumps(results, indent=2))
    
    # Interactive mode
    if args.interactive or (not args.extract and not args.query):
        interactive_query(kb)
