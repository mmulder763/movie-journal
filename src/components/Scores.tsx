import type { MediaType } from '../types'
import { useRatings } from '../lib/ratings'

interface Props {
  item: { mediaType: MediaType; tmdbId: number }
  /** Compacte variant voor op de swipe-kaart */
  compact?: boolean
}

/** IMDb-, Rotten Tomatoes- en Metacritic-scores. Toont niets zonder OMDb-key. */
export function Scores({ item, compact = false }: Props) {
  const result = useRatings(item)

  if (result.state === 'idle') return null
  if (result.state === 'loading') {
    return (
      <div className={`scores ${compact ? 'compact' : ''}`}>
        <span className="score skeleton" /><span className="score skeleton" />
      </div>
    )
  }
  if (result.state === 'error') return compact ? null : <p className="muted small">Scores niet beschikbaar: {result.error}</p>

  const r = result.ratings
  if (!r || (!r.imdb && !r.rottenTomatoes && !r.metacritic)) return null

  const rtFresh = r.rottenTomatoes && parseInt(r.rottenTomatoes, 10) >= 60
  return (
    <div className={`scores ${compact ? 'compact' : ''}`}>
      {r.imdb && (
        <a className="score score-imdb" href={`https://www.imdb.com/title/${r.imdbId}/`} target="_blank" rel="noreferrer"
          onPointerDown={(e) => e.stopPropagation()} title={r.imdb.votes ? `${r.imdb.votes} stemmen op IMDb` : 'IMDb'}>
          <span className="score-label">IMDb</span>
          <strong>{r.imdb.score}</strong>
          {!compact && r.imdb.votes && <span className="score-sub">{r.imdb.votes}</span>}
        </a>
      )}
      {r.rottenTomatoes && (
        <span className="score" title="Rotten Tomatoes (Tomatometer)">
          <span className="score-label">{rtFresh ? '🍅' : '🤢'}</span>
          <strong>{r.rottenTomatoes}</strong>
        </span>
      )}
      {r.metacritic && (
        <span className="score" title="Metacritic">
          <span className="score-label score-mc">MC</span>
          <strong>{r.metacritic.split('/')[0]}</strong>
        </span>
      )}
    </div>
  )
}
