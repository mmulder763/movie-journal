import type { CSSProperties } from 'react'
import type { Entry, TitleSummary } from '../types'
import { formatLongDate } from '../lib/dates'
import { Modal } from './Modal'
import { Poster } from './Poster'
import { StarRating } from './StarRating'
import { Scores } from './Scores'
import { TitleInfo } from './TitleInfo'
import { SeasonProgress } from './EpisodePicker'
import { Avatar } from './FriendsView'
import type { Profile } from '../lib/supabase'

interface Props {
  title: TitleSummary
  onClose: () => void
  onGoToDate: (date: string) => void
  onEdit: (entry: Entry) => void
  onWatchAgain: () => void
  /** Alle kijkmomenten van deze titel verwijderen */
  onRemoveAll: () => void
  /** Vrienden die deze titel ook zagen */
  friendWatches?: { friend: Profile; watches: Entry[] }[]
}

export function TitleSheet({ title, onClose, onGoToDate, onEdit, onWatchAgain, onRemoveAll, friendWatches = [] }: Props) {
  const times = title.watches.length
  return (
    <Modal title={title.title} onClose={onClose} backdrop={title.backdropPath}>
      <div className="title-sheet">
        <div className="title-sheet-head">
          <Poster path={title.posterPath} title={title.title} size="w342" className="poster-lg" />
          <div className="title-meta">
            <span className={`badge badge-${title.mediaType}`}>{title.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
            {title.year && <span className="muted">{title.year}</span>}
            <span className="muted">
              {title.mediaType === 'tv' && title.watches.some((w) => w.episode != null)
                ? `${title.watches.filter((w) => w.episode != null).length} afleveringen gezien`
                : `${times}× gekeken`}
            </span>
            {title.avgRating != null && (
              <span className="rating-line">
                <StarRating value={title.avgRating} />
                <span className="muted small">{title.avgRating.toFixed(1)}</span>
              </span>
            )}
            <Scores item={title} />
            <button className="btn-primary" onClick={onWatchAgain}>
              {title.mediaType === 'tv' ? '+ Verder gekeken' : '+ Opnieuw gekeken'}
            </button>
          </div>
        </div>

        {title.mediaType === 'tv' && (
          <>
            <h4 className="section-label">Voortgang</h4>
            <SeasonProgress tvId={title.tmdbId} history={title.watches} />
          </>
        )}

        {friendWatches.length > 0 && (
          <>
            <h4 className="section-label">Vrienden die dit zagen</h4>
            <ul className="friend-watches">
              {friendWatches.map(({ friend, watches }) => {
                const rated = watches.filter((w) => w.rating)
                const avg = rated.length ? rated.reduce((n, w) => n + w.rating!, 0) / rated.length : undefined
                const note = watches.find((w) => w.note)?.note
                return (
                  <li key={friend.id}>
                    <Avatar profile={friend} size={34} />
                    <div>
                      <strong>{friend.display_name}</strong>
                      <span className="meta-line">
                        {avg != null ? <StarRating value={avg} /> : <span className="muted small">geen rating</span>}
                        {watches.length > 1 && <span className="muted small">{watches.length}×</span>}
                      </span>
                      {note && <p className="entry-note">“{note}”</p>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <TitleInfo mediaType={title.mediaType} tmdbId={title.tmdbId} title={title.title} />

        <button className="btn-text btn-reset remove-title"
          onClick={() => {
            const n = title.watches.length
            if (confirm(`"${title.title}" uit je lijst verwijderen?${n > 1 ? ` Alle ${n} kijkmomenten verdwijnen ook uit je agenda.` : ' Hij verdwijnt ook uit je agenda.'}`)) onRemoveAll()
          }}>
          Verwijderen uit je lijst
        </button>

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
