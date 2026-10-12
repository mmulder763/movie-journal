import { useEffect, useState } from 'react'
import type { MediaType } from '../types'
import { fetchImdbId } from './tmdb'
import { omdbKey } from './keys'

export const hasOmdbKey = () => Boolean(omdbKey())

export interface Ratings {
  imdbId: string
  imdb?: { score: string; votes?: string }
  rottenTomatoes?: string
  metacritic?: string
}

const CACHE_PREFIX = 'movie-journal:ratings:v1:'
// Scores veranderen langzaam; 7 dagen cachen spaart het OMDb-dagquotum (1000 requests)
const TTL_MS = 7 * 24 * 60 * 60 * 1000

interface OmdbResponse {
  Response: 'True' | 'False'
  Error?: string
  imdbRating?: string
  imdbVotes?: string
  Ratings?: { Source: string; Value: string }[]
}

const present = (v?: string) => (v && v !== 'N/A' ? v : undefined)

async function fetchRatings(mediaType: MediaType, tmdbId: number): Promise<Ratings | null> {
  const imdbId = await fetchImdbId(mediaType, tmdbId)
  if (!imdbId) return null
  const res = await fetch(`https://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey()}`)
  if (!res.ok) throw new Error(`OMDb-fout ${res.status}`)
  const data = (await res.json()) as OmdbResponse
  if (data.Response === 'False') throw new Error(data.Error ?? 'OMDb-fout')
  const source = (name: string) => present(data.Ratings?.find((r) => r.Source === name)?.Value)
  const score = present(data.imdbRating)
  return {
    imdbId,
    imdb: score ? { score, votes: present(data.imdbVotes) } : undefined,
    rottenTomatoes: source('Rotten Tomatoes'),
    metacritic: source('Metacritic'),
  }
}

// Gelijktijdige aanvragen voor dezelfde titel delen één request
const inFlight = new Map<string, Promise<Ratings | null>>()

function readCache(id: string): Ratings | null | undefined {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id)
    if (!raw) return undefined
    const { at, value } = JSON.parse(raw) as { at: number; value: Ratings | null }
    return Date.now() - at < TTL_MS ? value : undefined
  } catch {
    return undefined
  }
}

function loadRatings(mediaType: MediaType, tmdbId: number): Promise<Ratings | null> {
  const id = `${mediaType}-${tmdbId}`
  const cached = readCache(id)
  if (cached !== undefined) return Promise.resolve(cached)
  let pending = inFlight.get(id)
  if (!pending) {
    pending = fetchRatings(mediaType, tmdbId)
      .then((value) => {
        try {
          localStorage.setItem(CACHE_PREFIX + id, JSON.stringify({ at: Date.now(), value }))
        } catch { /* cache vol: dan volgende keer opnieuw ophalen */ }
        return value
      })
      .finally(() => inFlight.delete(id))
    inFlight.set(id, pending)
  }
  return pending
}

export type RatingsState = { state: 'idle' } | { state: 'loading' } | { state: 'done'; ratings: Ratings | null } | { state: 'error'; error: string }

/** IMDb / Rotten Tomatoes / Metacritic voor een titel (via TMDB → IMDb-id → OMDb). */
export function useRatings(item: { mediaType: MediaType; tmdbId: number } | undefined): RatingsState {
  const [result, setResult] = useState<RatingsState>({ state: 'idle' })
  const mediaType = item?.mediaType
  const tmdbId = item?.tmdbId

  useEffect(() => {
    if (!hasOmdbKey() || !mediaType || tmdbId == null) return setResult({ state: 'idle' })
    let cancelled = false
    setResult({ state: 'loading' })
    loadRatings(mediaType, tmdbId)
      .then((ratings) => !cancelled && setResult({ state: 'done', ratings }))
      .catch((err) => !cancelled && setResult({ state: 'error', error: (err as Error).message }))
    return () => {
      cancelled = true
    }
  }, [mediaType, tmdbId])

  return result
}
