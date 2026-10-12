import type { Journal, Op } from '../types'
import type { ApiKeys } from './keys'
import { applyOp, emptyJournal, normalizeJournal } from './journal'

/** Waar het journal staat: de lokale dev-server of een privé GitHub-repo. */
export interface Backend {
  kind: 'local' | 'github'
  label: string
  load(): Promise<Journal>
  apply(ops: Op[]): Promise<Journal>
  /** Alleen GitHub: API-keys uit config.json */
  loadKeys?(): Promise<ApiKeys>
  /** Alleen GitHub: controleert of het token de repo kan zien (gooit met uitleg als dat niet zo is) */
  checkAccess?(): Promise<void>
}

// ---------- Lokaal (dev-server, data/journal.json) ----------

async function localApi<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Server-fout ${res.status}`)
  return body as T
}

export const localBackend: Backend = {
  kind: 'local',
  label: 'data/journal.json op deze computer',
  load: async () => normalizeJournal(await localApi('api/journal')),
  apply: async (ops) => normalizeJournal(await localApi('api/ops', { method: 'POST', body: JSON.stringify(ops) })),
}

// ---------- GitHub (privé data-repo via de Contents API) ----------

export interface GitHubConfig {
  owner: string
  repo: string
  token: string
}

const GITHUB_KEY = 'movie-journal:github:v1'
const JOURNAL_PATH = 'journal.json'
const CONFIG_PATH = 'config.json'

export function loadGitHubConfig(): GitHubConfig | null {
  try {
    const raw = localStorage.getItem(GITHUB_KEY)
    return raw ? (JSON.parse(raw) as GitHubConfig) : null
  } catch {
    return null
  }
}

export function saveGitHubConfig(config: GitHubConfig | null) {
  if (config) localStorage.setItem(GITHUB_KEY, JSON.stringify(config))
  else localStorage.removeItem(GITHUB_KEY)
}

// UTF-8-veilige base64 (btoa/atob kennen alleen Latin-1)
function toBase64(text: string) {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

const fromBase64 = (b64: string) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)))

class GitHubError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export function githubBackend({ owner, repo, token }: GitHubConfig): Backend {
  const base = `https://api.github.com/repos/${owner}/${repo}/contents/`

  async function gh(path: string, init: RequestInit = {}, accept = 'application/vnd.github+json') {
    const res = await fetch(base + path, {
      ...init,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const hint = res.status === 401 ? ' (token ongeldig of verlopen)' : res.status === 403 ? ' (geen rechten op de repo)' : ''
      throw new GitHubError(`GitHub ${res.status}: ${body.message ?? res.statusText}${hint}`, res.status)
    }
    return res
  }

  /** Bestand + sha (nodig om te overschrijven), of null als het nog niet bestaat. */
  async function readFile(path: string): Promise<{ text: string; sha: string } | null> {
    try {
      const meta = (await (await gh(path)).json()) as { sha: string; content?: string; size: number }
      // Boven 1 MB levert de Contents API geen inhoud mee; dan apart als raw ophalen
      const text = meta.content ? fromBase64(meta.content) : await (await gh(path, {}, 'application/vnd.github.raw+json')).text()
      return { text, sha: meta.sha }
    } catch (err) {
      if (err instanceof GitHubError && err.status === 404) return null
      throw err
    }
  }

  async function readJournal() {
    const file = await readFile(JOURNAL_PATH)
    return { journal: file ? normalizeJournal(JSON.parse(file.text)) : emptyJournal(), sha: file?.sha }
  }

  return {
    kind: 'github',
    label: `${owner}/${repo}`,
    load: async () => (await readJournal()).journal,
    async apply(ops) {
      // Optimistic concurrency: bij een conflict (ander apparaat schreef tussendoor) opnieuw lezen en toepassen
      for (let attempt = 0; ; attempt++) {
        const { journal, sha } = await readJournal()
        const next = ops.reduce(applyOp, journal)
        try {
          await gh(JOURNAL_PATH, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `Journal: ${ops.length} ${ops.length === 1 ? 'wijziging' : 'wijzigingen'}`,
              content: toBase64(JSON.stringify(next, null, 2) + '\n'),
              ...(sha ? { sha } : {}),
            }),
          })
          return next
        } catch (err) {
          const conflict = err instanceof GitHubError && (err.status === 409 || err.status === 422)
          if (!conflict || attempt >= 3) throw err
        }
      }
    },
    async checkAccess() {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      })
      if (res.status === 401) throw new Error('Token ongeldig of verlopen. Maak een nieuw token aan.')
      // Bij een privé repo zonder toegang geeft GitHub 404 i.p.v. 403
      if (res.status === 404) {
        throw new Error(
          `Dit token heeft geen toegang tot ${owner}/${repo}. Kies bij "Repository access" → "Only select repositories" deze repo (niet "Public repositories").`,
        )
      }
      if (!res.ok) throw new Error(`GitHub ${res.status}: ${res.statusText}`)
    },
    async loadKeys() {
      const file = await readFile(CONFIG_PATH)
      if (!file) return {}
      const config = JSON.parse(file.text) as { tmdbApiKey?: string; omdbApiKey?: string }
      return { tmdb: config.tmdbApiKey, omdb: config.omdbApiKey }
    },
  }
}
