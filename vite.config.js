import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Read the request body as JSON (Vite/connect doesn't parse it for us).
function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', c => (data += c))
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}) } catch (e) { reject(e) } })
    req.on('error', reject)
  })
}

// Serve a POST /api/* route in dev using the same server module Vercel runs in
// prod — so local dev needs no Vercel CLI. `modulePath` exports `fn` + hasApiKey.
function apiRoute(route, modulePath, fn) {
  return {
    name: `dev-api-${fn}`,
    configureServer(server) {
      server.middlewares.use(route, async (req, res, next) => {
        if (req.method !== 'POST') return next()
        const send = (code, body) => {
          res.statusCode = code
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }
        try {
          const mod = await server.ssrLoadModule(modulePath)
          if (!mod.hasApiKey()) return send(503, { error: 'disabled' }) // no key — client falls back
          send(200, await mod[fn](await readJson(req)))
        } catch (err) {
          server.config.logger.error(`[dev ${route}] ${err?.message || err}`)
          send(500, { error: 'failed' })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load .env.local etc. and expose ANTHROPIC_API_KEY to the dev middleware.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  }
  return {
    plugins: [
      react(),
      apiRoute('/api/turn', '/src/lib/scoreTone.js', 'scoreTone'),
      apiRoute('/api/reply', '/src/lib/replyChat.js', 'generateReply'),
    ],
    server: { port: 5173, strictPort: true },
  }
})
