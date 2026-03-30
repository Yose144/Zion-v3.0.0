"""
ZION Consciousness Mining Integration 2.0

Enhanced meditation rewards system with dharmic principles:
- Consciousness Level tracking (CL 1-9)
- Meditation session rewards (ZION tokens)
- Dharma scoring (compassion, wisdom, generosity)
- Sacred library integration (sutras, koans, teachings)
- Enlightenment milestones
- Collective consciousness pool

Based on Buddhist and Vedic traditions.

Author: ZION Development Team
Version: 2.0.0 (Consciousness Update)
"""

import asyncio
import hashlib
import json
import sqlite3
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any


class ConsciousnessLevel(Enum):
    """Consciousness levels (1-9)"""
    AWAKENING = 1       # Just beginning the path
    AWARENESS = 2       # Developing mindfulness
    INSIGHT = 3         # First glimpses of truth
    WISDOM = 4          # Understanding deepens
    COMPASSION = 5      # Heart opens to all beings
    EQUANIMITY = 6      # Balance in all conditions
    LIBERATION = 7      # Freedom from suffering
    ENLIGHTENMENT = 8   # Full awakening
    NIRVANA = 9         # Ultimate realization


class MeditationType(Enum):
    """Types of meditation practices"""
    SHAMATHA = "shamatha"           # Calm abiding
    VIPASSANA = "vipassana"         # Insight meditation
    METTA = "metta"                 # Loving-kindness
    TONGLEN = "tonglen"             # Sending and receiving
    ZAZEN = "zazen"                 # Zen sitting
    KOAN = "koan"                   # Koan contemplation
    MANTRA = "mantra"               # Mantra recitation
    WALKING = "walking"             # Walking meditation


@dataclass
class MeditationSession:
    """Record of meditation session"""
    
    session_id: str                   # Unique session ID
    practitioner_address: str         # ZION wallet address
    
    # Session details
    meditation_type: MeditationType
    duration_minutes: int             # Session duration
    depth_score: float                # Meditation depth (0-10)
    
    # Rewards
    base_reward_zion: float           # Base ZION reward
    consciousness_level: ConsciousnessLevel  # Moved before defaults
    depth_bonus_zion: float = 0.0     # Bonus for depth
    consistency_bonus_zion: float = 0.0  # Bonus for daily practice
    total_reward_zion: float = 0.0    # Total ZION earned
    
    # Consciousness metrics
    consciousness_points: float = 0.0 # Points toward next level
    
    # Timestamp
    started_at: str = ""
    completed_at: str = ""
    
    def __post_init__(self):
        if not self.started_at:
            self.started_at = datetime.utcnow().isoformat()
        if not self.completed_at:
            completed = datetime.utcnow() + timedelta(minutes=self.duration_minutes)
            self.completed_at = completed.isoformat()
        
        # Calculate total reward
        self.total_reward_zion = (
            self.base_reward_zion + 
            self.depth_bonus_zion + 
            self.consistency_bonus_zion
        )


@dataclass
class DharmaScore:
    """Dharmic qualities score"""
    
    practitioner_address: str
    
    # Three main virtues
    compassion: float = 0.0           # Karuna (0-100)
    wisdom: float = 0.0               # Prajna (0-100)
    generosity: float = 0.0           # Dana (0-100)
    
    # Accumulated merit
    total_merit_points: float = 0.0   # Total spiritual merit
    
    # Practice stats
    total_meditation_hours: float = 0.0
    consecutive_days: int = 0
    longest_streak: int = 0
    
    # Consciousness
    consciousness_level: ConsciousnessLevel = ConsciousnessLevel.AWAKENING
    consciousness_points: float = 0.0
    
    # Timestamp
    last_updated: str = ""
    
    def __post_init__(self):
        if not self.last_updated:
            self.last_updated = datetime.utcnow().isoformat()
    
    @property
    def average_virtue(self) -> float:
        """Average of three virtues"""
        return (self.compassion + self.wisdom + self.generosity) / 3
    
    @property
    def next_level_points_needed(self) -> float:
        """Points needed for next consciousness level"""
        return (self.consciousness_level.value + 1) * 1000


