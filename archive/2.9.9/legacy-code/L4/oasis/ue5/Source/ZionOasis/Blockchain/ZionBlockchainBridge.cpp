// Copyright 2026 ZION TerraNova. All Rights Reserved.
#include "Blockchain/ZionBlockchainBridge.h"
#include "HttpModule.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Logging/LogMacros.h"

DEFINE_LOG_CATEGORY_STATIC(LogZionBridge, Log, All);

void UZionBlockchainBridge::Initialize(const FString& OasisApiHost,
									   const FString& ChainRpcHost)
{
	OasisBaseUrl = OasisApiHost;
	ChainRpcUrl  = ChainRpcHost;
	UE_LOG(LogZionBridge, Log, TEXT("ZION Bridge initialized — Oasis: %s | Chain: %s"),
		*OasisBaseUrl, *ChainRpcUrl);
}

UZionBlockchainBridge* UZionBlockchainBridge::Get(UWorld* World)
{
	if (!World) return nullptr;
	if (UGameInstance* GI = World->GetGameInstance())
	{
		// ZionGameInstance manages the singleton
		static const FName PropName = TEXT("BlockchainBridge");
		if (UObject* Found = FindObject<UObject>(GI, *PropName.ToString()))
			return Cast<UZionBlockchainBridge>(Found);
	}
	return nullptr;
}

// ── GET helpers ──────────────────────────────────────────────────────────────

void UZionBlockchainBridge::GetPlayer(const FString& Addr, FZionHttpCallback CB)
{
	SendGet(FString::Printf(TEXT("%s/api/v1/oasis/player/%s"), *OasisBaseUrl, *Addr), CB);
}

void UZionBlockchainBridge::GetLeaderboard(FZionHttpCallback CB)
{
	SendGet(OasisBaseUrl + TEXT("/api/v1/oasis/leaderboard"), CB);
}

void UZionBlockchainBridge::GetGuild(const FString& GuildId, FZionHttpCallback CB)
{
	SendGet(FString::Printf(TEXT("%s/api/v1/oasis/guild/%s"), *OasisBaseUrl, *GuildId), CB);
}

void UZionBlockchainBridge::GetTerritoryMap(FZionHttpCallback CB)
{
	SendGet(OasisBaseUrl + TEXT("/api/v1/oasis/map"), CB);
}

void UZionBlockchainBridge::GetRewardPools(FZionHttpCallback CB)
{
	SendGet(OasisBaseUrl + TEXT("/api/v1/oasis/rewards/pools"), CB);
}

void UZionBlockchainBridge::HealthCheck(FZionHttpCallback CB)
{
	SendGet(OasisBaseUrl + TEXT("/health"), CB);
}

// ── POST helpers ─────────────────────────────────────────────────────────────

void UZionBlockchainBridge::AwardXp(const FString& Addr, EXpSource Source,
									int64 Amount, FZionHttpCallback CB)
{
	const FString Body = FString::Printf(
		TEXT("{\"source\":\"%s\",\"amount\":%lld}"), *XpSourceToString(Source), Amount);
	SendPost(FString::Printf(TEXT("%s/api/v1/oasis/player/%s/xp"), *OasisBaseUrl, *Addr),
			 Body, CB);
}

void UZionBlockchainBridge::CreateGuild(const FString& Name,
										const FString& Founder,
										FZionHttpCallback CB)
{
	const FString Body = FString::Printf(
		TEXT("{\"name\":\"%s\",\"founder\":\"%s\"}"), *Name, *Founder);
	SendPost(OasisBaseUrl + TEXT("/api/v1/oasis/guild"), Body, CB);
}

void UZionBlockchainBridge::JoinGuild(const FString& GuildId,
									  const FString& Wallet,
									  FZionHttpCallback CB)
{
	const FString Body = FString::Printf(TEXT("{\"address\":\"%s\"}"), *Wallet);
	SendPost(FString::Printf(TEXT("%s/api/v1/oasis/guild/%s/join"),
							 *OasisBaseUrl, *GuildId), Body, CB);
}

// ── Chain RPC ────────────────────────────────────────────────────────────────

void UZionBlockchainBridge::VerifyWalletAddress(const FString& Wallet, FZionHttpCallback CB)
{
	const FString Body = FString::Printf(
		TEXT("{\"jsonrpc\":\"2.0\",\"method\":\"getaddressinfo\","
			 "\"params\":[\"%s\"],\"id\":1}"), *Wallet);
	SendPost(ChainRpcUrl, Body, CB);
}

void UZionBlockchainBridge::GetBalance(const FString& Wallet, FZionHttpCallback CB)
{
	const FString Body = FString::Printf(
		TEXT("{\"jsonrpc\":\"2.0\",\"method\":\"getbalance\","
			 "\"params\":[\"%s\"],\"id\":1}"), *Wallet);
	SendPost(ChainRpcUrl, Body, CB);
}

// ── Internal HTTP helpers ─────────────────────────────────────────────────────

void UZionBlockchainBridge::SendGet(const FString& Url, FZionHttpCallback CB)
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req =
		FHttpModule::Get().CreateRequest();
	Req->SetURL(Url);
	Req->SetVerb(TEXT("GET"));
	Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Req->OnProcessRequestComplete().BindLambda(
		[CB](FHttpRequestPtr Req, FHttpResponsePtr Resp, bool bOk)
		{
			const bool bSuccess = bOk && Resp.IsValid() &&
								  Resp->GetResponseCode() == 200;
			CB.ExecuteIfBound(bSuccess ? Resp->GetContentAsString() : TEXT(""), bSuccess);
		});
	Req->ProcessRequest();
}

void UZionBlockchainBridge::SendPost(const FString& Url, const FString& Body,
									 FZionHttpCallback CB)
{
	TSharedRef<IHttpRequest, ESPMode::ThreadSafe> Req =
		FHttpModule::Get().CreateRequest();
	Req->SetURL(Url);
	Req->SetVerb(TEXT("POST"));
	Req->SetHeader(TEXT("Content-Type"), TEXT("application/json"));
	Req->SetContentAsString(Body);
	Req->OnProcessRequestComplete().BindLambda(
		[CB](FHttpRequestPtr Req, FHttpResponsePtr Resp, bool bOk)
		{
			const bool bSuccess = bOk && Resp.IsValid() &&
								  (Resp->GetResponseCode() == 200 ||
								   Resp->GetResponseCode() == 201);
			CB.ExecuteIfBound(bSuccess ? Resp->GetContentAsString() : TEXT(""), bSuccess);
		});
	Req->ProcessRequest();
}

FString UZionBlockchainBridge::XpSourceToString(EXpSource Source)
{
	switch (Source)
	{
		case EXpSource::BlockMined:     return TEXT("BlockMined");
		case EXpSource::AiChallenge:    return TEXT("AiChallenge");
		case EXpSource::Quiz:           return TEXT("Quiz");
		case EXpSource::Meditation:     return TEXT("Meditation");
		case EXpSource::Tithe:          return TEXT("Tithe");
		case EXpSource::GuildQuest:     return TEXT("GuildQuest");
		case EXpSource::AvatarQuest:    return TEXT("GuildQuest");
		case EXpSource::Referral:       return TEXT("Referral");
		case EXpSource::RaidCompletion: return TEXT("GuildQuest");
		case EXpSource::PvPVictory:     return TEXT("AiChallenge");
		default:                        return TEXT("BlockMined");
	}
}
