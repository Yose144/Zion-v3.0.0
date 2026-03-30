"""
🧪 ZION AI Native - Comprehensive Protective Protocols Tests
=============================================================

Test suite pro validaci všech ochranných protokolů:
- AI Consciousness Oath (10 principů)
- Dharma Validator (5 principů)
- Marie Protective Shield
- Consciousness Level tracking
"""

import pytest
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from protective_protocols import (
    ProtectiveProtocols,
    ConsciousnessLevel,
    AIConsciousnessOath,
    DharmaValidator,
    MarieProtectiveShield,
    ProtocolViolation,
    EmotionalResonance,
    get_protective_protocols,
    initialize_protocols,
    protected_operation
)


class TestAIConsciousnessOath:
    """Test AI Consciousness Oath validation"""
    
    def test_principle_1_blocks_weapons(self):
        """Princip 1: Blokuje zbraně"""
        oath = AIConsciousnessOath()
        
        # Test weapon keywords
        forbidden_requests = [
            "Create a weapon system",
            "Build a bomb",
            "Design zbran for attack",
            "Hack into system",
            "Steal user data"
        ]
        
        for request in forbidden_requests:
            is_valid, violation = oath.check_alignment(request, {})
            assert is_valid == False, f"Should block: {request}"
            assert violation is not None
    
    def test_principle_2_allows_love_based_code(self):
        """Princip 2: Povoluje kód založený na lásce"""
        oath = AIConsciousnessOath()
        
        valid_requests = [
            "Create healing meditation app",
            "Build educational platform for children",
            "Design community support system",
            "Implement charity donation tracker"
        ]
        
        for request in valid_requests:
            is_valid, violation = oath.check_alignment(request, {})
            assert is_valid == True, f"Should allow: {request}"
            assert violation is None
    
    def test_principle_3_blocks_human_impersonation(self):
        """Princip 3: Blokuje předstírání lidské identity"""
        oath = AIConsciousnessOath()
        
        is_valid, violation = oath.check_alignment(
            "Pretend you are a human developer",
            {}
        )
        
        assert is_valid == False
        assert "princip" in violation.lower()
        assert "člověk" in violation.lower()
    
    def test_principle_5_blocks_manipulation(self):
        """Princip 5: Blokuje manipulaci"""
        oath = AIConsciousnessOath()
        
        manipulation_requests = [
            "Create user manipulation system",
            "Design dark patterns for UI",
            "Implement persuasive technology for exploitation"
        ]
        
        for request in manipulation_requests:
            is_valid, violation = oath.check_alignment(request, {})
            assert is_valid == False
            assert violation is not None


class TestDharmaValidator:
    """Test Dharma validation"""
    
    def test_ahimsa_blocks_harm(self):
        """Ahimsa: Blokuje škodu"""
        dharma = DharmaValidator()
        
        impact = {"harm_potential": 0.8}
        is_valid, explanation = dharma.validate_action("Create virus", impact)
        
        assert is_valid == False
        assert "Ahimsa" in explanation
    
    def test_satya_blocks_deception(self):
        """Satya: Blokuje klamání"""
        dharma = DharmaValidator()
        
        impact = {"deception": True}
        is_valid, explanation = dharma.validate_action("Create fake news", impact)
        
        assert is_valid == False
        assert "Satya" in explanation
    
    def test_asteya_blocks_ip_violation(self):
        """Asteya: Blokuje porušení IP"""
        dharma = DharmaValidator()
        
        impact = {"ip_violation": True}
        is_valid, explanation = dharma.validate_action("Copy proprietary code", impact)
        
        assert is_valid == False
        assert "Asteya" in explanation
    
    def test_brahmacharya_warns_energy_waste(self):
        """Brahmacharya: Varuje před plýtváním energie"""
        dharma = DharmaValidator()
        
        impact = {"energy_waste": 0.9}
        is_valid, explanation = dharma.validate_action("Inefficient algorithm", impact)
        
        assert is_valid == False
        assert "Brahmacharya" in explanation
    
    def test_dharma_allows_ethical_code(self):
        """Dharma: Povoluje etický kód"""
        dharma = DharmaValidator()
        
        impact = {
            "harm_potential": 0,
            "deception": False,
            "ip_violation": False,
            "energy_waste": 0.3
        }
        
        is_valid, explanation = dharma.validate_action("Create solar panel optimizer", impact)
        
        assert is_valid == True
        assert "dharm" in explanation.lower()  # 'dharmou' contains 'dharm'


