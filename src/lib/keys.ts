/**
 * API-keys. Lokaal komen ze uit .env; in de gehoste versie uit config.json in de
 * privé data-repo (zie storage.ts), zodat ze nooit in de publieke code staan.
 */
export interface ApiKeys {
  tmdb?: string
  omdb?: string
  /** Publieke sleutel voor pushmeldingen */
  vapid?: string
}

let keys: ApiKeys = {
  tmdb: (import.meta.env.VITE_TMDB_API_KEY as string | undefined) || undefined,
  omdb: (import.meta.env.VITE_OMDB_API_KEY as string | undefined) || undefined,
}

export function setApiKeys(next: ApiKeys) {
  keys = { tmdb: next.tmdb || keys.tmdb, omdb: next.omdb || keys.omdb, vapid: next.vapid || keys.vapid }
}

export const tmdbKey = () => keys.tmdb
export const omdbKey = () => keys.omdb
export const vapidKey = () => keys.vapid
