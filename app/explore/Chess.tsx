'use client'

import { useState, useCallback, useEffect, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Color     = 'w' | 'b'
type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P'
type Piece     = { type: PieceType; color: Color }
type Board     = (Piece | null)[][]
type Pos       = [number, number]

interface Castling { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean }

interface GameState {
  board:        Board
  turn:         Color
  selected:     Pos | null
  legalMoves:   Pos[]
  enPassant:    Pos | null
  castling:     Castling
  status:       'playing' | 'check' | 'checkmate' | 'stalemate' | 'promotion'
  promotionPos: Pos | null
  lastMove:     [Pos, Pos] | null
  capturedW:    Piece[]
  capturedB:    Piece[]
}

// ── Piece glyphs ──────────────────────────────────────────────────────────────

const GLYPHS: Record<Color, Record<PieceType, string>> = {
  w: { K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙' },
  b: { K: '♚', Q: '♛', R: '♜', B: '♝', N: '♞', P: '♟' },
}

// ── Ghost pixel data (for 3-D soul render) ────────────────────────────────────

const GHOST_BODY = [
  [0,0,1,1,1,1,1,0,0],
  [0,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,1,0,0,1,0,0,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1],
  [1,0,1,0,1,0,1,0,1],
]
const GHOST_EYES = new Set(['4-2','4-3','4-5','4-6'])

// ── Board helpers ─────────────────────────────────────────────────────────────

function initialBoard(): Board {
  const b: Board = Array(8).fill(null).map(() => Array(8).fill(null))
  const back: PieceType[] = ['R','N','B','Q','K','B','N','R']
  back.forEach((type, c) => {
    b[0][c] = { type, color: 'b' }
    b[7][c] = { type, color: 'w' }
  })
  for (let c = 0; c < 8; c++) {
    b[1][c] = { type: 'P', color: 'b' }
    b[6][c] = { type: 'P', color: 'w' }
  }
  return b
}

function clone(b: Board): Board {
  return b.map(row => row.map(cell => (cell ? { ...cell } : null)))
}

function findKing(board: Board, color: Color): Pos | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === color && board[r][c]?.type === 'K')
        return [r, c]
  return null
}

function inBounds(r: number, c: number) { return r >= 0 && r < 8 && c >= 0 && c < 8 }

function rawMoves(board: Board, pos: Pos, ep: Pos | null): Pos[] {
  const [r, c] = pos
  const p = board[r][c]
  if (!p) return []
  const { type, color } = p
  const enemy = color === 'w' ? 'b' : 'w'
  const out: Pos[] = []

  const slide = (dr: number, dc: number) => {
    let nr = r + dr, nc = c + dc
    while (inBounds(nr, nc)) {
      if (!board[nr][nc]) { out.push([nr, nc]); nr += dr; nc += dc }
      else { if (board[nr][nc]!.color === enemy) out.push([nr, nc]); break }
    }
  }

  switch (type) {
    case 'P': {
      const d = color === 'w' ? -1 : 1
      const s = color === 'w' ? 6  : 1
      if (inBounds(r+d, c) && !board[r+d][c]) {
        out.push([r+d, c])
        if (r === s && !board[r+2*d][c]) out.push([r+2*d, c])
      }
      for (const dc of [-1, 1]) {
        if (inBounds(r+d, c+dc)) {
          if (board[r+d][c+dc]?.color === enemy) out.push([r+d, c+dc])
          else if (ep && ep[0]===r+d && ep[1]===c+dc) out.push([r+d, c+dc])
        }
      }
      break
    }
    case 'N':
      for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])
        if (inBounds(r+dr, c+dc) && board[r+dr][c+dc]?.color !== color)
          out.push([r+dr, c+dc])
      break
    case 'B': for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) slide(dr,dc); break
    case 'R': for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) slide(dr,dc); break
    case 'Q':
      for (const [dr,dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]])
        slide(dr,dc)
      break
    case 'K':
      for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])
        if (inBounds(r+dr, c+dc) && board[r+dr][c+dc]?.color !== color)
          out.push([r+dr, c+dc])
      break
  }
  return out
}

