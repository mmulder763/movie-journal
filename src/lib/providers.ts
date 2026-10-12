import { useEffect, useState } from 'react'
import type { WatchItem } from '../types'
import { fetchStreamingNL, hasApiKey, type Provider } from './tmdb'
import { titleKey } from './titles'

const CACHE_PREFIX = 'movie-journal:providers:v1:'
// Streamingaanbod wisselt geregeld
const TTL_MS = 3 * 86_400_000

function readCache(key: string): Provider[] | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return undefined
    const { at, value } = JSON.parse(raw) as { at: number; value: Provider[] }
    return Date.now() - at < TTL_MS ? value : undefined
  } catch {
    return undefined
  }
}

const CONCURRENCY = 4

/** NL-streamingdiensten per watchlist-titel (key → providers); ontbrekende worden op de achtergrond opgehaald. */
export function useStreamingProviders(items: WatchItem[]): Record<string, Provider[]> {
  const [providers, setProviders] = useState<Record<string, Provider[]>>({})

  useEffect(() => {
    let cancelled = false
    const cached: Record<string, Provider[]> = {}
    const missing: WatchItem[] = []
    for (const item of items) {
      const key = titleKey(item)
      if (providers[key]) continue
      const hit = readCache(key)
      if (hit) cached[key] = hit
      else missing.push(item)
    }
    if (Object.keys(cached).length) setProviders((p) => ({ ...p, ...cached }))
    if (!hasApiKey() || missing.length === 0) return

    const queue = [...missing]
    const worker = async () => {
      for (let item = queue.shift(); item && !cancelled; item = queue.shift()) {
        const key = titleKey(item)
        try {
          const value = await fetchStreamingNL(item.mediaType, item.tmdbId)
          try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), value }))
          } catch { /* cache vol */ }
          if (!cancelled) setProviders((p) => ({ ...p, [key]: value }))
        } catch (err) {
          console.warn(`Streamingdiensten voor "${item.title}" ophalen mislukt`, err)
        }
      }
    }
    void Promise.all(Array.from({ length: CONCURRENCY }, worker))
    return () => {
      cancelled = true
    }
    // Alleen opnieuw kijken als de lijst verandert, niet bij elke binnengekomen provider
  }, [items])

  return providers
}
