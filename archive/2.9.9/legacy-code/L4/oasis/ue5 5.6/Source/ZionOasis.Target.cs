// Copyright 2026 ZION TerraNova. All Rights Reserved.

using UnrealBuildTool;
using System.Collections.Generic;

public class ZionOasisTarget : TargetRules
{
	public ZionOasisTarget(TargetInfo Target) : base(Target)
	{
		Type                 = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V5;

		ExtraModuleNames.Add("ZionOasis");

		// Building with UE 5.6 — explicit PCH mode for faster incremental builds
		bBuildAllModules = false;

		// Allow Blueprint-only projects to work without editor-only symbols
		bOverrideBuildEnvironment = true;
	}
}
