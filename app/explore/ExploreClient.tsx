'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Chess from './Chess'
import Trivia from './Trivia'
import Pacman from './Pacman'
import VoiceChat from './VoiceChat'

// ── Types ─────────────────────────────────────────────────────────────────────

type CityId = 'williamsburg' | 'toronto'

interface CityLocation {
  id: string; name: string; emoji: string; color: string
  desc: string; vibe: string
  x: number; y: number; w: number; h: number
}

interface SoulData { name: string; color: string; emoji: string }

interface CityConfig {
  id:          CityId
  name:        string
  subtitle:    string
  locations:   CityLocation[]
  souls:       Record<string, SoulData[]>
  messages:    string[]
  cols:        number
  rows:        number
  deepWaterY:  number | null
  wanderMaxY:  number
  bgDark:      string; bgLight:      string
  streetDark:  string; streetLight:  string
  borderDark:  string; borderLight:  string
  ghost1:      { x: number; y: number }
  ghost2:      { x: number; y: number }
}

// ── 20 wandering souls ────────────────────────────────────────────────────────

const SOUL_POOL = [
  { name: 'Luna',  color: '#ff6b9d', sx: 0,  sy: 0  },
  { name: 'Kai',   color: '#00d4aa', sx: 3,  sy: 0  },
  { name: 'Mia',   color: '#ff9f43', sx: 7,  sy: 0  },
  { name: 'Theo',  color: '#54a0ff', sx: 11, sy: 0  },
  { name: 'Zara',  color: '#a29bfe', sx: 0,  sy: 4  },
  { name: 'Finn',  color: '#55efc4', sx: 5,  sy: 3  },
  { name: 'Noa',   color: '#ffd32a', sx: 9,  sy: 3  },
  { name: 'Rio',   color: '#ff4757', sx: 11, sy: 5  },
  { name: 'Sky',   color: '#70a1ff', sx: 0,  sy: 7  },
  { name: 'Ash',   color: '#a0b0c0', sx: 7,  sy: 6  },
  { name: 'Iris',  color: '#cd84f1', sx: 11, sy: 7  },
  { name: 'Fox',   color: '#e1b12c', sx: 4,  sy: 9  },
  { name: 'Sage',  color: '#84c9a0', sx: 0,  sy: 11 },
  { name: 'Remy',  color: '#f8a5c2', sx: 7,  sy: 11 },
  { name: 'Crew',  color: '#6090c0', sx: 11, sy: 10 },
  { name: 'Nova',  color: '#e843c0', sx: 3,  sy: 13 },
  { name: 'Beau',  color: '#d4a060', sx: 9,  sy: 13 },
  { name: 'Lux',   color: '#f9ca24', sx: 0,  sy: 15 },
  { name: 'Wren',  color: '#d4a0b0', sx: 6,  sy: 15 },
  { name: 'Paz',   color: '#ff7675', sx: 11, sy: 15 },
]

// ── City configs ──────────────────────────────────────────────────────────────
//
// Both cities use a 12 × 18 grid.
//
// WILLIAMSBURG  (no water)
//  y 0  streets
//  y 1-2  Aces Pizza (1,1,3×2)   Vital Climbing (8,1,3×2)
//  y 3-8  streets
//  y 9-10  Devoción (1,9,3×2)
//  y 11-12  streets
//  y 13-14  Karma Beer (8,13,3×2)
//  y 15-17  streets
//
// TORONTO  (Lake Ontario at bottom)
//  y 0-1  North / Midtown residential
//  y 2-3  U of T Gym (4,2,3×2)
//  y 4-5  streets (Bloor)
//  y 6-7  Cong Caphe (1,6,3×2)
//  y 8-9  streets (King/Queen)
//  y 10-11  Ahn Dao (8,10,3×2)
//  y 12    streets (Harbourfront)
//  y 13-14  The Lake  (1,13,10×2)  — interactive waterfront
//  y 15-17  deep Lake Ontario (decorative)

