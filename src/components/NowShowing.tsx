import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
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

/** "vandaag", "gisteren", "3 dagen geleden" of de volledige datum */
function whenLabel(iso: string | null) {
  if (!iso) return 'Ooit (datum onbekend)'
  const date = new Date(`${iso}T12:00:00`)
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000)
  if (days === 0) return 'Vandaag'
  if (days === 1) return 'Gisteren'
  if (days > 1 && days < 7) return `${days} dagen geleden`
  return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase())
}

const SLIDE_MS = 7000
const MAX_SLIDES = 4

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
  // Na handmatig vegen de automatische wissel opnieuw laten starten
  const [interacted, setInteracted] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_MS)
    return () => clearInterval(timer)
  }, [slides.length, interacted])

  // Horizontaal vegen wisselt van slide; een korte tik opent de details
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const go = (delta: number) => {
    setIndex((i) => (i + delta + slides.length) % slides.length)
    setInteracted((n) => n + 1)
  }
  const onPointerDown = (e: PointerEvent) => (swipe.current = { x: e.clientX, y: e.clientY, moved: false })
  const onPointerUp = (e: PointerEvent) => {
    const s0 = swipe.current
    if (!s0) return
    const dx = e.clientX - s0.x
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(e.clientY - s0.y) && slides.length > 1) {
      s0.moved = true
      go(dx < 0 ? 1 : -1)
    }
  }

  const current = slides[index % Math.max(1, slides.length)]
  useEffect(() => onSlideChange?.(current), [current, onSlideChange])

  return (
    <section className={`marquee ${current ? 'clickable' : ''}`} role={current ? 'button' : undefined} tabIndex={current ? 0 : undefined}
      onPointerDown={onPointerDown} onPointerUp={onPointerUp}
      onClick={(e) => {
        if (swipe.current?.moved) return // dat was een veeg, geen tik
        if (current && !(e.target as HTMLElement).closest('.marquee-dots')) onOpenSlide(current)
      }}
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
                <span className="eyebrow">Jij keek dit</span>
              )}
            </span>
            <span className="marquee-when">📅 {whenLabel(current.date)}</span>
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
              onClick={() => { setIndex(i); setInteracted((n) => n + 1) }} aria-label={s.title} />
          ))}
        </div>
      )}
    </section>
  )
}
