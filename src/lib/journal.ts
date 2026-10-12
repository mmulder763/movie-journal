import type { Entry, Journal, Op, WatchItem } from '../types.ts'

// Gedeeld door de browser (optimistische updates) en de dev-server (data/journal.json).

export const emptyJournal = (): Journal => ({ entries: [], skipped: [], watchlist: [] })

const keyOf = (t: { mediaType: string; tmdbId: number }) => `${t.mediaType}-${t.tmdbId}`

export function applyOp(journal: Journal, op: Op): Journal {
  switch (op.type) {
    case 'upsert': {
      const exists = journal.entries.some((e) => e.id === op.entry.id)
      const entries = exists
        ? journal.entries.map((e) => (e.id === op.entry.id ? op.entry : e))
        : [...journal.entries, op.entry]
      return { ...journal, entries }
    }
    case 'delete':
      return { ...journal, entries: journal.entries.filter((e) => e.id !== op.id) }
    case 'skip':
      return journal.skipped.includes(op.key) ? journal : { ...journal, skipped: [...journal.skipped, op.key] }
    case 'unskip':
      return { ...journal, skipped: journal.skipped.filter((k) => k !== op.key) }
    case 'watchlist-add':
      return journal.watchlist.some((w) => keyOf(w) === keyOf(op.item))
        ? journal
        : { ...journal, watchlist: [op.item, ...journal.watchlist] }
    case 'watchlist-remove':
      return { ...journal, watchlist: journal.watchlist.filter((w) => keyOf(w) !== op.key) }
    case 'replace':
      return normalizeJournal(op.journal)
  }
}

const isEntry = (e: unknown): e is Entry => {
  const x = e as Entry
  return !!x && typeof x.id === 'string' && typeof x.tmdbId === 'number' && (x.mediaType === 'movie' || x.mediaType === 'tv')
}

const isWatchItem = (w: unknown): w is WatchItem => {
  const x = w as WatchItem
  return !!x && typeof x.tmdbId === 'number' && (x.mediaType === 'movie' || x.mediaType === 'tv') && typeof x.title === 'string'
}

/** Accepteert zowel het oude formaat (losse array) als { entries, skipped }. Gooit bij ongeldige data. */
export function normalizeJournal(data: unknown): Journal {
  const raw = (Array.isArray(data) ? { entries: data } : data) as Partial<Journal> | null
  if (!raw || !Array.isArray(raw.entries)) throw new Error('Ongeldig journal: "entries" ontbreekt')
  const bad = raw.entries.findIndex((e) => !isEntry(e))
  if (bad !== -1) throw new Error(`Ongeldig journal: entry #${bad + 1} mist id, tmdbId of mediaType`)
  return {
    entries: raw.entries.map((e) => ({ ...e, date: e.date || null })),
    skipped: Array.isArray(raw.skipped) ? raw.skipped.filter((k): k is string => typeof k === 'string') : [],
    watchlist: Array.isArray(raw.watchlist) ? raw.watchlist.filter(isWatchItem) : [],
  }
}
