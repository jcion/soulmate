'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  roomCode: string
  mpRole: 'host' | 'p1' | 'p2'
  darkMode: boolean
  onClose: () => void
}

type Dir = 'up' | 'down' | 'left' | 'right' | null
type GhostMode = 'house' | 'chase' | 'scatter' | 'frightened' | 'dead'
type Phase = 'start' | 'playing' | 'dying' | 'victory' | 'gameover'

interface PlayerState {
  row: number
  col: number
  dir: Dir
  nextDir: Dir
  alive: boolean
}

interface Ghost {
  row: number
  col: number
  dir: Dir
  mode: GhostMode
  prevMode: GhostMode
  frightTimer: number
  deadTimer: number
  houseTimer: number
  exitDelay: number
  color: string
  name: string
  cornerRow: number
  cornerCol: number
}

interface ReceivedGhost {
  row: number
  col: number
  mode: string
  frightTimer: number
  color: string
}

interface ReceivedState {
  p1: { row: number; col: number; dir: string | null; alive: boolean }
  p2: { row: number; col: number; dir: string | null; alive: boolean }
  ghosts: ReceivedGhost[]
  score: number
  lives: number
  phase: string
  eatenDots: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROWS = 21
const COLS = 19
const W = 1, D = 0, P = 2, E = 3, G = 4

const BASE_MAZE: number[][] = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
  [1,2,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,2,1],
  [1,0,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1],
  [1,0,0,0,0,1,1,0,1,3,1,0,1,1,0,0,0,0,1],
  [3,3,3,0,1,1,0,0,1,3,1,0,0,1,1,0,3,3,3],
  [1,0,0,0,0,1,1,0,1,3,1,0,1,1,0,0,0,0,1],
  [1,0,1,1,0,0,0,0,0,3,0,0,0,0,0,1,1,0,1],
  [1,0,1,1,0,1,1,4,3,3,3,4,1,1,0,1,1,0,1],
  [1,0,0,0,0,1,1,4,3,3,3,4,1,1,0,0,0,0,1],
  [1,0,1,1,0,1,1,1,1,3,1,1,1,1,0,1,1,0,1],
  [1,0,1,1,0,0,0,0,0,3,0,0,0,0,0,1,1,0,1],
  [1,0,0,0,0,1,1,0,1,3,1,0,1,1,0,0,0,0,1],
  [1,0,1,1,0,1,1,0,1,1,1,0,1,1,0,1,1,0,1],
  [1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,1,1,2,1],
  [1,0,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
]

const MOVE_TICK = 150
const POWER_TICK = 120
const FRIGHTENED_DURATION = 7000
const SCATTER_1 = 7000
const CHASE_1 = 20000
const SCATTER_2 = 5000
const TUNNEL_ROW = 6

const GHOST_DEFS = [
  { name: 'Blinky', color: '#ff0000', row: 9,  col: 7,  exitDelay: 0,     cornerRow: 0,  cornerCol: 18 },
  { name: 'Pinky',  color: '#ffb8ff', row: 9,  col: 11, exitDelay: 4000,  cornerRow: 0,  cornerCol: 0  },
  { name: 'Inky',   color: '#00ffff', row: 10, col: 7,  exitDelay: 8000,  cornerRow: 20, cornerCol: 18 },
  { name: 'Clyde',  color: '#ffb852', row: 10, col: 11, exitDelay: 12000, cornerRow: 20, cornerCol: 0  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function cloneMaze(): number[][] {
  return BASE_MAZE.map(row => [...row])
}

function dirDelta(d: Dir): { dr: number; dc: number } {
  switch (d) {
    case 'up':    return { dr: -1, dc: 0 }
    case 'down':  return { dr: 1,  dc: 0 }
    case 'left':  return { dr: 0,  dc: -1 }
    case 'right': return { dr: 0,  dc: 1 }
    default:      return { dr: 0,  dc: 0 }
  }
}

function isWall(maze: number[][], row: number, col: number): boolean {
  if (row < 0 || row >= ROWS) return true
  let c = col
  if (row === TUNNEL_ROW) {
    if (c < 0) c = COLS - 1
    if (c >= COLS) c = 0
  }
  if (c < 0 || c >= COLS) return true
  return maze[row][c] === W
}

function isPlayerPassable(maze: number[][], row: number, col: number): boolean {
  if (isWall(maze, row, col)) return false
  if (col === 9 && row >= 5 && row <= 8) return false
  return true
}

function isGhostPassable(maze: number[][], row: number, col: number): boolean {
  if (row < 0 || row >= ROWS) return false
  let c = col
  if (row === TUNNEL_ROW) {
    if (c < 0) c = COLS - 1
    if (c >= COLS) c = 0
  }
  if (c < 0 || c >= COLS) return false
  return maze[row][c] !== W
}

function wrapCol(row: number, col: number): number {
  if (row === TUNNEL_ROW) {
    if (col < 0) return COLS - 1
    if (col >= COLS) return 0
  }
  return col
}

function manhattanDist(r1: number, c1: number, r2: number, c2: number): number {
  return Math.abs(r1 - r2) + Math.abs(c1 - c2)
}

function countDots(maze: number[][]): number {
  let n = 0
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (maze[r][c] === D || maze[r][c] === P) n++
  return n
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function PacmanMP({ roomCode, mpRole, darkMode, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)
  const [cellSize, setCellSize] = useState(20)
  const cellSizeRef = useRef(20)

  // ── UI state ────────────────────────────────────────────────────────────────
  const [uiScore, setUiScore] = useState(0)
  const [uiLives, setUiLives] = useState(3)
  const [uiPhase, setUiPhase] = useState<Phase>('start')
  const [connStatus, setConnStatus] = useState<'connecting' | 'live' | 'lost'>('connecting')

  // ── Supabase channel ref ─────────────────────────────────────────────────────
  const chRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // ── HOST: game state refs ───────────────────────────────────────────────────
  const mazeRef = useRef<number[][]>(cloneMaze())
  const p1Ref = useRef<PlayerState>({ row: 17, col: 7, dir: null, nextDir: null, alive: true })
  const p2Ref = useRef<PlayerState>({ row: 17, col: 11, dir: null, nextDir: null, alive: true })
  const ghostsRef = useRef<Ghost[]>([])
  const scoreRef = useRef<number>(0)
  const livesRef = useRef<number>(3)
  const tickRef = useRef<number>(0)
  const phaseRef = useRef<Phase>('start')
  const phaseTimerRef = useRef<number>(0)
  const p1MoveAccRef = useRef<number>(0)
  const p2MoveAccRef = useRef<number>(0)
  const ghostMoveAccRef = useRef<number>(0)
  const modeTimerRef = useRef<number>(0)
  const modePhaseRef = useRef<number>(0)
  const frightenedChainRef = useRef<number>(0)
  const dotsRemainingRef = useRef<number>(0)
  const dyingTimerRef = useRef<number>(0)
  const eatenDotsRef = useRef<{ row: number; col: number }[]>([])
  const lastBroadcastRef = useRef<number>(0)

  // Remote input refs (host receives from guests)
  const p1RemoteDir = useRef<Dir>(null)
  const p2RemoteDir = useRef<Dir>(null)

  // ── GUEST: received state refs ──────────────────────────────────────────────
  const receivedStateRef = useRef<ReceivedState | null>(null)
  const lastMsgTimeRef = useRef<number>(Date.now())
  const guestTickRef = useRef<number>(0)

  // ── HOST helpers ─────────────────────────────────────────────────────────────

  function initGhosts() {
    ghostsRef.current = GHOST_DEFS.map(def => ({
      row: def.row,
      col: def.col,
      dir: null,
      mode: 'house' as GhostMode,
      prevMode: 'house' as GhostMode,
      frightTimer: 0,
      deadTimer: 0,
      houseTimer: def.exitDelay,
      exitDelay: def.exitDelay,
      color: def.color,
      name: def.name,
      cornerRow: def.cornerRow,
      cornerCol: def.cornerCol,
    }))
  }

  function resetGame() {
    mazeRef.current = cloneMaze()
    p1Ref.current = { row: 17, col: 7, dir: null, nextDir: null, alive: true }
    p2Ref.current = { row: 17, col: 11, dir: null, nextDir: null, alive: true }
    scoreRef.current = 0
    livesRef.current = 3
    tickRef.current = 0
    phaseRef.current = 'start'
    phaseTimerRef.current = 2000
    p1MoveAccRef.current = 0
    p2MoveAccRef.current = 0
    ghostMoveAccRef.current = 0
    modeTimerRef.current = SCATTER_1
    modePhaseRef.current = 0
    frightenedChainRef.current = 0
    dyingTimerRef.current = 0
    eatenDotsRef.current = []
    dotsRemainingRef.current = countDots(mazeRef.current)
    initGhosts()
    setUiScore(0)
    setUiLives(3)
    setUiPhase('start')
  }

  function getGhostDirs(ghost: Ghost): Dir[] {
    const all: Dir[] = ['up', 'down', 'left', 'right']
    const opposite: Record<string, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
    return all.filter(d => {
      if (ghost.dir && d === opposite[ghost.dir]) return false
      const { dr, dc } = dirDelta(d)
      const nr = ghost.row + dr
      const nc = wrapCol(ghost.row + dr === ghost.row ? ghost.row : ghost.row + dr, ghost.col + dc)
      return isGhostPassable(mazeRef.current, nr, nc)
    })
  }

  function moveGhost(ghost: Ghost, dt: number) {
    const maze = mazeRef.current
    const p1 = p1Ref.current
    const p2 = p2Ref.current

    if (ghost.mode === 'house') {
      ghost.houseTimer -= dt
      if (ghost.houseTimer <= 0) {
        if (ghost.col !== 9) {
          const dc = ghost.col < 9 ? 1 : -1
          ghost.col += dc
        } else if (ghost.row > 5) {
          ghost.row--
        } else {
          ghost.mode = 'scatter'
          ghost.dir = 'left'
        }
      }
      return
    }

    if (ghost.mode === 'frightened') {
      ghost.frightTimer -= dt
      if (ghost.frightTimer <= 0) {
        ghost.mode = ghost.prevMode
      }
    }

    if (ghost.mode === 'dead') {
      ghost.deadTimer -= dt
      const targetR = 9, targetC = 9
      if (ghost.row === targetR && ghost.col === targetC) {
        ghost.mode = 'house'
        ghost.houseTimer = 2000
        return
      }
      const dirs: Dir[] = ['up', 'down', 'left', 'right']
      const opposite: Record<string, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
      const valid = dirs.filter(d => {
        if (ghost.dir && d === opposite[ghost.dir]) return false
        const { dr, dc } = dirDelta(d)
        const nr = ghost.row + dr
        const nc = wrapCol(ghost.row, ghost.col + dc)
        return isGhostPassable(maze, nr, nc)
      })
      if (valid.length === 0) {
        const allDirs = dirs.filter(d => {
          const { dr, dc } = dirDelta(d)
          return isGhostPassable(maze, ghost.row + dr, ghost.col + dc)
        })
        if (allDirs.length > 0) {
          const best = allDirs.reduce((a, b) => {
            const da = dirDelta(a), db = dirDelta(b)
            return manhattanDist(ghost.row + da.dr, ghost.col + da.dc, targetR, targetC) <
                   manhattanDist(ghost.row + db.dr, ghost.col + db.dc, targetR, targetC) ? a : b
          })
          const { dr, dc } = dirDelta(best)
          ghost.row += dr
          ghost.col = wrapCol(ghost.row, ghost.col + dc)
          ghost.dir = best
        }
        return
      }
      const best = valid.reduce((a, b) => {
        const da = dirDelta(a), db = dirDelta(b)
        return manhattanDist(ghost.row + da.dr, ghost.col + da.dc, targetR, targetC) <
               manhattanDist(ghost.row + db.dr, ghost.col + db.dc, targetR, targetC) ? a : b
      })
      const { dr, dc } = dirDelta(best)
      ghost.row += dr
      ghost.col = wrapCol(ghost.row, ghost.col + dc)
      ghost.dir = best
      return
    }

    const validDirs = getGhostDirs(ghost)
    if (validDirs.length === 0) {
      const all: Dir[] = ['up', 'down', 'left', 'right']
      const any = all.filter(d => {
        const { dr, dc } = dirDelta(d)
        return isGhostPassable(maze, ghost.row + dr, ghost.col + dc)
      })
      if (any.length > 0) ghost.dir = any[0]
      return
    }

    let chosenDir: Dir = validDirs[0]

    if (ghost.mode === 'frightened') {
      chosenDir = validDirs[Math.floor(Math.random() * validDirs.length)]
    } else {
      let targetR: number, targetC: number
      if (ghost.mode === 'scatter') {
        targetR = ghost.cornerRow
        targetC = ghost.cornerCol
      } else {
        const d1 = manhattanDist(ghost.row, ghost.col, p1.row, p1.col)
        const d2 = manhattanDist(ghost.row, ghost.col, p2.row, p2.col)
        if (d1 < d2) { targetR = p1.row; targetC = p1.col }
        else          { targetR = p2.row; targetC = p2.col }
      }
      chosenDir = validDirs.reduce((best, d) => {
        const db = dirDelta(best), dd = dirDelta(d)
        return manhattanDist(ghost.row + dd.dr, ghost.col + dd.dc, targetR, targetC) <
               manhattanDist(ghost.row + db.dr, ghost.col + db.dc, targetR, targetC) ? d : best
      })
    }

    ghost.dir = chosenDir
    const { dr, dc } = dirDelta(chosenDir)
    ghost.row += dr
    ghost.col = wrapCol(ghost.row, ghost.col + dc)
  }

  function updateModeTimer(dt: number) {
    if (modePhaseRef.current >= 3) return
    modeTimerRef.current -= dt
    if (modeTimerRef.current <= 0) {
      modePhaseRef.current++
      if (modePhaseRef.current === 1) modeTimerRef.current = CHASE_1
      else if (modePhaseRef.current === 2) modeTimerRef.current = SCATTER_2
      else modeTimerRef.current = Infinity
      for (const g of ghostsRef.current) {
        if (g.mode === 'chase' || g.mode === 'scatter') {
          const newMode = modePhaseRef.current % 2 === 0 ? 'scatter' : 'chase'
          g.prevMode = newMode
          g.mode = newMode
          const opposite: Record<string, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
          if (g.dir) g.dir = opposite[g.dir] ?? null
        }
      }
    }
  }

  function movePlayer(player: PlayerState): boolean {
    const maze = mazeRef.current
    const anyFrightened = ghostsRef.current.some(g => g.mode === 'frightened')
    const speed = anyFrightened ? POWER_TICK : MOVE_TICK

    if (player.nextDir) {
      const { dr, dc } = dirDelta(player.nextDir)
      const nr = player.row + dr
      let nc = player.col + dc
      if (player.row === TUNNEL_ROW) nc = wrapCol(player.row, nc)
      if (isPlayerPassable(maze, nr, nc)) {
        player.dir = player.nextDir
        player.nextDir = null
      }
    }

    if (player.dir) {
      const { dr, dc } = dirDelta(player.dir)
      const nr = player.row + dr
      let nc = player.col + dc
      if (player.row === TUNNEL_ROW) nc = wrapCol(player.row, nc)
      if (isPlayerPassable(maze, nr, nc)) {
        player.row = nr
        player.col = nc
        return true
      }
    }
    return false
  }

  function collectDot(row: number, col: number) {
    const cell = mazeRef.current[row][col]
    if (cell === D) {
      mazeRef.current[row][col] = E
      scoreRef.current += 10
      dotsRemainingRef.current--
      eatenDotsRef.current.push({ row, col })
    } else if (cell === P) {
      mazeRef.current[row][col] = E
      scoreRef.current += 50
      dotsRemainingRef.current--
      eatenDotsRef.current.push({ row, col })
      frightenedChainRef.current = 0
      for (const g of ghostsRef.current) {
        if (g.mode !== 'dead' && g.mode !== 'house') {
          g.prevMode = g.mode === 'frightened' ? g.prevMode : g.mode
          g.mode = 'frightened'
          g.frightTimer = FRIGHTENED_DURATION
        }
      }
    }
  }

  function checkPlayerGhostCollision() {
    const p1 = p1Ref.current
    const p2 = p2Ref.current

    for (const g of ghostsRef.current) {
      if (g.mode === 'house' || g.mode === 'dead') continue

      const hitP1 = g.row === p1.row && g.col === p1.col
      const hitP2 = g.row === p2.row && g.col === p2.col

      if (hitP1 || hitP2) {
        if (g.mode === 'frightened') {
          frightenedChainRef.current++
          const val = 200 * Math.pow(2, frightenedChainRef.current - 1)
          scoreRef.current += val
          g.mode = 'dead'
          g.deadTimer = 5000
        } else {
          if (phaseRef.current === 'playing') {
            phaseRef.current = 'dying'
            dyingTimerRef.current = 1500
            livesRef.current--
          }
        }
      }
    }
  }

  // ── HOST: broadcast state ────────────────────────────────────────────────────

  function broadcastState(now: number) {
    if (roomCode === 'demo') return
    const ch = chRef.current
    if (!ch) return
    if (now - lastBroadcastRef.current < 100) return
    lastBroadcastRef.current = now

    const p1 = p1Ref.current
    const p2 = p2Ref.current
    ch.send({
      type: 'broadcast',
      event: 'msg',
      payload: {
        type: 'state',
        p1: { row: p1.row, col: p1.col, dir: p1.dir, alive: p1.alive },
        p2: { row: p2.row, col: p2.col, dir: p2.dir, alive: p2.alive },
        ghosts: ghostsRef.current.map(g => ({ row: g.row, col: g.col, mode: g.mode, frightTimer: g.frightTimer, color: g.color })),
        score: scoreRef.current,
        lives: livesRef.current,
        phase: phaseRef.current,
        eatenDots: eatenDotsRef.current.map(d => `${d.row},${d.col}`).join('|'),
      },
    })
  }

  // ── DRAWING: shared helpers ──────────────────────────────────────────────────

  function drawMazeHost(ctx: CanvasRenderingContext2D, cs: number, tick: number) {
    const maze = mazeRef.current
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = maze[r][c]
        const x = c * cs
        const y = r * cs

        if (cell === W) {
          ctx.fillStyle = '#1a1a8e'
          ctx.fillRect(x, y, cs, cs)
          ctx.fillStyle = '#2a2ab8'
          ctx.fillRect(x + 1, y + 1, cs - 2, 2)
          ctx.fillRect(x + 1, y + 1, 2, cs - 2)
          ctx.fillStyle = '#0e0e60'
          ctx.fillRect(x + cs - 2, y + 1, 2, cs - 2)
          ctx.fillRect(x + 1, y + cs - 2, cs - 2, 2)
        } else if (cell === D) {
          ctx.fillStyle = '#ffff88'
          ctx.beginPath()
          ctx.arc(x + cs / 2, y + cs / 2, cs * 0.12, 0, Math.PI * 2)
          ctx.fill()
        } else if (cell === P) {
          const pulse = 0.3 + 0.08 * Math.sin(tick * 0.08)
          const col2 = tick % 20 < 10 ? '#ffffff' : '#ffff44'
          ctx.fillStyle = col2
          ctx.beginPath()
          ctx.arc(x + cs / 2, y + cs / 2, cs * pulse, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowColor = '#ffff88'
          ctx.shadowBlur = 6
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }
    }
    ctx.fillStyle = '#ff88ff44'
    ctx.fillRect(9 * cs, 5 * cs, cs, cs * 0.25)
  }

  function drawMazeGuest(ctx: CanvasRenderingContext2D, cs: number, tick: number, eatenSet: Set<string>) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = BASE_MAZE[r][c]
        const x = c * cs
        const y = r * cs
        const eaten = eatenSet.has(`${r},${c}`)

        if (cell === W) {
          ctx.fillStyle = '#1a1a8e'
          ctx.fillRect(x, y, cs, cs)
          ctx.fillStyle = '#2a2ab8'
          ctx.fillRect(x + 1, y + 1, cs - 2, 2)
          ctx.fillRect(x + 1, y + 1, 2, cs - 2)
          ctx.fillStyle = '#0e0e60'
          ctx.fillRect(x + cs - 2, y + 1, 2, cs - 2)
          ctx.fillRect(x + 1, y + cs - 2, cs - 2, 2)
        } else if (cell === D && !eaten) {
          ctx.fillStyle = '#ffff88'
          ctx.beginPath()
          ctx.arc(x + cs / 2, y + cs / 2, cs * 0.12, 0, Math.PI * 2)
          ctx.fill()
        } else if (cell === P && !eaten) {
          const pulse = 0.3 + 0.08 * Math.sin(tick * 0.08)
          const col2 = tick % 20 < 10 ? '#ffffff' : '#ffff44'
          ctx.fillStyle = col2
          ctx.beginPath()
          ctx.arc(x + cs / 2, y + cs / 2, cs * pulse, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowColor = '#ffff88'
          ctx.shadowBlur = 6
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }
    }
    ctx.fillStyle = '#ff88ff44'
    ctx.fillRect(9 * cs, 5 * cs, cs, cs * 0.25)
  }

  function drawPlayerShape(ctx: CanvasRenderingContext2D, row: number, col: number, dir: string | null, color: string, cs: number, tick: number) {
    const x = col * cs + cs / 2
    const y = row * cs + cs / 2
    const r = cs * 0.44
    const mouth = Math.abs(Math.sin(tick * 0.15)) * 0.4

    let angleOffset = 0
    switch (dir) {
      case 'right': angleOffset = 0; break
      case 'down':  angleOffset = Math.PI / 2; break
      case 'left':  angleOffset = Math.PI; break
      case 'up':    angleOffset = -Math.PI / 2; break
      default:      angleOffset = 0; break
    }

    const startAngle = angleOffset + mouth
    const endAngle   = angleOffset + Math.PI * 2 - mouth

    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 8
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, r, startAngle, endAngle)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    const eyeOffset = angleOffset + Math.PI / 2
    const ex1 = x + Math.cos(eyeOffset) * r * 0.45
    const ey1 = y + Math.sin(eyeOffset) * r * 0.45
    const ex2 = x + Math.cos(eyeOffset + Math.PI) * r * 0.45
    const ey2 = y + Math.sin(eyeOffset + Math.PI) * r * 0.45
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ex1, ey1, r * 0.18, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(ex2, ey2, r * 0.18, 0, Math.PI * 2)
    ctx.fill()
  }

  function drawGhostShape(ctx: CanvasRenderingContext2D, g: { row: number; col: number; mode: string; frightTimer: number; color: string; dir?: Dir }, cs: number, tick: number) {
    const x = g.col * cs + cs / 2
    const y = g.row * cs + cs / 2
    const r = cs * 0.44

    if (g.mode === 'dead') {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.2, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#2255ff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
      return
    }

    let bodyColor = g.color
    if (g.mode === 'frightened') {
      if (g.frightTimer < 2000) {
        bodyColor = tick % 20 < 10 ? '#ffffff' : '#2121de'
      } else {
        bodyColor = '#2121de'
      }
    }

    ctx.fillStyle = bodyColor
    ctx.shadowColor = bodyColor
    ctx.shadowBlur = 6

    const top = y - r
    const bot = y + r
    const left = x - r
    const right2 = x + r

    ctx.beginPath()
    ctx.arc(x, top + r * 0.6, r, Math.PI, 0)
    ctx.lineTo(right2, bot)
    const bumpW = (r * 2) / 3
    ctx.arc(right2 - bumpW * 0.5, bot, bumpW * 0.5, 0, Math.PI, true)
    ctx.arc(x, bot, bumpW * 0.5, 0, Math.PI, true)
    ctx.arc(left + bumpW * 0.5, bot, bumpW * 0.5, 0, Math.PI, true)
    ctx.lineTo(left, bot)
    ctx.lineTo(left, top + r * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    if (g.mode !== 'frightened') {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.22, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.22, 0, Math.PI * 2)
      ctx.fill()
      const dir = (g as any).dir
      const dx = dir === 'left' ? -1 : dir === 'right' ? 1 : 0
      const dy = dir === 'up' ? -1 : dir === 'down' ? 1 : 0
      ctx.fillStyle = '#2255ff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3 + dx * r * 0.08, y - r * 0.15 + dy * r * 0.08, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3 + dx * r * 0.08, y - r * 0.15 + dy * r * 0.08, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
    } else {
      ctx.fillStyle = bodyColor === '#ffffff' ? '#0000aa' : '#ffffff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = bodyColor === '#ffffff' ? '#0000aa' : '#ffffff'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x - r * 0.4, y + r * 0.2)
      ctx.lineTo(x - r * 0.2, y + r * 0.35)
      ctx.lineTo(x, y + r * 0.2)
      ctx.lineTo(x + r * 0.2, y + r * 0.35)
      ctx.lineTo(x + r * 0.4, y + r * 0.2)
      ctx.stroke()
    }
  }

  // ── HOST: draw ───────────────────────────────────────────────────────────────

  function drawHost(cs: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tick = tickRef.current
    const phase = phaseRef.current
    const p1 = p1Ref.current
    const p2 = p2Ref.current

    ctx.fillStyle = '#0a0010'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    drawMazeHost(ctx, cs, tick)

    for (const g of ghostsRef.current) {
      if (g.mode === 'house' && g.houseTimer > g.exitDelay) continue
      drawGhostShape(ctx, g, cs, tick)
    }

    const dyingFlash = phase === 'dying' && Math.floor(tick / 8) % 2 === 0
    if (!dyingFlash) {
      drawPlayerShape(ctx, p1.row, p1.col, p1.dir, '#8844cc', cs, tick)
      drawPlayerShape(ctx, p2.row, p2.col, p2.dir, '#dd4477', cs, tick)
    }

    if (phase === 'start') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, ROWS * cs / 2 - 20, COLS * cs, 40)
      ctx.font = `bold ${cs * 1.2}px monospace`
      ctx.fillStyle = '#ffff00'
      ctx.textAlign = 'center'
      ctx.shadowColor = '#ffff00'
      ctx.shadowBlur = 12
      ctx.fillText('READY!', (COLS * cs) / 2, ROWS * cs / 2 + 8)
      ctx.shadowBlur = 0
    }

    if (phase === 'victory') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, ROWS * cs / 2 - 25, COLS * cs, 50)
      ctx.font = `bold ${cs * 1.0}px monospace`
      ctx.fillStyle = '#00ff88'
      ctx.textAlign = 'center'
      ctx.shadowColor = '#00ff88'
      ctx.shadowBlur = 14
      ctx.fillText('STAGE CLEAR!', (COLS * cs) / 2, ROWS * cs / 2 + 8)
      ctx.shadowBlur = 0
    }

    if (phase === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillRect(0, ROWS * cs / 2 - 25, COLS * cs, 50)
      ctx.font = `bold ${cs * 1.1}px monospace`
      ctx.fillStyle = '#ff4444'
      ctx.textAlign = 'center'
      ctx.shadowColor = '#ff4444'
      ctx.shadowBlur = 14
      ctx.fillText('GAME OVER', (COLS * cs) / 2, ROWS * cs / 2 + 8)
      ctx.shadowBlur = 0
    }

    // HOST badge
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(4, 4, 72, 18)
    ctx.font = `bold ${Math.max(9, cs * 0.55)}px monospace`
    ctx.fillStyle = '#aaddff'
    ctx.textAlign = 'left'
    ctx.fillText('HOST', 8, 17)
  }

  // ── GUEST: draw ──────────────────────────────────────────────────────────────

  const eatenDotsSetRef = useRef<Set<string>>(new Set())

  function drawGuest(cs: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const state = receivedStateRef.current
    guestTickRef.current += 1
    const tick = guestTickRef.current

    ctx.fillStyle = '#0a0010'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    drawMazeGuest(ctx, cs, tick, eatenDotsSetRef.current)

    if (state) {
      for (const g of state.ghosts) {
        drawGhostShape(ctx, g, cs, tick)
      }
      drawPlayerShape(ctx, state.p1.row, state.p1.col, state.p1.dir, '#8844cc', cs, tick)
      drawPlayerShape(ctx, state.p2.row, state.p2.col, state.p2.dir, '#dd4477', cs, tick)

      const phase = state.phase
      if (phase === 'start') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.fillRect(0, ROWS * cs / 2 - 20, COLS * cs, 40)
        ctx.font = `bold ${cs * 1.2}px monospace`
        ctx.fillStyle = '#ffff00'
        ctx.textAlign = 'center'
        ctx.shadowColor = '#ffff00'
        ctx.shadowBlur = 12
        ctx.fillText('READY!', (COLS * cs) / 2, ROWS * cs / 2 + 8)
        ctx.shadowBlur = 0
      }
      if (phase === 'victory') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'
        ctx.fillRect(0, ROWS * cs / 2 - 25, COLS * cs, 50)
        ctx.font = `bold ${cs * 1.0}px monospace`
        ctx.fillStyle = '#00ff88'
        ctx.textAlign = 'center'
        ctx.shadowColor = '#00ff88'
        ctx.shadowBlur = 14
        ctx.fillText('STAGE CLEAR!', (COLS * cs) / 2, ROWS * cs / 2 + 8)
        ctx.shadowBlur = 0
      }
      if (phase === 'gameover') {
        ctx.fillStyle = 'rgba(0,0,0,0.65)'
        ctx.fillRect(0, ROWS * cs / 2 - 25, COLS * cs, 50)
        ctx.font = `bold ${cs * 1.1}px monospace`
        ctx.fillStyle = '#ff4444'
        ctx.textAlign = 'center'
        ctx.shadowColor = '#ff4444'
        ctx.shadowBlur = 14
        ctx.fillText('GAME OVER', (COLS * cs) / 2, ROWS * cs / 2 + 8)
        ctx.shadowBlur = 0
      }
    }

    // Connection overlay
    const now = Date.now()
    const sinceMsg = now - lastMsgTimeRef.current
    if (sinceMsg > 3000) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = `bold ${cs * 1.0}px monospace`
      ctx.fillStyle = '#ff8844'
      ctx.textAlign = 'center'
      ctx.fillText('Connection lost...', canvas.width / 2, canvas.height / 2)
    } else if (!state) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.font = `bold ${cs * 0.9}px monospace`
      ctx.fillStyle = '#88aaff'
      ctx.textAlign = 'center'
      ctx.fillText('Connecting to host...', canvas.width / 2, canvas.height / 2)
    }
  }

  // ── HOST: game loop ──────────────────────────────────────────────────────────

  const hostGameLoop = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time
    const dt = Math.min(time - lastTimeRef.current, 100)
    lastTimeRef.current = time
    tickRef.current += 1

    const phase = phaseRef.current
    const cs = cellSizeRef.current

    if (phase === 'start') {
      phaseTimerRef.current -= dt
      if (phaseTimerRef.current <= 0) {
        phaseRef.current = 'playing'
        setUiPhase('playing')
      }
    }

    if (phase === 'dying') {
      dyingTimerRef.current -= dt
      if (dyingTimerRef.current <= 0) {
        if (livesRef.current <= 0) {
          phaseRef.current = 'gameover'
          setUiPhase('gameover')
        } else {
          p1Ref.current = { row: 17, col: 7, dir: null, nextDir: null, alive: true }
          p2Ref.current = { row: 17, col: 11, dir: null, nextDir: null, alive: true }
          initGhosts()
          phaseRef.current = 'playing'
          setUiPhase('playing')
          setUiLives(livesRef.current)
        }
      }
    }

    if (phase === 'victory') {
      phaseTimerRef.current -= dt
      if (phaseTimerRef.current <= 0) {
        phaseRef.current = 'gameover'
        setUiPhase('gameover')
      }
    }

    if (phase === 'playing') {
      updateModeTimer(dt)

      const anyFrightened = ghostsRef.current.some(g => g.mode === 'frightened')
      const tick_speed = anyFrightened ? POWER_TICK : MOVE_TICK

      // Apply remote inputs for P1
      if (p1RemoteDir.current) {
        p1Ref.current.nextDir = p1RemoteDir.current
        p1RemoteDir.current = null
      }
      // Apply remote inputs for P2
      if (p2RemoteDir.current) {
        p2Ref.current.nextDir = p2RemoteDir.current
        p2RemoteDir.current = null
      }

      p1MoveAccRef.current += dt
      if (p1MoveAccRef.current >= tick_speed) {
        p1MoveAccRef.current -= tick_speed
        movePlayer(p1Ref.current)
        collectDot(p1Ref.current.row, p1Ref.current.col)
      }

      p2MoveAccRef.current += dt
      if (p2MoveAccRef.current >= tick_speed) {
        p2MoveAccRef.current -= tick_speed
        movePlayer(p2Ref.current)
        collectDot(p2Ref.current.row, p2Ref.current.col)
      }

      ghostMoveAccRef.current += dt
      if (ghostMoveAccRef.current >= tick_speed * 1.1) {
        ghostMoveAccRef.current -= tick_speed * 1.1
        for (const g of ghostsRef.current) {
          moveGhost(g, tick_speed * 1.1)
        }
      }

      checkPlayerGhostCollision()

      if (dotsRemainingRef.current <= 0) {
        phaseRef.current = 'victory'
        phaseTimerRef.current = 2500
        setUiPhase('victory')
      }

      setUiScore(scoreRef.current)
    }

    drawHost(cs)
    broadcastState(time)
    rafRef.current = requestAnimationFrame(hostGameLoop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── GUEST: render loop ───────────────────────────────────────────────────────

  const guestRenderLoop = useCallback(() => {
    const state = receivedStateRef.current
    if (state) {
      setUiScore(state.score)
      setUiLives(state.lives)

      const sinceMsg = Date.now() - lastMsgTimeRef.current
      if (sinceMsg > 3000) {
        setConnStatus('lost')
      } else {
        setConnStatus('live')
      }
    }
    drawGuest(cellSizeRef.current)
    rafRef.current = requestAnimationFrame(guestRenderLoop)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell size computation ─────────────────────────────────────────────────────

  useEffect(() => {
    function computeSize() {
      const el = containerRef.current
      if (!el) return
      const w = el.clientWidth - 4
      const cs = Math.min(22, Math.floor(w / COLS))
      setCellSize(cs)
      cellSizeRef.current = cs
      const canvas = canvasRef.current
      if (canvas) {
        canvas.width = COLS * cs
        canvas.height = ROWS * cs
      }
    }
    computeSize()
    window.addEventListener('resize', computeSize)
    return () => window.removeEventListener('resize', computeSize)
  }, [])

  // ── Supabase channel setup ────────────────────────────────────────────────────

  useEffect(() => {
    const ch = supabase.channel(`arcade:pacman:${roomCode}`)
    chRef.current = ch

    if (mpRole === 'host') {
      ch.on('broadcast', { event: 'msg' }, ({ payload }: { payload: any }) => {
        if (payload.type === 'input') {
          if (payload.role === 'p1') p1RemoteDir.current = payload.dir as Dir
          if (payload.role === 'p2') p2RemoteDir.current = payload.dir as Dir
        }
      })
    } else {
      ch.on('broadcast', { event: 'msg' }, ({ payload }: { payload: any }) => {
        if (payload.type === 'state') {
          receivedStateRef.current = payload as ReceivedState
          lastMsgTimeRef.current = Date.now()
          setConnStatus('live')

          if (payload.eatenDots) {
            const newSet = new Set<string>()
            if (payload.eatenDots.length > 0) {
              payload.eatenDots.split('|').forEach((s: string) => newSet.add(s))
            }
            eatenDotsSetRef.current = newSet
          } else {
            eatenDotsSetRef.current = new Set()
          }
        }
      })
    }

    ch.subscribe()

    return () => {
      supabase.removeChannel(ch)
      chRef.current = null
    }
  }, [roomCode, mpRole]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start game loop ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (mpRole === 'host') {
      resetGame()
      lastTimeRef.current = 0
      rafRef.current = requestAnimationFrame(hostGameLoop)
    } else {
      rafRef.current = requestAnimationFrame(guestRenderLoop)
    }
    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [mpRole, hostGameLoop, guestRenderLoop]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard input ────────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (mpRole === 'host') {
        const p1 = p1Ref.current
        const p2 = p2Ref.current
        switch (e.key) {
          case 'w': case 'W': p1.nextDir = 'up';    e.preventDefault(); break
          case 'a': case 'A': p1.nextDir = 'left';  e.preventDefault(); break
          case 's': case 'S': p1.nextDir = 'down';  e.preventDefault(); break
          case 'd': case 'D': p1.nextDir = 'right'; e.preventDefault(); break
          case 'ArrowUp':    p1.nextDir = 'up';    e.preventDefault(); break
          case 'ArrowLeft':  p1.nextDir = 'left';  e.preventDefault(); break
          case 'ArrowDown':  p1.nextDir = 'down';  e.preventDefault(); break
          case 'ArrowRight': p1.nextDir = 'right'; e.preventDefault(); break
          case 'i': case 'I': p2.nextDir = 'up';    e.preventDefault(); break
          case 'j': case 'J': p2.nextDir = 'left';  e.preventDefault(); break
          case 'k': case 'K': p2.nextDir = 'down';  e.preventDefault(); break
          case 'l': case 'L': p2.nextDir = 'right'; e.preventDefault(); break
        }
      } else if (mpRole === 'p1') {
        let dir: Dir = null
        switch (e.key) {
          case 'w': case 'W': case 'ArrowUp':    dir = 'up';    e.preventDefault(); break
          case 'a': case 'A': case 'ArrowLeft':  dir = 'left';  e.preventDefault(); break
          case 's': case 'S': case 'ArrowDown':  dir = 'down';  e.preventDefault(); break
          case 'd': case 'D': case 'ArrowRight': dir = 'right'; e.preventDefault(); break
        }
        if (dir) sendInput(dir)
      } else if (mpRole === 'p2') {
        let dir: Dir = null
        switch (e.key) {
          case 'i': case 'I': dir = 'up';    e.preventDefault(); break
          case 'j': case 'J': dir = 'left';  e.preventDefault(); break
          case 'k': case 'K': dir = 'down';  e.preventDefault(); break
          case 'l': case 'L': dir = 'right'; e.preventDefault(); break
        }
        if (dir) sendInput(dir)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mpRole]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Guest input ───────────────────────────────────────────────────────────────

  function sendInput(dir: string) {
    const ch = chRef.current
    if (!ch) return
    ch.send({
      type: 'broadcast',
      event: 'msg',
      payload: { type: 'input', role: mpRole, dir },
    })
  }

  // ── Badge info ────────────────────────────────────────────────────────────────

  const badgeLabel = mpRole === 'host' ? '🖥️ HOST' : mpRole === 'p1' ? '🟣 P1' : '🩷 P2'
  const badgeColor = mpRole === 'host' ? '#aaddff' : mpRole === 'p1' ? '#cc88ff' : '#ff88cc'
  const playerColor = mpRole === 'p1' ? '#cc88ff' : '#ff88cc'

  const displayScore = mpRole === 'host' ? uiScore : (receivedStateRef.current?.score ?? 0)
  const displayLives = mpRole === 'host' ? uiLives : (receivedStateRef.current?.lives ?? 3)

  // ── D-pad button ──────────────────────────────────────────────────────────────

  const DPadBtn = ({ dir, label }: { dir: string; label: string }) => (
    <button
      onPointerDown={e => { e.preventDefault(); if (mpRole !== 'host') { sendInput(dir) } else {
        const p = mpRole === 'host' ? (dir === 'up' || dir === 'down' || dir === 'left' || dir === 'right' ? null : null) : null
      }}}
      style={{
        width: 56,
        height: 56,
        background: '#1a0a2e',
        border: `2px solid ${badgeColor}44`,
        borderRadius: 8,
        color: badgeColor,
        fontSize: 22,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        transition: 'background 0.1s',
      }}
      onPointerEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a1a4e' }}
      onPointerLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#1a0a2e' }}
    >{label}</button>
  )

  // For host, d-pad controls p1 by default (since host can use keyboard too)
  const handleDpad = (dir: string) => {
    if (mpRole === 'host') {
      p1Ref.current.nextDir = dir as Dir
    } else {
      sendInput(dir)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      background: '#0a0010',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
    }}>
      <style>{`
        @keyframes mp-glow { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      {/* Top bar */}
      <div style={{
        width: '100%',
        maxWidth: 500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(0,0,0,0.6)',
        borderBottom: `1px solid ${badgeColor}33`,
        flexShrink: 0,
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            color: '#aaa',
            borderRadius: 6,
            padding: '3px 10px',
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'monospace',
          }}
        >✕</button>

        {/* Badge */}
        <div style={{
          fontFamily: 'monospace',
          fontWeight: 900,
          fontSize: 15,
          color: badgeColor,
          letterSpacing: '0.08em',
          textShadow: `0 0 8px ${badgeColor}88`,
        }}>{badgeLabel}</div>

        {/* Score + Lives */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'monospace', color: '#ffff88', fontSize: 13, fontWeight: 700 }}>
            {displayScore.toLocaleString()}
          </span>
          <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
            {'❤️'.repeat(Math.max(0, displayLives))}
          </span>
        </div>
      </div>

      {/* Guest header bar */}
      {mpRole !== 'host' && (
        <div style={{
          width: '100%',
          maxWidth: 500,
          padding: '6px 16px',
          background: `${playerColor}18`,
          borderBottom: `1px solid ${playerColor}33`,
          textAlign: 'center',
          fontFamily: 'monospace',
          fontSize: 12,
          color: playerColor,
          letterSpacing: '0.1em',
        }}>
          {mpRole === 'p1' ? 'YOU ARE 🟣 PLAYER 1' : 'YOU ARE 🩷 PLAYER 2'}
          {connStatus === 'connecting' && ' · Connecting...'}
          {connStatus === 'lost' && ' · Connection lost!'}
          {connStatus === 'live' && ' · Live'}
        </div>
      )}

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{
          width: '100%',
          maxWidth: 500,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '8px 2px',
          flexShrink: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          width={COLS * cellSize}
          height={ROWS * cellSize}
          style={{
            border: `2px solid ${badgeColor}44`,
            borderRadius: 4,
            imageRendering: 'pixelated',
          }}
        />
      </div>

      {/* D-pad */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '56px 56px 56px',
        gridTemplateRows: '56px 56px 56px',
        gap: 4,
        marginTop: 8,
        marginBottom: 16,
      }}>
        {/* Row 1: empty, up, empty */}
        <div />
        <button
          onPointerDown={e => { e.preventDefault(); handleDpad('up') }}
          style={{ width: 56, height: 56, background: '#1a0a2e', border: `2px solid ${badgeColor}44`, borderRadius: 8, color: badgeColor, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
        >▲</button>
        <div />
        {/* Row 2: left, empty center, right */}
        <button
          onPointerDown={e => { e.preventDefault(); handleDpad('left') }}
          style={{ width: 56, height: 56, background: '#1a0a2e', border: `2px solid ${badgeColor}44`, borderRadius: 8, color: badgeColor, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
        >◀</button>
        <div style={{ width: 56, height: 56, background: '#0d0020', borderRadius: 8, border: `1px solid #2a1a4e` }} />
        <button
          onPointerDown={e => { e.preventDefault(); handleDpad('right') }}
          style={{ width: 56, height: 56, background: '#1a0a2e', border: `2px solid ${badgeColor}44`, borderRadius: 8, color: badgeColor, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
        >▶</button>
        {/* Row 3: empty, down, empty */}
        <div />
        <button
          onPointerDown={e => { e.preventDefault(); handleDpad('down') }}
          style={{ width: 56, height: 56, background: '#1a0a2e', border: `2px solid ${badgeColor}44`, borderRadius: 8, color: badgeColor, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}
        >▼</button>
        <div />
      </div>

      {/* Host restart button */}
      {mpRole === 'host' && (uiPhase === 'gameover' || uiPhase === 'victory') && (
        <button
          onClick={() => {
            resetGame()
            lastTimeRef.current = 0
          }}
          style={{
            background: '#ffcc00',
            color: '#1a1000',
            border: 'none',
            borderRadius: 8,
            padding: '10px 28px',
            fontFamily: 'monospace',
            fontWeight: 900,
            fontSize: 14,
            cursor: 'pointer',
            letterSpacing: '0.08em',
            marginBottom: 16,
          }}
        >▶ PLAY AGAIN</button>
      )}
    </div>
  )
}
