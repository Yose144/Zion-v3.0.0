// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "Guild/GuildComponent.h"
#include "Blockchain/ZionBlockchainBridge.h"
#include "Net/UnrealNetwork.h"
#include "Engine/World.h"

UGuildComponent::UGuildComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SetIsReplicatedByDefault(true);
}

void UGuildComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(UGuildComponent, CurrentGuildId);
	DOREPLIFETIME(UGuildComponent, CachedGuild);
}

void UGuildComponent::JoinGuild(const FString& GuildId, const FString& WalletAddress)
{
	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	Bridge->JoinGuild(GuildId, WalletAddress, [this, GuildId](bool bSuccess, const FString& Json)
	{
		if (bSuccess)
		{
			CurrentGuildId = GuildId;
			OnGuildJoined.Broadcast(GuildId);
			RefreshGuildData(GuildId);
			UE_LOG(LogTemp, Log, TEXT("[GuildComponent] Joined guild: %s"), *GuildId);
		}
		else
		{
			UE_LOG(LogTemp, Warning, TEXT("[GuildComponent] JoinGuild failed for %s"), *GuildId);
		}
	});
}

void UGuildComponent::CreateGuild(const FString& GuildName, EGuildOrder Order, const FString& FounderWallet)
{
	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	Bridge->CreateGuild(GuildName, FounderWallet, [this](bool bSuccess, const FString& Json)
	{
		if (!bSuccess)
		{
			UE_LOG(LogTemp, Warning, TEXT("[GuildComponent] CreateGuild failed"));
			return;
		}

		// Parse returned guild ID from JSON
		TSharedPtr<FJsonObject> Obj;
		TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
		if (FJsonSerializer::Deserialize(Reader, Obj) && Obj.IsValid())
		{
			const FString NewId = Obj->GetStringField(TEXT("guild_id"));
			CurrentGuildId = NewId;
			OnGuildJoined.Broadcast(NewId);
			RefreshGuildData(NewId);
			UE_LOG(LogTemp, Log, TEXT("[GuildComponent] Created guild: %s"), *NewId);
		}
	});
}

void UGuildComponent::LeaveGuild()
{
	const FString OldId = CurrentGuildId;
	CurrentGuildId = TEXT("");
	CachedGuild = FGuildData{};
	OnGuildLeft.Broadcast(OldId);
	UE_LOG(LogTemp, Log, TEXT("[GuildComponent] Left guild: %s"), *OldId);
}

void UGuildComponent::RefreshGuildData(const FString& GuildId)
{
	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	Bridge->GetGuild(GuildId, [this](bool bSuccess, const FString& Json)
	{
		if (!bSuccess) return;

		TSharedPtr<FJsonObject> Obj;
		TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
		if (!FJsonSerializer::Deserialize(Reader, Obj) || !Obj.IsValid()) return;

		CachedGuild.GuildId   = Obj->GetStringField(TEXT("guild_id"));
		CachedGuild.GuildName = Obj->GetStringField(TEXT("name"));
		CachedGuild.GuildXp   = (int64)Obj->GetNumberField(TEXT("guild_xp"));
		CachedGuild.GuildLevel= (int32)Obj->GetNumberField(TEXT("guild_level"));

		OnGuildUpdated.Broadcast(CachedGuild);
	});
}