const WBURG: CityConfig = {
  id: 'williamsburg', name: 'Williamsburg', subtitle: 'Brooklyn, NY',
  cols: 12, rows: 18, deepWaterY: null, wanderMaxY: 17,
  bgDark: '#0a0c14', bgLight: '#e8e4f0',
  streetDark: '#141824', streetLight: '#d4cfe0',
  borderDark: '#1e2438', borderLight: '#c4bdd0',
  ghost1: { x: 5, y: 6 }, ghost2: { x: 3, y: 11 },
  messages: [
    'Looking for someone special \u2728',
    'Williamsburg has such good vibes \uD83C\uDF06',
    'Wonder who I\u2019ll meet today \uD83D\uDC40',
    'This neighborhood feels like home \uD83C\uDFD9\uFE0F',
    'Coffee, climbing, pizza\u2026 perfect day \u2615',
    'Every soul has a story \uD83D\uDCCE',
    'Maybe today is the day \uD83D\uDCAB',
    'I love this city \uD83C\uDF09',
  ],
  locations: [
    { id: 'aces_pizza',     name: 'Aces Pizza',     emoji: '\uD83C\uDF55', color: '#cc3322',
      desc: 'Thick-crust legends. The real deal.',
      vibe: 'Casual \u00b7 Loud \u00b7 Cheesy', x: 1,  y: 1,  w: 3, h: 2 },
    { id: 'vital_climbing', name: 'Vital Climbing',  emoji: '\uD83E\uDDD7', color: '#2255cc',
      desc: 'Brooklyn\u2019s favourite bouldering gym.',
      vibe: 'Adventurous \u00b7 Physical \u00b7 Electric', x: 8, y: 1,  w: 3, h: 2 },
    { id: 'devocion',       name: 'Devoci\u00f3n',   emoji: '\u2615',       color: '#8b5e3c',
      desc: 'Farm-to-cup Colombian coffee. Worth the line.',
      vibe: 'Creative \u00b7 Slow \u00b7 Warm', x: 1, y: 9,  w: 3, h: 2 },
    { id: 'karma_beer',     name: 'Karma Beer',      emoji: '\uD83C\uDF7A', color: '#b8820a',
      desc: 'Natural wine & craft beer. Good vibes only.',
      vibe: 'Laid-back \u00b7 Social \u00b7 Fun', x: 8, y: 13, w: 3, h: 2 },
  ],
  souls: {
    aces_pizza:     [{ name: 'Alex',   color: '#e06080', emoji: '\uD83C\uDFB8' },
                     { name: 'Sam',    color: '#60a0e0', emoji: '\uD83C\uDFAE' }],
    vital_climbing: [{ name: 'Jordan', color: '#60c060', emoji: '\uD83C\uDFD4\uFE0F' }],
    devocion:       [{ name: 'Taylor', color: '#c080e0', emoji: '\uD83D\uDCDA' },
                     { name: 'River',  color: '#e0a040', emoji: '\uD83C\uDFA8' },
                     { name: 'Casey',  color: '#e06060', emoji: '\uD83C\uDFA7' }],
    karma_beer:     [{ name: 'Morgan', color: '#60c0a0', emoji: '\uD83C\uDFB5' },
                     { name: 'Quinn',  color: '#e08060', emoji: '\uD83C\uDF19' }],
  },
}

