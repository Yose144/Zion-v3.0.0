// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "GoldenEgg/GoldenEggManager.h"
#include "Blockchain/ZionBlockchainBridge.h"
#include "Consciousness/ConsciousnessComponent.h"
#include "Player/ZionCharacter.h"
#include "Net/UnrealNetwork.h"
#include "Engine/World.h"

AGoldenEggManager::AGoldenEggManager()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = true;
	bEggFound   = false;
}

void AGoldenEggManager::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(AGoldenEggManager, bEggFound);
	DOREPLIFETIME(AGoldenEggManager, WinnerWallet);
	DOREPLIFETIME(AGoldenEggManager, RevealedClues);
}

void AGoldenEggManager::BeginPlay()
{
	Super::BeginPlay();

	// Populate the 9 progressive clues (one revealed per consciousness level)
	Clues.Empty();
	Clues.Add(TEXT("The egg lies where consciousness was first ignited — seek the source of light."));
	Clues.Add(TEXT("Wisdom guards the gate; only those who have walked all seven rays may pass."));
	Clues.Add(TEXT("In love's vibration the path bends — the Heart Brotherhood knows the coordinate."));
	Clues.Add(TEXT("Purity reflects purity: look upon the crystal mirror at the World's axis."));
	Clues.Add(TEXT("The healer's circle holds the key; the emerald flame marks the crossing point."));
	Clues.Add(TEXT("Service is the cipher — translate the Violet decree into sacred geometry."));
	Clues.Add(TEXT("Seven rays converge once at a single node after the dawn of the new age."));
	Clues.Add(TEXT("All masters leave one final clue encoded in the Brahmanda frequency — 432 Hz."));
	Clues.Add(TEXT("The egg is YOU — Consciousness Level 9. Return to Mount Zion at first light."));
}

void AGoldenEggManager::CheckClueReveal(UConsciousnessComponent* ConsComp)
{
	if (!ConsComp || !HasAuthority()) return;

	const int32 Level = (int32)ConsComp->CurrentLevel; // 1-9
	// Each consciousness level (1-9) unlocks the clue at that index
	const int32 UnlockIndex = Level - 1;

	if (UnlockIndex >= 0 && UnlockIndex < Clues.Num() && !RevealedClues.Contains(Clues[UnlockIndex]))
	{
		RevealedClues.Add(Clues[UnlockIndex]);
		UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] Clue %d revealed for CL%d"), UnlockIndex + 1, Level);
	}
}

bool AGoldenEggManager::AttemptClaim(AZionCharacter* Claimant)
{
	if (!Claimant || !HasAuthority()) return false;
	if (bEggFound) return false; // Already found

	UConsciousnessComponent* CC = Claimant->ConsciousnessComp;
	if (!CC) return false;

	// Requirements: Consciousness Level 9 + all 255 avatar quests
	const bool bMaxLevel  = CC->CurrentLevel == EConsciousnessLevel::OnTheStar;
	const bool bAllQuests = Claimant->TotalAvatarQuestsCompleted >= TOTAL_QUESTS_REQUIRED;

	if (!bMaxLevel || !bAllQuests)
	{
		UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] Claim failed — CL9:%d  Quests:%d/%d"),
			bMaxLevel, Claimant->TotalAvatarQuestsCompleted, TOTAL_QUESTS_REQUIRED);
		return false;
	}

	// Award the Golden Egg
	bEggFound    = true;
	WinnerWallet = Claimant->WalletAddress;

	UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] GOLDEN EGG FOUND by %s — 1,000,000,000 ZION awarded!"),
		*WinnerWallet);

	// Notify the blockchain backend so the prize transfer is initiated
	if (UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld()))
	{
		Bridge->AwardXp(WinnerWallet, TEXT("golden_egg_claim"), PRIZE_ZION,
			[](bool bOk, const FString& Json)
			{
				if (bOk)
					UE_LOG(LogTemp, Log, TEXT("[GoldenEggManager] Prize notification sent to backend"))
				else
					UE_LOG(LogTemp, Error, TEXT("[GoldenEggManager] Prize notification FAILED — manual payout required"));
			});
	}

	return true;
}
