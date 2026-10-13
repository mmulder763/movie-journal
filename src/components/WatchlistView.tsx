import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { BookmarkIcon, CheckIcon, CloseIcon, DiceIcon, PlusIcon } from './Icons'
import type { SearchResult, WatchItem } from '../types'
import { logoUrl, searchTitles, type Provider } from '../lib/tmdb'
import { titleKey } from '../lib/titles'
import { useStreamingProviders } from '../lib/providers'
import { Poster } from './Poster'
import { SearchIcon } from './ListView'

interface Props {
  items: WatchItem[]
  /** Titels die al gezien zijn (om zoekresultaten te markeren) */
  seenKeys: Set<string>
  onAdd: (result: SearchResult) => void
  onOpen: (item: WatchItem) => void
}

export function WatchlistView({ items, seenKeys, onAdd, onOpen }: Props) {
  const providers = useStreamingProviders(items)
  const [service, setService] = useState<string>('all')
  const [picking, setPicking] = useState(false)

  // Alleen diensten tonen waar minstens één watchlist-titel op staat
  const services = useMemo(() => {
    const counts = new Map<string, { provider: Provider; count: number }>()
    for (const item of items) {
      for (const p of providers[titleKey(item)] ?? []) {
        const current = counts.get(p.name)
        counts.set(p.name, { provider: p, count: (current?.count ?? 0) + 1 })
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count)
  }, [items, providers])

  const visible = useMemo(
    () => (service === 'all' ? items : items.filter((i) => providers[titleKey(i)]?.some((p) => p.name === service))),
    [items, providers, service],
  )

  return (
    <section className="watchlist-view">
      <WatchlistSearch watchKeys={new Set(items.map(titleKey))} seenKeys={seenKeys} onAdd={onAdd} />

      {items.length === 0 ? (
        <div className="list-empty">
          <span className="list-empty-icon"><BookmarkIcon size={44} /></span>
          <h3>Nog niets op je watchlist</h3>
          <p className="muted">Zoek hierboven een titel, veeg bij het swipen omhoog, of pak iets van een vriend.</p>
        </div>
      ) : (
        <>
          <div className="watchlist-bar">
            <span className="muted small">{visible.length} {visible.length === 1 ? 'titel' : 'titels'}</span>
            <button className="btn-primary with-icon" onClick={() => setPicking(true)} disabled={visible.length === 0}>
              <DiceIcon size={18} /> Wat kijk ik vanavond?
            </button>
          </div>

          {services.length > 0 && (
            <div className="chips">
              <button className={`chip ${service === 'all' ? 'active' : ''}`} onClick={() => setService('all')}>Alles</button>
              {services.map(({ provider, count }) => (
                <button key={provider.name} className={`chip chip-provider ${service === provider.name ? 'active' : ''}`}
                  onClick={() => setService(provider.name)}>
                  <img src={logoUrl(provider.logoPath)} alt="" />
                  {provider.name} <span className="chip-count">{count}</span>
                </button>
              ))}
            </div>
          )}

          <ul className="poster-wall">
            {visible.map((item, i) => {
              const streams = providers[titleKey(item)] ?? []
              return (
                <li key={titleKey(item)} className="rise" style={{ '--i': Math.min(i, 24) } as CSSProperties}>
                  <button className="wall-item" onClick={() => onOpen(item)}>
                    <div className="wall-poster">
                      <Poster path={item.posterPath} title={item.title} size="w342" />
                      {streams.length > 0 && (
                        <span className="wall-providers">
                          {streams.slice(0, 3).map((p) => <img key={p.name} src={logoUrl(p.logoPath)} alt={p.name} title={p.name} />)}
                        </span>
                      )}
                    </div>
                    <span className="wall-title">{item.title}</span>
                    <span className="muted small">{item.mediaType === 'tv' ? 'Serie' : 'Film'}{item.year && ` · ${item.year}`}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {picking && (
        <RandomPick
          items={visible}
          onClose={() => setPicking(false)}
          onOpen={(item) => {
            setPicking(false)
            onOpen(item)
          }}
        />
      )}
    </section>
  )
}

/** Zoeken op TMDB om titels direct aan de watchlist toe te voegen. */
function WatchlistSearch({ watchKeys, seenKeys, onAdd }: { watchKeys: Set<string>; seenKeys: Set<string>; onAdd: (r: SearchResult) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return setResults([])
    const controller = new AbortController()
    const timer = setTimeout(() => {
      searchTitles(q, controller.signal)
        .then((r) => setResults(r.slice(0, 6)))
        .catch(() => !controller.signal.aborted && setResults([]))
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  return (
    <div className="watchlist-search">
      <div className="list-search">
        <SearchIcon />
        <input type="search" placeholder="Zet een film of serie op je watchlist…" value={query}
          onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
        {query && <button className="list-search-clear" onClick={() => setQuery('')} aria-label="Wissen"><CloseIcon size={16} /></button>}
      </div>
      {results.length > 0 && (
        <ul className="search-dropdown">
          {results.map((r) => {
            const key = titleKey(r)
            const onList = watchKeys.has(key)
            return (
              <li key={key}>
                <Poster path={r.posterPath} title={r.title} size="w92" />
                <div>
                  <strong>{r.title}</strong>
                  <span className="muted small">
                    {r.mediaType === 'tv' ? 'Serie' : 'Film'}{r.year && ` · ${r.year}`}{seenKeys.has(key) && ' · al gezien'}
                  </span>
                </div>
                <button className={`with-icon ${onList ? 'btn-ghost' : 'btn-primary'}`} disabled={onList} onClick={() => onAdd(r)}>
                  {onList ? <><CheckIcon size={14} /> Op lijst</> : <><PlusIcon size={14} /> Watchlist</>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** "Slot machine"-loting: posters flitsen voorbij en vertragen tot er één overblijft. */
function RandomPick({ items, onClose, onOpen }: { items: WatchItem[]; onClose: () => void; onOpen: (item: WatchItem) => void }) {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * items.length))
  const [done, setDone] = useState(false)
  const [round, setRound] = useState(0)

  useEffect(() => {
    setDone(false)
    let step = 0
    let timer: ReturnType<typeof setTimeout>
    const total = 14 + Math.floor(Math.random() * items.length)
    const tick = () => {
      setIndex((i) => (i + 1) % items.length)
      step++
      if (step >= total) return setDone(true)
      timer = setTimeout(tick, 60 + step * step * 1.6)
    }
    timer = setTimeout(tick, 60)
    return () => clearTimeout(timer)
  }, [items.length, round])

  const item = items[index]
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`random-pick ${done ? 'done' : ''}`} onClick={(e) => e.stopPropagation()}>
        <span className="eyebrow">{done ? 'Vanavond kijk je…' : 'Even schudden…'}</span>
        <div className="random-poster" key={done ? 'final' : index}>
          <Poster path={item.posterPath} title={item.title} size="w342" />
        </div>
        <h3>{done ? item.title : ' '}</h3>
        <div className="random-actions">
          <button className="btn-ghost with-icon" onClick={() => setRound((r) => r + 1)} disabled={!done}><DiceIcon size={16} /> Nog een keer</button>
          <button className="btn-primary" onClick={() => onOpen(item)} disabled={!done}>Bekijk</button>
        </div>
      </div>
    </div>
  )
}
