import { useEffect, useMemo, useState } from 'react'
import type { Entry, TitleSummary } from '../types'
import { fetchEpisodeRuntimes, fetchMovieRuntime, hasApiKey } from './tmdb'

/** Film: minuten. Serie: minuten per aflevering, per seizoen. */
type Runtime = { kind: 'movie'; minutes: number } | { kind: 'tv'; seasons: Record<number, number[]> }

const CACHE_PREFIX = 'movie-journal:runtime:v1:'
// Films veranderen niet; lopende series krijgen nieuwe afleveringen
const TTL_MS = { movie: 365, tv: 14 }

function readCache(key: string, kind: 'movie' | 'tv'): Runtime | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return undefined
    const { at, value } = JSON.parse(raw) as { at: number; value: Runtime }
    return Date.now() - at < TTL_MS[kind] * 86_400_000 ? value : undefined
  } catch {
    return undefined
  }
}

async function loadRuntime(t: TitleSummary): Promise<Runtime> {
  const value: Runtime =
    t.mediaType === 'movie'
      ? { kind: 'movie', minutes: await fetchMovieRuntime(t.tmdbId) }
      : { kind: 'tv', seasons: await fetchEpisodeRuntimes(t.tmdbId) }
  try {
    localStorage.setItem(CACHE_PREFIX + t.key, JSON.stringify({ at: Date.now(), value }))
  } catch { /* cache vol: volgende keer opnieuw ophalen */ }
  return value
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

/**
 * Minuten die bij een titel horen:
 * - film: speelduur × aantal keer gekeken
 * - serie met een entry zonder seizoen/aflevering ("hele serie", bv. via swipen): alle afleveringen, één keer
 * - anders per entry: één aflevering, of een heel seizoen als alleen het seizoen is ingevuld
 */
export function titleMinutes(watches: Entry[], runtime: Runtime): number {
  if (runtime.kind === 'movie') return runtime.minutes * watches.length

  const allSeasons = Object.values(runtime.seasons)
  const all = allSeasons.flat()
  const average = all.length ? sum(all) / all.length : 0
  if (watches.some((w) => w.season == null && w.episode == null)) return sum(all)

  return sum(
    watches.map((w) => {
      const season = runtime.seasons[w.season ?? 1] ?? []
      if (w.episode == null) return sum(season)
      return season[w.episode - 1] ?? average
    }),
  )
}

export interface WatchTime {
  minutes: number
  /** Aantal titels waarvan de duur al bekend is */
  loaded: number
  total: number
  failed: number
}

const CONCURRENCY = 4

/** Totale kijktijd over alle titels; haalt ontbrekende speelduren op de achtergrond op. */
export function useWatchTime(titles: TitleSummary[]): WatchTime {
  const [runtimes, setRuntimes] = useState<Record<string, Runtime>>({})
  const [failed, setFailed] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    const fromCache: Record<string, Runtime> = {}
    const missing: TitleSummary[] = []
    for (const t of titles) {
      if (runtimes[t.key] || failed.has(t.key)) continue
      const cached = readCache(t.key, t.mediaType)
      if (cached) fromCache[t.key] = cached
      else missing.push(t)
    }
    if (Object.keys(fromCache).length) setRuntimes((r) => ({ ...r, ...fromCache }))
    if (!hasApiKey() || missing.length === 0) return

    // Kleine worker-pool zodat TMDB niet met honderden requests tegelijk wordt bestookt
    const queue = [...missing]
    const worker = async () => {
      for (let t = queue.shift(); t && !cancelled; t = queue.shift()) {
        const title = t
        try {
          const value = await loadRuntime(title)
          if (!cancelled) setRuntimes((r) => ({ ...r, [title.key]: value }))
        } catch (err) {
          console.warn(`Speelduur van "${title.title}" ophalen mislukt`, err)
          if (!cancelled) setFailed((f) => new Set(f).add(title.key))
        }
      }
    }
    void Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return () => {
      cancelled = true
    }
    // runtimes/failed bewust niet als dependency: alleen opnieuw kijken als de titels veranderen
  }, [titles])

  return useMemo(() => {
    let minutes = 0
    let loaded = 0
    for (const t of titles) {
      const rt = runtimes[t.key]
      if (!rt) continue
      loaded++
      minutes += titleMinutes(t.watches, rt)
    }
    return { minutes, loaded, total: titles.length, failed: titles.filter((t) => failed.has(t.key)).length }
  }, [titles, runtimes, failed])
}
