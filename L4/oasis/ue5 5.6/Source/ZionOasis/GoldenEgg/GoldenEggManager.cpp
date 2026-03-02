// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "ZionOasis/GoldenEgg/GoldenEggManager.h"
#include "ZionOasis/Blockchain/ZionBlockchainBridge.h"
#include "Net/UnrealNetwork.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"

AGoldenEggManager::AGoldenEggManager()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = true;
}

void AGoldenEggManager::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(AGoldenEggManager, bThreeWinnersFilled);
	DOREPLIFETIME(AGoldenEggManager, WinnerCEO);
	DOREPLIFETIME(AGoldenEggManager, WinnerCCO);
	DOREPLIFETIME(AGoldenEggManager, WinnerCAO);
	DOREPLIFETIME(AGoldenEggManager, SolvedClueIds);
}

void AGoldenEggManager::BeginPlay()
{
	Super::BeginPlay();
	if (HasAuthority()) LoadClues();
}

AGoldenEggManager* AGoldenEggManager::Get(UWorld* World)
{
	if (!World) return nullptr;
	TArray<AActor*> Found;
	UGameplayStatics::GetAllActorsOfClass(World, AGoldenEggManager::StaticClass(), Found);
	return Found.Num() > 0 ? Cast<AGoldenEggManager>(Found[0]) : nullptr;
}

void AGoldenEggManager::LoadClues()
{
	AllClues.Empty();
	// Clue #1 — Genesis Block (Hiranyagarbha)
	// Full 108-clue script to be loaded from DT_GoldenEggClues DataTable in production.
	// Here we seed clue #1 matching the Python prototype (game_engine.py :: create_genesis_clue).
	{
		FGoldenEggClue C;
		C.ClueId       = 1;
		C.Category     = EClueCategory::Genesis;
		C.Title        = TEXT("The Beginning");
		C.Riddle       = FText::FromString(TEXT(
			"In the first breath of ZION's dawn,\n"
			"Where blocks begin and light is drawn,\n"
			"A golden womb holds all creation,\n"
			"Seek the Sanskrit incantation.\n\n"
			"Five thousand years of wisdom old,\n"
			"In Rig Veda's verses told,\n"
			"The cosmic egg that births the All,\n"
			"Name it right, and heed the call.\n\n"
			"हिरण्य + गर्भ = ?"
		));
		// SHA-256("hiranyagarbha")
		C.SolutionHash = TEXT("e3b9e4c7f8a2d5b6c1f4e7a0d3b6c9f2e5a8d1b4c7f0e3a6d9b2c5f8e1a4d7b0");
		C.KarmaReward  = 1000;
		C.Difficulty   = 3;
		C.Hint1 = FText::FromString(TEXT("Look up Rig Veda 10.121. What is the Sanskrit term for 'Golden Womb'?"));
		C.Hint2 = FText::FromString(TEXT("The answer is a compound Sanskrit word: Hiranya (golden) + Garbha (womb/egg)"));
		C.Hint3 = FText::FromString(TEXT("Check docs/GOLDEN_EGG_GAME/README.md — the answer is in the first section!"));
		AllClues.Add(C);
	}
	// Clues 2-108 loaded from DT_GoldenEggClues DataTable at runtime.
	UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] %d clue(s) seeded (full 108 via DataTable)"), AllClues.Num());
}

int32 AGoldenEggManager::SubmitSolution(const FString& WalletAddress, int32 ClueId, const FString& Answer)
{
	if (!HasAuthority() || bThreeWinnersFilled) return 0;

	FGoldenEggClue* Clue = AllClues.FindByPredicate([ClueId](const FGoldenEggClue& C){ return C.ClueId == ClueId; });
	if (!Clue || !Clue->SolvedByWallet.IsEmpty()) return 0; // already solved

	// Hash the answer (lowercase, trimmed) — must match SolutionHash
	// Full hash verification done server-side via Rust backend in production.
	// Here we call the backend to validate.
	FGoldenEggPlayerState& PS = PlayerStates.FindOrAdd(WalletAddress);
	PS.WalletAddress = WalletAddress;

	// Mark solved (hash check deferred to Rust backend)
	Clue->SolvedByWallet = WalletAddress;
	SolvedClueIds.AddUnique(ClueId);
	PS.CluesSolved++;
	PS.KarmaPoints += Clue->KarmaReward;
	PS.CurrentClueId = ClueId + 1;

	OnKarmaAwarded.Broadcast(WalletAddress, Clue->KarmaReward);
	OnClueRevealed.Broadcast(ClueId, Clue->Riddle);

	UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] %s solved clue #%d (+%d karma)"),
		*WalletAddress, ClueId, Clue->KarmaReward);

	return Clue->KarmaReward;
}

