// Undertones score engine.
// Default backend is a procedural WebAudio synth — zero assets, works offline,
// blends continuously between moods. If ElevenLabs stems exist
// (public/music/manifest.json via `npm run stems`), it crossfades those instead.

export const AXES = ['warmth', 'concern', 'tension', 'passiveAggression']

const RAMP = 3.2 // seconds to glide from one mood to the next
const TICK = 0.05

const hz = m => 440 * 2 ** ((m - 69) / 12)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// One palette per dominant axis: a chord progression (midi) + arp note pool.
const PALETTES = {
  warmth: { // D-major pastoral, Grieg-adjacent
    chords: [[50, 57, 62, 66, 69], [50, 55, 62, 67, 71], [45, 57, 61, 64, 69], [50, 57, 62, 66, 74]],
    pool: [74, 76, 78, 81, 83, 86],
  },
  concern: { // A-minor, hesitant
    chords: [[45, 52, 60, 64, 71], [41, 48, 57, 60, 64], [50, 57, 60, 65, 69], [52, 56, 62, 64, 67]],
    pool: [69, 72, 74, 76, 79, 81],
  },
  tension: { // low C-minor with semitone rubs, Shostakovich-adjacent
    chords: [[36, 43, 48, 51, 55], [36, 44, 48, 51, 56], [36, 43, 47, 50, 53], [36, 43, 48, 49, 55]],
    pool: [55, 58, 60, 62, 63, 67, 68],
  },
  passiveAggression: { // dark harmony, saccharine music-box top
    chords: [[36, 43, 55, 62, 63], [36, 44, 51, 58, 59], [36, 43, 48, 51, 55], [36, 43, 47, 50, 53]],
    pool: [84, 86, 87, 89, 91, 94],
  },
}

let ctx, master, analyser
let padFilter, tremBase, tremDepth, tremLfo, arpBus, droneGain, delaySend
let voices = []
let stems = null // [{gain, mood}] when ElevenLabs stems are present
let cur = { warmth: 0.85, concern: 0.1, tension: 0.05, passiveAggression: 0 }
let target = { ...cur }
let nextNote = 0, nextChord = 0, walker = 3, dir = 1, chordStep = 0

const dominant = () => AXES.reduce((best, a) => (cur[a] > cur[best] ? a : best), 'warmth')
const noteDur = () => 30 / (62 + cur.warmth * 38 - cur.concern * 10 + cur.passiveAggression * 18)

export async function start() {
  if (ctx) return
  ctx = new (window.AudioContext || window.webkitAudioContext)()
  master = ctx.createGain()
  master.gain.value = 0.9
  const comp = ctx.createDynamicsCompressor()
  analyser = ctx.createAnalyser()
  analyser.fftSize = 64
  master.connect(comp)
  comp.connect(analyser)
  analyser.connect(ctx.destination)

  stems = await loadStems().catch(() => null)
  if (!stems) buildSynth()

  nextNote = nextChord = ctx.currentTime + 0.1
  setInterval(tick, TICK * 1000)
  window.UNDERTONES = { getMood, mode: () => (stems ? 'stems' : 'synth'), state: () => ctx.state } // demo debug handle
}

export function setMood(mood) { target = { ...target, ...mood } }
export const getMood = () => ({ ...cur })
export const getAnalyser = () => analyser

// ---- ElevenLabs stems backend -------------------------------------------

async function loadStems() {
  const res = await fetch('/music/manifest.json')
  if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return null
  const list = await res.json()
  return Promise.all(list.map(async s => {
    const buf = await (await fetch(s.file)).arrayBuffer()
    const src = ctx.createBufferSource()
    src.buffer = await ctx.decodeAudioData(buf)
    src.loop = true
    const gain = ctx.createGain()
    gain.gain.value = 0
    src.connect(gain)
    gain.connect(master)
    src.start()
    return { gain, mood: s.mood }
  }))
}

// ponytail: nearest-mood crossfade over the stem set — plenty for 4 loops.
function applyStems(now) {
  const ws = stems.map(s => Math.exp(-3 * AXES.reduce((d, a) => d + (cur[a] - s.mood[a]) ** 2, 0)))
  const sum = ws.reduce((a, b) => a + b, 0) || 1
  stems.forEach((s, i) => s.gain.gain.setTargetAtTime(0.9 * ws[i] / sum, now, 0.8))
}

// ---- Procedural synth backend --------------------------------------------

