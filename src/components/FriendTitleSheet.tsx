import type { WatchItem } from '../types'
import { BookmarkIcon, CheckIcon, ChevronIcon } from './Icons'
import type { Friend } from '../lib/social'
import { titleKey } from '../lib/titles'
import { TitlePreviewSheet } from './WatchItemSheet'
import { StarRating } from './StarRating'
import { ReactionBar } from './Reactions'

interface Props {
  item: WatchItem
  friend: Friend
  /** Titels die je zelf zag */
  mySeen: Set<string>
  /** Gezien of al op je watchlist */
  knownKeys: Set<string>
  onAddToWatchlist: (item: WatchItem) => void
  onClose: () => void
  /** Naar het profiel van de vriend (niet nodig als je daar al bent) */
  onOpenFriend?: () => void
}

/** Detailscherm van een titel die een vriend zag (of op de watchlist heeft): hun oordeel + streaming. */
export function FriendTitleSheet({ item, friend, mySeen, knownKeys, onAddToWatchlist, onClose, onOpenFriend }: Props) {
  const key = titleKey(item)
  const watches = friend.journal.entries.filter((e) => titleKey(e) === key)
  const rated = watches.filter((w) => w.rating)
  const avg = rated.length ? rated.reduce((n, w) => n + w.rating!, 0) / rated.length : undefined
  const note = watches.find((w) => w.note)?.note
  const first = friend.display_name.split(' ')[0]

  return (
    <TitlePreviewSheet item={item} onClose={onClose}
      status={watches.length ? `${first} zag dit${watches.length > 1 ? ` ${watches.length}×` : ''}` : `Op de watchlist van ${first}`}>
      {avg != null && <StarRating value={avg} />}
      {note && <p className="entry-note">“{note}”</p>}
      {mySeen.has(key) ? (
        <span className="muted small with-icon"><CheckIcon size={14} /> Jij zag dit ook</span>
      ) : (
        <button className="btn-primary with-icon" disabled={knownKeys.has(key)} onClick={() => onAddToWatchlist(item)}>
          {knownKeys.has(key) ? <><CheckIcon size={16} /> Op je watchlist</> : <><BookmarkIcon size={16} /> Mijn watchlist</>}
        </button>
      )}
      {onOpenFriend && <button className="btn-text with-icon" onClick={onOpenFriend}>Profiel van {first} <ChevronIcon size={15} /></button>}
      {watches[0] && <ReactionBar ownerId={friend.id} entryId={[...watches].sort((a, b) => b.createdAt - a.createdAt)[0].id} />}
    </TitlePreviewSheet>
  )
}
