'use client'

import { useState } from 'react'

const PX = 4

// 10×14 pixel body. Colors: 0=transparent, 1=brown body, 2=green arms, 3=yellow spots, 4=dark eye
const BODY: number[][] = [
  [0,0,2,2,0,0,2,2,0,0],
  [0,2,2,2,0,0,2,2,2,0],
  [0,0,2,1,0,0,1,2,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,1,1,3,1,1,3,1,1,0],
  [0,1,4,1,1,1,1,4,1,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,0,1,1,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,1,1,1,1,1,1,0,0],
  [0,0,0,1,0,0,1,0,0,0],
  [0,0,1,1,0,0,1,1,0,0],
  [0,0,1,1,0,0,1,1,0,0],
]
const COLORS: Record<number, string> = {
  1: '#8B5E3C', 2: '#4db84d', 3: '#ffdd44', 4: '#2a1a0a',
}

const W = 10 * PX
const H = 14 * PX

interface TutorialScreen {
  text: string
  action?: string   // button label (default "Next →")
  highlight?: string  // optional visual hint text below
}

export const TUTORIAL_SCREENS: TutorialScreen[] = [
  {
    text: '...Oh! You startled me. I was just standing here. Being a tree. As trees do.\n\nWelcome to your farm. I\'m Sudowoodo. I am a tree.',
    action: 'Nice to meet you →',
  },
  {
    text: 'These 5 oak trees were here before you arrived. Very noble. Very treelike.\n\nTap one to collect its acorn. Fully grown oaks drop one every 6 hours.',
    action: 'Got it →',
    highlight: '👆 Tap any oak tree',
  },
  {
    text: 'You\'ve got 3 seeds. They\'re feeling restless.\n\nSelect a seed from your inventory, then tap an empty patch of soil to plant it.',
    action: 'Let\'s plant →',
    highlight: '🌱 Select a seed below',
  },
  {
    text: 'A planted seed is just... potential. Select the watering can 🪣, then tap your seed.\n\nCheck back in a couple of hours. I\'ll be here. Definitely not moving.',
    action: 'Water it →',
    highlight: '🪣 Use the watering can',
  },
  {
    text: 'You did it. You\'re a farmer now.\n\nTake these berry seeds — your first real crop. I\'ll stick around. In case you need... tree advice.',
    action: 'Start farming! 🌾',
  },
]

// Post-tutorial hint messages shown periodically
export const SUDOWOODO_HINTS = [
  'I have been standing here for several days. I am very good at being a tree.',
  'A truffle only grows in the shadow of a great oak. Just saying.',
  'Water your roses before the wilt window closes. They are dramatic.',
  'Blueberry bushes regrow. Very efficient. I respect that.',
  'Your partner visited today. I pretended not to notice.',
  'Chop a full oak for 4 wood. Controversial opinion: it is worth it.',
  'Mushrooms only grow near trees. We have something in common.',
  'Sunflowers wilt after 24 hours. Set a reminder. Do not be like me.',
]

interface Props {
  screen: number
  total: number
  onNext: () => void
  onSkip: () => void
  darkMode: boolean
}

