// Copyright 2026 ZION TerraNova. All Rights Reserved.
#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "ZionOasis/Consciousness/ConsciousnessTypes.h"
#include "AvatarTypes.generated.h"

/**
 * Sacred avatars roster — generated from data/avatars.json by
 * scripts/gen_ue5_avatar_pipeline.py.
 * Used as DataTable primary key enum.
 */
UENUM(BlueprintType)
enum class EAvatarID : uint8
{
	// === GENERATED EAvatarID BEGIN (scripts/gen_ue5_avatar_pipeline.py) ===
	KrishnaMaitreya                  = 0   UMETA(DisplayName = "Krishna-Maitreya"),
	Rama                             = 1   UMETA(DisplayName = "Rama"),
	Sita                             = 2   UMETA(DisplayName = "Sita"),
	Hanuman                          = 3   UMETA(DisplayName = "Hanuman"),
	Maitreya                         = 4   UMETA(DisplayName = "Maitreya"),
	Saraswati                        = 5   UMETA(DisplayName = "Saraswati"),
	IsisEnamataru                    = 6   UMETA(DisplayName = "Isis-Enamataru"),
	IssobelaGuardian                 = 8   UMETA(DisplayName = "Issobela Guardian"),
	Shanti                           = 9   UMETA(DisplayName = "Shanti"),
	BronuChrist                      = 10  UMETA(DisplayName = "Bronu-Christ"),
	Arjuna                           = 11  UMETA(DisplayName = "Arjuna"),
	MilanBhima                       = 12  UMETA(DisplayName = "Milan-Bhima"),
	ArtemVudce                       = 13  UMETA(DisplayName = "Artem-Vudce"),
	MamaYashoda                      = 14  UMETA(DisplayName = "Mama Yashoda"),
	Vishwakarma                      = 15  UMETA(DisplayName = "Vishwakarma"),
	Radha                            = 16  UMETA(DisplayName = "Radha"),
	VyasaKamil                       = 17  UMETA(DisplayName = "Vyasa-Kamil"),
	MeriamRose                       = 18  UMETA(DisplayName = "Meriam Rose"),
	YeshuaSananda                    = 19  UMETA(DisplayName = "Yeshua Sananda"),
	PannaMaria                       = 38  UMETA(DisplayName = "Panna Maria"),
	Tara                             = 20  UMETA(DisplayName = "Tara"),
	Avalokiteshvara                  = 21  UMETA(DisplayName = "Avalokiteshvara"),
	Vajrasattva                      = 22  UMETA(DisplayName = "Vajrasattva"),
	DalaiLamaXIV                     = 51  UMETA(DisplayName = "Dalai Lama XIV"),
	ElMorya                          = 29  UMETA(DisplayName = "El Morya"),
	Lanto                            = 30  UMETA(DisplayName = "Lanto"),
	PaultheVenetian                  = 31  UMETA(DisplayName = "Paul the Venetian"),
	SerapisBey                       = 27  UMETA(DisplayName = "Serapis Bey"),
	Hilarion                         = 32  UMETA(DisplayName = "Hilarion"),
	LadyNada                         = 33  UMETA(DisplayName = "Lady Nada"),
	SaintGermain                     = 26  UMETA(DisplayName = "Saint Germain"),
	SanatKumara                      = 28  UMETA(DisplayName = "Sanat Kumara"),
	MahavatarBabaji                  = 24  UMETA(DisplayName = "Mahavatar Babaji"),
	LadyGaiaVywamus                  = 25  UMETA(DisplayName = "Lady Gaia-Vywamus"),
	KingArthur                       = 23  UMETA(DisplayName = "King Arthur"),
	KarelIV                          = 35  UMETA(DisplayName = "Karel IV"),
	AlbertEinstein                   = 36  UMETA(DisplayName = "Albert Einstein"),
	MahatmaGandhi                    = 37  UMETA(DisplayName = "Mahatma Gandhi"),
	Subhadra                         = 39  UMETA(DisplayName = "Subhadra"),
	Vasudeva                         = 41  UMETA(DisplayName = "Vasudeva"),
	Neo                              = 46  UMETA(DisplayName = "Neo"),
	Trinity                          = 47  UMETA(DisplayName = "Trinity"),
	Morpheus                         = 48  UMETA(DisplayName = "Morpheus"),
	ZIONTheLastCity                  = 50  UMETA(DisplayName = "ZION The Last City"),
	SriDattatreya                    = 42  UMETA(DisplayName = "Sri Dattatreya"),
	MalyPrinc                        = 43  UMETA(DisplayName = "Maly Princ"),
	Hiranyagarbha                    = 44  UMETA(DisplayName = "Hiranyagarbha"),
	SriKalkiAvatar                   = 45  UMETA(DisplayName = "Sri Kalki Avatar"),
	Elizabet                         = 40  UMETA(DisplayName = "Elizabet"),
	HekaSpaBlackElk                  = 52  UMETA(DisplayName = "Heȟáka Sápa (Black Elk)"),
	PtesWWhiteBuffaloCalfWoman       = 53  UMETA(DisplayName = "Ptesáŋ Wíŋ (White Buffalo Calf Woman)"),
	KkyangwtiSpiderGrandmother       = 54  UMETA(DisplayName = "Kókyangwúti (Spider Grandmother)"),
	HunahpXbalanquHeroTwins          = 55  UMETA(DisplayName = "Hunahpú & Xbalanqué (Hero Twins)"),
	DonMariano                       = 56  UMETA(DisplayName = "Don Mariano"),
	DoaRosalaIxmukan                 = 57  UMETA(DisplayName = "Doña Rosalía Ixmukané"),
	BlPeroWhiteFeather               = 58  UMETA(DisplayName = "Bílé Pero (White Feather)"),
	OhnivOkaFireEyes                 = 59  UMETA(DisplayName = "Ohnivá Oka (Fire Eyes)"),
	DaviKopenawa                     = 60  UMETA(DisplayName = "Davi Kopenawa"),
	HeykaSacredClown                 = 61  UMETA(DisplayName = "Heyókȟa (Sacred Clown)"),
	Lilai                            = 62  UMETA(DisplayName = "Lā'ila'i"),
	Pele                             = 63  UMETA(DisplayName = "Pele"),
	Hiiaka                           = 64  UMETA(DisplayName = "Hiʻiaka"),
	Kne                              = 65  UMETA(DisplayName = "Kāne"),
	Kanaloa                          = 66  UMETA(DisplayName = "Kanaloa"),
	K                                = 67  UMETA(DisplayName = "Kū"),
	Lono                             = 68  UMETA(DisplayName = "Lono"),
	StarKumuLehua                    = 69  UMETA(DisplayName = "Stará Kumu Lehua"),
	Hina                             = 70  UMETA(DisplayName = "Hina"),
	Maui                             = 71  UMETA(DisplayName = "Maui"),
	Padmasambhava                    = 72  UMETA(DisplayName = "Padmasambhava"),
	Milarepa                         = 73  UMETA(DisplayName = "Milarepa"),
	Tsongkhapa                       = 74  UMETA(DisplayName = "Tsongkhapa"),
	Atia                             = 75  UMETA(DisplayName = "Atiśa"),
	MarpaLotsawa                     = 76  UMETA(DisplayName = "Marpa Lotsawa"),
	MachikLabdrn                     = 77  UMETA(DisplayName = "Machik Labdrön"),
	Majur                            = 78  UMETA(DisplayName = "Mañjuśrī"),
	Samantabhadra                    = 79  UMETA(DisplayName = "Samantabhadra"),
	MedicineBuddha                   = 80  UMETA(DisplayName = "Medicine Buddha"),
	LongchenRabjam                   = 81  UMETA(DisplayName = "Longchen Rabjam"),
	Shiva                            = 82  UMETA(DisplayName = "Shiva"),
	Parvati                          = 83  UMETA(DisplayName = "Parvati"),
	Ganesha                          = 84  UMETA(DisplayName = "Ganesha"),
	Lakshmi                          = 85  UMETA(DisplayName = "Lakshmi"),
	Durga                            = 86  UMETA(DisplayName = "Durga"),
	Kali                             = 87  UMETA(DisplayName = "Kali"),
	Kartikeya                        = 88  UMETA(DisplayName = "Kartikeya"),
	Surya                            = 89  UMETA(DisplayName = "Surya"),
	Indra                            = 90  UMETA(DisplayName = "Indra"),
	Ganga                            = 91  UMETA(DisplayName = "Ganga"),
	Amaterasu                        = 92  UMETA(DisplayName = "Amaterasu"),
	Susanoo                          = 93  UMETA(DisplayName = "Susanoo"),
	Tsukuyomi                        = 94  UMETA(DisplayName = "Tsukuyomi"),
	Inari                            = 95  UMETA(DisplayName = "Inari"),
	kuninushi                        = 96  UMETA(DisplayName = "Ōkuninushi"),
	Izanami                          = 97  UMETA(DisplayName = "Izanami"),
	Hachiman                         = 98  UMETA(DisplayName = "Hachiman"),
	Benzaiten                        = 99  UMETA(DisplayName = "Benzaiten"),
	Kkai                             = 100 UMETA(DisplayName = "Kūkai"),
	Nichiren                         = 101 UMETA(DisplayName = "Nichiren"),
	XuanyuanHuangdi                  = 102 UMETA(DisplayName = "Xuanyuan Huangdi"),
	Xiwangmu                         = 103 UMETA(DisplayName = "Xiwangmu"),
	Laozi                            = 104 UMETA(DisplayName = "Laozi"),
	KongziConfucius                  = 105 UMETA(DisplayName = "Kongzi (Confucius)"),
	GuanYuGuandi                     = 106 UMETA(DisplayName = "Guan Yu / Guandi"),
	Mazu                             = 107 UMETA(DisplayName = "Mazu"),
	Nezha                            = 108 UMETA(DisplayName = "Nezha"),
	SunWukong                        = 109 UMETA(DisplayName = "Sun Wukong"),
	YutheGreat                       = 110 UMETA(DisplayName = "Yu the Great"),
	LeiGong                          = 111 UMETA(DisplayName = "Lei Gong"),
	DewiSri                          = 112 UMETA(DisplayName = "Dewi Sri"),
	NyaiRoroKidul                    = 113 UMETA(DisplayName = "Nyai Roro Kidul"),
	Semar                            = 114 UMETA(DisplayName = "Semar"),
	BataraGuru                       = 115 UMETA(DisplayName = "Batara Guru"),
	BarongKet                        = 116 UMETA(DisplayName = "Barong Ket"),
	Garuda                           = 117 UMETA(DisplayName = "Garuda"),
	Gatotkaca                        = 118 UMETA(DisplayName = "Gatotkaca"),
	PrincePanji                      = 119 UMETA(DisplayName = "Prince Panji"),
	RoroJonggrang                    = 120 UMETA(DisplayName = "Roro Jonggrang"),
	DewiNawangWulan                  = 121 UMETA(DisplayName = "Dewi Nawang Wulan"),
	SevenSistersSonglineSteward      = 122 UMETA(DisplayName = "Seven Sisters Songline Steward"),
	RainbowSerpentCountryLaw         = 123 UMETA(DisplayName = "Rainbow Serpent Country Law"),
	Bunjil                           = 124 UMETA(DisplayName = "Bunjil"),
	Baiame                           = 125 UMETA(DisplayName = "Baiame"),
	TagaiNavigator                   = 126 UMETA(DisplayName = "Tagai Navigator"),
	CelestialEmuDreamingSteward      = 127 UMETA(DisplayName = "Celestial Emu Dreaming Steward"),
	DjangkawuCreatorVoyagers         = 128 UMETA(DisplayName = "Djang'kawu Creator Voyagers"),
	Namarrkon                        = 129 UMETA(DisplayName = "Namarrkon"),
	CountryKnowledgeWalkTjukurpaeducationframe = 130 UMETA(DisplayName = "Country Knowledge Walk (Tjukurpa education frame)"),
	MakarrataTreatyBridge            = 131 UMETA(DisplayName = "Makarrata Treaty Bridge"),
	Papatnuku                        = 132 UMETA(DisplayName = "Papatūānuku"),
	Ranginui                         = 133 UMETA(DisplayName = "Ranginui"),
	TneMahuta                        = 134 UMETA(DisplayName = "Tāne Mahuta"),
	TangaroaMoristrand               = 135 UMETA(DisplayName = "Tangaroa (Māori strand)"),
	Rongo                            = 136 UMETA(DisplayName = "Rongo"),
	Tmatauenga                       = 137 UMETA(DisplayName = "Tūmatauenga"),
	Twhirimatea                      = 138 UMETA(DisplayName = "Tāwhirimatea"),
	Haumiatiketike                   = 139 UMETA(DisplayName = "Haumiatiketike"),
	Hinenuitep                       = 140 UMETA(DisplayName = "Hine-nui-te-pō"),
	KupeNavigator                    = 141 UMETA(DisplayName = "Kupe Navigator"),
	un                               = 142 UMETA(DisplayName = "Ọṣun"),
	ng                               = 143 UMETA(DisplayName = "Ṣàngó"),
	btl                              = 144 UMETA(DisplayName = "Ọbàtálá"),
	ya                               = 145 UMETA(DisplayName = "Ọya"),
	MawuLisa                         = 146 UMETA(DisplayName = "Mawu-Lisa"),
	NyameNyankopon                   = 147 UMETA(DisplayName = "Nyame / Nyankopon"),
	KwakuAnanse                      = 148 UMETA(DisplayName = "Kwaku Ananse"),
	AusarOsiris                      = 149 UMETA(DisplayName = "Ausar-Osiris"),
	Mat                              = 150 UMETA(DisplayName = "Maʿăt"),
	AnnaNjinga                       = 151 UMETA(DisplayName = "Anna Njinga"),
	Atlas                            = 152 UMETA(DisplayName = "Atlas"),
	Cleito                           = 153 UMETA(DisplayName = "Cleito"),
	Gadeirus                         = 154 UMETA(DisplayName = "Gadeirus"),
	Ampheres                         = 155 UMETA(DisplayName = "Ampheres"),
	Evaemon                          = 156 UMETA(DisplayName = "Evaemon"),
	Mneseus                          = 157 UMETA(DisplayName = "Mneseus"),
	Autochthon                       = 158 UMETA(DisplayName = "Autochthon"),
	Elasippus                        = 159 UMETA(DisplayName = "Elasippus"),
	Mestor                           = 160 UMETA(DisplayName = "Mestor"),
	Azaes                            = 161 UMETA(DisplayName = "Azaes"),
	LemurSteward                     = 162 UMETA(DisplayName = "Lemur Steward"),
	SclaterBridge                    = 163 UMETA(DisplayName = "Sclater Bridge"),
	CoralNotary                      = 164 UMETA(DisplayName = "Coral Notary"),
	TideColumn                       = 165 UMETA(DisplayName = "Tide Column"),
	BasaltChronicle                  = 166 UMETA(DisplayName = "Basalt Chronicle"),
	FoamSeed                         = 167 UMETA(DisplayName = "Foam Seed"),
	OceanicBridge                    = 168 UMETA(DisplayName = "Oceanic Bridge"),
	ShelfWhisper                     = 169 UMETA(DisplayName = "Shelf Whisper"),
	EquinoxLull                      = 170 UMETA(DisplayName = "Equinox Lull"),
	CircleClosure                    = 171 UMETA(DisplayName = "Circle Closure"),
	GreatCentralSunSteward           = 172 UMETA(DisplayName = "Great Central Sun Steward"),
	PhotonCadence                    = 173 UMETA(DisplayName = "Photon Cadence"),
	SolarLogosDual                   = 174 UMETA(DisplayName = "Solar Logos Dual"),
	TelluricSoulBridge               = 175 UMETA(DisplayName = "Telluric Soul Bridge"),
	TubeofLightSentinel              = 176 UMETA(DisplayName = "Tube-of-Light Sentinel"),
	RadiantSpiral                    = 177 UMETA(DisplayName = "Radiant Spiral"),
	SeventhRayAdjunct                = 178 UMETA(DisplayName = "Seventh Ray Adjunct"),
	GalacticConvenor                 = 179 UMETA(DisplayName = "Galactic Convenor"),
	LightbodyScribe                  = 180 UMETA(DisplayName = "Lightbody Scribe"),
	VzestupCapstone                  = 181 UMETA(DisplayName = "Vzestup Capstone"),
	ValhallaHallSteward              = 182 UMETA(DisplayName = "Valhalla Hall-Steward"),
	innWayfarer                      = 183 UMETA(DisplayName = "Óðinn Wayfarer"),
	rrStormHost                      = 184 UMETA(DisplayName = "Þórr Storm-Host"),
	FreyjaVanRuler                   = 185 UMETA(DisplayName = "Freyja Van-Ruler"),
	TrOathFire                       = 186 UMETA(DisplayName = "Týr Oath-Fire"),
	BrigidTripleFlame                = 187 UMETA(DisplayName = "Brigid Triple-Flame"),
	DagdaPeaceHarp                   = 188 UMETA(DisplayName = "Dagda Peace-Harp"),
	MorrganSovereigntyRaven          = 189 UMETA(DisplayName = "Morrígan Sovereignty-Raven"),
	LughSamildanach                  = 190 UMETA(DisplayName = "Lugh Samildanach"),
	ManannnmacLir                    = 191 UMETA(DisplayName = "Manannán mac Lir"),
	RSolarBarque                     = 192 UMETA(DisplayName = "Ré Solar-Barque"),
	HorUnifier                       = 193 UMETA(DisplayName = "Hor Unifier"),
	ThothScribe                      = 194 UMETA(DisplayName = "Thoth Scribe"),
	HathorJubilee                    = 195 UMETA(DisplayName = "Hathor Jubilee"),
	SekhmetAuditFlame                = 196 UMETA(DisplayName = "Sekhmet Audit-Flame"),
	PtahMason                        = 197 UMETA(DisplayName = "Ptah Mason"),
	AnubisThreshold                  = 198 UMETA(DisplayName = "Anubis Threshold"),
	AmunHiddenField                  = 199 UMETA(DisplayName = "Amun Hidden-Field"),
	GebFoundation                    = 200 UMETA(DisplayName = "Geb Foundation"),
	NutStellarVault                  = 201 UMETA(DisplayName = "Nut Stellar Vault"),
	// === GENERATED EAvatarID END ===
};

