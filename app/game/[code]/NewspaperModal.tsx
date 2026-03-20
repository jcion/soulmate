'use client'

import { useEffect, useState } from 'react'

interface Article {
  title: string
  abstract: string
  url: string
  byline: string
  published: string
  image: string | null
}

interface NewsData {
  newYork: Article[]
  travel: Article[]
  food: Article[]
  toronto: Article[]
}

type Section = 'newYork' | 'travel' | 'food' | 'toronto'

const SECTIONS: { key: Section; label: string; emoji: string }[] = [
  { key: 'newYork', label: 'New York',      emoji: '🗽' },
  { key: 'travel',  label: 'Travel',        emoji: '✈️' },
  { key: 'food',    label: 'Food & Dining', emoji: '🍽️' },
  { key: 'toronto', label: 'Toronto',       emoji: '🍁' },
]

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function NewspaperModal({
  onClose,
  darkMode,
}: {
  onClose: () => void
  darkMode: boolean
}) {
  const [news, setNews] = useState<NewsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeSection, setActiveSection] = useState<Section>('newYork')
  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(data => { setNews(data); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const bg      = darkMode ? '#1a1208' : '#fdf6e3'
  const card    = darkMode ? '#2a1f10' : '#fff8e7'
  const border  = darkMode ? '#4a3820' : '#d4b896'
  const fg      = darkMode ? '#f0e0cc' : '#2a1a08'
  const fgMuted = darkMode ? '#a08060' : '#8a6a40'
  const accent  = darkMode ? '#c8a860' : '#8b4513'

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const articles = news?.[activeSection] ?? []

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%', maxWidth: 480,
          maxHeight: '92vh',
          background: bg,
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${border}`,
          borderBottom: 'none',
        }}
      >
        {/* Masthead */}
        <div style={{
          padding: '20px 20px 0',
          borderBottom: `2px solid ${accent}`,
          textAlign: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: fgMuted, fontStyle: 'italic' }}>Est. 2025</span>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 20, color: fgMuted, lineHeight: 1,
              }}
            >×</button>
          </div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: 26,
            fontWeight: 'bold',
            color: fg,
            letterSpacing: '-0.5px',
            lineHeight: 1.1,
            marginBottom: 4,
          }}>
            The Soulmate Times
          </h1>
          <p style={{ fontSize: 11, color: fgMuted, marginBottom: 12 }}>{today}</p>

          {/* Section tabs */}
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', paddingBottom: 0 }}>
            {SECTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  fontWeight: activeSection === s.key ? '700' : '400',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeSection === s.key ? `2px solid ${accent}` : '2px solid transparent',
                  color: activeSection === s.key ? accent : fgMuted,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  marginBottom: -2,
                }}
              >
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', paddingTop: 40, color: fgMuted, fontSize: 14 }}>
              Loading today&apos;s stories…
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', paddingTop: 40, color: fgMuted, fontSize: 14 }}>
              Couldn&apos;t fetch the news right now. Try again later.
            </div>
          )}

          {!loading && !error && articles.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 40, color: fgMuted, fontSize: 14 }}>
              No stories available right now.
            </div>
          )}

          {!loading && !error && articles.map((article, i) => (
            <div
              key={i}
              style={{
                borderBottom: `1px solid ${border}`,
                padding: i === 0 ? '12px 0 16px' : '14px 0',
              }}
            >
              <h2 style={{
                fontFamily: 'Georgia, serif',
                fontSize: i === 0 ? 18 : 15,
                fontWeight: 'bold',
                color: fg,
                lineHeight: 1.3,
                marginBottom: 4,
              }}>
                {article.title}
              </h2>

              {article.byline && (
                <p style={{ fontSize: 10, color: fgMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {article.byline}
                </p>
              )}

              {article.abstract && (
                <p style={{
                  fontSize: 13, color: fgMuted, lineHeight: 1.6,
                  marginBottom: 8,
                  fontFamily: 'Georgia, serif',
                }}>
                  {article.abstract}
                </p>
              )}

              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block',
                    fontSize: 11,
                    color: accent,
                    textDecoration: 'none',
                    borderBottom: `1px solid ${accent}`,
                    paddingBottom: 1,
                  }}
                >
                  Full story →
                </a>
              )}

              {article.published && (
                <p style={{ fontSize: 10, color: fgMuted, marginTop: 6 }}>
                  {formatDate(article.published)}
                </p>
              )}
            </div>
          ))}

          {/* Source attribution */}
          {!loading && !error && (
            <p style={{ fontSize: 10, color: fgMuted, textAlign: 'center', marginTop: 16, fontStyle: 'italic' }}>
              {activeSection === 'toronto'
                ? 'Stories from CBC Toronto'
                : 'Stories from The New York Times'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
