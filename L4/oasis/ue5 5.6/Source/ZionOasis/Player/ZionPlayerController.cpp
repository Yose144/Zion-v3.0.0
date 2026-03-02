// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "ZionOasis/Player/ZionPlayerController.h"
#include "ZionOasis/Player/ZionCharacter.h"
#include "ZionOasis/Blockchain/ZionBlockchainBridge.h"
#include "ZionOasis/Consciousness/ConsciousnessComponent.h"
#include "ZionOasis/Game/ZionGameInstance.h"
#include "Net/UnrealNetwork.h"
#include "Engine/World.h"

void AZionPlayerController::BeginPlay()
{
	Super::BeginPlay();
}

void AZionPlayerController::OnPossess(APawn* InPawn)
{
	Super::OnPossess(InPawn);
}

void AZionPlayerController::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(AZionPlayerController, ConnectedWallet);
}

AZionCharacter* AZionPlayerController::GetZionCharacter() const
{
	return Cast<AZionCharacter>(GetPawn());
}

void AZionPlayerController::ConnectWallet(const FString& WalletAddress)
{
	if (WalletAddress.IsEmpty()) return;

	ConnectedWallet = WalletAddress;

	// Persist in GameInstance
	if (UZionGameInstance* GI = GetGameInstance<UZionGameInstance>())
	{
		GI->ActiveWallet = WalletAddress;
	}

	OnWalletConnected.Broadcast(WalletAddress);
	SyncPlayerFromBackend();

	UE_LOG(LogTemp, Log, TEXT("[ZionPlayerController] Wallet connected: %s"), *WalletAddress);
}

void AZionPlayerController::DisconnectWallet()
{
	ConnectedWallet = TEXT("");

	if (UZionGameInstance* GI = GetGameInstance<UZionGameInstance>())
	{
		GI->ActiveWallet = TEXT("");
	}

	OnWalletDisconnected.Broadcast();
	UE_LOG(LogTemp, Log, TEXT("[ZionPlayerController] Wallet disconnected"));
}

void AZionPlayerController::ServerInteract_Implementation()
{
	AZionCharacter* ZionChar = Cast<AZionCharacter>(GetPawn());
	if (!ZionChar) return;

	// Line-trace forward from camera
	FVector Start;
	FRotator ViewRot;
	GetPlayerViewPoint(Start, ViewRot);
	const FVector Direction = ViewRot.Vector();

	FHitResult Hit;
	FCollisionQueryParams Params;
	Params.AddIgnoredActor(ZionChar);

	const bool bHit = GetWorld()->LineTraceSingleByChannel(
		Hit, Start, Start + Direction * 500.0f, ECC_Visibility, Params);

	if (bHit && Hit.GetActor())
	{
		UE_LOG(LogTemp, Log, TEXT("[ZionPlayerController] Interact hit: %s"), *Hit.GetActor()->GetName());
	}
}

void AZionPlayerController::OpenAvatarQuestUI(EAvatarID AvatarID)
{
	// Actual widget push handled in BP_ZionPlayerController
	UE_LOG(LogTemp, Log, TEXT("[ZionPlayerController] Opening quest UI for avatar %d"), (int32)AvatarID);
}

void AZionPlayerController::SyncPlayerFromBackend()
{
	if (ConnectedWallet.IsEmpty()) return;

	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	FZionHttpCallback Callback;
	Bridge->GetPlayer(ConnectedWallet, Callback);
}
