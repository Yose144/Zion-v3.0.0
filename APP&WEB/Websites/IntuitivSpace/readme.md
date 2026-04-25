Intuitive Space v1.0

Statický prezentační web byl rozšířen o Node server, sdílené API a oddělenou admin stránku.

Co je součástí:

- veřejný web na index.html
- chráněná admin stránka na admin.html
- sdílený obsah novinek a galerie uložený v data/content.json
- upload obrázků do galerie přes src/uploads/

Spuštění lokálně:

1. npm install
2. npm start
3. otevřít http://localhost:3000

Admin rozhraní:

- URL: http://localhost:3000/admin.html
- heslo se čte z proměnné ADMIN_PASSWORD
- pokud ADMIN_PASSWORD není nastavené, výchozí heslo je intuitive-space-admin

Doporučené proměnné prostředí:

- ADMIN_PASSWORD=tvuj-silny-heslo
- SESSION_SECRET=nahodny-dlouhy-retezec
- PORT=3000

Poznámky:

- veřejný web čte novinky i galerii z /api/content
- admin změny jsou sdílené pro všechny návštěvníky, protože se zapisují do serverového JSON souboru
- nahrané obrázky se ukládají do src/uploads/ a z .gitignore jsou vyloučené z repozitáře