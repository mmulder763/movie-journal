import fs from 'node:fs/promises'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer, PreviewServer } from 'vite'
import type { Journal, Op } from '../src/types.ts'
import { applyOp, emptyJournal, normalizeJournal } from '../src/lib/journal.ts'

/**
 * Mini-API op de Vite dev/preview-server die het journal opslaat in data/journal.json.
 * Zo lopen alle apparaten op je netwerk gelijk, en kun je het bestand ook met de hand bewerken.
 *
 *   GET  /api/journal  → Journal
 *   POST /api/ops      → Op[] toepassen, geeft het nieuwe Journal terug
 */
export function journalApi(file = 'data/journal.json'): Plugin {
  file = path.resolve(file)
  // Alle schrijfacties achter elkaar, zodat gelijktijdige requests elkaar niet overschrijven
  let queue: Promise<unknown> = Promise.resolve()
  const serialize = <T>(fn: () => Promise<T>) => {
    const next = queue.then(fn, fn)
    queue = next.catch(() => {})
    return next
  }

  async function read(): Promise<Journal> {
    try {
      return normalizeJournal(JSON.parse(await fs.readFile(file, 'utf8')))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return emptyJournal()
      throw err
    }
  }

  async function write(journal: Journal) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    await fs.writeFile(tmp, JSON.stringify(journal, null, 2) + '\n')
    await fs.rename(tmp, file)
  }

  async function readBody(req: IncomingMessage): Promise<unknown> {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  }

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(body))
  }

  function mount(server: ViteDevServer | PreviewServer) {
    server.middlewares.use(async (req, res, next) => {
      try {
        if (req.url === '/api/journal' && req.method === 'GET') {
          return send(res, 200, await read())
        }
        if (req.url === '/api/ops' && req.method === 'POST') {
          const ops = (await readBody(req)) as Op[]
          if (!Array.isArray(ops)) return send(res, 400, { error: 'Verwacht een array van ops' })
          const journal = await serialize(async () => {
            const next = ops.reduce(applyOp, await read())
            await write(next)
            return next
          })
          return send(res, 200, journal)
        }
        next()
      } catch (err) {
        send(res, 500, { error: (err as Error).message })
      }
    })
  }

  return {
    name: 'journal-api',
    configureServer(server) {
      mount(server)
      // Ook handmatige wijzigingen aan het bestand live naar alle open apparaten sturen
      server.watcher.add(file)
      const notify = (changed: string) => {
        if (path.resolve(changed) === file) server.ws.send({ type: 'custom', event: 'journal:changed' })
      }
      // Een atomische rename kan als 'add' of als 'change' binnenkomen
      server.watcher.on('change', notify)
      server.watcher.on('add', notify)
    },
    configurePreviewServer: mount,
  }
}
