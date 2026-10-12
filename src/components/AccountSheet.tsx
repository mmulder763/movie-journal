import { useRef, useState } from 'react'
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
        <p className="muted small">
          Je journal wordt opgeslagen in je account ({syncLabel}). Iedereen met een account in de app kan je kijkgeschiedenis, ratings, notities en watchlist zien.
        </p>
        <button className="btn-ghost" onClick={onSignOut}>Uitloggen</button>
      </div>
    </Modal>
  )
}