function attacked(board: Board, pos: Pos, byColor: Color): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p || p.color !== byColor) continue
      if (rawMoves(board, [r,c], null).some(([mr,mc]) => mr===pos[0] && mc===pos[1]))
        return true
    }
  return false
}

function inCheck(board: Board, color: Color): boolean {
  const k = findKing(board, color)
  return !!k && attacked(board, k, color === 'w' ? 'b' : 'w')
}

function legalFor(state: GameState, pos: Pos): Pos[] {
  const { board, enPassant, castling, turn } = state
  const [r, c] = pos
  const p = board[r][c]
  if (!p || p.color !== turn) return []

  const legal: Pos[] = []
  for (const [nr, nc] of rawMoves(board, pos, enPassant)) {
    const nb = clone(board)
    if (p.type==='P' && enPassant && nr===enPassant[0] && nc===enPassant[1] && !nb[nr][nc])
      nb[p.color==='w' ? nr+1 : nr-1][nc] = null
    nb[nr][nc] = p; nb[r][c] = null
    if (!inCheck(nb, turn)) legal.push([nr, nc])
  }

  if (p.type === 'K' && !inCheck(board, turn)) {
    const row = turn === 'w' ? 7 : 0
    const opp = turn === 'w' ? 'b' : 'w'
    if ((turn==='w' ? castling.wK : castling.bK) && !board[row][5] && !board[row][6] &&
        !attacked(board,[row,5],opp) && !attacked(board,[row,6],opp))
      legal.push([row, 6])
    if ((turn==='w' ? castling.wQ : castling.bQ) && !board[row][3] && !board[row][2] && !board[row][1] &&
        !attacked(board,[row,3],opp) && !attacked(board,[row,2],opp))
      legal.push([row, 2])
  }
  return legal
}

function anyLegal(board: Board, color: Color, ep: Pos | null, castling: Castling): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p || p.color !== color) continue
      const fake: GameState = {
        board, turn: color, selected: null, legalMoves: [], enPassant: ep,
        castling, status: 'playing', promotionPos: null, lastMove: null,
        capturedW: [], capturedB: [],
      }
      if (legalFor(fake, [r,c]).length) return true
    }
  return false
}

function calcStatus(board: Board, nextTurn: Color, ep: Pos|null, castling: Castling): GameState['status'] {
  const chk = inCheck(board, nextTurn)
  const has = anyLegal(board, nextTurn, ep, castling)
  if (chk && !has)  return 'checkmate'
  if (!chk && !has) return 'stalemate'
  if (chk)          return 'check'
  return 'playing'
}

function applyMove(state: GameState, from: Pos, to: Pos): GameState {
  const nb  = clone(state.board)
  const [fr,fc] = from
  const [tr,tc] = to
  const p = nb[fr][fc]!
  const newCast = { ...state.castling }
  const capW = [...state.capturedW]
  const capB = [...state.capturedB]
  let newEP: Pos | null = null

  const cap = nb[tr][tc]
  if (cap) (cap.color==='w' ? capW : capB).push(cap)

  if (p.type==='P' && state.enPassant && tr===state.enPassant[0] && tc===state.enPassant[1] && !nb[tr][tc]) {
    const epCap = nb[p.color==='w' ? tr+1 : tr-1][tc]!
    nb[p.color==='w' ? tr+1 : tr-1][tc] = null
    ;(epCap.color==='w' ? capW : capB).push(epCap)
  }

  if (p.type==='K') {
    if (p.color==='w') { newCast.wK = false; newCast.wQ = false }
    else               { newCast.bK = false; newCast.bQ = false }
    if (fc===4 && tc===6) { nb[fr][5] = nb[fr][7]; nb[fr][7] = null }
    if (fc===4 && tc===2) { nb[fr][3] = nb[fr][0]; nb[fr][0] = null }
  }
  if (p.type==='R') {
    if (fr===7&&fc===0) newCast.wQ = false
    if (fr===7&&fc===7) newCast.wK = false
    if (fr===0&&fc===0) newCast.bQ = false
    if (fr===0&&fc===7) newCast.bK = false
  }

  if (p.type==='P' && Math.abs(tr-fr)===2) newEP = [(fr+tr)/2 as number, fc]

  nb[tr][tc] = p; nb[fr][fc] = null
  const needsPromo = p.type==='P' && (tr===0 || tr===7)
  const nextTurn: Color = p.color==='w' ? 'b' : 'w'
  const status: GameState['status'] = needsPromo ? 'promotion'
    : calcStatus(nb, nextTurn, newEP, newCast)

  return {
    board: nb, turn: needsPromo ? p.color : nextTurn,
    selected: null, legalMoves: [],
    enPassant: newEP, castling: newCast, status,
    promotionPos: needsPromo ? [tr,tc] : null,
    lastMove: [from, to], capturedW: capW, capturedB: capB,
  }
}

