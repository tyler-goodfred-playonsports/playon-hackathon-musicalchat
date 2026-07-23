# 🎼 Undertones — Demo Script

Read the **Say** lines out loud; do the **Do** actions as you go. ~3 minutes.

---

## Open

**Say:** "Every Slack message has a subtext. 'Following.' can mean *following* —
or it can mean *war*. Undertones listens to the tone of a conversation and scores
it live as an orchestra. You don't just read the room… you *hear* it."

**Do:** Open the app → click **▶ Begin the performance** (sound on).

---

## 1. The room comes alive

**Do:** Let the opening messages play.

**Say:** "This is a live PR review. On the right is *The Score* — four emotional
axes (warmth, concern, tension, passive-aggression), a live orb visualizer, and
mood meters. Right now it's warm and pastoral. Watch what happens as the tone
shifts."

---

## 2. You steer the music

**Do:** Type something warm — `this looks amazing, great work! 🎉` — Send.

**Say:** "Warmth spikes, the orb glows warm, the music stays bright."

**Do:** Now type something tense — `WHY is the cache in the controller` — Send.

**Say:** "Tension jumps, the orb turns red, the score darkens — in real time.
Every message is scored and blended into the soundtrack instantly."

**Do:** Type a passive-aggressive one — `fine. 🙂` — Send.

**Say:** "And it catches the *subtext* — a curt 'fine' with a smiley reads as
passive-aggression, and the music gets that quiet, uneasy edge."

---

## 3. Pick your orchestra

**Do:** Change the **genre** dropdown (e.g. Classical → Synthwave or Lo-fi).

**Say:** "Thirteen genres of real generated stems — same emotional score, totally
different vibe. Classical, EDM, lo-fi, metal, even elevator music."

---

## 4. The reviewers reply — live

**Do:** Open the app with **`?mock`** on the URL (or with an API key set), Begin,
and send a few messages.

**Say:** "With AI turned on, the reviewers actually *respond to you* — in
character. Alex defends the design, Sam pushes back, Stephanie goes cold. Each
reply is written and tone-scored by Claude, and it drives the music too. It's a
living room, not a script."

---

## Close

**Say:** "So: a chat that you can *hear the mood of*, a soundtrack that reacts to
every word, and reviewers that talk back. That's Undertones."

---

## If someone asks (backup one-liners)

- **"Does it need a server / API key?"** — No. The whole thing runs in the
  browser: the music is synthesized live, the tone scoring is offline. AI scoring
  and live replies are an *optional* upgrade — add a key and they turn on
  automatically. No key = it gracefully falls back, never breaks.
- **"Is the music real?"** — Both. A procedural WebAudio synth by default, or real
  ElevenLabs stems per genre when present.
- **"What's `?mock`?"** — A demo switch that previews the live AI features with no
  key, so we can show the experience anywhere.
