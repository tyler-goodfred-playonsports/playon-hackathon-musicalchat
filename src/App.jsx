import { useEffect, useRef, useState } from 'react'
import * as music from './music'
import { CAST, BEATS, CODA, MOVEMENTS, delayFor } from './conversation'
import { scoreMessage, scoreMessageAI, generateReply } from './score'
import { drawSprite } from './sprites'

const AXIS_META = [
  ['warmth', 'Warmth', '145 75% 52%'],
  ['concern', 'Concern', '48 92% 58%'],
  ['tension', 'Tension', '352 90% 60%'],
  ['passiveAggression', 'Passive aggression', '272 85% 68%'],
]

const ZERO = new Uint8Array(32) // fallback spectrum so the visuals draw even before/without audio

const GENRE_META = {
  classical: ['🎻', 'Classical'], edm: ['🎛️', 'EDM'], country: ['🤠', 'Country'],
  jazz: ['🎷', 'Jazz'], cinematic: ['🎬', 'Cinematic'], lofi: ['☕', 'Lo-fi'],
  metal: ['🤘', 'Metal'], chiptune: ['👾', '8-bit'], muzak: ['🛗', 'Elevator Music'],
  western: ['🌵', 'Western'], bossa: ['🍹', 'Bossa Nova'], synthwave: ['🌆', 'Synthwave'],
  reggae: ['🌴', 'Reggae'],
}

function dominantAxis(mood) {
  let best = AXIS_META[0]
  for (const m of AXIS_META) if (mood[m[0]] > mood[best[0]]) best = m
  return best
}
function moodColor(mood, alpha = 1) {
  return `hsl(${dominantAxis(mood)[2]} / ${alpha})`
}

// audio-reactive ring: a morphing waveform driven by the analyser, tinted by mood
function drawViz(g, data, mood, w, h, rot) {
  const cx = w / 2, cy = h * 0.44, min = Math.min(w, h)
  const bass = (data[0] + data[1] + data[2]) / (3 * 255)
  const base = min * 0.17 * (1 + bass * 0.24) // whole ring breathes with the low end
  const amp = min * 0.2
  const hsl = dominantAxis(mood)[2]
  const N = 120
  const pts = []
  for (let i = 0; i < N; i++) {
    const t = i / N
    const v = data[Math.round((1 - Math.abs(2 * t - 1)) * 22)] / 255 // symmetric spectrum
    const r = base + v * amp
    const a = t * Math.PI * 2 + rot
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r])
  }

  // trace a smooth closed blob through the points
  g.beginPath()
  g.moveTo((pts[0][0] + pts[N - 1][0]) / 2, (pts[0][1] + pts[N - 1][1]) / 2)
  for (let i = 0; i < N; i++) {
    const p = pts[i], q = pts[(i + 1) % N]
    g.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
  }
  g.closePath()

  const fill = g.createRadialGradient(cx, cy, base * 0.2, cx, cy, base + amp)
  fill.addColorStop(0, `hsl(${hsl} / 0.32)`)
  fill.addColorStop(1, `hsl(${hsl} / 0)`)
  g.fillStyle = fill
  g.fill()

  g.lineWidth = 2 + bass * 3
  g.strokeStyle = `hsl(${hsl} / 0.85)`
  g.shadowColor = `hsl(${hsl} / 0.9)`
  g.shadowBlur = 24 + bass * 40
  g.stroke()
  g.shadowBlur = 0
}

