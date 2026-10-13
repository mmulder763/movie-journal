import { useEffect, useState, type CSSProperties } from 'react'
import { CloseIcon, PlusIcon } from './Icons'
import { StarScore } from './StarRating'
import type { SearchResult, WatchItem } from '../types'
import { fetchTrending, hasApiKey, searchTitles } from '../lib/tmdb'
import { Poster } from './Poster'
import { SearchIcon } from './ListView'

interface Props {
  onPick: (result: SearchResult) => void
  /** Suggesties als er nog niets getypt is */
  watchlist?: WatchItem[]
}

// Populair-lijst één keer per sessie ophalen
let trendingCache: Promise<SearchResult[]> | null = null

export function SearchStep({ onPick, watchlist = [] }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [trending, setTrending] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const q = query.trim()

  useEffect(() => {
    if (!hasApiKey()) return
    trendingCache ??= fetchTrending().catch(() => [])
    let cancelled = false
    trendingCache.then((t) => !cancelled && setTrending(t))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      setError(null)
      try {
        setResults(await searchTitles(q, controller.signal))
      } catch (err) {
        if (!controller.signal.aborted) setError((err as Error).message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q])

  if (!hasApiKey()) return <p className="error">Geen TMDB API key ingesteld.</p>

  const asResult = (w: WatchItem): SearchResult => ({ ...w, backdropPath: w.backdropPath ?? null, overview: '' })

  return (
    <div className="search-step">
      <div className="list-search">
        <SearchIcon />
        <input type="search" autoFocus enterKeyHint="search" placeholder="Zoek een film of serie…" value={query}
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && query && (e.stopPropagation(), setQuery(''))} />
        {query && <button className="list-search-clear" onClick={() => setQuery('')} aria-label="Wissen"><CloseIcon size={16} /></button>}
      </div>

      <div className="search-body">
        {q.length < 2 ? (
          <>
            {watchlist.length > 0 && <Suggestions title="Van je watchlist" items={watchlist.map(asResult)} onPick={onPick} />}
            {trending.length > 0 && <Suggestions title="Populair deze week" items={trending} onPick={onPick} />}
          </>
        ) : loading && results.length === 0 ? (
          <ul className="search-results">
            {Array.from({ length: 4 }, (_, i) => <li key={i} className="result-skeleton" />)}
          </ul>
        ) : error ? (
          <p className="error">{error}</p>
        ) : results.length === 0 ? (
          <p className="empty">Niets gevonden voor “{q}”.</p>
        ) : (
          <ul className="search-results">
            {results.map((r, i) => (
              <li key={`${r.mediaType}-${r.tmdbId}`} style={{ '--i': Math.min(i, 10) } as CSSProperties}>
                <button className="search-result" onClick={() => onPick(r)}>
                  <Poster path={r.posterPath} title={r.title} size="w185" />
                  <div>
                    <strong>{r.title}</strong>
                    <span className="meta-line">
                      <span className={`badge badge-${r.mediaType}`}>{r.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
                      {r.year && <span className="muted small">{r.year}</span>}
                      {r.voteAverage != null && r.voteAverage > 0 && <span className="tmdb-score"><StarScore value={r.voteAverage} size={12} /></span>}
                    </span>
                    {r.overview && <span className="result-overview">{r.overview}</span>}
                  </div>
                  <span className="result-add" aria-hidden><PlusIcon size={18} /></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Suggestions({ title, items, onPick }: { title: string; items: SearchResult[]; onPick: (r: SearchResult) => void }) {
  return (
    <div className="search-suggestions">
      <h4 className="section-label">{title}</h4>
      <ul>
        {items.slice(0, 12).map((r, i) => (
          <li key={`${r.mediaType}-${r.tmdbId}`} style={{ '--i': i } as CSSProperties}>
            <button onClick={() => onPick(r)} title={r.title}>
              <Poster path={r.posterPath} title={r.title} size="w185" />
              <span>{r.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
