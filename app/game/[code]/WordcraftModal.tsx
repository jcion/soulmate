'use client'

import WordGame from './WordGame'

export default function WordcraftModal({
  onClose,
  darkMode,
  roomCode,
  myRole,
}: {
  onClose: () => void
  darkMode: boolean
  roomCode: string
  myRole: 'a' | 'b'
}) {
  const bg   = darkMode ? '#0e1a10' : '#f0faf2'
  const fg   = darkMode ? '#c8f0cc' : '#0a2010'
  const fgM  = darkMode ? '#6a9a6e' : '#4a7050'
  const border = darkMode ? '#2a4a2c' : '#b0d8b8'

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          width: '100%', maxWidth: 480, height: '96vh',
          background: bg,
          borderRadius: '20px 20px 0 0',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          border: `1px solid ${border}`,
          borderBottom: 'none',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 10px',
          borderBottom: `1px solid ${border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 15, fontWeight: 'bold', color: fg }}>🔤 Wordcraft</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: fgM, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <WordGame
          roomCode={roomCode}
          myRole={myRole}
          darkMode={darkMode}
          onClose={onClose}
        />
      </div>
    </div>
  )
}