function applyPromotion(state: GameState, type: PieceType): GameState {
  if (!state.promotionPos) return state
  const [r,c] = state.promotionPos
  const nb = clone(state.board)
  const color = nb[r][c]!.color
  nb[r][c] = { type, color }
  const nextTurn: Color = color==='w' ? 'b' : 'w'
  const status = calcStatus(nb, nextTurn, state.enPassant, state.castling)
  return { ...state, board: nb, turn: nextTurn, status, promotionPos: null }
}

function start(): GameState {
  return {
    board: initialBoard(), turn: 'w',
    selected: null, legalMoves: [], enPassant: null,
    castling: { wK:true, wQ:true, bK:true, bQ:true },
    status: 'playing', promotionPos: null, lastMove: null,
    capturedW: [], capturedB: [],
  }
}

// ── Chess AI (minimax + alpha-beta + piece-square tables) ─────────────────────

const PIECE_VAL: Record<PieceType, number> = {
  P:100, N:320, B:330, R:500, Q:900, K:20000
}

// PSTs from white's perspective (row 0 = rank 8, row 7 = rank 1)
const PST: Record<PieceType, number[][]> = {
  P: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [ 5,  5, 10, 25, 25, 10,  5,  5],
    [ 0,  0,  0, 20, 20,  0,  0,  0],
    [ 5, -5,-10,  0,  0,-10, -5,  5],
    [ 5, 10, 10,-20,-20, 10, 10,  5],
    [ 0,  0,  0,  0,  0,  0,  0,  0],
  ],
  N: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  B: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  R: [
    [ 0,  0,  0,  0,  0,  0,  0,  0],
    [ 5, 10, 10, 10, 10, 10, 10,  5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [-5,  0,  0,  0,  0,  0,  0, -5],
    [ 0,  0,  0,  5,  5,  0,  0,  0],
  ],
  Q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  K: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
}

function evaluate(board: Board): number {
  let score = 0
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p) continue
      const pstRow = p.color==='w' ? r : 7-r
      const val = PIECE_VAL[p.type] + PST[p.type][pstRow][c]
      score += p.color==='w' ? val : -val
    }
  return score
}

function allMoves(state: GameState): [Pos,Pos][] {
  const out: [Pos,Pos][] = []
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++) {
      const p = state.board[r][c]
      if (!p || p.color !== state.turn) continue
      for (const to of legalFor(state, [r,c])) out.push([[r,c], to])
    }
  // Move ordering: captures first (better alpha-beta pruning)
  return out.sort((a,b) => {
    const va = state.board[a[1][0]][a[1][1]] ? PIECE_VAL[state.board[a[1][0]][a[1][1]]!.type] : 0
    const vb = state.board[b[1][0]][b[1][1]] ? PIECE_VAL[state.board[b[1][0]][b[1][1]]!.type] : 0
    return vb - va
  })
}

