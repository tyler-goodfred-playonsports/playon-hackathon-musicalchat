// Live chatbot backend: given the conversation so far, Claude writes the next
// reviewer's message (in character) plus its emotional-subtext mood. Optional —
// when no key is set the frontend falls back to the scripted conversation.js.
// Server-only; reuses the key check from scoreTone.

import Anthropic from '@anthropic-ai/sdk'
import { hasApiKey } from './scoreTone.js'

export { hasApiKey }

// Keep in sync with CAST in src/conversation.js. 'you' is the human — the bot
// never speaks as them, so they're excluded from the reply roster.
const NAMES = { tyler: 'Tyler', aswani: 'Aswani', robb: 'Robb', ajay: 'Ajay', noah: 'Noah', you: 'You' }
const REVIEWERS = ['tyler', 'aswani', 'robb', 'ajay', 'noah']

const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0))

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    who: { type: 'string', enum: REVIEWERS },
    text: { type: 'string' },
    warmth: { type: 'number' },
    concern: { type: 'number' },
    tension: { type: 'number' },
    passiveAggression: { type: 'number' },
  },
  required: ['who', 'text', 'warmth', 'concern', 'tension', 'passiveAggression'],
}

const SYSTEM =
  'You are simulating a Slack code-review thread on PR #4821, a "favorites-service" refactor ' +
  '(214 files). Continue the thread by writing the NEXT single message from ONE reviewer reacting ' +
  'to the latest messages — especially the human ("You"). Stay in character. Keep it short and ' +
  'Slack-like: 1–2 sentences, casual, an occasional emoji. Then score the message\'s emotional ' +
  'subtext on four 0–1 axes (warmth, concern, tension, passiveAggression).\n\n' +
  'The reviewers:\n' +
  '- tyler: the PR author. Earnest and collaborative; a little defensive when the design is questioned.\n' +
  '- aswani: lead reviewer. Warm at first, raises sharp technical concerns, can turn pointed or passive-aggressive under stress.\n' +
  '- robb: senior stakeholder. Terse, cool, quietly passive-aggressive (think a one-word "Following.").\n' +
  '- ajay: stakeholder. Diplomatic but firm, process- and alignment-focused.\n' +
  '- noah: engaged teammate. Curious, asks clarifying questions, keeps things constructive.\n\n' +
  'Pick whoever would most naturally speak next. Never write as "You" (the human).'

let client

// Generate the next reviewer message. `messages` is [{ who, text }, ...] oldest-first.
export async function generateReply({ messages }) {
  client ||= new Anthropic() // reads ANTHROPIC_API_KEY
  const transcript = (messages || [])
    .slice(-14)
    .map(m => `${NAMES[m.who] || m.who}: ${m.text}`)
    .join('\n')

  const res = await client.messages.create({
    model: 'claude-haiku-4-5', // fast — this gates the reply appearing
    max_tokens: 400,
    system: SYSTEM,
    messages: [
      { role: 'user', content: `Thread so far:\n${transcript}\n\nWrite the next reviewer message and score it.` },
    ],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
  })

  const block = res.content.find(b => b.type === 'text')
  const raw = JSON.parse(block.text)
  const who = REVIEWERS.includes(raw.who) ? raw.who : 'aswani'
  return {
    who,
    text: String(raw.text || '').slice(0, 500),
    mood: {
      warmth: clamp01(raw.warmth),
      concern: clamp01(raw.concern),
      tension: clamp01(raw.tension),
      passiveAggression: clamp01(raw.passiveAggression),
    },
  }
}
