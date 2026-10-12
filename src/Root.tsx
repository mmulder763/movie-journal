import { useEffect, useState } from 'react'
import App from './App'
import { Setup } from './components/Setup'
import { githubBackend, loadGitHubConfig, localBackend, type Backend } from './lib/backends'
import { setApiKeys, type ApiKeys } from './lib/keys'

// Keys van de laatste geslaagde koppeling, zodat de app ook offline opstart
const KEYS_CACHE = 'movie-journal:keys:v1'
const cachedKeys = (): ApiKeys | null => {
  try {
    return JSON.parse(localStorage.getItem(KEYS_CACHE) ?? 'null') as ApiKeys | null
  } catch {
    return null
  }
}

type State =
  | { phase: 'setup' }
  | { phase: 'loading' }
  | { phase: 'ready'; backend: Backend }
  | { phase: 'error'; error: string }

/**
 * Kiest de opslag: met een gekoppeld GitHub-token de privé data-repo, anders (alleen in
 * dev) de lokale dev-server. In de gehoste versie zonder token: eerst koppelen.
 */
export default function Root() {
  const [state, setState] = useState<State>({ phase: 'loading' })
  const [settings, setSettings] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    const config = loadGitHubConfig()
    if (!config) {
      setState(import.meta.env.DEV ? { phase: 'ready', backend: localBackend } : { phase: 'setup' })
      return
    }
    const backend = githubBackend(config)
    setState({ phase: 'loading' })
    backend.loadKeys!()
      .then((keys) => {
        setApiKeys(keys)
        localStorage.setItem(KEYS_CACHE, JSON.stringify(keys))
        setState({ phase: 'ready', backend })
      })
      .catch((err) => {
        const cached = cachedKeys()
        if (cached) {
          // Offline: verder met de lokale cache; de sync-badge toont dat er niet gesynchroniseerd is
          console.warn('Data-repo onbereikbaar, verder met cache', err)
          setApiKeys(cached)
          setState({ phase: 'ready', backend })
        } else {
          setState({ phase: 'error', error: (err as Error).message })
        }
      })
  }, [version])

  const reload = () => {
    setSettings(false)
    setVersion((v) => v + 1)
  }

  if (state.phase === 'setup' || settings) {
    return <Setup current={loadGitHubConfig()} allowLocal={import.meta.env.DEV} onDone={reload} />
  }
  if (state.phase === 'loading') return <div className="boot"><div className="reel-spinner" /></div>
  if (state.phase === 'error') {
    return (
      <div className="setup">
        <div className="setup-card">
          <h1>Kan je data-repo niet bereiken</h1>
          <p className="error small">{state.error}</p>
          <button className="btn-primary" onClick={reload}>Opnieuw proberen</button>
          <button className="btn-text" onClick={() => setSettings(true)}>Koppeling aanpassen</button>
        </div>
      </div>
    )
  }
  return <App key={version} backend={state.backend} onOpenSettings={() => setSettings(true)} />
}
