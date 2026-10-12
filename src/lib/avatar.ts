import { supabase, type Profile } from './supabase'

const SIZE = 256

/** Snijdt een foto vierkant bij (midden) en verkleint naar 256×256 JPEG; houdt uploads klein. */
async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto verwerken mislukt'))), 'image/jpeg', 0.86),
  )
}

/** Oude avatars van deze gebruiker weghalen (alles in de eigen map behalve `keep`). */
async function cleanup(userId: string, keep?: string) {
  const { data } = await supabase.storage.from('avatars').list(userId)
  const stale = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep)
  if (stale.length) await supabase.storage.from('avatars').remove(stale)
}

export async function uploadAvatar(me: Profile, file: File): Promise<Profile> {
  if (!file.type.startsWith('image/')) throw new Error('Kies een afbeelding.')
  const blob = await squareJpeg(file)
  // Nieuwe bestandsnaam per upload, zodat caches de oude foto niet blijven tonen
  const path = `${me.id}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(`Uploaden mislukt: ${error.message}`)
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  const updated = await updateProfile(me, { avatar_url: url })
  await cleanup(me.id, path).catch(() => {})
  return updated
}

export async function removeAvatar(me: Profile): Promise<Profile> {
  const updated = await updateProfile(me, { avatar_url: null })
  await cleanup(me.id).catch(() => {})
  return updated
}

export async function updateProfile(me: Profile, patch: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', me.id).select(PROFILE_FIELDS).single()
  if (error) throw new Error(error.message)
  return data as Profile
}

export const PROFILE_FIELDS = 'id, username, display_name, avatar_url'
