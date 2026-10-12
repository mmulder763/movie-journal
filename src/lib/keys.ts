/**
 * API-keys. Lokaal komen ze uit .env; in de gehoste versie uit config.json in de
 * privé data-repo (zie storage.ts), zodat ze nooit in de publieke code staan.
 */
export interface ApiKeys {
  tmdb?: string
  omdb?: string
}

let keys: ApiKeys = {
  tmdb: (import.meta.env.VITE_TMDB_API_KEY as string | undefined) || undefined,
  omdb: (import.meta.env.VITE_OMDB_API_KEY as string | undefined) || undefined,
}

export function setApiKeys(next: ApiKeys) {
  keys = { tmdb: next.tmdb || keys.tmdb, omdb: next.omdb || keys.omdb }
}

export const tmdbKey = () => keys.tmdb
export const omdbKey = () => keys.omdb
