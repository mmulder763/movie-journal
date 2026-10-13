import { supabase, type Profile } from './supabase'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true

function base64ToBytes(base64: string) {
  const b64 = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
}

export async function pushState(): Promise<PushState> {
  // Op iOS kan push alleen in de app op het beginscherm
  if (isIOS() && !isStandalone()) return 'needs-install'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    if (!reg) return import.meta.env.DEV ? 'unsupported' : 'off'
    const sub = await reg.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch {
    return 'unsupported'
  }
}

/** Service worker van de app, met een tijdslimiet zodat het aanmelden niet eindeloos blijft hangen */
async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration()
  if (existing?.active) return existing
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('De app is nog niet volledig geladen. Sluit hem helemaal af, open hem opnieuw en probeer het nog eens.')), 8000)),
  ])
}

/** Toestemming vragen (moet vanuit een tik) en dit apparaat aanmelden */
export async function enablePush(me: Profile, vapidPublicKey: string) {
  // Eerst toestemming vragen, direct vanuit de tik (iOS vereist dat)
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Geen toestemming voor meldingen. Zet ze aan bij Instellingen › Meldingen › Movie Journal.')
  const reg = await readyRegistration()
  let sub: PushSubscription
  try {
    sub = (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(vapidPublicKey) }))
  } catch (err) {
    throw new Error(`Aanmelden bij de pushdienst mislukt: ${(err as Error).message}`)
  }
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } }
  const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: json.endpoint, user_id: me.id, p256dh: json.keys.p256dh, auth: json.keys.auth })
  if (error) throw new Error(`Opslaan mislukt: ${error.message}`)
}

/** Testmelding naar jezelf (alle apparaten waarop meldingen aan staan) */
export async function sendTestPush(): Promise<{ sent: number; devices: number }> {
  const { data, error } = await supabase.functions.invoke('send-push', { body: { test: true } })
  if (error) throw new Error(error.message)
  return data as { sent: number; devices: number }
}

/** Korte diagnose, voor als het niet werkt */
export async function pushDiagnose(): Promise<string> {
  const parts = [
    `iOS-app: ${isIOS() ? (isStandalone() ? 'ja' : 'nee (Safari)') : 'n.v.t.'}`,
    `toestemming: ${'Notification' in window ? Notification.permission : 'n.v.t.'}`,
  ]
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    parts.push(`service worker: ${reg?.active ? 'actief' : 'niet actief'}`)
    parts.push(`aangemeld: ${(await reg?.pushManager.getSubscription()) ? 'ja' : 'nee'}`)
  } catch {
    parts.push('service worker: niet beschikbaar')
  }
  return parts.join(' · ')
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