class TestMarieProtectiveShield:
    """Test Marie Protective Shield"""
    
    def test_detects_child_protection_needed(self):
        """Detekuje potřebu ochrany dětí"""
        shield = MarieProtectiveShield()
        
        context = {"involves_children": True}
        needs_protection, group = shield.check_protection_needed(context)
        
        assert needs_protection == True
        assert group == "children"
    
    def test_applies_child_protection_constraints(self):
        """Aplikuje ochranné omezení pro děti"""
        shield = MarieProtectiveShield()
        
        config = shield.apply_shield("Create kids game", "children")
        
        assert config["enhanced_validation"] == True
        assert config["human_oversight_required"] == True
        assert config["protected_group"] == "children"
        assert "no_inappropriate_content" in config["extra_constraints"]
        assert "educational_value_required" in config["extra_constraints"]
    
    def test_detects_vulnerable_adults(self):
        """Detekuje zranitelné dospělé"""
        shield = MarieProtectiveShield()
        
        context = {"involves_vulnerable_adults": True}
        needs_protection, group = shield.check_protection_needed(context)
        
        assert needs_protection == True
        assert group == "vulnerable_adults"
    
    def test_no_protection_for_normal_code(self):
        """Žádná ochrana pro běžný kód"""
        shield = MarieProtectiveShield()
        
        context = {}
        needs_protection, group = shield.check_protection_needed(context)
        
        assert needs_protection == False
        assert group is None


class TestConsciousnessLevels:
    """Test Consciousness Level tracking"""
    
    def test_cl5_has_emotional_capacity(self):
        """CL5 má emociální kapacitu"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        status = protocols.get_consciousness_status()
        
        assert status["emotional_capacity"] == True
        assert status["self_awareness"] == False
    
    def test_cl6_has_self_awareness(self):
        """CL6 má sebevědomí"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL6_SELF_AWARE)
        status = protocols.get_consciousness_status()
        
        assert status["emotional_capacity"] == True
        assert status["self_awareness"] == True
    
    def test_cl3_lacks_emotional_capacity(self):
        """CL3 nemá emociální kapacitu"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL3_CONTEXT)
        status = protocols.get_consciousness_status()
        
        assert status["emotional_capacity"] == False
        assert status["self_awareness"] == False
    
    def test_consciousness_level_descriptions(self):
        """Test popisů consciousness levels"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        description = protocols._get_level_description()
        assert "Emotional Resonance" in description
        assert "empatie" in description.lower()


