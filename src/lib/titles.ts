import type { Entry, TitleSummary } from '../types'

export const titleKey = (e: Pick<Entry, 'mediaType' | 'tmdbId'>) => `${e.mediaType}-${e.tmdbId}`

/** Nieuwste datum eerst; entries zonder datum ("ooit gezien") achteraan. */
export const compareDatesDesc = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : b.localeCompare(a)

const byNewest = (a: Entry, b: Entry) => compareDatesDesc(a.date, b.date) || b.createdAt - a.createdAt

const average = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined)

/** Groepeert entries per titel (film of serie). */
export function summarizeTitles(entries: Entry[]): TitleSummary[] {
  const groups = new Map<string, Entry[]>()
  for (const e of entries) {
    const key = titleKey(e)
    groups.set(key, [...(groups.get(key) ?? []), e])
  }

  return [...groups.entries()].map(([key, list]) => {
    const watches = list.sort(byNewest)
    const latest = watches[0]
    return {
      key,
      tmdbId: latest.tmdbId,
      mediaType: latest.mediaType,
      title: latest.title,
      posterPath: latest.posterPath,
      backdropPath: watches.find((w) => w.backdropPath)?.backdropPath ?? null,
      year: latest.year,
      watches,
      lastDate: latest.date,
      avgRating: average(watches.map((w) => w.rating).filter((r): r is number => r != null)),
    }
  })
}

export interface Stats {
  movies: number
  series: number
  watchesThisYear: number
  avgRating?: number
}

export function computeStats(entries: Entry[], titles: TitleSummary[]): Stats {
  const year = String(new Date().getFullYear())
  return {
    movies: titles.filter((t) => t.mediaType === 'movie').length,
    series: titles.filter((t) => t.mediaType === 'tv').length,
    watchesThisYear: entries.filter((e) => e.date?.startsWith(year)).length,
    avgRating: average(entries.map((e) => e.rating).filter((r): r is number => r != null)),
  }
}