const TORONTO: CityConfig = {
  id: 'toronto', name: 'Toronto', subtitle: 'Ontario, CA',
  cols: 12, rows: 18, deepWaterY: 15, wanderMaxY: 14,
  bgDark: '#080e18', bgLight: '#dce6f0',
  streetDark: '#111a26', streetLight: '#c8d6e8',
  borderDark: '#1a2a3a', borderLight: '#b0c4d8',
  ghost1: { x: 5, y: 5 }, ghost2: { x: 2, y: 8 },
  messages: [
    'CN Tower vibes today \uD83C\uDFD9\uFE0F',
    'Lake Ontario looks gorgeous \uD83C\uDF0A',
    'Love this city so much \u2764\uFE0F',
    'Pho or coffee first? \uD83C\uDF5C',
    'The gym calls me \uD83C\uDFCB\uFE0F',
    'Waterfront walks hit different \uD83C\uDF0A',
    'Toronto sunsets are unmatched \uD83C\uDF07',
    'Maybe I\u2019ll find them here \uD83D\uDCAB',
    'Best city in the world fr \uD83D\uDC99',
  ],
  locations: [
    { id: 'uoft_gym',   name: 'U of T Gym',   emoji: '\uD83C\uDFCB\uFE0F', color: '#002a5c',
      desc: 'The Athletic Centre on St George. Legendary squash courts.',
      vibe: 'Focused \u00b7 Sweaty \u00b7 Academic', x: 4, y: 2,  w: 3, h: 2 },
    { id: 'cong_caphe', name: 'Cong Caphe',    emoji: '\u2615',              color: '#c47a1e',
      desc: 'Vietnamese coconut coffee. The lineup is worth it.',
      vibe: 'Warm \u00b7 Cozy \u00b7 Caffeinated', x: 1, y: 6,  w: 3, h: 2 },
    { id: 'ahn_dao',    name: 'Ahn Dao',        emoji: '\uD83C\uDF5C',        color: '#cc3344',
      desc: 'The best pho in the city. Regulars only vibe.',
      vibe: 'Hearty \u00b7 Cozy \u00b7 Soulful', x: 8, y: 10, w: 3, h: 2 },
    { id: 'the_lake',   name: 'The Lake',       emoji: '\uD83C\uDF0A',        color: '#1a7aaa',
      desc: 'Lake Ontario. Feels infinite on a clear day.',
      vibe: 'Open \u00b7 Calm \u00b7 Infinite', x: 1, y: 13, w: 10, h: 2 },
  ],
  souls: {
    uoft_gym:   [{ name: 'Chris', color: '#4080e0', emoji: '\uD83C\uDFCB\uFE0F' },
                 { name: 'Dana',  color: '#40c0a0', emoji: '\uD83E\uDDD7'       }],
    cong_caphe: [{ name: 'Maya',  color: '#e0a040', emoji: '\u2615'              },
                 { name: 'Leo',   color: '#e080c0', emoji: '\uD83C\uDF38'       }],
    ahn_dao:    [{ name: 'Nick',  color: '#e06060', emoji: '\uD83C\uDF5C'       },
                 { name: 'Sofia', color: '#c080e0', emoji: '\uD83C\uDFA8'       },
                 { name: 'James', color: '#60b0e0', emoji: '\uD83C\uDFB5'       }],
    the_lake:   [{ name: 'Priya', color: '#40b0d0', emoji: '\uD83C\uDF0A'       },
                 { name: 'Evan',  color: '#80c080', emoji: '\uD83D\uDEB4'       },
                 { name: 'Zoe',   color: '#e080a0', emoji: '\uD83C\uDF07'       }],
  },
}

const CITIES: Record<CityId, CityConfig> = { williamsburg: WBURG, toronto: TORONTO }

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLocAt(locs: CityLocation[], x: number, y: number) {
  return locs.find(l => x >= l.x && x < l.x + l.w && y >= l.y && y < l.y + l.h)
}
function isLocCenter(l: CityLocation, x: number, y: number) {
  return x === l.x + Math.floor(l.w / 2) && y === l.y + Math.floor(l.h / 2)
}

// ── Ghost sprite data ─────────────────────────────────────────────────────────

const GHOST_BODY = [
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,1,0,0,1,0,0,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,0,1,0,1,0,1,0,1],
]
const GHOST_EYES = new Set(['4-2','4-3','4-5','4-6'])

// ── Mini soul dot (lightweight, no bob) ───────────────────────────────────────

function SoulDot({ name, color, startX, startY, maxY, cols, rows }: {
  name: string; color: string; startX: number; startY: number
  maxY: number; cols: number; rows: number
}) {
  const [pos, setPos] = useState({ x: startX, y: Math.min(startY, maxY) })
  const MPX = 2

  useEffect(() => {
    const DIRS = [{ dx:1,dy:0 },{ dx:-1,dy:0 },{ dx:0,dy:1 },{ dx:0,dy:-1 }]
    // stagger intervals so not all move at once
    const delay = 2600 + (startX * 173 + startY * 113) % 2400
    const id = setInterval(() => {
      setPos(prev => {
        const valid = DIRS.filter(({ dx, dy }) => {
          const nx = prev.x + dx, ny = prev.y + dy
          return nx >= 0 && nx < cols && ny >= 0 && ny <= maxY
        })
        if (!valid.length) return prev
        const pick = valid[Math.floor(Math.random() * valid.length)]
        return { x: prev.x + pick.dx, y: prev.y + pick.dy }
      })
    }, delay)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startX, startY])

  return (
    <div style={{
      position: 'absolute',
      left: `${(pos.x + 0.5) / cols * 100}%`,
      top:  `${(pos.y + 0.5) / rows * 100}%`,
      transform: 'translate(-50%, -50%)',
      transition: 'left 1s ease, top 1s ease',
      pointerEvents: 'none', zIndex: 12,
    }}>
      <svg width={9*MPX} height={8*MPX} style={{ imageRendering: 'pixelated', display: 'block' }}>
        {GHOST_BODY.map((row, gy) => row.map((cell, gx) => {
          if (!cell) return null
          const isEye = GHOST_EYES.has(`${gy}-${gx}`)
          return (
            <rect key={`${gy}-${gx}`}
              x={gx*MPX} y={gy*MPX} width={MPX} height={MPX}
              fill={isEye ? '#0d0020' : color}
              opacity={0.75}
            />
          )
        }))}
      </svg>
      <div style={{
        textAlign: 'center', marginTop: 1, fontSize: 6, fontWeight: 700,
        color, lineHeight: 1, opacity: 0.85,
        textShadow: '0 1px 3px rgba(0,0,0,0.9)',
      }}>{name}</div>
    </div>
  )
}

