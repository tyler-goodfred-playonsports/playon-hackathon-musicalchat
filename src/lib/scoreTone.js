// Live AI tone scorer — the real backend for src/score.js's heuristic.
// Server-only: imports the Anthropic SDK and reads ANTHROPIC_API_KEY, so it must
// never be bundled into the client. Called by both api/turn.js (Vercel) and the
// Vite dev middleware in vite.config.js, so the scoring logic lives here once.

import Anthropic from '@anthropic-ai/sdk'

const AXES = ['warmth', 'concern', 'tension', 'passiveAggression']
const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0))

// Structured-outputs schema: force exactly the four axes as numbers.
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    warmth: { type: 'number' },
    concern: { type: 'number' },
    tension: { type: 'number' },
    passiveAggression: { type: 'number' },
  },
  required: AXES,
}

const SYSTEM =
  'You score a single Slack message on four emotional-subtext axes, reading between the lines. ' +
  'Each is a float from 0 to 1: warmth (friendliness, praise, gratitude), concern (worry, ' +
  'uncertainty, hesitation), tension (urgency, anger, conflict), and passiveAggression (veiled ' +
  'hostility, curtness, faux-politeness like "per my last message" or a lone "Fine."). ' +
  'Weigh punctuation, capitalization, and emoji. A 🙂 or 🙃 often reads as passive-aggressive. ' +
  'Return only the four scores.'

let client // lazy so a missing key doesn't crash at import time

// True only when a key is configured. Wrappers check this to skip the call
// entirely (fail fast, no noise) so a keyless demo runs on the heuristic alone.
export const hasApiKey = () => Boolean(process.env.ANTHROPIC_API_KEY)

// Score one message. `mood` is the room's current mood, passed for continuity.
export async function scoreTone({ text, mood }) {
  if (!text || typeof text !== 'string') throw new Error('text required')
  client ||= new Anthropic() // reads ANTHROPIC_API_KEY from the environment

  const res = await client.messages.create({
    model: 'claude-haiku-4-5', // fast + cheap — scoring runs on every message
    max_tokens: 256,
    system: SYSTEM,
    messages: [
      {
        role: 'user',
        content:
          `Room mood right now (context, not a target): ${JSON.stringify(mood ?? {})}\n` +
          `Score this message:\n"""${text}"""`,
      },
    ],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  })

  const block = res.content.find(b => b.type === 'text')
  const raw = JSON.parse(block.text)
  const out = {}
  for (const a of AXES) out[a] = clamp01(raw[a])
  return out
}
