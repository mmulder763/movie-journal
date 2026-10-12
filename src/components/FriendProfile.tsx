import { useMemo, useState, type CSSProperties } from 'react'
import type { Entry } from '../types'
import { tasteMatch, type Friend } from '../lib/social'
import { compareDatesDesc, summarizeTitles, titleKey } from '../lib/titles'
import { Modal } from './Modal'
import { Poster } from './Poster'
import { Avatar } from './FriendsView'
import { FriendTitleSheet } from './FriendTitleSheet'
import { useStreamingProviders } from '../lib/providers'
import { logoUrl } from '../lib/tmdb'
import type { WatchItem } from '../types'

interface Props {
  friend: Friend
  myEntries: Entry[]
  onClose: () => void
  /** Titel van de vriend op je eigen watchlist zetten */
  onAddToWatchlist: (title: { tmdbId: number; mediaType: Entry['mediaType']; title: string; posterPath: string | null; backdropPath?: string | null; year?: string }) => void
  /** Al gezien of al op je watchlist */
  knownKeys: Set<string>
}

type Tab = 'seen' | 'watchlist' | 'shared'

/** Profiel van een vriend: smaakmatch, posterwand, watchlist en wat jullie allebei zagen. */
export function FriendProfile({ friend, myEntries, onClose, onAddToWatchlist, knownKeys }: Props) {
  const [tab, setTab] = useState<Tab>('seen')
  const titles = useMemo(
    () => summarizeTitles(friend.journal.entries).sort((a, b) => compareDatesDesc(a.lastDate, b.lastDate)),
    [friend],
  )
  const match = useMemo(() => tasteMatch(myEntries, friend.journal.entries), [myEntries, friend])
  const mine = useMemo(() => new Set(myEntries.map(titleKey)), [myEntries])
  const shared = titles.filter((t) => mine.has(t.key))
  const movies = titles.filter((t) => t.mediaType === 'movie').length

  const list = tab === 'seen' ? titles : tab === 'shared' ? shared : []
  const [open, setOpen] = useState<WatchItem | null>(null)

  // Streaming-logo's voor de titels in het huidige tabblad
  const visibleItems = useMemo<WatchItem[]>(
    () => (tab === 'watchlist' ? friend.journal.watchlist : list.map((t) => ({ ...t, addedAt: 0 }))),
    [tab, friend, list],
  )
  const providers = useStreamingProviders(visibleItems)
  const streamLogos = (key: string) =>
    (providers[key] ?? []).length > 0 && (
      <span className="wall-providers">
        {providers[key].slice(0, 3).map((p) => <img key={p.name} src={logoUrl(p.logoPath)} alt={p.name} title={p.name} />)}
      </span>
    )


  return (
    <Modal title={friend.display_name} onClose={onClose}>
      <div className="friend-profile">
        <div className="friend-hero">
          <Avatar profile={friend} size={72} />
          <div>
            <span className="muted">@{friend.username}</span>
            <div className="friend-stats">
              <span><strong>{movies}</strong> films</span>
              <span><strong>{titles.length - movies}</strong> series</span>
              <span><strong>{friend.journal.watchlist.length}</strong> watchlist</span>
            </div>
          </div>
        </div>

        <div className="match-card">
          <strong>{match.score != null ? `${match.score}%` : '–'}</strong>
          <span>
            {match.score != null
              ? `smaakmatch op ${match.bothRated} ${match.bothRated === 1 ? 'titel' : 'titels'} die jullie allebei beoordeelden`
              : 'Nog geen titels die jullie allebei een rating gaven'}
            {` · ${match.shared} samen gezien`}
          </span>
        </div>

        <div className="segmented">
          <button className={tab === 'seen' ? 'active' : ''} onClick={() => setTab('seen')}>Gezien</button>
          <button className={tab === 'watchlist' ? 'active' : ''} onClick={() => setTab('watchlist')}>Watchlist</button>
          <button className={tab === 'shared' ? 'active' : ''} onClick={() => setTab('shared')}>Samen</button>
        </div>

        {tab === 'watchlist' ? (
          friend.journal.watchlist.length === 0 ? <p className="empty">Lege watchlist.</p> : (
            <ul className="poster-wall compact">
              {friend.journal.watchlist.map((w, i) => {
                const onMine = knownKeys.has(titleKey(w))
                return (
                  <li key={titleKey(w)} className="rise" style={{ '--i': Math.min(i, 20) } as CSSProperties}>
                    <div className="wall-item">
                      <button className="wall-poster" onClick={() => setOpen(w)} aria-label={`Details van ${w.title}`}>
                        <Poster path={w.posterPath} title={w.title} size="w342" />
                        {streamLogos(titleKey(w))}
                      </button>
                      <span className="wall-title">{w.title}</span>
                      <button className="btn-text small-btn" disabled={onMine}
                        onClick={() => onAddToWatchlist(w)}>
                        {onMine ? '✓ Bij jou' : '+ Mijn watchlist'}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )
        ) : list.length === 0 ? (
          <p className="empty">{tab === 'shared' ? 'Nog niets dat jullie allebei zagen.' : 'Nog niets gelogd.'}</p>
        ) : (
          <ul className="poster-wall compact">
            {list.map((t, i) => (
              <li key={t.key} className="rise" style={{ '--i': Math.min(i, 20) } as CSSProperties}>
                <div className="wall-item">
                  <button className="wall-poster" onClick={() => setOpen({ ...t, addedAt: 0 })} aria-label={`Details van ${t.title}`}>
                    <Poster path={t.posterPath} title={t.title} size="w342" />
                    {t.avgRating != null && <span className="wall-rating">★ {t.avgRating.toFixed(1)}</span>}
                    {streamLogos(t.key)}
                  </button>
                  <span className="wall-title">{t.title}</span>
                  <span className="muted small">{t.mediaType === 'tv' ? 'Serie' : 'Film'}{t.year && ` · ${t.year}`}</span>
                  {tab === 'seen' && (
                    <button className="btn-text small-btn" disabled={knownKeys.has(t.key)} onClick={() => onAddToWatchlist(t)}>
                      {mine.has(t.key) ? '✓ Gezien' : knownKeys.has(t.key) ? '✓ Op watchlist' : '+ Mijn watchlist'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

      </div>

      {open && (
        <FriendTitleSheet item={open} friend={friend} mySeen={mine} knownKeys={knownKeys}
          onAddToWatchlist={onAddToWatchlist} onClose={() => setOpen(null)} />
      )}
    </Modal>
  )
}
