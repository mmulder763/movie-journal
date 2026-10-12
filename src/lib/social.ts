import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Entry, Journal } from '../types'
import { normalizeJournal } from './journal'
import { supabase, type Profile } from './supabase'
import { titleKey } from './titles'

export interface Friend extends Profile {
  journal: Journal
  updatedAt: string
}

interface FriendshipRow {
  requester: string
  addressee: string
  status: 'pending' | 'accepted'
  requester_profile: Profile
  addressee_profile: Profile
}

export interface SocialState {
  friends: Friend[]
  /** Verzoeken die op jouw goedkeuring wachten */
  incoming: Profile[]
  /** Verzoeken die jij stuurde */
  outgoing: Profile[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  sendRequest: (username: string) => Promise<void>
  accept: (profileId: string) => Promise<void>
  /** Verzoek weigeren/intrekken of vriendschap beëindigen */
  remove: (profileId: string) => Promise<void>
}

const REFRESH_MS = 60_000

/** Vrienden, verzoeken en de journals van vrienden (alleen-lezen). */
export function useSocial(me: Profile | null): SocialState {
  const [rows, setRows] = useState<FriendshipRow[]>([])
  const [journals, setJournals] = useState<Record<string, { journal: Journal; updatedAt: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!me) return
    try {
      const { data, error: e1 } = await supabase
        .from('friendships')
        .select(
          'requester, addressee, status, requester_profile:profiles!friendships_requester_fkey(id, username, display_name), addressee_profile:profiles!friendships_addressee_fkey(id, username, display_name)',
        )
      if (e1) throw e1
      const list = (data ?? []) as unknown as FriendshipRow[]
      setRows(list)

      const friendIds = list
        .filter((r) => r.status === 'accepted')
        .map((r) => (r.requester === me.id ? r.addressee : r.requester))
      if (friendIds.length) {
        const { data: js, error: e2 } = await supabase.from('journals').select('user_id, data, updated_at').in('user_id', friendIds)
        if (e2) throw e2
        const next: Record<string, { journal: Journal; updatedAt: string }> = {}
        for (const j of js ?? []) {
          try {
            next[j.user_id] = { journal: normalizeJournal(j.data), updatedAt: j.updated_at }
          } catch (err) {
            console.warn('Journal van vriend onleesbaar', err)
          }
        }
        setJournals(next)
      } else {
        setJournals({})
      }
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
    // Realtime: nieuwe verzoeken en wijzigingen in journals van vrienden direct binnenhalen (RLS filtert wat je mag zien)
    const channel = supabase
      .channel('social')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => void refresh())
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

  const sendRequest = useCallback(
    async (username: string) => {
      if (!me) return
      const name = username.trim().replace(/^@/, '').toLowerCase()
      if (name === me.username) throw new Error('Dat ben je zelf 🙂')
      const { data: target, error: e1 } = await supabase.from('profiles').select('id, username, display_name').eq('username', name).maybeSingle()
      if (e1) throw new Error(e1.message)
      if (!target) throw new Error(`Geen gebruiker "@${name}" gevonden.`)
      const existing = rows.find((r) => [r.requester, r.addressee].includes(target.id))
      if (existing?.status === 'accepted') throw new Error(`Je bent al bevriend met ${target.display_name}.`)
      // Stuurde die persoon jou al een verzoek? Dan meteen accepteren
      if (existing && existing.requester === target.id) {
        const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', target.id).eq('addressee', me.id)
        if (error) throw new Error(error.message)
      } else if (!existing) {
        const { error } = await supabase.from('friendships').insert({ requester: me.id, addressee: target.id })
        if (error) throw new Error(error.message)
      }
      await refresh()
    },
    [me, rows, refresh],
  )

  const accept = useCallback(
    async (profileId: string) => {
      if (!me) return
      const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('requester', profileId).eq('addressee', me.id)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [me, refresh],
  )

  const remove = useCallback(
    async (profileId: string) => {
      if (!me) return
      const { error } = await supabase
        .from('friendships')
        .delete()
        .or(`and(requester.eq.${me.id},addressee.eq.${profileId}),and(requester.eq.${profileId},addressee.eq.${me.id})`)
      if (error) throw new Error(error.message)
      await refresh()
    },
    [me, refresh],
  )

  return useMemo(() => {
    const other = (r: FriendshipRow) => (r.requester === me?.id ? r.addressee_profile : r.requester_profile)
    const friends = rows
      .filter((r) => r.status === 'accepted')
      .map((r) => {
        const p = other(r)
        const j = journals[p.id]
        return { ...p, journal: j?.journal ?? { entries: [], skipped: [], watchlist: [] }, updatedAt: j?.updatedAt ?? '' }
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name, 'nl'))
    return {
      friends,
      incoming: rows.filter((r) => r.status === 'pending' && r.addressee === me?.id).map((r) => r.requester_profile),
      outgoing: rows.filter((r) => r.status === 'pending' && r.requester === me?.id).map((r) => r.addressee_profile),
      loading,
      error,
      refresh,
      sendRequest,
      accept,
      remove,
    }
  }, [rows, journals, me, loading, error, refresh, sendRequest, accept, remove])
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
