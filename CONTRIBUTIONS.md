# Contributions — `feat/reactive-visualizer`

A map of what this branch added versus what the base repo (and teammates on
`main`) already provide. Everything here sits on top of a fully client-side app —
see [README.md](README.md) for the overall design.

## What this branch added (our work)

### 1. Audio-reactive visualizer (`95aaf29`)
Canvas + `requestAnimationFrame` visuals driven by the WebAudio analyser, tinted
by the dominant mood.
- **Orb** — a rotating ring of radial frequency bars around a pulsing core, in
  the score rail (`drawOrb`).
- **Backdrop waveform ring** — a morphing blob behind the chat that breathes with
  the bass (`drawViz`).
- **Floating motes** — ambient particles that speed up with tension (`drawParticles`).
- **Message ripples** — an expanding ring in the message's mood color each time a
  message lands (`emitPulse` / `drawRipples`).
- Files: `src/App.jsx`, `src/index.css`.

### 2. Orb-visibility fix (`54bcf34`)
- **Resume the AudioContext** on start and on tab re-focus — it was staying
  suspended, starving the analyser so the orb collapsed to an invisible dot
  (`src/music.js`).
- **Draw every frame** with a zero-fallback spectrum plus an idle breathing pulse
  and a minimum ring, so the visuals never look dead even in silence (`src/App.jsx`).

### 3. Live AI tone scoring (`54bcf34`)
Optional upgrade to the heuristic scorer — Claude reads the subtext of *your*
messages.
- **Shared handler** — `src/lib/scoreTone.js`: calls `claude-haiku-4-5` via the
  official `@anthropic-ai/sdk` with a structured-outputs schema (the four axes as
  0–1 floats). Server-only; the key never reaches the browser.
- **Vercel function** — `api/turn.js`: `POST /api/turn`.
- **Vite dev middleware** — `vite.config.js`: serves the same handler so
  `npm run dev` alone runs live scoring, no Vercel CLI needed.
- **Resilient fallback** — `src/score.js` `scoreMessageAI()` calls the route with a
  1.5s timeout and falls back to the offline heuristic on any failure; the call is
  skipped entirely (fast, silent) when no `ANTHROPIC_API_KEY` is set.
- Config/docs: `.env.example`, `README.md`, `package.json`.

### 4. Live dynamic chatbot (optional)
The reviewers can reply **live and in-character** via Claude instead of following
the fixed screenplay.
- **Shared handler** — `src/lib/replyChat.js`: given the thread so far, Claude picks
  which reviewer (Alex / Sam / Stephanie / Mark) speaks next, writes their message
  in-voice, and scores its mood — all in one structured-output call.
- **Vercel function** — `api/reply.js`: `POST /api/reply`.
- **Vite dev middleware** — the config now serves both `/api/turn` and `/api/reply`.
- **Graceful default** — `src/score.js` `generateReply()` calls the route with a 7s
  timeout; on any failure — and whenever no `ANTHROPIC_API_KEY` is set — `App.jsx`
  falls back to the **scripted `conversation.js` beats**, so a keyless demo behaves
  exactly as before. The scripted opener always plays to set the scene.

## What the base repo already handled

- **Slack-style chat UI** — messages, typing indicators, float-in animations,
  mood-tinted auras and blurred background layers (`src/App.jsx`, `src/index.css`).
- **Procedural WebAudio synth** — generates the score in-browser with a palette per
  dominant mood (chords, arps, drone, timpani, feedback delay); works offline with
  zero assets (`src/music.js`).
- **ElevenLabs stems backend** — crossfades real audio stems toward the current
  mood when a manifest is present (`src/music.js`).
- **Heuristic tone scorer** — instant, offline regex/lexicon scoring of your
  messages: "uh oh" → concern, ALL CAPS → tension, a curt "Fine." → passive
  aggression (`src/score.js`).
- **Scripted conversation** — the beat-by-beat PR review, each message tagged with
  a mood vector (`src/conversation.js`).
- **Live score rail** — movement label, EQ bars, and the four mood meters
  (`src/App.jsx`).

## What teammates added on `main` (merged into this branch)

- **Color theme** (`ab0711e`) — the green/yellow mood palette.
- **13-genre ElevenLabs stems + live genre switching** (`ad36125`) — per-genre
  stem sets and a genre dropdown that crossfades between them (`src/music.js`,
  `public/music/`).
