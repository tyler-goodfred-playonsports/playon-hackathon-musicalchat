// Generates looping ElevenLabs music stems per genre × movement into public/music/<genre>/.
// Usage: ELEVENLABS_API_KEY=... npm run stems            (all genres)
//        ELEVENLABS_API_KEY=... npm run stems classical edm   (specific genres)
// Skips files that already exist and keeps going on API errors, so it can be
// re-run to fill in whatever a previous run (or exhausted credits) left behind.
// The app auto-detects the manifests and crossfades stems instead of the synth.

import { mkdir, writeFile, readdir, stat } from 'node:fs/promises'

const KEY = process.env.ELEVENLABS_API_KEY
if (!KEY) { console.error('Set ELEVENLABS_API_KEY first.'); process.exit(1) }

const LOOP = 'seamless ambient loop, instrumental, no vocals'

// Fixed mood vectors per movement — identical across genres so the app's
// nearest-mood crossfade works the same regardless of genre.
const MOVEMENTS = [
  { file: 'i-pastorale.mp3',        mood: { warmth: 0.9,  concern: 0.08, tension: 0.04, passiveAggression: 0 } },
  { file: 'ii-inquieto.mp3',        mood: { warmth: 0.45, concern: 0.55, tension: 0.25, passiveAggression: 0.1 } },
  { file: 'iii-furioso.mp3',        mood: { warmth: 0.05, concern: 0.5,  tension: 0.9,  passiveAggression: 0.95 } },
  { file: 'iv-riconciliazione.mp3', mood: { warmth: 0.85, concern: 0.15, tension: 0.08, passiveAggression: 0 } },
]

