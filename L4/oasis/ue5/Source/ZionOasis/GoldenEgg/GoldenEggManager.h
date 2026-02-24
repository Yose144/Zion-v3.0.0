// Copyright 2026 ZION TerraNova. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Consciousness/ConsciousnessTypes.h"
#include "GoldenEggManager.generated.h"

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnGoldenEggFound, const FString&, WinnerWallet);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnGoldenEggClueRevealed,
	int32, ClueIndex, FText, ClueText);

/**
 * GoldenEggManager
 *
 * Global singleton managing the legendary hunt for the Brahmanda (Golden Cosmic Egg).
 * Prize: 1,000,000,000 ZION (~$10B @ $10/ZION)
 *
 * The prize is drawn from the GoldenEgg RewardSlot in zion-oasis.
 * Clues are revealed sequentially as players reach consciousness milestones.
 * Requires ALL 51 avatar quests completed + OnTheStar (9) level.
 *
 * Inspired by GOLDEN_EGG_GAME/GAME_DESIGN_GOLDEN_EGG.md
 */
UCLASS(BlueprintType, meta=(DisplayName="Golden Egg Manager"))
class ZIONOASIS_API AGoldenEggManager : public AActor
{
	GENERATED_BODY()

public:
	AGoldenEggManager();
	virtual void BeginPlay() override;

	static AGoldenEggManager* Get(UWorld* World);

	// === Events ===
	UPROPERTY(BlueprintAssignable, Category = "GoldenEgg|Events")
	FOnGoldenEggFound OnGoldenEggFound;

	UPROPERTY(BlueprintAssignable, Category = "GoldenEgg|Events")
	FOnGoldenEggClueRevealed OnClueRevealed;

	// === State ===
	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	bool IsActive() const { return bHuntActive; }

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	bool IsFound() const { return bEggFound; }

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	FString GetWinner() const { return WinnerWallet; }

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	int32 GetRevealedCluesCount() const { return RevealedClues.Num(); }

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	TArray<FText> GetRevealedClues() const { return RevealedClues; }

	// === Actions ===
	/**
	 * Check if player qualifies for a new clue reveal.
	 * Called on every consciousness level-up.
	 */
	UFUNCTION(BlueprintCallable, Category = "GoldenEgg")
	void CheckClueReveal(const FString& WalletAddress,
						 EConsciousnessLevel Level,
						 int32 AvatarQuestsCompleted);

	/**
	 * Attempt to claim the Golden Egg.
	 * Requirements: CL9 (OnTheStar) + all 51 avatar quests.
	 */
	UFUNCTION(BlueprintCallable, Category = "GoldenEgg")
	bool AttemptClaim(const FString& WalletAddress,
					  EConsciousnessLevel Level,
					  int32 TotalAvatarQuestsCompleted);

private:
	UPROPERTY(ReplicatedUsing=OnRep_EggFound)
	bool bEggFound = false;

	UPROPERTY(Replicated)
	bool bHuntActive = true;

	UPROPERTY(Replicated)
	FString WinnerWallet;

	UPROPERTY(Replicated)
	TArray<FText> RevealedClues;

	UFUNCTION()
	void OnRep_EggFound();

	// 9 clues — one per consciousness level, loaded from Data Table
	TArray<FText> AllClues;
	void LoadCluesFromDataTable();

	// Total avatar quests needed (51 avatars × 5 quests each)
	static constexpr int32 TOTAL_QUESTS_REQUIRED = 255;
	static constexpr int64 PRIZE_ZION = 1'000'000'000LL;
};
