export type MediaType = 'movie' | 'tv'

/** Eén keer iets gekeken. */
export interface Entry {
  id: string
  /** Lokale datum (YYYY-MM-DD), of null als het "ooit" was (bv. via swipen) */
  date: string | null
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath?: string | null
  year?: string
  /** 1–5, leeg = geen rating */
  rating?: number
  note?: string
  /** In de bioscoop gezien */
  cinema?: boolean
  /** Alleen voor series */
  season?: number
  episode?: number
  createdAt: number
}

/** Titel op de watchlist ("wil ik zien"). */
export interface WatchItem {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath?: string | null
  year?: string
  addedAt: number
}

/** Alles wat in journal.json staat. */
export interface Journal {
  entries: Entry[]
  /** Titel-keys ("movie-123") die bij het swipen als "niet gezien" zijn weggeswipet */
  skipped: string[]
  watchlist: WatchItem[]
}

export type Op =
  | { type: 'upsert'; entry: Entry }
  | { type: 'delete'; id: string }
  | { type: 'skip'; key: string }
  | { type: 'unskip'; key: string }
  | { type: 'watchlist-add'; item: WatchItem }
  | { type: 'watchlist-remove'; key: string }
  | { type: 'replace'; journal: Journal }

export interface SearchResult {
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath: string | null
  year?: string
  overview: string
  voteAverage?: number
}

/** Alle keren dat één titel is gekeken, samengevoegd. */
export interface TitleSummary {
  key: string
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath?: string | null
  year?: string
  /** Nieuwste eerst, entries zonder datum achteraan */
  watches: Entry[]
  lastDate: string | null
  avgRating?: number
}
