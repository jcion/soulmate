'use client'

import { useEffect, useState } from 'react'

const BMO_LINES = [
  "YOU GOT IT!! I KNEW you would!! 🎉",
  "It is time to PLAY. I have been waiting.",
  "Day streak! This is the longest relationship I've ever witnessed. 💕",
  "Wrong answer. That's okay. That's growth. Also — WRONG ANSWER.",
  "I am BMO. I run on friendship and also electricity.",
  "Let's GOOO!! We can do this!! Together!! 🎮",
  "I believe in you both with my whole little screen.",
  "High score incoming. I can feel it. 📈",
  "Every puzzle solved makes me SO happy!!",
  "We're doing great. I include myself in this. I helped by watching.",
]

interface Props {
  darkMode: boolean
}

// 8×10 pixel BMO body
const PIXELS = [
  [0,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1],
  [1,1,2,2,2,2,1,1],
  [1,1,2,3,3,2,1,1],
  [1,1,2,2,3,2,1,1],
  [1,1,2,2,2,2,1,1],
  [1,1,4,1,1,4,1,1],
  [1,1,1,4,4,1,1,1],
  [0,1,1,1,1,1,1,0],
  [0,0,1,0,0,1,0,0],
]
const C: Record<number, string> = {
  1: '#4fc3c3', 2: '#1a2a2a', 3: '#e0e0f0', 4: '#ff6688',
}
const PX = 5

export default function BMO({ darkMode }: Props) {
  const [lineIdx, setLineIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const cycle = () => {
      setVisible(false)
      setTimeout(() => {
        setLineIdx(i => (i + 1) % BMO_LINES.length)
        setVisible(true)
      }, 400)
    }
    const interval = setInterval(cycle, 8000)
    return () => clearInterval(interval)
  }, [])

  const bg = darkMode ? '#0a1a1a' : '#e8f8f8'
  const border = darkMode ? '#1a4a4a' : '#88cccc'
  const fg = darkMode ? '#c0f0f0' : '#0a2020'
  const fgM = darkMode ? '#4a8a8a' : '#4a8888'

  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 16,
      padding: '12px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      {/* BMO sprite */}
      <div style={{ flexShrink: 0 }}>
        <svg width={8 * PX} height={10 * PX} style={{ imageRendering: 'pixelated' }}>
          {PIXELS.map((row, ry) =>
            row.map((col, rx) => col === 0 ? null : (
              <rect key={`${ry}-${rx}`}
                x={rx * PX} y={ry * PX} width={PX} height={PX}
                fill={C[col]} />
            ))
          )}
        </svg>
      </div>

      {/* Line */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 10, fontWeight: 700, color: '#4fc3c3',
          marginBottom: 3, letterSpacing: 0.5,
        }}>BMO</p>
        <p style={{
          fontSize: 12, color: fg, lineHeight: 1.4, margin: 0,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
        }}>
          {BMO_LINES[lineIdx]}
        </p>
      </div>

      <p style={{ fontSize: 9, color: fgM, flexShrink: 0 }}>🎮</p>
    </div>
  )
}
