// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "ZionGameInstance.h"
#include "ZionOasis/Blockchain/ZionBlockchainBridge.h"
#include "Engine/World.h"
#include "HAL/PlatformMisc.h"

UZionGameInstance::UZionGameInstance()
{
}

void UZionGameInstance::Init()
{
	Super::Init();

	// Allow environment overrides so the same binary can target localhost or production.
	FString ApiHostFromEnv = FPlatformMisc::GetEnvironmentVariable(TEXT("OASIS_API_HOST"));
	if (!ApiHostFromEnv.IsEmpty())
	{
		OasisApiHost = ApiHostFromEnv;
	}

	FString RpcHostFromEnv = FPlatformMisc::GetEnvironmentVariable(TEXT("CHAIN_RPC_HOST"));
	if (!RpcHostFromEnv.IsEmpty())
	{
		ChainRpcHost = RpcHostFromEnv;
	}

	BlockchainBridge = NewObject<UZionBlockchainBridge>(this, TEXT("BlockchainBridge"));
	if (BlockchainBridge)
	{
		BlockchainBridge->Initialize(OasisApiHost, ChainRpcHost);
		UE_LOG(LogTemp, Log, TEXT("[ZionGameInstance] BlockchainBridge initialised — oasis: %s  rpc: %s"),
			*OasisApiHost, *ChainRpcHost);
	}
}

void UZionGameInstance::Shutdown()
{
	BlockchainBridge = nullptr;
	Super::Shutdown();
}
