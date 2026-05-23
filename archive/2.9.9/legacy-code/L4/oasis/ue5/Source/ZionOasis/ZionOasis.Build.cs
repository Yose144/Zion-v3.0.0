// Copyright 2026 ZION TerraNova. All Rights Reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class ZionOasis : ModuleRules
{
	public ZionOasis(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"UMG",
			"Slate",
			"SlateCore",
			"GameplayAbilities",
			"GameplayTags",
			"GameplayTasks",
			"HTTP",
			"Json",
			"JsonUtilities",
			"OnlineSubsystem",
			"OnlineSubsystemUtils",
			"CommonUI",
			"CommonGame",
			"NetCore"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"RenderCore",
			"RHI",
			"Renderer",
			"ChaosPhysics",
			"PhysicsCore",
			"AIModule",
			"NavigationSystem",
			"Niagara",
			"AudioMixer",
			"AudioAnalyzer",
			"SignificanceManager"
		});

		// ZION Blockchain Bridge (Rust backend REST API)
		PublicDefinitions.Add("ZION_OASIS_API_PORT=8094");
		PublicDefinitions.Add("ZION_BLOCKCHAIN_RPC_PORT=8444");

		// For MetaHuman support
		if (Target.Type == TargetType.Editor)
		{
			PrivateDependencyModuleNames.AddRange(new string[]
			{
				"UnrealEd",
				"BlueprintGraph",
				"AnimGraph"
			});
		}
	}
}
