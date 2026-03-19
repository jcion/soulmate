'use client'

import { useEffect, useRef, useState } from 'react'
import { useVoiceChat, type Peer, type VoiceState } from '@/lib/useVoiceChat'

interface Props {
  channelKey:    string          // e.g. "williamsburg-aces_pizza"
  locationName:  string
  locationColor: string
  darkMode:      boolean
  myToken:       string
  myName:        string
}

// ── Push-to-talk button ───────────────────────────────────────────────────────

function PTTButton({ talking, color, onStart, onEnd }: {
  talking: boolean; color: string
  onStart: () => void; onEnd: () => void
}) {
  const [t, setT] = useState(0)
  const raf = useRef<number>(0)

  useEffect(() => {
    if (!talking) { cancelAnimationFrame(raf.current); return }
    let time = 0
    const step = () => { time += 0.055; setT(time); raf.current = requestAnimationFrame(step) }
    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [talking])

  const pulse = talking ? 1 + Math.sin(t) * 0.07 : 1
  const ring  = talking ? 1 + Math.sin(t * 0.5) * 0.25 : 1
  const glow  = talking ? `0 0 18px ${color}aa, 0 0 36px ${color}55` : 'none'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
      {/* Outer pulse ring */}
      {talking && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          width: 88, height: 88, borderRadius: '50%',
          transform: `translate(-50%, -50%) scale(${ring})`,
          border: `2px solid ${color}55`,
          opacity: 0.6 + Math.sin(t) * 0.3,
          pointerEvents: 'none',
        }} />
      )}

      <button
        onPointerDown={e => { e.preventDefault(); onStart() }}
        onPointerUp={onEnd}
        onPointerLeave={onEnd}
        onPointerCancel={onEnd}
        style={{
          width: 80, height: 80, borderRadius: '50%',
          background: talking
            ? `radial-gradient(circle at 35% 35%, ${color}, ${color}99)`
            : `radial-gradient(circle at 35% 35%, ${color}55, ${color}22)`,
          border: `2.5px solid ${talking ? color : color + '66'}`,
          boxShadow: glow,
          transform: `scale(${pulse})`,
          transition: talking ? 'none' : 'all 0.25s',
          cursor: 'pointer',
          fontSize: 30, lineHeight: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {talking ? '🔊' : '🎙️'}
      </button>

      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
        color: talking ? color : '#7060a0',
        textShadow: talking ? `0 0 8px ${color}88` : 'none',
        transition: 'color 0.2s',
      }}>
        {talking ? '● SPEAKING' : 'HOLD TO SPEAK'}
      </span>
    </div>
  )
}

// ── Status label helper ───────────────────────────────────────────────────────