function applyAI(state: GameState, from: Pos, to: Pos): GameState {
  let s = applyMove(state, from, to)
  if (s.status==='promotion' && s.promotionPos) s = applyPromotion(s, 'Q')
  return s
}

function minimax(state: GameState, depth: number, alpha: number, beta: number, maxing: boolean): number {
  if (state.status==='checkmate') return maxing ? -99999 : 99999
  if (state.status==='stalemate') return 0
  if (depth===0) return evaluate(state.board)

  const moves = allMoves(state)
  if (!moves.length) return evaluate(state.board)

  if (maxing) {
    let best = -Infinity
    for (const [from,to] of moves) {
      best = Math.max(best, minimax(applyAI(state,from,to), depth-1, alpha, beta, false))
      alpha = Math.max(alpha, best)
      if (beta<=alpha) break
    }
    return best
  } else {
    let best = Infinity
    for (const [from,to] of moves) {
      best = Math.min(best, minimax(applyAI(state,from,to), depth-1, alpha, beta, true))
      beta = Math.min(beta, best)
      if (beta<=alpha) break
    }
    return best
  }
}

function getBestMove(state: GameState): [Pos,Pos] | null {
  const moves = allMoves(state)
  if (!moves.length) return null
  let bestVal = Infinity
  let bestMove: [Pos,Pos] | null = null
  for (const [from,to] of moves) {
    const val = minimax(applyAI(state,from,to), 2, -Infinity, Infinity, true)
    if (val < bestVal) { bestVal=val; bestMove=[from,to] }
  }
  return bestMove
}

// ── 3-D soul ghost ────────────────────────────────────────────────────────────

const PX = 3

function Soul3D({ name, color, darkMode, message, flip = false }: {
  name: string; color: string; darkMode: boolean
  message: string | null; flip?: boolean
}) {
  const [t, setT] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    let time = Math.random() * Math.PI * 2  // stagger starting phase
    const step = () => {
      time += 0.035
      setT(time)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const bob  = Math.sin(t)          * 5
  const rx   = Math.sin(t * 0.65)   * 11   // forward / back tilt
  const ry   = Math.cos(t * 0.45)   * 16   // left / right sway — mirror per side
  const sc   = 1 + Math.sin(t*0.9)  * 0.04
  const eyeColor = darkMode ? '#1a0826' : '#0d001a'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: 64, minHeight: 80, position: 'relative',
    }}>
      {/* Chat bubble */}
      <div style={{
        height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100%',
      }}>
        {message && (
          <div style={{
            background: darkMode ? '#241c36' : '#ffffff',
            color:      darkMode ? '#f0e0ff' : '#1a0a2a',
            borderRadius: 8, padding: '3px 7px',
            fontSize: 8, whiteSpace: 'nowrap', lineHeight: 1.4,
            boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
            border: `1px solid ${color}55`,
            maxWidth: 100, textAlign: 'center', wordBreak: 'keep-all',
          }}>{message}</div>
        )}
      </div>

      {/* 3-D ghost sprite */}
      <div style={{
        transform: `perspective(160px) rotateX(${rx}deg) rotateY(${flip ? -ry : ry}deg) translateY(${bob}px) scale(${sc})`,
        filter:    `drop-shadow(0 6px 14px ${color}99) drop-shadow(0 0 8px ${color}55)`,
        willChange: 'transform',
      }}>
        <svg
          width={9*PX} height={8*PX}
          style={{ imageRendering: 'pixelated', display: 'block' }}
        >
          {GHOST_BODY.map((row, gy) => row.map((cell, gx) => {
            if (!cell) return null
            const k   = `${gy}-${gx}`
            const eye = GHOST_EYES.has(k)
            const shi = gy===2 && (gx===3||gx===4)
            return <rect key={k} x={gx*PX} y={gy*PX} width={PX} height={PX}
              fill={eye ? eyeColor : shi ? 'rgba(255,255,255,0.45)' : color} />
          }))}
        </svg>
      </div>

      {/* Name label */}
      <div style={{
        marginTop: 4, fontSize: 8, fontWeight: 700, color,
        letterSpacing: '0.06em',
        textShadow: darkMode ? '0 1px 4px rgba(0,0,0,0.9)' : '0 1px 4px rgba(255,255,255,0.8)',
      }}>{name}</div>
    </div>
  )
}