class SacredLibrary:
    """Collection of spiritual teachings"""
    
    def __init__(self):
        """Initialize sacred library"""
        self.sutras: List[Dict[str, str]] = []
        self.koans: List[Dict[str, str]] = []
        self.teachings: List[Dict[str, str]] = []
        
        self._load_teachings()
    
    def _load_teachings(self):
        """Load sacred texts"""
        # Buddhist Sutras
        self.sutras = [
            {
                "title": "Heart Sutra",
                "tradition": "Mahayana Buddhism",
                "text": "Form is emptiness, emptiness is form. Form does not differ from emptiness, emptiness does not differ from form.",
                "reward_multiplier": 1.5
            },
            {
                "title": "Diamond Sutra",
                "tradition": "Mahayana Buddhism",
                "text": "All conditioned phenomena are like dreams, illusions, bubbles, and shadows. Like drops of dew and flashes of lightning, thus should they be contemplated.",
                "reward_multiplier": 1.3
            },
            {
                "title": "Lotus Sutra",
                "tradition": "Mahayana Buddhism",
                "text": "The Buddha nature is present in all beings. All beings can attain enlightenment.",
                "reward_multiplier": 1.4
            }
        ]
        
        # Zen Koans
        self.koans = [
            {
                "title": "Mu",
                "master": "Zhaozhou",
                "question": "Does a dog have Buddha nature?",
                "answer": "Mu! (無)",
                "reward_multiplier": 1.6
            },
            {
                "title": "Sound of One Hand",
                "master": "Hakuin",
                "question": "What is the sound of one hand clapping?",
                "answer": "...",
                "reward_multiplier": 1.7
            },
            {
                "title": "Original Face",
                "master": "Huineng",
                "question": "What was your original face before your parents were born?",
                "answer": "...",
                "reward_multiplier": 1.5
            }
        ]
        
        # Dharma Teachings
        self.teachings = [
            {
                "title": "Four Noble Truths",
                "tradition": "Buddhism",
                "content": "1. Life contains suffering. 2. Suffering has a cause. 3. Suffering can end. 4. There is a path to end suffering.",
                "reward_multiplier": 1.2
            },
            {
                "title": "Eightfold Path",
                "tradition": "Buddhism",
                "content": "Right View, Right Intention, Right Speech, Right Action, Right Livelihood, Right Effort, Right Mindfulness, Right Concentration",
                "reward_multiplier": 1.3
            },
            {
                "title": "Six Paramitas",
                "tradition": "Mahayana Buddhism",
                "content": "Generosity, Ethics, Patience, Diligence, Meditation, Wisdom",
                "reward_multiplier": 1.4
            }
        ]
    
    def get_daily_teaching(self) -> Dict[str, Any]:
        """Get teaching of the day"""
        day_of_year = datetime.utcnow().timetuple().tm_yday
        
        # Rotate through all teachings
        all_teachings = self.sutras + self.koans + self.teachings
        teaching = all_teachings[day_of_year % len(all_teachings)]
        
        return teaching
    
    def get_random_koan(self) -> Dict[str, str]:
        """Get random koan for contemplation"""
        import random
        return random.choice(self.koans)


