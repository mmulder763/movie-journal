import type { ReactNode } from 'react'
import type { WatchItem } from '../types'
import { Modal } from './Modal'
import { Poster } from './Poster'
import { Scores } from './Scores'
import { TitleInfo } from './TitleInfo'
import { useSocialContext } from '../lib/inbox'

interface PreviewProps {
  item: WatchItem
  /** Korte status onder het jaartal, bijv. "🔖 Op je watchlist" */
  status?: string
  onClose: () => void
  /** Actieknoppen naast de poster */
  children: ReactNode
}

/** Detailscherm voor een titel die (nog) niet in je kijkgeschiedenis staat: info, scores, streaming. */
export function TitlePreviewSheet({ item, status, onClose, children }: PreviewProps) {
  const social = useSocialContext()
  return (
    <Modal title={item.title} onClose={onClose} backdrop={item.backdropPath}>
      <div className="title-sheet">
        <div className="title-sheet-head">
          <Poster path={item.posterPath} title={item.title} size="w342" className="poster-lg" />
          <div className="title-meta">
            <span className={`badge badge-${item.mediaType}`}>{item.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
            {item.year && <span className="muted">{item.year}</span>}
            {status && <span className="muted small">{status}</span>}
            <Scores item={item} />
            {children}
            {social?.me && <button className="btn-text recommend-btn" onClick={() => social.openRecommend(item)}>📨 Aanraden</button>}
          </div>
        </div>
        <TitleInfo mediaType={item.mediaType} tmdbId={item.tmdbId} title={item.title} />
      </div>
    </Modal>
  )
}

interface Props {
  item: WatchItem
  onClose: () => void
  onSeen: () => void
  onRemove: () => void
}

/** Detailscherm voor een watchlist-titel. */
export function WatchItemSheet({ item, onClose, onSeen, onRemove }: Props) {
  return (
    <TitlePreviewSheet item={item} status="🔖 Op je watchlist" onClose={onClose}>
      <button className="btn-primary" onClick={onSeen}>✓ Gezien</button>
      <button className="btn-text btn-reset" onClick={onRemove}>Van watchlist halen</button>
    </TitlePreviewSheet>
  )
}
