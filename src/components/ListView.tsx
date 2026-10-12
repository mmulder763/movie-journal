import { useEffect, useMemo, useState, type CSSProperties, type PointerEvent } from 'react'
import type { MediaType, TitleSummary } from '../types'
import { Poster } from './Poster'
import { StarRating } from './StarRating'
import { backdropUrl, posterUrl } from '../lib/tmdb'
import { compareDatesDesc } from '../lib/titles'

type Filter = 'all' | MediaType
type Sort = 'recent' | 'rating' | 'count' | 'title'

interface Props {
  titles: TitleSummary[]
  onOpen: (key: string) => void
}

const SORTS: [Sort, string][] = [['recent', 'Laatst gezien'], ['rating', 'Hoogste rating'], ['count', 'Vaakst gezien'], ['title', 'Titel (A–Z)']]

const sorters: Record<Sort, (a: TitleSummary, b: TitleSummary) => number> = {
  recent: (a, b) => compareDatesDesc(a.lastDate, b.lastDate) || a.title.localeCompare(b.title, 'nl'),
  rating: (a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || compareDatesDesc(a.lastDate, b.lastDate),
  count: (a, b) => b.watches.length - a.watches.length || compareDatesDesc(a.lastDate, b.lastDate),
  title: (a, b) => a.title.localeCompare(b.title, 'nl'),
}

export function ListView({ titles, onOpen }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')

  const counts = useMemo(
    () => ({ all: titles.length, movie: titles.filter((t) => t.mediaType === 'movie').length, tv: titles.filter((t) => t.mediaType === 'tv').length }),
    [titles],
  )
  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      titles
        .filter((t) => filter === 'all' || t.mediaType === filter)
        .filter((t) => !q || t.title.toLowerCase().includes(q))
        .sort(sorters[sort]),
    [titles, filter, sort, q],
  )
  // "Laatst gekeken"-strook alleen in de standaardweergave, als er genoeg is
  const recent = useMemo(
    () => (!q && filter === 'all' && titles.length >= 4 ? [...titles].sort(sorters.recent).filter((t) => t.lastDate).slice(0, 8) : []),
    [titles, q, filter],
  )

  if (titles.length === 0) {
    return (
      <section className="list-empty">
        <span className="list-empty-icon">🎞️</span>
        <h3>Je lijst is nog leeg</h3>
        <p className="muted">Voeg via de agenda je eerste film toe, of swipe je filmgeschiedenis bij elkaar.</p>
      </section>
    )
  }

  return (
    <section className="list-view">
      <div className="list-search">
        <SearchIcon />
        <input type="search" placeholder={`Zoek in ${titles.length} titels…`} value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')} />
        {query && <button className="list-search-clear" onClick={() => setQuery('')} aria-label="Zoekopdracht wissen">✕</button>}
        <SortMenu value={sort} onChange={setSort} />
      </div>

      <div className="list-filters">
        {([['all', 'Alles'], ['movie', 'Films'], ['tv', 'Series']] as [Filter, string][]).map(([value, label]) => (
          <button key={value} className={`chip ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
            {label} <span className="chip-count">{counts[value]}</span>
          </button>
        ))}
      </div>

      {recent.length > 0 && (
        <div className="recent-strip">
          <h4 className="section-label">Laatst gekeken</h4>
          <ul>
            {recent.map((t, i) => (
              <li key={t.key} style={{ '--i': i } as CSSProperties}>
                <button className="recent-card" onClick={() => onOpen(t.key)}>
                  <span className="recent-bg" style={{ backgroundImage: `url(${backdropUrl(t.backdropPath) ?? posterUrl(t.posterPath, 'w500')})` }} />
                  <span className="recent-info">
                    <strong>{t.title}</strong>
                    <span>{t.lastDate && formatShort(t.lastDate)}{t.avgRating != null && ` · ★ ${t.avgRating.toFixed(1)}`}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {q && <p className="muted small">{visible.length} {visible.length === 1 ? 'resultaat' : 'resultaten'} voor “{query.trim()}”</p>}

      {visible.length === 0 ? (
        <p className="empty">Niets gevonden. Probeer een andere zoekterm of filter.</p>
      ) : (
        <>
          {recent.length > 0 && <h4 className="section-label">Alles</h4>}
          <ul className="poster-wall list-wall">
            {visible.map((t, i) => (
              <li key={t.key} className="rise" style={{ '--i': Math.min(i, 24) } as CSSProperties}>
                <button className="wall-item" onClick={() => onOpen(t.key)}>
                  <div className="wall-poster" onPointerMove={tilt} onPointerLeave={resetTilt}>
                    <Poster path={t.posterPath} title={t.title} size="w342" />
                    {t.watches.length > 1 && <span className="wall-count">{t.watches.length}×</span>}
                    {t.avgRating != null && (
                      <span className="wall-stars"><StarRating value={t.avgRating} /></span>
                    )}
                  </div>
                  <span className="wall-title">{t.title}</span>
                  <span className="muted small">
                    {t.mediaType === 'tv' ? 'Serie' : 'Film'}{t.year && ` · ${t.year}`}{!t.lastDate && ' · ooit'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

const formatShort = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })

export function SearchIcon() {
  return (
    <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.2-4.2" />
    </svg>
  )
}

/** Eigen sorteermenu (in plaats van een native select) */
function SortMenu({ value, onChange }: { value: Sort; onChange: (s: Sort) => void }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  return (
    <div className="sort-menu" onPointerDown={(e) => e.stopPropagation()}>
      <button className={`sort-btn ${open ? 'open' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        title="Sorteren">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
        </svg>
        <span className="sort-label">{SORTS.find(([v]) => v === value)![1]}</span>
      </button>
      {open && (
        <ul className="sort-options" role="menu">
          {SORTS.map(([v, label]) => (
            <li key={v}>
              <button role="menuitemradio" aria-checked={v === value} className={v === value ? 'active' : ''}
                onClick={() => { onChange(v); setOpen(false) }}>
                {label}{v === value && <span>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Poster kantelt richting de cursor (alleen bij muis). */
function tilt(e: PointerEvent<HTMLDivElement>) {
  if (e.pointerType !== 'mouse') return
  const r = e.currentTarget.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width - 0.5
  const y = (e.clientY - r.top) / r.height - 0.5
  e.currentTarget.style.setProperty('--rx', `${-y * 14}deg`)
  e.currentTarget.style.setProperty('--ry', `${x * 14}deg`)
  e.currentTarget.style.setProperty('--shine-x', `${(x + 0.5) * 100}%`)
}

function resetTilt(e: PointerEvent<HTMLDivElement>) {
  e.currentTarget.style.removeProperty('--rx')
  e.currentTarget.style.removeProperty('--ry')
}

