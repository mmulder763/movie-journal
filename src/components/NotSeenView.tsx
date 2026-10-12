import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { MediaType, WatchItem } from '../types'
import { fetchBasic, hasApiKey } from '../lib/tmdb'
import { Poster } from './Poster'
import { TitlePreviewSheet } from './WatchItemSheet'
import { useStreamingProviders } from '../lib/providers'
import { logoUrl } from '../lib/tmdb'
import { SearchIcon } from './ListView'

interface Props {
  /** Sleutels van weggeswipete titels ("movie-123"), nieuwste achteraan */
  skipped: string[]
  /** Opgeslagen titelgegevens (ontbreken bij oudere skips) */
  items: WatchItem[]
  onSeen: (item: WatchItem) => void
  onWatchlist: (item: WatchItem) => void
  /** Van de lijst halen, zodat de titel weer in de swipe-stapel kan komen */
  onRestore: (key: string) => void
}

const keyOf = (t: { mediaType: string; tmdbId: number }) => `${t.mediaType}-${t.tmdbId}`

/** Alles wat je bij het swipen als "niet gezien" naar links veegde. */
export function NotSeenView({ skipped, items, onSeen, onWatchlist, onRestore }: Props) {
  const [fetched, setFetched] = useState<Record<string, WatchItem>>({})
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<WatchItem | null>(null)

  // Oudere skips hebben alleen een sleutel: titel en poster alsnog ophalen
  useEffect(() => {
    if (!hasApiKey()) return
    const known = new Set(items.map(keyOf))
    const missing = skipped.filter((k) => !known.has(k) && !fetched[k])
    let cancelled = false
    for (const key of missing.slice(0, 40)) {
      const [mediaType, id] = key.split('-') as [MediaType, string]
      fetchBasic(mediaType, Number(id))
        .then((r) => !cancelled && setFetched((f) => ({ ...f, [key]: { ...r, addedAt: 0 } })))
        .catch(() => {})
    }
    return () => {
      cancelled = true
    }
  }, [skipped, items, fetched])

  const list = useMemo(() => {
    const byKey = new Map(items.map((w) => [keyOf(w), w]))
    const q = query.trim().toLowerCase()
    return [...skipped]
      .reverse()
      .map((k) => byKey.get(k) ?? fetched[k])
      .filter((w): w is WatchItem => !!w && (!q || w.title.toLowerCase().includes(q)))
  }, [skipped, items, fetched, query])

  const providers = useStreamingProviders(list)

  if (skipped.length === 0) {
    return (
      <div className="list-empty">
        <span className="list-empty-icon">✕</span>
        <h3>Nog niets weggeswipet</h3>
        <p className="muted">Titels die je bij het swipen naar links veegt (niet gezien), komen hier te staan.</p>
      </div>
    )
  }

  return (
    <section className="list-view">
      <div className="list-search">
        <SearchIcon />
        <input type="search" placeholder={`Zoek in ${skipped.length} niet gezien…`} value={query} onChange={(e) => setQuery(e.target.value)} />
        {query && <button className="list-search-clear" onClick={() => setQuery('')} aria-label="Wissen">✕</button>}
      </div>
      <p className="muted small">Toch gezien? Tik op ✓. Met ↺ kan een titel weer in je swipe-stapel verschijnen.</p>
      <ul className="poster-wall list-wall">
        {list.map((w, i) => (
          <li key={keyOf(w)} className="rise" style={{ '--i': Math.min(i, 24) } as CSSProperties}>
            <div className="wall-item notseen-item">
              <button className="wall-poster" onClick={() => setOpen(w)} aria-label={`Details van ${w.title}`}>
                <Poster path={w.posterPath} title={w.title} size="w342" />
                {(providers[keyOf(w)] ?? []).length > 0 && (
                  <span className="wall-providers">
                    {providers[keyOf(w)].slice(0, 3).map((p) => <img key={p.name} src={logoUrl(p.logoPath)} alt={p.name} title={p.name} />)}
                  </span>
                )}
              </button>
              <button className="wall-title notseen-title" onClick={() => setOpen(w)}>{w.title}</button>
              <span className="muted small">{w.mediaType === 'tv' ? 'Serie' : 'Film'}{w.year && ` · ${w.year}`}</span>
              <div className="notseen-actions">
                <button onClick={() => onSeen(w)} title="Toch gezien" aria-label={`${w.title}: toch gezien`}>✓</button>
                <button onClick={() => onWatchlist(w)} title="Op mijn watchlist" aria-label={`${w.title} op watchlist`}>🔖</button>
                <button onClick={() => onRestore(keyOf(w))} title="Terug in de swipe-stapel" aria-label={`${w.title} terug in swipe`}>↺</button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {open && (
        <TitlePreviewSheet item={open} status="✕ Bij swipen als niet gezien gemarkeerd" onClose={() => setOpen(null)}>
          <button className="btn-primary" onClick={() => { setOpen(null); onSeen(open) }}>✓ Toch gezien</button>
          <button className="btn-ghost" onClick={() => { setOpen(null); onWatchlist(open) }}>🔖 Op watchlist</button>
          <button className="btn-text" onClick={() => { setOpen(null); onRestore(keyOf(open)) }}>↺ Terug in swipe</button>
        </TitlePreviewSheet>
      )}
    </section>
  )
}
