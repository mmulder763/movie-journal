import type { Profile } from '../lib/supabase'
import { Modal } from './Modal'
import { Avatar } from './FriendsView'

interface Props {
  me: Profile
  syncLabel: string
  onClose: () => void
  onSignOut: () => void
}

export function AccountSheet({ me, syncLabel, onClose, onSignOut }: Props) {
  return (
    <Modal title="Account" onClose={onClose}>
      <div className="account-sheet">
        <div className="me-card">
          <Avatar profile={me} size={56} />
          <div>
            <strong>{me.display_name}</strong>
            <span className="muted small">@{me.username}</span>
          </div>
        </div>
        <p className="muted small">
          Je journal wordt opgeslagen in je account ({syncLabel}). Vrienden die je accepteert kunnen je kijkgeschiedenis, ratings, notities en watchlist zien.
        </p>
        <button className="btn-ghost" onClick={onSignOut}>Uitloggen</button>
      </div>
    </Modal>
  )
}
