# RAG corpus pro Hiranyagarbha (`/opt/zion/data/l3-rag-docs` na Edge)

Kanonická sada public-facing dokumentů, kterou `zion-v31-ai-native` (BM25 seed
při startu, `ZION_DOCS_PATH=/opt/zion/data/l3-rag-docs`) používá jako
kontext pro `/chat`. Nahrazuje dřívější dump interních dev/lore docs
(`3.2/`, `MiseAmenti/`, `root/` → backup `l3-rag-docs.bak-internal`), který
způsoboval halucinované/mystické odpovědi ve veřejném chatu.

## Zásady kurace

- Pouze **public-vetted** obsah — většina souborů je kopie z
  `APP&WEB/website-v2.9/public/docs/` (cs_*/en_* prefixy).
- Žádné interní plány, reporty, test scripty, lore kroniky
  (`onboard_LITE.md` vypuštěn — čistá narativní poezie rozbíjela
  faktické QA), žádné souborové cesty a služby.
- Žádná konkrétní "jedovatá" data — v `cs_v320_README.md` bylo datum
  bezpečnostního auditu zobecněno ("v srpnu 2026"), jinak ho model
  zneužíval pro otázky na datum založení.

## Lokální soubory v této složce

- `HIRANYAGARBHA.md` — identity + price/scope pravidla (kam odkázat).
- `SCOPE.md` — hranice odpovědí (osobní účty, data, live stav, off-topic).

## Deploy postup

```bash
# na stroji s repo checkoutem (docs se skládají z website public/docs)
D=APP\&WEB/website-v2.9/public/docs
T=/tmp/hiran-rag-docs && rm -rf $T && mkdir -p $T
for f in faq getting-started mining-guide pool-setup whitepaper-lite \
         roadmap-lite community index setup; do
  for l in cs en; do cp "$D/$l/$f.md" "$T/${l}_${f}.md"; done
done
for l in cs en; do for f in README oasis ncl; do
  cp "$D/$l/ai-native/$f.md" "$T/${l}_ai-native_${f}.md"; done
  cp "$D/cs/v3.2.0/README.md" "$T/cs_v320_README.md"; done
cp V31/L3/ai-native/rag-docs/{HIRANYAGARBHA,SCOPE}.md $T/
# sanitizer v cs_v320_README (viz pozn. výše) + rsync na Edge + restart
rsync -a --delete $T/ zion-new:/tmp/l3-rag-docs-new/
ssh zion-new 'sudo rsync -a --delete /tmp/l3-rag-docs-new/ \
  /opt/zion/data/l3-rag-docs/ && sudo chown -R zion:zion \
  /opt/zion/data/l3-rag-docs && sudo systemctl restart zion-v31-ai-native'
```

Po reseedu ověřit `journalctl -u zion-v31-ai-native` (`loaded_docs_from_disk
count=`, `seeding_rag_complete total=`) a otestovat `/rag/query` + `/chat`.
