// Live tone scorer for the user's own messages — heuristic, offline, instant.
// ponytail: lexicon + punctuation rules; swap the internals for the Vercel AI
// SDK generateObject call in the README when live AI scoring lands.

const clamp01 = v => Math.min(1, Math.max(0, v))
const NEUTRAL = { warmth: 0.4, concern: 0.2, tension: 0.12, passiveAggression: 0.05 }

const RULES = [
  [/\b(uh[ -]?oh|oops|yikes|hmm+|hm+|wait|worried|concerned?|not sure|confused|weird|odd|issue|problem|bug|broken)\b/i,
    { concern: 0.5, tension: 0.15, warmth: -0.2 }],
  [/\b(thanks|thank you|ty|awesome|great|nice|love|lovely|perfect|amazing|excited|happy|glad|appreciate|woo+|yay)\b/i,
    { warmth: 0.5, concern: -0.1, tension: -0.15 }],
  [/\b(urgent|asap|seriously|immediately|right now|blocked|blocker|outage|failing|prod is down|escalat\w+|unacceptable|wtf)\b/i,
    { tension: 0.55, warmth: -0.25 }],
  [/\b(per my last (email|message)|as (i|we) (said|mentioned|discussed)|friendly reminder|just to clarify|to be clear|for visibility|going forward|with (all )?due respect|as previously (stated|mentioned)|interesting choice|noted|thanks in advance)\b/i,
    { passiveAggression: 0.6, warmth: -0.2 }],
]
const WARM_EMOJI = ['😄', '😊', '🥰', '🎉', '❤️', '💛', '🙏', '✨', '☀️', '😁', '🤗', '👍']
const TENSE_EMOJI = ['😬', '😱', '🚨', '😡', '🔥', '💀', '😤', '🫠']
const PA_EMOJI = ['🙂', '🙃'] // the passive-aggressive smileys

export function scoreMessage(text, base = NEUTRAL) {
  const d = { warmth: 0, concern: 0, tension: 0, passiveAggression: 0 }
  const bump = deltas => { for (const k in deltas) d[k] += deltas[k] }

  for (const [re, deltas] of RULES) if (re.test(text)) bump(deltas)
  bump({ warmth: 0.15 * WARM_EMOJI.filter(e => text.includes(e)).length })
  bump({ tension: 0.2 * TENSE_EMOJI.filter(e => text.includes(e)).length })
  bump({ passiveAggression: 0.4 * PA_EMOJI.filter(e => text.includes(e)).length })

  const bangs = (text.match(/!/g) || []).length
  if (bangs) bump(d.warmth > 0 ? { warmth: Math.min(bangs * 0.12, 0.3) } : { tension: Math.min(bangs * 0.15, 0.4) })
  bump({ concern: Math.min((text.match(/\?/g) || []).length * 0.18, 0.35) })
  if (/(\.\.\.|…)/.test(text)) bump({ concern: 0.2, passiveAggression: 0.1 })
  bump({ tension: Math.min((text.match(/\b[A-Z]{3,}\b/g) || []).length * 0.25, 0.5) })
  if (/^[A-Za-z ]{1,12}\.$/.test(text.trim())) bump({ passiveAggression: 0.55, warmth: -0.2 }) // curt "Fine."

  // low-signal messages mostly keep the room's current vibe
  const confidence = Object.values(d).reduce((s, v) => s + Math.abs(v), 0)
  const w = Math.min(0.3 + 0.6 * confidence, 0.9)
  const mood = {}
  for (const k in NEUTRAL) mood[k] = clamp01(base[k] + w * (clamp01(NEUTRAL[k] + d[k]) - base[k]))
  return mood
}

// Live AI scoring via /api/turn (Claude reads between the lines). Returns the
// scored mood, or null on any failure/timeout — the caller keeps the instant
// heuristic so the demo never blocks or breaks when the network/key is absent.
export async function scoreMessageAI(text, base = NEUTRAL) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch('/api/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, mood: base }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const mood = await res.json()
    if (NEUTRAL && Object.keys(NEUTRAL).some(k => typeof mood[k] !== 'number')) return null
    return mood
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Live chatbot reply via /api/reply — returns { who, text, mood } or null on any
// failure/timeout, so the caller falls back to the scripted conversation.
export async function generateReply(messages) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 7000)
  try {
    const res = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: ctrl.signal,
    })
    if (!res.ok) return null
    const reply = await res.json()
    if (!reply || !reply.who || typeof reply.text !== 'string' || !reply.mood) return null
    return reply
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// dev sanity: the marquee tones score the way the demo promises
const top = m => Object.keys(m).reduce((a, b) => (m[b] > m[a] ? b : a))
console.assert(top(scoreMessage('uh oh!')) === 'concern', 'uh oh should read as concern')
console.assert(top(scoreMessage('thanks, this is awesome!! 🎉')) === 'warmth', 'praise should read as warmth')
console.assert(top(scoreMessage('WHY IS PROD DOWN')) === 'tension', 'caps + prod down should read as tension')
console.assert(scoreMessage('Fine.').passiveAggression > 0.4, 'curt period should read as passive aggression')
