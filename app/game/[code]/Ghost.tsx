'use client'

import { useEffect, useState, useRef } from 'react'
import { SHOP_ITEMS, STARTER_LAYOUT } from '@/lib/items'

const GRID_COLS = 8
const GRID_ROWS = 8
const PX = 3

// 9-wide pixel ghost body
const BODY: number[][] = [
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,1,0,0,1,0,0,1,1],  // eyes
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,0,1,0,1,0,1,0,1],  // wavy skirt
]
const EYE_PIXELS = new Set(['4-2','4-3','4-5','4-6'])

// ── Messages ─────────────────────────────────────────────────────────────────

const ITEM_MESSAGES: Record<string, string[]> = {
  couch:        ['This couch is everything 🛋️', 'So comfy here ☁️', 'Best seat in the house!', 'Could nap here forever 😴'],
  lamp:         ['Love this warm glow 🪔', 'The ambiance is *chef\u2019s kiss* ✨', 'So cozy in here 🌅', 'Perfect lighting 💛'],
  rug:          ['This rug ties it all together!', 'Stepping on this feels lovely', 'Such a vibe in here 🥰', 'Cozy underfoot 🦶'],
  coffee_table: ['Perfect for morning coffee ☕', 'Love our little table 🌿', 'This table is so cute!', 'Tea time? ☕'],
  bookshelves:  ['These books spark joy 📚', 'Our little library 🤓', 'I love that we read!', 'Pick me a book 📖'],
  plant:        ['Our little plant friend 🪴', 'Nature inside! 🌱', 'It\'s so alive in here 🌿', 'Plants = serotonin 💚'],
  tv:           ['Movie night! 🍿', 'What are we watching? 📺', 'Cuddle up and watch something 🥰'],
  fireplace:    ['So warm in here 🔥', 'Crackling fire energy ✨', 'This is pure magic 🔥', 'Warmth of home 🏡'],
  piano:        ['Play me something 🎹', 'Music fills the home 🎵', 'Our home has a piano!!! 🎶'],
  cat:          ['Our little baby 😻', 'The cat owns this house now 🐱', 'They\u2019re so perfect 🐾'],
  arcade:       ['Can we play?? 🕹️', 'High score incoming 👾', 'Battle me in Space Invaders! 🚀', 'I\u2019m unbeatable at Pac-Man 👻'],
}

const GENERAL_MESSAGES = [
  'This is our home 🏡',
  'I love being here with you 💕',
  'Our little world 🌟',
  'So happy here 🥰',
  'This place feels magical ✨',
  'Home is where you are 💫',
  'I could stay here forever 🌙',
  'Built this together 🤝',
  'Feeling so peaceful 🌿',
  'Can\u2019t believe this is ours 🥺',
  'Every day here is a gift 🎁',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

interface AnyPlaced { itemId: string; x: number; y: number }

function findNearbyItem(pos: { x: number; y: number }, placed: AnyPlaced[]): string | null {
  const all = [...STARTER_LAYOUT, ...placed]
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const nx = pos.x + dx
      const ny = pos.y + dy
      const occ = all.find(pi => {
        const def = SHOP_ITEMS.find(s => s.id === pi.itemId)
        if (!def) return false
        return nx >= pi.x && nx < pi.x + def.w &&
               ny >= pi.y && ny < pi.y + def.h
      })
      if (occ) return occ.itemId
    }
  }
  return null
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  name: string
  color: string
  startX: number
  startY: number
  darkMode: boolean
  placedItems: AnyPlaced[]
  gridCols?: number
  gridRows?: number
  customMessages?: string[]
}

