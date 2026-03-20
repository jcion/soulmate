'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getPuzzleByIndex, Word } from '@/lib/puzzles'
import Ghost from './Ghost'
import ArcadeModal from './ArcadeModal'
import NewspaperModal from './NewspaperModal'
import WordcraftModal from './WordcraftModal'
import FarmClient from './FarmClient'
import { SHOP_ITEMS, STARTER_LAYOUT, getItemDef as getItemDefLib, getHappiness } from '@/lib/items'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlacedItem {
  instanceId: string
  itemId: string
  x: number
  y: number
}

interface Room {
  id: string
  code: string
  player_a: string | null
  player_b: string | null
  puzzle_index: number
  answers: Record<string, string>
  status: string
  coins: number
  items: string[]
  placed_items: PlacedItem[]
  coins_awarded: boolean
}

const GRID_COLS = 8
const GRID_ROWS = 8

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function getOrCreateToken() {
  let token = localStorage.getItem('soulmate_token')
  if (!token) { token = makeUUID(); localStorage.setItem('soulmate_token', token) }
  return token
}

const getItemDef = getItemDefLib

type AnyPlaced = { itemId: string; x: number; y: number }

/** Returns the item (user-placed or starter) that occupies cell (x, y) */
function getOccupant(placedItems: PlacedItem[], x: number, y: number): AnyPlaced | undefined {
  const all: AnyPlaced[] = [...STARTER_LAYOUT, ...placedItems]
  return all.find(pi => {
    const def = getItemDef(pi.itemId)
    if (!def) return false
    return x >= pi.x && x < pi.x + def.w && y >= pi.y && y < pi.y + def.h
  })
}

function isStarter(item: AnyPlaced) {
  return STARTER_LAYOUT.some(s => s.itemId === item.itemId && s.x === item.x && s.y === item.y)
}