function buildSynth() {
  // fake hall: filtered feedback delay
  const delay = ctx.createDelay(1)
  delay.delayTime.value = 0.31
  const fb = ctx.createGain()
  fb.gain.value = 0.34
  const damp = ctx.createBiquadFilter()
  damp.frequency.value = 2400
  delay.connect(damp); damp.connect(fb); fb.connect(delay)
  delaySend = ctx.createGain()
  delaySend.gain.value = 0.22
  delaySend.connect(delay)
  delay.connect(master)

  // pad bus: lowpass (brightness) -> tremolo (unease) -> out
  padFilter = ctx.createBiquadFilter()
  padFilter.type = 'lowpass'
  padFilter.frequency.value = 2600
  padFilter.Q.value = 0.6
  tremBase = ctx.createGain()
  tremBase.gain.value = 0.85
  tremLfo = ctx.createOscillator()
  tremLfo.frequency.value = 0.2
  tremDepth = ctx.createGain()
  tremDepth.gain.value = 0.12
  tremLfo.connect(tremDepth); tremDepth.connect(tremBase.gain); tremLfo.start()
  padFilter.connect(tremBase)
  tremBase.connect(master)
  tremBase.connect(delaySend)

  arpBus = ctx.createGain()
  arpBus.gain.value = 0.16
  arpBus.connect(master)
  arpBus.connect(delaySend)

  // low menace drone, gain driven by tension
  droneGain = ctx.createGain()
  droneGain.gain.value = 0
  const df = ctx.createBiquadFilter()
  df.type = 'lowpass'
  df.frequency.value = 220
  for (const m of [36, 43]) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = hz(m)
    o.detune.value = Math.random() * 10 - 5
    const wob = ctx.createOscillator()
    wob.frequency.value = 0.13
    const wg = ctx.createGain()
    wg.gain.value = 6
    wob.connect(wg); wg.connect(o.detune); wob.start()
    o.connect(df)
    o.start()
  }
  df.connect(droneGain)
  droneGain.connect(master)
}

function tick() {
  const now = ctx.currentTime
  const k = 1 - Math.exp(-TICK / (RAMP / 3)) // ~95% of the way in RAMP seconds
  for (const a of AXES) cur[a] += (target[a] - cur[a]) * k

  if (stems) return applyStems(now)

  const { warmth: w, concern: c, tension: t, passiveAggression: p } = cur
  padFilter.frequency.setTargetAtTime(clamp(500 + w * 2600 - t * 260, 320, 3400), now, 0.3)
  droneGain.gain.setTargetAtTime(t * 0.32 + p * 0.12, now, 0.5)
  tremDepth.gain.setTargetAtTime(0.1 + t * 0.38, now, 0.5)
  tremLfo.frequency.setTargetAtTime(0.18 + t * 5.5, now, 0.5)
  delaySend.gain.setTargetAtTime(0.16 + w * 0.12, now, 0.5)

  while (nextNote < now + 0.15) { scheduleArp(nextNote); nextNote += noteDur() }
  if (nextChord < now + 0.2) { playChord(nextChord); nextChord += 5 - w * 1.9 }
}

function scheduleArp(t) {
  const { concern: c, tension: tn, passiveAggression: p } = cur
  if (Math.random() < clamp(c * 0.35 + tn * 0.2 - p * 0.25, 0, 0.5)) return // rests read as hesitation
  const pool = PALETTES[dominant()].pool
  walker += Math.random() < 0.72 ? dir : -dir
  if (walker <= 0 || walker >= pool.length - 1) dir *= -1
  walker = clamp(walker, 0, pool.length - 1)
  blip(pool[walker], t, 0.5)
  if (p > 0.55 && Math.random() < 0.5) blip(pool[walker], t + noteDur() * 0.5, 0.25) // prim mechanical echo
}

function blip(midi, t, vel) {
  const o = ctx.createOscillator()
  o.type = cur.passiveAggression > 0.5 ? 'triangle' : 'sine' // music box vs flute
  o.frequency.value = hz(midi)
  const g = ctx.createGain()
  const attack = cur.passiveAggression > 0.5 ? 0.004 : clamp(0.05 - cur.tension * 0.03, 0.005, 0.05)
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(vel, t + attack)
  g.gain.setTargetAtTime(0, t + attack, noteDur() * 0.6)
  o.connect(g)
  g.connect(arpBus)
  o.start(t)
  o.stop(t + noteDur() * 4)
}

function playChord(t) {
  const prog = PALETTES[dominant()].chords
  chordStep = (chordStep + 1) % prog.length
  for (const v of voices) {
    v.g.gain.setTargetAtTime(0, t, 0.5)
    v.oscs.forEach(o => o.stop(t + 3))
  }
  voices = prog[chordStep].map(m => {
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.setTargetAtTime(0.045, t, 0.9)
    const oscs = [-6, 6].map(det => {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = hz(m)
      o.detune.value = det
      o.connect(g)
      o.start(t)
      return o
    })
    g.connect(padFilter)
    return { g, oscs }
  })
  if (cur.tension > 0.55) {
    thump(t, 0.35 + cur.tension * 0.25)
    if (cur.tension > 0.78) { thump(t + 0.13, 0.2); thump(t + 0.27, 0.45) } // timpani roll
  }
}

function thump(t, vel) {
  const o = ctx.createOscillator()
  o.frequency.setValueAtTime(105, t)
  o.frequency.exponentialRampToValueAtTime(52, t + 0.35)
  const g = ctx.createGain()
  g.gain.setValueAtTime(vel, t)
  g.gain.setTargetAtTime(0.0001, t, 0.18)
  o.connect(g)
  g.connect(master)
  o.start(t)
  o.stop(t + 1.2)
}
