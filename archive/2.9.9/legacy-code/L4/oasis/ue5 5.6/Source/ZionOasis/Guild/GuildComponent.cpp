// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "ZionOasis/Guild/GuildComponent.h"
#include "ZionOasis/Blockchain/ZionBlockchainBridge.h"
#include "Net/UnrealNetwork.h"
#include "Engine/World.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"

UGuildComponent::UGuildComponent()
{
	PrimaryComponentTick.bCanEverTick = false;
	SetIsReplicatedByDefault(true);
}

void UGuildComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(UGuildComponent, CurrentGuildId);
}

void UGuildComponent::BeginPlay()
{
	Super::BeginPlay();
}

void UGuildComponent::JoinGuild(const FString& GuildId)
{
	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	// Store the target guild ID before the async call
	CurrentGuildId = GuildId;

	FZionHttpCallback Callback;
	Callback.BindDynamic(this, &UGuildComponent::OnJoinGuildResponse);
	Bridge->JoinGuild(GuildId, TEXT(""), Callback);
}

void UGuildComponent::OnJoinGuildResponse(const FString& JsonBody, bool bSuccess)
{
	if (bSuccess)
	{
		OnGuildJoined.Broadcast(CachedGuild);
		RefreshGuildData();
		UE_LOG(LogTemp, Log, TEXT("[GuildComponent] Joined guild: %s"), *CurrentGuildId);
	}
	else
	{
		CurrentGuildId = TEXT("");
		UE_LOG(LogTemp, Warning, TEXT("[GuildComponent] JoinGuild failed"));
	}
}

void UGuildComponent::CreateGuild(const FString& GuildName, EGuildOrder Order)
{
	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	FZionHttpCallback Callback;
	Callback.BindDynamic(this, &UGuildComponent::OnCreateGuildResponse);
	Bridge->CreateGuild(GuildName, TEXT(""), Callback);
}

void UGuildComponent::OnCreateGuildResponse(const FString& JsonBody, bool bSuccess)
{
	if (!bSuccess)
	{
		UE_LOG(LogTemp, Warning, TEXT("[GuildComponent] CreateGuild failed"));
		return;
	}

	TSharedPtr<FJsonObject> Obj;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonBody);
	if (FJsonSerializer::Deserialize(Reader, Obj) && Obj.IsValid())
	{
		const FString NewId = Obj->GetStringField(TEXT("guild_id"));
		CurrentGuildId = NewId;
		OnGuildJoined.Broadcast(CachedGuild);
		RefreshGuildData();
		UE_LOG(LogTemp, Log, TEXT("[GuildComponent] Created guild: %s"), *NewId);
	}
}

void UGuildComponent::LeaveGuild()
{
	const FString OldId = CurrentGuildId;
	CurrentGuildId = TEXT("");
	CachedGuild = FGuildData{};
	OnGuildLeft.Broadcast();
	UE_LOG(LogTemp, Log, TEXT("[GuildComponent] Left guild: %s"), *OldId);
}

void UGuildComponent::RefreshGuildData()
{
	if (CurrentGuildId.IsEmpty()) return;

	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	FZionHttpCallback Callback;
	Callback.BindDynamic(this, &UGuildComponent::OnRefreshGuildResponse);
	Bridge->GetGuild(CurrentGuildId, Callback);
}

void UGuildComponent::OnRefreshGuildResponse(const FString& JsonBody, bool bSuccess)
{
	if (!bSuccess) return;

	TSharedPtr<FJsonObject> Obj;
	TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonBody);
	if (!FJsonSerializer::Deserialize(Reader, Obj) || !Obj.IsValid()) return;

	CachedGuild.GuildId   = Obj->GetStringField(TEXT("guild_id"));
	CachedGuild.GuildName = Obj->GetStringField(TEXT("name"));
	CachedGuild.GuildXp   = (int64)Obj->GetNumberField(TEXT("guild_xp"));
	CachedGuild.GuildLevel= (int32)Obj->GetNumberField(TEXT("guild_level"));

	OnGuildUpdated.Broadcast(CachedGuild);
}
