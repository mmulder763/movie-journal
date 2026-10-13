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
  vote_count?: number
  genre_ids?: number[]
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
    genreIds: r.genre_ids,
  }
}

const isTitle = (r: ApiResult): r is ApiResult & { media_type: MediaType } =>
  r.media_type === 'movie' || r.media_type === 'tv'

/** Zoekt films én series in één keer. */
export async function searchTitles(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  const data = await request<{ results: ApiResult[] }>('/search/multi', { query, include_adult: 'false' }, signal)
  return data.results.filter(isTitle).map((r) => toResult(r, r.media_type))
}

export type DeckSource = 'random' | 'movie' | 'tv' | 'popular' | 'top'

export const DECK_SOURCES: [DeckSource, string][] = [
  ['random', 'Alles'],
  ['movie', 'Films'],
  ['tv', 'Series'],
  ['popular', 'Populair'],
  ['top', 'Best beoordeeld'],
]

/** Samengestelde lijsten (TMDB-lijsten) om in volgorde door te swipen */
export interface CuratedList {
  id: number
  name: string
  description: string
}

export const CURATED_LISTS: CuratedList[] = [
  { id: 634, name: 'IMDb Top 250', description: 'De 250 best beoordeelde films op IMDb' },
  { id: 28, name: 'Oscarwinnaars', description: 'Alle winnaars van de Oscar voor Beste Film' },
  { id: 10, name: 'Grootste kaskrakers', description: 'De 50 films met de hoogste opbrengst ooit' },
  { id: 1, name: 'Marvel', description: 'Alle films en series uit het Marvel-universum' },
]

/** Alle titels van een TMDB-lijst, in volgorde, met hun positie */
export async function fetchCuratedList(id: number): Promise<SearchResult[]> {
  // De lijst-API geeft 20 titels per pagina: eerst pagina 1, dan de rest tegelijk
  const first = await request<{ items: ApiResult[]; total_pages?: number }>(`/list/${id}`, { page: '1' })
  const pages = Math.min(first.total_pages ?? 1, 20)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, i) => request<{ items: ApiResult[] }>(`/list/${id}`, { page: String(i + 2) })),
  )
  return [first, ...rest].flatMap((d) => d.items)
    .filter(isTitle)
    .filter((r) => r.poster_path)
    .map((r, i) => ({ ...toResult(r, r.media_type), rank: i + 1 }))
}

/** Willekeurige volgorde (Fisher–Yates) */
function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

// Willekeurig, maar wel bekende titels: alleen films/series met genoeg stemmen, met een willekeurige
// sortering zodat je niet steeds dezelfde top-lijst krijgt
const SORTS = ['popularity.desc', 'vote_count.desc', 'vote_average.desc', 'revenue.desc', 'primary_release_date.desc']

function randomDiscover(type: MediaType): Record<string, string> {
  let sort = pick(SORTS)
  if (type === 'tv') sort = sort === 'revenue.desc' ? 'popularity.desc' : sort.replace('primary_release_date', 'first_air_date')
  return {
    include_adult: 'false',
    sort_by: sort,
    'vote_count.gte': type === 'movie' ? '1000' : '300',
  }
}

/** Aantal pagina's per lijst (eenmalig opgehaald), zodat we een willekeurige pagina kunnen kiezen */
const totalPages = new Map<string, Promise<number>>()

function pagesFor(path: string, params: Record<string, string>, cap: number) {
  const key = path + JSON.stringify(params)
  let p = totalPages.get(key)
  if (!p) {
    p = request<{ total_pages: number }>(path, params).then((d) => Math.max(1, Math.min(d.total_pages, cap)))
    p.catch(() => totalPages.delete(key))
    totalPages.set(key, p)
  }
  return p
}

/**
 * Eén willekeurige pagina (±20 titels) voor de swipe-stapel, door elkaar geschud.
 * `used` houdt per lijst bij welke pagina's al geweest zijn, zodat er geen herhalingen komen;
 * levert een lege array als een lijst op is.
 */
/** Wat de stapel over je smaak weet */
export interface Taste {
  /** Titels die je zag of leuk vond (nieuwste eerst), voor aanbevelingen */
  seeds: { tmdbId: number; mediaType: MediaType }[]
  /** Genre-id → gewicht (positief = vaker), per type */
  genres: Record<MediaType, Map<number, number>>
}

/** Kans dat een ronde "voor jou" is in plaats van willekeurig populair */
const PERSONAL_SHARE = 0.6

/**
 * Eén ronde voor de swipe-stapel, geschud. Mengt "voor jou" (TMDB-aanbevelingen bij titels die je zag,
 * of je favoriete genres) met willekeurige populaire titels, zodat je ook nieuwe dingen blijft zien.
 */
export async function fetchRandomDeck(source: DeckSource, used: Set<string>, taste?: Taste): Promise<SearchResult[]> {
  if (source === 'popular' || source === 'top') return shuffle(await randomPage(source, pick<MediaType>(['movie', 'tv']), used))
  const types: MediaType[] = source === 'random' ? ['movie', 'tv'] : [source]
  const pages = await Promise.all(types.map((type) => roundFor(type, used, taste)))
  return shuffle(pages.flat())
}

