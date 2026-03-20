'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getDictionary, isValidWord } from '@/lib/wordDictionary'

// ── Constants ────────────────────────────────────────────────────────────────

const N = 11
const CENTER = 5
const HAND_SIZE = 7
const BINGO_BONUS = 35

const TILE_VALUES: Record<string, number> = {
  A:1, B:3, C:3, D:2, E:1, F:4, G:2, H:4, I:1, J:8, K:5,
  L:1, M:3, N:1, O:1, P:3, Q:10, R:1, S:1, T:1, U:1, V:4,
  W:4, X:8, Y:4, Z:10, '?':0,
}

type Bonus = 'TW' | 'DW' | 'TL' | 'DL' | '★' | null

const BONUS_GRID: Bonus[][] = [
  ['TW',null,null,'DL',null,null,null,'DL',null,null,'TW'],
  [null,'DW',null,null,null,'TL',null,null,null,'DW',null],
  [null,null,'DW',null,'DL',null,'DL',null,'DW',null,null],
  ['DL',null,null,'TL',null,null,null,'TL',null,null,'DL'],
  [null,null,'DL',null,'DW',null,'DW',null,'DL',null,null],
  [null,'TL',null,null,null,'★', null,null,null,'TL',null],
  [null,null,'DL',null,'DW',null,'DW',null,'DL',null,null],
  ['DL',null,null,'TL',null,null,null,'TL',null,null,'DL'],
  [null,null,'DW',null,'DL',null,'DL',null,'DW',null,null],
  [null,'DW',null,null,null,'TL',null,null,null,'DW',null],
  ['TW',null,null,'DL',null,null,null,'DL',null,null,'TW'],
]

const BONUS_BG: Record<string, string> = {
  TW: '#c84040', DW: '#d87050', TL: '#3070c0', DL: '#5090d0', '★': '#c84040',
}

