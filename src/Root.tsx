import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import App from './App'
import { Auth } from './components/Auth'
import { localBackend, supabaseBackend, type Backend } from './lib/backends'
import { setApiKeys, type ApiKeys } from './lib/keys'
import { PROFILE_FIELDS } from './lib/avatar'
import { supabase, supabaseConfigured, type Profile } from './lib/supabase'

// Keys van de laatste geslaagde sessie, zodat de app ook offline opstart
const KEYS_CACHE = 'movie-journal:keys:v1'
const cachedKeys = (): ApiKeys | null => {
  try {
    return JSON.parse(localStorage.getItem(KEYS_CACHE) ?? 'null') as ApiKeys | null
  } catch {
    return null
  }
}

/** Het account van de opgeslagen sessie bestaat niet meer */
class AccountGone extends Error {}

/** Uitnodigingslink: ?vriend=gebruikersnaam (bewaard tot na het inloggen) */
const INVITE_KEY = 'movie-journal:invite'
function readInvite(): string | null {
  const fromUrl = new URLSearchParams(location.search).get('vriend')
  if (fromUrl) {
    sessionStorage.setItem(INVITE_KEY, fromUrl)
    history.replaceState(null, '', location.pathname)
  }
  return sessionStorage.getItem(INVITE_KEY)
}

type State =
  | { phase: 'loading' }
  | { phase: 'auth' }
  | { phase: 'ready'; backend: Backend; me: Profile | null }
  | { phase: 'error'; error: string }

/**
 * Kiest de opslag: met Supabase-configuratie inloggen en het eigen journal laden;
 * zonder (lokale development) de dev-server met data/journal.json.
 */
export default function Root() {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [invite] = useState(readInvite)

  useEffect(() => {
    if (!supabaseConfigured) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!supabaseConfigured) {
      setState({ phase: 'ready', backend: localBackend, me: null })
      return
    }
    if (session === undefined) return
    if (!userId) {
      setState({ phase: 'auth' })
      return
    }
    let cancelled = false
    setState({ phase: 'loading' })
    ;(async () => {
      // Bestaat dit account nog? (bv. na een reset) Een opgeslagen sessie blijft anders geldig lijken
      const { error: userError } = await supabase.auth.getUser()
      if (userError && userError.status && userError.status >= 400 && userError.status < 500) throw new AccountGone()
      const { data: me, error } = await supabase.from('profiles').select(PROFILE_FIELDS).eq('id', userId).maybeSingle()
      if (error) throw new Error(error.message)
      if (!me) throw new AccountGone()
      const backend = supabaseBackend(userId, `@${me.username}`)
      const keys = await backend.loadKeys!()
      setApiKeys(keys)
      localStorage.setItem(KEYS_CACHE, JSON.stringify(keys))
      if (!cancelled) setState({ phase: 'ready', backend, me })
    })().catch((err) => {
      if (cancelled) return
      if (err instanceof AccountGone) {
        // Account verwijderd: lokale sessie en cache weg, terug naar inloggen
        void signOut()
        return
      }
      // Offline: verder met cache als dat kan; de sync-badge laat zien dat er niet gesynchroniseerd wordt
      const keys = cachedKeys()
      if (keys) {
        setApiKeys(keys)
        setState({ phase: 'ready', backend: supabaseBackend(userId, 'offline'), me: null })
      } else {
        setState({ phase: 'error', error: (err as Error).message })
      }
    })
    return () => {
      cancelled = true
    }
  }, [session, userId])

  async function signOut() {
    // scope 'local': ook als de server het account/de sessie niet meer kent
    await supabase.auth.signOut({ scope: 'local' })
    // Lokale cache van dit account weg, zodat een volgende gebruiker op dit apparaat schoon begint
    for (const k of Object.keys(localStorage)) if (k.startsWith('movie-journal:cache') || k.startsWith('movie-journal:pending')) localStorage.removeItem(k)
    setState({ phase: 'auth' })
  }

  if (state.phase === 'auth') return <Auth inviteFrom={invite} />
  if (state.phase === 'loading') return <div className="boot"><div className="reel-spinner" /></div>
  if (state.phase === 'error') {
    return (
      <div className="setup">
        <div className="setup-card">
          <h1>Kan de database niet bereiken</h1>
          <p className="error small">{state.error}</p>
          <button className="btn-primary" onClick={() => location.reload()}>Opnieuw proberen</button>
          <button className="btn-text" onClick={signOut}>Uitloggen</button>
        </div>
      </div>
    )
  }
  return (
    <App
      key={userId ?? 'local'}
      backend={state.backend}
      me={state.me}
      invite={invite}
      onInviteHandled={() => sessionStorage.removeItem(INVITE_KEY)}
      onSignOut={supabaseConfigured ? signOut : undefined}
      onProfileUpdated={(me) => setState((st) => (st.phase === 'ready' ? { ...st, me } : st))}
    />
  )
}
