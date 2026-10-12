import { useState, type FormEvent } from 'react'
import { githubBackend, saveGitHubConfig, type GitHubConfig } from '../lib/backends'

const DEFAULT_REPO = 'mmulder763/movie-journal-data'
const TOKEN_URL = 'https://github.com/settings/personal-access-tokens/new'

interface Props {
  current: GitHubConfig | null
  /** In de dev-versie kun je ook zonder GitHub (lokale dev-server) verder */
  allowLocal: boolean
  onDone: () => void
}

/** Koppelen aan de privé data-repo: één keer per apparaat een GitHub-token invullen. */
export function Setup({ current, allowLocal, onDone }: Props) {
  const [repo, setRepo] = useState(current ? `${current.owner}/${current.repo}` : DEFAULT_REPO)
  const [token, setToken] = useState('')
  const [state, setState] = useState<{ busy: boolean; error?: string }>({ busy: false })

  const connect = async (e: FormEvent) => {
    e.preventDefault()
    const [owner, name] = repo.trim().split('/')
    if (!owner || !name) return setState({ busy: false, error: 'Vul de repo in als eigenaar/naam.' })
    const config = { owner, repo: name, token: token.trim() }
    setState({ busy: true })
    try {
      // Test: journal lezen en keys ophalen voordat we iets opslaan
      const backend = githubBackend(config)
      await backend.load()
      const keys = await backend.loadKeys!()
      if (!keys.tmdb) throw new Error('config.json in de repo mist "tmdbApiKey".')
      saveGitHubConfig(config)
      onDone()
    } catch (err) {
      setState({ busy: false, error: (err as Error).message })
    }
  }

  const disconnect = () => {
    saveGitHubConfig(null)
    localStorage.removeItem('movie-journal:keys:v1')
    onDone()
  }

  return (
    <div className="setup">
      <form className="setup-card" onSubmit={connect}>
        <img className="setup-logo" src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
        <h1>Movie <em>Journal</em></h1>
        <p className="muted">
          Je journal staat in een privé GitHub-repo, zodat al je apparaten gelijk lopen. Koppel dit apparaat één keer met een token.
        </p>

        <label>
          Data-repo
          <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="eigenaar/repo" autoComplete="off" />
        </label>
        <label>
          GitHub-token
          <input type="password" value={token} onChange={(e) => setToken(e.target.value)} required
            placeholder={current ? 'Nieuw token om te vervangen' : 'github_pat_…'} autoComplete="off" />
        </label>

        <details className="setup-help">
          <summary>Hoe maak ik een token?</summary>
          <ol>
            <li>Open <a href={TOKEN_URL} target="_blank" rel="noreferrer">Fine-grained personal access token</a>.</li>
            <li>Kies bij <em>Repository access</em> → <em>Only select repositories</em> → <code>{repo || DEFAULT_REPO}</code>.</li>
            <li>Bij <em>Permissions → Contents</em>: <strong>Read and write</strong>. Verder niets nodig.</li>
            <li>Kopieer het token hierboven. Het wordt alleen op dit apparaat bewaard.</li>
          </ol>
        </details>

        {state.error && <p className="error small">{state.error}</p>}
        <button className="btn-primary" type="submit" disabled={state.busy}>{state.busy ? 'Verbinden…' : 'Verbinden'}</button>
        {current && <button type="button" className="btn-text btn-reset" onClick={disconnect}>Dit apparaat ontkoppelen</button>}
        {allowLocal && !current && (
          <button type="button" className="btn-text" onClick={onDone}>Lokaal verder (dev-server)</button>
        )}
      </form>
    </div>
  )
}
