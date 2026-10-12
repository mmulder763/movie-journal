import type { WatchItem } from '../types'
import { Modal } from './Modal'
import { Poster } from './Poster'
import { Scores } from './Scores'
import { TitleInfo } from './TitleInfo'

interface Props {
  item: WatchItem
  onClose: () => void
  onSeen: () => void
  onRemove: () => void
}

/** Detailscherm voor een watchlist-titel. */
export function WatchItemSheet({ item, onClose, onSeen, onRemove }: Props) {
  return (
    <Modal title={item.title} onClose={onClose} backdrop={item.backdropPath}>
      <div className="title-sheet">
        <div className="title-sheet-head">
          <Poster path={item.posterPath} title={item.title} size="w342" className="poster-lg" />
          <div className="title-meta">
            <span className={`badge badge-${item.mediaType}`}>{item.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
            {item.year && <span className="muted">{item.year}</span>}
            <span className="muted small">🔖 Op je watchlist</span>
            <Scores item={item} />
            <button className="btn-primary" onClick={onSeen}>✓ Gezien</button>
            <button className="btn-text btn-reset" onClick={onRemove}>Van watchlist halen</button>
          </div>
        </div>
        <TitleInfo mediaType={item.mediaType} tmdbId={item.tmdbId} title={item.title} />
      </div>
    </Modal>
  )
}
