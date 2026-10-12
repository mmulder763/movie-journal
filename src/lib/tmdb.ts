import type { MediaType, SearchResult } from '../types'
import { tmdbKey } from './keys'

const API_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'
const LANGUAGE = 'nl-NL'

export const hasApiKey = () => Boolean(tmdbKey())

// Een v4 Read Access Token is een JWT; een v3 key is een korte hex-string.
const isBearerToken = (k: string) => k.startsWith('eyJ')

async function request<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const key = tmdbKey()
  if (!key) throw new Error('Geen TMDB API key ingesteld.')

  const url = new URL(API_BASE + path)
  url.search = new URLSearchParams({ language: LANGUAGE, ...params }).toString()
  const headers: HeadersInit = { accept: 'application/json' }
  if (isBearerToken(key)) headers.Authorization = `Bearer ${key}`
  else url.searchParams.set('api_key', key)

  const res = await fetch(url, { headers, signal })
  if (!res.ok) throw new Error(`TMDB-fout ${res.status}`)
  return res.json() as Promise<T>
}

interface ApiResult {
  id: number
  media_type?: 'movie' | 'tv' | 'person'
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path: string | null
  release_date?: string
  first_air_date?: string
  overview?: string
  vote_average?: number
}

function toResult(r: ApiResult, mediaType: MediaType): SearchResult {
  return {
    tmdbId: r.id,
    mediaType,
    title: r.title ?? r.name ?? 'Onbekend',
    posterPath: r.poster_path,
    backdropPath: r.backdrop_path,
    year: (r.release_date ?? r.first_air_date)?.slice(0, 4) || undefined,
    overview: r.overview ?? '',
    voteAverage: r.vote_average,
  }
}

const isTitle = (r: ApiResult): r is ApiResult & { media_type: MediaType } =>
  r.media_type === 'movie' || r.media_type === 'tv'

/** Zoekt films én series in één keer. */
export async function searchTitles(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const data = await request<{ results: ApiResult[] }>('/search/multi', { query, include_adult: 'false' }, signal)
  return data.results.filter(isTitle).map((r) => toResult(r, r.media_type))
}

export type DeckSource = 'trending' | 'movie-popular' | 'movie-top' | 'tv-popular' | 'tv-top'

export const DECK_SOURCES: [DeckSource, string][] = [
  ['trending', 'Trending'],
  ['movie-top', 'Top films'],
  ['movie-popular', 'Populaire films'],
  ['tv-top', 'Top series'],
  ['tv-popular', 'Populaire series'],
]

const SOURCE_PATHS: Record<DeckSource, [string, MediaType | null]> = {
  trending: ['/trending/all/week', null],
  'movie-popular': ['/movie/popular', 'movie'],
  'movie-top': ['/movie/top_rated', 'movie'],
  'tv-popular': ['/tv/popular', 'tv'],
  'tv-top': ['/tv/top_rated', 'tv'],
}

/** Eén pagina (20 titels) uit een TMDB-lijst, voor de swipe-stapel. */
export async function fetchDeckPage(source: DeckSource, page: number): Promise<{ results: SearchResult[]; hasMore: boolean }> {
  const [path, type] = SOURCE_PATHS[source]
  const data = await request<{ results: ApiResult[]; page: number; total_pages: number }>(path, { page: String(page) })
  const results = type
    ? data.results.map((r) => toResult(r, type))
    : data.results.filter(isTitle).map((r) => toResult(r, r.media_type))
  return { results, hasMore: data.page < Math.min(data.total_pages, 500) }
}

interface ReleaseDates {
  results: { iso_3166_1: string; release_dates: { type: number; release_date: string }[] }[]
}

/** TMDB release types: 2 = beperkte bioscooprelease, 3 = bioscooprelease */
const THEATRICAL = new Set([2, 3])

/** Eerste Nederlandse bioscoopdatum (YYYY-MM-DD) van een film, of null als TMDB die niet kent. */
export async function fetchCinemaDate(tmdbId: number, country = 'NL'): Promise<string | null> {
  const data = await request<ReleaseDates>(`/movie/${tmdbId}/release_dates`)
  const dates = data.results
    .find((r) => r.iso_3166_1 === country)
    ?.release_dates.filter((d) => THEATRICAL.has(d.type))
    .map((d) => d.release_date.slice(0, 10))
    .sort()
  return dates?.[0] ?? null
}

/** IMDb-id (tt…) van een film of serie, of null als TMDB die niet heeft. */
export async function fetchImdbId(mediaType: MediaType, tmdbId: number): Promise<string | null> {
  const data = await request<{ imdb_id?: string | null }>(`/${mediaType}/${tmdbId}/external_ids`)
  return data.imdb_id || null
}