/** Avatar NFT rarity */
UENUM(BlueprintType)
enum class EAvatarRarity : uint8
{
	Common      UMETA(DisplayName = "Common"),
	Uncommon    UMETA(DisplayName = "Uncommon"),
	Rare        UMETA(DisplayName = "Rare"),
	Epic        UMETA(DisplayName = "Epic"),
	Legendary   UMETA(DisplayName = "Legendary"),
	OneOfOne    UMETA(DisplayName = "1/1 — Unique"),
};

/** One row of the Avatar Data Table */
USTRUCT(BlueprintType)
struct FAvatarRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	EAvatarID AvatarID = EAvatarID::Rama;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	FText Title;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	FText Teaching;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	FText SpecialAbilityName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	FText SpecialAbilityDesc;

	/** Minimum consciousness level required to access this avatar */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	EConsciousnessLevel MinConsciousnessLevel = EConsciousnessLevel::Physical;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	ESacredRay Ray = ESacredRay::Blue;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	EAvatarRarity Rarity = EAvatarRarity::Rare;

	/** World map region where avatar resides */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	FText RegionName;

	/** Quest lines count */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	int32 QuestCount = 5;

	/** XP reward for completing all quests */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar")
	int64 TotalQuestXpReward = 0;

	/** Soft reference to MetaHuman / 3D character Blueprint */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar|Assets")
	TSoftClassPtr<AActor> CharacterClass;

	/** Portrait texture for UI */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar|Assets")
	TSoftObjectPtr<UTexture2D> PortraitTexture;

	/** NFT metadata URI (IPFS / zionterranova.com/nft/) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Avatar|Blockchain")
	FString NftMetadataUri;
};

/** One row of the Avatar Quest Data Table */
USTRUCT(BlueprintType)
struct FAvatarQuestRow : public FTableRowBase
{
	GENERATED_BODY()

	/** Which avatar this quest belongs to */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AvatarQuest")
	EAvatarID AvatarID = EAvatarID::Rama;

	/** Quest index within avatar's quest list (0-based) */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AvatarQuest")
	int32 QuestIndex = 0;

	/** Quest title shown in UI */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AvatarQuest")
	FText QuestTitle;

	/** Quest description / objective text */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AvatarQuest")
	FText QuestDescription;

	/** XP reward on completion */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "AvatarQuest")
	int32 XpReward = 500;
};

/** Player-equipped avatar slot */
USTRUCT(BlueprintType)
struct FEquippedAvatar
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly)
	EAvatarID AvatarID = EAvatarID::NeoTheOne;

	/** Blockchain NFT token ID if owned on-chain */
	UPROPERTY(BlueprintReadOnly)
	FString NftTokenId;

	/** Customization: skin tone, outfit color */
	UPROPERTY(BlueprintReadOnly)
	FLinearColor PrimaryColor = FLinearColor::White;
};