// One prompt per movement per genre: warm open → uneasy question → suppressed fury → reconciliation.
const GENRES = {
  classical: [
    `Gentle pastoral orchestral idyll: solo flute melody over warm strings and soft harp, major key, lilting 6/8, sunrise-over-the-meadow optimism, ${LOOP}`,
    `Uneasy hesitant chamber strings: soft minor-key string quartet with sparse pizzicato, a polite question hanging in the air, gentle creeping unease, muted dynamics, ${LOOP}`,
    `Brooding romantic-era symphonic fury: low cello ostinato, menacing timpani, semitone dissonance, cold politeness over barely contained rage, crescendos that never resolve, ${LOOP}`,
    `Tender orchestral reconciliation: strings swelling from hesitant to hopeful, warm major-key homecoming, gentle woodwinds, relief and kindness, ${LOOP}`,
  ],
  edm: [
    `Warm melodic house at 120bpm: sunny plucked synth chords, soft sidechained pads, light shaker groove, golden-hour optimism, ${LOOP}`,
    `Hesitant deep house breakdown: filtered minor-key pads, sparse echoing synth stabs, a question hanging over a muted kick, creeping unease, ${LOOP}`,
    `Dark driving techno at 128bpm: distorted rumbling bass stabs, relentless kick, dissonant acid line, cold mechanical menace, tension that never drops, ${LOOP}`,
    `Euphoric progressive house resolution: warm supersaw chords blooming open, gentle uplifting arpeggios, relief and release, ${LOOP}`,
  ],
  country: [
    `Warm front-porch Americana: fingerpicked acoustic guitar, lazy dobro slides, soft brushed drums, major key, sunny morning contentment, ${LOOP}`,
    `Lonesome uneasy country: sparse pedal steel bending minor notes, hesitant acoustic strums, wide empty space, a worried question on the wind, ${LOOP}`,
    `Outlaw country menace: low baritone guitar tremolo, tense sparse snare, dark minor twang, storm brewing on the horizon, gritted-teeth standoff, ${LOOP}`,
    `Tender country reconciliation: warm pedal steel swells, gentle major-key acoustic picking, campfire glow, forgiveness and homecoming, ${LOOP}`,
  ],
  jazz: [
    `Warm bossa-tinged jazz trio: brushed drums, soft upright bass, mellow piano comping in a major key, easy Sunday-morning contentment, ${LOOP}`,
    `Hesitant cool jazz: sparse muted trumpet phrases over minor-key piano voicings, brushed cymbals, unresolved chords, a polite doubt lingering, ${LOOP}`,
    `Tense hard bop: stabbing horn hits, aggressive walking bass, dissonant piano clusters, simmering barely-contained anger, ${LOOP}`,
    `Tender late-night jazz ballad: warm saxophone melody over lush major-seventh piano chords, soft brushes, relief and reconciliation, ${LOOP}`,
  ],
  cinematic: [
    `Warm cinematic opening: soft piano motif over swelling strings and gentle French horn, major key, hopeful sunrise-over-the-city feeling, ${LOOP}`,
    `Uneasy cinematic underscore: sustained minor strings, sparse piano notes, subtle ticking percussion, something is not quite right, ${LOOP}`,
    `Dark cinematic tension in the style of a modern thriller score: pulsing low braams, driving ostinato strings, pounding percussion, relentless suppressed fury, ${LOOP}`,
    `Warm cinematic resolution: strings and piano blooming from hesitant to soaring, gentle brass, catharsis and forgiveness, ${LOOP}`,
  ],
  lofi: [
    `Cozy lo-fi hip hop: dusty warm Rhodes chords, soft boom-bap beat, vinyl crackle, mellow major key, rainy-day-with-coffee contentment, ${LOOP}`,
    `Wistful uneasy lo-fi: detuned minor-key keys, sparse hesitant beat, tape wobble, melancholy question mark hanging in the air, ${LOOP}`,
    `Gritty tense lo-fi: distorted boom-bap drums, dark bass line, dissonant chopped samples, brooding late-night menace, ${LOOP}`,
    `Mellow lo-fi resolution: warm major-key keys drifting over a gentle beat, soft vinyl hiss, exhale of relief, ${LOOP}`,
  ],
  metal: [
    `Warm clean-tone rock intro: chiming clean electric guitar arpeggios, soft cymbal swells, major key, calm before anything goes wrong, ${LOOP}`,
    `Brooding metal build: palm-muted low guitar chugs, sparse toms, minor key, ominous restraint, a storm gathering, ${LOOP}`,
    `Furious heavy metal: crushing distorted riffs, double-kick drums, dissonant tritone leads, full unleashed rage, ${LOOP}`,
    `Power-ballad resolution: soaring clean guitar melody over warm distorted chords, major key, triumphant relief and reconciliation, ${LOOP}`,
  ],
  chiptune: [
    `Cheerful 8-bit overworld theme: bouncy square-wave melody, upbeat arpeggios, major key, sunny retro video game adventure, ${LOOP}`,
    `Uneasy 8-bit cave level: minor-key square-wave melody, sparse echoing bleeps, slow tempo, cautious exploration in the dark, ${LOOP}`,
    `Intense 8-bit boss battle: fast aggressive chiptune riffs, pounding noise-channel drums, dissonant minor key, maximum danger, ${LOOP}`,
    `Triumphant 8-bit victory theme settling into a warm ending: bright major-key square-wave fanfare easing into a gentle celebratory melody, ${LOOP}`,
  ],
  muzak: [
    `Pleasant elevator muzak: smooth soprano sax over soft electric piano and light bossa rhythm, relentlessly agreeable major key, department-store serenity, ${LOOP}`,
    `Slightly-off elevator muzak: smooth jazz instrumentation drifting into hesitant minor chords, polite unease beneath the pleasantness, ${LOOP}`,
    `Aggressively pleasant smooth jazz: saccharine soprano sax and chirpy electric piano played with icy passive-aggressive perfection over a subtly menacing bass line, ${LOOP}`,
    `Soothing elevator muzak resolution: gentle major-key smooth jazz, soft strings, everything is fine now, ${LOOP}`,
  ],
  western: [
    `Warm spaghetti western opening: campfire acoustic guitar, gentle whistling melody, soft strings, wide-open prairie at dawn, ${LOOP}`,
    `Suspicious spaghetti western: lone harmonica bending uneasy minor notes, sparse twangy guitar, tumbleweed tension, someone rides into town, ${LOOP}`,
    `Spaghetti western standoff: twangy electric guitar stabs, taut snare rolls, dissonant trumpet cries, high-noon fury held at gunpoint, ${LOOP}`,
    `Spaghetti western resolution: warm strings and gentle guitar riding into the sunset, major key, peace returns to town, ${LOOP}`,
  ],
  bossa: [
    `Warm bossa nova lounge: soft nylon-string guitar, gentle shaker, mellow piano, sunny major key, cocktails on a Rio balcony, ${LOOP}`,
    `Uneasy bossa nova: minor-key nylon guitar voicings, hesitant sparse percussion, a suave smile hiding a doubt, ${LOOP}`,
    `Tense gritted-teeth bossa nova: clipped nylon-string stabs, insistent percussion, dark chromatic piano lines, fury delivered with impeccable politeness, ${LOOP}`,
    `Tender bossa nova resolution: warm major-key guitar and soft flute, gentle sway, all is forgiven over one more drink, ${LOOP}`,
  ],
  synthwave: [
    `Warm synthwave sunset drive: lush analog pads, gated snare, gentle arpeggiated bass, nostalgic major key, neon horizon glow, ${LOOP}`,
    `Uneasy synthwave: minor-key analog pads, sparse echoing synth notes, slow pulse, neon-lit streets after midnight, something feels wrong, ${LOOP}`,
    `Dark outrun chase: driving synthwave at high intensity, pounding drum machine, aggressive detuned bass arpeggio, dissonant stabs, pursuit and fury, ${LOOP}`,
    `Warm synthwave outro: soft analog pads blooming into a hopeful major-key melody, gentle arpeggios, dawn breaking over the city, ${LOOP}`,
  ],
  reggae: [
    `Warm sunny reggae: laid-back skank guitar, round bass line, gentle organ bubble, major key, island-morning ease, ${LOOP}`,
    `Spacey uneasy dub: minor-key skank drenched in echo, sparse melodica phrases, cavernous reverb, a shadow crossing the sun, ${LOOP}`,
    `Heavy tense stepper dub: relentless steppers drum pattern, dark rumbling bass, dissonant siren-like synth echoes, militant simmering anger, ${LOOP}`,
    `Warm reggae reconciliation: gentle major-key skank, soft organ and melodica, sunshine returning, one love resolution, ${LOOP}`,
  ],
}

