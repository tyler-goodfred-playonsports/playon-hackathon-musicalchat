// The scripted demo: a PR review that opens pastoral and descends into
// barely-suppressed workplace fury before resolving. Each message carries a
// mood vector (0..1 per axis) that drives the score.
// ponytail: scores are hardcoded per beat (the agreed fallback) — swap in a
// Vercel AI SDK generateObject call per message when live scoring lands.

export const CAST = {
  tyler:  { name: 'Tyler',  initials: 'TY', hue: 158 },
  aswani: { name: 'Aswani', initials: 'AS', hue: 222 },
  robb:   { name: 'Robb',   initials: 'RB', hue: 28 },
  ajay:   { name: 'Ajay',   initials: 'AJ', hue: 268 },
  noah:   { name: 'Noah',   initials: 'NO', hue: 320 },
  you:    { name: 'You',    initials: 'YO', hue: 200 },
}

// Movement titles per genre, indexed by the `movement` slot on each beat:
// 0 warm open · 1 uneasy question · 2 crescendo · 3 fury · 4 reconciliation · 5 coda
export const MOVEMENTS = {
  classical: ['I. Morning Mood (pastorale)', 'II. Un poco inquieto', 'II. Un poco inquieto (crescendo)', 'III. Adding Stakeholders (allegro furioso, ma cortese)', 'IV. Riconciliazione (tenderly)', 'V. Coda (all clear)'],
  edm:       ['I. Sunrise Set (opening groove)', 'II. The Filter Sweep (something’s off)', 'II. Building the Drop', 'III. The Drop (adding stakeholders, 128bpm)', 'IV. Afterglow (hands in the air)', 'V. Outro (lights up)'],
  country:   ['I. Front Porch Sunrise', 'II. Trouble on the Wind', 'II. Storm Clouds Gatherin’', 'III. High Noon Showdown (y’all been added)', 'IV. Mendin’ Fences', 'V. Ride Off Into the Sunset'],
  jazz:      ['I. Sunday Brunch (brushes, easy)', 'II. A Question Mark in Blue', 'II. Trading Fours (getting pointed)', 'III. The Hard Bop (stakeholders sit in)', 'IV. Ballad for Two PRs', 'V. Last Call (take the head out)'],
  cinematic: ['I. Establishing Shot (dawn)', 'II. Something in the Shadows', 'II. The Plot Thickens', 'III. The Confrontation (cc: everyone)', 'IV. Redemption Arc', 'V. End Credits'],
  lofi:      ['I. Coffee & Rain (side A)', 'II. Skipped Beat (hmm)', 'II. Tape Warble (uneasy)', 'III. Distorted Loop (added for visibility)', 'IV. Golden Hour (all good)', 'V. Sleep Track (loops forever)'],
  metal:     ['I. Clean Intro (the calm before)', 'II. Palm-Muted Doubts', 'II. Tuning Down (it builds)', 'III. BREAKDOWN (stakeholders have entered)', 'IV. The Power Ballad', 'V. Final Chord (feedback rings out)'],
  chiptune:  ['I. Overworld Theme', 'II. Cave Level (watch your step)', 'II. Miniboss Music', 'III. BOSS FIGHT (stakeholders appear!)', 'IV. Victory Fanfare', 'V. Credits Roll (press start)'],
  muzak:     ['I. Doors Open (floor 1)', 'II. Between Floors (slight delay)', 'II. Please Hold (your call matters)', 'III. Mezzanine of Menace (aggressively pleasant)', 'IV. Doors Opening (ground floor)', 'V. Have a Nice Day'],
  western:   ['I. Dawn on the Prairie', 'II. A Stranger Rides In', 'II. Tumbleweeds (eyes narrow)', 'III. High Noon (draw, partner)', 'IV. Peace Returns to Town', 'V. Into the Sunset'],
  bossa:     ['I. Manhã de Sol (easy now)', 'II. Uma Pergunta (a question)', 'II. Clouds Over Copacabana', 'III. Garota Furiosa (smiling, though)', 'IV. Reconciliação (one more drink)', 'V. Fim (até amanhã)'],
  synthwave: ['I. Sunset Drive (top down)', 'II. Neon Flicker (something’s wrong)', 'II. Night Chase Ignition', 'III. OUTRUN (stakeholders in pursuit)', 'IV. Dawn Over the Grid', 'V. Fade to VHS'],
  reggae:    ['I. Island Morning (irie)', 'II. Shadow ’Cross the Sun', 'II. Dub Pressure Rising', 'III. Heavy Steppers (babylon cc’d)', 'IV. One Love (resolution)', 'V. Sunset Session'],
}

