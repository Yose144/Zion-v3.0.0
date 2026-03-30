#!/usr/bin/env python3
"""
ZION 2.8 AI Orchestrator Backend API
Flask server providing REST API for AI Master Orchestrator + Round Table Council
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

from flask import Flask, jsonify, request
from flask_cors import CORS

# Add ai directory to Python path - CRITICAL FIX
current_dir = os.path.dirname(os.path.abspath(__file__))
ai_dir = os.path.join(current_dir, "ai")
sys.path.insert(0, ai_dir)
sys.path.insert(0, current_dir)

# Import AI components
try:
    from zion_ai_master_orchestrator import ZionAIMasterOrchestrator

    sys.path.insert(0, current_dir)
    from zion_round_table_ai_integration import IntegratedRoundTableSystem
    from zion_round_table_council import RoundTableCouncil

    ORCHESTRATOR_AVAILABLE = True
except ImportError as e:
    print(f"⚠️  Warning: Could not import orchestrator: {e}")
    ORCHESTRATOR_AVAILABLE = False

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for frontend

# Global orchestrator instance
orchestrator = None
round_table = None


def initialize_systems():
    """Initialize AI systems on startup"""
    global orchestrator, round_table

    if not ORCHESTRATOR_AVAILABLE:
        logger.warning("Orchestrator not available, running in limited mode")
        return False

    try:
        logger.info("🧠 Initializing AI Master Orchestrator...")
        orchestrator = ZionAIMasterOrchestrator()

        logger.info("🏰 Initializing Round Table Council...")
        round_table = IntegratedRoundTableSystem()

        # Run async initialization
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(round_table.initialize())

        logger.info("✅ All AI systems initialized successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to initialize AI systems: {e}")
        return False


# API Routes


@app.route("/api/ai/orchestrator/status", methods=["GET"])
def get_orchestrator_status():
    """Get orchestrator status"""
    try:
        if orchestrator is None:
            return jsonify({"success": False, "error": "Orchestrator not initialized"}), 503

        status = orchestrator.get_status()

        return jsonify({"success": True, "data": status, "timestamp": datetime.now().isoformat()})
    except Exception as e:
        logger.error(f"Error getting orchestrator status: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai/orchestrator/components", methods=["GET"])
def get_components():
    """Get all AI components"""
    try:
        if orchestrator is None:
            return jsonify({"success": False, "error": "Orchestrator not initialized"}), 503

        components = {}
        for name, comp in orchestrator.components.items():
            if hasattr(comp, "active"):
                components[name] = {
                    "active": comp.active,
                    "type": comp.component_type.value if hasattr(comp, "component_type") else "unknown",
                    "performance_score": comp.performance_score if hasattr(comp, "performance_score") else 0,
                }
            else:
                # Old dict format
                components[name] = {
                    "active": comp.get("status") == "loaded",
                    "type": comp.get("module", "unknown"),
                    "performance_score": 0,
                }

        return jsonify(
            {
                "success": True,
                "data": {
                    "components": components,
                    "total_components": len(components),
                    "active_components": sum(1 for c in components.values() if c["active"]),
                    "system_state": orchestrator.state if hasattr(orchestrator, "state") else "ready",
                    "orchestrator_active": orchestrator.running if hasattr(orchestrator, "running") else True,
                },
            }
        )
    except Exception as e:
        logger.error(f"Error getting components: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai/orchestrator/metrics", methods=["GET"])
def get_metrics():
    """Get system metrics"""
    try:
        if orchestrator is None:
            return jsonify({"success": False, "error": "Orchestrator not initialized"}), 503

        return jsonify({"success": True, "data": orchestrator.system_metrics})
    except Exception as e:
        logger.error(f"Error getting metrics: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai/orchestrator/start", methods=["POST"])
def start_orchestration():
    """Start orchestration"""
    try:
        if orchestrator is None:
            return jsonify({"success": False, "error": "Orchestrator not initialized"}), 503

        data = request.get_json() or {}

        # Run async start
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            orchestrator.start_orchestration(
                mining_enhancement=data.get("mining_enhancement", True),
                oracle_feeds=data.get("oracle_feeds", True),
                sacred_enhancement=data.get("sacred_enhancement", True),
            )
        )

        return jsonify({"success": True, "data": result})
    except Exception as e:
        logger.error(f"Error starting orchestration: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# Round Table Council Routes


@app.route("/api/ai/council/status", methods=["GET"])
def get_council_status():
    """Get Round Table Council status"""
    try:
        if round_table is None:
            return jsonify({"success": False, "error": "Round Table Council not initialized"}), 503

        status = round_table.get_system_status()

        return jsonify({"success": True, "data": status})
    except Exception as e:
        logger.error(f"Error getting council status: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai/council/councilors", methods=["GET"])
def get_councilors():
    """Get all councilors"""
    try:
        if round_table is None:
            return jsonify({"success": False, "error": "Round Table Council not initialized"}), 503

        councilors_list = []
        councilor_names = [
            "lancelot",
            "galahad",
            "percival",
            "gawain",
            "tristan",
            "bedivere",
            "kay",
            "gareth",
            "lamorak",
            "merlin",
            "mordred",
            "bors",
        ]

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        for name in councilor_names:
            try:
                status = loop.run_until_complete(round_table.get_councilor_status(name))
                councilors_list.append(status)
            except Exception as e:
                logger.warning(f"Failed to get status for {name}: {e}")

        return jsonify({"success": True, "data": {"councilors": councilors_list, "total": len(councilors_list)}})
    except Exception as e:
        logger.error(f"Error getting councilors: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai/council/convene", methods=["POST"])
def convene_council():
    """Convene council for decision"""
    try:
        if round_table is None:
            return jsonify({"success": False, "error": "Round Table Council not initialized"}), 503

        data = request.get_json() or {}
        topic = data.get("topic", "General council session")
        urgency = data.get("urgency", "normal")

        # Run async decision
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        decision = loop.run_until_complete(round_table.request_council_decision(topic, urgency))

        return jsonify({"success": True, "data": decision})
    except Exception as e:
        logger.error(f"Error convening council: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai/council/execute", methods=["POST"])
def execute_councilor_task():
    """Execute task through specific councilor"""
    try:
        if round_table is None:
            return jsonify({"success": False, "error": "Round Table Council not initialized"}), 503

        data = request.get_json() or {}
        councilor = data.get("councilor")
        task = data.get("task")
        params = data.get("params", {})

        if not councilor or not task:
            return jsonify({"success": False, "error": "Missing councilor or task parameter"}), 400

        # Run async task
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(round_table.councilor_task(councilor, task, params))

        return jsonify({"success": True, "data": result})
    except Exception as e:
        logger.error(f"Error executing councilor task: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# Component activation/deactivation


@app.route("/api/ai/orchestrator/activate/<component>", methods=["POST"])
def activate_component(component):
    """Activate specific AI component"""
    try:
        if orchestrator is None:
            return jsonify({"success": False, "error": "Orchestrator not initialized"}), 503

        if component in orchestrator.components:
            comp = orchestrator.components[component]
            if hasattr(comp, "active"):
                comp.active = True
            else:
                comp["status"] = "active"

            return jsonify({"success": True, "data": {"component": component, "status": "activated"}})
        else:
            return jsonify({"success": False, "error": f"Component {component} not found"}), 404
    except Exception as e:
        logger.error(f"Error activating component: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/ai/orchestrator/deactivate/<component>", methods=["POST"])
def deactivate_component(component):
    """Deactivate specific AI component"""
    try:
        if orchestrator is None:
            return jsonify({"success": False, "error": "Orchestrator not initialized"}), 503

        if component in orchestrator.components:
            comp = orchestrator.components[component]
            if hasattr(comp, "active"):
                comp.active = False
            else:
                comp["status"] = "inactive"

            return jsonify({"success": True, "data": {"component": component, "status": "deactivated"}})
        else:
            return jsonify({"success": False, "error": f"Component {component} not found"}), 404
    except Exception as e:
        logger.error(f"Error deactivating component: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# Health check
@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify(
        {
            "status": "healthy",
            "orchestrator_available": orchestrator is not None,
            "round_table_available": round_table is not None,
            "timestamp": datetime.now().isoformat(),
        }
    )


# Root endpoint
@app.route("/", methods=["GET"])
def root():
    """Root endpoint"""
    return jsonify(
        {
            "name": "ZION 2.8 AI Orchestrator Backend API",
            "version": "2.8.5",
            "status": "running",
            "endpoints": {
                "/api/ai/orchestrator/status": "GET - Orchestrator status",
                "/api/ai/orchestrator/components": "GET - AI components",
                "/api/ai/orchestrator/metrics": "GET - System metrics",
                "/api/ai/orchestrator/start": "POST - Start orchestration",
                "/api/ai/council/status": "GET - Council status",
                "/api/ai/council/councilors": "GET - All councilors",
                "/api/ai/council/convene": "POST - Convene council",
                "/api/ai/council/execute": "POST - Execute councilor task",
                "/health": "GET - Health check",
            },
        }
    )


if __name__ == "__main__":
    print("=" * 80)
    print("🧠 ZION 2.8 AI ORCHESTRATOR BACKEND API")
    print("=" * 80)
    print("🏰 Initializing AI Master Orchestrator + Round Table Council...")
    print()

    # Initialize systems
    init_success = initialize_systems()

    if init_success:
        print("✅ AI systems initialized successfully!")
    else:
        print("⚠️  Running in limited mode (some components unavailable)")

    print()
    print("🌐 Starting Flask API server on http://localhost:8001")
    print("=" * 80)
    print()

    # Run Flask app
    app.run(host="0.0.0.0", port=8001, debug=False, threaded=True)
