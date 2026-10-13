import type { CSSProperties } from 'react'
import type { NextUp, UpcomingItem } from '../lib/upcoming'
import { backdropUrl, posterUrl } from '../lib/tmdb'
import { Poster } from './Poster'

const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  const days = Math.round((d.getTime() - new Date().setHours(12, 0, 0, 0)) / 86_400_000)
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Morgen'
  if (days < 7) return d.toLocaleDateString('nl-NL', { weekday: 'long' }).replace(/^./, (c) => c.toUpperCase())
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
}

/** "Verder kijken": volgende aflevering per serie, met snel loggen. */
export function ContinueWatching({ items, onLog, onOpen }: { items: NextUp[]; onLog: (n: NextUp) => void; onOpen: (n: NextUp) => void }) {
  if (items.length === 0) return null
  return (
    <section className="home-strip">
      <h4 className="section-label">Verder kijken</h4>
      <ul className="continue-list">
        {items.map((n, i) => (
          <li key={n.title.key} style={{ '--i': i } as CSSProperties}>
            <div className="continue-card">
              <button className="continue-open" onClick={() => onOpen(n)} aria-label={`${n.title.title} openen`}>
                <span className="recent-bg" style={{ backgroundImage: `url(${backdropUrl(n.title.backdropPath) ?? posterUrl(n.title.posterPath, 'w500')})` }} />
                <span className="continue-info">
                  <strong>{n.title.title}</strong>
                  <span>S{n.season}E{n.episode}{n.name && ` · ${n.name}`}</span>
                </span>
              </button>
              {n.airDate ? (
                <span className="continue-soon">📅 {dayLabel(n.airDate)}</span>
              ) : (
                <button className="continue-check" onClick={() => onLog(n)} aria-label={`S${n.season}E${n.episode} gezien`}>✓</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

const KIND_LABEL: Record<UpcomingItem['kind'], (u: UpcomingItem) => string> = {
  cinema: () => '🎬 In de bioscoop',
  season: (u) => `📺 Seizoen ${u.season}`,
  episode: (u) => `📺 S${u.season}E${u.episode}`,
}

/** "Binnenkort": releases van je watchlist en nieuwe afleveringen van series die je volgt. */
export function UpcomingStrip({ items, onOpen }: { items: UpcomingItem[]; onOpen: (u: UpcomingItem) => void }) {
  if (items.length === 0) return null
  return (
    <section className="home-strip">
      <h4 className="section-label">Binnenkort</h4>
      <ul className="upcoming-list">
        {items.slice(0, 12).map((u, i) => (
          <li key={`${u.item.mediaType}-${u.item.tmdbId}`} style={{ '--i': i } as CSSProperties}>
            <button className="upcoming-card" onClick={() => onOpen(u)}>
              <span className="upcoming-date">{dayLabel(u.date)}</span>
              <Poster path={u.item.posterPath} title={u.item.title} size="w185" />
              <span className="upcoming-title">{u.item.title}</span>
              <span className="muted small">{KIND_LABEL[u.kind](u)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
