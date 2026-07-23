// Vercel serverless function: POST /api/reply -> { who, text, mood }.
// Generates the next reviewer message via Claude. 503 when no key is set, so the
// client falls back to the scripted conversation.

import { generateReply, hasApiKey } from '../src/lib/replyChat.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' })
    return
  }
  if (!hasApiKey()) {
    res.status(503).json({ error: 'chat disabled' })
    return
  }
  try {
    const { messages } = req.body || {}
    const reply = await generateReply({ messages })
    res.status(200).json(reply)
  } catch (err) {
    console.error('[api/reply] generation failed:', err)
    res.status(500).json({ error: 'reply failed' })
  }
}
