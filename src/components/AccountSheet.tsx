import { useEffect, useRef, useState } from 'react'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'
import { vapidKey } from '../lib/keys'
import type { Profile } from '../lib/supabase'
import { removeAvatar, updateProfile, uploadAvatar } from '../lib/avatar'
import { Modal } from './Modal'
import { Avatar } from './FriendsView'

interface Props {
  me: Profile
  syncLabel: string
  onClose: () => void
  onSignOut: () => void
  onProfileUpdated: (profile: Profile) => void
}

export function AccountSheet({ me, syncLabel, onClose, onSignOut, onProfileUpdated }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(me.display_name)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const run = async (label: string, fn: () => Promise<Profile>) => {
    setBusy(label)
    setError(null)
    try {
      onProfileUpdated(await fn())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const trimmed = name.trim()

  return (
    <Modal title="Account" onClose={onClose}>
      <div className="account-sheet">
        <div className="avatar-edit">
          <button className="avatar-upload" onClick={() => fileInput.current?.click()} disabled={!!busy} aria-label="Profielfoto kiezen">
            <Avatar profile={me} size={96} />
            <span className="avatar-upload-badge">{busy === 'upload' ? '…' : '📷'}</span>
          </button>
          <input ref={fileInput} type="file" accept="image/*" hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void run('upload', () => uploadAvatar(me, file))
            }} />
          <div className="avatar-edit-actions">
            <button className="btn-ghost" onClick={() => fileInput.current?.click()} disabled={!!busy}>
              {busy === 'upload' ? 'Uploaden…' : me.avatar_url ? 'Foto wijzigen' : 'Foto kiezen'}
            </button>
            {me.avatar_url && (
              <button className="btn-text" onClick={() => run('remove', () => removeAvatar(me))} disabled={!!busy}>Foto weghalen</button>
            )}
          </div>
        </div>

        <label className="account-field">
          Naam
          <div className="account-name-row">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            <button className="btn-primary" disabled={!trimmed || trimmed === me.display_name || !!busy}
              onClick={() => run('name', () => updateProfile(me, { display_name: trimmed }))}>
              {busy === 'name' ? '…' : 'Opslaan'}
            </button>
          </div>
        </label>
        <span className="muted small">@{me.username}</span>

        {error && <p className="error small">{error}</p>}
        <PushToggle me={me} />

        <p className="muted small">
          Je journal wordt opgeslagen in je account ({syncLabel}). Iedereen met een account in de app kan je kijkgeschiedenis, ratings, notities en watchlist zien.
        </p>
        <button className="btn-ghost" onClick={onSignOut}>Uitloggen</button>
      </div>
    </Modal>
  )
}

const PUSH_TEXT: Record<PushState, string> = {
  on: 'Aan op dit apparaat: je krijgt een melding bij reacties en aanbevelingen.',
  off: 'Krijg een melding als iemand op je reageert of je iets aanraadt.',
  denied: 'Meldingen zijn geblokkeerd. Zet ze aan in de instellingen van je telefoon of browser.',
  'needs-install': 'Op iPhone werken meldingen alleen als de app op je beginscherm staat: Deel → "Zet op beginscherm", en open hem daarvandaan.',
  unsupported: 'Deze browser ondersteunt geen pushmeldingen.',
}

function PushToggle({ me }: { me: Profile }) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void pushState().then(setState)
  }, [])
  if (!state) return null

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (state === 'on') await disablePush()
      else {
        const key = vapidKey()
        if (!key) throw new Error('Meldingen zijn nog niet ingesteld op de server.')
        await enablePush(me, key)
      }
      setState(await pushState())
    } catch (err) {
      setError((err as Error).message)
      setState(await pushState())
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="push-toggle">
      <div>
        <strong>🔔 Meldingen</strong>
        <span className="muted small">{PUSH_TEXT[state]}</span>
      </div>
      {(state === 'on' || state === 'off') && (
        <button className={`switch ${state === 'on' ? 'on' : ''}`} onClick={toggle} disabled={busy} role="switch" aria-checked={state === 'on'} aria-label="Meldingen">
          <span />
        </button>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  )
}