/** Speelduur van een film in minuten (0 als onbekend). */
export async function fetchMovieRuntime(tmdbId: number): Promise<number> {
  const data = await request<{ runtime?: number | null }>(`/movie/${tmdbId}`)
  return data.runtime ?? 0
}

interface SeasonDetails {
  episodes?: { episode_number: number; runtime?: number | null }[]
}

/**
 * Duur (minuten) van elke aflevering per seizoen, zonder specials (seizoen 0).
 * Onbekende afleveringen krijgen de mediaan van de bekende als schatting.
 */
export async function fetchEpisodeRuntimes(tmdbId: number): Promise<Record<number, number[]>> {
  const show = await request<{ seasons?: { season_number: number; episode_count: number }[] }>(`/tv/${tmdbId}`)
  const seasonNumbers = (show.seasons ?? []).filter((s) => s.season_number > 0 && s.episode_count > 0).map((s) => s.season_number)

  // append_to_response staat max. 20 onderdelen per request toe
  const seasons: Record<number, (number | null)[]> = {}
  for (let i = 0; i < seasonNumbers.length; i += 20) {
    const chunk = seasonNumbers.slice(i, i + 20)
    const data = await request<Record<string, SeasonDetails>>(`/tv/${tmdbId}`, {
      append_to_response: chunk.map((n) => `season/${n}`).join(','),
    })
    for (const n of chunk) {
      seasons[n] = (data[`season/${n}`]?.episodes ?? [])
        .sort((a, b) => a.episode_number - b.episode_number)
        .map((e) => e.runtime ?? null)
    }
  }

  const known = Object.values(seasons).flat().filter((r): r is number => r != null && r > 0).sort((a, b) => a - b)
  const fallback = known.length ? known[Math.floor(known.length / 2)] : 0
  return Object.fromEntries(Object.entries(seasons).map(([n, eps]) => [n, eps.map((r) => (r && r > 0 ? r : fallback))]))
}

export interface TitleDetails {
  tagline?: string
  overview?: string
  genres: string[]
  /** Releasedatum film / eerste uitzending serie (YYYY-MM-DD) */
  releaseDate?: string
  /** Film: speelduur in minuten */
  runtime?: number
  /** Serie */
  seasons?: number
  episodes?: number
  status?: string
  originalTitle?: string
  originalLanguage?: string
  /** Regisseur(s) of makers */
  creators: { label: string; names: string[] }
  cast: { name: string; character?: string; profilePath: string | null }[]
  trailerKey?: string
  /** Streaming (abonnement) in Nederland */
  streaming: { name: string; logoPath: string }[]
  /** Huur/koop in Nederland */
  rentBuy: { name: string; logoPath: string }[]
  watchLink?: string
  tmdbScore?: number
}

interface DetailsResponse {
  tagline?: string
  overview?: string
  genres?: { name: string }[]
  release_date?: string
  first_air_date?: string
  runtime?: number | null
  number_of_seasons?: number
  number_of_episodes?: number
  status?: string
  original_title?: string
  original_name?: string
  original_language?: string
  vote_average?: number
  created_by?: { name: string }[]
  credits?: { cast?: { name: string; character?: string; profile_path: string | null }[]; crew?: { name: string; job: string }[] }
  videos?: { results?: { key: string; site: string; type: string; official?: boolean; iso_639_1?: string }[] }
  'watch/providers'?: { results?: Record<string, { link?: string } & Partial<Record<'flatrate' | 'rent' | 'buy', { provider_name: string; logo_path: string }[]>>> }
}

const STATUS_NL: Record<string, string> = {
  'Returning Series': 'Loopt nog', Ended: 'Afgelopen', Canceled: 'Stopgezet', 'In Production': 'In productie', Planned: 'Gepland', Released: 'Uitgebracht',
}