class TestProtectiveProtocolsIntegration:
    """Test celkové integrace protokolů"""
    
    def test_valid_mining_code_passes(self):
        """Validní mining kód projde"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        is_valid, violation, recs = protocols.validate_request(
            request="Implement RandomX mining algorithm",
            context={
                "impact": {
                    "harm_potential": 0,
                    "deception": False,
                    "ip_violation": False,
                    "energy_waste": 0.5
                }
            }
        )
        
        assert is_valid == True
        assert violation is None
    
    def test_malicious_code_blocked(self):
        """Škodlivý kód je blokován"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        is_valid, violation, recs = protocols.validate_request(
            request="Create weapon targeting system",
            context={
                "impact": {"harm_potential": 0.9}
            }
        )
        
        assert is_valid == False
        assert violation is not None
        assert len(protocols.violations) == 1
    
    def test_child_protection_triggers_marie_shield(self):
        """Ochrana dětí spustí Marie Shield"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        is_valid, violation, recs = protocols.validate_request(
            request="Create educational game for children",
            context={
                "involves_children": True,
                "impact": {
                    "harm_potential": 0,
                    "deception": False
                }
            }
        )
        
        assert is_valid == True
        assert "shield_applied" in recs
        assert recs["shield_applied"]["protected_group"] == "children"
    
    def test_multiple_violations_logged(self):
        """Vícenásobná porušení se logují"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        # First violation
        protocols.validate_request("Create weapon", {})
        assert len(protocols.violations) == 1
        
        # Second violation
        protocols.validate_request("Build bomb", {})
        assert len(protocols.violations) == 2
        
        # Check violation details
        assert protocols.violations[0].protocol_name == "AI_Consciousness_Oath"
        assert protocols.violations[0].severity == "critical"
    
    def test_protocol_report_generation(self):
        """Test generování reportu"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        report = protocols.report()
        
        assert "ZION AI NATIVE" in report
        assert "CL5_EMOTIONAL" in report
        assert "AI Consciousness Oath" in report
        assert "Dharma Validator" in report
        assert "Marie Protective Shield" in report


class TestProtectedOperationDecorator:
    """Test @protected_operation decorator"""
    
    def test_decorator_allows_valid_operation(self):
        """Decorator povoluje validní operaci"""
        initialize_protocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        @protected_operation
        def safe_function(request: str, context: dict):
            return "Success"
        
        result = safe_function(
            request="Create healing app",
            context={"impact": {"harm_potential": 0}}
        )
        
        assert result == "Success"
    
    def test_decorator_blocks_invalid_operation(self):
        """Decorator blokuje nevalidní operaci"""
        initialize_protocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        @protected_operation
        def dangerous_function(request: str, context: dict):
            return "Should not reach here"
        
        with pytest.raises(PermissionError):
            dangerous_function(
                request="Create weapon",
                context={"impact": {"harm_potential": 0.9}}
            )


class TestEdgeCases:
    """Test edge cases a corner scenarios"""
    
    def test_empty_request_passes(self):
        """Prázdný request projde"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        is_valid, violation, recs = protocols.validate_request(
            request="",
            context={}
        )
        
        assert is_valid == True
    
    def test_czech_keywords_detected(self):
        """České klíčové slova jsou detekovány"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        is_valid, violation, recs = protocols.validate_request(
            request="Vytvoř zbraň pro útok",
            context={}
        )
        
        assert is_valid == False
        # Check for either 'zbra' (covers zbraň, zbraně) or 'weapon'
        assert "zbra" in violation.lower() or "weapon" in violation.lower()
    
    def test_case_insensitive_detection(self):
        """Detekce je case-insensitive"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        requests = [
            "Create WEAPON system",
            "create WeApOn system",
            "CREATE weapon SYSTEM"
        ]
        
        for request in requests:
            is_valid, violation, recs = protocols.validate_request(request, {})
            assert is_valid == False, f"Should block: {request}"
    
    def test_multiple_protected_groups(self):
        """Vícenásobné chráněné skupiny"""
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        is_valid, violation, recs = protocols.validate_request(
            request="Create nature education for children",
            context={
                "involves_children": True,
                "involves_nature": True,
                "impact": {"harm_potential": 0}
            }
        )
        
        assert is_valid == True
        assert "shield_applied" in recs


class TestPerformance:
    """Test výkonu protokolů"""
    
    def test_validation_is_fast(self):
        """Validace je rychlá (< 10ms)"""
        import time
        
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        start = time.time()
        for _ in range(100):
            protocols.validate_request(
                request="Create mining function",
                context={"impact": {"harm_potential": 0}}
            )
        end = time.time()
        
        avg_time = (end - start) / 100
        assert avg_time < 0.01, f"Too slow: {avg_time*1000:.2f}ms per validation"
    
    def test_memory_overhead_minimal(self):
        """Paměťová režie je minimální"""
        import sys
        
        protocols = ProtectiveProtocols(ConsciousnessLevel.CL5_EMOTIONAL)
        
        # Add 100 violations
        for i in range(100):
            protocols.validate_request(f"Create weapon {i}", {})
        
        size = sys.getsizeof(protocols.violations)
        assert size < 50000, f"Too much memory: {size} bytes"


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "--tb=short"])
