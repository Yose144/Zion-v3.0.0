"""ZION Oasis blueprint generator tool for quest, territory, and guild design."""

from __future__ import annotations

import json
import random
from pathlib import Path
from typing import Any

from . import Tool


# Genesis data from ZION Oasis docs
CONSCIOUSNESS_LEVELS = [
    {"name": "Physical", "sefira": "Malkuth", "xp_threshold": 0, "multiplier": 1.0},
    {"name": "Emotional", "sefira": "Yesod", "xp_threshold": 1000, "multiplier": 1.2},
    {"name": "Mental", "sefira": "Hod/Netzach", "xp_threshold": 5000, "multiplier": 1.5},
    {"name": "Intuitive", "sefira": "Tiferet", "xp_threshold": 15000, "multiplier": 2.0},
    {"name": "Creative", "sefira": "Gevurah/Chesed", "xp_threshold": 50000, "multiplier": 2.5},
    {"name": "Visionary", "sefira": "Binah", "xp_threshold": 150000, "multiplier": 3.0},
    {"name": "Universal", "sefira": "Chokmah", "xp_threshold": 500000, "multiplier": 4.0},
    {"name": "Transcendent", "sefira": "Da'at", "xp_threshold": 2000000, "multiplier": 5.0},
    {"name": "On The Star", "sefira": "Keter", "xp_threshold": 10000000, "multiplier": 10.0},
]

TERRITORY_TYPES = ["Mountains", "Forest", "Desert", "Ocean", "Volcano", "CrystalCaves"]
TERRITORY_REGIONS = [
    "Mountains", "Cedar Forest", "Negev Desert", "Dead Sea",
    "Mount Hermon Volcano", "Jerusalem Crystal", "Jordan Valley", "Mediterranean",
]

GUILD_QUEST_TEMPLATES = [
    {
        "name": "The Sacred Mine",
        "description": "Mine {amount} blocks in {territory} within {time_limit} hours.",
        "reward_xp": 500,
        "difficulty": "medium",
    },
    {
        "name": "Consciousness Awakening",
        "description": "Complete {amount} meditation sessions and achieve {level_name} consciousness.",
        "reward_xp": 1000,
        "difficulty": "hard",
    },
    {
        "name": "Tithe of Compassion",
        "description": "Contribute {amount} ZION to humanitarian tithe and document the impact.",
        "reward_xp": 300,
        "difficulty": "easy",
    },
    {
        "name": "Territory Defense",
        "description": "Defend {territory} territory for {time_limit} hours against rival guild raids.",
        "reward_xp": 800,
        "difficulty": "hard",
    },
]


