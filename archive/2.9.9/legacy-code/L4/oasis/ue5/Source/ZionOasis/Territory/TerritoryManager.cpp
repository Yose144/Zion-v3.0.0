// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "Territory/TerritoryManager.h"
#include "Blockchain/ZionBlockchainBridge.h"
#include "Net/UnrealNetwork.h"
#include "Engine/World.h"

ATerritoryManager::ATerritoryManager()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = true;
}

void ATerritoryManager::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
	Super::GetLifetimeReplicatedProps(OutLifetimeProps);
	DOREPLIFETIME(ATerritoryManager, Territories);
}

void ATerritoryManager::BeginPlay()
{
	Super::BeginPlay();

	if (HasAuthority())
	{
		LoadGenesisMap();
		SyncFromBackend();
	}
}

void ATerritoryManager::LoadGenesisMap()
{
	Territories.Empty();

	auto MakeTerritory = [](const FString& Id, const FString& Name, ETerritoryRegion Region,
		FVector Loc) -> FTerritoryInfo
	{
		FTerritoryInfo T;
		T.TerritoryId    = Id;
		T.Name           = Name;
		T.Region         = Region;
		T.ControllerGuildId = TEXT("");
		T.MiningBonus    = 0.10f;
		T.XpBonus        = 0.05f;
		T.WorldLocation  = Loc;
		return T;
	};

	Territories.Add(MakeTerritory(TEXT("mount-zion"),       TEXT("Mount Zion"),              ETerritoryRegion::Mountains,    FVector(  0,     0, 3000)));
	Territories.Add(MakeTerritory(TEXT("cedar-forest"),     TEXT("Cedar Forest"),            ETerritoryRegion::Forest,       FVector( 50000, 30000, 500)));
	Territories.Add(MakeTerritory(TEXT("negev-desert"),     TEXT("Negev Desert"),            ETerritoryRegion::Desert,       FVector(-60000,-40000, 100)));
	Territories.Add(MakeTerritory(TEXT("dead-sea"),         TEXT("Dead Sea"),                ETerritoryRegion::Ocean,        FVector( 20000,-20000,   0)));
	Territories.Add(MakeTerritory(TEXT("hermon-volcano"),   TEXT("Mount Hermon Volcano"),    ETerritoryRegion::Volcano,      FVector( 80000, 80000, 2800)));
	Territories.Add(MakeTerritory(TEXT("jerusalem-crystal"),TEXT("Jerusalem Crystal Caves"), ETerritoryRegion::CrystalCaves, FVector(  5000,  5000,-1000)));
	Territories.Add(MakeTerritory(TEXT("jordan-valley"),    TEXT("Jordan Valley"),           ETerritoryRegion::Forest,       FVector( 30000,-10000, 200)));
	Territories.Add(MakeTerritory(TEXT("mediterranean"),    TEXT("Mediterranean Shore"),     ETerritoryRegion::Ocean,        FVector(-80000, 10000,   0)));

	UE_LOG(LogTemp, Log, TEXT("[TerritoryManager] Loaded %d genesis territories"), Territories.Num());
}

void ATerritoryManager::SyncFromBackend()
{
	UZionBlockchainBridge* Bridge = UZionBlockchainBridge::Get(GetWorld());
	if (!Bridge) return;

	Bridge->GetTerritoryMap([this](bool bSuccess, const FString& Json)
	{
		if (!bSuccess)
		{
			UE_LOG(LogTemp, Warning, TEXT("[TerritoryManager] SyncFromBackend failed"));
			return;
		}

		// Parse JSON array and update controller guild IDs
		TSharedPtr<FJsonValue> Root;
		TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Json);
		if (!FJsonSerializer::Deserialize(Reader, Root) || !Root.IsValid()) return;

		const TArray<TSharedPtr<FJsonValue>>* TerritoryArray;
		TSharedPtr<FJsonObject> Obj = Root->AsObject();
		if (!Obj || !Obj->TryGetArrayField(TEXT("territories"), TerritoryArray)) return;

		for (const TSharedPtr<FJsonValue>& Entry : *TerritoryArray)
		{
			TSharedPtr<FJsonObject> T = Entry->AsObject();
			if (!T.IsValid()) continue;

			FString Id         = T->GetStringField(TEXT("territory_id"));
			FString Controller = T->GetStringField(TEXT("controller_guild_id"));

			for (FTerritoryInfo& Info : Territories)
			{
				if (Info.TerritoryId == Id)
				{
					Info.ControllerGuildId = Controller;
					break;
				}
			}
		}

		UE_LOG(LogTemp, Log, TEXT("[TerritoryManager] Synced territory ownership from backend"));
	});
}

void ATerritoryManager::ClaimTerritory(const FString& TerritoryId, const FString& GuildId)
{
	if (!HasAuthority()) return;

	for (FTerritoryInfo& T : Territories)
	{
		if (T.TerritoryId == TerritoryId)
		{
			T.ControllerGuildId = GuildId;
			UE_LOG(LogTemp, Log, TEXT("[TerritoryManager] Guild %s claimed %s"), *GuildId, *TerritoryId);
			return;
		}
	}
}

void ATerritoryManager::ContestTerritory(const FString& TerritoryId, const FString& AttackerGuildId)
{
	if (!HasAuthority()) return;
	UE_LOG(LogTemp, Log, TEXT("[TerritoryManager] Guild %s contesting %s"), *AttackerGuildId, *TerritoryId);
	// Full PvP contest logic handled in Blueprint / GameplayAbilitySystem
}

float ATerritoryManager::GetMiningBonus(const FString& TerritoryId) const
{
	for (const FTerritoryInfo& T : Territories)
	{
		if (T.TerritoryId == TerritoryId) return T.MiningBonus;
	}
	return 0.0f;
}
