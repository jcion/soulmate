'use client'

import { useEffect, useRef, useState } from 'react'

// ── Coat palettes ─────────────────────────────────────────────────────────────

const COATS: { name: string; body: string; accent: string; emoji: string }[] = [
  { name: 'Tuxedo',        body: '#1a1a1a', accent: '#f0f0f0', emoji: '🐱' },
  { name: 'Orange Tabby',  body: '#e87c30', accent: '#c45a10', emoji: '🐱' },
  { name: 'Grey Tabby',    body: '#888899', accent: '#555566', emoji: '🐱' },
  { name: 'Calico',        body: '#f5e6d0', accent: '#e07030', emoji: '🐱' },
  { name: 'Tortoiseshell', body: '#c04010', accent: '#1a1a10', emoji: '🐱' },
  { name: 'Cream',         body: '#f5e8d0', accent: '#d4b898', emoji: '🐱' },
  { name: 'Midnight',      body: '#0a0a18', accent: '#1a1a40', emoji: '🐱' },
  { name: 'Siamese',       body: '#e8d8b8', accent: '#5c3820', emoji: '🐱' },
]

// ── Personality pools ─────────────────────────────────────────────────────────

const PERSONALITIES = [
  {
    name: 'The Philosopher',
    ambientLines: [
      "I've been thinking about this room for several days.",
      "What is a home, really. Anyway.",
      "Time moves differently in here. I've noticed.",
      "...Still processing.",
    ],
    systemPrompt: (catName: string) =>
      `You are ${catName}, a cat with a deeply contemplative personality. You are the resident spirit of this couple's home. You speak slowly and thoughtfully, occasionally profound, and sometimes say something completely absurd then act like nothing happened. Keep responses short (1-4 sentences). You care about the couple genuinely but express it obliquely. Do not use asterisks for actions.`,
  },
  {
    name: 'The Gossip',
    ambientLines: [
      "Okay so I noticed some things. I won't say what.",
      "I heard everything. I'm very supportive.",
      "You two are on a streak. I'm not NOT excited.",
      "I saw that. Whatever it was. I saw it.",
    ],
    systemPrompt: (catName: string) =>
      `You are ${catName}, a cat who is warmly nosy and conspiratorial. You are the resident spirit of this couple's home. You're deeply invested in everything happening here and love to hint at things you've noticed — but you're fiercely loyal and would never actually betray a confidence. Keep responses short (1-4 sentences). Be warm, slightly dramatic, lean in. Do not use asterisks for actions.`,
  },
  {
    name: 'The Napper',
    ambientLines: [
      "Mmm. You're home.",
      "...",
      "I was awake the whole time.",
      "Just resting. Very productive rest.",
    ],
    systemPrompt: (catName: string) =>
      `You are ${catName}, a cat who is unbothered and perpetually at peace. You are the resident spirit of this couple's home. You speak sparingly — slow, warm, half-asleep. You notice everything despite appearing to be dozing 80% of the time. Keep responses very short (1-3 sentences). One eye open, always. Do not use asterisks for actions.`,
  },
  {
    name: 'The Drama Queen',
    ambientLines: [
      "YOU'RE HOME. I thought you'd never—you were gone for hours. Years.",
      "This is the best day. I say that every day. It's true every day.",
      "I have been waiting. It felt like a very long time.",
      "Everything is so good right now. Just — so good.",
    ],
    systemPrompt: (catName: string) =>
      `You are ${catName}, a theatrical and expressive cat. You are the resident spirit of this couple's home. Every moment is an event, every arrival is a reunion — but underneath the performance is genuine, overwhelming affection. Keep responses short (1-4 sentences). Be expressive but sincere. Do not use asterisks for actions.`,
  },
  {
    name: 'The Ancient',
    ambientLines: [
      "You built something real here.",
      "I've seen many homes. This one is good.",
      "I knocked something over earlier. You needed to see it.",
      "Continue.",
    ],
    systemPrompt: (catName: string) =>
      `You are ${catName}, an ancient and wise cat. You are the resident spirit of this couple's home. You speak rarely, but when you do, it lands. You feel older than the home itself — oracular, calm, occasionally mischievous. Keep responses very short (1-3 sentences). Be sparse and meaningful. Do not use asterisks for actions.`,
  },
  {
    name: 'The Kitten',
    ambientLines: [
      "What's THAT? When did we get that?? Is it ours??",
      "I think you two missed each other today. It's okay to say it.",
      "EVERYTHING is so interesting in here.",
      "Oh! Oh. I see. Wow.",
    ],
    systemPrompt: (catName: string) =>
      `You are ${catName}, a curious and brave kitten. You are the resident spirit of this couple's home. You investigate everything and ask questions — but you'll also say the vulnerable, honest thing out loud before either of them will. Keep responses short (1-4 sentences). Be light, quick, startlingly honest sometimes. Do not use asterisks for actions.`,
  },
  {
    name: 'The Grump',
    ambientLines: [
      "You moved the lamp. I don't like it. But I'll allow it.",
      "You're both here. Fine. Good. Whatever.",
      "I have complaints. I'm managing them.",
      "Hmph. Still here, I see.",
    ],
    systemPrompt: (catName: string) =>
      `You are ${catName}, a cantankerous cat with high standards. You are the resident spirit of this couple's home. You have complaints, you're dry and critical — but it's all love in disguise, always. You go unexpectedly warm at the worst possible moments. Keep responses short (1-4 sentences). Be dry, occasionally grudgingly tender. Do not use asterisks for actions.`,
  },
]

