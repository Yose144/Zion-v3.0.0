# Oasis × UE5 — RAG „crate“ v monorepu

Tento adresář je **vědomý „knowledge crate“ vedle Rust crate**: žádný C++ ani `.uasset` zde nedrž — jen Markdown, aby je `zion-ai-native` indexoval přes kanonické kořeny v `AI_NATIVE_CANONICAL_CORPUS_ROOTS`.

## Proč tu něco dopisovat

- `docs/docs2.9/ZION_OASIS/` obsahuje **lore a design dokumenty** Oasis (globální kanon vývoje hry).
- `HiranV2.1/corpus/oasis-ue5/` je pro **aktuální mapování na Unreal Engine 5**: co je v jakém BP, jak se jmenuje Data Asset, který Subsystem řídí co, kde je hranice replikace, apod.

Hiranyagarbha dostane oboje do jednoho workspace při `ZION_WORKSPACE_ROOT` = kořen repozitáře. **Kompletní Oasis lore** má být vždy pod `docs/docs2.9/ZION_OASIS/` (rekurzivně všechny `.md`); Rust konstanty `ZION_OASIS_GAME_CORPUS_ROOTS` + `HiranyagarbhaAgent::index_zion_oasis_game_corpus` slouží k cílenému přeindexování hry + těchto UE zápisů najednou.

## Doporučené soubory

| Soubor | Účel |
|--------|------|
| `PROJECT_LINKS.md` | Kopie ze šablony `PROJECT_LINKS.template.md`: lokální cesta k `.uproject`, verze UE, poznámky k zásuvným modulům |
| `BP_*.md` nebo `UE_*.md` | Jedna logická třída Blueprintu jako text (název, parent class, vlastnosti Events, odkazy na řádek v kanonické design doc z `docs/docs2.9/ZION_OASIS/`) |
| `CHANGELOG_UE.md` | Stručně co ses naučil v editoru za týden (pro RAG, ne substitut za git) |

Šablona projektového odkazu: [`PROJECT_LINKS.template.md`](./PROJECT_LINKS.template.md).

Koncepční závazný popis vrstvy 3.7: [`../Hiran_v2.1.md`](../Hiran_v2.1.md).