class BlueprintGeneratorTool(Tool):
    name = "blueprint_generator"
    description = "Generate ZION Oasis blueprints: quests, territories, guilds, rewards, and challenges."

    def schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "blueprint_type": {
                    "type": "string",
                    "enum": ["quest", "territory", "guild", "reward_pool", "challenge", "consciousness_path"],
                },
                "parameters": {"type": "object", "description": "Blueprint-specific parameters"},
            },
            "required": ["blueprint_type"],
        }

    def execute(self, **kwargs: Any) -> dict[str, Any]:
        bp_type = kwargs.get("blueprint_type", "quest")
        params = kwargs.get("parameters", {})

        generators = {
            "quest": self._generate_quest,
            "territory": self._generate_territory,
            "guild": self._generate_guild,
            "reward_pool": self._generate_reward_pool,
            "challenge": self._generate_challenge,
            "consciousness_path": self._generate_consciousness_path,
        }

        gen = generators.get(bp_type)
        if not gen:
            return {"success": False, "error": f"Unknown blueprint type: {bp_type}"}

        return {"success": True, "blueprint": gen(params)}

    def _generate_quest(self, params: dict[str, Any]) -> dict[str, Any]:
        template = random.choice(GUILD_QUEST_TEMPLATES)
        territory = random.choice(TERRITORY_REGIONS)
        amount = params.get("amount", random.randint(10, 100))
        time_limit = params.get("time_limit", random.choice([2, 4, 8, 24]))
        level = random.choice(CONSCIOUSNESS_LEVELS[1:4])

        quest = {
            "name": template["name"],
            "description": template["description"].format(
                amount=amount, territory=territory, time_limit=time_limit, level_name=level["name"]
            ),
            "objectives": [
                f"Complete primary task within {time_limit} hours",
                f"Maintain minimum consciousness level: {level['name']}",
                f"Document progress with on-chain verification",
            ],
            "completion_criteria": {
                "min_xp": template["reward_xp"],
                "min_level": level["name"],
                "time_limit_hours": time_limit,
            },
            "rewards": {
                "xp": template["reward_xp"],
                "bonus_multiplier": level["multiplier"],
                "special_reward": params.get("special_reward", f"{territory} Badge"),
            },
            "difficulty": template["difficulty"],
        }
        return quest

    def _generate_territory(self, params: dict[str, Any]) -> dict[str, Any]:
        t_type = params.get("type", random.choice(TERRITORY_TYPES))
        region = params.get("region", random.choice(TERRITORY_REGIONS))
        return {
            "name": region,
            "type": t_type,
            "region": region,
            "claim_cost": 10000,
            "defense_period_hours": 24,
            "mining_bonus_percent": 10,
            "xp_bonus_percent": 5,
            "adjacent_territories": random.sample(TERRITORY_REGIONS, k=random.randint(2, 4)),
            "special_resources": params.get("special_resources", ["Iron", "Crystal", "Water"]),
            "lore": f"The {region} has been a sacred site since the First Miner. Its {t_type.lower()} terrain holds ancient ZION deposits.",
        }

    def _generate_guild(self, params: dict[str, Any]) -> dict[str, Any]:
        name = params.get("name", f"Guild of {random.choice(CONSCIOUSNESS_LEVELS)['sefira']}")
        return {
            "name": name,
            "founder": params.get("founder", "genesis_address"),
            "creation_requirements": {
                "min_xp": 5000,
                "min_level": "Mental",
                "founding_cost_zion": 1000,
            },
            "max_members": 100,
            "ranks": ["Founder", "Officer", "Member", "Initiate"],
            "territory_bonus": {
                "mining_boost": 0.05,
                "xp_boost": 0.03,
            },
            "guild_wars": {
                "enabled": True,
                "cooldown_days": 7,
                "min_participants": 10,
            },
        }

    def _generate_reward_pool(self, params: dict[str, Any]) -> dict[str, Any]:
        return {
            "total_allocation": 8_250_000_000,
            "currency": "ZION",
            "distribution_schedule": "10+ years",
            "slots": [
                {
                    "name": "GoldenEgg",
                    "allocation": 1_650_000_000,
                    "unlock_condition": "Level 3 community reached",
                    "recipients": "1st place global XP leaderboard",
                },
                {
                    "name": "Winners",
                    "allocation": 1_650_000_000,
                    "unlock_condition": "Level 5 community reached",
                    "recipients": "Top 100 players",
                },
                {
                    "name": "GuildPool",
                    "allocation": 1_650_000_000,
                    "unlock_condition": "Level 7 community reached",
                    "recipients": "Top 10 guilds",
                },
                {
                    "name": "TerritoryPool",
                    "allocation": 1_650_000_000,
                    "unlock_condition": "Level 8 community reached",
                    "recipients": "Territory controllers",
                },
                {
                    "name": "HumanitarianPool",
                    "allocation": 1_650_000_000,
                    "unlock_condition": "Level 9 community reached",
                    "recipients": "Top humanitarian tithe contributors",
                },
            ],
        }

    def _generate_challenge(self, params: dict[str, Any]) -> dict[str, Any]:
        difficulty = params.get("difficulty", random.choice(["easy", "medium", "hard", "legendary"]))
        rewards = {"easy": 100, "medium": 300, "hard": 800, "legendary": 2000}
        return {
            "name": params.get("name", f"Challenge of {random.choice(CONSCIOUSNESS_LEVELS)['name']}"),
            "difficulty": difficulty,
            "type": random.choice(["mining", "puzzle", "meditation", "quiz", "raid"]),
            "description": f"A {difficulty} challenge testing miner skill and consciousness.",
            "reward_xp": rewards.get(difficulty, 500),
            "time_limit_minutes": params.get("time_limit", random.choice([5, 15, 30, 60])),
            "requirements": {
                "min_level": random.choice(CONSCIOUSNESS_LEVELS[:5])["name"],
                "guild_membership": random.choice([True, False]),
            },
        }

    def _generate_consciousness_path(self, params: dict[str, Any]) -> dict[str, Any]:
        start_level = params.get("start_level", 1)
        target_level = params.get("target_level", 9)
        path = []
        for lvl in CONSCIOUSNESS_LEVELS[start_level - 1:target_level]:
            path.append({
                "level": lvl["name"],
                "sefira": lvl["sefira"],
                "xp_required": lvl["xp_threshold"],
                "reward_multiplier": lvl["multiplier"],
                "recommended_activities": random.sample(
                    ["mining", "meditation", "guild_quest", "challenge", "tithe"], k=3
                ),
            })
        return {
            "path_name": params.get("path_name", "Path of Ascension"),
            "start_level": start_level,
            "target_level": target_level,
            "total_xp_required": path[-1]["xp_required"] if path else 0,
            "estimated_time_days": params.get("estimated_days", random.randint(30, 365)),
            "stages": path,
        }
