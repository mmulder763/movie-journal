import { createClient } from '@supabase/supabase-js'

// Project-URL en anon key zijn publiek (bedoeld voor in de browser); toegang regelt Row Level Security
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'movie-journal:auth' },
})

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}
