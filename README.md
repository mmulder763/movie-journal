# Movie Journal

PWA om bij te houden welke films en series je wanneer hebt gekeken: een agenda, een posterwand van alles wat je zag, een watchlist, statistieken, een Tinder-achtige swipe om je filmgeschiedenis bij elkaar te vegen, en deelkaarten voor je story. Data van [TMDB](https://www.themoviedb.org/), scores via [OMDb](https://www.omdbapi.com/).

**Live:** https://mmulder763.github.io/movie-journal/: maak een account aan en voeg vrienden toe via je uitnodigingslink.

## Hoe het in elkaar zit

- **Code** (deze repo, publiek) wordt bij elke push naar `main` gebouwd en via GitHub Pages gehost (`.github/workflows/deploy.yml`).
- **Accounts en data** staan in [Supabase](https://supabase.com) (Postgres + Auth). Het schema staat in [`supabase/schema.sql`](supabase/schema.sql):
  - `profiles`: gebruikersnaam en weergavenaam
  - `journals`: één JSON-document per gebruiker (kijkgeschiedenis, watchlist, weggeswipete titels), met een versienummer tegen schrijfconflicten
  - `friendships`: vriendschapsverzoeken (`pending` → `accepted`)
  - `app_config`: TMDB/OMDb-keys, alleen leesbaar voor ingelogde gebruikers
- **Row Level Security**: je leest alleen je eigen journal en dat van geaccepteerde vrienden, en schrijft alleen je eigen journal.
- Realtime staat aan voor `friendships` en `journals`, zodat verzoeken en de feed live binnenkomen.
- In de build zitten alleen de publieke Supabase-URL en anon key (repo-variabelen `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`).

## Lokaal ontwikkelen

```bash
nvm use            # Node 22 (zie .nvmrc)
npm install
cp .env.example .env   # TMDB- en OMDb-key invullen
npm run dev
```

Met `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` in `.env.local` log je lokaal in op de echte database. Zonder die twee draait de app zonder accounts en gebruikt de dev-server `data/journal.json` als opslag (handig om te testen; staat in `.gitignore`).

`JOURNAL_FILE=/pad/naar/test.json npm run dev` gebruikt een ander lokaal databestand.

## Structuur

| Pad | Wat |
| --- | --- |
| `src/Root.tsx` | Inloggen, opslag kiezen (Supabase of dev-server), keys laden, uitnodigingslinks |
| `src/lib/backends.ts` | Opslag-backends: dev-server (`/api`) en Supabase |
| `src/lib/social.ts` | Vrienden, verzoeken, journals van vrienden (realtime), smaakmatch |
| `supabase/schema.sql` | Databaseschema, RLS-policies en triggers |
| `src/lib/storage.ts` | `useJournal`: optimistische updates, offline-wachtrij, gebundelde sync |
| `src/lib/journal.ts` | Datamodel-operaties (upsert/delete/skip/watchlist/…) |
| `src/lib/tmdb.ts` | TMDB: zoeken, lijsten, details, speelduren, NL-bioscoopdatum, streaming |
| `src/lib/ratings.ts` | IMDb / Rotten Tomatoes / Metacritic via OMDb |
| `src/lib/shareCard.ts` | Deelkaart (1080×1920) tekenen op canvas |
| `server/journalApi.ts` | Vite-plugin met de lokale `/api` voor development |
| `src/components/` | Agenda, lijst, watchlist, swipe, stats, dialogen, iconen |
