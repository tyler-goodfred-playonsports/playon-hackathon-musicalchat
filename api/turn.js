// Vercel serverless function: POST /api/turn -> { warmth, concern, tension, passiveAggression }.
// Anything under /api is auto-deployed as its own function; no routing config needed.
// Thin wrapper — the real work lives in the shared handler.

import { scoreTone, hasApiKey } from '../src/lib/scoreTone.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  if (!hasApiKey()) {
    // No key configured — skip the call so the client falls back to the heuristic.
    res.status(503).json({ error: 'scoring disabled' })
    return
  }
  try {
    const { text, mood } = req.body || {}
    const scored = await scoreTone({ text, mood })
    res.status(200).json(scored)
  } catch (err) {
    console.error('[api/turn] scoring failed:', err)
    res.status(500).json({ error: 'scoring failed' })
  }
}
