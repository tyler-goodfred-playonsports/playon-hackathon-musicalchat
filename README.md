# 🎼 Undertones

**Every conversation has a subtext. Now it has a soundtrack.**

Plain text is where tone goes to die — "Following." can mean *following* or it can mean
*war*. Undertones scores each Slack message on four emotional axes (warmth, concern,
tension, passive aggression) and plays a live orchestral score that blends as the
conversation flows. A PR review that opens like Grieg's Morning Mood can end like
Shostakovich's Tenth, and now you can *hear* it coming.

## Run the demo

```bash
npm install
npm run dev   # http://localhost:5173
```

Click **▶ Begin the performance** (sound on), then type anything into the composer —
the scripted PR review advances one beat per send: pastoral open → uneasy question →
"Adding Stephanie and Mark for visibility." → reconciliation. The right rail shows the
current movement, a live EQ, and the four mood meters blending in real time.

## How it works

- [src/conversation.js](src/conversation.js) — the scripted beats, each message tagged
  with a hardcoded mood vector (the demo-day fallback).
- [src/music.js](src/music.js) — the score engine. Default backend is a procedural
  WebAudio synth (palettes per dominant mood, continuous ramps for brightness, tempo,
  tremolo, drone, timpani) so the demo works offline with zero assets. If
  `public/music/manifest.json` exists, it crossfades real ElevenLabs stems instead.
- [src/App.jsx](src/App.jsx) — Slack-style chat, typing indicators, flowy message
  animations, mood-tinted auras and background.

## Plugging in the real pipeline

**ElevenLabs music** — generate the four movement stems once, then the app
auto-switches from synth to crossfaded stems:

```bash
ELEVENLABS_API_KEY=... npm run stems
```

**Live scoring (Vercel AI SDK)** — replace the hardcoded `mood` in
`conversation.js` with a per-message call from an API route:

```js
import { generateObject } from 'ai'
import { z } from 'zod'

const { object: mood } = await generateObject({
  model: 'anthropic/claude-haiku-4-5',
  schema: z.object({
    warmth: z.number(), concern: z.number(),
    tension: z.number(), passiveAggression: z.number(),
  }),
  prompt: `Score this Slack message from 0 to 1 on each axis, reading between the lines: "${text}"`,
})
```
