import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { SearchResult } from '../types'
import { DECK_SOURCES, fetchDeckPage, hasApiKey, searchTitles, type DeckSource } from '../lib/tmdb'
import { titleKey } from '../lib/titles'
import { CardFace, SwipeCard, type SwipeCardHandle, type SwipeVerdict } from './SwipeCard'

export interface SwipeAction {
  card: SearchResult
  verdict: SwipeVerdict
}

interface Props {
  /** Titels die al in je journal staan */
  journalKeys: Set<string>
  /** Titels die eerder als "niet gezien" zijn weggeswipet (bij zoeken tonen we ze wél) */
  skippedKeys: Set<string>
  /** Titels op de watchlist (bij zoeken tonen we ze wél, zodat je ze als gezien kunt markeren) */
  watchlistKeys: Set<string>
  onSwipe: (action: SwipeAction) => void
  onUndo: (action: SwipeAction) => void
  /** Bovenste kaart, voor de ambient-achtergrond */
  onTopChange?: (card: SearchResult | undefined) => void
}

const MIN_BUFFER = 5

export function SwipeDeck({ journalKeys, skippedKeys, watchlistKeys, onSwipe, onUndo, onTopChange }: Props) {
  const [source, setSource] = useState<DeckSource>('trending')
  const [cards, setCards] = useState<SearchResult[]>([])
  const [page, setPage] = useState({ next: 1, hasMore: true })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<SwipeAction[]>([])
  const [sessionCount, setSessionCount] = useState(0)
  const top = useRef<SwipeCardHandle>(null)
  const generation = useRef(0)
  const [query, setQuery] = useState('')
  const [searchHits, setSearchHits] = useState<{ total: number; inJournal: number } | null>(null)
  const [activeQuery, setActiveQuery] = useState('')
  const searching = activeQuery !== ''

  const isHidden = useCallback(
    (c: SearchResult) =>
      journalKeys.has(titleKey(c)) || (!searching && (skippedKeys.has(titleKey(c)) || watchlistKeys.has(titleKey(c)))),
    [journalKeys, skippedKeys, watchlistKeys, searching],
  )
  const visible = useMemo(() => cards.filter((c) => !isHidden(c)), [cards, isHidden])

  const resetDeck = () => {
    generation.current++
    setCards([])
    setPage({ next: 1, hasMore: true })
    setError(null)
  }

  // Zoekterm pas na even stilstaan toepassen, zodat de stapel niet bij elke toetsaanslag ververst
  useEffect(() => {
    const q = query.trim()
    const timer = setTimeout(() => {
      const next = q.length >= 2 ? q : ''
      if (next === activeQuery) return
      resetDeck()
      setActiveQuery(next)
    }, 350)
    return () => clearTimeout(timer)
  }, [query, activeQuery])

  const topCard = visible[0]
  useEffect(() => onTopChange?.(topCard), [topCard, onTopChange])

  const changeSource = (next: DeckSource) => {
    resetDeck()
    setSource(next)
    setQuery('')
    setActiveQuery('')
  }

  // Stapel bijvullen zodra er weinig kaarten over zijn (pagina's met alleen bekende titels worden overgeslagen)
  useEffect(() => {
    if (!hasApiKey() || loading || error || !page.hasMore || visible.length >= MIN_BUFFER) return
    const gen = generation.current
    setLoading(true)
    const request = searching
      ? searchTitles(activeQuery).then((results) => ({ results, hasMore: false }))
      : fetchDeckPage(source, page.next)
    request
      .then(({ results, hasMore }) => {
        if (gen !== generation.current) return // inmiddels andere lijst gekozen
        setCards((prev) => {
          const seen = new Set(prev.map(titleKey))
          return [...prev, ...results.filter((r) => !seen.has(titleKey(r)) && !isHidden(r))]
        })
        setPage({ next: page.next + 1, hasMore })
        setSearchHits(searching ? { total: results.length, inJournal: results.filter((r) => journalKeys.has(titleKey(r))).length } : null)
      })
      .catch((err) => gen === generation.current && setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [source, activeQuery, searching, page, visible.length, loading, error, isHidden, journalKeys])

  const decide = useCallback(
    (verdict: SwipeVerdict) => {
      const card = visible[0]
      if (!card) return
      const action = { card, verdict }
      setCards((prev) => prev.filter((c) => c !== card))
      setHistory((h) => [action, ...h].slice(0, 20))
      setSessionCount((n) => n + 1)
      onSwipe(action)
    },
    [visible, onSwipe],
  )

  const undo = () => {
    const [last, ...rest] = history
    if (!last) return
    setHistory(rest)
    setSessionCount((n) => Math.max(0, n - 1))
    setCards((prev) => [last.card, ...prev])
    onUndo(last)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === 'ArrowRight') top.current?.fly('seen')
      else if (e.key === 'ArrowLeft') top.current?.fly('skip')
      else if (e.key === 'ArrowUp') top.current?.fly('love')
      else if (e.key === 'ArrowDown') top.current?.fly('cinema')
      else if (e.key === 'w') top.current?.fly('watchlist')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!hasApiKey()) return <p className="error">Geen TMDB API key ingesteld.</p>

  return (
    <section className="swipe-view">
      <div className="swipe-intro">
        <span className="eyebrow">Al eens gezien?</span>
        <h2>Swipe je filmgeschiedenis bij elkaar</h2>
        <p className="muted small">
          Rechts = gezien · links = niet gezien · omhoog = favoriet · omlaag = in de bios · 🔖 = wil ik zien. Films komen op hun NL-bioscoopdatum te staan.
        </p>
      </div>

      <div className="swipe-search">
        <input
          type="search"
          placeholder="Zoek een film of serie die je nog weet…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
        />
        {query && <button className="swipe-search-clear" onClick={() => setQuery('')} aria-label="Zoekopdracht wissen">✕</button>}
      </div>

      <div className="chips">
        {DECK_SOURCES.map(([value, label]) => (
          <button key={value} className={`chip ${!searching && source === value ? 'active' : ''}`} onClick={() => changeSource(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className="deck">
        {visible.length === 0 ? (
          <div className="deck-empty">
            {loading ? <div className="reel-spinner" aria-label="Laden" /> : error ? (
              <>
                <p className="error">{error}</p>
                <button className="btn-ghost" onClick={() => setError(null)}>Opnieuw proberen</button>
              </>
            ) : (
              <p className="muted">
                {!searching
                  ? 'Alles uit deze lijst gehad! Kies een andere lijst hierboven.'
                  : searchHits && searchHits.inJournal > 0
                    ? `Geen nieuwe titels: ${searchHits.inJournal} ${searchHits.inJournal === 1 ? 'resultaat staat' : 'resultaten staan'} al in je lijst.`
                    : `Niets gevonden voor "${activeQuery}".`}
              </p>
            )}
          </div>
        ) : (
          visible
            .slice(0, 3)
            .reverse()
            .map((card, i, arr) => {
              const depth = arr.length - 1 - i
              const key = titleKey(card)
              return depth === 0 ? (
                <SwipeCard key={key} ref={top} card={card} onDecide={decide} />
              ) : (
                <div key={key} className="swipe-card behind" style={{ '--depth': depth } as CSSProperties}>
                  <CardFace card={card} />
                </div>
              )
            })
        )}
      </div>

      <div className="swipe-actions">
        <button className="round-btn undo" onClick={undo} disabled={history.length === 0} aria-label="Ongedaan maken">↺</button>
        <button className="round-btn skip" onClick={() => top.current?.fly('skip')} disabled={!visible.length} aria-label="Niet gezien">✕</button>
        <button className="round-btn love" onClick={() => top.current?.fly('love')} disabled={!visible.length} aria-label="Favoriet">★</button>
        <button className="round-btn cinema" onClick={() => top.current?.fly('cinema')}
          disabled={visible[0]?.mediaType !== 'movie'} aria-label="In de bioscoop gezien">🎟️</button>
        <button className="round-btn watch" onClick={() => top.current?.fly('watchlist')} disabled={!visible.length}
          aria-label="Op de watchlist" title="Wil ik nog zien">🔖</button>
        <button className="round-btn seen" onClick={() => top.current?.fly('seen')} disabled={!visible.length} aria-label="Gezien">✓</button>
      </div>
      {sessionCount > 0 && <p className="muted small swipe-count">{sessionCount} geswipet deze sessie</p>}
    </section>
  )
}