async function roundFor(type: MediaType, used: Set<string>, taste?: Taste): Promise<SearchResult[]> {
  if (taste && Math.random() < PERSONAL_SHARE) {
    const seeds = taste.seeds.filter((s) => s.mediaType === type)
    const topGenres = [...taste.genres[type]].filter(([, w]) => w > 0).sort((a, b) => b[1] - a[1]).slice(0, 4)
    // Aanbevelingen bij een recent gezien titel, of een pagina uit een van je favoriete genres
    if (seeds.length && (Math.random() < 0.5 || topGenres.length === 0)) {
      const seed = pick(seeds.slice(0, 25))
      const recs = await recommendations(seed.mediaType, seed.tmdbId, used)
      if (recs.length) return recs
    }
    if (topGenres.length) {
      const genre = weightedPick(topGenres)
      const page = await randomPage('discover', type, used, { with_genres: String(genre) })
      if (page.length) return page
    }
  }
  return randomPage('discover', type, used)
}

function weightedPick(weights: [number, number][]): number {
  const total = weights.reduce((n, [, w]) => n + w, 0)
  let r = Math.random() * total
  for (const [id, w] of weights) if ((r -= w) <= 0) return id
  return weights[0][0]
}

async function recommendations(type: MediaType, tmdbId: number, used: Set<string>): Promise<SearchResult[]> {
  const key = `rec:${type}:${tmdbId}`
  if (used.has(key)) return []
  used.add(key)
  const data = await request<{ results: ApiResult[] }>(`/${type}/${tmdbId}/recommendations`)
  // Ook hier: geen obscure titels
  const min = type === 'movie' ? 300 : 100
  return data.results.filter((r) => r.poster_path && (r.vote_count ?? 0) >= min).map((r) => toResult(r, type))
}

async function randomPage(list: 'discover' | 'popular' | 'top', type: MediaType, used: Set<string>, extra: Record<string, string> = {}): Promise<SearchResult[]> {
  const [path, params, cap] =
    list === 'popular'
      ? [`/${type}/popular`, {}, 100]
      : list === 'top'
        ? [`/${type}/top_rated`, {}, 100]
        : [`/discover/${type}`, { ...randomDiscover(type), ...extra }, 500]

  const total = await pagesFor(path, params, cap)
  const listKey = `${path}?${new URLSearchParams(params)}`
  const free = Array.from({ length: total }, (_, i) => i + 1).filter((n) => !used.has(`${listKey}:${n}`))
  if (free.length === 0) return []
  const page = pick(free)
  used.add(`${listKey}:${page}`)

  const data = await request<{ results: ApiResult[] }>(path, { ...params, page: String(page) })
  return data.results.filter((r) => r.poster_path).map((r) => toResult(r, type))
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

/** Basisgegevens van één titel (voor weggeswipete titels van vóór het opslaan van titelgegevens) */
export async function fetchBasic(mediaType: MediaType, tmdbId: number): Promise<SearchResult> {
  return toResult(await request<ApiResult>(`/${mediaType}/${tmdbId}`), mediaType)
}

/** Wat deze week populair is (films en series), voor suggesties in het zoekscherm */
export async function fetchTrending(): Promise<SearchResult[]> {
  const data = await request<{ results: ApiResult[] }>('/trending/all/week')
  return data.results.filter(isTitle).filter((r) => r.poster_path).map((r) => toResult(r, r.media_type))
}

export interface TvStatus {
  seasons: { number: number; episodeCount: number }[]
  lastAired?: { season: number; episode: number }
  next?: { season: number; episode: number; date: string; name?: string }
  inProduction: boolean
}

interface EpisodeRef { season_number: number; episode_number: number; air_date?: string | null; name?: string }

/** Afleveringsstand van een serie: seizoenen, laatst uitgezonden en eerstvolgende aflevering. */
export async function fetchTvStatus(tvId: number): Promise<TvStatus> {
  const d = await request<{
    seasons?: { season_number: number; episode_count: number }[]
    last_episode_to_air?: EpisodeRef | null
    next_episode_to_air?: EpisodeRef | null
    in_production?: boolean
  }>(`/tv/${tvId}`)
  return {
    seasons: (d.seasons ?? []).filter((x) => x.season_number > 0 && x.episode_count > 0).map((x) => ({ number: x.season_number, episodeCount: x.episode_count })),
    lastAired: d.last_episode_to_air ? { season: d.last_episode_to_air.season_number, episode: d.last_episode_to_air.episode_number } : undefined,
    next: d.next_episode_to_air?.air_date
      ? { season: d.next_episode_to_air.season_number, episode: d.next_episode_to_air.episode_number, date: d.next_episode_to_air.air_date, name: d.next_episode_to_air.name }
      : undefined,
    inProduction: !!d.in_production,
  }
}

/** Releasedatum van een film: eerste NL-bioscoopdatum, anders de algemene releasedatum. */
export async function fetchMovieRelease(tmdbId: number): Promise<string | null> {
  const nl = await fetchCinemaDate(tmdbId).catch(() => null)
  if (nl) return nl
  const d = await request<{ release_date?: string }>(`/movie/${tmdbId}`)
  return d.release_date || null
}

export const profileUrl = (path: string | null) => (path ? `${IMAGE_BASE}/w185${path}` : null)
export const logoUrl = (path: string) => `${IMAGE_BASE}/w92${path}`

export function posterUrl(path: string | null | undefined, size: 'w92' | 'w185' | 'w342' | 'w500' | 'w780' = 'w185') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}

export function backdropUrl(path: string | null | undefined, size: 'w780' | 'w1280' = 'w780') {
  return path ? `${IMAGE_BASE}/${size}${path}` : null
}
