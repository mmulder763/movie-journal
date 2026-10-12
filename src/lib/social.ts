import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Entry, Journal } from '../types'
import { normalizeJournal } from './journal'
import { PROFILE_FIELDS } from './avatar'
import { supabase, type Profile } from './supabase'
import { titleKey } from './titles'

export interface Friend extends Profile {
  journal: Journal
  updatedAt: string
}

export interface SocialState {
  /** Alle andere gebruikers van de app, met hun journal */
  friends: Friend[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

const REFRESH_MS = 60_000

/** Iedereen met een account is elkaars vriend: alle profielen + journals (alleen-lezen). */
export function useSocial(me: Profile | null): SocialState {
  const [friends, setFriends] = useState<Friend[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!me) return
    try {
      const [{ data: profiles, error: e1 }, { data: journals, error: e2 }] = await Promise.all([
        supabase.from('profiles').select(PROFILE_FIELDS).neq('id', me.id),
        supabase.from('journals').select('user_id, data, updated_at').neq('user_id', me.id),
      ])
      if (e1) throw e1
      if (e2) throw e2
      const byUser = new Map((journals ?? []).map((j) => [j.user_id as string, j]))
      setFriends(
        (profiles ?? [])
          .map((p) => {
            const j = byUser.get(p.id)
            let journal: Journal = { entries: [], skipped: [], skippedItems: [], watchlist: [] }
            try {
              if (j) journal = normalizeJournal(j.data)
            } catch (err) {
              console.warn(`Journal van @${p.username} onleesbaar`, err)
            }
            return { ...p, journal, updatedAt: j?.updated_at ?? '' }
          })
          .sort((a, b) => a.display_name.localeCompare(b.display_name, 'nl')),
      )
      setError(null)
    } catch (err) {
      setError((err as { message?: string }).message ?? String(err))
    } finally {
      setLoading(false)
    }
  }, [me])

  useEffect(() => {
    void refresh()
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(onVisible, REFRESH_MS)
    // Realtime: nieuwe gebruikers en wijzigingen in andermans journal direct binnenhalen
    const channel = supabase
      .channel('social')
      // Nieuwe gebruikers en gewijzigde namen/foto's
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => void refresh())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'journals' }, (payload) => {
        if ((payload.new as { user_id?: string }).user_id !== me?.id) void refresh()
      })
      .subscribe()
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
      void supabase.removeChannel(channel)
    }
  }, [refresh, me])

  return useMemo(() => ({ friends, loading, error, refresh }), [friends, loading, error, refresh])
}

/** Hoe goed jullie smaak overeenkomt: 0–100 op basis van titels die jullie allebei een rating gaven. */
export function tasteMatch(mine: Entry[], theirs: Entry[]): { score: number | null; shared: number; bothRated: number } {
  const avg = (es: Entry[]) => {
    const map = new Map<string, number[]>()
    for (const e of es) if (e.rating) map.set(titleKey(e), [...(map.get(titleKey(e)) ?? []), e.rating])
    return new Map([...map].map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]))
  }
  const myKeys = new Set(mine.map(titleKey))
  const shared = new Set(theirs.map(titleKey).filter((k) => myKeys.has(k))).size
  const a = avg(mine)
  const b = avg(theirs)
  const both = [...a.keys()].filter((k) => b.has(k))
  if (both.length === 0) return { score: null, shared, bothRated: 0 }
  const diff = both.reduce((n, k) => n + Math.abs(a.get(k)! - b.get(k)!), 0) / both.length
  return { score: Math.round(100 - diff * 25), shared, bothRated: both.length }
}
