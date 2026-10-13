import type { Journal, Op } from '../types'
import type { ApiKeys } from './keys'
import { applyOp, normalizeJournal } from './journal'
import { supabase } from './supabase'

/** Waar het journal staat: de lokale dev-server (development) of Supabase. */
export interface Backend {
  kind: 'local' | 'supabase'
  label: string
  load(): Promise<Journal>
  apply(ops: Op[]): Promise<Journal>
  /** Alleen Supabase: API-keys uit app_config */
  loadKeys?(): Promise<ApiKeys>
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

// ---------- Supabase (één journal-document per gebruiker) ----------

export function supabaseBackend(userId: string, label: string): Backend {
  async function read() {
    const { data, error } = await supabase.from('journals').select('data, version').eq('user_id', userId).single()
    if (error) throw new Error(`Database: ${error.message}`)
    return { journal: normalizeJournal(data.data), version: data.version as number }
  }

  return {
    kind: 'supabase',
    label,
    load: async () => (await read()).journal,
    async apply(ops) {
      // Optimistic concurrency: alleen schrijven als niemand anders tussendoor schreef, anders opnieuw
      for (let attempt = 0; attempt < 5; attempt++) {
        const { journal, version } = await read()
        const next = ops.reduce(applyOp, journal)
        const { data, error } = await supabase
          .from('journals')
          .update({ data: next, version: version + 1, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('version', version)
          .select('version')
        if (error) throw new Error(`Database: ${error.message}`)
        if (data.length === 1) return next
      }
      throw new Error('Opslaan mislukt: steeds een conflict met een ander apparaat. Probeer het opnieuw.')
    },
    async loadKeys() {
      const { data, error } = await supabase.from('app_config').select('key, value')
      if (error) throw new Error(`Database: ${error.message}`)
      const get = (k: string) => data.find((r) => r.key === k)?.value
      return { tmdb: get('tmdb_api_key'), omdb: get('omdb_api_key'), vapid: get('vapid_public_key') }
    },
  }
}