function makeBag(): string[] {
  const dist: Record<string, number> = {
    A:7, B:2, C:2, D:3, E:8, F:2, G:2, H:2, I:6, J:1, K:1,
    L:3, M:2, N:4, O:5, P:2, Q:1, R:4, S:3, T:4, U:3, V:2,
    W:2, X:1, Y:2, Z:1, '?':2,
  }
  const bag: string[] = []
  for (const [letter, count] of Object.entries(dist)) {
    for (let i = 0; i < count; i++) bag.push(letter)
  }
  return bag
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Types ────────────────────────────────────────────────────────────────────

type Board = (string | null)[][]

interface PendingTile {
  handIdx: number
  letter: string
  row: number
  col: number
  isBlank: boolean
}

interface GameState {
  board: Board
  hands: { a: string[]; b: string[] }
  bag: string[]
  scores: { a: number; b: number }
  turn: 'a' | 'b'
  phase: 'lobby' | 'playing' | 'gameover'
  consecutiveSkips: number
  lastMove: { player: 'a' | 'b'; words: string[]; points: number } | null
  winner: 'a' | 'b' | 'tie' | null
}

// ── Game logic ────────────────────────────────────────────────────────────────

function emptyBoard(): Board {
  return Array.from({ length: N }, () => Array(N).fill(null))
}

function applyPending(board: Board, pending: PendingTile[]): Board {
  const b = board.map(r => [...r])
  for (const t of pending) b[t.row][t.col] = t.letter
  return b
}

function isFirstMove(board: Board): boolean {
  return board.flat().every(c => c === null)
}

function validatePlacement(board: Board, pending: PendingTile[]): string | null {
  if (pending.length === 0) return 'Place at least one tile.'

  const rows = [...new Set(pending.map(t => t.row))]
  const cols = [...new Set(pending.map(t => t.col))]
  if (rows.length > 1 && cols.length > 1) return 'All tiles must be in the same row or column.'

  const b = applyPending(board, pending)

  if (rows.length === 1) {
    const r = rows[0]
    const minC = Math.min(...cols), maxC = Math.max(...cols)
    for (let c = minC; c <= maxC; c++) {
      if (!b[r][c]) return 'No gaps allowed between tiles.'
    }
  } else {
    const c = cols[0]
    const minR = Math.min(...rows), maxR = Math.max(...rows)
    for (let r = minR; r <= maxR; r++) {
      if (!b[r][c]) return 'No gaps allowed between tiles.'
    }
  }

  if (isFirstMove(board)) {
    if (!pending.some(t => t.row === CENTER && t.col === CENTER)) return 'First word must cover the center ★.'
    if (pending.length < 2) return 'First word must be at least 2 letters.'
  } else {
    const connects = pending.some(({ row, col }) =>
      [board[row - 1]?.[col], board[row + 1]?.[col], board[row]?.[col - 1], board[row]?.[col + 1]]
        .some(n => n != null)
    )
    if (!connects) return 'Tiles must connect to an existing word.'
  }

  return null
}

function getWords(board: Board, pending: PendingTile[]) {
  const b = applyPending(board, pending)
  const found = new Map<string, { word: string; cells: { r: number; c: number; letter: string }[] }>()

  for (const pt of pending) {
    // Horizontal run
    {
      let c = pt.col
      while (c > 0 && b[pt.row][c - 1]) c--
      const cells: { r: number; c: number; letter: string }[] = []
      while (c < N && b[pt.row][c]) { cells.push({ r: pt.row, c, letter: b[pt.row][c]! }); c++ }
      if (cells.length >= 2) {
        const key = `h${pt.row}:${cells[0].c}`
        if (!found.has(key)) found.set(key, { word: cells.map(x => x.letter).join(''), cells })
      }
    }
    // Vertical run
    {
      let r = pt.row
      while (r > 0 && b[r - 1][pt.col]) r--
      const cells: { r: number; c: number; letter: string }[] = []
      while (r < N && b[r][pt.col]) { cells.push({ r, c: pt.col, letter: b[r][pt.col]! }); r++ }
      if (cells.length >= 2) {
        const key = `v${pt.col}:${cells[0].r}`
        if (!found.has(key)) found.set(key, { word: cells.map(x => x.letter).join(''), cells })
      }
    }
  }

  return [...found.values()]
}

function calcScore(
  words: ReturnType<typeof getWords>,
  pending: PendingTile[],
): number {
  const pendMap = new Map(pending.map(t => [`${t.row},${t.col}`, t]))
  let total = 0

  for (const { cells } of words) {
    let ws = 0, wm = 1
    for (const { r, c, letter } of cells) {
      const pend = pendMap.get(`${r},${c}`)
      const val = pend?.isBlank ? 0 : (TILE_VALUES[letter] ?? 0)
      const bonus = pend ? BONUS_GRID[r][c] : null
      if (bonus === 'DL') ws += val * 2
      else if (bonus === 'TL') ws += val * 3
      else ws += val
      if (bonus === 'DW' || bonus === '★') wm *= 2
      if (bonus === 'TW') wm *= 3
    }
    total += ws * wm
  }

  if (pending.length === HAND_SIZE) total += BINGO_BONUS
  return total
}

function drawTiles(hand: string[], bag: string[], count: number) {
  const newBag = [...bag]
  const newHand = [...hand]
  for (let i = 0; i < count && newBag.length > 0; i++) newHand.push(newBag.pop()!)
  return { hand: newHand, bag: newBag }
}

function finishGame(state: GameState): GameState {
  const aLeft = state.hands.a.reduce((s, t) => s + (TILE_VALUES[t] ?? 0), 0)
  const bLeft = state.hands.b.reduce((s, t) => s + (TILE_VALUES[t] ?? 0), 0)
  let sa = state.scores.a - aLeft + (state.hands.a.length === 0 ? bLeft : 0)
  let sb = state.scores.b - bLeft + (state.hands.b.length === 0 ? aLeft : 0)
  sa = Math.max(0, sa)
  sb = Math.max(0, sb)
  const winner: 'a' | 'b' | 'tie' = sa > sb ? 'a' : sb > sa ? 'b' : 'tie'
  return { ...state, scores: { a: sa, b: sb }, phase: 'gameover', winner }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function WordGame({
  roomCode, myRole, darkMode, onClose,
}: {
  roomCode: string
  myRole: 'a' | 'b'
  darkMode: boolean
  onClose: () => void
}) {
  const [gs, setGs] = useState<GameState>({
    board: emptyBoard(),
    hands: { a: [], b: [] },
    bag: [],
    scores: { a: 0, b: 0 },
    turn: 'a',
    phase: 'lobby',
    consecutiveSkips: 0,
    lastMove: null,
    winner: null,
  })
  const [pending, setPending] = useState<PendingTile[]>([])
  const [selectedHandIdx, setSelectedHandIdx] = useState<number | null>(null)
  const [blankPicker, setBlankPicker] = useState<{ handIdx: number; row: number; col: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dict, setDict] = useState<Set<string> | null>(null)
  const [dictLoading, setDictLoading] = useState(true)
  const [myReady, setMyReady] = useState(false)
  const [partnerReady, setPartnerReady] = useState(false)

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const gsRef = useRef(gs)
  gsRef.current = gs

  // Load dictionary once
  useEffect(() => {
    getDictionary()
      .then(d => { setDict(d); setDictLoading(false) })
      .catch(() => setDictLoading(false))
  }, [])

  // Supabase broadcast channel
  useEffect(() => {
    const ch = supabase.channel(`wordcraft:${roomCode}`)
    ch.on('broadcast', { event: 'wc' }, ({ payload }: { payload: Record<string, unknown> }) => {
      if (payload.type === 'ready') {
        if ((payload.player as string) !== myRole) setPartnerReady(true)
      } else if (payload.type === 'start' || payload.type === 'move' || payload.type === 'skip') {
        setGs(payload.state as GameState)
        setPending([])
        setError(null)
      }
    }).subscribe()
    channelRef.current = ch
    return () => { supabase.removeChannel(ch) }
  }, [roomCode, myRole])

  const broadcast = useCallback((msg: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event: 'wc', payload: msg })
  }, [])

  // Player A initializes game when both ready
  useEffect(() => {
    if (!myReady || !partnerReady || myRole !== 'a' || gsRef.current.phase !== 'lobby') return
    const bag = shuffled(makeBag())
    const { hand: handA, bag: bag2 } = drawTiles([], bag, HAND_SIZE)
    const { hand: handB, bag: finalBag } = drawTiles([], bag2, HAND_SIZE)
    const initState: GameState = {
      board: emptyBoard(),
      hands: { a: handA, b: handB },
      bag: finalBag,
      scores: { a: 0, b: 0 },
      turn: 'a',
      phase: 'playing',
      consecutiveSkips: 0,
      lastMove: null,
      winner: null,
    }
    setGs(initState)
    broadcast({ type: 'start', state: initState })
  }, [myReady, partnerReady, myRole, broadcast])

  const handleReady = () => {
    setMyReady(true)
    broadcast({ type: 'ready', player: myRole })
  }

  const myHand = gs.hands[myRole]
  const isMyTurn = gs.turn === myRole && gs.phase === 'playing'
  const usedHandIdxs = new Set(pending.map(t => t.handIdx))

  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn) return

    // Tap a pending tile to recall it
    const pendIdx = pending.findIndex(t => t.row === row && t.col === col)
    if (pendIdx !== -1) {
      setPending(p => p.filter((_, i) => i !== pendIdx))
      return
    }

    if (gs.board[row][col] !== null) return   // occupied by committed tile
    if (selectedHandIdx === null) return

    const letter = myHand[selectedHandIdx]
    if (letter === '?') {
      setBlankPicker({ handIdx: selectedHandIdx, row, col })
      return
    }

    setPending(p => [...p, { handIdx: selectedHandIdx, letter, row, col, isBlank: false }])
    setSelectedHandIdx(null)
    setError(null)
  }

  const handleBlankPick = (chosenLetter: string) => {
    if (!blankPicker) return
    setPending(p => [...p, { handIdx: blankPicker.handIdx, letter: chosenLetter, row: blankPicker.row, col: blankPicker.col, isBlank: true }])
    setBlankPicker(null)
    setSelectedHandIdx(null)
    setError(null)
  }

  const recallTiles = () => { setPending([]); setSelectedHandIdx(null); setError(null) }

  const handleSubmit = () => {
    if (!dict || !isMyTurn || pending.length === 0) return

    const err = validatePlacement(gs.board, pending)
    if (err) { setError(err); return }

    const words = getWords(gs.board, pending)
    const invalid = words.filter(w => !isValidWord(w.word, dict))
    if (invalid.length > 0) {
      setError(`Not a valid word: ${invalid.map(w => w.word).join(', ')}`)
      return
    }

    const points = calcScore(words, pending)
    const newBoard = applyPending(gs.board, pending)
    const playedIdxs = new Set(pending.map(t => t.handIdx))
    const remainingHand = myHand.filter((_, i) => !playedIdxs.has(i))
    const { hand: newHand, bag: newBag } = drawTiles(remainingHand, gs.bag, pending.length)

    let newState: GameState = {
      ...gs,
      board: newBoard,
      hands: { ...gs.hands, [myRole]: newHand },
      bag: newBag,
      scores: { ...gs.scores, [myRole]: gs.scores[myRole] + points },
      turn: myRole === 'a' ? 'b' : 'a',
      consecutiveSkips: 0,
      lastMove: { player: myRole, words: words.map(w => w.word), points },
    }

    if (newBag.length === 0 && newHand.length === 0) newState = finishGame(newState)

    setGs(newState)
    broadcast({ type: 'move', state: newState })
    setPending([])
    setError(null)
  }

  const handleSkip = () => {
    if (!isMyTurn) return
    recallTiles()
    const skips = gs.consecutiveSkips + 1
    let newState: GameState = {
      ...gs,
      turn: myRole === 'a' ? 'b' : 'a',
      consecutiveSkips: skips,
      lastMove: null,
    }
    if (skips >= 4) newState = finishGame(newState)
    setGs(newState)
    broadcast({ type: 'skip', state: newState })
  }

  // ── Theme ────────────────────────────────────────────────────────────────────

  const bg   = darkMode ? '#0e1a10' : '#f0faf2'
  const card = darkMode ? '#1a2e1c' : '#ffffff'
  const fg   = darkMode ? '#c8f0cc' : '#0a2010'
  const fgM  = darkMode ? '#6a9a6e' : '#4a7050'
  const myC  = myRole === 'a' ? '#8844cc' : '#dd4477'
  const ptC  = myRole === 'a' ? '#dd4477' : '#8844cc'

  // ── Lobby ────────────────────────────────────────────────────────────────────

  if (gs.phase === 'lobby') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
        <div style={{ fontSize: 44 }}>🔤</div>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 'bold', color: fg, marginBottom: 6 }}>Wordcraft</h2>
          <p style={{ fontSize: 13, color: fgM, lineHeight: 1.5 }}>Take turns building words on a shared board. Score points with bonus squares.</p>
        </div>
        {dictLoading ? (
          <p style={{ fontSize: 12, color: fgM }}>Loading dictionary…</p>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 260 }}>
              {(['You', 'Partner'] as const).map((label, idx) => {
                const ready = idx === 0 ? myReady : partnerReady
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: card, border: `1px solid ${ready ? '#44aa66' : fgM + '44'}` }}>
                    <span style={{ fontSize: 18 }}>{ready ? '✅' : '⏳'}</span>
                    <span style={{ fontSize: 13, color: fg }}>{label} — {ready ? 'ready!' : 'not ready'}</span>
                  </div>
                )
              })}
            </div>
            {!myReady ? (
              <button onClick={handleReady} style={{ padding: '12px 36px', borderRadius: 14, background: '#44aa66', color: 'white', fontWeight: 'bold', fontSize: 15, border: 'none', cursor: 'pointer' }}>
                Ready!
              </button>
            ) : !partnerReady ? (
              <p style={{ fontSize: 12, color: fgM }}>Waiting for your partner…</p>
            ) : (
              <p style={{ fontSize: 12, color: '#44aa66' }}>Starting game…</p>
            )}
          </>
        )}
      </div>
    )
  }

  // ── Game Over ────────────────────────────────────────────────────────────────

  if (gs.phase === 'gameover') {
    const iWon = gs.winner === myRole
    const tied = gs.winner === 'tie'
    const ptRole = myRole === 'a' ? 'b' : 'a'
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 }}>
        <div style={{ fontSize: 52 }}>{tied ? '🤝' : iWon ? '🏆' : '💜'}</div>
        <h2 style={{ fontSize: 22, fontWeight: 'bold', color: fg }}>{tied ? "It's a tie!" : iWon ? 'You won!' : 'Partner wins!'}</h2>
        <div style={{ display: 'flex', gap: 16 }}>
          {([['You', myRole, myC], ['Partner', ptRole, ptC]] as [string, 'a' | 'b', string][]).map(([label, role, color]) => (
            <div key={label} style={{ textAlign: 'center', padding: '14px 22px', borderRadius: 14, background: card, border: `2px solid ${color}` }}>
              <p style={{ fontSize: 11, color: fgM, marginBottom: 4 }}>{label}</p>
              <p style={{ fontSize: 30, fontWeight: 'bold', color }}>{gs.scores[role]}</p>
            </div>
          ))}
        </div>
        <button onClick={onClose} style={{ padding: '10px 30px', borderRadius: 12, background: myC, color: 'white', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
          Close
        </button>
      </div>
    )
  }

  // ── Playing ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* Score bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', background: card, borderBottom: `1px solid ${fgM}22`, flexShrink: 0 }}>
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <p style={{ fontSize: 10, color: fgM, marginBottom: 2 }}>You</p>
          <p style={{ fontSize: 22, fontWeight: 'bold', color: myC }}>{gs.scores[myRole]}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, fontWeight: 'bold', color: isMyTurn ? '#44aa66' : fgM }}>
            {isMyTurn ? '✦ Your turn' : "Partner's turn…"}
          </p>
          <p style={{ fontSize: 10, color: fgM }}>{gs.bag.length} tiles in bag</p>
        </div>
        <div style={{ textAlign: 'center', minWidth: 50 }}>
          <p style={{ fontSize: 10, color: fgM, marginBottom: 2 }}>Partner</p>
          <p style={{ fontSize: 22, fontWeight: 'bold', color: ptC }}>{gs.scores[myRole === 'a' ? 'b' : 'a']}</p>
        </div>
      </div>

      {/* Last move / error banner */}
      {(gs.lastMove || error) && (
        <div style={{ padding: '5px 12px', background: error ? '#cc444422' : '#44aa6618', textAlign: 'center', flexShrink: 0 }}>
          <p style={{ fontSize: 11, color: error ? '#cc6666' : '#44aa66' }}>
            {error ?? (gs.lastMove
              ? `${gs.lastMove.player === myRole ? 'You' : 'Partner'} played ${gs.lastMove.words.join(', ')} +${gs.lastMove.points} pts`
              : '')}
          </p>
        </div>
      )}

      {/* Board */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 8, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, 1fr)`, gap: 2, width: '100%', maxWidth: 352 }}>
          {Array.from({ length: N * N }).map((_, idx) => {
            const row = Math.floor(idx / N)
            const col = idx % N
            const committed = gs.board[row][col]
            const pend = pending.find(t => t.row === row && t.col === col)
            const bonus = BONUS_GRID[row][col]

            let bg2 = darkMode ? '#1a2e1c' : '#ddf0e2'
            let border2 = darkMode ? '#2a4a2c' : '#b0d8ba'
            let textColor = darkMode ? '#c8f0cc' : '#0a2010'
            let content: string | null = null
            let fontSz = 9
            let fontW: React.CSSProperties['fontWeight'] = 'normal'

            if (committed) {
              bg2 = darkMode ? '#3a2858' : '#ede0ff'
              border2 = darkMode ? '#6040a0' : '#9070cc'
              textColor = darkMode ? '#ddd0ff' : '#2a0860'
              content = committed
              fontSz = 15
              fontW = 'bold'
            } else if (pend) {
              bg2 = '#e8a820'
              border2 = '#c08010'
              textColor = '#2a1400'
              content = pend.letter
              fontSz = 15
              fontW = 'bold'
            } else if (bonus) {
              bg2 = BONUS_BG[bonus] + (darkMode ? '55' : '44')
              border2 = BONUS_BG[bonus] + '88'
              content = bonus
              fontSz = 7
            }

            const clickable = isMyTurn && (pend != null || (committed === null && selectedHandIdx !== null))

            return (
              <div
                key={idx}
                onClick={() => handleCellClick(row, col)}
                style={{
                  aspectRatio: '1',
                  background: bg2,
                  border: `1px solid ${border2}`,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: fontSz,
                  fontWeight: fontW,
                  color: textColor,
                  cursor: clickable ? 'pointer' : 'default',
                  userSelect: 'none',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {content}
              </div>
            )
          })}
        </div>
      </div>

      {/* Hand + controls */}
      {gs.phase === 'playing' && (
        <div style={{ padding: '8px 10px 12px', borderTop: `1px solid ${fgM}22`, background: card, flexShrink: 0 }}>
          {isMyTurn ? (
            <>
              {/* Tiles */}
              <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                {myHand.map((letter, i) => {
                  const isUsed = usedHandIdxs.has(i)
                  const isSel = selectedHandIdx === i
                  return (
                    <button
                      key={i}
                      disabled={isUsed}
                      onClick={() => setSelectedHandIdx(isSel ? null : i)}
                      style={{
                        width: 38, height: 44,
                        borderRadius: 6,
                        background: isUsed ? (darkMode ? '#222' : '#ddd') : isSel ? myC : (darkMode ? '#2a4a2c' : '#edfff2'),
                        border: `2px solid ${isUsed ? 'transparent' : isSel ? myC : (darkMode ? '#4a7050' : '#80c090')}`,
                        color: isUsed ? '#555' : isSel ? 'white' : fg,
                        fontWeight: 'bold',
                        fontSize: letter === '?' ? 18 : 17,
                        cursor: isUsed ? 'default' : 'pointer',
                        opacity: isUsed ? 0.25 : 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        lineHeight: 1,
                      }}
                    >
                      {letter === '?' ? '✦' : letter}
                      <span style={{ fontSize: 8, opacity: 0.7 }}>{TILE_VALUES[letter] ?? 0}</span>
                    </button>
                  )
                })}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={handleSubmit}
                  disabled={pending.length === 0 || !dict}
                  style={{
                    flex: 1, padding: '10px 0', borderRadius: 10,
                    background: pending.length > 0 ? '#44aa66' : (darkMode ? '#2a4a2c' : '#c8e8cc'),
                    color: pending.length > 0 ? 'white' : fgM,
                    fontWeight: 'bold', fontSize: 13, border: 'none',
                    cursor: pending.length > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  Submit Play
                </button>
                <button
                  onClick={recallTiles}
                  disabled={pending.length === 0}
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: darkMode ? '#2a3a2c' : '#eef8f0',
                    color: fgM, fontSize: 12, border: `1px solid ${fgM}44`, cursor: 'pointer',
                  }}
                >
                  Recall
                </button>
                <button
                  onClick={handleSkip}
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: darkMode ? '#2a2a3a' : '#f0f0f8',
                    color: fgM, fontSize: 12, border: `1px solid ${fgM}44`, cursor: 'pointer',
                  }}
                >
                  Skip
                </button>
              </div>
            </>
          ) : (
            <p style={{ textAlign: 'center', fontSize: 13, color: fgM, padding: '6px 0' }}>
              Waiting for partner's move…
            </p>
          )}
        </div>
      )}

      {/* Blank tile letter picker */}
      {blankPicker && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.82)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
          <div style={{ background: card, borderRadius: 18, padding: '20px 16px', width: '88%', maxWidth: 320 }}>
            <p style={{ fontSize: 14, fontWeight: 'bold', color: fg, textAlign: 'center', marginBottom: 14 }}>
              Choose a letter for your blank tile
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => (
                <button
                  key={l}
                  onClick={() => handleBlankPick(l)}
                  style={{
                    width: 34, height: 34, borderRadius: 6,
                    background: darkMode ? '#2a4a2c' : '#edfff2',
                    color: fg, fontWeight: 'bold', fontSize: 14,
                    border: `1px solid ${fgM}44`, cursor: 'pointer',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
            <button
              onClick={() => { setBlankPicker(null); setSelectedHandIdx(null) }}
              style={{ marginTop: 14, width: '100%', padding: '8px 0', borderRadius: 8, background: 'none', color: fgM, border: `1px solid ${fgM}44`, cursor: 'pointer', fontSize: 12 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
