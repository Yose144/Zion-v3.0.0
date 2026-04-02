# Website TODO — Performance + CZ/EN Localization

## In Progress

- [x] Zavést bilingvní docs loader `public/docs/{cs,en}` s fallbackem na legacy `public/docs/*`
- [x] Přeložit první public docs batch: index, getting-started, setup, mining-guide, faq, api, architecture, legal/disclaimer, legal/risk, legal/token
- [ ] Dočistit docs route wrapper a sidebar, aby CZ/EN platilo i pro navigaci, category labels a hero copy
- [ ] Pokračovat v překladu public docs: community, pool-setup, tutorials, další onboarding obsah

## Performance Priorities

- [ ] Odlehčit `/docs` route: lazy-load jen části, které nejsou potřeba při prvním renderu
- [ ] Prověřit `/network`, `/download`, `/api-reference` pro další rozdělení interaktivních částí od statického obsahu
- [ ] Projít další polling/UI komponenty a sjednotit je s visibility-aware přístupem tam, kde to ještě chybí

## Translation Priorities

- [ ] Truth-align a pak přeložit `public/docs/mainnet/README.md`
- [ ] Přeložit `public/docs/community.md`
- [ ] Přeložit `public/docs/pool-setup.md`
- [ ] Přeložit `public/docs/tutorials/index.md`
- [ ] Přeložit `public/docs/tutorials/first-dapp.md`
- [ ] Rozhodnout, které starší dokumenty (`roadmap-lite`, `whitepaper-lite`) nejdřív projdou truth-alignmentem a až pak CZ/EN převodem

## Notes

- Lokální `docker/docker-compose.v3-mainnet.yml` diff je oddělený od website práce a necommitovat ho spolu s docs/web batchemi bez samostatného rozhodnutí.
- Cílem je držet web konzistentní s public truth: controlled V3 test-mainnet rehearsal, public launch stále NO-GO.