// the centerpiece: a radial-bar orb with a pulsing core, fully visible in the score rail
function drawOrb(g, data, mood, w, h, rot, flash) {
  g.clearRect(0, 0, w, h)
  const cx = w / 2, cy = h / 2, min = Math.min(w, h)
  const bass = (data[0] + data[1] + data[2]) / (3 * 255)
  const hsl = dominantAxis(mood)[2]
  const breathe = 0.06 * (0.5 + 0.5 * Math.sin(rot * 4)) // gentle idle pulse when silent
  const coreR = min * 0.15 * (1 + bass * 0.3 + flash * 0.35 + breathe)

  // soft halo
  const halo = g.createRadialGradient(cx, cy, coreR * 0.3, cx, cy, coreR * 2.6)
  halo.addColorStop(0, `hsl(${hsl} / ${(0.55 + flash * 0.4).toFixed(3)})`)
  halo.addColorStop(0.5, `hsl(${hsl} / 0.22)`)
  halo.addColorStop(1, `hsl(${hsl} / 0)`)
  g.fillStyle = halo
  g.beginPath(); g.arc(cx, cy, coreR * 2.6, 0, Math.PI * 2); g.fill()

  // radial frequency bars around the core
  const N = 60
  g.lineCap = 'round'
  for (let i = 0; i < N; i++) {
    const t = i / N
    const v = Math.max(0.12, data[Math.round((1 - Math.abs(2 * t - 1)) * 22)] / 255) // ring always visible
    const a = t * Math.PI * 2 + rot
    const r0 = coreR * 1.12
    const r1 = r0 + v * min * 0.26 + 4
    g.beginPath()
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
    g.lineWidth = 2.5 + v * 3.5
    g.strokeStyle = `hsl(${hsl} / ${(0.4 + v * 0.55).toFixed(3)})`
    g.shadowColor = `hsl(${hsl} / 0.85)`
    g.shadowBlur = 12
    g.stroke()
  }
  g.shadowBlur = 0

  // bright solid core
  g.beginPath(); g.arc(cx, cy, coreR * 0.62, 0, Math.PI * 2)
  g.fillStyle = `hsl(${hsl} / ${(0.55 + bass * 0.35 + flash * 0.3).toFixed(3)})`
  g.fill()
}

// ambient motes that drift upward — tinted by mood, hurried by tension + bass
function drawParticles(g, parts, hsl, w, h, speed) {
  for (const p of parts) {
    p.x += p.vx * speed
    p.y += p.vy * speed
    if (p.y < -12) { p.y = h + 12; p.x = Math.random() * w }
    if (p.x < -12) p.x = w + 12
    else if (p.x > w + 12) p.x = -12
    const rad = 1.6 + p.z * 3.2
    g.beginPath()
    g.arc(p.x, p.y, rad, 0, Math.PI * 2)
    g.fillStyle = `hsl(${hsl} / ${(0.16 + p.z * 0.22).toFixed(3)})`
    g.shadowColor = `hsl(${hsl} / 0.7)`
    g.shadowBlur = 12
    g.fill()
  }
  g.shadowBlur = 0
}

// expanding rings emitted whenever a message lands, in that message's mood color
function drawRipples(g, ripples, w, h) {
  const step = Math.min(w, h) * 0.006
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i]
    r.rad += step
    r.a *= 0.955
    if (r.a < 0.02) { ripples.splice(i, 1); continue }
    g.beginPath()
    g.arc(r.x, r.y, r.rad, 0, Math.PI * 2)
    g.lineWidth = 1.5
    g.strokeStyle = `hsl(${r.hsl} / ${r.a.toFixed(3)})`
    g.stroke()
  }
}

function Message({ m }) {
  const c = CAST[m.who]
  return (
    <div className="msg" style={{ '--aura': moodColor(m.mood, 0.55), '--hue': c.hue }}>
      <div className="avatar">{c.avatar ? <img src={c.avatar} alt={c.name} /> : c.initials}</div>
      <div className="body">
        <div className="meta"><b>{c.name}</b><time>{m.time}</time></div>
        <p>{m.text}</p>
      </div>
    </div>
  )
}

function Typing({ who }) {
  const c = CAST[who]
  return (
    <div className="msg typing" style={{ '--hue': c.hue }}>
      <div className="avatar">{c.avatar ? <img src={c.avatar} alt={c.name} /> : c.initials}</div>
      <div className="body">
        <div className="meta"><b>{c.name}</b><span className="muted">is typing…</span></div>
        <div className="dots"><span /><span /><span /></div>
      </div>
    </div>
  )
}

