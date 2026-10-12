import { useEffect, useState } from 'react'
import type { TitleSummary } from '../types'
import { fetchTitleMeta, hasApiKey, type TitleMeta } from './tmdb'

const CACHE_PREFIX = 'movie-journal:meta:v1:'
const TTL_MS = 30 * 86_400_000
const CONCURRENCY = 4

function readCache(key: string): TitleMeta | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return undefined
    const { at, value } = JSON.parse(raw) as { at: number; value: TitleMeta }
    return Date.now() - at < TTL_MS ? value : undefined
  } catch {
    return undefined
  }
}

/** Genres/regie/cast per titel (key → meta); ontbrekende worden op de achtergrond opgehaald. */
export function useTitleMeta(titles: TitleSummary[]): Record<string, TitleMeta> {
  const [meta, setMeta] = useState<Record<string, TitleMeta>>({})

  useEffect(() => {
    let cancelled = false
    const cached: Record<string, TitleMeta> = {}
    const missing: TitleSummary[] = []
    for (const t of titles) {
      if (meta[t.key]) continue
      const hit = readCache(t.key)
      if (hit) cached[t.key] = hit
      else missing.push(t)
    }
    if (Object.keys(cached).length) setMeta((m) => ({ ...m, ...cached }))
    if (!hasApiKey() || missing.length === 0) return

    const queue = [...missing]
    const worker = async () => {
      for (let t = queue.shift(); t && !cancelled; t = queue.shift()) {
        const title = t
        try {
          const value = await fetchTitleMeta(title.mediaType, title.tmdbId)
          try {
            localStorage.setItem(CACHE_PREFIX + title.key, JSON.stringify({ at: Date.now(), value }))
          } catch { /* cache vol */ }
          if (!cancelled) setMeta((m) => ({ ...m, [title.key]: value }))
        } catch (err) {
          console.warn(`Gegevens van "${title.title}" ophalen mislukt`, err)
        }
      }
    }
    void Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return () => {
      cancelled = true
    }
    // Alleen opnieuw kijken als de titels veranderen
  }, [titles])

  return meta
}
