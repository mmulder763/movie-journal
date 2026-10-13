import { useState, type FormEvent } from 'react'
import { REACTION_EMOJI, useSocialContext, type Reaction } from '../lib/inbox'
import { Avatar } from './FriendsView'

interface Props {
  ownerId: string
  entryId: string
  /** Alleen bekijken (eigen kijkmomenten): geen knoppen om te reageren */
  readOnly?: boolean
}

/** Emoji-reacties en korte berichtjes onder een kijkmoment. */
export function ReactionBar({ ownerId, entryId, readOnly = false }: Props) {
  const ctx = useSocialContext()
  const [picking, setPicking] = useState(false)
  const [writing, setWriting] = useState(false)
  const [message, setMessage] = useState('')
  if (!ctx?.me) return null
  const { me, people, inbox } = ctx
  const list = inbox.byEntry.get(`${ownerId}:${entryId}`) ?? []
  const emojis = new Map<string, Reaction[]>()
  for (const r of list) if (r.emoji) emojis.set(r.emoji, [...(emojis.get(r.emoji) ?? []), r])
  const messages = list.filter((r) => r.message).sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (readOnly && list.length === 0) return null

  const send = async (e: FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return
    await inbox.react(ownerId, entryId, { message: message.trim() })
    setMessage('')
    setWriting(false)
  }

  return (
    <div className={`reactions ${readOnly ? 'read-only' : ''}`} onClick={(e) => !readOnly && e.stopPropagation()}>
      <div className="reaction-row">
        {[...emojis].map(([emoji, rs]) => {
          const mine = rs.some((r) => r.from_id === me.id)
          const names = rs.map((r) => people.get(r.from_id)?.display_name ?? '?').join(', ')
          // Alleen-lezen staat soms in een knop: dan geen geneste <button>
          return readOnly ? (
            <span key={emoji} className="reaction-chip" title={names}>{emoji} <span>{rs.length}</span></span>
          ) : (
            <button key={emoji} className={`reaction-chip ${mine ? 'mine' : ''}`} title={names}
              onClick={() => inbox.react(ownerId, entryId, { emoji })}>
              {emoji} <span>{rs.length}</span>
            </button>
          )
        })}
        {!readOnly && (
          <>
            <button className="reaction-add" onClick={() => { setPicking((p) => !p); setWriting(false) }} aria-label="Reageer met emoji">☺︎＋</button>
            <button className="reaction-add" onClick={() => { setWriting((w) => !w); setPicking(false) }} aria-label="Schrijf een berichtje">💬</button>
          </>
        )}
      </div>
      {picking && (
        <div className="emoji-picker">
          {REACTION_EMOJI.map((e) => (
            <button key={e} onClick={() => { void inbox.react(ownerId, entryId, { emoji: e }); setPicking(false) }}>{e}</button>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <ul className="reaction-messages">
          {messages.map((r) => {
            const who = people.get(r.from_id)
            return (
              <li key={r.id}>
                {who && <Avatar profile={who} size={20} />}
                <span><strong>{who?.id === me.id ? 'Jij' : who?.display_name.split(' ')[0] ?? '?'}</strong> {r.message}</span>
                {!readOnly && r.from_id === me.id && <button className="reaction-del" onClick={() => inbox.removeReaction(r.id)} aria-label="Verwijderen">✕</button>}
              </li>
            )
          })}
        </ul>
      )}
      {writing && (
        <form className="reaction-form" onSubmit={send}>
          <input autoFocus value={message} onChange={(e) => setMessage(e.target.value)} maxLength={280} placeholder="Schrijf iets…" enterKeyHint="send" />
          <button className="btn-primary" disabled={!message.trim()}>Stuur</button>
        </form>
      )}
    </div>
  )
}

/** Compacte samenvatting voor op een kaartje: "🔥2 😂1 💬1" */
export function ReactionSummary({ ownerId, entryId }: { ownerId: string; entryId: string }) {
  const ctx = useSocialContext()
  const list = ctx?.inbox.byEntry.get(`${ownerId}:${entryId}`) ?? []
  if (list.length === 0) return null
  const counts = new Map<string, number>()
  for (const r of list) {
    const k = r.emoji ?? '💬'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return (
    <span className="reaction-summary">
      {[...counts].map(([k, n]) => <span key={k}>{k}{n > 1 && n}</span>)}
    </span>
  )
}
