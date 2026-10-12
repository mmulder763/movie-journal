import { useEffect, useMemo, type CSSProperties } from 'react'
import type { Entry } from '../types'
import type { Profile } from '../lib/supabase'
import { tasteMatch, type Friend, type SocialState } from '../lib/social'
import { compareDatesDesc, titleKey } from '../lib/titles'
import { Poster } from './Poster'
import { StarRating } from './StarRating'

interface Props {
  me: Profile
  myEntries: Entry[]
  social: SocialState
  onOpenFriend: (friend: Friend) => void
  notify: (text: string) => void
  /** Al gezien of al op je watchlist */
  knownKeys: Set<string>
  onAddToWatchlist: (entry: Entry) => void
}

const relative = (iso: string) => {
  const days = Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000)
  if (days <= 0) return 'vandaag'
  if (days === 1) return 'gisteren'
  if (days < 7) return `${days} dagen geleden`
  return new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

/** Uitnodigingstekst bij delen (de link zelf gaat er los bij) */
const inviteText = (name: string) =>
  `🎬 ${name.split(' ')[0]} nodigt je uit voor Movie Journal!

Een dagboek voor alles wat je kijkt:
📅 Een agenda met welke film of aflevering je op welke dag zag
⭐ Ratings en notities, plus IMDb- en Rotten Tomatoes-scores
🔥 Swipe je filmgeschiedenis bij elkaar (gezien / niet gezien / watchlist)
🔖 Een watchlist met waar je het in Nederland kunt streamen
👀 Zie wat vrienden kijken en hoe goed jullie smaak matcht

Gratis, werkt op je telefoon als app. Maak een account:`

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export function Avatar({ profile, size = 40 }: { profile: Profile; size?: number }) {
  if (profile.avatar_url) {
    return <img className="avatar" src={profile.avatar_url} alt="" style={{ width: size, height: size }} loading="lazy" />
  }
  // Zonder foto: initialen op een vaste kleur per gebruiker, afgeleid van de gebruikersnaam
  const hue = [...profile.username].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, '--hue': hue } as CSSProperties}>
      {initials(profile.display_name)}
    </span>
  )
}

export function FriendsView({ me, myEntries, social, onOpenFriend, notify, knownKeys, onAddToWatchlist }: Props) {
  const inviteLink = `${location.origin}${import.meta.env.BASE_URL}?vriend=${me.username}`

  // Bij openen van de tab altijd verse stand ophalen
  const { refresh } = social
  useEffect(() => {
    void refresh()
  }, [refresh])

  const share = async () => {
    // Link alleen als `url` meegeven: apps als WhatsApp plakken text + url achter elkaar
    try {
      if (navigator.share) await navigator.share({ title: 'Movie Journal', text: inviteText(me.display_name), url: inviteLink })
      else {
        await navigator.clipboard.writeText(`${inviteText(me.display_name)}\n\n${inviteLink}`)
        notify('🔗 Uitnodiging gekopieerd')
      }
    } catch { /* delen geannuleerd */ }
  }

  // Feed: wat vrienden het laatst hebben gelogd (op logmoment, zodat geswipete oude films niet wegzakken)
  const feed = useMemo(
    () =>
      social.friends
        .flatMap((f) => f.journal.entries.map((entry) => ({ friend: f, entry })))
        .sort((a, b) => b.entry.createdAt - a.entry.createdAt)
        .slice(0, 40),
    [social.friends],
  )

  return (
    <section className="friends-view">
      <div className="me-card">
        <Avatar profile={me} size={56} />
        <div>
          <strong>{me.display_name}</strong>
          <span className="muted small">@{me.username}</span>
        </div>
        <button className="btn-ghost" onClick={share}>🔗 Nodig uit</button>
      </div>

      <div className="friend-section">
        <h4 className="section-label">Vrienden {social.friends.length > 0 && <span className="muted small">· {social.friends.length}</span>}</h4>
        {social.loading ? (
          <p className="muted small">Laden…</p>
        ) : social.friends.length === 0 ? (
          <p className="empty">Nog niemand anders in de app. Deel de link via 🔗 Nodig uit.</p>
        ) : (
          <div className="friend-grid">
            {social.friends.map((f, i) => {
              const match = tasteMatch(myEntries, f.journal.entries)
              const recent = [...f.journal.entries].sort((a, b) => compareDatesDesc(a.date, b.date))[0]
              return (
                <button key={f.id} className="friend-card rise" style={{ '--i': i } as CSSProperties} onClick={() => onOpenFriend(f)}>
                  <Avatar profile={f} size={48} />
                  <strong>{f.display_name}</strong>
                  <span className="muted small">@{f.username}</span>
                  <span className="friend-match">
                    {match.score != null ? `${match.score}% match` : `${match.shared} samen gezien`}
                  </span>
                  {recent && <span className="muted small friend-recent">Laatst: {recent.title}</span>}
                </button>
              )
            })}
          </div>
        )}
        {social.error && <p className="error small">{social.error}</p>}
      </div>

      {feed.length > 0 && (
        <div className="friend-section">
          <h4 className="section-label">Recent bij vrienden</h4>
          <ul className="feed">
            {feed.map(({ friend, entry }, i) => (
              <li key={`${friend.id}-${entry.id}`} className="rise feed-row" style={{ '--i': Math.min(i, 15) } as CSSProperties}>
                <button className="feed-item" onClick={() => onOpenFriend(friend)}>
                  <Avatar profile={friend} size={34} />
                  <div className="feed-text">
                    <span><strong>{friend.display_name}</strong> keek <strong>{entry.title}</strong>
                      {entry.season != null && entry.episode != null && <span className="muted"> S{entry.season}E{entry.episode}</span>}
                    </span>
                    <span className="meta-line">
                      <span className="muted small">{entry.date ? relative(entry.date) : 'ooit gezien'}</span>
                      {entry.rating != null && <StarRating value={entry.rating} />}
                    </span>
                    {entry.note && <p className="entry-note">“{entry.note}”</p>}
                  </div>
                  <Poster path={entry.posterPath} title={entry.title} size="w92" />
                </button>
                {!knownKeys.has(titleKey(entry)) && (
                  <button className="feed-watch" onClick={() => onAddToWatchlist(entry)} aria-label={`${entry.title} op je watchlist`} title="Op mijn watchlist">
                    🔖
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
