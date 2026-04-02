# Website TODO — Performance + CZ/EN Localization

## In Progress

- [x] Zavést bilingvní docs loader `public/docs/{cs,en}` s fallbackem na legacy `public/docs/*`
- [x] Přeložit první public docs batch: index, getting-started, setup, mining-guide, faq, api, architecture, legal/disclaimer, legal/risk, legal/token
- [x] Dočistit docs route wrapper a sidebar, aby CZ/EN platilo i pro navigaci, category labels a hero copy
- [x] Pokračovat v překladu public docs: community, pool-setup, tutorials, další onboarding obsah
- [x] Další performance batch: `/download` a `/api-reference` rozdělit na lehčí initial payload a menší client ostrovy
- [x] Další pass: prověřit `/network` a další veřejné stránky s velkou client vrstvou
- [ ] Další pass: odlehčit další ops route a route-level motion tam, kde ještě zůstává bez přínosu

## Performance Priorities

- [x] Odlehčit `/docs` route: lazy-load jen části, které nejsou potřeba při prvním renderu
- [x] Prověřit `/network` pro další rozdělení interaktivních částí od statického obsahu
- [ ] Projít další polling/UI komponenty a sjednotit je s visibility-aware přístupem tam, kde to ještě chybí

## Translation Priorities

- [x] Truth-align a přeložit `public/docs/mainnet/README.md`
- [x] Truth-align a přeložit `public/docs/whitepaper-lite.md`
- [x] Truth-align a přeložit `public/docs/roadmap-lite.md`
- [ ] Rozhodnout, které další starší dokumenty (`roadmap-lite` apod.) nejdřív projdou truth-alignmentem a až pak CZ/EN převodem

## Notes

- Lokální `docker/docker-compose.v3-mainnet.yml` diff je oddělený od website práce a necommitovat ho spolu s docs/web batchemi bez samostatného rozhodnutí.
- Cílem je držet web konzistentní s public truth: controlled V3 test-mainnet rehearsal, public launch stále NO-GO.