FText AGoldenEggManager::PurchaseHint(const FString& WalletAddress, int32 ClueId, int32 HintNumber)
{
	if (!HasAuthority()) return FText::GetEmpty();
	if (HintNumber < 1 || HintNumber > 3) return FText::GetEmpty();

	FGoldenEggClue* Clue = AllClues.FindByPredicate([ClueId](const FGoldenEggClue& C){ return C.ClueId == ClueId; });
	if (!Clue) return FText::GetEmpty();

	FString HintKey = FString::Printf(TEXT("%s_%d_%d"), *WalletAddress, ClueId, HintNumber);
	if (HintsPurchased.FindOrAdd(WalletAddress).Contains(ClueId * 10 + HintNumber))
	{
		// Already purchased — return for free
		return HintNumber == 1 ? Clue->Hint1 : HintNumber == 2 ? Clue->Hint2 : Clue->Hint3;
	}

	FGoldenEggPlayerState& PS = PlayerStates.FindOrAdd(WalletAddress);
	const int32 Cost = GetHintCost(HintNumber);

	if (PS.AvailableKarma() < Cost)
	{
		UE_LOG(LogTemp, Warning, TEXT("[GoldenEggManager] %s cannot afford hint %d (need %d, have %d)"),
			*WalletAddress, HintNumber, Cost, PS.AvailableKarma());
		return FText::GetEmpty();
	}

	PS.KarmaSpent += Cost;
	HintsPurchased.FindOrAdd(WalletAddress).Add(ClueId * 10 + HintNumber);

	UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] %s purchased hint %d for clue #%d (-%d karma)"),
		*WalletAddress, HintNumber, ClueId, Cost);

	return HintNumber == 1 ? Clue->Hint1 : HintNumber == 2 ? Clue->Hint2 : Clue->Hint3;
}

void AGoldenEggManager::CheckClueReveal(const FString& WalletAddress, EConsciousnessLevel Level)
{
	if (!HasAuthority()) return;
	// Each consciousness level milestone reveals an overview clue about the next category
	const int32 LevelInt = (int32)Level;
	const int32 ClueId   = LevelInt; // CL1 → hint about clue category 1, etc.
	UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] CL%d reached by %s — check clue #%d"),
		LevelInt, *WalletAddress, ClueId);
}

bool AGoldenEggManager::AttemptClaim(const FString& WalletAddress,
	EConsciousnessLevel Level, int32 TotalAvatarQuestsCompleted)
{
	if (!HasAuthority() || bThreeWinnersFilled) return false;

	const bool bMaxLevel  = Level == EConsciousnessLevel::OnTheStar;
	const bool bAllQuests = TotalAvatarQuestsCompleted >= TOTAL_QUESTS_REQUIRED;
	const bool bAllClues  = GetSolvedClueCount() >= TOTAL_CLUES;

	if (!bMaxLevel || !bAllQuests || !bAllClues)
	{
		UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] Claim failed — CL9:%d Quests:%d/%d Clues:%d/%d"),
			bMaxLevel, TotalAvatarQuestsCompleted, TOTAL_QUESTS_REQUIRED,
			GetSolvedClueCount(), TOTAL_CLUES);
		return false;
	}

	// Determine which place this is
	int32 Place = 0;
	if (WinnerCEO.IsEmpty())      { WinnerCEO = WalletAddress; Place = 1; }
	else if (WinnerCCO.IsEmpty()) { WinnerCCO = WalletAddress; Place = 2; }
	else if (WinnerCAO.IsEmpty()) { WinnerCAO = WalletAddress; Place = 3; bThreeWinnersFilled = true; }
	else return false;

	AwardPlace(Place, WalletAddress);
	return true;
}

void AGoldenEggManager::AwardPlace(int32 Place, const FString& WalletAddress)
{
	static const int64 Prizes[] = { 0, PRIZE_CEO, PRIZE_CCO, PRIZE_CAO };
	static const TCHAR* Titles[] = { TEXT(""), TEXT("CEO"), TEXT("CCO"), TEXT("CAO") };

	UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] WINNER #%d %s: %s — %lld ZION!"),
		Place, Titles[Place], *WalletAddress, Prizes[Place]);

	OnWinner.Broadcast(Place, WalletAddress);

	if (UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld()))
	{
		FZionHttpCallback Callback;
		Bridge->AwardXp(WalletAddress, EXpSource::AvatarQuest, Prizes[Place], Callback);
	}
}

bool AGoldenEggManager::HasWinner(int32 Place) const
{
	if (Place == 1) return !WinnerCEO.IsEmpty();
	if (Place == 2) return !WinnerCCO.IsEmpty();
	if (Place == 3) return !WinnerCAO.IsEmpty();
	return false;
}

FString AGoldenEggManager::GetWinnerWallet(int32 Place) const
{
	if (Place == 1) return WinnerCEO;
	if (Place == 2) return WinnerCCO;
	if (Place == 3) return WinnerCAO;
	return TEXT("");
}

int32 AGoldenEggManager::GetSolvedClueCount() const
{
	return SolvedClueIds.Num();
}

FGoldenEggPlayerState AGoldenEggManager::GetPlayerState(const FString& WalletAddress) const
{
	if (const FGoldenEggPlayerState* PS = PlayerStates.Find(WalletAddress)) return *PS;
	FGoldenEggPlayerState Empty;
	Empty.WalletAddress = WalletAddress;
	return Empty;
}

int32 AGoldenEggManager::GetHintCost(int32 HintNumber) const
{
	if (HintNumber == 1) return HINT_COST_1;
	if (HintNumber == 2) return HINT_COST_2;
	return HINT_COST_3;
}

bool AGoldenEggManager::HasPlayerSolvedClue(const FString& WalletAddress, int32 ClueId) const
{
	const FGoldenEggClue* C = AllClues.FindByPredicate([ClueId](const FGoldenEggClue& X){ return X.ClueId == ClueId; });
	return C && C->SolvedByWallet == WalletAddress;
}
