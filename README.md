# Movie Journal

PWA om bij te houden welke films en series je wanneer hebt gekeken: een agenda, een posterwand van alles wat je zag, een watchlist, statistieken, een Tinder-achtige swipe om je filmgeschiedenis bij elkaar te vegen, en deelkaarten voor je story. Data van [TMDB](https://www.themoviedb.org/), scores via [OMDb](https://www.omdbapi.com/).

**Live:** https://mmulder763.github.io/movie-journal/

## Hoe het in elkaar zit

- **Code** (deze repo, publiek) wordt bij elke push naar `main` gebouwd en via GitHub Pages gehost (`.github/workflows/deploy.yml`).
- **Data** staat in een aparte **privé** repo (`movie-journal-data`):
  - `journal.json`: je kijkgeschiedenis, watchlist en weggeswipete titels
  - `config.json`: `{ "tmdbApiKey": "…", "omdbApiKey": "…" }`
- De app leest en schrijft die repo direct via de GitHub API. Elk apparaat koppel je één keer met een **fine-grained token** met alleen *Contents: read & write* op `movie-journal-data`. Het token blijft op dat apparaat (localStorage).
- Er staan dus geen geheimen in de publieke code of de build.

Elke wijziging is een commit in de data-repo, dus je hebt automatisch versiegeschiedenis en backups.

## Lokaal ontwikkelen

```bash
nvm use            # Node 22 (zie .nvmrc)
npm install
cp .env.example .env   # TMDB- en OMDb-key invullen
npm run dev
```

Zonder gekoppelde GitHub-repo gebruikt de dev-server `data/journal.json` als opslag (handig om te testen; staat in `.gitignore`). Via ⚙︎ in de app kun je ook lokaal aan de echte data-repo koppelen.

`JOURNAL_FILE=/pad/naar/test.json npm run dev` gebruikt een ander lokaal databestand.

## Structuur

| Pad | Wat |
| --- | --- |
| `src/Root.tsx` | Kiest de opslag (GitHub of dev-server), laadt de keys, toont het koppelscherm |
| `src/lib/backends.ts` | Opslag-backends: dev-server (`/api`) en GitHub Contents API |
| `src/lib/storage.ts` | `useJournal`: optimistische updates, offline-wachtrij, gebundelde sync |
| `src/lib/journal.ts` | Datamodel-operaties (upsert/delete/skip/watchlist/…) |
| `src/lib/tmdb.ts` | TMDB: zoeken, lijsten, details, speelduren, NL-bioscoopdatum, streaming |
| `src/lib/ratings.ts` | IMDb / Rotten Tomatoes / Metacritic via OMDb |
| `src/lib/shareCard.ts` | Deelkaart (1080×1920) tekenen op canvas |
| `server/journalApi.ts` | Vite-plugin met de lokale `/api` voor development |
| `src/components/` | Agenda, lijst, watchlist, swipe, stats, dialogen, iconen |
