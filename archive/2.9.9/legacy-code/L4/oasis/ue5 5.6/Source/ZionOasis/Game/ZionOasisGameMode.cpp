// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "ZionOasis/Game/ZionOasisGameMode.h"
#include "ZionOasis/Game/ZionGameInstance.h"
#include "ZionOasis/Player/ZionPlayerController.h"
#include "ZionOasis/Player/ZionCharacter.h"
#include "ZionOasis/Consciousness/ConsciousnessComponent.h"
#include "ZionOasis/Blockchain/ZionBlockchainBridge.h"
#include "GameFramework/PlayerState.h"
#include "Kismet/GameplayStatics.h"
#include "Engine/World.h"

AZionOasisGameMode::AZionOasisGameMode()
{
	MaxPlayersPerRealm = 10000;
}

void AZionOasisGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);

	UE_LOG(LogTemp, Log, TEXT("[ZionOasisGameMode] InitGame — map: %s, options: %s"), *MapName, *Options);

	// Trigger health-check ping to the Rust backend
	if (UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld()))
	{
		FZionHttpCallback Callback;
		Bridge->HealthCheck(Callback);
	}
}

APlayerController* AZionOasisGameMode::Login(UPlayer* NewPlayer, ENetRole InRemoteRole,
	const FString& Portal, const FString& Options, const FUniqueNetIdRepl& UniqueId,
	FString& ErrorMessage)
{
	// Extract wallet address from URL options: ?wallet=0x...
	const FString Wallet = UGameplayStatics::ParseOption(Options, TEXT("wallet"));
	if (!Wallet.IsEmpty())
	{
		UE_LOG(LogTemp, Log, TEXT("[ZionOasisGameMode] Login — wallet: %s"), *Wallet);
	}

	return Super::Login(NewPlayer, InRemoteRole, Portal, Options, UniqueId, ErrorMessage);
}

void AZionOasisGameMode::OnPlayerWalletLogin(APlayerController* PC, const FString& Wallet)
{
	UE_LOG(LogTemp, Log, TEXT("[ZionOasisGameMode] Player wallet login: %s"), *Wallet);
}

void AZionOasisGameMode::BroadcastBlockMined(const FString& MinerWallet, int32 BlockHeight)
{
	UE_LOG(LogTemp, Log, TEXT("[ZionOasisGameMode] Block #%d mined by %s — broadcasting XP"),
		BlockHeight, *MinerWallet);

	for (FConstPlayerControllerIterator It = GetWorld()->GetPlayerControllerIterator(); It; ++It)
	{
		AZionPlayerController* PC = Cast<AZionPlayerController>(It->Get());
		if (!PC) continue;

		AZionCharacter* ZionChar = PC->GetZionCharacter();
		if (!ZionChar) continue;

		if (MinerWallet.IsEmpty() || ZionChar->WalletAddress == MinerWallet)
		{
			if (ZionChar->ConsciousnessComp)
			{
				ZionChar->ConsciousnessComp->AwardXp(EXpSource::BlockMined, 100);
			}
		}
	}
}
