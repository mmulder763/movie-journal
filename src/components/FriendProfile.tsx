import { useMemo, useState, type CSSProperties } from 'react'
import type { Entry, WatchItem } from '../types'
import { tasteMatch, type Friend } from '../lib/social'
import { compareDatesDesc, summarizeTitles, titleKey } from '../lib/titles'
import { useStreamingProviders } from '../lib/providers'
import { backdropUrl, logoUrl, posterUrl } from '../lib/tmdb'
import { Modal } from './Modal'
import { Poster } from './Poster'
import { Avatar } from './FriendsView'
import { FriendTitleSheet } from './FriendTitleSheet'

interface Props {
  friend: Friend
  myEntries: Entry[]
  onClose: () => void
  /** Titel van de vriend op je eigen watchlist zetten */
  onAddToWatchlist: (item: WatchItem) => void
  /** Al gezien of al op je watchlist */
  knownKeys: Set<string>
}

type Tab = 'seen' | 'watchlist' | 'shared'

const asItem = (t: { tmdbId: number; mediaType: WatchItem['mediaType']; title: string; posterPath: string | null; backdropPath?: string | null; year?: string }): WatchItem =>
  ({ tmdbId: t.tmdbId, mediaType: t.mediaType, title: t.title, posterPath: t.posterPath, backdropPath: t.backdropPath, year: t.year, addedAt: 0 })

const lastActive = (ts: number) => {
  if (!ts) return 'nog niets gelogd'
  const days = Math.floor((Date.now() - ts) / 86_400_000)
  if (days === 0) return 'vandaag actief'
  if (days === 1) return 'gisteren actief'
  if (days < 7) return `${days} dagen geleden actief`
  return `laatst actief ${new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
}

/** Profiel van een vriend: kerncijfers, smaakmatch, recent, favorieten en alles wat die zag. */
export function FriendProfile({ friend, myEntries, onClose, onAddToWatchlist, knownKeys }: Props) {
  const [tab, setTab] = useState<Tab>('seen')
  const [open, setOpen] = useState<WatchItem | null>(null)
  const entries = friend.journal.entries

  const titles = useMemo(() => summarizeTitles(entries).sort((a, b) => compareDatesDesc(a.lastDate, b.lastDate)), [entries])
  const match = useMemo(() => tasteMatch(myEntries, entries), [myEntries, entries])
  const mine = useMemo(() => new Set(myEntries.map(titleKey)), [myEntries])
  const shared = useMemo(() => titles.filter((t) => mine.has(t.key)), [titles, mine])
  const movies = titles.filter((t) => t.mediaType === 'movie').length
  const ratings = entries.flatMap((e) => (e.rating ? [e.rating] : []))
  const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : '–'
  const recent = useMemo(
    () => [...titles].sort((a, b) => Math.max(...b.watches.map((w) => w.createdAt)) - Math.max(...a.watches.map((w) => w.createdAt))).slice(0, 8),
    [titles],
  )
  const favorites = titles.filter((t) => (t.avgRating ?? 0) >= 4.5).slice(0, 10)

  const gridItems = useMemo<{ key: string; item: WatchItem; rating?: number }[]>(
    () =>
      tab === 'watchlist'
        ? friend.journal.watchlist.map((w) => ({ key: titleKey(w), item: w }))
        : (tab === 'seen' ? titles : shared).map((t) => ({ key: t.key, item: asItem(t), rating: t.avgRating })),
    [tab, friend, titles, shared],
  )
  const providerItems = useMemo(() => gridItems.map((g) => g.item), [gridItems])
  const providers = useStreamingProviders(providerItems)

  return (
    <Modal title={friend.display_name} onClose={onClose}>
      <div className="friend-profile">
        <div className="friend-hero">
          <Avatar profile={friend} size={76} />
          <div>
            <span className="muted">@{friend.username}</span>
            <span className="muted small">{lastActive(Math.max(0, ...entries.map((e) => e.createdAt)))}</span>
          </div>
        </div>

        <div className="profile-tiles">
          <div><strong>{movies}</strong><span>films</span></div>
          <div><strong>{titles.length - movies}</strong><span>series</span></div>
          <div><strong>{entries.length}</strong><span>kijkmomenten</span></div>
          <div><strong>{avg}</strong><span>gem. ★</span></div>
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

        {recent.length > 0 && (
          <Strip title="Recent gekeken" items={recent.map((t) => ({ key: t.key, item: asItem(t), sub: t.lastDate ? new Date(`${t.lastDate}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : 'ooit' }))} onOpen={setOpen} />
        )}
        {favorites.length > 0 && (
          <Strip title="Favorieten ★★★★★" items={favorites.map((t) => ({ key: t.key, item: asItem(t), sub: `★ ${t.avgRating!.toFixed(1)}` }))} onOpen={setOpen} />
        )}

        <div className="segmented profile-tabs">
          <button className={tab === 'seen' ? 'active' : ''} onClick={() => setTab('seen')}>Gezien <span className="chip-count">{titles.length}</span></button>
          <button className={tab === 'watchlist' ? 'active' : ''} onClick={() => setTab('watchlist')}>Watchlist <span className="chip-count">{friend.journal.watchlist.length}</span></button>
          <button className={tab === 'shared' ? 'active' : ''} onClick={() => setTab('shared')}>Samen <span className="chip-count">{shared.length}</span></button>
        </div>

        {gridItems.length === 0 ? (
          <p className="empty">{tab === 'shared' ? 'Nog niets dat jullie allebei zagen.' : tab === 'watchlist' ? 'Lege watchlist.' : 'Nog niets gelogd.'}</p>
        ) : (
          <ul className="poster-wall compact">
            {gridItems.map(({ key, item, rating }, i) => (
              <li key={key} className="rise" style={{ '--i': Math.min(i, 20) } as CSSProperties}>
                <button className="wall-item" onClick={() => setOpen(item)}>
                  <div className="wall-poster">
                    <Poster path={item.posterPath} title={item.title} size="w342" />
                    {rating != null && <span className="wall-rating">★ {rating.toFixed(1)}</span>}
                    {mine.has(key) && <span className="wall-count" title="Jij zag dit ook">✓ jij</span>}
                    {(providers[key] ?? []).length > 0 && (
                      <span className="wall-providers">
                        {providers[key].slice(0, 3).map((p) => <img key={p.name} src={logoUrl(p.logoPath)} alt={p.name} title={p.name} />)}
                      </span>
                    )}
                  </div>
                  <span className="wall-title">{item.title}</span>
                  <span className="muted small">{item.mediaType === 'tv' ? 'Serie' : 'Film'}{item.year && ` · ${item.year}`}</span>
                </button>
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

/** Horizontale strook met brede backdrop-kaarten */
function Strip({ title, items, onOpen }: { title: string; items: { key: string; item: WatchItem; sub: string }[]; onOpen: (item: WatchItem) => void }) {
  return (
    <div className="recent-strip">
      <h4 className="section-label">{title}</h4>
      <ul>
        {items.map(({ key, item, sub }, i) => (
          <li key={key} style={{ '--i': i } as CSSProperties}>
            <button className="recent-card" onClick={() => onOpen(item)}>
              <span className="recent-bg" style={{ backgroundImage: `url(${backdropUrl(item.backdropPath) ?? posterUrl(item.posterPath, 'w500')})` }} />
              <span className="recent-info">
                <strong>{item.title}</strong>
                <span>{sub}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
