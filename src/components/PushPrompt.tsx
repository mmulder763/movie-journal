import { useEffect, useState } from 'react'
import type { Profile } from '../lib/supabase'
import { enablePush, pushDiagnose, pushState, sendTestPush, type PushState } from '../lib/push'
import { vapidKey } from '../lib/keys'
import { BellIcon, CloseIcon } from './Icons'

const DISMISS_KEY = 'movie-journal:push-prompt-dismissed'

const HINT: Partial<Record<PushState, string>> = {
  'needs-install': 'Op iPhone kan dit alleen in de app op je beginscherm: open Movie Journal in Safari, tik op Deel en kies "Zet op beginscherm". Open hem daarna via dat icoon.',
  denied: 'Je hebt meldingen eerder geweigerd. Zet ze aan via Instellingen › Meldingen › Movie Journal.',
  unsupported: 'Deze browser ondersteunt geen pushmeldingen.',
}

interface Props {
  me: Profile
  /** Op de agenda: wegklikbaar en alleen tonen zolang meldingen uit staan */
  dismissible?: boolean
}

/** Kaartje om meldingen op dit apparaat aan te zetten (de knop vraagt direct om toestemming). */
export function PushPrompt({ me, dismissible = false }: Props) {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [diagnose, setDiagnose] = useState('')
  const [dismissed, setDismissed] = useState(() => {
    try {
      return dismissible && localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    void pushState().then(setState)
    void pushDiagnose().then(setDiagnose)
  }, [])

  if (!state || dismissed) return null
  if (state === 'on' && dismissible) return null
  if (dismissible && state === 'unsupported') return null

  const enable = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const key = vapidKey()
      if (!key) throw new Error('Meldingen zijn nog niet ingesteld op de server. Herstart de app en probeer opnieuw.')
      await enablePush(me, key)
      setState(await pushState())
      const r = await sendTestPush().catch(() => null)
      setMessage({ ok: true, text: r?.sent ? 'Meldingen staan aan. Je krijgt zo een testmelding.' : 'Meldingen staan aan.' })
    } catch (err) {
      setMessage({ ok: false, text: (err as Error).message })
      setState(await pushState())
    } finally {
      setBusy(false)
      setDiagnose(await pushDiagnose())
    }
  }

  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch { /* privémodus */ }
  }

  return (
    <div className={`push-prompt ${state === 'on' ? 'is-on' : ''}`}>
      <BellIcon size={28} />
      <div className="push-prompt-text">
        <strong>{state === 'on' ? 'Meldingen staan aan' : 'Meldingen aanzetten'}</strong>
        <span className="muted small">
          {state === 'on'
            ? 'Je krijgt een melding bij reacties en aanbevelingen van vrienden.'
            : HINT[state] ?? 'Krijg een melding als iemand op je reageert of je iets aanraadt.'}
        </span>
        {message && <span className={`small ${message.ok ? 'push-info' : 'error'}`}>{message.text}</span>}
        {(state !== 'off' || message) && diagnose && <span className="muted push-diag">{diagnose}</span>}
      </div>
      {state === 'off' && (
        <button className="btn-primary" onClick={enable} disabled={busy}>{busy ? '…' : 'Aanzetten'}</button>
      )}
      {dismissible && (
        <button className="icon-btn push-prompt-close" onClick={dismiss} aria-label="Niet nu"><CloseIcon size={16} /></button>
      )}
    </div>
  )
}