class ConsciousnessMining:
    """Consciousness mining rewards system"""
    
    def __init__(self, db_path: str = "data/consciousness_mining.db"):
        """
        Initialize consciousness mining
        
        Args:
            db_path: SQLite database path
        """
        self.db_path = db_path
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(db_path, check_same_thread=False)
        self._create_tables()
        
        # Sacred library
        self.sacred_library = SacredLibrary()
        
        # Reward configuration
        self.base_reward_per_minute = 0.1  # 0.1 ZION per minute
        self.depth_multiplier = 2.0        # Up to 2x for deep meditation
        self.consistency_multiplier = 1.5  # 1.5x for daily practice
        
        # Consciousness level requirements
        self.level_requirements = {
            ConsciousnessLevel.AWAKENING: 0,
            ConsciousnessLevel.AWARENESS: 1000,
            ConsciousnessLevel.INSIGHT: 2500,
            ConsciousnessLevel.WISDOM: 5000,
            ConsciousnessLevel.COMPASSION: 10000,
            ConsciousnessLevel.EQUANIMITY: 20000,
            ConsciousnessLevel.LIBERATION: 40000,
            ConsciousnessLevel.ENLIGHTENMENT: 80000,
            ConsciousnessLevel.NIRVANA: 160000
        }
        
        # Statistics
        self.total_meditation_hours = 0.0
        self.total_rewards_distributed = 0.0
        self.active_practitioners = 0
        
        print("✅ Consciousness Mining initialized")
        print(f"   Base reward: {self.base_reward_per_minute} ZION/min")
        print(f"   Sacred library: {len(self.sacred_library.sutras)} sutras, {len(self.sacred_library.koans)} koans")
    
    def _create_tables(self):
        """Create database schema"""
        cursor = self.conn.cursor()
        
        # Meditation sessions
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS meditation_sessions (
                session_id TEXT PRIMARY KEY,
                practitioner_address TEXT NOT NULL,
                meditation_type TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                depth_score REAL NOT NULL,
                base_reward_zion REAL NOT NULL,
                depth_bonus_zion REAL DEFAULT 0,
                consistency_bonus_zion REAL DEFAULT 0,
                total_reward_zion REAL NOT NULL,
                consciousness_level INTEGER NOT NULL,
                consciousness_points REAL DEFAULT 0,
                started_at TEXT NOT NULL,
                completed_at TEXT NOT NULL
            )
        """)
        
        # Dharma scores
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS dharma_scores (
                practitioner_address TEXT PRIMARY KEY,
                compassion REAL DEFAULT 0,
                wisdom REAL DEFAULT 0,
                generosity REAL DEFAULT 0,
                total_merit_points REAL DEFAULT 0,
                total_meditation_hours REAL DEFAULT 0,
                consecutive_days INTEGER DEFAULT 0,
                longest_streak INTEGER DEFAULT 0,
                consciousness_level INTEGER DEFAULT 1,
                consciousness_points REAL DEFAULT 0,
                last_updated TEXT NOT NULL
            )
        """)
        
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_practitioner ON meditation_sessions(practitioner_address)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_timestamp ON meditation_sessions(started_at)")
        
        self.conn.commit()
    
    def start_meditation_session(
        self,
        practitioner_address: str,
        meditation_type: MeditationType,
        duration_minutes: int,
        depth_score: float = 5.0
    ) -> MeditationSession:
        """
        Start meditation session and calculate rewards
        
        Args:
            practitioner_address: ZION wallet
            meditation_type: Type of meditation
            duration_minutes: Session duration
            depth_score: Meditation depth (0-10)
        
        Returns:
            MeditationSession with calculated rewards
        """
        # Get or create dharma score
        dharma = self._get_dharma_score(practitioner_address)
        
        # Calculate base reward
        base_reward = duration_minutes * self.base_reward_per_minute
        
        # Calculate depth bonus (0-100% of base)
        depth_bonus = base_reward * (depth_score / 10.0)
        
        # Calculate consistency bonus
        consistency_bonus = 0.0
        if dharma.consecutive_days >= 7:
            consistency_bonus = base_reward * 0.5  # 50% bonus for 7+ day streak
        
        # Generate session ID
        session_id = hashlib.sha256(
            f"{practitioner_address}{meditation_type.value}{time.time()}".encode()
        ).hexdigest()[:32]
        
        # Create session
        session = MeditationSession(
            session_id=session_id,
            practitioner_address=practitioner_address,
            meditation_type=meditation_type,
            duration_minutes=duration_minutes,
            depth_score=depth_score,
            base_reward_zion=base_reward,
            depth_bonus_zion=depth_bonus,
            consistency_bonus_zion=consistency_bonus,
            consciousness_level=dharma.consciousness_level,
            consciousness_points=duration_minutes * depth_score  # Points toward next level
        )
        
        # Update dharma score
        self._update_dharma_score(practitioner_address, session)
        
        # Save session
        self._save_session(session)
        
        # Update statistics
        self.total_meditation_hours += duration_minutes / 60.0
        self.total_rewards_distributed += session.total_reward_zion
        
        print(f"🧘 Meditation session completed: {session_id[:16]}...")
        print(f"   Type: {meditation_type.value}")
        print(f"   Duration: {duration_minutes} minutes")
        print(f"   Depth: {depth_score:.1f}/10")
        print(f"   Rewards:")
        print(f"     Base: {base_reward:.2f} ZION")
        print(f"     Depth bonus: +{depth_bonus:.2f} ZION")
        print(f"     Consistency bonus: +{consistency_bonus:.2f} ZION")
        print(f"     Total: {session.total_reward_zion:.2f} ZION")
        print(f"   Consciousness: Level {dharma.consciousness_level.value}")
        
        return session
    
    def _get_dharma_score(self, practitioner_address: str) -> DharmaScore:
        """Get or create dharma score"""
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT * FROM dharma_scores WHERE practitioner_address = ?",
            (practitioner_address,)
        )
        row = cursor.fetchone()
        
        if row:
            columns = [desc[0] for desc in cursor.description]
            data = dict(zip(columns, row))
            data['consciousness_level'] = ConsciousnessLevel(data['consciousness_level'])
            return DharmaScore(**data)
        else:
            # Create new
            dharma = DharmaScore(practitioner_address=practitioner_address)
            self._save_dharma_score(dharma)
            return dharma
    
    def _update_dharma_score(self, practitioner_address: str, session: MeditationSession):
        """Update dharma score after meditation"""
        dharma = self._get_dharma_score(practitioner_address)
        
        # Update meditation hours
        dharma.total_meditation_hours += session.duration_minutes / 60.0
        
        # Update consciousness points
        dharma.consciousness_points += session.consciousness_points
        
        # Check for level up
        required = self.level_requirements.get(dharma.consciousness_level, 999999)
        next_level_value = dharma.consciousness_level.value + 1
        
        if dharma.consciousness_points >= required and next_level_value <= 9:
            new_level = ConsciousnessLevel(next_level_value)
            print(f"🌟 Consciousness Level Up: {dharma.consciousness_level.name} → {new_level.name}")
            dharma.consciousness_level = new_level
            dharma.consciousness_points = 0  # Reset for next level
        
        # Update virtues based on meditation type
        if session.meditation_type == MeditationType.METTA:
            dharma.compassion = min(100, dharma.compassion + session.depth_score * 0.5)
        elif session.meditation_type == MeditationType.VIPASSANA:
            dharma.wisdom = min(100, dharma.wisdom + session.depth_score * 0.5)
        elif session.meditation_type == MeditationType.TONGLEN:
            dharma.compassion = min(100, dharma.compassion + session.depth_score * 0.7)
            dharma.generosity = min(100, dharma.generosity + session.depth_score * 0.3)
        
        # Update merit points
        dharma.total_merit_points += session.total_reward_zion
        
        # Update streak
        # TODO: Check if meditation was done yesterday
        dharma.consecutive_days += 1
        dharma.longest_streak = max(dharma.longest_streak, dharma.consecutive_days)
        
        dharma.last_updated = datetime.utcnow().isoformat()
        
        # Save
        self._save_dharma_score(dharma)
    
    def _save_session(self, session: MeditationSession):
        """Save session to database"""
        cursor = self.conn.cursor()
        data = asdict(session)
        data['meditation_type'] = session.meditation_type.value
        data['consciousness_level'] = session.consciousness_level.value
        
        cursor.execute("""
            INSERT OR REPLACE INTO meditation_sessions (
                session_id, practitioner_address, meditation_type,
                duration_minutes, depth_score,
                base_reward_zion, depth_bonus_zion, consistency_bonus_zion,
                total_reward_zion, consciousness_level, consciousness_points,
                started_at, completed_at
            ) VALUES (
                :session_id, :practitioner_address, :meditation_type,
                :duration_minutes, :depth_score,
                :base_reward_zion, :depth_bonus_zion, :consistency_bonus_zion,
                :total_reward_zion, :consciousness_level, :consciousness_points,
                :started_at, :completed_at
            )
        """, data)
        self.conn.commit()
    
    def _save_dharma_score(self, dharma: DharmaScore):
        """Save dharma score to database"""
        cursor = self.conn.cursor()
        data = asdict(dharma)
        data['consciousness_level'] = dharma.consciousness_level.value
        
        cursor.execute("""
            INSERT OR REPLACE INTO dharma_scores (
                practitioner_address, compassion, wisdom, generosity,
                total_merit_points, total_meditation_hours,
                consecutive_days, longest_streak,
                consciousness_level, consciousness_points,
                last_updated
            ) VALUES (
                :practitioner_address, :compassion, :wisdom, :generosity,
                :total_merit_points, :total_meditation_hours,
                :consecutive_days, :longest_streak,
                :consciousness_level, :consciousness_points,
                :last_updated
            )
        """, data)
        self.conn.commit()
    
    def get_practitioner_stats(self, practitioner_address: str) -> Dict[str, Any]:
        """Get practitioner statistics"""
        dharma = self._get_dharma_score(practitioner_address)
        
        return {
            "address": practitioner_address,
            "consciousness_level": dharma.consciousness_level.name,
            "consciousness_points": dharma.consciousness_points,
            "next_level_points_needed": dharma.next_level_points_needed,
            "virtues": {
                "compassion": dharma.compassion,
                "wisdom": dharma.wisdom,
                "generosity": dharma.generosity,
                "average": dharma.average_virtue
            },
            "total_merit_points": dharma.total_merit_points,
            "total_meditation_hours": dharma.total_meditation_hours,
            "consecutive_days": dharma.consecutive_days,
            "longest_streak": dharma.longest_streak
        }