// ── Chess component ───────────────────────────────────────────────────────────

interface Props {
  darkMode:      boolean
  locationName:  string
  locationColor: string
  onClose:       () => void
}

const CPU_QUIPS   = ['Calculating... 🤔','Interesting...','I see your plan.','Hmm 🧠','Analysing...','Processing ⚙️']
const CPU_MOVE    = ['Bold choice.','I expected that.','You fell right in.','Interesting gambit.','My move 😌','Classic.']
const CPU_CHECK   = ['Check! ♟','Watch your king! ⚠️','Check. 😈','Pressure... ♟']
const CPU_WIN     = ['Checkmate. GG 👻','You never stood a chance. 🏆','My strongest game 😤','That\u2019s how it\u2019s done 🎓']
const CPU_LOSE    = ['Well played... 😤','You got lucky.','Impressive \uD83D\uDE2E','I\u2019ll remember this.']

const YOU_MOVE    = ['Nice! \u2728','Got it!','My turn \u265F','Let\u2019s go!','Okay okay...','Think...']
const YOU_CHECK   = ['Check! \u265F\uFE0F','Got your king!','Check! 😤','Now we\u2019re talking \u26A1']
const YOU_WIN     = ['Checkmate! \uD83C\uDF89','I WON! \uD83C\uDF89\uD83D\uDC7B','YES! \u2728','CHECKMATE! \uD83D\uDE04']
const YOU_LOSE    = ['Oh no... \uD83D\uDE22','I lost \uD83D\uDE22','Rematch?','Good game I guess...']

function pick(arr: string[]) { return arr[Math.floor(Math.random()*arr.length)] }

