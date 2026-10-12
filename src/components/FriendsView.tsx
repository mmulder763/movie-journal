import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import type { Entry } from '../types'
import type { Profile } from '../lib/supabase'
import { tasteMatch, type Friend, type SocialState } from '../lib/social'
import { compareDatesDesc } from '../lib/titles'
import { Poster } from './Poster'
import { StarRating } from './StarRating'

interface Props {
  me: Profile
  myEntries: Entry[]
  social: SocialState
  onOpenFriend: (friend: Friend) => void
  notify: (text: string) => void
  /** Uit een uitnodigingslink: gebruikersnaam om meteen toe te voegen */
  invite?: string | null
}

const relative = (iso: string) => {
  const days = Math.round((Date.now() - new Date(`${iso}T12:00:00`).getTime()) / 86_400_000)
  if (days <= 0) return 'vandaag'
  if (days === 1) return 'gisteren'
  if (days < 7) return `${days} dagen geleden`
  return new Date(`${iso}T12:00:00`).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

const initials = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()

export function Avatar({ profile, size = 40 }: { profile: Profile; size?: number }) {
  // Vaste kleur per gebruiker, afgeleid van de gebruikersnaam
  const hue = [...profile.username].reduce((n, c) => n + c.charCodeAt(0), 0) % 360
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, '--hue': hue } as CSSProperties}>
      {initials(profile.display_name)}
    </span>
  )
}

export function FriendsView({ me, myEntries, social, onOpenFriend, notify, invite }: Props) {
  const [username, setUsername] = useState(invite ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const inviteLink = `${location.origin}${import.meta.env.BASE_URL}?vriend=${me.username}`

  // Bij openen van de tab altijd verse stand ophalen
  const { refresh } = social
  useEffect(() => {
    void refresh()
  }, [refresh])

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!username.trim()) return
    setBusy(true)
    setError(null)
    try {
      await social.sendRequest(username)
      notify(`👋 Verzoek verstuurd naar @${username.trim().replace(/^@/, '')}`)
      setUsername('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    const text = `Volg me op Movie Journal: ${inviteLink}`
    try {
      if (navigator.share) await navigator.share({ title: 'Movie Journal', text, url: inviteLink })
      else {
        await navigator.clipboard.writeText(inviteLink)
        notify('🔗 Uitnodigingslink gekopieerd')
      }
    } catch { /* delen geannuleerd */ }
  }

  const run = (fn: () => Promise<void>) => () => fn().catch((err) => notify((err as Error).message))

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

      <form className="add-friend" onSubmit={add}>
        <div className="swipe-search">
          <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="@gebruikersnaam"
            autoCapitalize="none" autoComplete="off" />
        </div>
        <button className="btn-primary" disabled={busy || !username.trim()}>{busy ? '…' : 'Toevoegen'}</button>
      </form>
      {error && <p className="error small">{error}</p>}

      {social.incoming.length > 0 && (
        <div className="friend-section">
          <h4 className="section-label">Verzoeken</h4>
          {social.incoming.map((p) => (
            <div key={p.id} className="friend-row request">
              <Avatar profile={p} />
              <div className="friend-name"><strong>{p.display_name}</strong><span className="muted small">@{p.username} wil je volgen</span></div>
              <button className="btn-primary" onClick={run(() => social.accept(p.id))}>Accepteren</button>
              <button className="icon-btn" onClick={run(() => social.remove(p.id))} aria-label="Weigeren">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="friend-section">
        <h4 className="section-label">Vrienden {social.friends.length > 0 && <span className="muted small">· {social.friends.length}</span>}</h4>
        {social.loading ? (
          <p className="muted small">Laden…</p>
        ) : social.friends.length === 0 ? (
          <p className="empty">Nog geen vrienden. Deel je uitnodigingslink of voeg iemand toe op gebruikersnaam.</p>
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
        {social.outgoing.length > 0 && (
          <p className="muted small">Wacht op: {social.outgoing.map((p) => `@${p.username}`).join(', ')}</p>
        )}
        {social.error && <p className="error small">{social.error}</p>}
      </div>

      {feed.length > 0 && (
        <div className="friend-section">
          <h4 className="section-label">Recent bij vrienden</h4>
          <ul className="feed">
            {feed.map(({ friend, entry }, i) => (
              <li key={`${friend.id}-${entry.id}`} className="rise" style={{ '--i': Math.min(i, 15) } as CSSProperties}>
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
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
