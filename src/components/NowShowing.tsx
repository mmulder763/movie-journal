import { useEffect, useMemo, useState } from 'react'
import type { Entry, MediaType, TitleSummary } from '../types'
import type { Friend } from '../lib/social'
import { backdropUrl, posterUrl } from '../lib/tmdb'
import { titleKey } from '../lib/titles'
import { StarRating } from './StarRating'
import { Avatar } from './FriendsView'

/** Eén slide in de banner: iets dat jij of een vriend recent keek. */
export interface MarqueeSlide {
  key: string
  titleKey: string
  tmdbId: number
  mediaType: MediaType
  title: string
  posterPath: string | null
  backdropPath?: string | null
  year?: string
  date: string | null
  rating?: number
  /** null = jij zelf */
  friend: Friend | null
  loggedAt: number
}

interface Props {
  titles: TitleSummary[]
  friends: Friend[]
  /** Tik op de banner: details van de huidige slide */
  onOpenSlide: (slide: MarqueeSlide) => void
  onAdd: () => void
  /** Huidige slide, voor de ambient-achtergrond */
  onSlideChange?: (slide: MarqueeSlide | undefined) => void
}

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })

const SLIDE_MS = 7000
const MAX_SLIDES = 8

const fromEntry = (e: Entry, friend: Friend): MarqueeSlide => ({
  key: `${friend.id}-${e.id}`,
  titleKey: titleKey(e),
  tmdbId: e.tmdbId,
  mediaType: e.mediaType,
  title: e.title,
  posterPath: e.posterPath,
  backdropPath: e.backdropPath,
  year: e.year,
  date: e.date,
  rating: e.rating,
  friend,
  loggedAt: e.createdAt,
})

/**
 * Bioscoop-banner met wat jij en je vrienden het laatst keken (op logmoment),
 * wisselend met een trage Ken Burns-zoom.
 */
export function NowShowing({ titles, friends, onOpenSlide, onAdd, onSlideChange }: Props) {
  const slides = useMemo(() => {
    const mine: MarqueeSlide[] = titles.map((t) => ({
      key: `me-${t.key}`,
      titleKey: t.key,
      tmdbId: t.tmdbId,
      mediaType: t.mediaType,
      title: t.title,
      posterPath: t.posterPath,
      backdropPath: t.backdropPath,
      year: t.year,
      date: t.lastDate,
      rating: t.avgRating != null ? Math.round(t.avgRating) : undefined,
      friend: null,
      loggedAt: Math.max(...t.watches.map((w) => w.createdAt)),
    }))
    // Per vriend per titel alleen het laatste kijkmoment (geen rij afleveringen van dezelfde serie)
    const theirs = friends.flatMap((f) => {
      const latest = new Map<string, Entry>()
      for (const e of f.journal.entries) {
        const k = titleKey(e)
        if (!latest.has(k) || latest.get(k)!.createdAt < e.createdAt) latest.set(k, e)
      }
      return [...latest.values()].map((e) => fromEntry(e, f))
    })
    return [...mine, ...theirs]
      .filter((s) => s.backdropPath || s.posterPath)
      .sort((a, b) => b.loggedAt - a.loggedAt)
      .slice(0, MAX_SLIDES)
  }, [titles, friends])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS)
    return () => clearInterval(timer)
  }, [slides.length])

  const current = slides[index % Math.max(1, slides.length)]
  useEffect(() => onSlideChange?.(current), [current, onSlideChange])

  return (
    <section className={`marquee ${current ? 'clickable' : ''}`} role={current ? 'button' : undefined} tabIndex={current ? 0 : undefined}
      onClick={(e) => current && !(e.target as HTMLElement).closest('.marquee-dots') && onOpenSlide(current)}
      onKeyDown={(e) => current && (e.key === 'Enter' || e.key === ' ') && onOpenSlide(current)}>
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
            <span className="marquee-who">
              {current.friend ? (
                <>
                  <Avatar profile={current.friend} size={26} />
                  <span><strong>{current.friend.display_name}</strong> keek dit</span>
                </>
              ) : (
                <span className="eyebrow">Now showing</span>
              )}
              <span className="muted small">{current.date ? shortDate(current.date) : 'ooit gezien'}</span>
            </span>
            <h2 className="marquee-title">{current.title}</h2>
            <div className="meta-line">
              <span className={`badge badge-${current.mediaType}`}>{current.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
              {current.year && <span className="muted small">{current.year}</span>}
              {current.rating != null && <StarRating value={current.rating} />}
            </div>
            <span className="marquee-hint">Tik voor details ›</span>
          </>
        ) : (
          <>
            <span className="eyebrow">Welkom in je journal</span>
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
