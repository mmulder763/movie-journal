import { useEffect, useState } from 'react'
import type { SearchResult } from '../types'
import { hasApiKey, searchTitles } from '../lib/tmdb'
import { Poster } from './Poster'

interface Props {
  onPick: (result: SearchResult) => void
}

export function SearchStep({ onPick }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
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
  }, [query])

  if (!hasApiKey()) {
    return (
      <p className="error">
        Geen TMDB API key gevonden. Zet <code>VITE_TMDB_API_KEY</code> in een <code>.env</code> bestand en herstart de dev-server.
      </p>
    )
  }

  return (
    <div className="search-step">
      <input
        type="search"
        autoFocus
        placeholder="Zoek een film of serie…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <p className="muted small">Zoeken…</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 && (
        <p className="muted small">Niets gevonden.</p>
      )}
      <ul className="search-results">
        {results.map((r) => (
          <li key={`${r.mediaType}-${r.tmdbId}`}>
            <button className="search-result" onClick={() => onPick(r)}>
              <Poster path={r.posterPath} title={r.title} size="w92" />
              <div>
                <strong>{r.title}</strong>
                <span className="muted small">
                  {r.mediaType === 'tv' ? 'Serie' : 'Film'}
                  {r.year && ` · ${r.year}`}
                </span>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