function statusLabel(vs: VoiceState, peers: Peer[], activePeer: Peer | null): string {
  switch (vs) {
    case 'waiting':     return 'Waiting for someone...'
    case 'peer_here':   return `${peers.length} soul${peers.length !== 1 ? 's' : ''} here`
    case 'mic_pending': return 'Requesting microphone...'
    case 'connecting':  return `Connecting to ${activePeer?.name ?? 'peer'}...`
    case 'connected':   return `Connected with ${activePeer?.name ?? 'someone'}`
    case 'error':       return 'Connection error'
    default:            return ''
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VoiceChat({
  channelKey, locationName, locationColor, darkMode, myToken, myName,
}: Props) {
  const {
    vs, peers, activePeer, talking, peerTalking, errMsg,
    startCall, hangup, pttStart, pttEnd,
  } = useVoiceChat(channelKey, myToken, myName)

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted || vs === 'idle') return null

  // Colors
  const cardBg  = darkMode ? 'rgba(14,10,24,0.92)' : 'rgba(245,240,255,0.95)'
  const text    = darkMode ? '#f0e8ff' : '#1a0a2a'
  const sub     = darkMode ? '#7060a0' : '#7060a0'
  const bdr     = darkMode ? '#2a2040' : '#d0c8e8'

  return (
    <div style={{
      marginTop: 10,
      borderRadius: 14,
      border: `1px solid ${locationColor}44`,
      overflow: 'hidden',
      background: cardBg,
    }}>
      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 12px',
        background: locationColor + '1a',
        borderBottom: `1px solid ${locationColor}30`,
      }}>
        {/* Animated mic icon */}
        <span style={{
          fontSize: 12,
          filter: vs === 'connected' ? `drop-shadow(0 0 4px ${locationColor})` : 'none',
          transition: 'filter 0.3s',
        }}>🎙️</span>

        <span style={{ fontSize: 11, fontWeight: 700, color: text }}>Voice Chat</span>

        <span style={{ fontSize: 9, color: sub, marginLeft: 2 }}>
          {statusLabel(vs, peers, activePeer)}
        </span>

        {/* Peer-speaking indicator dot */}
        {peerTalking && (
          <div style={{
            marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%',
            background: locationColor,
            boxShadow: `0 0 6px ${locationColor}, 0 0 12px ${locationColor}88`,
            animation: 'none',
          }} />
        )}
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '12px' }}>

        {/* WAITING */}
        {vs === 'waiting' && (
          <p style={{ fontSize: 10, color: sub, textAlign: 'center', lineHeight: 1.6 }}>
            👻 No one else here yet.<br />
            Hang around and see who shows up!
          </p>
        )}

        {/* PEER HERE — list of souls + call button */}
        {vs === 'peer_here' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {peers.map(peer => (
              <div key={peer.token} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: locationColor + '14',
                borderRadius: 10, padding: '8px 10px',
                border: `1px solid ${locationColor}33`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>👻</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: text, lineHeight: 1 }}>{peer.name}</p>
                    <p style={{ fontSize: 9, color: sub, marginTop: 2 }}>is here · {locationName}</p>
                  </div>
                </div>
                <button onClick={() => startCall(peer)} style={{
                  fontSize: 11, padding: '5px 12px', borderRadius: 8, fontWeight: 700,
                  background: `linear-gradient(135deg, ${locationColor}cc, ${locationColor}88)`,
                  border: 'none', color: '#fff', cursor: 'pointer',
                  boxShadow: `0 2px 8px ${locationColor}55`,
                }}>📞 Call</button>
              </div>
            ))}
          </div>
        )}

        {/* MIC PENDING */}
        {vs === 'mic_pending' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎙️</div>
            <p style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 4 }}>
              Allow microphone access
            </p>
            <p style={{ fontSize: 10, color: sub, lineHeight: 1.5 }}>
              Your browser will ask for permission.<br />
              Tap &ldquo;Allow&rdquo; to start your voice chat.
            </p>
          </div>
        )}

        {/* CONNECTING */}
        {vs === 'connecting' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
            <p style={{ fontSize: 12, fontWeight: 700, color: text, marginBottom: 4 }}>
              Connecting to {activePeer?.name ?? 'peer'}...
            </p>
            <p style={{ fontSize: 9, color: sub }}>Establishing peer-to-peer audio</p>
          </div>
        )}

        {/* CONNECTED — PTT UI */}
        {vs === 'connected' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {/* Peer speaking label */}
            <div style={{
              height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {peerTalking && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  color: locationColor,
                  textShadow: `0 0 8px ${locationColor}88`,
                }}>
                  {activePeer?.name} is speaking...
                </span>
              )}
            </div>

            <PTTButton
              talking={talking}
              color={locationColor}
              onStart={pttStart}
              onEnd={pttEnd}
            />

            <p style={{ fontSize: 9, color: sub, textAlign: 'center', lineHeight: 1.5 }}>
              Hold the button to speak.<br />Release to mute.
            </p>

            <button onClick={hangup} style={{
              fontSize: 11, padding: '6px 18px', borderRadius: 10, fontWeight: 700,
              background: '#cc2233', border: 'none', color: '#fff',
              cursor: 'pointer', boxShadow: '0 2px 10px rgba(200,30,50,0.4)',
            }}>📵 End call</button>
          </div>
        )}

        {/* ERROR */}
        {vs === 'error' && (
          <div style={{ textAlign: 'center', padding: '6px 0' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>⚠️</div>
            <p style={{ fontSize: 11, color: '#ff7755', fontWeight: 600, marginBottom: 6 }}>
              {errMsg}
            </p>
            <p style={{ fontSize: 9, color: sub, lineHeight: 1.5 }}>
              Open your browser&apos;s site settings<br />and allow microphone access.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
