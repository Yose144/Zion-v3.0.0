// Copyright 2026 ZION TerraNova. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Consciousness/ConsciousnessTypes.h"
#include "GoldenEggManager.generated.h"

/**
 * 8 thematic categories of the 108-clue treasure hunt.
 * Mirrors golden_egg/game_engine.py :: ClueCategory
 */
UENUM(BlueprintType)
enum class EClueCategory : uint8
{
	Genesis        UMETA(DisplayName="Genesis Block"),
	SacredTrinity  UMETA(DisplayName="Sacred Trinity (51 Avatars)"),
	VedicWisdom    UMETA(DisplayName="Vedic Wisdom (Vedas/Upanishads)"),
	Epics          UMETA(DisplayName="Epics (Ramayana/Mahabharata)"),
	Ekam           UMETA(DisplayName="Ekam Temple (Pilgrimage)"),
	Consciousness  UMETA(DisplayName="9 Consciousness Levels"),
	Economics      UMETA(DisplayName="ZION Economics/Blockchain"),
	Final          UMETA(DisplayName="Final Master Key"),
};

USTRUCT(BlueprintType)
struct ZIONOASIS_API FGoldenEggClue
{
	GENERATED_BODY()

	/** Clue number 1-108 (108 = full mala) */
	UPROPERTY(BlueprintReadOnly) int32 ClueId = 0;
	UPROPERTY(BlueprintReadOnly) EClueCategory Category = EClueCategory::Genesis;
	UPROPERTY(BlueprintReadOnly) FString Title;
	UPROPERTY(BlueprintReadOnly) FText   Riddle;
	/** SHA-256 hash of the correct answer (lowercase, trimmed) */
	UPROPERTY(BlueprintReadOnly) FString SolutionHash;
	/** Karma reward for solving */
	UPROPERTY(BlueprintReadOnly) int32   KarmaReward = 1000;
	/** Difficulty 1-10 */
	UPROPERTY(BlueprintReadOnly) int32   Difficulty  = 5;
	/** Wallet that first solved it (empty = unsolved) */
	UPROPERTY(BlueprintReadOnly) FString SolvedByWallet;

	// Three tiered hints (cost karma to reveal)
	UPROPERTY(BlueprintReadOnly) FText Hint1;
	UPROPERTY(BlueprintReadOnly) FText Hint2;
	UPROPERTY(BlueprintReadOnly) FText Hint3;
};

/** Per-player karma & progress tracked server-side */
USTRUCT(BlueprintType)
struct ZIONOASIS_API FGoldenEggPlayerState
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly) FString WalletAddress;
	UPROPERTY(BlueprintReadOnly) int32   CluesSolved   = 0;
	UPROPERTY(BlueprintReadOnly) int32   KarmaPoints   = 0;  // earned
	UPROPERTY(BlueprintReadOnly) int32   KarmaSpent    = 0;  // on hints
	UPROPERTY(BlueprintReadOnly) int32   CurrentClueId = 1;

	int32 AvailableKarma() const { return KarmaPoints - KarmaSpent; }
};

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnGoldenEggWinner,
	int32, Place, const FString&, WalletAddress);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnGoldenEggClueRevealed,
	int32, ClueId, FText, ClueText);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnKarmaAwarded,
	const FString&, WalletAddress, int32, KarmaAmount);

/**
 * GoldenEggManager — Brahmanda (हिरण्यगर्भ) Treasure Hunt
 *
 * 108 clues (sacred mala number), 3 winners:
 *   1st  CEO — 1 000 000 000 ZION  (+15% DAO voting)
 *   2nd  CCO —   500 000 000 ZION  (+10% DAO voting)
 *   3rd  CAO —   250 000 000 ZION  (+ 5% DAO voting)
 *   Total prize pool: 1 750 000 000 ZION
 *
 * Clue categories: Genesis, SacredTrinity, VedicWisdom, Epics,
 *                  Ekam, Consciousness, Economics, Final
 * Karma system: earned by solving clues, spent on hints (100/500/1000 karma)
 * Requirements: CL9 (OnTheStar) + all 255 avatar quests (51×5)
 *
 * Based on golden_egg/game_engine.py — Python prototype (2.9-History)
 */