/** Algemene info voor het detailscherm, in één request (credits, trailers en NL-streaming erbij). */
export async function fetchTitleDetails(mediaType: MediaType, tmdbId: number): Promise<TitleDetails> {
  const d = await request<DetailsResponse>(`/${mediaType}/${tmdbId}`, {
    append_to_response: 'credits,videos,watch/providers',
    include_video_language: 'nl,en,null',
  })

  const trailers = (d.videos?.results ?? []).filter((v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'))
  const trailer =
    trailers.find((v) => v.type === 'Trailer' && v.iso_639_1 === 'nl') ??
    trailers.find((v) => v.type === 'Trailer' && v.official) ??
    trailers.find((v) => v.type === 'Trailer') ??
    trailers[0]

  const nl = d['watch/providers']?.results?.NL
  const providers = (list?: { provider_name: string; logo_path: string }[]) =>
    (list ?? []).map((p) => ({ name: p.provider_name, logoPath: p.logo_path }))
  const streaming = providers(nl?.flatrate)
  const rentBuy = [...providers(nl?.rent), ...providers(nl?.buy)].filter(
    (p, i, all) => all.findIndex((q) => q.name === p.name) === i && !streaming.some((s) => s.name === p.name),
  )

  const directors = (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name)
  const creators = mediaType === 'tv'
    ? { label: 'Bedacht door', names: (d.created_by ?? []).map((c) => c.name) }
    : { label: directors.length > 1 ? 'Regisseurs' : 'Regie', names: directors }

  return {
    tagline: d.tagline || undefined,
    overview: d.overview || undefined,
    genres: (d.genres ?? []).map((g) => g.name),
    releaseDate: (d.release_date || d.first_air_date) || undefined,
    runtime: d.runtime || undefined,
    seasons: d.number_of_seasons,
    episodes: d.number_of_episodes,
    status: d.status && mediaType === 'tv' ? (STATUS_NL[d.status] ?? d.status) : undefined,
    originalTitle: d.original_title ?? d.original_name,
    originalLanguage: d.original_language,
    creators,
    cast: (d.credits?.cast ?? []).slice(0, 12).map((c) => ({ name: c.name, character: c.character || undefined, profilePath: c.profile_path })),
    trailerKey: trailer?.key,
    streaming,
    rentBuy,
    watchLink: nl?.link,
    tmdbScore: d.vote_average || undefined,
  }
}

export interface Provider {
  id: number
  name: string
  logoPath: string
}

/** Streamingdiensten (abonnement) waar een titel nu in Nederland op staat. */
export async function fetchStreamingNL(mediaType: MediaType, tmdbId: number): Promise<Provider[]> {
  const data = await request<{ results?: Record<string, { flatrate?: { provider_id: number; provider_name: string; logo_path: string }[] }> }>(
    `/${mediaType}/${tmdbId}/watch/providers`,
  )
  return (data.results?.NL?.flatrate ?? []).map((p) => ({ id: p.provider_id, name: p.provider_name, logoPath: p.logo_path }))
}

export interface TitleMeta {
  genres: string[]
  /** Regisseurs (film) of makers (serie) */
  creators: string[]
  cast: { id: number; name: string; profilePath: string | null }[]
}

/** Lichte variant van de details voor statistieken: genres, regie/makers en de eerste 8 castleden. */
export async function fetchTitleMeta(mediaType: MediaType, tmdbId: number): Promise<TitleMeta> {
  const d = await request<{
    genres?: { name: string }[]
    created_by?: { name: string }[]
    credits?: { cast?: { id: number; name: string; profile_path: string | null }[]; crew?: { name: string; job: string }[] }
  }>(`/${mediaType}/${tmdbId}`, { append_to_response: 'credits' })
  return {
    genres: (d.genres ?? []).map((g) => g.name),
    creators: mediaType === 'tv'
      ? (d.created_by ?? []).map((c) => c.name)
      : (d.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name),
    cast: (d.credits?.cast ?? []).slice(0, 8).map((c) => ({ id: c.id, name: c.name, profilePath: c.profile_path })),
  }
}

export interface SeasonInfo {
  number: number
  name: string
  episodeCount: number
}

export interface EpisodeInfo {
  number: number
  name: string
  runtime?: number
  airDate?: string
}

/** Seizoenen van een serie (specials/seizoen 0 achteraan). */
export async function fetchSeasons(tvId: number): Promise<SeasonInfo[]> {
  const d = await request<{ seasons?: { season_number: number; name: string; episode_count: number }[] }>(`/tv/${tvId}`)
  return (d.seasons ?? [])
    .filter((s) => s.episode_count > 0)
    .map((s) => ({ number: s.season_number, name: s.name, episodeCount: s.episode_count }))
    .sort((a, b) => (a.number === 0 ? 1 : b.number === 0 ? -1 : a.number - b.number))
}

/** Afleveringen van één seizoen. */
export async function fetchSeasonEpisodes(tvId: number, season: number): Promise<EpisodeInfo[]> {
  const d = await request<{ episodes?: { episode_number: number; name: string; runtime?: number | null; air_date?: string | null }[] }>(
    `/tv/${tvId}/season/${season}`,
  )
  return (d.episodes ?? []).map((e) => ({
    number: e.episode_number,
    name: e.name,
    runtime: e.runtime || undefined,
    airDate: e.air_date || undefined,
  }))
}

export const profileUrl = (path: string | null) => (path ? `${IMAGE_BASE}/w185${path}` : null)
export const logoUrl = (path: string) => `${IMAGE_BASE}/w92${path}`

export function posterUrl(path: string | null | undefined, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' = 'w185') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}

export function backdropUrl(path: string | null | undefined, size: 'w780' | 'w1280' = 'w780') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}
