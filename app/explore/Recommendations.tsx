'use client'

import { useState } from 'react'

type Category = 'TV Shows' | 'Movies' | 'Music' | 'Books'
type Phase = 'category' | 'prefs' | 'loading' | 'results'

interface RecItem { title: string; emoji: string; reason: string }

const CATEGORIES: { id: Category; emoji: string; desc: string }[] = [
  { id: 'TV Shows', emoji: '📺', desc: 'Series to binge together'    },
  { id: 'Movies',   emoji: '🎬', desc: 'Perfect for movie night'     },
  { id: 'Music',    emoji: '🎵', desc: 'Albums & artists to discover' },
  { id: 'Books',    emoji: '📚', desc: 'Something to read & discuss'  },
]

const GENRE_OPTIONS: Record<Category, string[]> = {
  'TV Shows': ['Drama', 'Comedy', 'Sci-Fi', 'Thriller', 'Romance', 'Documentary', 'Fantasy', 'Crime'],
  'Movies':   ['Drama', 'Comedy', 'Action', 'Romance', 'Horror', 'Sci-Fi', 'Animation', 'Documentary'],
  'Music':    ['Indie', 'Pop', 'Hip-Hop', 'R&B', 'Jazz', 'Electronic', 'Folk', 'Classical'],
  'Books':    ['Fiction', 'Non-Fiction', 'Romance', 'Mystery', 'Sci-Fi', 'Fantasy', 'Self-Help', 'Biography'],
}

interface Props {
  locationName: string
  locationColor: string
  darkMode: boolean
  onClose: () => void
}