export default function Chess({ darkMode, locationName, locationColor, onClose }: Props) {
  const [game,         setGame]       = useState<GameState>(start)
  const [solo,         setSolo]       = useState(true)
  const [thinking,     setThinking]   = useState(false)
  const [youMsg,       setYouMsg]     = useState<string | null>(null)
  const [cpuMsg,       setCpuMsg]     = useState<string | null>(null)
  const prevStatusRef = useRef<GameState['status']>('playing')
  const prevTurnRef   = useRef<Color>('w')

  // ── Show a message, auto-clear after `ms` ──────────────────────────────────
  const flash = useCallback((
    setter: (v: string|null)=>void, msg: string, ms = 3000
  ) => {
    setter(msg)
    setTimeout(() => setter(null), ms)
  }, [])

  // ── AI move ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!solo) return
    if (game.turn !== 'b') return
    if (game.status==='checkmate'||game.status==='stalemate'||game.status==='promotion') return

    setThinking(true)
    flash(setCpuMsg, pick(CPU_QUIPS), 2500)

    const t = setTimeout(() => {
      setThinking(false)
      setGame(prev => {
        const mv = getBestMove(prev)
        if (!mv) return prev
        return applyAI(prev, mv[0], mv[1])
      })
    }, 500 + Math.random()*600)

    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.turn, game.status, solo])

  // ── Reactive messages on state changes ────────────────────────────────────
  useEffect(() => {
    const prev   = prevStatusRef.current
    const prevT  = prevTurnRef.current
    const { status, turn, lastMove } = game

    prevStatusRef.current = status
    prevTurnRef.current   = turn

    if (!lastMove) return   // initial state, skip

    if (status==='checkmate') {
      if (turn==='w') { flash(setCpuMsg, pick(CPU_WIN)); flash(setYouMsg, pick(YOU_LOSE)) }
      else            { flash(setYouMsg, pick(YOU_WIN)); flash(setCpuMsg, pick(CPU_LOSE)) }
      return
    }
    if (status==='check') {
      if (turn==='w') flash(setCpuMsg, pick(CPU_CHECK))
      else            flash(setYouMsg, pick(YOU_CHECK))
      return
    }
    // Normal move just happened
    if (prevT==='w' && turn==='b') {
      if (!thinking) flash(setYouMsg, pick(YOU_MOVE), 1800)
    } else if (prevT==='b' && turn==='w' && solo) {
      if (prev!=='check') flash(setCpuMsg, pick(CPU_MOVE), 2200)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.lastMove, game.status])

  // ── Click handler ──────────────────────────────────────────────────────────
  const handleSquare = useCallback((r: number, c: number) => {
    setGame(prev => {
      if (prev.status==='checkmate'||prev.status==='stalemate'||prev.status==='promotion') return prev
      if (solo && prev.turn==='b') return prev  // block clicks when CPU moving

      if (prev.selected) {
        if (prev.legalMoves.some(([lr,lc]) => lr===r&&lc===c))
          return applyMove(prev, prev.selected, [r,c])
      }
      const p = prev.board[r][c]
      if (p && p.color===prev.turn)
        return { ...prev, selected:[r,c], legalMoves: legalFor(prev,[r,c]) }
      return { ...prev, selected:null, legalMoves:[] }
    })
  }, [solo])

  const handlePromotion = useCallback((type: PieceType) => {
    setGame(prev => applyPromotion(prev, type))
  }, [])

  const reset = useCallback(() => {
    setGame(start())
    setThinking(false)
    setYouMsg(null); setCpuMsg(null)
    prevStatusRef.current = 'playing'
    prevTurnRef.current   = 'w'
  }, [])

  // ── Theme ─────────────────────────────────────────────────────────────────
  const cardBg  = darkMode ? '#161228' : '#ffffff'
  const border  = darkMode ? '#2a2040' : '#d0c8e8'
  const text    = darkMode ? '#f0e8ff' : '#1a0a2a'
  const sub     = darkMode ? '#7060a0' : '#7060a0'
  const lightSq = darkMode ? '#2d2448' : '#f0e8d8'
  const darkSq  = darkMode ? '#1a1230' : '#b8946a'
  const selSq   = locationColor + '99'
  const legalDt = locationColor
  const lastSq  = locationColor + '44'
  const checkSq = '#e03322bb'

  const checkedKing = (game.status==='check'||game.status==='checkmate')
    ? findKing(game.board, game.turn)
    : null

  const statusText = () => {
    if (thinking) return 'CPU is thinking... ⏳'
    switch (game.status) {
      case 'checkmate': return `Checkmate! ${game.turn==='w' ? 'Black':'White'} wins 🏆`
      case 'stalemate': return 'Stalemate — draw!'
      case 'check':     return `${game.turn==='w' ? 'White':'Black'} is in check ⚠️`
      case 'promotion': return 'Promote your pawn'
      default:          return solo
        ? (game.turn==='w' ? '⬜ Your move' : '⬛ CPU thinking...')
        : `${game.turn==='w' ? '⬜ White':'⬛ Black'} to move`
    }
  }

  const isLastMove = (r: number, c: number) => {
    if (!game.lastMove) return false
    const [[fr,fc],[tr,tc]] = game.lastMove
    return (r===fr&&c===fc)||(r===tr&&c===tc)
  }

  // CPU ghost color: complement of locationColor, slightly muted
  const cpuColor = '#5588cc'

  return (
    <div
      style={{
        position:'fixed', inset:0, zIndex:100,
        background:'rgba(0,0,0,0.82)',
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:'12px 10px',
      }}
      onClick={e => { if (e.target===e.currentTarget) onClose() }}
    >
      <div style={{
        width:'100%', maxWidth:360,
        background: cardBg, borderRadius:20,
        border: `1px solid ${border}`,
        overflow:'hidden',
        boxShadow:`0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px ${locationColor}33`,
      }}>

        {/* ── Header ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'10px 14px 8px',
          background: locationColor+'1c',
          borderBottom:`1px solid ${locationColor}30`,
        }}>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:text }}>♟ Chess</p>
            <p style={{ fontSize:10, color:sub, marginTop:1 }}>@ {locationName}</p>
          </div>
          {/* Solo / 2-player toggle */}
          <div style={{
            display:'flex', borderRadius:10, overflow:'hidden',
            border:`1px solid ${border}`, fontSize:9,
          }}>
            {[true,false].map(s => (
              <button key={String(s)} onClick={() => { setSolo(s); reset() }} style={{
                padding:'4px 8px', cursor:'pointer', fontWeight:600,
                background: solo===s ? (darkMode?'#2e2050':'#e8e0f8') : 'transparent',
                color:      solo===s ? text : sub,
                border:'none',
              }}>
                {s ? '🤖 vs CPU' : '👥 2P'}
              </button>
            ))}
          </div>
          <button onClick={onClose} style={{
            width:28, height:28, borderRadius:'50%',
            background: darkMode?'#2a2040':'#ede8f8',
            border:'none', cursor:'pointer', fontSize:13, color:text,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>✕</button>
        </div>

        {/* ── Soul strip ── */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          padding:'4px 16px 0',
          background: darkMode?'#110e1e':'#f4f0fc',
          borderBottom:`1px solid ${border}`,
        }}>
          {/* Opponent ghost (top) */}
          <Soul3D
            name={solo ? 'CPU' : 'Black'}
            color={cpuColor}
            darkMode={darkMode}
            message={cpuMsg}
            flip
          />

          {/* Turn indicator bubble */}
          <div style={{ textAlign:'center', paddingBottom:6 }}>
            <div style={{
              width:10, height:10, borderRadius:'50%', margin:'0 auto 4px',
              background: game.turn==='w' ? '#fff' : '#1a1230',
              border:'2px solid #888',
              boxShadow: game.turn==='w'
                ? '0 0 8px rgba(255,255,255,0.5)'
                : '0 0 8px rgba(80,60,160,0.5)',
              transition:'background 0.3s',
            }} />
            <span style={{ fontSize:8, color:sub }}>
              {game.turn==='w' ? 'White' : 'Black'}
            </span>
          </div>

          {/* Player ghost */}
          <Soul3D
            name="You"
            color="#8844cc"
            darkMode={darkMode}
            message={youMsg}
          />
        </div>

        {/* ── Status bar ── */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'6px 14px',
          background: darkMode?'#120e20':'#f6f2ff',
          borderBottom:`1px solid ${border}`,
        }}>
          <span style={{
            fontSize:11, fontWeight:600,
            color: game.status==='checkmate' ? '#f0d000'
                 : game.status==='check'     ? '#ff7744'
                 : game.status==='stalemate' ? '#70c8e8'
                 : thinking ? '#a090d0'
                 : text,
          }}>{statusText()}</span>
          {(game.status==='checkmate'||game.status==='stalemate') && (
            <button onClick={reset} style={{
              fontSize:10, padding:'3px 9px', borderRadius:6,
              background: locationColor+'33', border:`1px solid ${locationColor}66`,
              color:text, cursor:'pointer', fontWeight:600,
            }}>New Game</button>
          )}
        </div>

        {/* ── Captured by white ── */}
        <CapturedBar pieces={game.capturedB} />

        {/* ── Board ── */}
        <div style={{ padding:'4px 8px' }}>
          <div style={{
            display:'grid', gridTemplateColumns:'repeat(8,1fr)',
            borderRadius:10, overflow:'hidden',
            border:`2px solid ${border}`,
          }}>
            {Array.from({ length:64 }).map((_,idx) => {
              const r  = Math.floor(idx/8)
              const c  = idx%8
              const p  = game.board[r][c]
              const sel = game.selected?.[0]===r && game.selected?.[1]===c
              const leg = game.legalMoves.some(([lr,lc]) => lr===r&&lc===c)
              const last = isLastMove(r,c)
              const chk  = checkedKing?.[0]===r && checkedKing?.[1]===c

              let sqBg = (r+c)%2===0 ? lightSq : darkSq
              if (sel)       sqBg = selSq
              else if (chk)  sqBg = checkSq
              else if (last) sqBg = lastSq

              return (
                <div key={idx} onClick={() => handleSquare(r,c)} style={{
                  aspectRatio:'1', background:sqBg,
                  position:'relative', cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'clamp(14px,4.5vw,22px)',
                  WebkitTapHighlightColor:'transparent', userSelect:'none',
                }}>
                  {c===0 && (
                    <span style={{
                      position:'absolute', top:1, left:2, fontSize:7, lineHeight:1,
                      fontWeight:700, pointerEvents:'none',
                      color:(r+c)%2===0 ? darkSq : lightSq,
                    }}>{8-r}</span>
                  )}
                  {r===7 && (
                    <span style={{
                      position:'absolute', bottom:1, right:2, fontSize:7, lineHeight:1,
                      fontWeight:700, pointerEvents:'none',
                      color:(r+c)%2===0 ? darkSq : lightSq,
                    }}>{'abcdefgh'[c]}</span>
                  )}
                  {leg && !p && (
                    <div style={{
                      width:'32%', height:'32%', borderRadius:'50%',
                      background:legalDt, opacity:0.65, pointerEvents:'none',
                    }} />
                  )}
                  {leg && p && (
                    <div style={{
                      position:'absolute', inset:1, borderRadius:4,
                      border:`3px solid ${legalDt}bb`, pointerEvents:'none',
                    }} />
                  )}
                  {p && (
                    <span style={{
                      lineHeight:1, position:'relative', zIndex:1,
                      filter: p.color==='w'
                        ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.55))'
                        : 'drop-shadow(0 1px 3px rgba(0,0,0,0.75))',
                    }}>
                      {GLYPHS[p.color][p.type]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Captured by black ── */}
        <CapturedBar pieces={game.capturedW} />

        {/* ── Promotion picker ── */}
        {game.status==='promotion' && (
          <div style={{
            padding:'10px 14px 12px',
            borderTop:`1px solid ${border}`,
            display:'flex', justifyContent:'center', gap:10,
          }}>
            {(['Q','R','B','N'] as PieceType[]).map(type => (
              <button key={type} onClick={() => handlePromotion(type)} style={{
                width:46, height:46, borderRadius:10,
                background: darkMode?'#241c3a':'#ede8f8',
                border:`2px solid ${locationColor}88`,
                cursor:'pointer', fontSize:26, lineHeight:1,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {GLYPHS[game.turn][type]}
              </button>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{
          padding:'5px 14px 10px',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          borderTop:`1px solid ${border}`,
        }}>
          <span style={{ fontSize:9, color:sub }}>
            {solo ? 'You play White · CPU plays Black' : 'Pass and play'}
          </span>
          <button onClick={reset} style={{
            fontSize:10, padding:'3px 8px', borderRadius:6,
            background:'transparent', border:`1px solid ${border}`,
            color:sub, cursor:'pointer',
          }}>↺ Reset</button>
        </div>

      </div>
    </div>
  )
}

// ── Captured pieces bar ────────────────────────────────────────────────────────

function CapturedBar({ pieces }: { pieces: Piece[] }) {
  return (
    <div style={{
      padding:'1px 10px', minHeight:16,
      display:'flex', alignItems:'center', flexWrap:'wrap', gap:1,
    }}>
      {pieces.map((p,i) => (
        <span key={i} style={{ fontSize:11, lineHeight:1, opacity:0.7 }}>
          {GLYPHS[p.color][p.type]}
        </span>
      ))}
    </div>
  )
}
