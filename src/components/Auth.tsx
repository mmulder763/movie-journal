import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'login' | 'signup'

/** Inloggen of account aanmaken (e-mail + wachtwoord, met gebruikersnaam voor vrienden). */
export function Auth({ inviteFrom }: { inviteFrom?: string | null }) {
  const [mode, setMode] = useState<Mode>(inviteFrom ? 'signup' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [state, setState] = useState<{ busy: boolean; error?: string; info?: string }>({ busy: false })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setState({ busy: true })
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(error.message === 'Invalid login credentials' ? 'E-mail of wachtwoord klopt niet.' : error.message)
        return // Root reageert op de nieuwe sessie
      }
      const name = username.trim().toLowerCase()
      if (!/^[a-z0-9_]{3,20}$/.test(name)) throw new Error('Gebruikersnaam: 3–20 tekens, alleen a-z, 0-9 en _.')
      const { data: free, error: e1 } = await supabase.rpc('username_available', { name })
      if (e1) throw new Error(e1.message)
      if (!free) throw new Error(`@${name} is al bezet.`)
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { username: name, display_name: displayName.trim() || name } },
      })
      if (error) throw new Error(error.message)
      if (!data.session) setState({ busy: false, info: 'Account aangemaakt. Bevestig je e-mail en log daarna in.' })
    } catch (err) {
      setState({ busy: false, error: (err as Error).message })
    }
  }

  return (
    <div className="setup">
      <form className="setup-card" onSubmit={submit}>
        <img className="setup-logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
        <h1>Movie <em>Journal</em></h1>
        {inviteFrom ? (
          <p className="muted"><strong>@{inviteFrom}</strong> nodigt je uit. Maak een account aan om elkaars films te volgen.</p>
        ) : (
          <p className="muted">Houd bij wat je kijkt en volg wat je vrienden zien.</p>
        )}

        <div className="segmented auth-switch">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Inloggen</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Account maken</button>
        </div>

        {mode === 'signup' && (
          <>
            <label>
              Gebruikersnaam
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="bijv. max_m" autoCapitalize="none" autoComplete="username" required />
            </label>
            <label>
              Naam
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Hoe vrienden je zien" autoComplete="name" />
            </label>
          </>
        )}
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label>
          Wachtwoord
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>

        {state.error && <p className="error small">{state.error}</p>}
        {state.info && <p className="small" style={{ color: 'var(--accent)' }}>{state.info}</p>}
        <button className="btn-primary" type="submit" disabled={state.busy}>
          {state.busy ? 'Even geduld…' : mode === 'login' ? 'Inloggen' : 'Account maken'}
        </button>
      </form>
    </div>
  )
}