export default function Recommendations({ locationName, locationColor, darkMode, onClose }: Props) {
  const [phase, setPhase]               = useState<Phase>('category')
  const [category, setCategory]         = useState<Category | null>(null)
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [freeText, setFreeText]         = useState('')
  const [results, setResults]           = useState<RecItem[]>([])
  const [error, setError]               = useState<string | null>(null)

  const bg     = darkMode ? '#0d0d1a' : '#f8f4ff'
  const cardBg = darkMode ? '#14102a' : '#ffffff'
  const text   = darkMode ? '#e8e0ff' : '#1a0a2a'
  const sub    = darkMode ? '#8070a0' : '#6050a0'
  const chipOff = darkMode ? '#201830' : '#f0ebfa'
  const chipOffBorder = darkMode ? '#3a2850' : '#d0c8e8'

  const toggleGenre = (g: string) =>
    setSelectedGenres(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g])

  const canSubmit = selectedGenres.length > 0 || freeText.trim().length > 0

  const handleGetRecs = async () => {
    if (!category) return
    setPhase('loading')
    setError(null)
    try {
      const res = await fetch('/api/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, genres: selectedGenres, freeText, locationName }),
      })
      const data = await res.json()
      if (data.items?.length > 0) {
        setResults(data.items)
        setPhase('results')
      } else {
        setError('Something went wrong — try again?')
        setPhase('prefs')
      }
    } catch {
      setError('Connection error — try again?')
      setPhase('prefs')
    }
  }

  const resetToPrefs = () => { setResults([]); setPhase('prefs') }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: bg,
          borderRadius: '20px 20px 0 0',
          maxHeight: '88vh', overflowY: 'auto',
          padding: '20px 20px 44px',
        }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: text }}>✨ Recommendations</p>
            <p style={{ fontSize: 11, color: sub }}>{locationName}</p>
          </div>
          <button onClick={onClose} style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', color: sub, padding: '0 2px' }}>✕</button>
        </div>

        {/* Phase: category picker */}
        {phase === 'category' && (
          <>
            <p style={{ fontSize: 13, color: sub, marginBottom: 16 }}>What are you in the mood to discover?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CATEGORIES.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setCategory(c.id); setSelectedGenres([]); setFreeText(''); setPhase('prefs') }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 14,
                    background: cardBg, border: `1.5px solid ${locationColor}44`,
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                  }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{c.emoji}</span>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: text, margin: 0 }}>{c.id}</p>
                    <p style={{ fontSize: 11, color: sub, margin: 0 }}>{c.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Phase: preferences */}
        {phase === 'prefs' && category && (
          <>
            <button
              onClick={() => setPhase('category')}
              style={{ fontSize: 11, color: sub, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 14, padding: 0 }}>
              ← Back
            </button>
            <p style={{ fontSize: 15, fontWeight: 700, color: text, marginBottom: 2 }}>
              {CATEGORIES.find(c => c.id === category)?.emoji} {category}
            </p>
            <p style={{ fontSize: 12, color: sub, marginBottom: 14 }}>Pick some genres:</p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
              {GENRE_OPTIONS[category].map(g => {
                const active = selectedGenres.includes(g)
                return (
                  <button key={g} onClick={() => toggleGenre(g)} style={{
                    padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    background: active ? locationColor : chipOff,
                    color: active ? 'white' : text,
                    border: `1.5px solid ${active ? locationColor : chipOffBorder}`,
                    cursor: 'pointer',
                  }}>
                    {g}
                  </button>
                )
              })}
            </div>

            <p style={{ fontSize: 12, color: sub, marginBottom: 8 }}>Anything you&apos;ve loved lately? <span style={{ opacity: 0.6 }}>(optional)</span></p>
            <textarea
              value={freeText}
              onChange={e => setFreeText(e.target.value)}
              placeholder={category === 'TV Shows' ? 'e.g. "We loved Severance and The Bear..."'
                : category === 'Movies' ? 'e.g. "Loved Past Lives, anything Ghibli..."'
                : category === 'Music' ? 'e.g. "Into Phoebe Bridgers, Khruangbin lately..."'
                : 'e.g. "Loved Tomorrow, and Tomorrow, and Tomorrow..."'}
              rows={3}
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 12, boxSizing: 'border-box',
                background: cardBg, border: `1px solid ${chipOffBorder}`,
                color: text, fontSize: 12, resize: 'none', fontFamily: 'inherit',
              }}
            />

            {error && <p style={{ fontSize: 12, color: '#e06060', marginTop: 8 }}>{error}</p>}

            <button
              onClick={handleGetRecs}
              disabled={!canSubmit}
              style={{
                marginTop: 16, width: '100%', padding: '13px',
                borderRadius: 14, fontSize: 14, fontWeight: 700,
                background: locationColor, color: 'white',
                border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.45,
              }}>
              ✨ Get Recommendations
            </button>
          </>
        )}

        {/* Phase: loading */}
        {phase === 'loading' && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ fontSize: 32, marginBottom: 14 }}>✨</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: text }}>Finding the perfect picks…</p>
            <p style={{ fontSize: 11, color: sub, marginTop: 6 }}>Thinking about what you&apos;ll love together</p>
          </div>
        )}

        {/* Phase: results */}
        {phase === 'results' && (
          <>
            <p style={{ fontSize: 12, color: sub, marginBottom: 14 }}>
              {CATEGORIES.find(c => c.id === category)?.emoji} {category}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {results.map((item, i) => (
                <div key={i} style={{
                  padding: '14px 16px', borderRadius: 14,
                  background: cardBg, border: `1.5px solid ${locationColor}44`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 26, flexShrink: 0 }}>{item.emoji}</span>
                    <p style={{ fontSize: 14, fontWeight: 700, color: text, margin: 0 }}>{item.title}</p>
                  </div>
                  <p style={{ fontSize: 12, color: sub, lineHeight: 1.65, margin: 0 }}>{item.reason}</p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={resetToPrefs} style={{
                flex: 1, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                background: chipOff, border: `1px solid ${chipOffBorder}`,
                color: text, cursor: 'pointer',
              }}>
                Try again
              </button>
              <button onClick={() => setPhase('category')} style={{
                flex: 1, padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                background: chipOff, border: `1px solid ${chipOffBorder}`,
                color: text, cursor: 'pointer',
              }}>
                New category
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
