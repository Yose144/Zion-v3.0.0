// Copyright 2026 ZION TerraNova. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "UObject/NoExportTypes.h"
#include "Http.h"
#include "Consciousness/ConsciousnessTypes.h"
#include "Avatar/AvatarTypes.h"
#include "ZionBlockchainBridge.generated.h"

/** Generic async callback */
DECLARE_DYNAMIC_DELEGATE_TwoParams(FZionHttpCallback, const FString&, JsonBody, bool, bSuccess);

/**
 * ZionBlockchainBridge
 *
 * HTTP client to the zion-oasis Rust REST API (port 8094).
 * Also interfaces with zion-core JSON-RPC (port 8444) for wallet lookups.
 *
 * Usage: UZionBlockchainBridge::Get(World)->GetPlayer("zion1...", Callback);
 *
 * Singleton — one per GameInstance, accessible globally via Get().
 */
UCLASS(BlueprintType, Transient, meta=(DisplayName="ZION Blockchain Bridge"))
class ZIONOASIS_API UZionBlockchainBridge : public UObject
{
	GENERATED_BODY()

public:
	/** Initialize with config (called from ZionGameInstance) */
	void Initialize(const FString& OasisApiHost, const FString& ChainRpcHost);

	/** Global accessor — returns nullptr if not initialized */
	static UZionBlockchainBridge* Get(UWorld* World);

	// === Oasis REST API (Port 8094) ===

	/** GET /api/v1/oasis/player/:address */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void GetPlayer(const FString& WalletAddress, FZionHttpCallback Callback);

	/** POST /api/v1/oasis/player/:address/xp  { source, amount } */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void AwardXp(const FString& WalletAddress, EXpSource Source, int64 Amount,
				 FZionHttpCallback Callback);

	/** GET /api/v1/oasis/leaderboard */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void GetLeaderboard(FZionHttpCallback Callback);

	/** POST /api/v1/oasis/guild  { name, founder } */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void CreateGuild(const FString& GuildName, const FString& FounderWallet,
					 FZionHttpCallback Callback);

	/** GET /api/v1/oasis/guild/:id */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void GetGuild(const FString& GuildId, FZionHttpCallback Callback);

	/** POST /api/v1/oasis/guild/:id/join  { address } */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void JoinGuild(const FString& GuildId, const FString& WalletAddress,
				   FZionHttpCallback Callback);

	/** GET /api/v1/oasis/map */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void GetTerritoryMap(FZionHttpCallback Callback);

	/** GET /api/v1/oasis/rewards/pools */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void GetRewardPools(FZionHttpCallback Callback);

	/** GET /health — check if backend is alive */
	UFUNCTION(BlueprintCallable, Category = "ZION|Blockchain")
	void HealthCheck(FZionHttpCallback Callback);

	// === Chain RPC (Port 8444) ===

	/** Verify wallet address exists on L1 chain */
	UFUNCTION(BlueprintCallable, Category = "ZION|Chain")
	void VerifyWalletAddress(const FString& WalletAddress, FZionHttpCallback Callback);

	/** Get ZION balance for an address */
	UFUNCTION(BlueprintCallable, Category = "ZION|Chain")
	void GetBalance(const FString& WalletAddress, FZionHttpCallback Callback);

private:
	FString OasisBaseUrl;   // e.g. http://localhost:8094
	FString ChainRpcUrl;    // e.g. http://localhost:8444

	void SendGet(const FString& Url, FZionHttpCallback Callback);
	void SendPost(const FString& Url, const FString& JsonBody, FZionHttpCallback Callback);

	static FString XpSourceToString(EXpSource Source);
};
