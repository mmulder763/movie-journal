// Stuurt een pushmelding bij een nieuwe reactie of aanbeveling.
// Wordt aangeroepen door een database-trigger (zie supabase/schema.sql), niet door de app.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

type Row = Record<string, unknown>

// Reacties worden als sleutel opgeslagen; in meldingen tonen we een woord (geen emoji)
const REACTION_LABEL: Record<string, string> = { '🔥': 'Vuur', '😍': 'Liefde', '😂': 'Lachen', '😱': 'Schrik', '😴': 'Saai', '👀': 'Benieuwd' }

async function firstName(id: string) {
  const { data } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle()
  return (data?.display_name as string | undefined)?.split(' ')[0] ?? 'Iemand'
}

async function entryTitle(ownerId: string, entryId: string) {
  const { data } = await supabase.from('journals').select('data').eq('user_id', ownerId).maybeSingle()
  const entries = ((data?.data as { entries?: { id: string; title: string }[] })?.entries ?? [])
  return entries.find((e) => e.id === entryId)?.title ?? 'je kijkmoment'
}

/** Wie krijgt de melding, en wat staat erin */
async function compose(table: string, r: Row): Promise<{ to: string; title: string; body: string; tag: string } | null> {
  if (table === 'reactions') {
    if (r.owner_id === r.from_id) return null
    const [who, title] = await Promise.all([firstName(r.from_id as string), entryTitle(r.owner_id as string, r.entry_id as string)])
    return {
      to: r.owner_id as string,
      title: r.emoji ? `${who} reageerde: ${REACTION_LABEL[r.emoji as string] ?? 'reactie'}` : `${who} schreef iets`,
      body: r.message ? `${title}: “${r.message}”` : `op ${title}`,
      tag: `reaction-${r.entry_id}`,
    }
  }
  if (table === 'recommendations') {
    const who = await firstName(r.from_id as string)
    return {
      to: r.to_id as string,
      title: `${who} raadt je iets aan`,
      body: r.note ? `${r.title}: “${r.note}”` : (r.title as string),
      tag: `rec-${r.id}`,
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.headers.get('x-push-secret') !== Deno.env.get('PUSH_SECRET')) return new Response('forbidden', { status: 403 })
  const { table, record } = (await req.json()) as { table: string; record: Row }
  const msg = await compose(table, record)
  if (!msg) return new Response('skip')

  const { data: subs } = await supabase.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', msg.to)
  const payload = JSON.stringify({ title: msg.title, body: msg.body, tag: msg.tag, url: './' })
  let sent = 0
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
      sent++
    } catch (err) {
      // Verlopen of ingetrokken abonnement: opruimen
      const status = (err as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
      else console.error('push mislukt', status, err)
    }
  }))
  return Response.json({ sent })
})
