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

// Serve POST /api/turn during `npm run dev` using the same handler Vercel runs in
// prod — so local dev needs no Vercel CLI or account.
const devApi = {
  name: 'dev-api-turn',
  configureServer(server) {
    server.middlewares.use('/api/turn', async (req, res, next) => {
      if (req.method !== 'POST') return next()
      const mod = await server.ssrLoadModule('/src/lib/scoreTone.js')
      if (!mod.hasApiKey()) {
        // No key configured — skip the call silently; client uses the heuristic.
        res.statusCode = 503
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'scoring disabled' }))
        return
      }
      try {
        const scored = await mod.scoreTone(await readJson(req))
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(scored))
      } catch (err) {
        server.config.logger.error(`[dev /api/turn] ${err?.message || err}`)
        res.statusCode = 500
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ error: 'scoring failed' }))
      }
    })
  },
}

export default defineConfig(({ mode }) => {
  // Load .env.local etc. and expose ANTHROPIC_API_KEY to the dev middleware.
  const env = loadEnv(mode, process.cwd(), '')
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY
  }
  return {
    plugins: [react(), devApi],
    server: { port: 5173, strictPort: true },
  }
})
