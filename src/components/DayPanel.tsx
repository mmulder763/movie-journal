import type { CSSProperties } from 'react'
import type { Entry } from '../types'
import { formatLongDate, today } from '../lib/dates'
import { backdropUrl, posterUrl } from '../lib/tmdb'
import { Poster } from './Poster'
import { StarRating } from './StarRating'
import { Avatar } from './FriendsView'
import { ChevronIcon, TicketIcon } from './Icons'
import type { FriendWatch } from './Calendar'
import { ReactionSummary } from './Reactions'
import { useSocialContext } from '../lib/inbox'

interface Props {
  date: string
  entries: Entry[]
  onAdd: () => void
  onEdit: (entry: Entry) => void
  /** Wat vrienden op deze dag keken */
  friendWatches?: FriendWatch[]
  onOpenFriendTitle?: (watch: FriendWatch) => void
}

export function DayPanel({ date, entries, onAdd, onEdit, friendWatches = [], onOpenFriendTitle }: Props) {
  const social = useSocialContext()
  const hero = entries.find((e) => e.backdropPath) ?? entries[0]
  const heroImg = hero && (backdropUrl(hero.backdropPath) ?? posterUrl(hero.posterPath, 'w500'))

  return (
    <section className="day-panel" id="day-panel" key={date}>
      <header className={`day-hero ${heroImg ? 'has-image' : ''}`}>
        {heroImg && <div className="day-hero-img" style={{ backgroundImage: `url(${heroImg})` }} />}
        <div className="day-hero-content">
          <span className="eyebrow">{date === today() ? 'Vandaag' : 'Gekeken op'}</span>
          <h3>{formatLongDate(date)}</h3>
        </div>
        <button className="btn-primary" onClick={onAdd}>+ Toevoegen</button>
      </header>

      {entries.length === 0 ? (
        <p className="empty">{friendWatches.length ? 'Jij keek niets op deze dag.' : 'Nog niets gekeken op deze dag.'}</p>
      ) : (
        <ul className="entry-list">
          {entries.map((e, i) => (
            <li key={e.id} className="rise" style={{ '--i': i } as CSSProperties}>
              <button className={`ticket ${e.cinema ? 'is-cinema' : ''}`} onClick={() => onEdit(e)}>
                <Poster path={e.posterPath} title={e.title} size="w185" />
                <div className="entry-info">
                  <strong>{e.title}</strong>
                  <span className="meta-line">
                    <span className={`badge badge-${e.mediaType}`}>{e.mediaType === 'tv' ? 'Serie' : 'Film'}</span>
                    {e.cinema && <span className="cinema-tag"><TicketIcon size={12} /> Bios</span>}
                    {e.year && <span className="muted small">{e.year}</span>}
                    {e.season != null && (
                      <span className="muted small">S{e.season}{e.episode != null && `E${e.episode}`}</span>
                    )}
                  </span>
                  {e.rating != null && <StarRating value={e.rating} />}
                  {e.note && <p className="entry-note">{e.note}</p>}
                  {social?.me && <ReactionSummary ownerId={social.me.id} entryId={e.id} />}
                </div>
                <span className="ticket-stub" aria-hidden>{e.cinema ? 'ADMIT ONE' : 'AT HOME'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {friendWatches.length > 0 && (
        <div className="day-friends">
          <h4 className="section-label">Vrienden keken</h4>
          <ul>
            {friendWatches.map((w, i) => (
              <li key={`${w.friend.id}-${w.entry.id}`} className="rise" style={{ '--i': i } as CSSProperties}>
                <button className="day-friend-item" onClick={() => onOpenFriendTitle?.(w)}>
                  <Poster path={w.entry.posterPath} title={w.entry.title} size="w92" />
                  <span className="feed-text">
                    <span className="feed-who"><Avatar profile={w.friend} size={18} /> {w.friend.display_name.split(' ')[0]}</span>
                    <strong>{w.entry.title}{w.entry.season != null && w.entry.episode != null && <span className="muted"> · S{w.entry.season}E{w.entry.episode}</span>}</strong>
                    {w.entry.rating != null && <StarRating value={w.entry.rating} />}
                  </span>
                  <ChevronIcon className="friend-chevron" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