UCLASS(BlueprintType, meta=(DisplayName="Golden Egg Manager"))
class ZIONOASIS_API AGoldenEggManager : public AActor
{
	GENERATED_BODY()

public:
	AGoldenEggManager();
	virtual void BeginPlay() override;
	virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;

	static AGoldenEggManager* Get(UWorld* World);

	// ──────────────────────────────────────────────
	// Events
	// ──────────────────────────────────────────────
	UPROPERTY(BlueprintAssignable, Category = "GoldenEgg|Events")
	FOnGoldenEggWinner OnWinner;

	UPROPERTY(BlueprintAssignable, Category = "GoldenEgg|Events")
	FOnGoldenEggClueRevealed OnClueRevealed;

	UPROPERTY(BlueprintAssignable, Category = "GoldenEgg|Events")
	FOnKarmaAwarded OnKarmaAwarded;

	// ──────────────────────────────────────────────
	// Query
	// ──────────────────────────────────────────────
	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	bool IsHuntActive() const { return !bThreeWinnersFilled; }

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	bool HasWinner(int32 Place) const;   // 1/2/3

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	FString GetWinnerWallet(int32 Place) const;

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	int32 GetTotalClues() const { return TOTAL_CLUES; }

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	int32 GetSolvedClueCount() const;

	// ──────────────────────────────────────────────
	// Gameplay — server-authoritative
	// ──────────────────────────────────────────────

	/** Submit a solution attempt. Returns karma earned (0 = wrong). */
	UFUNCTION(BlueprintCallable, Category = "GoldenEgg")
	int32 SubmitSolution(const FString& WalletAddress, int32 ClueId, const FString& Answer);

	/** Purchase a hint (1/2/3) using karma. Returns hint text or empty on fail. */
	UFUNCTION(BlueprintCallable, Category = "GoldenEgg")
	FText PurchaseHint(const FString& WalletAddress, int32 ClueId, int32 HintNumber);

	/** Called on level-up — may reveal a progressive clue. */
	UFUNCTION(BlueprintCallable, Category = "GoldenEgg")
	void CheckClueReveal(const FString& WalletAddress, EConsciousnessLevel Level);

	/** Final claim attempt — requires CL9 + 255 quests + clue 108 solved. */
	UFUNCTION(BlueprintCallable, Category = "GoldenEgg")
	bool AttemptClaim(const FString& WalletAddress,
					  EConsciousnessLevel Level,
					  int32 TotalAvatarQuestsCompleted);

	UFUNCTION(BlueprintPure, Category = "GoldenEgg")
	FGoldenEggPlayerState GetPlayerState(const FString& WalletAddress) const;

private:
	// Prize config
	static constexpr int32 TOTAL_CLUES           = 108;
	static constexpr int32 TOTAL_QUESTS_REQUIRED = 255;      // 51 avatars × 5 quests
	static constexpr int64 PRIZE_CEO = 1'000'000'000LL;      // 1st place
	static constexpr int64 PRIZE_CCO =   500'000'000LL;      // 2nd place
	static constexpr int64 PRIZE_CAO =   250'000'000LL;      // 3rd place
	static constexpr int64 TOTAL_PRIZE_POOL = PRIZE_CEO + PRIZE_CCO + PRIZE_CAO;

	// Karma costs per hint level
	static constexpr int32 HINT_COST_1 = 100;
	static constexpr int32 HINT_COST_2 = 500;
	static constexpr int32 HINT_COST_3 = 1000;

	// Replicated state
	UPROPERTY(Replicated) bool bThreeWinnersFilled = false;
	UPROPERTY(Replicated) FString WinnerCEO; // 1st
	UPROPERTY(Replicated) FString WinnerCCO; // 2nd
	UPROPERTY(Replicated) FString WinnerCAO; // 3rd
	UPROPERTY(Replicated) TArray<int32> SolvedClueIds;

	// Local server data
	TArray<FGoldenEggClue>                      AllClues;     // 108 clues
	TMap<FString, FGoldenEggPlayerState>        PlayerStates; // wallet → state
	TMap<FString, TSet<int32>>                  HintsPurchased; // wallet → clue+hint combos

	void LoadClues();
	void AwardPlace(int32 Place, const FString& WalletAddress);
	bool HasPlayerSolvedClue(const FString& WalletAddress, int32 ClueId) const;
	int32 GetHintCost(int32 HintNumber) const;
};
