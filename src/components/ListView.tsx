import { useMemo, useState, type CSSProperties, type PointerEvent } from 'react'
import type { MediaType, TitleSummary } from '../types'
import type { Stats } from '../lib/titles'
import { Poster } from './Poster'
import { compareDatesDesc } from '../lib/titles'
import { useCountUp } from '../lib/motion'
import { useWatchTime, type WatchTime } from '../lib/watchTime'

type Filter = 'all' | MediaType | 'cinema'
type Sort = 'recent' | 'rating' | 'count' | 'title'

interface Props {
  titles: TitleSummary[]
  stats: Stats
  onOpen: (key: string) => void
}

const FILTERS: [Filter, string][] = [['all', 'Alles'], ['movie', 'Films'], ['tv', 'Series'], ['cinema', '🎟️ Bios']]
const SORTS: [Sort, string][] = [['recent', 'Laatst gezien'], ['rating', 'Rating'], ['count', 'Vaakst gezien'], ['title', 'Titel']]

const sorters: Record<Sort, (a: TitleSummary, b: TitleSummary) => number> = {
  recent: (a, b) => compareDatesDesc(a.lastDate, b.lastDate) || a.title.localeCompare(b.title, 'nl'),
  rating: (a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0) || compareDatesDesc(a.lastDate, b.lastDate),
  count: (a, b) => b.watches.length - a.watches.length || compareDatesDesc(a.lastDate, b.lastDate),
  title: (a, b) => a.title.localeCompare(b.title, 'nl'),
}

export function ListView({ titles, stats, onOpen }: Props) {
  const watchTime = useWatchTime(titles)
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return titles
      .filter((t) => filter === 'all' || (filter === 'cinema' ? t.watches.some((w) => w.cinema) : t.mediaType === filter))
      .filter((t) => !q || t.title.toLowerCase().includes(q))
      .sort(sorters[sort])
  }, [titles, filter, sort, query])

  return (
    <section className="list-view">
      <WatchTimeHero time={watchTime} />
      <div className="stats">
        <Stat value={stats.movies} label="Films" />
        <Stat value={stats.series} label="Series" />
        <Stat value={stats.watchesThisYear} label={`Keer gekeken in ${new Date().getFullYear()}`} />
        <Stat value={stats.avgRating} decimals={1} prefix="★ " label="Gem. rating" />
      </div>

      <div className="toolbar">
        <div className="segmented">
          {FILTERS.map(([value, label]) => (
            <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Zoek in je lijst…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sorteren">
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="empty">{titles.length === 0 ? 'Je lijst is nog leeg. Voeg via de agenda je eerste film toe.' : 'Geen resultaten.'}</p>
      ) : (
        <ul className="poster-wall">
          {visible.map((t, i) => (
            <li key={t.key} className="rise" style={{ '--i': Math.min(i, 24) } as CSSProperties}>
              <button className="wall-item" onClick={() => onOpen(t.key)}>
                <div className="wall-poster" onPointerMove={tilt} onPointerLeave={resetTilt}>
                  <Poster path={t.posterPath} title={t.title} size="w342" />
                  {t.watches.length > 1 && <span className="wall-count">{t.watches.length}×</span>}
                  {t.avgRating != null && <span className="wall-rating">★ {t.avgRating.toFixed(1)}</span>}
                  {t.watches.some((w) => w.cinema) && <span className="wall-cinema" aria-label="In de bioscoop gezien">🎟️</span>}
                </div>
                <span className="wall-title">{t.title}</span>
                <span className="muted small">
                  {t.mediaType === 'tv' ? 'Serie' : 'Film'}{t.year && ` · ${t.year}`}{!t.lastDate && ' · ooit'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Stat({ value, label, decimals = 0, prefix = '' }: { value?: number; label: string; decimals?: number; prefix?: string }) {
  const shown = useCountUp(value ?? 0)
  return (
    <div className="stat">
      <strong>{value == null ? '–' : `${prefix}${shown.toFixed(decimals)}`}</strong>
      <span>{label}</span>
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

function WatchTimeHero({ time }: { time: WatchTime }) {
  const hours = useCountUp(time.minutes / 60, 1400)
  const days = Math.floor(time.minutes / 1440)
  const restHours = Math.floor((time.minutes % 1440) / 60)
  const pending = time.total - time.loaded - time.failed

  return (
    <div className="watch-time">
      <span className="eyebrow">Totale kijktijd</span>
      <div className="watch-time-main">
        <strong>{Math.round(hours).toLocaleString('nl-NL')}</strong>
        <span>uur</span>
      </div>
      <span className="muted small">
        {time.minutes === 0 && pending === 0
          ? 'Nog niets om op te tellen'
          : days > 0
            ? `≈ ${days} ${days === 1 ? 'dag' : 'dagen'} en ${restHours} uur van je leven aan films en series`
            : `${Math.floor(time.minutes / 60)} uur en ${Math.round(time.minutes % 60)} minuten aan films en series`}
      </span>
      {pending > 0 && (
        <div className="watch-time-progress" aria-label="Speelduren ophalen">
          <span style={{ width: `${(time.loaded / time.total) * 100}%` }} />
          <em>Speelduren ophalen… {time.loaded}/{time.total}</em>
        </div>
      )}
      {time.failed > 0 && pending === 0 && (
        <span className="muted small">{time.failed} titel(s) zonder bekende speelduur niet meegeteld</span>
      )}
    </div>
  )
}