# Demo
async def main():
    """Demo of Consciousness Mining"""
    
    print("=" * 80)
    print("ZION Consciousness Mining 2.0")
    print("=" * 80)
    
    # Initialize
    cm = ConsciousnessMining()
    
    # Get daily teaching
    print("\n--- Daily Teaching ---")
    teaching = cm.sacred_library.get_daily_teaching()
    print(f"Title: {teaching['title']}")
    if 'tradition' in teaching:
        print(f"Tradition: {teaching['tradition']}")
    if 'text' in teaching:
        print(f"Teaching: {teaching['text']}")
    if 'question' in teaching:
        print(f"Question: {teaching['question']}")
    
    # Meditation session 1: Metta (loving-kindness)
    print("\n--- Meditation Session 1: Metta ---")
    session1 = cm.start_meditation_session(
        practitioner_address="ZION1Meditator123",
        meditation_type=MeditationType.METTA,
        duration_minutes=30,
        depth_score=8.0
    )
    
    # Meditation session 2: Vipassana (insight)
    print("\n--- Meditation Session 2: Vipassana ---")
    session2 = cm.start_meditation_session(
        practitioner_address="ZION1Meditator123",
        meditation_type=MeditationType.VIPASSANA,
        duration_minutes=45,
        depth_score=9.0
    )
    
    # Get practitioner stats
    print("\n--- Practitioner Statistics ---")
    stats = cm.get_practitioner_stats("ZION1Meditator123")
    print(f"Consciousness Level: {stats['consciousness_level']}")
    print(f"Points: {stats['consciousness_points']:.0f} / {stats['next_level_points_needed']:.0f}")
    print(f"Virtues:")
    print(f"  Compassion: {stats['virtues']['compassion']:.1f}/100")
    print(f"  Wisdom: {stats['virtues']['wisdom']:.1f}/100")
    print(f"  Generosity: {stats['virtues']['generosity']:.1f}/100")
    print(f"  Average: {stats['virtues']['average']:.1f}/100")
    print(f"Total Merit: {stats['total_merit_points']:.2f}")
    print(f"Total Hours: {stats['total_meditation_hours']:.1f}h")
    print(f"Current Streak: {stats['consecutive_days']} days")
    
    # Random koan
    print("\n--- Contemplation Koan ---")
    koan = cm.sacred_library.get_random_koan()
    print(f"Master {koan['master']} asked:")
    print(f'"{koan["question"]}"')
    
    print("\n✅ Demo complete! May all beings be happy 🙏")
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