// ── Main ghost (full size, bobs, chat bubbles) ────────────────────────────────

const PX = 3

function WanderingGhost({ name, color, startX, startY, darkMode, maxY, cols, rows, messages }: {
  name: string; color: string; startX: number; startY: number
  darkMode: boolean; maxY: number; cols: number; rows: number; messages: string[]
}) {
  const [pos, setPos]       = useState({ x: startX, y: Math.min(startY, maxY) })
  const [facing, setFacing] = useState<1 | -1>(1)
  const [bob, setBob]       = useState(0)
  const [bubble, setBubble] = useState<string | null>(null)

  useEffect(() => {
    const DIRS = [
      {dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
      {dx:1,dy:1},{dx:-1,dy:1},{dx:1,dy:-1},{dx:-1,dy:-1},
    ]
    const id = setInterval(() => {
      setPos(prev => {
        const valid = DIRS.filter(({ dx, dy }) => {
          const nx = prev.x + dx, ny = prev.y + dy
          return nx >= 0 && nx < cols && ny >= 0 && ny <= maxY
        })
        const pick = valid[Math.floor(Math.random() * valid.length)]
        if (!pick) return prev
        if (pick.dx !== 0) setFacing(pick.dx > 0 ? 1 : -1)
        return { x: prev.x + pick.dx, y: prev.y + pick.dy }
      })
    }, startX % 2 === 0 ? 2000 : 2400)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startX])

  useEffect(() => {
    let t = startX * Math.PI
    const id = setInterval(() => { t += 0.10; setBob(Math.sin(t) * 3) }, 32)
    return () => clearInterval(id)
  }, [startX])

  useEffect(() => {
    const schedule = (): ReturnType<typeof setTimeout> => {
      const delay = 7000 + Math.random() * 8000 + startX * 2000
      const t = setTimeout(() => {
        const msg = messages[Math.floor(Math.random() * messages.length)]
        setBubble(msg)
        setTimeout(() => setBubble(null), 3500)
        schedule()
      }, delay)
      return t
    }
    const t = schedule()
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startX])

  const eyeColor = darkMode ? '#1a0826' : '#0d0020'

  return (
    <div style={{
      position: 'absolute',
      left: `${(pos.x + 0.5) / cols * 100}%`,
      top:  `${(pos.y + 0.5) / rows * 100}%`,
      transform: `translate(-50%, calc(-50% + ${bob}px))`,
      transition: 'left 0.8s cubic-bezier(.4,0,.2,1), top 0.8s cubic-bezier(.4,0,.2,1)',
      pointerEvents: 'none', zIndex: 20,
    }}>
      {bubble && (
        <div style={{
          position: 'absolute', bottom: `${8*PX + 18}px`, left: '50%',
          transform: 'translateX(-50%)',
          background: darkMode ? '#1e1830' : '#fff',
          color: darkMode ? '#e8d8ff' : '#1a0a2a',
          borderRadius: 10, padding: '5px 9px', fontSize: 9,
          whiteSpace: 'nowrap', boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          border: `1px solid ${color}55`, zIndex: 30, lineHeight: 1.5,
        }}>
          {bubble}
          <div style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: `5px solid ${darkMode ? '#1e1830' : '#fff'}`,
          }} />
        </div>
      )}
      <div style={{ transform: `scaleX(${facing})`, filter: `drop-shadow(0 2px 6px ${color}88)` }}>
        <svg width={9*PX} height={8*PX} style={{ imageRendering: 'pixelated', display: 'block' }}>
          {GHOST_BODY.map((row, gy) => row.map((cell, gx) => {
            if (!cell) return null
            const k = `${gy}-${gx}`
            const isEye   = GHOST_EYES.has(k)
            const isShine = gy === 2 && (gx === 3 || gx === 4)
            return <rect key={k} x={gx*PX} y={gy*PX} width={PX} height={PX}
              fill={isEye ? eyeColor : isShine ? 'rgba(255,255,255,0.38)' : color} />
          }))}
        </svg>
      </div>
      <div style={{
        textAlign: 'center', marginTop: 2, fontSize: 8, fontWeight: 700,
        color, letterSpacing: '0.04em', textShadow: '0 1px 4px rgba(0,0,0,0.9)',
      }}>{name}</div>
    </div>
  )
}