export default function SudowoodoTutorial({ screen, total, onNext, onSkip, darkMode }: Props) {
  const s = TUTORIAL_SCREENS[screen]
  if (!s) return null

  const bg    = darkMode ? '#1a2a1a' : '#f0f8f0'
  const text  = darkMode ? '#e8f5e8' : '#1a2a1a'
  const sub   = darkMode ? '#6a9a6a' : '#4a7a4a'
  const cardBg = darkMode ? '#0d1a0d' : '#ffffff'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,20,0,0.75)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0 16px 32px',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: cardBg,
        borderRadius: 20,
        border: `2px solid ${darkMode ? '#2a4a2a' : '#90c890'}`,
        boxShadow: '0 -4px 40px rgba(0,80,0,0.3)',
        overflow: 'hidden',
      }}>
        {/* Header with Sudowoodo sprite */}
        <div style={{
          background: darkMode ? '#0d220d' : '#e8f5e8',
          padding: '16px 20px 12px',
          display: 'flex', alignItems: 'flex-end', gap: 16,
          borderBottom: `1px solid ${darkMode ? '#1a3a1a' : '#c8e8c8'}`,
        }}>
          {/* Pixel sprite */}
          <svg width={W} height={H} style={{ imageRendering: 'pixelated', flexShrink: 0 }}>
            {BODY.map((row, ry) =>
              row.map((col, rx) => col === 0 ? null : (
                <rect key={`${ry}-${rx}`}
                  x={rx * PX} y={ry * PX} width={PX} height={PX}
                  fill={COLORS[col]} />
              ))
            )}
          </svg>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: '#4db84d', marginBottom: 2 }}>
              Sudowoodo
            </p>
            <p style={{ fontSize: 10, color: sub, fontStyle: 'italic' }}>
              Definitely a tree
            </p>
          </div>
          {/* Progress dots */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{
                width: i === screen ? 10 : 6,
                height: i === screen ? 10 : 6,
                borderRadius: '50%',
                background: i === screen ? '#4db84d' : (darkMode ? '#2a4a2a' : '#c8e8c8'),
                transition: 'all 0.2s',
              }} />
            ))}
          </div>
        </div>

        {/* Speech text */}
        <div style={{ padding: '16px 20px' }}>
          <p style={{
            fontSize: 14, lineHeight: 1.65, color: text,
            whiteSpace: 'pre-line', minHeight: 80,
          }}>
            {s.text}
          </p>
          {s.highlight && (
            <p style={{
              fontSize: 11, color: '#4db84d', fontWeight: 600,
              marginTop: 10, padding: '6px 10px',
              background: darkMode ? '#0d220d' : '#e8f5e8',
              borderRadius: 8, textAlign: 'center',
            }}>
              {s.highlight}
            </p>
          )}
        </div>

        {/* Buttons */}
        <div style={{
          padding: '0 20px 20px',
          display: 'flex', gap: 10,
        }}>
          <button onClick={onSkip} style={{
            flex: 1, padding: '10px',
            borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: 'transparent',
            border: `1px solid ${darkMode ? '#2a4a2a' : '#c8e8c8'}`,
            color: sub, cursor: 'pointer',
          }}>
            Skip tutorial
          </button>
          <button onClick={onNext} style={{
            flex: 2, padding: '10px',
            borderRadius: 12, fontSize: 13, fontWeight: 700,
            background: '#4db84d', border: 'none',
            color: 'white', cursor: 'pointer',
            boxShadow: '0 2px 12px rgba(77,184,77,0.4)',
          }}>
            {s.action ?? 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Post-tutorial hint bubble ─────────────────────────────────────────────────
interface HintProps { hint: string | null; onDismiss: () => void; darkMode: boolean }
export function SudowoodoHint({ hint, onDismiss, darkMode }: HintProps) {
  return (
    <div
      onClick={hint ? onDismiss : undefined}
      style={{
        position: 'absolute', bottom: 8, left: 8,
        display: 'flex', alignItems: 'flex-end', gap: 8,
        zIndex: 30, cursor: hint ? 'pointer' : 'default',
      }}>
      <svg width={W * 0.7} height={H * 0.7} style={{ imageRendering: 'pixelated', flexShrink: 0 }}>
        {BODY.map((row, ry) =>
          row.map((col, rx) => col === 0 ? null : (
            <rect key={`${ry}-${rx}`}
              x={rx * PX * 0.7} y={ry * PX * 0.7} width={PX * 0.7} height={PX * 0.7}
              fill={COLORS[col]} />
          ))
        )}
      </svg>
      {hint && (
        <div style={{
          background: darkMode ? '#0d220d' : '#ffffff',
          border: `1.5px solid #4db84d`,
          borderRadius: '12px 12px 12px 0',
          padding: '8px 12px',
          maxWidth: 220,
          boxShadow: '0 2px 12px rgba(0,80,0,0.2)',
        }}>
          <p style={{ fontSize: 11, lineHeight: 1.5, color: darkMode ? '#e8f5e8' : '#1a2a1a', margin: 0 }}>
            {hint}
          </p>
          <p style={{ fontSize: 9, color: '#4db84d', marginTop: 4, textAlign: 'right' }}>
            tap to dismiss
          </p>
        </div>
      )}
    </div>
  )
}