/** Returns true if placing itemId at (x, y) is valid (in bounds, no overlap) */
function canPlace(placedItems: PlacedItem[], itemId: string, x: number, y: number) {
  const def = getItemDef(itemId)
  if (!def) return false
  if (x + def.w > GRID_COLS || y + def.h > GRID_ROWS) return false
  for (let dx = 0; dx < def.w; dx++) {
    for (let dy = 0; dy < def.h; dy++) {
      if (getOccupant(placedItems, x + dx, y + dy)) return false
    }
  }
  return true
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GameClient({ code }: { code: string }) {
  const [room, setRoom] = useState<Room | null>(null)
  const [myToken, setMyToken] = useState('')
  const [myRole, setMyRole] = useState<'a' | 'b' | null>(null)
  const [inputs, setInputs] = useState<Record<number, string>>({})
  const [wrongIds, setWrongIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tab, setTab] = useState<'play' | 'home' | 'farm'>('play')
  const [showPuzzle, setShowPuzzle] = useState(false)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [showArcade,      setShowArcade]      = useState(false)
  const [arcadeInitial,   setArcadeInitial]   = useState<'select' | 'pacman-lobby'>('select')
  const [showNewspaper,   setShowNewspaper]   = useState(false)
  const [showWordcraft,   setShowWordcraft]   = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [infoItem, setInfoItem] = useState<string | null>(null)
  const [placeError, setPlaceError] = useState<string | null>(null)
  const initialized = useRef(false)

  // Load dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem('soulmate_dark')
    if (saved === 'true') setDarkMode(true)
  }, [])

  const toggleDark = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('soulmate_dark', String(next))
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id
      setMyToken(uid ?? getOrCreateToken())
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) setMyToken(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!myToken || initialized.current) return
    initialized.current = true

    const joinRoom = async () => {
      // Step 1: find the shared room
      let { data, error } = await supabase.from('rooms').select('*').eq('code', code).single()

      // Step 2: create it if it doesn't exist yet
      if (error || !data) {
        const { data: inserted, error: insertErr } = await supabase
          .from('rooms')
          .insert({
            code,
            puzzle_index: 0,
            answers: {},
            status: 'playing',
            coins: 50,
            items: [],
            placed_items: [],
            coins_awarded: false,
          })
          .select()
          .single()

        if (insertErr || !inserted) {
          // Another device may have inserted simultaneously — try one more select
          const { data: retry } = await supabase.from('rooms').select('*').eq('code', code).single()
          if (!retry) { console.error('joinRoom failed', insertErr); setNotFound(true); setLoading(false); return }
          data = retry
        } else {
          data = inserted
        }
      }

      if (!data) { setNotFound(true); setLoading(false); return }

      // Step 3: claim a player slot
      let role: 'a' | 'b' = 'a'
      if (data.player_a === myToken) {
        role = 'a'
      } else if (data.player_b === myToken) {
        role = 'b'
      } else if (!data.player_a) {
        await supabase.from('rooms').update({ player_a: myToken }).eq('code', code)
        role = 'a'
      } else if (!data.player_b) {
        await supabase.from('rooms').update({ player_b: myToken }).eq('code', code)
        role = 'b'
      }
      // If both slots already taken, default to 'a' — still show the game

      setMyRole(role)
      setRoom(data)
      setLoading(false)
    }
    joinRoom()
  }, [myToken, code])

  useEffect(() => {
    if (!room) return
    const channel = supabase.channel(`room-${code}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
        (payload) => setRoom(payload.new as Room))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [room?.id, code])

  // Award coins on completion (once)
  useEffect(() => {
    if (!room || room.status !== 'complete' || room.coins_awarded) return
    supabase.from('rooms').update({ coins: room.coins + 10, coins_awarded: true }).eq('code', code)
  }, [room?.status, room?.coins_awarded])

  // ── Game actions ──────────────────────────────────────────────────────────

  const submitAnswer = async (wordId: number) => {
    const answer = (inputs[wordId] || '').trim().toUpperCase()
    if (!answer || !room) return
    const puzzle = getPuzzleByIndex(room.puzzle_index)
    const word = puzzle.words.find(w => w.id === wordId)
    if (!word) return

    if (answer === word.answer.toUpperCase()) {
      const newAnswers: Record<string, string> = { ...room.answers, [wordId]: answer }
      const allDone = puzzle.words.every(w => newAnswers[String(w.id)])
      const patch = { answers: newAnswers, status: allDone ? 'complete' : 'playing' }
      await supabase.from('rooms').update(patch).eq('code', code)
      setInputs(prev => ({ ...prev, [wordId]: '' }))
    } else {
      setWrongIds(prev => new Set(prev).add(wordId))
      setTimeout(() => {
        setWrongIds(prev => { const n = new Set(prev); n.delete(wordId); return n })
        setInputs(prev => ({ ...prev, [wordId]: '' }))
      }, 600)
    }
  }

  // ── Shop & placement ──────────────────────────────────────────────────────

  const buyItem = async (itemId: string, cost: number) => {
    if (!room || room.coins < cost || room.items.includes(itemId)) return
    const patch = { coins: room.coins - cost, items: [...room.items, itemId] }
    await supabase.from('rooms').update(patch).eq('code', code)
  }

  const handleCellClick = async (x: number, y: number) => {
    if (!room || !selectedItem) return
    if (!canPlace(room.placed_items || [], selectedItem, x, y)) {
      setPlaceError('Can\'t place there — spot is taken or out of bounds')
      setTimeout(() => setPlaceError(null), 2000)
      return
    }
    const newPlaced: PlacedItem = { instanceId: makeUUID(), itemId: selectedItem, x, y }
    const newPlacedItems = [...(room.placed_items || []), newPlaced]
    const { error } = await supabase.from('rooms')
      .update({ placed_items: newPlacedItems }).eq('code', code)
    if (error) {
      setPlaceError('Failed to place item: ' + error.message)
      setTimeout(() => setPlaceError(null), 3000)
      return
    }
    setSelectedItem(null)
    setPlaceError(null)
  }

  // ── Debug actions ─────────────────────────────────────────────────────────

  const debugAddCoins = async () => {
    if (!room) return
    await supabase.from('rooms').update({ coins: room.coins + 10 }).eq('code', code)
  }

  // ── Early states ──────────────────────────────────────────────────────────

  if (loading) return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="opacity-40 text-sm">Loading…</p>
    </main>
  )

  if (notFound || !room) return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3">
      <p className="opacity-40 text-sm">Something went wrong.</p>
      <button onClick={() => window.location.reload()} className="text-sm px-4 py-2 rounded-xl" style={{ background: 'var(--purple)', color: 'white' }}>
        Refresh
      </button>
    </main>
  )

  const puzzle = getPuzzleByIndex(room.puzzle_index)
  const isComplete = room.status === 'complete'
  const solvedCount = Object.keys(room.answers).length
  const partnerOnline = !!(room.player_a && room.player_b)
  const placedItems = room.placed_items || []
  const unplacedItems = (room.items || []).filter(id => !placedItems.find(p => p.itemId === id))

  // ── Dark mode CSS vars ────────────────────────────────────────────────────

  const theme = darkMode ? {
    '--background': '#1c1510',
    '--card':       '#2a1f18',
    '--border':     '#3d2e25',
    '--foreground': '#f0e0cc',
    '--purple':     '#c8a8d8',
    '--rose':       '#6b3a3f',
    '--rose-dark':  '#c07078',
    '--success':    '#5a9a5a',
  } as React.CSSProperties : {}

  // ── Main shell ────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? '#1c1510' : 'var(--background)', ...theme }}>
    <div className="min-h-screen flex flex-col max-w-sm mx-auto" style={{ color: 'var(--foreground)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-2">
        <span className="text-xl font-bold" style={{ color: 'var(--foreground)' }}>🏡 Soulmate</span>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold" style={{ color: 'var(--purple)' }}>🪙 {room.coins}</span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-2 h-2 rounded-full" style={{ background: partnerOnline ? 'var(--success)' : 'var(--rose-dark)' }} />
            <span className="opacity-60" style={{ color: 'var(--foreground)' }}>{partnerOnline ? 'Connected' : 'Waiting'}</span>
          </div>
          <button onClick={toggleDark} className="text-base opacity-60 hover:opacity-100 transition-opacity" title="Toggle dark mode">
            {darkMode ? '☀️' : '🌙'}
          </button>
          <button onClick={() => setShowDebug(v => !v)} className="text-base opacity-40 hover:opacity-100 transition-opacity">🛠</button>
        </div>
      </div>

      {/* Debug panel */}
      {showDebug && (
        <div className="mx-4 mb-2 rounded-xl p-3 flex flex-col gap-2"
          style={{ background: '#0d0d1a', border: '1px solid #2a2a4a' }}>
          {/* Header row */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono" style={{ color: '#50fa7b' }}>◉ DEBUG</span>
            <button onClick={debugAddCoins}
              className="text-xs px-3 py-1 rounded-lg font-mono font-medium"
              style={{ background: '#1e1e3a', color: '#bd93f9', border: '1px solid #44447a' }}>
              + 10 coins
            </button>
          </div>
          {/* State log */}
          <div style={{
            background: '#060610',
            borderRadius: 6,
            padding: '8px 10px',
            fontFamily: 'monospace',
            fontSize: 10,
            color: '#8be9fd',
            maxHeight: 160,
            overflowY: 'auto',
            whiteSpace: 'pre',
            lineHeight: 1.6,
          }}>
            {[
              `room_code  : ${room.code}`,
              `room_id    : ${room.id.slice(0,8)}…`,
              `my_role    : ${myRole ?? 'none'}`,
              `my_token   : ${myToken.slice(0,8)}…`,
              `status     : ${room.status}`,
              `coins      : ${room.coins}`,
              `items      : ${JSON.stringify(room.items)}`,
              `placed     : ${JSON.stringify((room.placed_items || []).map(p => `${p.itemId}@(${p.x},${p.y})`), null, 0)}`,
              `partner_a  : ${room.player_a ? room.player_a.slice(0,8)+'…' : 'empty'}`,
              `partner_b  : ${room.player_b ? room.player_b.slice(0,8)+'…' : 'empty'}`,
            ].join('\n')}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex mx-4 rounded-xl p-1 gap-1 mb-1" style={{ background: 'var(--border)' }}>
        {(['play', 'home', 'farm'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ background: tab === t ? 'var(--card)' : 'transparent', color: tab === t ? 'var(--foreground)' : 'rgba(61,43,31,0.5)' }}>
            {t === 'play' ? '🎮 Play' : t === 'home' ? '🏡 Home' : '🌾 Farm'}
          </button>
        ))}
      </div>

      {/* ── Play tab ─────────────────────────────────────────────────────── */}
      {tab === 'play' && (
        <div className="flex flex-col px-4 pb-8 gap-4 mt-3 flex-1">

          {/* Puzzle widget */}
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: '#08040f', border: '1px solid #8844cc44' }}>
            <div>
              <p className="text-xs font-bold" style={{ color: '#cc88ff' }}>🧩 Daily Puzzle</p>
              <p className="text-xs mt-0.5" style={{ color: '#7755aa' }}>{puzzle.theme}</p>
              <p className="text-xs mt-0.5" style={{ color: isComplete ? 'var(--success)' : '#7755aa' }}>
                {isComplete ? '✓ Solved together!' : `${solvedCount} / ${puzzle.words.length} words`}
              </p>
            </div>
            <button
              onClick={() => setShowPuzzle(v => !v)}
              className="text-xs px-4 py-2 rounded-xl font-bold"
              style={{ background: '#8844cc', color: 'white', border: 'none', cursor: 'pointer' }}>
              {showPuzzle ? 'Close' : isComplete ? 'View ✓' : 'Play →'}
            </button>
          </div>

          {/* Expanded puzzle */}
          {showPuzzle && (
            <div className="flex flex-col gap-3">
              {isComplete ? (
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="text-4xl">🎉</div>
                  <h2 className="text-lg font-bold">You solved it together!</h2>
                  <p className="text-sm opacity-60">+10 coins added to your home.</p>
                  <div className="rounded-2xl p-5 w-full flex flex-col gap-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    {puzzle.words.map(word => (
                      <div key={word.id} className="flex justify-between items-center">
                        <span className="text-sm opacity-60">{word.id}.</span>
                        <span className="font-mono font-bold tracking-wider" style={{ color: 'var(--success)' }}>{word.answer}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setTab('home')} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--purple)' }}>
                    Go spend your coins →
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-center text-sm font-semibold opacity-60">{puzzle.theme}</p>
                  <div className="rounded-xl px-4 py-3 text-sm font-medium text-center"
                    style={{ background: myRole === 'a' ? 'var(--purple)' : 'var(--rose)', color: myRole === 'a' ? 'white' : 'var(--foreground)' }}>
                    {myRole === 'a' ? '📖 You have the clues — read them to your partner' : '💡 You have the hints — guide your partner'}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(solvedCount / puzzle.words.length) * 100}%`, background: 'var(--success)' }} />
                    </div>
                    <span className="text-xs opacity-60 whitespace-nowrap">{solvedCount}/{puzzle.words.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {puzzle.words.map((word: Word) => {
                      const solved = !!room.answers[word.id]
                      const isWrong = wrongIds.has(word.id)
                      return (
                        <div key={word.id} className="rounded-xl p-4 flex flex-col gap-2"
                          style={{ background: solved ? '#F0FAF0' : 'var(--card)', border: `1px solid ${solved ? 'var(--success)' : isWrong ? 'var(--rose-dark)' : 'var(--border)'}` }}>
                          <div className="flex items-start gap-2">
                            <span className="text-xs font-bold mt-0.5 w-5 shrink-0" style={{ color: 'var(--purple)' }}>{word.id}.</span>
                            <p className="text-sm leading-snug">{myRole === 'a' ? word.clue : word.hint}</p>
                          </div>
                          {solved ? (
                            <div className="flex items-center gap-2 pl-7">
                              <span className="font-mono font-bold tracking-wider text-sm" style={{ color: 'var(--success)' }}>{room.answers[word.id]}</span>
                              <span>✓</span>
                            </div>
                          ) : (
                            <div className="flex gap-2 pl-7">
                              <input type="text" value={inputs[word.id] || ''}
                                onChange={e => setInputs(prev => ({ ...prev, [word.id]: e.target.value.toUpperCase() }))}
                                onKeyDown={e => e.key === 'Enter' && submitAnswer(word.id)}
                                placeholder="Type answer…"
                                className="flex-1 px-3 py-2 rounded-lg text-sm font-mono outline-none"
                                style={{ background: isWrong ? '#FEF2F2' : 'var(--background)', border: `1px solid ${isWrong ? 'var(--rose-dark)' : 'var(--border)'}`, color: 'var(--foreground)' }} />
                              <button onClick={() => submitAnswer(word.id)}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-white" style={{ background: 'var(--purple)' }}>↵</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-center text-xs opacity-40 pb-2">Talk to each other — neither of you has the full picture.</p>
                </>
              )}
            </div>
          )}

          {/* Wordcraft widget */}
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: '#04100a', border: '1px solid #44aa6644' }}>
            <div>
              <p className="text-xs font-bold" style={{ color: '#88cc99' }}>🔤 Wordcraft</p>
              <p className="text-xs mt-0.5" style={{ color: '#447755' }}>Build words on a shared board</p>
            </div>
            <button
              onClick={() => setShowWordcraft(true)}
              className="text-xs px-4 py-2 rounded-xl font-bold"
              style={{ background: '#44aa66', color: 'white', border: 'none', cursor: 'pointer' }}>
              Play →
            </button>
          </div>

          {/* Arcade widget */}
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: '#0a0614', border: '1px solid #8844cc44' }}>
            <div>
              <p className="text-xs font-bold" style={{ color: '#cc88ff' }}>🕹️ Arcade</p>
              <p className="text-xs mt-0.5" style={{ color: '#7755aa' }}>2-player Pac-Man with your partner</p>
            </div>
            <button
              onClick={() => { setArcadeInitial('pacman-lobby'); setShowArcade(true) }}
              className="text-xs px-4 py-2 rounded-xl font-bold"
              style={{ background: '#8844cc', color: 'white', border: 'none', cursor: 'pointer' }}>
              Play →
            </button>
          </div>

        </div>
      )}

      {/* ── Home tab ─────────────────────────────────────────────────────── */}
      {tab === 'home' && (
        <div className="flex flex-col px-4 pb-8 gap-5 mt-3">

          {/* Coin balance */}
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
            <div>
              <p className="text-xs opacity-60 mb-0.5">Balance</p>
              <p className="text-2xl font-bold">🪙 {room.coins}</p>
            </div>
            <p className="text-xs opacity-40 text-right max-w-28">Earn 10 coins by completing today&apos;s puzzle</p>
          </div>

          {/* Soul Happiness */}
          {(() => {
            const allPlaced = [...STARTER_LAYOUT, ...placedItems]
            const totalBeauty = allPlaced.reduce((sum, item) => {
              const def = getItemDef(item.itemId)
              return sum + (def?.beauty || 0)
            }, 0)
            const h = getHappiness(totalBeauty)
            const pct = h.nextAt === -1 ? 100
              : Math.round((totalBeauty - h.prevAt) / (h.nextAt - h.prevAt) * 100)
            return (
              <div className="rounded-2xl p-4 flex flex-col gap-2"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs opacity-50 mb-0.5">Soul Happiness</p>
                    <p className="text-lg font-bold">{h.emoji} {h.label}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs opacity-50 mb-0.5">Beauty</p>
                    <p className="text-lg font-bold" style={{ color: h.color }}>✦ {totalBeauty}</p>
                  </div>
                </div>
                <div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: h.color }} />
                  </div>
                  {h.nextAt !== -1 && (
                    <p className="text-xs opacity-40 mt-1">
                      {h.nextAt - totalBeauty} beauty until <strong>{getHappiness(h.nextAt).label}</strong>
                    </p>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold opacity-50 uppercase tracking-wider">Your Home</p>
              {selectedItem && (
                <button onClick={() => setSelectedItem(null)} className="text-xs px-2 py-1 rounded-lg"
                  style={{ background: 'var(--rose)', color: 'var(--foreground)' }}>
                  Cancel placing
                </button>
              )}
            </div>

            {selectedItem && (
              <p className="text-xs text-center mb-2 font-medium" style={{ color: 'var(--purple)' }}>
                Tap a cell to place your {getItemDef(selectedItem)?.emoji} {getItemDef(selectedItem)?.label}
              </p>
            )}

            <div
              className="rounded-2xl p-2"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div style={{ position: 'relative' }}>
              <Ghost
                name="Jason"
                color="#8844cc"
                startX={5} startY={5}
                darkMode={darkMode}
                placedItems={placedItems}
              />
              <Ghost
                name="Rui"
                color="#dd4477"
                startX={2} startY={6}
                darkMode={darkMode}
                placedItems={placedItems}
              />
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`, gap: 3, touchAction: selectedItem ? 'none' : 'auto' }}>
                {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, idx) => {
                  const x = idx % GRID_COLS
                  const y = Math.floor(idx / GRID_COLS)
                  const occupant = getOccupant(placedItems, x, y)
                  const def = occupant ? getItemDef(occupant.itemId) : null
                  const starter = occupant ? isStarter(occupant) : false
                  const isValid = selectedItem ? canPlace(placedItems, selectedItem, x, y) : false

                  // Show emoji at the origin (top-left) cell of each item
                  const isOriginCell = occupant
                    ? (x === occupant.x && y === occupant.y)
                    : false

                  let bg = darkMode ? '#2e2218' : '#e8ddd4'
                  let border = '1px solid transparent'
                  if (occupant?.itemId === 'arcade') {
                    bg = darkMode ? '#0a0614' : '#120820'
                    border = `1px solid #8844cc88`
                  } else if (occupant) {
                    bg = starter
                      ? (darkMode ? '#4a3828' : '#c8b89a')
                      : (darkMode ? '#4a2d4a' : '#d8bce8')
                    border = starter
                      ? `1px solid ${darkMode ? '#6a5040' : '#a09080'}`
                      : `1px solid ${darkMode ? '#9a70aa' : '#b090c8'}`
                  } else if (selectedItem) {
                    bg = isValid
                      ? (darkMode ? '#1e3a1e' : '#c8e8c8')
                      : (darkMode ? '#3a1a1a' : '#f0d8d8')
                    border = isValid
                      ? `1px solid ${darkMode ? '#4a8a4a' : '#80b880'}`
                      : '1px solid transparent'
                  }

                  return (
                    <div
                      key={idx}
                      onTouchStart={(e) => {
                        if (!selectedItem) return
                        e.preventDefault()   // blocks scroll + prevents synthetic click
                        e.stopPropagation()
                        handleCellClick(x, y)
                      }}
                      onPointerDown={(e) => {
                        if (!selectedItem) return
                        if (e.pointerType === 'touch') return  // handled by onTouchStart
                        handleCellClick(x, y)
                      }}
                      onClick={() => {
                        if (selectedItem) return  // handled by touch/pointer events
                        if (occupant && def) {
                          if (occupant.itemId === 'arcade') { setArcadeInitial('select'); setShowArcade(true); return }
                          if (occupant.itemId === 'newspaper') { setShowNewspaper(true); return }
                          setInfoItem(prev => prev === def.id ? null : def.id)
                        }
                      }}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 4,
                        background: bg,
                        border,
                        cursor: selectedItem
                          ? (isValid ? 'pointer' : 'not-allowed')
                          : (occupant ? 'pointer' : 'default'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isOriginCell ? 16 : 11,
                        userSelect: 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {/* Show emoji at every cell so multi-cell items are obvious */}
                      {occupant && def && <span>{def.emoji}</span>}
                    </div>
                  )
                })}
              </div>
              </div>{/* end position:relative ghost wrapper */}

              {/* Info bar — replaces tooltip, no clipping issues */}
              {(infoItem || placeError) && (
                <div style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: placeError
                    ? (darkMode ? '#4a1a1a' : '#fde8e8')
                    : (darkMode ? '#3a2a4a' : '#ede0f5'),
                  color: placeError
                    ? (darkMode ? '#ff9090' : '#c04040')
                    : 'var(--foreground)',
                  fontSize: 12,
                  textAlign: 'center',
                }}>
                  {placeError
                    ? `⚠️ ${placeError}`
                    : (() => {
                        const def = SHOP_ITEMS.find(s => s.id === infoItem)
                        return def ? `${def.emoji} ${def.label} · ${def.w}×${def.h} grid` : null
                      })()
                  }
                </div>
              )}
            </div>
          </div>

          {/* Inventory */}
          {unplacedItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold opacity-50 uppercase tracking-wider mb-2">Inventory — tap to place</p>
              <div className="flex gap-2 flex-wrap">
                {unplacedItems.map(itemId => {
                  const def = getItemDef(itemId)
                  if (!def) return null
                  return (
                    <button
                      key={itemId}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        setSelectedItem(prev => prev === itemId ? null : itemId)
                      }}
                      onClick={() => setSelectedItem(prev => prev === itemId ? null : itemId)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: selectedItem === itemId ? 'var(--purple)' : 'var(--card)',
                        color: selectedItem === itemId ? 'white' : 'var(--foreground)',
                        border: `1px solid ${selectedItem === itemId ? 'var(--purple)' : 'var(--border)'}`,
                      }}
                    >
                      <span>{def.emoji}</span>
                      <span>{def.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Shop */}
          <div>
            <p className="text-xs font-semibold opacity-50 uppercase tracking-wider mb-2">Shop</p>
            <div className="flex flex-col gap-2">
              {SHOP_ITEMS.filter(item => !item.noShop).map(item => {
                const owned = room.items.includes(item.id)
                const canAfford = room.coins >= item.cost
                return (
                  <div key={item.id} className="rounded-xl p-4 flex items-center justify-between"
                    style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{item.emoji}</span>
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs opacity-50">🪙 {item.cost} · {item.w}×{item.h} grid</p>
                      </div>
                    </div>
                    {owned ? (
                      <span className="text-xs px-3 py-1.5 rounded-lg" style={{ background: '#F0FAF0', color: 'var(--success)' }}>Owned ✓</span>
                    ) : (
                      <button onClick={() => buyItem(item.id, item.cost)} disabled={!canAfford}
                        className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-40"
                        style={{ background: 'var(--purple)' }}>
                        Buy
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      )}

      {/* ── Farm tab ─────────────────────────────────────────────────────── */}
      {tab === 'farm' && myToken && (
        <FarmClient
          code={code}
          myToken={myToken}
          darkMode={darkMode}
        />
      )}
    </div>
    {showArcade && (
      <ArcadeModal
        darkMode={darkMode}
        onClose={() => { setShowArcade(false); setArcadeInitial('select') }}
        roomCode={code}
        myRole={myRole ?? 'a'}
        initialGame={arcadeInitial}
      />
    )}
    {showNewspaper && (
      <NewspaperModal
        darkMode={darkMode}
        onClose={() => setShowNewspaper(false)}
      />
    )}
    {showWordcraft && (
      <WordcraftModal
        darkMode={darkMode}
        roomCode={code}
        myRole={myRole ?? 'a'}
        onClose={() => setShowWordcraft(false)}
      />
    )}
    </div>
  )
}
