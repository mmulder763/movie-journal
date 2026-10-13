import { useImperativeHandle, useRef, type PointerEvent, type Ref } from 'react'
import { FilmIcon } from './Icons'
import { StarScore } from './StarRating'
import type { SearchResult } from '../types'
import { posterUrl } from '../lib/tmdb'
import { Scores } from './Scores'

export type SwipeVerdict = 'seen' | 'skip' | 'watchlist'

export interface SwipeCardHandle {
  fly: (verdict: SwipeVerdict) => void
}

interface Props {
  card: SearchResult
  onDecide: (verdict: SwipeVerdict) => void
  ref?: Ref<SwipeCardHandle>
}

const THRESHOLD = 110
const FLY_MS = 320

export function SwipeCard({ card, onDecide, ref }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null)
  const done = useRef(false)

  const setPose = (dx: number, dy: number, animate: boolean) => {
    const node = el.current
    if (!node) return
    node.style.transition = animate ? `transform ${FLY_MS}ms cubic-bezier(.2,.8,.3,1)` : 'none'
    node.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 14}deg)`
    // Stempels ("GEZIEN"/"NOPE"/"FAVORIET") laten meekleuren met de richting
    node.style.setProperty('--drag-seen', String(Math.max(0, Math.min(1, dx / THRESHOLD))))
    node.style.setProperty('--drag-skip', String(Math.max(0, Math.min(1, -dx / THRESHOLD))))
    node.style.setProperty('--drag-watchlist', String(Math.max(0, Math.min(1, -dy / THRESHOLD - Math.abs(dx) / THRESHOLD))))
  }

  const fly = (verdict: SwipeVerdict) => {
    if (done.current) return
    done.current = true
    const w = window.innerWidth
    if (verdict === 'seen') setPose(w, 60, true)
    else if (verdict === 'skip') setPose(-w, 60, true)
    else {
      setPose(0, -window.innerHeight, true)
      el.current?.style.setProperty('--drag-watchlist', '1')
    }
    setTimeout(() => onDecide(verdict), FLY_MS - 60)
  }

  useImperativeHandle(ref, () => ({ fly }))

  const onPointerDown = (e: PointerEvent) => {
    if (done.current) return
    el.current?.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }
  }

  const onPointerMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.dx = e.clientX - d.x
    d.dy = e.clientY - d.y
    setPose(d.dx, d.dy, false)
  }

  const onPointerUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.dx > THRESHOLD) fly('seen')
    else if (d.dx < -THRESHOLD) fly('skip')
    else if (d.dy < -THRESHOLD) fly('watchlist')
    else setPose(0, 0, true)
  }

  const img = posterUrl(card.posterPath, 'w780')

  return (
    <div
      ref={el}
      className="swipe-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <CardFace card={card} img={img} withScores />
      <span className="stamp stamp-seen">Gezien</span>
      <span className="stamp stamp-skip">Nope</span>
      <span className="stamp stamp-watchlist">Watchlist</span>
    </div>
  )
}

export function CardFace({ card, img = posterUrl(card.posterPath, 'w780'), withScores = false }: { card: SearchResult; img?: string | null; withScores?: boolean }) {
  return (
    <>
      {img ? <img src={img} alt="" draggable={false} /> : <div className="swipe-card-empty"><FilmIcon size={56} /></div>}
      {/* Als overlay bovenin, zodat binnenkomende scores de titel niet laten verspringen */}
      {withScores && <div className={`swipe-card-scores ${card.rank != null ? 'has-rank' : ''}`}><Scores item={card} compact /></div>}
      {card.rank != null && <span className="rank-badge">#{card.rank}</span>}
      <div className="swipe-card-info">
        <div className="meta-line">
          <span className={`badge badge-${card.mediaType}`}>{card.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
          {card.year && <span className="muted small">{card.year}</span>}
          {card.voteAverage != null && card.voteAverage > 0 && (
            <span className="tmdb-score"><StarScore value={card.voteAverage} size={12} /></span>
          )}
        </div>
        <h3>{card.title}</h3>
        {card.overview && <p>{card.overview}</p>}
      </div>
    </>
  )
}
