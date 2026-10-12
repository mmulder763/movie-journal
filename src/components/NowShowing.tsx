import { useEffect, useMemo, useState } from 'react'
import type { TitleSummary } from '../types'
import { backdropUrl, posterUrl } from '../lib/tmdb'
import { formatLongDate } from '../lib/dates'
import { compareDatesDesc } from '../lib/titles'
import { StarRating } from './StarRating'

interface Props {
  titles: TitleSummary[]
  onOpen: (key: string) => void
  onAdd: () => void
  /** Huidige slide, voor de ambient-achtergrond */
  onSlideChange?: (title: TitleSummary | undefined) => void
}

const SLIDE_MS = 7000

/** Bioscoop-banner met de laatst gekeken titels, wisselend met een trage Ken Burns-zoom. */
export function NowShowing({ titles, onOpen, onAdd, onSlideChange }: Props) {
  const slides = useMemo(
    () =>
      [...titles]
        .filter((t) => t.backdropPath || t.posterPath)
        .sort((a, b) => compareDatesDesc(a.lastDate, b.lastDate))
        .slice(0, 6),
    [titles],
  )
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS)
    return () => clearInterval(timer)
  }, [slides.length])

  const current = slides[index % Math.max(1, slides.length)]
  useEffect(() => onSlideChange?.(current), [current, onSlideChange])

  return (
    <section className="marquee">
      <div className="marquee-slides">
        {slides.map((s, i) => (
          <div
            key={s.key}
            className={`marquee-slide ${i === index % slides.length ? 'active' : ''}`}
            style={{ backgroundImage: `url(${backdropUrl(s.backdropPath, 'w1280') ?? posterUrl(s.posterPath, 'w780')})` }}
          />
        ))}
      </div>
      <div className="marquee-content" key={current?.key ?? 'empty'}>
        {current ? (
          <>
            <span className="eyebrow">
              Now showing · {current.lastDate ? formatLongDate(current.lastDate) : 'ooit gezien'}
            </span>
            <h2 className="marquee-title">{current.title}</h2>
            <div className="meta-line">
              <span className={`badge badge-${current.mediaType}`}>{current.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
              {current.year && <span className="muted small">{current.year}</span>}
              {current.avgRating != null && <StarRating value={Math.round(current.avgRating)} />}
            </div>
            <button className="btn-ghost marquee-btn" onClick={() => onOpen(current.key)}>Bekijk details</button>
          </>
        ) : (
          <>
            <span className="eyebrow">Welkom in je bioscoop</span>
            <h2 className="marquee-title">Wat heb je vandaag gekeken?</h2>
            <button className="btn-primary marquee-btn" onClick={onAdd}>+ Eerste film toevoegen</button>
          </>
        )}
      </div>
      {slides.length > 1 && (
        <div className="marquee-dots">
          {slides.map((s, i) => (
            <button key={s.key} className={i === index % slides.length ? 'active' : ''}
              onClick={() => setIndex(i)} aria-label={s.title} />
          ))}
        </div>
      )}
    </section>
  )
}
