// The scripted demo: a PR review that opens pastoral and descends into
// barely-suppressed workplace fury before resolving. Each message carries a
// mood vector (0..1 per axis) that drives the score.
// ponytail: scores are hardcoded per beat (the agreed fallback) — swap in a
// Vercel AI SDK generateObject call per message when live scoring lands.

export const CAST = {
  alex:  { name: 'Alex Rivera',   initials: 'AR', hue: 158 },
  sam:   { name: 'Sam Chen',      initials: 'SC', hue: 222 },
  steph: { name: 'Stephanie Wu',  initials: 'SW', hue: 28 },
  mark:  { name: 'Mark Okafor',   initials: 'MO', hue: 268 },
  you:   { name: 'You',           initials: 'YO', hue: 200 },
}

// Each beat plays after one user send (beat 0 autoplays). `user` is the mood
// stamped on the user's own message that triggers the beat.
export const BEATS = [
  {
    movement: 'I. Morning Mood (pastorale)',
    messages: [
      { who: 'alex', text: 'morning team ☀️ just opened PR #4821 — the favorites-service refactor. 214 files, but I promise most of it is just moves 😄',
        mood: { warmth: 0.92, concern: 0.06, tension: 0.03, passiveAggression: 0 } },
      { who: 'sam', text: 'ooh, been waiting for this one. grabbing a coffee and diving in ☕',
        mood: { warmth: 0.86, concern: 0.08, tension: 0.05, passiveAggression: 0 } },
    ],
  },
  {
    movement: 'II. Un poco inquieto',
    user: { warmth: 0.6, concern: 0.15, tension: 0.1, passiveAggression: 0.05 },
    messages: [
      { who: 'sam', text: 'first pass: the naming is 💯 and the test coverage is genuinely lovely',
        mood: { warmth: 0.8, concern: 0.12, tension: 0.08, passiveAggression: 0.02 } },
      { who: 'sam', text: 'one question though — why does the cache layer live inside the controller now?',
        mood: { warmth: 0.45, concern: 0.55, tension: 0.25, passiveAggression: 0.1 } },
    ],
  },
  {
    movement: 'II. Un poco inquieto (crescendo)',
    user: { warmth: 0.4, concern: 0.35, tension: 0.3, passiveAggression: 0.1 },
    messages: [
      { who: 'alex', text: 'it collapsed the DI graph a lot — threading it through three services felt worse tbh',
        mood: { warmth: 0.3, concern: 0.4, tension: 0.42, passiveAggression: 0.15 } },
      { who: 'sam', text: 'hm. it also means every consumer takes a hard dependency on the controller now, right?',
        mood: { warmth: 0.18, concern: 0.6, tension: 0.58, passiveAggression: 0.35 } },
    ],
  },
  {
    movement: 'III. Adding Stakeholders (allegro furioso, ma cortese)',
    user: { warmth: 0.2, concern: 0.5, tension: 0.55, passiveAggression: 0.25 },
    messages: [
      { who: 'sam', text: 'This is a significant architectural change. Adding Stephanie and Mark for visibility.',
        mood: { warmth: 0.05, concern: 0.55, tension: 0.88, passiveAggression: 0.97 } },
      { who: 'steph', text: 'Following.',
        mood: { warmth: 0.05, concern: 0.4, tension: 0.9, passiveAggression: 0.85 } },
      { who: 'mark', text: "+1. Let's make sure we're aligned on layering before this merges.",
        mood: { warmth: 0.08, concern: 0.5, tension: 0.82, passiveAggression: 0.88 } },
    ],
  },
  {
    movement: 'IV. Riconciliazione (tenderly)',
    user: { warmth: 0.45, concern: 0.4, tension: 0.3, passiveAggression: 0.1 },
    messages: [
      { who: 'alex', text: '…totally fair, I should have flagged the design shift up front. want to pair after standup and split this into two PRs?',
        mood: { warmth: 0.6, concern: 0.4, tension: 0.25, passiveAggression: 0.05 } },
      { who: 'sam', text: 'yes please 🙏 honestly the refactor itself is great — I just want the layering right. sorry if I came in hot 😅',
        mood: { warmth: 0.88, concern: 0.15, tension: 0.08, passiveAggression: 0.02 } },
      { who: 'steph', text: 'love to see it 💛',
        mood: { warmth: 0.95, concern: 0.05, tension: 0.02, passiveAggression: 0 } },
    ],
  },
]

// After the script ends, further sends cycle these.
export const CODA = [
  {
    movement: 'V. Coda (all clear)',
    user: { warmth: 0.7, concern: 0.1, tension: 0.05, passiveAggression: 0 },
    messages: [
      { who: 'sam', text: '🎻 (the orchestra takes a bow)',
        mood: { warmth: 0.9, concern: 0.05, tension: 0.03, passiveAggression: 0 } },
    ],
  },
  {
    movement: 'V. Coda (all clear)',
    user: { warmth: 0.7, concern: 0.1, tension: 0.05, passiveAggression: 0 },
    messages: [
      { who: 'alex', text: 'encore tomorrow — same thread, new PR 😄',
        mood: { warmth: 0.9, concern: 0.05, tension: 0.03, passiveAggression: 0 } },
    ],
  },
]

// Fake typing time before a scripted reply lands.
export const delayFor = text => 650 + Math.min(text.length * 16, 1700)

// dev sanity check: every mood axis stays in 0..1
for (const b of [...BEATS, ...CODA])
  for (const m of b.messages)
    for (const [k, v] of Object.entries(m.mood))
      console.assert(v >= 0 && v <= 1, `bad mood ${k} in "${m.text}"`)