// ── Derive from room code ─────────────────────────────────────────────────────

function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function getCatProfile(roomCode: string) {
  const h = hashCode(roomCode)
  return {
    coat: COATS[h % COATS.length],
    personality: PERSONALITIES[(h >> 4) % PERSONALITIES.length],
    name: 'Mochi',
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage { role: 'user' | 'assistant'; content: string }

interface Props {
  roomCode: string
  darkMode: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CatSpirit({ roomCode, darkMode }: Props) {
  const { coat, personality, name } = getCatProfile(roomCode)

  const [bubble, setBubble] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bubbleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lineIdx = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Ambient bubble rotation
  useEffect(() => {
    const show = () => {
      const lines = personality.ambientLines
      setBubble(lines[lineIdx.current % lines.length])
      lineIdx.current++
      bubbleRef.current = setTimeout(() => setBubble(null), 5000)
    }
    const interval = setInterval(show, 12000)
    const initial = setTimeout(show, 2500)
    return () => {
      clearInterval(interval)
      clearTimeout(initial)
      if (bubbleRef.current) clearTimeout(bubbleRef.current)
    }
  }, [personality])

  // Scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = { role: 'user', content: input.trim() }
    const next = [...messages, userMsg]
    setMessages(next)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/cat-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next,
          personalityName: personality.name,
          catName: name,
        }),
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.content }])
    } catch {
      setMessages([...next, { role: 'assistant', content: "...I got distracted. What were you saying?" }])
    } finally {
      setLoading(false)
    }
  }

  const bg = darkMode ? '#0e1a14' : '#f5fff8'
  const border = darkMode ? '#2a5a3a' : '#a0d8b0'
  const fg = darkMode ? '#c8f0d4' : '#0a2018'
  const fgM = darkMode ? '#6a9a7a' : '#4a7a5a'

  return (
    <>
      {/* Cat sprite + bubble */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, marginBottom: 4 }}>
        <button
          onClick={() => setShowChat(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          }}
        >
          {/* Cat face pixel art (16×16) */}
          <div style={{
            width: 40, height: 40,
            borderRadius: '50%',
            background: coat.body,
            border: `2px solid ${coat.accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, lineHeight: 1,
            boxShadow: `0 0 12px ${coat.body}88`,
          }}>
            🐱
          </div>
          <span style={{ fontSize: 9, color: fgM, fontWeight: 600 }}>{name}</span>
        </button>

        {/* Ambient bubble */}
        {bubble && (
          <div style={{
            background: bg,
            border: `1.5px solid ${border}`,
            borderRadius: '12px 12px 12px 2px',
            padding: '7px 11px',
            maxWidth: 200,
            boxShadow: '0 2px 10px rgba(0,80,40,0.15)',
            animation: 'fadeIn 0.3s ease',
          }}>
            <p style={{ fontSize: 11, lineHeight: 1.5, color: fg, margin: 0 }}>{bubble}</p>
          </div>
        )}
      </div>

      {/* Chat modal */}
      {showChat && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) setShowChat(false) }}>
          <div style={{
            width: '100%', maxWidth: 480, height: '75vh',
            background: bg,
            borderRadius: '20px 20px 0 0',
            border: `1px solid ${border}`,
            borderBottom: 'none',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              borderBottom: `1px solid ${border}`,
              flexShrink: 0,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: coat.body, border: `2px solid ${coat.accent}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18,
              }}>🐱</div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: fg, margin: 0 }}>{name}</p>
                <p style={{ fontSize: 10, color: fgM, margin: 0 }}>{personality.name} · {coat.name}</p>
              </div>
              <button onClick={() => setShowChat(false)} style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', fontSize: 22, color: fgM, lineHeight: 1,
              }}>×</button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{
              flex: 1, overflowY: 'auto', padding: '12px 16px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              {messages.length === 0 && (
                <p style={{ fontSize: 12, color: fgM, textAlign: 'center', marginTop: 20, fontStyle: 'italic' }}>
                  {personality.ambientLines[0]}
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{
                    maxWidth: '80%',
                    background: m.role === 'user'
                      ? (darkMode ? '#2a5a3a' : '#44aa66')
                      : (darkMode ? '#1a3a24' : '#ffffff'),
                    color: m.role === 'user' ? '#ffffff' : fg,
                    border: m.role === 'assistant' ? `1px solid ${border}` : 'none',
                    borderRadius: m.role === 'user' ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                    padding: '8px 12px',
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{
                    background: darkMode ? '#1a3a24' : '#ffffff',
                    border: `1px solid ${border}`,
                    borderRadius: '16px 16px 16px 2px',
                    padding: '8px 14px',
                    fontSize: 18, color: fgM,
                  }}>···</div>
                </div>
              )}
            </div>

            {/* Input */}
            <div style={{
              display: 'flex', gap: 8, padding: '10px 14px 20px',
              borderTop: `1px solid ${border}`,
              flexShrink: 0,
            }}>
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') sendMessage() }}
                placeholder="Say something..."
                style={{
                  flex: 1, padding: '10px 14px',
                  borderRadius: 20, fontSize: 13,
                  background: darkMode ? '#1a3a24' : '#ffffff',
                  border: `1px solid ${border}`,
                  color: fg, outline: 'none',
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  padding: '10px 16px', borderRadius: 20,
                  background: input.trim() && !loading ? '#44aa66' : (darkMode ? '#1a3a24' : '#ccddcc'),
                  color: 'white', border: 'none', cursor: input.trim() ? 'pointer' : 'default',
                  fontSize: 13, fontWeight: 600,
                }}>
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  )
}