// Each beat plays after one user send (beat 0 autoplays). The user's own
// messages are scored live by score.js; only scripted replies are authored.
export const BEATS = [
  {
    movement: 0,
    messages: [
      { who: 'tyler', text: 'morning team ☀️ just opened PR #4821 — the favorites-service refactor. 214 files, but I promise most of it is just moves 😄',
        mood: { warmth: 0.92, concern: 0.06, tension: 0.03, passiveAggression: 0 } },
      { who: 'aswani', text: 'ooh, been waiting for this one. grabbing a coffee and diving in ☕',
        mood: { warmth: 0.86, concern: 0.08, tension: 0.05, passiveAggression: 0 } },
      { who: 'robb', text: 'morning all 👋 skimming now — looks tidy so far',
        mood: { warmth: 0.82, concern: 0.1, tension: 0.05, passiveAggression: 0.02 } },
      { who: 'ajay', text: 'in! appreciate the heads-up, reading through 📖',
        mood: { warmth: 0.84, concern: 0.1, tension: 0.05, passiveAggression: 0 } },
      { who: 'noah', text: 'nice, following along 👀 excited to see this land',
        mood: { warmth: 0.85, concern: 0.08, tension: 0.05, passiveAggression: 0 } },
    ],
  },
  {
    movement: 1,
    messages: [
      { who: 'aswani', text: 'first pass: the naming is 💯 and the test coverage is genuinely lovely',
        mood: { warmth: 0.8, concern: 0.12, tension: 0.08, passiveAggression: 0.02 } },
      { who: 'aswani', text: 'one question though — why does the cache layer live inside the controller now?',
        mood: { warmth: 0.45, concern: 0.55, tension: 0.25, passiveAggression: 0.1 } },
    ],
  },
  {
    movement: 2,
    messages: [
      { who: 'tyler', text: 'it collapsed the DI graph a lot — threading it through three services felt worse tbh',
        mood: { warmth: 0.3, concern: 0.4, tension: 0.42, passiveAggression: 0.15 } },
      { who: 'aswani', text: 'hm. it also means every consumer takes a hard dependency on the controller now, right?',
        mood: { warmth: 0.18, concern: 0.6, tension: 0.58, passiveAggression: 0.35 } },
    ],
  },
  {
    movement: 3,
    messages: [
      { who: 'aswani', text: 'This is a significant architectural change. Adding Robb and Ajay for visibility.',
        mood: { warmth: 0.05, concern: 0.55, tension: 0.88, passiveAggression: 0.97 } },
      { who: 'robb', text: 'Following.',
        mood: { warmth: 0.05, concern: 0.4, tension: 0.9, passiveAggression: 0.85 } },
      { who: 'ajay', text: "+1. Let's make sure we're aligned on layering before this merges.",
        mood: { warmth: 0.08, concern: 0.5, tension: 0.82, passiveAggression: 0.88 } },
      { who: 'noah', text: 'adding myself too — want to understand the boundaries here.',
        mood: { warmth: 0.15, concern: 0.55, tension: 0.6, passiveAggression: 0.3 } },
    ],
  },
  {
    movement: 4,
    messages: [
      { who: 'tyler', text: '…totally fair, I should have flagged the design shift up front. want to pair after standup and split this into two PRs?',
        mood: { warmth: 0.6, concern: 0.4, tension: 0.25, passiveAggression: 0.05 } },
      { who: 'aswani', text: 'yes please 🙏 honestly the refactor itself is great — I just want the layering right. sorry if I came in hot 😅',
        mood: { warmth: 0.88, concern: 0.15, tension: 0.08, passiveAggression: 0.02 } },
      { who: 'robb', text: 'love to see it 💛',
        mood: { warmth: 0.95, concern: 0.05, tension: 0.02, passiveAggression: 0 } },
    ],
  },
]

// After the script ends, further sends cycle these.
export const CODA = [
  {
    movement: 5,
    messages: [
      { who: 'aswani', text: '🎻 (the orchestra takes a bow)',
        mood: { warmth: 0.9, concern: 0.05, tension: 0.03, passiveAggression: 0 } },
    ],
  },
  {
    movement: 5,
    messages: [
      { who: 'tyler', text: 'encore tomorrow — same thread, new PR 😄',
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