// ── ExploreClient ─────────────────────────────────────────────────────────────

export default function ExploreClient() {
  const router = useRouter()
  const [city, setCity]             = useState<CityId>('williamsburg')
  const [activeLocation, setActive] = useState<CityLocation | null>(null)
  const [darkMode, setDarkMode]     = useState(true)
  const [showChess,  setShowChess]  = useState(false)
  const [showTrivia, setShowTrivia] = useState(false)
  const [showPacman, setShowPacman] = useState(false)
  const [myToken, setMyToken] = useState('')
  const [myName,  setMyName]  = useState('You')

  useEffect(() => {
    let token = localStorage.getItem('soulmate_token')
    if (!token) {
      token = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
      })
      localStorage.setItem('soulmate_token', token)
    }
    setMyToken(token)
    const saved = localStorage.getItem('soulmate_name')
    if (saved) setMyName(saved)
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('soulmate_dark')
    if (saved !== null) setDarkMode(saved === 'true')
  }, [])

  useEffect(() => { setActive(null) }, [city])

  const cfg = CITIES[city]
  const bgColor     = darkMode ? cfg.bgDark     : cfg.bgLight
  const streetColor = darkMode ? cfg.streetDark : cfg.streetLight
  const streetBorder = darkMode ? cfg.borderDark : cfg.borderLight

  const deepWaterBg = (y: number) => {
    const depth = cfg.deepWaterY ? (y - cfg.deepWaterY) / 3 : 0
    return darkMode
      ? `hsl(210, 60%, ${8 + depth * 4}%)`
      : `hsl(205, 65%, ${55 - depth * 8}%)`
  }

  return (
    <div style={{ minHeight: '100vh', background: bgColor, color: darkMode ? '#f0e8ff' : '#0a1a2a' }}>
      <div className="max-w-sm mx-auto flex flex-col" style={{ minHeight: '100vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-5 pb-2">
          <button onClick={() => router.push('/')} className="text-sm opacity-60 hover:opacity-100"
            style={{ color: darkMode ? '#a090c0' : '#6040a0' }}>
            ← Back
          </button>
          <div className="text-center">
            <p className="font-bold text-sm">{cfg.name}</p>
            <p style={{ fontSize: 10, opacity: 0.5 }}>{cfg.subtitle}</p>
          </div>
          <button onClick={() => { const n=!darkMode; setDarkMode(n); localStorage.setItem('soulmate_dark',String(n)) }}
            className="text-base opacity-60 hover:opacity-100">
            {darkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* City selector */}
        <div className="flex mx-4 rounded-xl p-1 gap-1 mb-2"
          style={{ background: darkMode ? '#1a1a2e' : '#ddd8ec' }}>
          {(['williamsburg', 'toronto'] as CityId[]).map(c => (
            <button key={c} onClick={() => setCity(c)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: city === c ? (darkMode ? '#2e2050' : '#fff') : 'transparent',
                color:      city === c ? (darkMode ? '#e0d0ff' : '#2a1060') : (darkMode ? '#6050a0' : '#8070b0'),
              }}>
              {c === 'williamsburg' ? '🗽 Williamsburg' : '🍁 Toronto'}
            </button>
          ))}
        </div>

        {/* Soul count */}
        <p className="text-center pb-1" style={{ fontSize: 10, color: darkMode ? '#5040a0' : '#9080c0' }}>
          {SOUL_POOL.length + 2} souls wandering · tap a location to connect
        </p>

        {/* Map */}
        <div className="px-3">
          <div style={{
            borderRadius: 14, overflow: 'hidden',
            border: `1px solid ${darkMode ? '#2a2040' : '#b0a8cc'}`,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${cfg.cols}, 1fr)`,
              gap: 2,
              background: darkMode ? cfg.bgDark : cfg.bgLight,
              padding: 3,
              position: 'relative',
            }}>
              {/* All souls overlay */}
              <div style={{ position: 'absolute', inset: 3, pointerEvents: 'none', zIndex: 10 }}>
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>

                  {/* 20 wandering souls */}
                  {SOUL_POOL.map(s => (
                    <SoulDot
                      key={s.name}
                      name={s.name} color={s.color}
                      startX={s.sx} startY={s.sy}
                      maxY={cfg.wanderMaxY}
                      cols={cfg.cols} rows={cfg.rows}
                    />
                  ))}

                  {/* Jason & Rui (featured ghosts, full size) */}
                  <WanderingGhost
                    name="Jason" color="#8844cc"
                    startX={cfg.ghost1.x} startY={cfg.ghost1.y}
                    darkMode={darkMode} maxY={cfg.wanderMaxY}
                    cols={cfg.cols} rows={cfg.rows} messages={cfg.messages}
                  />
                  <WanderingGhost
                    name="Rui" color="#dd4477"
                    startX={cfg.ghost2.x} startY={cfg.ghost2.y}
                    darkMode={darkMode} maxY={cfg.wanderMaxY}
                    cols={cfg.cols} rows={cfg.rows} messages={cfg.messages}
                  />
                </div>
              </div>

              {/* Grid cells */}
              {Array.from({ length: cfg.rows * cfg.cols }).map((_, idx) => {
                const cx = idx % cfg.cols
                const cy = Math.floor(idx / cfg.cols)

                // Deep water (Toronto)
                if (cfg.deepWaterY !== null && cy >= cfg.deepWaterY) {
                  const wave = (cx + cy) % 2 === 0
                  return (
                    <div key={idx} style={{
                      aspectRatio: '1', borderRadius: 2,
                      background: deepWaterBg(cy),
                      border: `1px solid ${wave
                        ? (darkMode ? '#0a2a48' : '#60a8d8')
                        : (darkMode ? '#081e38' : '#4898c8')}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 6, opacity: wave ? 0.9 : 1,
                    }}>
                      {wave && <span style={{ opacity: 0.35, userSelect: 'none' }}>\u301c</span>}
                    </div>
                  )
                }

                const loc      = getLocAt(cfg.locations, cx, cy)
                const isCenter = loc ? isLocCenter(loc, cx, cy) : false
                const isActive = activeLocation?.id === loc?.id

                let bg     = streetColor
                let border = `1px solid ${streetBorder}`
                let cursor = 'default'

                if (loc) {
                  bg     = isActive ? loc.color + 'cc' : isCenter ? loc.color + '99' : loc.color + '44'
                  border = `1px solid ${loc.color}${isActive ? 'ee' : '77'}`
                  cursor = 'pointer'
                }

                return (
                  <div key={idx}
                    onClick={() => loc && setActive(prev => prev?.id === loc.id ? null : loc)}
                    style={{
                      aspectRatio: '1', borderRadius: 3, background: bg, border, cursor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: isCenter ? 13 : 7, transition: 'background 0.2s',
                      position: 'relative',
                    }}
                  >
                    {isCenter && <span>{loc!.emoji}</span>}
                    {isCenter && (cfg.souls[loc!.id]?.length ?? 0) > 0 && (
                      <div style={{
                        position: 'absolute', top: 1, right: 1,
                        background: '#ff6090', borderRadius: '50%',
                        width: 6, height: 6, fontSize: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700,
                      }}>
                        {cfg.souls[loc!.id].length}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Lake label (Toronto) */}
            {city === 'toronto' && (
              <div style={{
                position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)',
                fontSize: 8, color: darkMode ? '#3080b0' : '#0050a0',
                fontWeight: 700, letterSpacing: '0.12em', opacity: 0.65,
                pointerEvents: 'none', whiteSpace: 'nowrap',
              }}>
                \u301c\u301c LAKE ONTARIO \u301c\u301c
              </div>
            )}
          </div>
        </div>

        {/* Location panel */}
        {activeLocation ? (
          <div style={{
            margin: '8px 12px 6px', borderRadius: 14,
            background: darkMode ? '#141020' : '#f0eaf8',
            border: `1px solid ${activeLocation.color}55`, overflow: 'hidden',
          }}>
            <div style={{ background: activeLocation.color + '28', padding: '11px 14px 8px' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: 20 }}>{activeLocation.emoji}</span>
                  <div>
                    <p className="font-bold" style={{ fontSize: 13 }}>{activeLocation.name}</p>
                    <p style={{ fontSize: 10, opacity: 0.6 }}>{activeLocation.vibe}</p>
                  </div>
                </div>
                <button onClick={() => setActive(null)} style={{ opacity: 0.4, fontSize: 14 }}>✕</button>
              </div>
              <p style={{ fontSize: 11, opacity: 0.65, marginTop: 5 }}>{activeLocation.desc}</p>
            </div>

            <div style={{ padding: '8px 14px 12px' }}>
              <p style={{ fontSize: 10, fontWeight: 700, opacity: 0.4, letterSpacing: '0.06em', marginBottom: 6 }}>
                SOULS HERE
              </p>
              <div className="flex flex-wrap gap-2">
                {(cfg.souls[activeLocation.id] || []).map(soul => (
                  <div key={soul.name} style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    background: soul.color + '22', border: `1px solid ${soul.color}55`,
                    borderRadius: 20, padding: '3px 9px',
                  }}>
                    <span style={{ fontSize: 11 }}>{soul.emoji}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: soul.color }}>{soul.name}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 9, display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setShowChess(true)}
                  style={{
                    flex: 1, padding: '8px',
                    borderRadius: 9, fontSize: 11, fontWeight: 600,
                    background: activeLocation.color + '33',
                    border: `1px solid ${activeLocation.color}66`,
                    color: darkMode ? '#f0e8ff' : '#1a0a2a', cursor: 'pointer',
                  }}>
                  ♟ Chess
                </button>
                <button
                  onClick={() => setShowTrivia(true)}
                  style={{
                    flex: 1, padding: '8px',
                    borderRadius: 9, fontSize: 11, fontWeight: 600,
                    background: '#3a1e0833',
                    border: '1px solid #cc880066',
                    color: darkMode ? '#f0d090' : '#5a3000', cursor: 'pointer',
                  }}>
                  🍺 Trivia Night
                </button>
                <button
                  onClick={() => setShowPacman(true)}
                  style={{
                    flex: 1, padding: '8px',
                    borderRadius: 9, fontSize: 11, fontWeight: 600,
                    background: '#0a002033',
                    border: '1px solid #8844cc66',
                    color: darkMode ? '#cc88ff' : '#440066', cursor: 'pointer',
                  }}>
                  👾 Pac-Man
                </button>
              </div>
              {myToken && (
                <VoiceChat
                  channelKey={`${city}-${activeLocation.id}`}
                  locationName={activeLocation.name}
                  locationColor={activeLocation.color}
                  darkMode={darkMode}
                  myToken={myToken}
                  myName={myName}
                />
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: '8px 14px 20px', textAlign: 'center' }}>
            <p style={{ fontSize: 10, opacity: 0.35 }}>Tap a location to see who&apos;s there</p>
            <div className="flex justify-center gap-2 mt-2 flex-wrap">
              {cfg.locations.map(loc => (
                <button key={loc.id} onClick={() => setActive(loc)} style={{
                  display: 'flex', alignItems: 'center', gap: 3, fontSize: 10,
                  background: loc.color + '22', border: `1px solid ${loc.color}44`,
                  borderRadius: 12, padding: '3px 8px', cursor: 'pointer',
                  color: darkMode ? '#e0d0ff' : '#1a0a2a',
                }}>
                  {loc.emoji} {loc.name}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Chess modal */}
      {showChess && activeLocation && (
        <Chess
          darkMode={darkMode}
          locationName={activeLocation.name}
          locationColor={activeLocation.color}
          onClose={() => setShowChess(false)}
        />
      )}

      {/* Trivia modal */}
      {showTrivia && activeLocation && (
        <Trivia
          darkMode={darkMode}
          locationName={activeLocation.name}
          locationColor={activeLocation.color}
          onClose={() => setShowTrivia(false)}
        />
      )}

      {/* Pacman modal */}
      {showPacman && activeLocation && (
        <Pacman
          darkMode={darkMode}
          locationName={activeLocation.name}
          locationColor={activeLocation.color}
          onClose={() => setShowPacman(false)}
        />
      )}
    </div>
  )
}
