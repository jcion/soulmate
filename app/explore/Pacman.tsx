'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { getPacmanAudio } from '@/lib/PacmanAudio'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Props {
  darkMode:      boolean
  locationName:  string
  locationColor: string
  onClose:       () => void
}

type Phase = 'start' | 'playing' | 'dying' | 'victory' | 'gameover' | 'initials' | 'scores'
type Dir = 'up' | 'down' | 'left' | 'right' | null
type GhostMode = 'house' | 'chase' | 'scatter' | 'frightened' | 'dead'

interface Player {
  row: number
  col: number
  dir: Dir
  nextDir: Dir
  mouthAngle: number
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

interface ScoreEntry {
  score: number
  initials: string
  date: string
}

interface EatenPopup {
  row: number
  col: number
  value: number
  timer: number
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

const SCORE_KEY = 'soulmate_pacman_scores'

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
  // Tunnel row wraps
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
  // Ghost door: col 9, rows 5-8 — players cannot pass
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

function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ScoreEntry[]
  } catch { return [] }
}

function saveScore(entry: ScoreEntry): ScoreEntry[] {
  const list = loadScores()
  list.push(entry)
  list.sort((a, b) => b.score - a.score)
  const trimmed = list.slice(0, 10)
  localStorage.setItem(SCORE_KEY, JSON.stringify(trimmed))
  return trimmed
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function Pacman({ darkMode, locationName, locationColor, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  // Game state (mutable, no re-render)
  const mazeRef      = useRef<number[][]>(cloneMaze())
  const player1Ref   = useRef<Player>({ row: 17, col: 7,  dir: null, nextDir: null, mouthAngle: 0 })
  const player2Ref   = useRef<Player>({ row: 17, col: 11, dir: null, nextDir: null, mouthAngle: 0 })
  const ghostsRef    = useRef<Ghost[]>([])
  const scoreRef     = useRef<number>(0)
  const livesRef     = useRef<number>(3)
  const tickRef      = useRef<number>(0)
  const phaseRef     = useRef<Phase>('start')
  const phaseTimerRef = useRef<number>(0)
  const p1MoveAccRef = useRef<number>(0)
  const p2MoveAccRef = useRef<number>(0)
  const ghostMoveAccRef = useRef<number>(0)
  const modeTimerRef = useRef<number>(0)
  const modePhaseRef = useRef<number>(0) // 0=scatter1, 1=chase1, 2=scatter2, 3=chase-forever
  const frightenedChainRef = useRef<number>(0)
  const popupsRef = useRef<EatenPopup[]>([])
  const dotsRemainingRef = useRef<number>(0)
  const dyingTimerRef = useRef<number>(0)

  // React state (for UI)
  const [uiScore, setUiScore] = useState(0)
  const [uiLives, setUiLives] = useState(3)
  const [uiPhase, setUiPhase] = useState<Phase>('start')
  const [cellSize, setCellSize] = useState(20)
  const [muted, setMuted] = useState(false)

  // Audio
  const audio = getPacmanAudio()

  // Track frightened state for BGM switching
  const wasFrightenedRef = useRef(false)

  // Initials entry
  const [initials, setInitials] = useState(['A', 'A', 'A'])
  const [initialsPos, setInitialsPos] = useState(0)
  const [scoresList, setScoresList] = useState<ScoreEntry[]>([])

  // ── Init ghosts ──────────────────────────────────────────────────────────────

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

  // ── Reset game ───────────────────────────────────────────────────────────────

  function resetGame() {
    mazeRef.current = cloneMaze()
    player1Ref.current = { row: 17, col: 7,  dir: null, nextDir: null, mouthAngle: 0 }
    player2Ref.current = { row: 17, col: 11, dir: null, nextDir: null, mouthAngle: 0 }
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
    popupsRef.current = []
    dyingTimerRef.current = 0
    dotsRemainingRef.current = countDots(mazeRef.current)
    initGhosts()
    setUiScore(0)
    setUiLives(3)
    setUiPhase('start')
  }

  // ── Ghost movement helpers ───────────────────────────────────────────────────

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
    const p1 = player1Ref.current
    const p2 = player2Ref.current

    // Update timers
    if (ghost.mode === 'house') {
      ghost.houseTimer -= dt
      if (ghost.houseTimer <= 0) {
        // Move toward exit: col 9, row 8 then up to row 5
        // Move toward col 9 first
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
      // Rush to ghost house entrance (row 8, col 9)
      ghost.deadTimer -= dt
      const targetR = 9, targetC = 9
      if (ghost.row === targetR && ghost.col === targetC) {
        ghost.mode = 'house'
        ghost.houseTimer = 2000
        return
      }
      // Path toward target
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

    // Get valid directions (no reversing unless mode just changed)
    const validDirs = getGhostDirs(ghost)
    if (validDirs.length === 0) {
      // Can reverse if stuck
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
      // Choose target based on mode
      let targetR: number, targetC: number
      if (ghost.mode === 'scatter') {
        targetR = ghost.cornerRow
        targetC = ghost.cornerCol
      } else {
        // chase: target nearest player
        const d1 = manhattanDist(ghost.row, ghost.col, p1.row, p1.col)
        const d2 = manhattanDist(ghost.row, ghost.col, p2.row, p2.col)
        if (d1 < d2) { targetR = p1.row; targetC = p1.col }
        else          { targetR = p2.row; targetC = p2.col }
      }
      // Pick direction minimizing distance to target
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

  // ── Mode alternation ─────────────────────────────────────────────────────────

  function updateModeTimer(dt: number) {
    if (modePhaseRef.current >= 3) return // chase forever
    modeTimerRef.current -= dt
    if (modeTimerRef.current <= 0) {
      modePhaseRef.current++
      if (modePhaseRef.current === 1) modeTimerRef.current = CHASE_1
      else if (modePhaseRef.current === 2) modeTimerRef.current = SCATTER_2
      else modeTimerRef.current = Infinity
      // Switch ghost modes (except frightened/dead/house)
      for (const g of ghostsRef.current) {
        if (g.mode === 'chase' || g.mode === 'scatter') {
          const newMode = modePhaseRef.current % 2 === 0 ? 'scatter' : 'chase'
          g.prevMode = newMode
          g.mode = newMode
          // Reverse direction on mode switch
          const opposite: Record<string, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }
          if (g.dir) g.dir = opposite[g.dir] ?? null
        }
      }
    }
  }

  // ── Player movement ──────────────────────────────────────────────────────────

  function movePlayer(player: Player, isPowered: boolean): boolean {
    const maze = mazeRef.current
    const speed = isPowered ? POWER_TICK : MOVE_TICK

    // Try next direction first
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

    // Move in current direction
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
      audio.playWaka()
    } else if (cell === P) {
      mazeRef.current[row][col] = E
      scoreRef.current += 50
      dotsRemainingRef.current--
      audio.playPowerPellet()
      audio.startPowerMode()
      wasFrightenedRef.current = true
      // Activate frightened mode
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

  // ── Collision detection ──────────────────────────────────────────────────────

  function checkPlayerGhostCollision() {
    const p1 = player1Ref.current
    const p2 = player2Ref.current

    for (const g of ghostsRef.current) {
      if (g.mode === 'house' || g.mode === 'dead') continue

      const hitP1 = g.row === p1.row && g.col === p1.col
      const hitP2 = g.row === p2.row && g.col === p2.col

      if (hitP1 || hitP2) {
        if (g.mode === 'frightened') {
          // Eat ghost
          frightenedChainRef.current++
          const val = 200 * Math.pow(2, frightenedChainRef.current - 1)
          scoreRef.current += val
          popupsRef.current.push({
            row: g.row, col: g.col, value: val, timer: 1500
          })
          g.mode = 'dead'
          g.deadTimer = 5000
          audio.playGhostEaten()
        } else {
          // Player caught
          if (phaseRef.current === 'playing') {
            phaseRef.current = 'dying'
            dyingTimerRef.current = 1500
            livesRef.current--
            audio.stopBGM()
            audio.playDeath()
          }
        }
      }
    }
  }

  // ── Drawing ──────────────────────────────────────────────────────────────────

  function draw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const cs = cellSize
    const maze = mazeRef.current
    const tick = tickRef.current
    const phase = phaseRef.current
    const p1 = player1Ref.current
    const p2 = player2Ref.current

    // Background
    ctx.fillStyle = '#0a0010'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = maze[r][c]
        const x = c * cs
        const y = r * cs

        if (cell === W) {
          // Wall with 3D effect
          ctx.fillStyle = '#1a1a8e'
          ctx.fillRect(x, y, cs, cs)
          // Inner lighter edge
          ctx.fillStyle = '#2a2ab8'
          ctx.fillRect(x + 1, y + 1, cs - 2, 2)
          ctx.fillRect(x + 1, y + 1, 2, cs - 2)
          ctx.fillStyle = '#0e0e60'
          ctx.fillRect(x + cs - 2, y + 1, 2, cs - 2)
          ctx.fillRect(x + 1, y + cs - 2, cs - 2, 2)
        } else if (cell === D) {
          // Dot
          ctx.fillStyle = '#ffff88'
          ctx.beginPath()
          ctx.arc(x + cs / 2, y + cs / 2, cs * 0.12, 0, Math.PI * 2)
          ctx.fill()
        } else if (cell === P) {
          // Power pellet pulsing
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
        // E and G (empty/ghost area) — just dark background
      }
    }

    // Draw ghost door (visual indicator)
    ctx.fillStyle = '#ff88ff44'
    ctx.fillRect(9 * cs, 5 * cs, cs, cs * 0.25)

    // Draw popups
    const now = Date.now()
    popupsRef.current = popupsRef.current.filter(p => p.timer > 0)
    for (const popup of popupsRef.current) {
      const alpha = Math.min(1, popup.timer / 500)
      ctx.fillStyle = `rgba(255, 255, 136, ${alpha})`
      ctx.font = `bold ${Math.max(8, cs * 0.6)}px monospace`
      ctx.textAlign = 'center'
      ctx.fillText(String(popup.value), popup.col * cs + cs / 2, popup.row * cs)
      popup.timer -= 16
    }

    // Draw ghosts
    for (const g of ghostsRef.current) {
      if (g.mode === 'house' && g.houseTimer > g.exitDelay) continue
      drawGhost(ctx, g, cs, tick)
    }

    // Draw players
    const dyingFlash = phase === 'dying' && Math.floor(tick / 8) % 2 === 0
    if (!dyingFlash) {
      drawPlayer(ctx, p1, cs, tick, '#8844cc')
      drawPlayer(ctx, p2, cs, tick, '#dd4477')
    }

    // Overlays
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

  function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, cs: number, tick: number, color: string) {
    const x = p.col * cs + cs / 2
    const y = p.row * cs + cs / 2
    const r = cs * 0.44
    const mouth = Math.abs(Math.sin(tick * 0.15)) * 0.4

    // Determine angle offset based on direction
    let angleOffset = 0
    switch (p.dir) {
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

    // Eyes
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

  function drawGhost(ctx: CanvasRenderingContext2D, g: Ghost, cs: number, tick: number) {
    const x = g.col * cs + cs / 2
    const y = g.row * cs + cs / 2
    const r = cs * 0.44

    let bodyColor = g.color
    if (g.mode === 'dead') {
      // Just draw eyes
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

    if (g.mode === 'frightened') {
      // Flash last 2 seconds
      if (g.frightTimer < 2000) {
        bodyColor = tick % 20 < 10 ? '#ffffff' : '#2121de'
      } else {
        bodyColor = '#2121de'
      }
    }

    ctx.fillStyle = bodyColor
    ctx.shadowColor = bodyColor
    ctx.shadowBlur = 6

    // Ghost body: rounded top half + straight bottom with bumps
    const top = y - r
    const bot = y + r
    const left = x - r
    const right = x + r

    ctx.beginPath()
    ctx.arc(x, top + r * 0.6, r, Math.PI, 0) // rounded top
    ctx.lineTo(right, bot)
    // 3 bumps at bottom
    const bumpW = (r * 2) / 3
    ctx.arc(right - bumpW * 0.5, bot, bumpW * 0.5, 0, Math.PI, true)
    ctx.arc(x, bot, bumpW * 0.5, 0, Math.PI, true)
    ctx.arc(left + bumpW * 0.5, bot, bumpW * 0.5, 0, Math.PI, true)
    ctx.lineTo(left, bot)
    ctx.lineTo(left, top + r * 0.6)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0

    // Eyes (only when not frightened)
    if (g.mode !== 'frightened') {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.15, r * 0.22, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3, y - r * 0.15, r * 0.22, 0, Math.PI * 2)
      ctx.fill()
      // Pupils
      const dx = g.dir === 'left' ? -1 : g.dir === 'right' ? 1 : 0
      const dy = g.dir === 'up' ? -1 : g.dir === 'down' ? 1 : 0
      ctx.fillStyle = '#2255ff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3 + dx * r * 0.08, y - r * 0.15 + dy * r * 0.08, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3 + dx * r * 0.08, y - r * 0.15 + dy * r * 0.08, r * 0.1, 0, Math.PI * 2)
      ctx.fill()
    } else {
      // Frightened face
      ctx.fillStyle = bodyColor === '#ffffff' ? '#0000aa' : '#ffffff'
      ctx.beginPath()
      ctx.arc(x - r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + r * 0.3, y - r * 0.1, r * 0.12, 0, Math.PI * 2)
      ctx.fill()
      // Wavy mouth
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

  // ── Game loop ────────────────────────────────────────────────────────────────

  const gameLoop = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time
    const dt = Math.min(time - lastTimeRef.current, 100)
    lastTimeRef.current = time
    tickRef.current += 1

    const phase = phaseRef.current

    if (phase === 'start') {
      phaseTimerRef.current -= dt
      if (phaseTimerRef.current <= 0) {
        phaseRef.current = 'playing'
        setUiPhase('playing')
        audio.init()
        audio.startBGM()
      }
    }

    if (phase === 'dying') {
      dyingTimerRef.current -= dt
      if (dyingTimerRef.current <= 0) {
        if (livesRef.current <= 0) {
          phaseRef.current = 'gameover'
          setUiPhase('gameover')
          setTimeout(() => {
            phaseRef.current = 'initials'
            setUiPhase('initials')
          }, 2000)
        } else {
          // Respawn players
          player1Ref.current = { row: 17, col: 7,  dir: null, nextDir: null, mouthAngle: 0 }
          player2Ref.current = { row: 17, col: 11, dir: null, nextDir: null, mouthAngle: 0 }
          initGhosts()
          phaseRef.current = 'playing'
          setUiPhase('playing')
          setUiLives(livesRef.current)
          audio.startBGM()
        }
      }
    }

    if (phase === 'victory') {
      phaseTimerRef.current -= dt
      if (phaseTimerRef.current <= 0) {
        phaseRef.current = 'initials'
        setUiPhase('initials')
      }
    }

    if (phase === 'playing') {
      // Update mode timer
      updateModeTimer(dt)

      // Determine if any player has power
      const anyFrightened = ghostsRef.current.some(g => g.mode === 'frightened')
      const tick_speed = anyFrightened ? POWER_TICK : MOVE_TICK

      // Move Player 1
      p1MoveAccRef.current += dt
      if (p1MoveAccRef.current >= tick_speed) {
        p1MoveAccRef.current -= tick_speed
        movePlayer(player1Ref.current, anyFrightened)
        collectDot(player1Ref.current.row, player1Ref.current.col)
      }

      // Move Player 2
      p2MoveAccRef.current += dt
      if (p2MoveAccRef.current >= tick_speed) {
        p2MoveAccRef.current -= tick_speed
        movePlayer(player2Ref.current, anyFrightened)
        collectDot(player2Ref.current.row, player2Ref.current.col)
      }

      // Move ghosts (slightly slower than players to be fair)
      ghostMoveAccRef.current += dt
      if (ghostMoveAccRef.current >= tick_speed * 1.1) {
        ghostMoveAccRef.current -= tick_speed * 1.1
        for (const g of ghostsRef.current) {
          moveGhost(g, tick_speed * 1.1)
        }
      }

      // Check collisions
      checkPlayerGhostCollision()

      // Detect frightened mode ending → switch BGM back
      const anyFrightenedNow = ghostsRef.current.some(g => g.mode === 'frightened')
      if (wasFrightenedRef.current && !anyFrightenedNow) {
        wasFrightenedRef.current = false
        audio.endPowerMode()
      }

      // Check victory
      if (dotsRemainingRef.current <= 0) {
        phaseRef.current = 'victory'
        phaseTimerRef.current = 2500
        setUiPhase('victory')
        audio.stopBGM()
        audio.playVictory()
      }

      // Sync UI score
      setUiScore(scoreRef.current)
    }

    draw()
    rafRef.current = requestAnimationFrame(gameLoop)
  }, [cellSize]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Keyboard input ───────────────────────────────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const phase = phaseRef.current
      if (phase === 'initials') return
      if (phase === 'scores') return

      const p1 = player1Ref.current
      const p2 = player2Ref.current

      switch (e.key) {
        // Player 1: WASD
        case 'w': case 'W': p1.nextDir = 'up';    e.preventDefault(); break
        case 'a': case 'A': p1.nextDir = 'left';  e.preventDefault(); break
        case 's': case 'S': p1.nextDir = 'down';  e.preventDefault(); break
        case 'd': case 'D': p1.nextDir = 'right'; e.preventDefault(); break
        // Player 1 also: Arrow keys
        case 'ArrowUp':    p1.nextDir = 'up';    e.preventDefault(); break
        case 'ArrowLeft':  p1.nextDir = 'left';  e.preventDefault(); break
        case 'ArrowDown':  p1.nextDir = 'down';  e.preventDefault(); break
        case 'ArrowRight': p1.nextDir = 'right'; e.preventDefault(); break
        // Player 2: IJKL
        case 'i': case 'I': p2.nextDir = 'up';    e.preventDefault(); break
        case 'j': case 'J': p2.nextDir = 'left';  e.preventDefault(); break
        case 'k': case 'K': p2.nextDir = 'down';  e.preventDefault(); break
        case 'l': case 'L': p2.nextDir = 'right'; e.preventDefault(); break
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Compute cell size from container ────────────────────────────────────────

  useEffect(() => {
    function computeSize() {
      const el = containerRef.current
      if (!el) return
      const w = el.clientWidth - 4
      const cs = Math.min(22, Math.floor(w / COLS))
      setCellSize(cs)
    }
    computeSize()
    window.addEventListener('resize', computeSize)
    return () => window.removeEventListener('resize', computeSize)
  }, [])

  // ── Start / restart game loop ─────────────────────────────────────────────

  useEffect(() => {
    resetGame()
    lastTimeRef.current = 0
    rafRef.current = requestAnimationFrame(gameLoop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      audio.destroy()
    }
  }, [gameLoop])

  // ── Initials entry ────────────────────────────────────────────────────────

  useEffect(() => {
    if (uiPhase !== 'initials') return

    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') {
        setInitials(prev => {
          const next = [...prev]
          const code = next[initialsPos].charCodeAt(0)
          next[initialsPos] = String.fromCharCode(code === 90 ? 65 : code + 1)
          return next
        })
      } else if (e.key === 'ArrowDown') {
        setInitials(prev => {
          const next = [...prev]
          const code = next[initialsPos].charCodeAt(0)
          next[initialsPos] = String.fromCharCode(code === 65 ? 90 : code - 1)
          return next
        })
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (initialsPos < 2) {
          setInitialsPos(p => p + 1)
        } else {
          // Submit
          const entry: ScoreEntry = {
            score: scoreRef.current,
            initials: initials.join(''),
            date: new Date().toLocaleDateString(),
          }
          const list = saveScore(entry)
          setScoresList(list)
          setUiPhase('scores')
          phaseRef.current = 'scores'
        }
      } else if (e.key === 'ArrowLeft') {
        if (initialsPos > 0) setInitialsPos(p => p - 1)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [uiPhase, initialsPos, initials])

  // ── Touch D-pad handler ─────────────────────────────────────────────────────

  function handleDpad(player: 1 | 2, dir: Dir) {
    if (phaseRef.current !== 'playing') return
    if (player === 1) player1Ref.current.nextDir = dir
    else player2Ref.current.nextDir = dir
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const canvasW = COLS * cellSize
  const canvasH = ROWS * cellSize

  function LifeIcons({ lives }: { lives: number }) {
    return (
      <span style={{ display: 'inline-flex', gap: 3 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <span key={i} style={{ fontSize: 12, opacity: i < lives ? 1 : 0.2 }}>●</span>
        ))}
      </span>
    )
  }

  function DPad({ player, color }: { player: 1 | 2; color: string }) {
    const btnStyle: React.CSSProperties = {
      width: 44, height: 44, borderRadius: 8, fontSize: 18,
      background: `${color}22`,
      border: `1px solid ${color}66`,
      color, cursor: 'pointer', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      userSelect: 'none', WebkitUserSelect: 'none',
    }
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: '44px 44px 44px',
        gridTemplateRows: '44px 44px 44px',
        gap: 3,
      }}>
        {/* Row 1 */}
        <div />
        <button style={btnStyle} onPointerDown={(ev) => { ev.preventDefault(); handleDpad(player, 'up') }}>▲</button>
        <div />
        {/* Row 2 */}
        <button style={btnStyle} onPointerDown={(ev) => { ev.preventDefault(); handleDpad(player, 'left') }}>◀</button>
        <div style={{ width: 44, height: 44 }} />
        <button style={btnStyle} onPointerDown={(ev) => { ev.preventDefault(); handleDpad(player, 'right') }}>▶</button>
        {/* Row 3 */}
        <div />
        <button style={btnStyle} onPointerDown={(ev) => { ev.preventDefault(); handleDpad(player, 'down') }}>▼</button>
        <div />
      </div>
    )
  }

  // ── Initials screen ──────────────────────────────────────────────────────────

  if (uiPhase === 'initials') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#0a0010', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', color: '#aa88dd',
          fontSize: 22, cursor: 'pointer',
        }}>✕</button>

        <p style={{
          fontSize: 28, fontWeight: 900, letterSpacing: '0.12em',
          color: '#ffff44',
          textShadow: '0 0 16px #ffff44, 0 0 32px #ffaa00',
          fontFamily: 'monospace',
        }}>GAME OVER</p>

        <p style={{ color: '#aa88ff', fontFamily: 'monospace', fontSize: 14 }}>
          SCORE: {scoreRef.current.toString().padStart(5, '0')}
        </p>

        <p style={{
          color: '#ff88ff', fontFamily: 'monospace', fontSize: 14,
          textShadow: '0 0 8px #ff88ff',
          letterSpacing: '0.08em',
        }}>ENTER INITIALS</p>

        <div style={{ display: 'flex', gap: 16 }}>
          {initials.map((ch, i) => (
            <div key={i} style={{
              width: 52, height: 64,
              border: `2px solid ${i === initialsPos ? '#ffff44' : '#444488'}`,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, fontWeight: 900, color: i === initialsPos ? '#ffff44' : '#aa88cc',
              fontFamily: 'monospace',
              boxShadow: i === initialsPos ? '0 0 16px #ffff44' : 'none',
              background: '#1a0030',
            }}>{ch}</div>
          ))}
        </div>

        <p style={{ color: '#6655aa', fontFamily: 'monospace', fontSize: 11 }}>
          ↑↓ change · ← → move · ENTER confirm
        </p>

        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          {/* Up/down for current char */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
            <button
              onPointerDown={() => setInitials(prev => {
                const next = [...prev]
                const code = next[initialsPos].charCodeAt(0)
                next[initialsPos] = String.fromCharCode(code === 90 ? 65 : code + 1)
                return next
              })}
              style={{ width: 44, height: 44, borderRadius: 8, background: '#2a1060', border: '1px solid #8844cc', color: '#cc88ff', fontSize: 20, cursor: 'pointer' }}
            >▲</button>
            <button
              onPointerDown={() => setInitials(prev => {
                const next = [...prev]
                const code = next[initialsPos].charCodeAt(0)
                next[initialsPos] = String.fromCharCode(code === 65 ? 90 : code - 1)
                return next
              })}
              style={{ width: 44, height: 44, borderRadius: 8, background: '#2a1060', border: '1px solid #8844cc', color: '#cc88ff', fontSize: 20, cursor: 'pointer' }}
            >▼</button>
          </div>
          {/* Next / confirm */}
          <button
            onPointerDown={() => {
              if (initialsPos < 2) {
                setInitialsPos(p => p + 1)
              } else {
                const entry: ScoreEntry = {
                  score: scoreRef.current,
                  initials: initials.join(''),
                  date: new Date().toLocaleDateString(),
                }
                const list = saveScore(entry)
                setScoresList(list)
                setUiPhase('scores')
                phaseRef.current = 'scores'
              }
            }}
            style={{
              padding: '10px 24px', borderRadius: 10,
              background: '#441888', border: '1px solid #8844cc',
              color: '#cc88ff', fontFamily: 'monospace', fontSize: 14,
              cursor: 'pointer', fontWeight: 700,
              alignSelf: 'center',
            }}
          >
            {initialsPos < 2 ? 'NEXT →' : 'ENTER ✓'}
          </button>
        </div>
      </div>
    )
  }

  // ── Scores screen ────────────────────────────────────────────────────────────

  if (uiPhase === 'scores') {
    const list = scoresList.length > 0 ? scoresList : loadScores()
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#0a0010', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        overflowY: 'auto', padding: '24px 16px',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', color: '#aa88dd',
          fontSize: 22, cursor: 'pointer',
        }}>✕</button>

        <p style={{
          fontSize: 26, fontWeight: 900, letterSpacing: '0.14em',
          color: '#ffff44',
          textShadow: '0 0 16px #ffff44, 0 0 32px #ffaa00',
          fontFamily: 'monospace', marginBottom: 8,
        }}>HIGH SCORES</p>

        <p style={{ color: '#6655aa', fontFamily: 'monospace', fontSize: 10, marginBottom: 18 }}>
          {locationName.toUpperCase()}
        </p>

        <div style={{ width: '100%', maxWidth: 320 }}>
          {list.length === 0 && (
            <p style={{ color: '#443366', fontFamily: 'monospace', textAlign: 'center', fontSize: 12 }}>
              No scores yet!
            </p>
          )}
          {list.map((entry, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 14px', marginBottom: 6, borderRadius: 8,
              background: i === 0 ? '#2a1050' : '#160828',
              border: `1px solid ${i === 0 ? '#8844cc' : '#2a1844'}`,
            }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 13,
                color: i === 0 ? '#ffff44' : i < 3 ? '#aa88ff' : '#6655aa',
                textShadow: i === 0 ? '0 0 8px #ffff44' : 'none',
                minWidth: 20,
              }}>{i + 1}.</span>
              <span style={{
                fontFamily: 'monospace', fontSize: 16, fontWeight: 900,
                color: i === 0 ? '#ffff88' : '#cc88ff',
                letterSpacing: '0.1em',
                textShadow: i === 0 ? '0 0 10px #ffff44' : 'none',
              }}>{entry.initials}</span>
              <span style={{
                fontFamily: 'monospace', fontSize: 14,
                color: i === 0 ? '#ffcc44' : '#8866cc',
              }}>{entry.score.toString().padStart(6, '0')}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#443366' }}>
                {entry.date}
              </span>
            </div>
          ))}
        </div>

        <button
          onPointerDown={() => {
            setInitials(['A', 'A', 'A'])
            setInitialsPos(0)
            resetGame()
            lastTimeRef.current = 0
            cancelAnimationFrame(rafRef.current)
            rafRef.current = requestAnimationFrame(gameLoop)
          }}
          style={{
            marginTop: 24, padding: '12px 32px', borderRadius: 12,
            background: '#2a1060', border: '2px solid #8844cc',
            color: '#cc88ff', fontFamily: 'monospace', fontSize: 14,
            cursor: 'pointer', fontWeight: 700,
            boxShadow: '0 0 16px #8844cc44',
          }}
        >
          PLAY AGAIN
        </button>
      </div>
    )
  }

  // ── Main game UI ─────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#0a0010',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      overflowY: 'auto',
    }}>
      {/* Header bar */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 6px',
        background: '#100020',
        borderBottom: '1px solid #2a1060',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#aa88dd',
            fontSize: 18, cursor: 'pointer', padding: 4,
          }}>✕</button>
          <button onClick={() => {
            const next = !muted
            setMuted(next)
            audio.setMuted(next)
          }} style={{
            background: 'none', border: 'none',
            fontSize: 16, cursor: 'pointer', padding: 4,
            opacity: muted ? 0.5 : 1,
          }} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🎵'}
          </button>
        </div>

        <p style={{
          fontSize: 18, fontWeight: 900, letterSpacing: '0.12em',
          color: '#ffff44',
          textShadow: '0 0 10px #ffff44, 0 0 20px #ffaa00, 0 0 40px #ff8800',
          fontFamily: 'monospace',
        }}>🕹 ARCADE</p>

        <p style={{
          fontSize: 10, color: locationColor,
          textShadow: `0 0 8px ${locationColor}`,
          fontWeight: 700, fontFamily: 'monospace',
          maxWidth: 80, textAlign: 'right',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{locationName}</p>
      </div>

      {/* HUD */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 16px',
        background: '#080018',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#8844cc', fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
            textShadow: '0 0 8px #8844cc' }}>P1</span>
          <LifeIcons lives={uiLives} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontSize: 18, fontWeight: 900, fontFamily: 'monospace',
            color: '#ffff88',
            textShadow: '0 0 10px #ffff44, 0 0 20px #ffaa00',
            letterSpacing: '0.08em',
          }}>{uiScore.toString().padStart(5, '0')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LifeIcons lives={uiLives} />
          <span style={{ color: '#dd4477', fontSize: 11, fontFamily: 'monospace', fontWeight: 700,
            textShadow: '0 0 8px #dd4477' }}>P2</span>
        </div>
      </div>

      {/* Canvas container */}
      <div
        ref={containerRef}
        style={{
          width: '100%', maxWidth: 480,
          display: 'flex', justifyContent: 'center',
          padding: '4px 2px',
          background: '#0a0010',
          flexShrink: 0,
        }}
      >
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{
            display: 'block',
            imageRendering: 'pixelated',
            borderRadius: 4,
            border: '1px solid #2a1060',
          }}
        />
      </div>

      {/* Touch D-pads */}
      <div style={{
        width: '100%', maxWidth: 480,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px 20px',
        background: '#080018',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <p style={{ fontSize: 9, color: '#8844cc', fontFamily: 'monospace', fontWeight: 700,
            textShadow: '0 0 6px #8844cc', letterSpacing: '0.06em' }}>WASD / ←↑↓→</p>
          <DPad player={1} color="#8844cc" />
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 8, color: '#4433aa', fontFamily: 'monospace' }}>CONTROLS</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <p style={{ fontSize: 9, color: '#dd4477', fontFamily: 'monospace', fontWeight: 700,
            textShadow: '0 0 6px #dd4477', letterSpacing: '0.06em' }}>IJKL</p>
          <DPad player={2} color="#dd4477" />
        </div>
      </div>
    </div>
  )
}