const wanted = process.argv.slice(2)
const genres = wanted.length ? wanted : Object.keys(GENRES)
for (const g of genres) if (!GENRES[g]) { console.error(`Unknown genre "${g}". Known: ${Object.keys(GENRES).join(', ')}`); process.exit(1) }

const exists = p => stat(p).then(s => s.size > 0, () => false)

let ok = 0, skipped = 0, failed = 0

async function compose(genre, i) {
  const { file } = MOVEMENTS[i]
  const path = `public/music/${genre}/${file}`
  if (await exists(path)) { skipped++; console.log(`  ✓ ${genre}/${file} (already exists)`); return }
  console.log(`  composing ${genre}/${file}…`)
  const res = await fetch('https://api.elevenlabs.io/v1/music', {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: GENRES[genre][i], music_length_ms: 45000, force_instrumental: true }),
  })
  if (!res.ok) { failed++; console.error(`  ✗ ${genre}/${file}: ${res.status} ${await res.text()}`); return }
  await writeFile(path, Buffer.from(await res.arrayBuffer()))
  ok++
  console.log(`  ✓ ${genre}/${file}`)
}

for (const genre of genres) {
  console.log(`\n== ${genre} ==`)
  await mkdir(`public/music/${genre}`, { recursive: true })
  // sequential within a genre to stay under free-tier concurrency limits
  for (let i = 0; i < MOVEMENTS.length; i++) await compose(genre, i)
  const present = []
  for (const m of MOVEMENTS) {
    if (await exists(`public/music/${genre}/${m.file}`)) present.push({ file: `/music/${genre}/${m.file}`, mood: m.mood })
  }
  if (present.length === MOVEMENTS.length) {
    await writeFile(`public/music/${genre}/manifest.json`, JSON.stringify(present, null, 2))
  } else {
    console.warn(`  (skipping manifest for ${genre} — only ${present.length}/${MOVEMENTS.length} stems present)`)
  }
}

// Top-level index of genres that have a complete manifest, for the app's genre picker.
const available = []
for (const g of Object.keys(GENRES)) {
  if (await exists(`public/music/${g}/manifest.json`)) available.push(g)
}
await writeFile('public/music/genres.json', JSON.stringify(available, null, 2))

console.log(`\ndone — ${ok} generated, ${skipped} skipped, ${failed} failed.`)
console.log(`genres ready: ${available.join(', ') || '(none)'}`)
if (failed) console.log('re-run the same command to retry the failures.')
