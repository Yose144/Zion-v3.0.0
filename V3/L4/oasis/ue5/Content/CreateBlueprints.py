#!/usr/bin/env python3
"""
ZION OASIS — UE5 Blueprint Creation Script
Run inside UE5 Editor: File → Execute Python Script

This script creates the required Blueprints and Input assets
for ZION OASIS to compile and run.
"""

import unreal

EDITOR = unreal.EditorAssetLibrary
EDITOR_UTILS = unreal.EditorUtilityLibrary

# ─── Configuration ──────────────────────────────────────────────────────
CONTENT = "/Game"
BLUEPRINTS = f"{CONTENT}/Blueprints"
INPUT_PATH = f"{CONTENT}/Input"
MAPS = f"{CONTENT}/Maps"

# Parent classes
ZION_GM = unreal.load_class("/Script/ZionOasis.ZionOasisGameMode")
ZION_CHAR = unreal.load_class("/Script/ZionOasis.ZionCharacter")
ZION_PC = unreal.load_class("/Script/ZionOasis.ZionPlayerController")
ZION_HUD = unreal.load_class("/Script/ZionOasis.ZionHUD")
ZION_GEM = unreal.load_class("/Script/ZionOasis.GoldenEggManager")
ZION_TM = unreal.load_class("/Script/ZionOasis.TerritoryManager")

# ─── Helpers ──────────────────────────────────────────────────────────────
def create_blueprint(name: str, parent: unreal.Class, path: str):
    full_path = f"{path}/{name}"
    if EDITOR.does_asset_exist(full_path):
        print(f"  [SKIP] {full_path}")
        return EDITOR.load_asset(full_path)

    factory = unreal.BlueprintFactory()
    factory.ParentClass = parent
    asset = EDITOR.create_asset(
        asset_name=name,
        package_path=path.replace("/Game", "/Game"),
        asset_class=unreal.Blueprint,
        factory=factory
    )
    print(f"  [CREATE] {full_path}")
    return asset

def create_input_action(name: str, value_type: unreal.EInputActionValueType):
    full_path = f"{INPUT_PATH}/{name}"
    if EDITOR.does_asset_exist(full_path):
        print(f"  [SKIP] {full_path}")
        return EDITOR.load_asset(full_path)

    factory = unreal.InputActionFactory()
    asset = EDITOR.create_asset(
        asset_name=name,
        package_path=INPUT_PATH.replace("/Game", "/Game"),
        asset_class=unreal.InputAction,
        factory=factory
    )
    asset.value_type = value_type
    EDITOR.save_loaded_asset(asset)
    print(f"  [CREATE] {full_path}")
    return asset

def create_mapping_context(name: str):
    full_path = f"{INPUT_PATH}/{name}"
    if EDITOR.does_asset_exist(full_path):
        print(f"  [SKIP] {full_path}")
        return EDITOR.load_asset(full_path)

    factory = unreal.InputMappingContextFactory()
    asset = EDITOR.create_asset(
        asset_name=name,
        package_path=INPUT_PATH.replace("/Game", "/Game"),
        asset_class=unreal.InputMappingContext,
        factory=factory
    )
    print(f"  [CREATE] {full_path}")
    return asset

def create_level(name: str):
    full_path = f"{MAPS}/{name}"
    if EDITOR.does_asset_exist(full_path):
        print(f"  [SKIP] {full_path}")
        return

    # Create new level via editor utils
    level_path = f"{MAPS}"
    unreal.EditorLevelLibrary.new_level(f"{level_path}/{name}")
    print(f"  [CREATE] {full_path}")

# ─── Create Folders ─────────────────────────────────────────────────────
print("Creating folders...")
for folder in [f"{BLUEPRINTS}/Game", f"{BLUEPRINTS}/Player", f"{BLUEPRINTS}/UI", INPUT_PATH, MAPS]:
    EDITOR.make_directory(folder)
    print(f"  {folder}")

# ─── Create Input Actions ─────────────────────────────────────────────────
print("\nCreating Input Actions...")
IA_MOVE = create_input_action("IA_Move", unreal.EInputActionValueType.AXIS2D)
IA_LOOK = create_input_action("IA_Look", unreal.EInputActionValueType.AXIS2D)
IA_JUMP = create_input_action("IA_Jump", unreal.EInputActionValueType.BOOLEAN)
IA_MEDITATE = create_input_action("IA_Meditate", unreal.EInputActionValueType.BOOLEAN)
IA_INTERACT = create_input_action("IA_Interact", unreal.EInputActionValueType.BOOLEAN)
IA_SPRINT = create_input_action("IA_Sprint", unreal.EInputActionValueType.BOOLEAN)
IA_TOGGLE_MAP = create_input_action("IA_ToggleMap", unreal.EInputActionValueType.BOOLEAN)
IA_TOGGLE_QUEST = create_input_action("IA_ToggleQuestLog", unreal.EInputActionValueType.BOOLEAN)

# ─── Create Mapping Context ───────────────────────────────────────────────
print("\nCreating Input Mapping Context...")
IMC = create_mapping_context("IMC_ZionDefault")

# ─── Create Blueprints ──────────────────────────────────────────────────
print("\nCreating Blueprints...")
BP_GM = create_blueprint("BP_ZionOasisGameMode", ZION_GM, f"{BLUEPRINTS}/Game")
BP_CHAR = create_blueprint("BP_ZionCharacter", ZION_CHAR, f"{BLUEPRINTS}/Player")
BP_PC = create_blueprint("BP_ZionPlayerController", ZION_PC, f"{BLUEPRINTS}/Player")
BP_HUD = create_blueprint("BP_ZionHUD", ZION_HUD, f"{BLUEPRINTS}/UI")
BP_GEM = create_blueprint("BP_GoldenEggManager", ZION_GEM, f"{BLUEPRINTS}/Game")
BP_TM = create_blueprint("BP_TerritoryManager", ZION_TM, f"{BLUEPRINTS}/Game")

# ─── Create Levels ──────────────────────────────────────────────────────
print("\nCreating Levels...")
create_level("LV_MainMenu")
create_level("LV_World")

# ─── Save All ────────────────────────────────────────────────────────────
print("\nSaving assets...")
EDITOR.save_directory("/Game", only_if_is_dirty=False, recursive=True)

print("\n" + "="*60)
print("Done! Restart the editor and set:")
print("  Project Settings → Maps & Modes → Default GameMode = BP_ZionOasisGameMode")
print("  Project Settings → Maps & Modes → Editor Startup Map = LV_World")
print("  Project Settings → Maps & Modes → Game Default Map = LV_MainMenu")
print("="*60)
