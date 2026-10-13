import { useState } from 'react'
import { CheckMark } from './Icons'
import type { WatchItem } from '../types'
import type { Profile } from '../lib/supabase'
import { Modal } from './Modal'
import { Poster } from './Poster'
import { Avatar } from './FriendsView'

interface Props {
  item: WatchItem
  friends: Profile[]
  onSend: (toIds: string[], note: string) => Promise<void>
  onClose: () => void
}

/** Een titel aanraden aan één of meer vrienden, met optioneel een berichtje. */
export function RecommendSheet({ item, friends, onSend, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false })
  const toggle = (id: string) => setSelected((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  const send = async () => {
    setState({ busy: true })
    try {
      await onSend([...selected], note.trim())
      onClose()
    } catch (err) {
      setState({ busy: false, error: (err as Error).message })
    }
  }

  return (
    <Modal title="Aanraden" onClose={onClose}>
      <div className="recommend-sheet">
        <div className="entry-form-head">
          <Poster path={item.posterPath} title={item.title} size="w185" />
          <div>
            <strong>{item.title}</strong>
            <span className="muted small">{item.mediaType === 'tv' ? 'Serie' : 'Film'}{item.year && ` · ${item.year}`}</span>
          </div>
        </div>
        {friends.length === 0 ? (
          <p className="muted">Nog niemand anders in de app om iets aan te raden.</p>
        ) : (
          <>
            <span className="section-label">Aan wie?</span>
            <ul className="recommend-friends">
              {friends.map((f) => (
                <li key={f.id}>
                  <button className={selected.has(f.id) ? 'selected' : ''} onClick={() => toggle(f.id)} aria-pressed={selected.has(f.id)}>
                    <Avatar profile={f} size={44} />
                    <span>{f.display_name.split(' ')[0]}</span>
                    <span className="recommend-check" aria-hidden>{selected.has(f.id) && <CheckMark size={12} strokeWidth={3} />}</span>
                  </button>
                </li>
              ))}
            </ul>
            <textarea rows={2} maxLength={280} placeholder="Waarom moeten ze dit zien? (optioneel)" value={note} onChange={(e) => setNote(e.target.value)} />
            {state.error && <p className="error small">{state.error}</p>}
            <button className="btn-primary" disabled={selected.size === 0 || state.busy} onClick={send}>
              {state.busy ? 'Versturen…' : selected.size > 1 ? `Stuur naar ${selected.size} vrienden` : 'Versturen'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}
