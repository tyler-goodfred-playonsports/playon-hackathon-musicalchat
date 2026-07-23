import { useEffect, useRef, useState } from 'react'
import * as music from './music'
import { CAST, BEATS, CODA, delayFor } from './conversation'
import { scoreMessage } from './score'

const AXIS_META = [
  ['warmth', 'Warmth', '38 92% 60%'],
  ['concern', 'Concern', '212 92% 64%'],
  ['tension', 'Tension', '352 90% 60%'],
  ['passiveAggression', 'Passive aggression', '272 85% 68%'],
]

function moodColor(mood, alpha = 1) {
  let best = AXIS_META[0]
  for (const m of AXIS_META) if (mood[m[0]] > mood[best[0]]) best = m
  return `hsl(${best[2]} / ${alpha})`
}

function Message({ m }) {
  const c = CAST[m.who]
  return (
    <div className="msg" style={{ '--aura': moodColor(m.mood, 0.55), '--hue': c.hue }}>
      <div className="avatar">{c.initials}</div>
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
      <div className="avatar">{c.initials}</div>
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
  const [movement, setMovement] = useState('— tuning —')
  const [text, setText] = useState('')
  const beat = useRef(0), busy = useRef(false), coda = useRef(0)
  const clock = useRef(Date.parse('2026-07-23T09:12:00'))
  const feedRef = useRef(), tintRef = useRef(), barRefs = useRef({}), eqRefs = useRef([]), bgRefs = useRef([])

  const stamp = () => {
    clock.current += 40000 + Math.random() * 50000
    return new Date(clock.current).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  const add = m => setMsgs(x => [...x, { ...m, time: stamp(), id: x.length }])
  const wait = ms => new Promise(r => setTimeout(r, ms))

  async function playBeat(b) {
    busy.current = true
    setMovement(b.movement)
    for (const m of b.messages) {
      await wait(420)
      setTyping(m.who)
      await wait(delayFor(m.text))
      setTyping(null)
      music.setMood(m.mood)
      add(m)
    }
    busy.current = false
  }

  async function begin() {
    if (beat.current) return // double-click on the start button must not replay the opening
    setStarted(true)
    await music.start()
    beat.current = 1
    playBeat(BEATS[0])
  }

  function send(e) {
    e.preventDefault()
    const t = text.trim()
    if (!t || !started) return
    setText('')
    const b = BEATS[beat.current]
    const mood = scoreMessage(t, music.getMood()) // your tone steers the score live
    music.setMood(mood)
    add({ who: 'you', text: t, mood })
    if (busy.current) return
    if (b) { beat.current++; playBeat(b) }
    else playBeat(CODA[coda.current++ % CODA.length])
  }

  // smooth-scroll the feed as messages land
  useEffect(() => { feedRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [msgs, typing])

  // live readout: mood meters, background tint, and EQ driven by the analyser
  useEffect(() => {
    if (!started) return
    let raf, data
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
          <span className="muted">PR #4821 · refactor favorites-service · 5 members</span>
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
          <div className="movement">{movement}</div>
          <div className="eq">{Array.from({ length: 7 }, (_, i) => <span key={i} ref={el => (eqRefs.current[i] = el)} />)}</div>
          {AXIS_META.map(([k, label, hsl]) => (
            <div className="meter" key={k}>
              <span>{label}</span>
              <div className="track"><div className="fill" ref={el => (barRefs.current[k] = el)} style={{ background: `hsl(${hsl})` }} /></div>
            </div>
          ))}
          <p className="hint">Scored per message · blended live</p>
        </aside>
      </main>
    </div>
  )
}