export default function App() {
  const [started, setStarted] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [typing, setTyping] = useState(null)
  const [movement, setMovement] = useState(-1) // slot index into MOVEMENTS[genre]
  const [text, setText] = useState('')
  const [genres, setGenres] = useState([])
  const [genre, setGenre] = useState('classical')
  const beat = useRef(0), busy = useRef(false), coda = useRef(0), convo = useRef([])
  const clock = useRef(Date.parse('2026-07-23T09:12:00'))
  const feedRef = useRef(), tintRef = useRef(), barRefs = useRef({}), eqRefs = useRef([]), bgRefs = useRef([])
  const vizRef = useRef(), orbRef = useRef(), spin = useRef(0), parts = useRef([]), ripples = useRef([]), flash = useRef(0)

  // fire an expanding ring + kick the orb whenever a message lands
  const emitPulse = mood => {
    flash.current = 1 // the orb core swells and brightens
    const c = vizRef.current
    if (!c) return
    const w = c.clientWidth, h = c.clientHeight
    ripples.current.push({ x: w / 2, y: h * 0.44, rad: Math.min(w, h) * 0.11, a: 0.85, hsl: dominantAxis(mood)[2] })
  }

  const stamp = () => {
    clock.current += 40000 + Math.random() * 50000
    return new Date(clock.current).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const add = m => {
    convo.current.push({ who: m.who, text: m.text }) // history for the live chatbot
    setMsgs(x => [...x, { ...m, time: stamp(), id: x.length }])
  }
  const wait = ms => new Promise(r => setTimeout(r, ms))

  // reveal one message with a typing beat, then let it steer the score
  async function reveal(m) {
    setTyping(m.who)
    await wait(delayFor(m.text))
    setTyping(null)
    music.setMood(m.mood)
    add(m)
    emitPulse(m.mood)
  }

  // play one scripted beat (a burst of authored messages); caller owns `busy`
  async function playScript(b) {
    setMovement(b.movement)
    for (const m of b.messages) {
      await wait(420)
      await reveal(m)
    }
  }

  // the room's response to a send: live chatbot when a key is set, else the script
  async function respond() {
    busy.current = true
    try {
      const reply = await generateReply(convo.current) // null with no key / on failure
      if (reply) {
        setMovement('Improvisation (live)')
        await wait(300)
        await reveal({ who: reply.who, text: reply.text, mood: reply.mood })
      } else {
        const b = BEATS[beat.current]
        if (b) { beat.current++; await playScript(b) }
        else await playScript(CODA[coda.current++ % CODA.length])
      }
    } finally {
      busy.current = false
    }
  }

  async function begin() {
    if (beat.current) return // double-click on the start button must not replay the opening
    setStarted(true)
    await music.start()
    beat.current = 1
    busy.current = true
    await playScript(BEATS[0]) // scripted opener sets the scene in both modes
    busy.current = false
  }

  function send(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !started) return
    setText('')
    const quick = scoreMessage(t, music.getMood()) // instant heuristic — never blocks the UI
    music.setMood(quick)
    add({ who: 'you', text: t, mood: quick })
    emitPulse(quick)
    // live AI scoring reads between the lines; refine the music when it lands
    scoreMessageAI(t, quick).then(ai => ai && music.setMood(ai))
    if (busy.current) return
    respond() // live reply if available, otherwise the next scripted beat
  }

  // discover which stem genres have been generated (public/music/genres.json)
  useEffect(() => {
    fetch('/music/genres.json')
      .then(r => (r.ok && (r.headers.get('content-type') || '').includes('json') ? r.json() : []))
      .then(setGenres)
      .catch(() => {})
  }, [])

  async function pickGenre(g) {
    setGenre(g)
    await music.setGenre(g)
  }

  // the genre's pixel musician plays a little 5-frame loop
  const spriteRef = useRef()
  useEffect(() => {
    const c = spriteRef.current
    if (!c) return
    const g = c.getContext('2d')
    let frame = 0
    const step = () => { drawSprite(g, genre, frame++, 4); }
    step()
    const id = setInterval(step, 170)
    return () => clearInterval(id)
  }, [genre, genres])

  // smooth-scroll the feed as messages land
  useEffect(() => { feedRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [msgs, typing])

  // live readout: mood meters, background tint, and EQ driven by the analyser
  useEffect(() => {
    if (!started) return
    let raf, data
    const cvs = vizRef.current
    const g = cvs?.getContext('2d')
    const orb = orbRef.current
    const og = orb?.getContext('2d')
    const fit = (c, ctx) => { // keep a canvas backing store matched to its CSS size + DPR
      const dpr = window.devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
      return [w, h]
    }
    const loop = () => {
      const m = music.getMood()
      for (const [k] of AXIS_META) {
        const el = barRefs.current[k]
        if (el) el.style.width = `${(m[k] * 100).toFixed(1)}%`
      }
      tintRef.current?.style.setProperty('--accent', moodColor(m, 0.55))
      // crossfade the blurred scene layers toward the dominant mood
      const ws = AXIS_META.map(([k]) => m[k] ** 2)
      const sum = ws.reduce((a, b) => a + b, 0) || 1
      bgRefs.current.forEach((el, i) => { if (el) el.style.opacity = (0.55 * ws[i] / sum).toFixed(3) })
      const an = music.getAnalyser()
      if (an) {
        data ||= new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(data)
        eqRefs.current.forEach((el, i) => {
          if (el) el.style.transform = `scaleY(${Math.max(0.08, data[2 + i * 3] / 255)})`
        })
      }
      // draw every frame — even before audio starts or while it's silent — so the orb never looks dead
      const freq = data || ZERO
      spin.current += 0.0016 // slow drift so nothing feels static
      flash.current *= 0.93 // message kick decays back down
      const bass = (freq[0] + freq[1] + freq[2]) / (3 * 255)
      if (g) {
        const [w, h] = fit(cvs, g)
        if (!parts.current.length) parts.current = Array.from({ length: 70 }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35, vy: -0.15 - Math.random() * 0.3,
          z: 0.4 + Math.random() * 0.9,
        }))
        const speed = 1 + m.tension * 2.4 + bass * 1.6 // motes hurry when things get tense
        g.clearRect(0, 0, w, h)
        drawParticles(g, parts.current, dominantAxis(m)[2], w, h, speed)
        drawViz(g, freq, m, w, h, spin.current)
        drawRipples(g, ripples.current, w, h)
      }
      if (og) {
        const [w, h] = fit(orb, og)
        drawOrb(og, freq, m, w, h, spin.current * 2.2, flash.current)
      }
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [started])

  return (
    <div className="shell">
      <div className="backdrop" aria-hidden="true">
        {AXIS_META.map(([k], i) => (
          <div key={k} className="layer" style={{ backgroundImage: `url(/bg/${k}.svg)` }} ref={el => (bgRefs.current[i] = el)} />
        ))}
        <canvas className="viz" ref={vizRef} />
        <div className="tint" ref={tintRef} />
        <div className="vignette" />
      </div>

      <div className={started ? 'overlay out' : 'overlay'}>
        <div className="card">
          <h1>🎼 Undertones</h1>
          <p className="tagline">Every conversation has a subtext.<br />Now it has a soundtrack.</p>
          <button onClick={begin}>▶ Begin the performance</button>
          <p className="note">🔊 sound on — the score follows the mood of each message</p>
        </div>
      </div>

      <header>
        <div>
          <b># pr-review-4821</b>
          <span className="muted">PR #4821 · refactor favorites-service · 6 members</span>
        </div>
        <div className="brand">🎼 Undertones</div>
      </header>

      <main>
        <section className="chat">
          <div className="feed" ref={feedRef}>
            <p className="intro">
              You've joined <b>#pr-review-4821</b>. Say anything to keep the review moving — the plot
              (and the orchestra) advance regardless 🎭
            </p>
            {msgs.map(m => <Message key={m.id} m={m} />)}
            {typing && <Typing who={typing} />}
          </div>
          <form className="composer" onSubmit={send}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Message #pr-review-4821"
              aria-label="Message"
            />
            <button type="submit">Send</button>
          </form>
        </section>

        <aside className="score">
          <h2>♪ The Score</h2>
          <div className="movement">
            {typeof movement === 'string' ? movement
              : movement < 0 ? '— tuning —'
              : (MOVEMENTS[genre] || MOVEMENTS.classical)[movement]}
          </div>
          {genres.length > 0 && (
            <div className="genre">
              <div className="genre-head">
                <span>Genre · <b>{GENRE_META[genre]?.[1] || genre}</b></span>
                <canvas ref={spriteRef} width={64} height={64} className="sprite" />
              </div>
              <div className="genre-grid">
                {genres.map(g => {
                  const [emoji, label] = GENRE_META[g] || ['🎵', g]
                  return (
                    <button
                      key={g}
                      type="button"
                      className={g === genre ? 'on' : ''}
                      onClick={() => pickGenre(g)}
                      title={label}
                      aria-label={label}
                      aria-pressed={g === genre}
                    >
                      {emoji}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div className="eq">{Array.from({ length: 7 }, (_, i) => <span key={i} ref={el => (eqRefs.current[i] = el)} />)}</div>
          {AXIS_META.map(([k, label, hsl]) => (
            <div className="meter" key={k}>
              <span>{label}</span>
              <div className="track"><div className="fill" ref={el => (barRefs.current[k] = el)} style={{ background: `hsl(${hsl})` }} /></div>
            </div>
          ))}
          <canvas className="orb" ref={orbRef} />
          <p className="hint">Scored per message · blended live</p>
        </aside>
      </main>
    </div>
  )
}