export default function Ghost({ name, color, startX, startY, darkMode, placedItems, gridCols, gridRows, customMessages }: Props) {
  const cols = gridCols ?? GRID_COLS
  const rows = gridRows ?? GRID_ROWS
  const [pos, setPos]       = useState({ x: startX, y: startY })
  const [facing, setFacing] = useState<1 | -1>(1)
  const [bob, setBob]       = useState(0)
  const [bubble, setBubble] = useState<string | null>(null)

  const posRef             = useRef(pos)
  const placedRef          = useRef(placedItems)
  const customMessagesRef  = useRef(customMessages)
  const timerRef           = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { posRef.current            = pos             }, [pos])
  useEffect(() => { placedRef.current         = placedItems     }, [placedItems])
  useEffect(() => { customMessagesRef.current = customMessages  }, [customMessages])

  // ── Wander ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const DIRS = [
      { dx:  1, dy:  0 }, { dx: -1, dy:  0 },
      { dx:  0, dy:  1 }, { dx:  0, dy: -1 },
      { dx:  1, dy:  1 }, { dx: -1, dy:  1 },
      { dx:  1, dy: -1 }, { dx: -1, dy: -1 },
    ]
    const ms = startX % 2 === 0 ? 1800 : 2200   // offset between ghosts

    const id = setInterval(() => {
      setPos(prev => {
        const valid = DIRS.filter(({ dx, dy }) => {
          const nx = prev.x + dx, ny = prev.y + dy
          return nx >= 0 && nx < cols && ny >= 0 && ny < rows
        })
        const pick = valid[Math.floor(Math.random() * valid.length)]
        if (!pick) return prev
        if (pick.dx !== 0) setFacing(pick.dx > 0 ? 1 : -1)
        return { x: prev.x + pick.dx, y: prev.y + pick.dy }
      })
    }, ms)

    return () => clearInterval(id)
  }, [startX])

  // ── Bob ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let t = startX * Math.PI   // different starting phase per ghost
    const id = setInterval(() => { t += 0.12; setBob(Math.sin(t) * 3.5) }, 32)
    return () => clearInterval(id)
  }, [startX])

  // ── Chat bubbles ───────────────────────────────────────────────────────────
  useEffect(() => {
    const schedule = () => {
      const delay = 8000 + Math.random() * 9000 + startX * 2000  // stagger
      timerRef.current = setTimeout(() => {
        const nearbyId = findNearbyItem(posRef.current, placedRef.current)
        const pool = (nearbyId && ITEM_MESSAGES[nearbyId]) ? ITEM_MESSAGES[nearbyId] : (customMessagesRef.current ?? GENERAL_MESSAGES)
        setBubble(pool[Math.floor(Math.random() * pool.length)])
        setTimeout(() => setBubble(null), 3800)
        schedule()
      }, delay)
    }
    schedule()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [startX])

  // ── Render ─────────────────────────────────────────────────────────────────
  const eyeColor = darkMode ? '#1a0826' : '#16002a'
  const shimmer  = 'rgba(255,255,255,0.38)'

  return (
    <div style={{
      position:   'absolute',
      left:       `${(pos.x + 0.5) / cols * 100}%`,
      top:        `${(pos.y + 0.5) / rows * 100}%`,
      transform:  `translate(-50%, calc(-50% + ${bob}px))`,
      transition: 'left 0.7s cubic-bezier(.4,0,.2,1), top 0.7s cubic-bezier(.4,0,.2,1)',
      pointerEvents: 'none',
      zIndex: 20,
    }}>

      {/* Chat bubble — outside scaleX wrapper so text is never mirrored */}
      {bubble && (
        <div style={{
          position:  'absolute',
          bottom:    `${8 * PX + 18}px`,
          left:      '50%',
          transform: 'translateX(-50%)',
          background: darkMode ? '#2a1f38' : '#ffffff',
          color:      darkMode ? '#f0e0ff' : '#1a0a2a',
          borderRadius: 10,
          padding:   '5px 9px',
          fontSize:  9,
          whiteSpace: 'nowrap',
          boxShadow: `0 2px 10px rgba(0,0,0,0.22)`,
          border:    `1px solid ${color}55`,
          zIndex:    30,
          lineHeight: 1.5,
        }}>
          {bubble}
          {/* Tail */}
          <div style={{
            position:    'absolute',
            top:         '100%',
            left:        '50%',
            transform:   'translateX(-50%)',
            borderLeft:  '5px solid transparent',
            borderRight: '5px solid transparent',
            borderTop:   `5px solid ${darkMode ? '#2a1f38' : '#ffffff'}`,
          }} />
        </div>
      )}

      {/* Ghost sprite — flipped per direction */}
      <div style={{
        transform: `scaleX(${facing})`,
        filter:    `drop-shadow(0 2px 6px ${color}88)`,
      }}>
        <svg
          width={9 * PX}
          height={8 * PX}
          style={{ imageRendering: 'pixelated', display: 'block' }}
        >
          {BODY.map((row, y) =>
            row.map((cell, x) => {
              if (!cell) return null
              const k = `${y}-${x}`
              const isEye   = EYE_PIXELS.has(k)
              const isShine = y === 2 && (x === 3 || x === 4)
              return (
                <rect
                  key={k}
                  x={x * PX} y={y * PX}
                  width={PX} height={PX}
                  fill={isEye ? eyeColor : isShine ? shimmer : color}
                />
              )
            })
          )}
        </svg>
      </div>

      {/* Name label */}
      <div style={{
        textAlign:  'center',
        marginTop:  2,
        fontSize:   8,
        fontWeight: 700,
        color,
        letterSpacing: '0.04em',
        textShadow: darkMode
          ? '0 1px 3px rgba(0,0,0,0.9)'
          : '0 1px 3px rgba(255,255,255,0.95)',
      }}>
        {name}
      </div>
    </div>
  )
}
