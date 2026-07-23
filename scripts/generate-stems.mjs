// Generates one looping ElevenLabs music stem per movement into public/music/.
// Usage: ELEVENLABS_API_KEY=... npm run stems
// The app auto-detects the manifest and crossfades stems instead of the synth.

import { mkdir, writeFile } from 'node:fs/promises'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1) }

const MOVEMENTS = [
  {
    file: 'i-pastorale.mp3',
    mood: { warmth: 0.9, concern: 0.08, tension: 0.04, passiveAggression: 0 },
    prompt: 'Gentle pastoral orchestral idyll in the spirit of Grieg\'s Morning Mood: solo flute melody over warm strings and soft harp, major key, lilting 6/8, sunrise optimism, seamless ambient loop, instrumental, no vocals',
  },
  {
    file: 'ii-inquieto.mp3',
    mood: { warmth: 0.45, concern: 0.55, tension: 0.25, passiveAggression: 0.1 },
    prompt: 'Uneasy hesitant chamber strings: soft minor-key string quartet with sparse pizzicato, a polite question hanging in the air, gentle creeping unease, muted dynamics, seamless loop, instrumental, no vocals',
  },
  {
    file: 'iii-furioso.mp3',
    mood: { warmth: 0.05, concern: 0.5, tension: 0.9, passiveAggression: 0.95 },
    prompt: 'Brooding suppressed fury in the spirit of Shostakovich\'s Tenth Symphony: low cello ostinato, menacing timpani, semitone dissonance, cold politeness over barely contained rage, crescendos that never resolve, seamless loop, instrumental, no vocals',
  },
  {
    file: 'iv-riconciliazione.mp3',
    mood: { warmth: 0.85, concern: 0.15, tension: 0.08, passiveAggression: 0 },
    prompt: 'Tender orchestral reconciliation: strings swelling from hesitant to hopeful, warm major-key homecoming, gentle woodwinds, relief and kindness, seamless loop, instrumental, no vocals',
  },
]

await mkdir('public/music', { recursive: true })

for (const m of MOVEMENTS) {
  console.log(`composing ${m.file}…`)
  const res = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: m.prompt, music_length_ms: 45000, force_instrumental: true }),
  })
  if (!res.ok) { console.error(`${m.file}: ${res.status} ${await res.text()}`); process.exit(1) }
  await writeFile(`public/music/${m.file}`, Buffer.from(await res.arrayBuffer()))
}

await writeFile(
  'public/music/manifest.json',
  JSON.stringify(MOVEMENTS.map(({ file, mood }) => ({ file: `/music/${file}`, mood })), null, 2),
)
console.log('done — restart the dev server and the app will crossfade real stems.')
