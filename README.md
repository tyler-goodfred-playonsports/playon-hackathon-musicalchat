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
- [src/score.js](src/score.js) — live heuristic tone scorer for *your* messages: "uh oh!"
  pulls the score toward concern, ALL CAPS spikes tension, a curt "Fine." reads as
  passive aggression. Offline and instant; swap its internals for the AI call below.
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

**Live scoring (Claude)** — your own messages are scored live by
`claude-haiku-4-5`, reading between the lines. It's wired up already:

- [src/lib/scoreTone.js](src/lib/scoreTone.js) — the shared handler. Calls Claude
  via the official `@anthropic-ai/sdk` with a structured-outputs schema (the four
  axes as 0–1 floats). Server-only — the API key never reaches the browser.
- [api/turn.js](api/turn.js) — Vercel serverless wrapper (`POST /api/turn`).
- [vite.config.js](vite.config.js) — a dev middleware that serves the same
  handler, so `npm run dev` alone runs live scoring — no Vercel CLI needed.
- [src/score.js](src/score.js) — `scoreMessageAI()` calls the route with a 1.5s
  timeout and **falls back to the offline heuristic** on any failure, so the demo
  never blocks or breaks if the network/key is absent.

Add your key to `.env.local` (`ANTHROPIC_API_KEY=...`) and restart the dev server.
Deploy: set the same variable in the Vercel project — the function ships with the
static site automatically.
