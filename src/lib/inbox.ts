import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { MediaType, WatchItem } from '../types'
import { supabase, type Profile } from './supabase'

export interface Reaction {
  id: string
  owner_id: string
  entry_id: string
  from_id: string
  emoji: string | null
  message: string | null
  created_at: string
}

export interface Recommendation {
  id: string
  from_id: string
  to_id: string
  tmdb_id: number
  media_type: MediaType
  title: string
  poster_path: string | null
  backdrop_path: string | null
  year: string | null
  note: string | null
  dismissed: boolean
  created_at: string
}

export type Notification =
  | { kind: 'reaction'; at: string; reaction: Reaction }
  | { kind: 'recommendation'; at: string; recommendation: Recommendation }


const SEEN_KEY = 'movie-journal:inbox-seen:v1'

export const recToItem = (r: Recommendation): WatchItem => ({
  tmdbId: r.tmdb_id, mediaType: r.media_type, title: r.title, posterPath: r.poster_path,
  backdropPath: r.backdrop_path, year: r.year ?? undefined, addedAt: 0,
})

/** Reacties en aanbevelingen, live bijgewerkt. */
export function useInbox(me: Profile | null) {
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [seenAt, setSeenAt] = useState(() => {
    try {
      return localStorage.getItem(SEEN_KEY) ?? ''
    } catch {
      return ''
    }
  })

  const refresh = useCallback(async () => {
    if (!me) return
    const [r1, r2] = await Promise.all([
      supabase.from('reactions').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('recommendations').select('*').order('created_at', { ascending: false }).limit(300),
    ])
    if (!r1.error) setReactions(r1.data as Reaction[])
    if (!r2.error) setRecommendations(r2.data as Recommendation[])
  }, [me])

  useEffect(() => {
    if (!me) return
    void refresh()
    const channel = supabase
      .channel('inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recommendations' }, () => void refresh())
      .subscribe()
    const onVisible = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      void supabase.removeChannel(channel)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [me, refresh])

  const react = useCallback(
    async (ownerId: string, entryId: string, reaction: { emoji?: string; message?: string }) => {
      if (!me) return
      // Zelfde emoji nogmaals = weghalen
      const existing = reactions.find((r) => r.owner_id === ownerId && r.entry_id === entryId && r.from_id === me.id && reaction.emoji && r.emoji === reaction.emoji)
      if (existing) {
        setReactions((rs) => rs.filter((r) => r.id !== existing.id))
        await supabase.from('reactions').delete().eq('id', existing.id)
      } else {
        const row = { owner_id: ownerId, entry_id: entryId, from_id: me.id, emoji: reaction.emoji ?? null, message: reaction.message ?? null }
        setReactions((rs) => [{ ...row, id: `tmp-${Date.now()}`, created_at: new Date().toISOString() }, ...rs])
        const { error } = await supabase.from('reactions').insert(row)
        if (error) throw new Error(error.message)
      }
      void refresh()
    },
    [me, reactions, refresh],
  )

  const removeReaction = useCallback(async (id: string) => {
    setReactions((rs) => rs.filter((r) => r.id !== id))
    await supabase.from('reactions').delete().eq('id', id)
  }, [])

  const recommend = useCallback(
    async (toIds: string[], item: WatchItem, note?: string) => {
      if (!me || toIds.length === 0) return
      const rows = toIds.map((to_id) => ({
        from_id: me.id, to_id, tmdb_id: item.tmdbId, media_type: item.mediaType, title: item.title,
        poster_path: item.posterPath, backdrop_path: item.backdropPath ?? null, year: item.year ?? null, note: note || null,
      }))
      const { error } = await supabase.from('recommendations').insert(rows)
      if (error) throw new Error(error.message)
      void refresh()
    },
    [me, refresh],
  )

  const dismiss = useCallback(
    async (id: string) => {
      setRecommendations((rs) => rs.map((r) => (r.id === id ? { ...r, dismissed: true } : r)))
      await supabase.from('recommendations').update({ dismissed: true }).eq('id', id)
    },
    [],
  )

  const notifications = useMemo<Notification[]>(() => {
    if (!me) return []
    const items: Notification[] = [
      ...reactions.filter((r) => r.owner_id === me.id && r.from_id !== me.id).map((reaction) => ({ kind: 'reaction' as const, at: reaction.created_at, reaction })),
      ...recommendations.filter((r) => r.to_id === me.id).map((recommendation) => ({ kind: 'recommendation' as const, at: recommendation.created_at, recommendation })),
    ]
    return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60)
  }, [me, reactions, recommendations])

  const unread = notifications.filter((n) => n.at > seenAt).length
  const markSeen = useCallback(() => {
    const now = new Date().toISOString()
    setSeenAt(now)
    try {
      localStorage.setItem(SEEN_KEY, now)
    } catch { /* privémodus */ }
  }, [])

  /** Reacties per kijkmoment: "ownerId:entryId" → reacties */
  const byEntry = useMemo(() => {
    const map = new Map<string, Reaction[]>()
    for (const r of reactions) map.set(`${r.owner_id}:${r.entry_id}`, [...(map.get(`${r.owner_id}:${r.entry_id}`) ?? []), r])
    return map
  }, [reactions])

  const received = useMemo(() => recommendations.filter((r) => r.to_id === me?.id && !r.dismissed), [recommendations, me])

  return { reactions, byEntry, received, notifications, unread, seenAt, markSeen, react, removeReaction, recommend, dismiss, refresh }
}

export type Inbox = ReturnType<typeof useInbox>

/** Zodat detailschermen overal "Aanraden" en reacties kunnen tonen zonder props door te geven */
export interface SocialContextValue {
  me: Profile | null
  people: Map<string, Profile>
  inbox: Inbox
  openRecommend: (item: WatchItem) => void
}
export const SocialContext = createContext<SocialContextValue | null>(null)
export const useSocialContext = () => useContext(SocialContext)
