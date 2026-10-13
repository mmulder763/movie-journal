import type { CSSProperties } from 'react'
import { BellIcon, reactionFor } from './Icons'
import type { Entry } from '../types'
import type { Notification, Recommendation } from '../lib/inbox'
import type { Profile } from '../lib/supabase'
import { Modal } from './Modal'
import { PushPrompt } from './PushPrompt'
import { Poster } from './Poster'
import { Avatar } from './FriendsView'

interface Props {
  me: Profile
  notifications: Notification[]
  seenAt: string
  people: Map<string, Profile>
  myEntries: Entry[]
  onOpenRecommendation: (r: Recommendation) => void
  onOpenMyEntry: (entry: Entry) => void
  onClose: () => void
}

const ago = (iso: string) => {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'net'
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.floor(min / 60)} u`
  return new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
}

/** Meldingen: reacties op jouw kijkmomenten en aanbevelingen van vrienden. */
export function InboxSheet({ me, notifications, seenAt, people, myEntries, onOpenRecommendation, onOpenMyEntry, onClose }: Props) {
  const byId = new Map(myEntries.map((e) => [e.id, e]))
  return (
    <Modal title="Meldingen" onClose={onClose}>
      <PushPrompt me={me} />
      {notifications.length === 0 ? (
        <div className="list-empty">
          <span className="list-empty-icon"><BellIcon size={44} /></span>
          <h3>Nog geen meldingen</h3>
          <p className="muted">Hier zie je reacties op wat je keek, en titels die vrienden je aanraden.</p>
        </div>
      ) : (
        <ul className="inbox">
          {notifications.map((n, i) => {
            const fromId = n.kind === 'reaction' ? n.reaction.from_id : n.recommendation.from_id
            const who = people.get(fromId)
            const name = who?.display_name.split(' ')[0] ?? 'Iemand'
            const unread = n.at > seenAt
            if (n.kind === 'recommendation') {
              const r = n.recommendation
              return (
                <li key={`rec-${r.id}`} className="rise" style={{ '--i': Math.min(i, 12) } as CSSProperties}>
                  <button className={`inbox-item ${unread ? 'unread' : ''}`} onClick={() => onOpenRecommendation(r)}>
                    {who && <Avatar profile={who} size={36} />}
                    <span className="inbox-text">
                      <span><strong>{name}</strong> raadt je <strong>{r.title}</strong> aan</span>
                      {r.note && <span className="entry-note">“{r.note}”</span>}
                      <span className="muted small">{ago(n.at)}</span>
                    </span>
                    <Poster path={r.poster_path} title={r.title} size="w92" />
                  </button>
                </li>
              )
            }
            const r = n.reaction
            const entry = byId.get(r.entry_id)
            return (
              <li key={`re-${r.id}`} className="rise" style={{ '--i': Math.min(i, 12) } as CSSProperties}>
                <button className={`inbox-item ${unread ? 'unread' : ''}`} onClick={() => entry && onOpenMyEntry(entry)} disabled={!entry}>
                  {who && <Avatar profile={who} size={36} />}
                  <span className="inbox-text">
                    <span>
                      <strong>{name}</strong> {r.emoji ? <>reageerde <ReactionIcon emoji={r.emoji} /> op</> : 'schreef bij'} <strong>{entry?.title ?? 'een kijkmoment'}</strong>
                    </span>
                    {r.message && <span className="entry-note">“{r.message}”</span>}
                    <span className="muted small">{ago(n.at)}</span>
                  </span>
                  {entry && <Poster path={entry.posterPath} title={entry.title} size="w92" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}

function ReactionIcon({ emoji }: { emoji: string }) {
  const r = reactionFor(emoji)
  return r ? <r.Icon size={16} className="inline-icon" /> : null
}
