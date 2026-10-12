import type { CSSProperties } from 'react'
import type { Entry, TitleSummary } from '../types'
import { formatLongDate } from '../lib/dates'
import { Modal } from './Modal'
import { Poster } from './Poster'
import { StarRating } from './StarRating'
import { Scores } from './Scores'
import { TitleInfo } from './TitleInfo'

interface Props {
  title: TitleSummary
  onClose: () => void
  onGoToDate: (date: string) => void
  onEdit: (entry: Entry) => void
  onWatchAgain: () => void
}

export function TitleSheet({ title, onClose, onGoToDate, onEdit, onWatchAgain }: Props) {
  const times = title.watches.length
  return (
    <Modal title={title.title} onClose={onClose} backdrop={title.backdropPath}>
      <div className="title-sheet">
        <div className="title-sheet-head">
          <Poster path={title.posterPath} title={title.title} size="w342" className="poster-lg" />
          <div className="title-meta">
            <span className={`badge badge-${title.mediaType}`}>{title.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
            {title.year && <span className="muted">{title.year}</span>}
            <span className="muted">{times}× gekeken</span>
            {title.avgRating != null && (
              <span className="rating-line">
                <StarRating value={Math.round(title.avgRating)} />
                <span className="muted small">{title.avgRating.toFixed(1)}</span>
              </span>
            )}
            <Scores item={title} />
            <button className="btn-primary" onClick={onWatchAgain}>
              {title.mediaType === 'tv' ? '+ Verder gekeken' : '+ Opnieuw gekeken'}
            </button>
          </div>
        </div>

        <TitleInfo mediaType={title.mediaType} tmdbId={title.tmdbId} title={title.title} />

        <h4 className="section-label">Geschiedenis <span className="muted small">· tik om te bewerken</span></h4>
        <ul className="history">
          {title.watches.map((w, i) => (
            <li key={w.id} className="history-row" style={{ '--i': i } as CSSProperties}>
              <button className="history-item" onClick={() => onEdit(w)} title="Bewerken">
                <span className="history-date">
                  {w.cinema && <span className="cinema-tag">🎟️ Bios</span>}
                  {w.date ? formatLongDate(w.date) : 'Ooit gezien (datum onbekend)'}
                  {w.season != null && <span className="muted"> · S{w.season}{w.episode != null && `E${w.episode}`}</span>}
                </span>
                {w.rating != null && <StarRating value={w.rating} />}
                {w.note && <p className="entry-note">{w.note}</p>}
              </button>
              {w.date && (
                <button className="icon-btn" onClick={() => onGoToDate(w.date!)} aria-label="Naar deze dag in de agenda">📅</button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  )
}
