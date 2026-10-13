import { useEffect, useState } from 'react'
import type { Entry, MediaType, TitleSummary, WatchItem } from '../types'
import { fetchMovieRelease, fetchSeasonEpisodes, fetchTvStatus, hasApiKey, type TvStatus } from './tmdb'
import { today } from './dates'

// ---------- Kleine cache (sessie + localStorage, 12 uur) ----------
const TTL = 12 * 3_600_000
const memo = new Map<string, Promise<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const storeKey = `movie-journal:upcoming:v1:${key}`
  let p = memo.get(key) as Promise<T> | undefined
  if (p) return p
  try {
    const raw = localStorage.getItem(storeKey)
    if (raw) {
      const { at, value } = JSON.parse(raw) as { at: number; value: T }
      if (Date.now() - at < TTL) {
        p = Promise.resolve(value)
        memo.set(key, p)
        return p
      }
    }
  } catch { /* geen cache */ }
  p = load().then((value) => {
    try {
      localStorage.setItem(storeKey, JSON.stringify({ at: Date.now(), value }))
    } catch { /* cache vol */ }
    return value
  })
  p.catch(() => memo.delete(key))
  memo.set(key, p)
  return p
}

const tvStatus = (id: number) => cached(`tv:${id}`, () => fetchTvStatus(id))
const episodeName = (id: number, season: number, episode: number) =>
  cached(`season:${id}:${season}`, () => fetchSeasonEpisodes(id, season)).then((eps) => eps.find((e) => e.number === episode)?.name)

const before = (a: { season: number; episode: number }, b: { season: number; episode: number }) =>
  a.season < b.season || (a.season === b.season && a.episode <= b.episode)

// ---------- Verder kijken ----------

export interface NextUp {
  title: TitleSummary
  season: number
  episode: number
  name?: string
  /** Nog niet uitgezonden: datum van de aflevering */
  airDate?: string
}

/** Volgende aflevering na de laatst gelogde, op basis van de seizoenen van de serie. */
function nextAfter(status: TvStatus, last: { season: number; episode: number }): { season: number; episode: number } | null {
  const current = status.seasons.find((s) => s.number === last.season)
  if (current && last.episode < current.episodeCount) return { season: last.season, episode: last.episode + 1 }
  const following = status.seasons.filter((s) => s.number > last.season).sort((a, b) => a.number - b.number)[0]
  return following ? { season: following.number, episode: 1 } : null
}

/** Series die je aan het kijken bent (losse afleveringen gelogd) met de volgende aflevering. */
export function useContinueWatching(titles: TitleSummary[]): NextUp[] {
  const [items, setItems] = useState<NextUp[]>([])

  useEffect(() => {
    if (!hasApiKey()) return
    let cancelled = false
    const candidates = titles
      .filter((t) => t.mediaType === 'tv' && t.watches.some((w) => w.season != null && w.episode != null) && !t.watches.some((w) => w.season == null && w.episode == null))
      .map((t) => {
        const eps = t.watches.filter((w): w is Entry & { season: number; episode: number } => w.season != null && w.episode != null)
        const last = eps.reduce((a, b) => (before(a, b) ? b : a))
        return { t, last, at: Math.max(...eps.map((e) => e.createdAt)) }
      })
      .sort((a, b) => b.at - a.at)
      .slice(0, 10)

    Promise.all(
      candidates.map(async ({ t, last }): Promise<NextUp | null> => {
        const status = await tvStatus(t.tmdbId)
        const next = nextAfter(status, last)
        if (!next) return null
        const aired = status.lastAired ? before(next, status.lastAired) : false
        const airDate = !aired && status.next && status.next.season === next.season && status.next.episode === next.episode ? status.next.date : undefined
        // Bijgekeken en niets gepland: niet tonen
        if (!aired && !airDate) return null
        const name = await episodeName(t.tmdbId, next.season, next.episode).catch(() => undefined)
        return { title: t, ...next, name, airDate }
      }),
    )
      .then((list) => !cancelled && setItems(list.filter((x): x is NextUp => !!x).sort((a, b) => Number(!!a.airDate) - Number(!!b.airDate))))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [titles])

  return items
}

// ---------- Binnenkort ----------

export interface UpcomingItem {
  item: WatchItem
  date: string
  kind: 'cinema' | 'episode' | 'season'
  season?: number
  episode?: number
  /** Waarom dit in je lijst staat */
  source: 'watchlist' | 'watching'
}

/** Films op je watchlist die nog uitkomen en nieuwe afleveringen/seizoenen van series die je volgt. */
export function useUpcoming(titles: TitleSummary[], watchlist: WatchItem[]): UpcomingItem[] {
  const [items, setItems] = useState<UpcomingItem[]>([])

  useEffect(() => {
    if (!hasApiKey()) return
    let cancelled = false
    const todayIso = today()
    const asItem = (t: { tmdbId: number; mediaType: MediaType; title: string; posterPath: string | null; backdropPath?: string | null; year?: string }): WatchItem =>
      ({ tmdbId: t.tmdbId, mediaType: t.mediaType, title: t.title, posterPath: t.posterPath, backdropPath: t.backdropPath, year: t.year, addedAt: 0 })

    const series = new Map<number, { item: WatchItem; source: UpcomingItem['source'] }>()
    for (const t of titles) if (t.mediaType === 'tv') series.set(t.tmdbId, { item: asItem(t), source: 'watching' })
    for (const w of watchlist) if (w.mediaType === 'tv' && !series.has(w.tmdbId)) series.set(w.tmdbId, { item: w, source: 'watchlist' })
    const movies = watchlist.filter((w) => w.mediaType === 'movie' && (!w.year || Number(w.year) >= new Date().getFullYear() - 1))

    Promise.all([
      ...[...series.values()].slice(0, 30).map(async ({ item, source }): Promise<UpcomingItem | null> => {
        const status = await tvStatus(item.tmdbId)
        if (!status.next || status.next.date < todayIso) return null
        return { item, date: status.next.date, kind: status.next.episode === 1 ? 'season' : 'episode', season: status.next.season, episode: status.next.episode, source }
      }),
      ...movies.slice(0, 30).map(async (item): Promise<UpcomingItem | null> => {
        const date = await cached(`movie:${item.tmdbId}`, () => fetchMovieRelease(item.tmdbId))
        return date && date >= todayIso ? { item, date, kind: 'cinema', source: 'watchlist' } : null
      }),
    ].map((p) => p.catch(() => null)))
      .then((list) => !cancelled && setItems(list.filter((x): x is UpcomingItem => !!x).sort((a, b) => a.date.localeCompare(b.date))))
    return () => {
      cancelled = true
    }
  }, [titles, watchlist])

  return items
}
