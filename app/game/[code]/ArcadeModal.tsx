'use client'

import { useState, useEffect, useRef } from 'react'
import Pacman from '../../explore/Pacman'
import SpaceInvaders from './SpaceInvaders'
import PacmanMP from './PacmanMP'
import { supabase } from '@/lib/supabase'

interface Props {
  darkMode: boolean
  onClose: () => void
  roomCode: string
  myRole: 'a' | 'b'
  initialGame?: 'select' | 'pacman-lobby'
}

type GameScreen = 'select' | 'pacman-lobby' | 'pacman-mp' | 'pacman-solo' | 'invaders'
type MpRole = 'host' | 'p1' | 'p2'

interface PresenceState {
  deviceId: string
  role: MpRole | null
}

export default function ArcadeModal({ darkMode, onClose, roomCode, myRole, initialGame }: Props) {
  const [game, setGame] = useState<GameScreen>(initialGame ?? 'select')
  const [mpRole, setMpRole] = useState<MpRole | null>(null)
  const [lobbyPresence, setLobbyPresence] = useState<Record<string, PresenceState>>({})
  const [myDeviceId] = useState<string>(() => {
    if (typeof window === 'undefined') return Math.random().toString(36).slice(2)
    return localStorage.getItem('soulmate_token') || Math.random().toString(36).slice(2)
  })
  const [myLobbyRole, setMyLobbyRole] = useState<MpRole | null>(null)
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const myLobbyRoleRef = useRef<MpRole | null>(null)

  // Keep ref in sync
  useEffect(() => {
    myLobbyRoleRef.current = myLobbyRole
  }, [myLobbyRole])

  // ── Lobby presence setup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (game !== 'pacman-lobby') return
    if (roomCode === 'demo') return

    const ch = supabase.channel(`lobby:pacman:${roomCode}`, {
      config: { presence: { key: myDeviceId } },
    })
    chRef.current = ch

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PresenceState>()
      const flat: Record<string, PresenceState> = {}
      for (const [key, presences] of Object.entries(state)) {
        // Each key maps to array of presence objects; take last
        const arr = presences as PresenceState[]
        if (arr.length > 0) flat[key] = arr[arr.length - 1]
      }
      setLobbyPresence(flat)
    })

    ch.on('broadcast', { event: 'lobby' }, ({ payload }: { payload: any }) => {
      if (payload.type === 'start') {
        const role = myLobbyRoleRef.current
        if (role && role !== 'host') {
          setMpRole(role)
          setGame('pacman-mp')
        }
      }
    })

    ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await ch.track({ deviceId: myDeviceId, role: null })
      }
    })

    return () => {
      supabase.removeChannel(ch)
      chRef.current = null
    }
  }, [game, roomCode, myDeviceId])

  // ── Claim a lobby role ─────────────────────────────────────────────────────────
  const claimRole = async (role: MpRole) => {
    // Check if already taken by someone else
    const takenBy = Object.entries(lobbyPresence).find(([id, p]) => p.role === role && id !== myDeviceId)
    if (takenBy) return // already taken

    setMyLobbyRole(role)
    myLobbyRoleRef.current = role
    const ch = chRef.current
    if (ch) {
      await ch.track({ deviceId: myDeviceId, role })
    }
  }

  const releaseRole = async () => {
    setMyLobbyRole(null)
    myLobbyRoleRef.current = null
    const ch = chRef.current
    if (ch) {
      await ch.track({ deviceId: myDeviceId, role: null })
    }
  }

  // ── Start game (host only) ─────────────────────────────────────────────────────
  const startGame = async () => {
    const ch = chRef.current
    if (ch) {
      await ch.send({
        type: 'broadcast',
        event: 'lobby',
        payload: { type: 'start' },
      })
    }
    setMpRole('host')
    setGame('pacman-mp')
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function getRoleHolder(role: MpRole): string | null {
    const entry = Object.entries(lobbyPresence).find(([, p]) => p.role === role)
    if (!entry) return null
    const [id] = entry
    if (id === myDeviceId) return 'You'
    return `Player ${id.slice(0, 6).toUpperCase()}`
  }

  function isRoleTaken(role: MpRole): boolean {
    return Object.entries(lobbyPresence).some(([id, p]) => p.role === role && id !== myDeviceId)
  }

  const hasAnyPlayer = getRoleHolder('p1') !== null || getRoleHolder('p2') !== null
  const iAmHost = myLobbyRole === 'host'

  // ── Route to screens ──────────────────────────────────────────────────────────

  if (game === 'pacman-solo') {
    return (
      <Pacman
        darkMode={darkMode}
        locationName="Home Arcade"
        locationColor="#8844cc"
        onClose={() => setGame('select')}
      />
    )
  }

  if (game === 'pacman-mp' && mpRole) {
    return (
      <PacmanMP
        roomCode={roomCode}
        mpRole={mpRole}
        darkMode={darkMode}
        onClose={() => { setGame('select'); setMpRole(null); setMyLobbyRole(null) }}
      />
    )
  }

  if (game === 'invaders') {
    return (
      <SpaceInvaders
        darkMode={darkMode}
        onClose={() => setGame('select')}
      />
    )
  }

  // ── Lobby screen ───────────────────────────────────────────────────────────────
  if (game === 'pacman-lobby') {
    const roles: { role: MpRole; icon: string; label: string; sublabel: string; accentColor: string }[] = [
      { role: 'host', icon: '🖥️', label: 'HOST', sublabel: 'Runs the game loop', accentColor: '#aaddff' },
      { role: 'p1',   icon: '🟣', label: 'PLAYER 1', sublabel: 'Purple · WASD / Arrows', accentColor: '#cc88ff' },
      { role: 'p2',   icon: '🩷', label: 'PLAYER 2', sublabel: 'Pink · IJKL on phone', accentColor: '#ff88cc' },
    ]

    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: '#050010',
        backgroundImage: `radial-gradient(ellipse at 20% 30%, #0d0025 0%, transparent 60%),
          radial-gradient(ellipse at 80% 70%, #050020 0%, transparent 60%)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        padding: '24px 16px',
      }}>
        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          .arcade-blink { animation: blink 1.2s step-start infinite }
          @keyframes glow-pulse {
            0%,100% { text-shadow: 0 0 8px #9933ff, 0 0 20px #6611cc, 0 0 40px #440099; }
            50% { text-shadow: 0 0 12px #bb55ff, 0 0 30px #9922ee, 0 0 60px #6611aa; }
          }
          .arcade-title { animation: glow-pulse 2s ease-in-out infinite; }
        `}</style>

        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'fixed', top: 16, right: 20,
            background: 'transparent', border: '1px solid #444', color: '#aaa',
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: 16, zIndex: 10,
            transition: 'color 0.2s, border-color 0.2s',
          }}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#fff'; (e.target as HTMLButtonElement).style.borderColor = '#888' }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#aaa'; (e.target as HTMLButtonElement).style.borderColor = '#444' }}
        >✕</button>

        <div style={{
          width: '100%',
          maxWidth: 440,
          background: 'linear-gradient(180deg, #0a0020 0%, #050015 100%)',
          border: '2px solid #6622aa',
          borderRadius: 16,
          boxShadow: '0 0 30px #6622aa66, 0 0 60px #44009944, inset 0 0 40px rgba(0,0,0,0.8)',
          padding: '28px 24px 32px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Scanlines */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
            pointerEvents: 'none', borderRadius: 14, zIndex: 1,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div className="arcade-title" style={{
                fontSize: 26, fontWeight: 900, fontFamily: 'monospace', color: '#ffcc00',
                letterSpacing: '0.1em', textShadow: '0 0 8px #ffcc0066, 0 0 20px #cc880044',
              }}>🕹️ PAC-MAN MULTIPLAYER</div>
              <div className="arcade-blink" style={{
                fontSize: 11, fontFamily: 'monospace', color: '#886600',
                letterSpacing: '0.2em', marginTop: 4,
              }}>— CLAIM YOUR ROLE —</div>
            </div>

            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #ffcc0055, transparent)', margin: '14px 0' }} />

            {/* Role cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {roles.map(({ role, icon, label, sublabel, accentColor }) => {
                const holder = getRoleHolder(role)
                const taken = isRoleTaken(role)
                const isMe = myLobbyRole === role
                const isEmpty = holder === null

                return (
                  <div
                    key={role}
                    style={{
                      background: isMe ? `${accentColor}18` : '#0a001a',
                      border: `2px solid ${isMe ? accentColor : taken ? accentColor + '55' : '#2a1a4e'}`,
                      borderRadius: 10,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      boxShadow: isMe ? `0 0 12px ${accentColor}44` : 'none',
                      transition: 'border 0.2s, background 0.2s, box-shadow 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
                      <div>
                        <div style={{
                          fontFamily: 'monospace', fontWeight: 900, fontSize: 13,
                          color: isMe ? accentColor : taken ? accentColor + 'aa' : '#ccbbdd',
                          letterSpacing: '0.06em',
                        }}>{label}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#554466', marginTop: 2 }}>
                          {sublabel}
                        </div>
                      </div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {isMe ? (
                        <button
                          onClick={releaseRole}
                          style={{
                            background: 'transparent',
                            border: `1px solid ${accentColor}66`,
                            color: accentColor,
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >LEAVE</button>
                      ) : taken ? (
                        <span style={{
                          fontFamily: 'monospace', fontSize: 11, color: accentColor + 'aa',
                          background: `${accentColor}18`, borderRadius: 6, padding: '4px 10px',
                        }}>{holder}</span>
                      ) : (
                        <button
                          onClick={() => claimRole(role)}
                          style={{
                            background: `${accentColor}22`,
                            border: `1px solid ${accentColor}66`,
                            color: accentColor,
                            borderRadius: 6,
                            padding: '4px 10px',
                            fontFamily: 'monospace',
                            fontSize: 11,
                            cursor: 'pointer',
                            fontWeight: 700,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}44` }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}22` }}
                        >JOIN</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, #6622aa, transparent)', margin: '16px 0' }} />

            {/* Start button (host only) */}
            {iAmHost && (
              <button
                onClick={startGame}
                disabled={!hasAnyPlayer}
                style={{
                  width: '100%',
                  background: hasAnyPlayer ? '#ffcc00' : '#332200',
                  color: hasAnyPlayer ? '#1a1000' : '#886600',
                  border: 'none',
                  borderRadius: 10,
                  padding: '12px',
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  fontSize: 15,
                  cursor: hasAnyPlayer ? 'pointer' : 'not-allowed',
                  letterSpacing: '0.1em',
                  boxShadow: hasAnyPlayer ? '0 0 16px #ffcc0044' : 'none',
                  transition: 'background 0.2s, box-shadow 0.2s',
                  marginBottom: 10,
                }}
                onMouseEnter={e => { if (hasAnyPlayer) (e.currentTarget as HTMLButtonElement).style.background = '#ffe044' }}
                onMouseLeave={e => { if (hasAnyPlayer) (e.currentTarget as HTMLButtonElement).style.background = '#ffcc00' }}
              >
                ▶ START GAME
              </button>
            )}
            {!iAmHost && myLobbyRole && (
              <div style={{
                textAlign: 'center', fontFamily: 'monospace', fontSize: 12, color: '#8866aa',
                marginBottom: 10,
              }} className="arcade-blink">
                Waiting for HOST to start...
              </div>
            )}

            {/* Solo + Back */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setGame('pacman-solo')}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #4422aa',
                  color: '#9966cc',
                  borderRadius: 8,
                  padding: '9px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#8844cc'; (e.currentTarget as HTMLButtonElement).style.color = '#cc99ff' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#4422aa'; (e.currentTarget as HTMLButtonElement).style.color = '#9966cc' }}
              >🕹️ Play Solo</button>
              <button
                onClick={() => { setGame('select'); setMyLobbyRole(null) }}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #333',
                  color: '#666',
                  borderRadius: 8,
                  padding: '9px',
                  fontFamily: 'monospace',
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#666'; (e.currentTarget as HTMLButtonElement).style.color = '#aaa' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#333'; (e.currentTarget as HTMLButtonElement).style.color = '#666' }}
              >← Back</button>
            </div>

          </div>
        </div>
      </div>
    )
  }

  // ── Game select screen ─────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: '#050010',
      backgroundImage: `radial-gradient(ellipse at 20% 30%, #0d0025 0%, transparent 60%),
        radial-gradient(ellipse at 80% 70%, #050020 0%, transparent 60%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      overflowY: 'auto',
      padding: '24px 16px',
    }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .arcade-blink { animation: blink 1.2s step-start infinite }
        @keyframes scan { 0%{top:0} 100%{top:100%} }
        @keyframes glow-pulse {
          0%,100% { text-shadow: 0 0 8px #9933ff, 0 0 20px #6611cc, 0 0 40px #440099; }
          50% { text-shadow: 0 0 12px #bb55ff, 0 0 30px #9922ee, 0 0 60px #6611aa; }
        }
        .arcade-title { animation: glow-pulse 2s ease-in-out infinite; }
        @keyframes card-hover {
          0%,100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
      `}</style>

      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 16,
          right: 20,
          background: 'transparent',
          border: '1px solid #444',
          color: '#aaa',
          borderRadius: 8,
          padding: '5px 12px',
          cursor: 'pointer',
          fontSize: 16,
          zIndex: 10,
          transition: 'color 0.2s, border-color 0.2s',
        }}
        onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = '#fff'; (e.target as HTMLButtonElement).style.borderColor = '#888' }}
        onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = '#aaa'; (e.target as HTMLButtonElement).style.borderColor = '#444' }}
      >✕</button>

      {/* CRT screen card */}
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: 'linear-gradient(180deg, #0a0020 0%, #050015 100%)',
        border: '2px solid #6622aa',
        borderRadius: 16,
        boxShadow: '0 0 30px #6622aa66, 0 0 60px #44009944, inset 0 0 40px rgba(0,0,0,0.8)',
        padding: '28px 24px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Scanline overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
          pointerEvents: 'none',
          borderRadius: 14,
          zIndex: 1,
        }} />

        {/* Static star dots */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.3) 0%, transparent 100%),
            radial-gradient(1px 1px at 85% 22%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 45% 8%, rgba(255,255,255,0.25) 0%, transparent 100%),
            radial-gradient(1px 1px at 72% 90%, rgba(255,255,255,0.2) 0%, transparent 100%),
            radial-gradient(1px 1px at 28% 85%, rgba(255,255,255,0.15) 0%, transparent 100%),
            radial-gradient(1px 1px at 60% 50%, rgba(255,255,255,0.1) 0%, transparent 100%)`,
          pointerEvents: 'none',
          borderRadius: 14,
          zIndex: 0,
        }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 6 }}>
            <div
              className="arcade-title"
              style={{
                fontSize: 36,
                fontWeight: 900,
                fontFamily: 'monospace',
                color: '#cc88ff',
                letterSpacing: '0.12em',
                textShadow: '0 0 8px #9933ff, 0 0 20px #6611cc, 0 0 40px #440099',
              }}
            >
              🕹️ ARCADE
            </div>
            <div
              className="arcade-blink"
              style={{
                fontSize: 13,
                fontFamily: 'monospace',
                color: '#8866aa',
                letterSpacing: '0.25em',
                marginTop: 6,
              }}
            >
              — SELECT GAME —
            </div>
          </div>

          {/* Divider */}
          <div style={{
            height: 1,
            background: 'linear-gradient(90deg, transparent, #6622aa, transparent)',
            margin: '16px 0',
          }} />

          {/* Game cards */}
          <div style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {/* Pac-Man card → goes to lobby */}
            <div
              onClick={() => setGame(roomCode === 'demo' ? 'pacman-solo' : 'pacman-lobby')}
              style={{
                flex: '1 1 180px',
                minWidth: 170,
                background: '#1a1000',
                border: '2px solid #ffcc00',
                borderRadius: 12,
                padding: '20px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 0 12px #ffcc0033, inset 0 0 20px rgba(0,0,0,0.5)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 0 24px #ffcc0066, inset 0 0 20px rgba(0,0,0,0.5)'
                el.style.transform = 'translateY(-3px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 0 12px #ffcc0033, inset 0 0 20px rgba(0,0,0,0.5)'
                el.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>🟡</div>
              <div style={{
                color: '#ffcc00',
                fontFamily: 'monospace',
                fontWeight: 900,
                fontSize: 18,
                letterSpacing: '0.08em',
                textShadow: '0 0 8px #ffcc0066',
              }}>PAC-MAN</div>
              <div style={{
                color: '#886600',
                fontSize: 11,
                fontFamily: 'monospace',
                marginTop: 6,
                marginBottom: 16,
                lineHeight: 1.5,
              }}>
                2 Players · Collect dots<br />Eat ghosts
              </div>
              <button
                style={{
                  background: '#ffcc00',
                  color: '#1a1000',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                  width: '100%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#ffe044' }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#ffcc00' }}
                onClick={e => { e.stopPropagation(); setGame(roomCode === 'demo' ? 'pacman-solo' : 'pacman-lobby') }}
              >▶ PLAY</button>
            </div>

            {/* Space Invaders card */}
            <div
              onClick={() => setGame('invaders')}
              style={{
                flex: '1 1 180px',
                minWidth: 170,
                background: '#001a00',
                border: '2px solid #00ff88',
                borderRadius: 12,
                padding: '20px 16px',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: '0 0 12px #00ff8833, inset 0 0 20px rgba(0,0,0,0.5)',
                transition: 'box-shadow 0.2s, transform 0.2s',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 0 24px #00ff8866, inset 0 0 20px rgba(0,0,0,0.5)'
                el.style.transform = 'translateY(-3px)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement
                el.style.boxShadow = '0 0 12px #00ff8833, inset 0 0 20px rgba(0,0,0,0.5)'
                el.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ fontSize: 40, marginBottom: 8 }}>👾</div>
              <div style={{
                color: '#00ff88',
                fontFamily: 'monospace',
                fontWeight: 900,
                fontSize: 15,
                letterSpacing: '0.06em',
                textShadow: '0 0 8px #00ff8866',
              }}>SPACE INVADERS</div>
              <div style={{
                color: '#007744',
                fontSize: 11,
                fontFamily: 'monospace',
                marginTop: 6,
                marginBottom: 16,
                lineHeight: 1.5,
              }}>
                2 Players · Defend Earth<br />Shoot aliens
              </div>
              <button
                style={{
                  background: '#00ff88',
                  color: '#001a00',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontFamily: 'monospace',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  letterSpacing: '0.08em',
                  width: '100%',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#44ffaa' }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#00ff88' }}
                onClick={e => { e.stopPropagation(); setGame('invaders') }}
              >▶ PLAY</button>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center',
            marginTop: 20,
            color: '#44225a',
            fontSize: 10,
            fontFamily: 'monospace',
            letterSpacing: '0.15em',
          }}>
            INSERT COIN TO CONTINUE
          </div>
        </div>
      </div>
    </div>
  )
}
