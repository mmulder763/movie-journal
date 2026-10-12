import { useEffect, useMemo, type CSSProperties } from 'react'
import type { Entry } from '../types'
import type { Profile } from '../lib/supabase'
import { tasteMatch, type Friend, type SocialState } from '../lib/social'
import { summarizeTitles } from '../lib/titles'
import { Poster } from './Poster'
import { StarRating } from './StarRating'

interface Props {
  me: Profile
  myEntries: Entry[]
  social: SocialState
  onOpenFriend: (friend: Friend) => void
  /** Tik op een item in de feed: details van die titel, vanuit die vriend */
  onOpenTitle: (entry: Entry, friend: Friend) => void
  notify: (text: string) => void
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

/** Korte samenvatting van iemands journal: "12 films · 5 series · ★ 4.1" */
export function journalSummary(entries: Entry[]) {
  const titles = summarizeTitles(entries)
  const movies = titles.filter((t) => t.mediaType === 'movie').length
  const ratings = entries.flatMap((e) => (e.rating ? [e.rating] : []))
  const parts = [`${movies} ${movies === 1 ? 'film' : 'films'}`, `${titles.length - movies} series`]
  if (ratings.length) parts.push(`★ ${(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)}`)
  return parts.join(' · ')
}

const DAY = 86_400_000

/** Feed-groep op basis van wanneer iets gelogd is */
function bucket(loggedAt: number) {
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  if (loggedAt >= startOfToday) return 'Vandaag'
  if (loggedAt >= startOfToday - DAY) return 'Gisteren'
  if (loggedAt >= startOfToday - 6 * DAY) return 'Deze week'
  return 'Eerder'
}

const watchedLabel = (date: string | null) => {
  if (!date) return 'ooit gezien'
  return `gezien op ${new Date(`${date}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

export function FriendsView({ me, myEntries, social, onOpenFriend, onOpenTitle, notify }: Props) {
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

  // Vrienden met de meest recente activiteit bovenaan
  const friends = useMemo(
    () =>
      social.friends
        .map((f) => ({ friend: f, lastLogged: Math.max(0, ...f.journal.entries.map((e) => e.createdAt)), match: tasteMatch(myEntries, f.journal.entries) }))
        .sort((a, b) => b.lastLogged - a.lastLogged),
    [social.friends, myEntries],
  )

  // Feed: per vriend per titel het laatste kijkmoment, gegroepeerd op logmoment
  const feed = useMemo(() => {
    const items = social.friends
      .flatMap((f) => f.journal.entries.map((entry) => ({ friend: f, entry })))
      .sort((a, b) => b.entry.createdAt - a.entry.createdAt)
      .slice(0, 50)
    const groups = new Map<string, typeof items>()
    for (const item of items) {
      const label = bucket(item.entry.createdAt)
      groups.set(label, [...(groups.get(label) ?? []), item])
    }
    return [...groups]
  }, [social.friends])

  return (
    <section className="friends-view">
      <div className="me-card">
        <Avatar profile={me} size={52} />
        <div>
          <strong>{me.display_name}</strong>
          <span className="muted small">{journalSummary(myEntries)}</span>
        </div>
        <button className="btn-ghost" onClick={share}>🔗 Nodig uit</button>
      </div>

      <div className="friend-section">
        <h4 className="section-label">Je groep {social.friends.length > 0 && <span className="muted small">· {social.friends.length}</span>}</h4>
        {social.loading ? (
          <p className="muted small">Laden…</p>
        ) : friends.length === 0 ? (
          <div className="list-empty">
            <span className="list-empty-icon">👋</span>
            <h3>Nog niemand anders</h3>
            <p className="muted">Deel de app via 🔗 Nodig uit. Iedereen met een account verschijnt hier vanzelf.</p>
          </div>
        ) : (
          <ul className="friend-list">
            {friends.map(({ friend, match }, i) => (
              <li key={friend.id} className="rise" style={{ '--i': i } as CSSProperties}>
                <button className="friend-row" onClick={() => onOpenFriend(friend)}>
                  <Avatar profile={friend} size={46} />
                  <span className="friend-row-text">
                    <strong>{friend.display_name}</strong>
                    <span className="muted small">{journalSummary(friend.journal.entries)}</span>
                  </span>
                  <span className="friend-match" title="Smaakmatch op basis van titels die jullie allebei een rating gaven">
                    {match.score != null ? `${match.score}%` : `${match.shared} samen`}
                  </span>
                  <span className="friend-chevron" aria-hidden>›</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {social.error && <p className="error small">{social.error}</p>}
      </div>

      {feed.length > 0 && (
        <div className="friend-section">
          <h4 className="section-label">Recent bij vrienden</h4>
          {feed.map(([label, items]) => (
            <div key={label} className="feed-group">
              <span className="feed-day">{label}</span>
              <ul className="feed">
                {items.map(({ friend, entry }, i) => (
                  <li key={`${friend.id}-${entry.id}`} className="rise" style={{ '--i': Math.min(i, 15) } as CSSProperties}>
                    <button className="feed-item" onClick={() => onOpenTitle(entry, friend)}>
                      <Poster path={entry.posterPath} title={entry.title} size="w92" />
                      <span className="feed-text">
                        <span className="feed-who"><Avatar profile={friend} size={20} /> {friend.display_name.split(' ')[0]}</span>
                        <strong>{entry.title}{entry.season != null && entry.episode != null && <span className="muted"> · S{entry.season}E{entry.episode}</span>}</strong>
                        <span className="meta-line">
                          {entry.rating != null && <StarRating value={entry.rating} />}
                          <span className="muted small">{watchedLabel(entry.date)}</span>
                        </span>
                        {entry.note && <span className="entry-note">“{entry.note}”</span>}
                      </span>
                      <span className="friend-chevron" aria-hidden>›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
