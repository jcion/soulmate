'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface Props {
  onClose: () => void
  darkMode: boolean
}

// Grid constants
const COLS = 13
const ROWS = 28

// Alien grid: 5 rows × 11 cols
const ALIEN_COLS = 11
const ALIEN_ROWS = 5

type AlienType = 'A' | 'B' | 'C'
type Phase = 'start' | 'playing' | 'gameover' | 'victory'

interface Alien {
  col: number
  row: number
  type: AlienType
  alive: boolean
}

interface Bullet {
  x: number  // grid col (float)
  y: number  // grid row (float)
  owner: 'p1' | 'p2' | 'alien'
}

interface Explosion {
  x: number
  y: number
  endTime: number
}

interface ScorePopup {
  x: number
  y: number
  value: number
  endTime: number
}

interface UFO {
  x: number
  direction: 1 | -1
  points: number
  active: boolean
}

interface GameState {
  aliens: Alien[]
  alienDirX: 1 | -1
  alienOffsetX: number  // grid cols shifted
  alienOffsetY: number  // grid rows shifted
  animFrame: number
  moveTimer: number
  alienBullets: Bullet[]
  alienShootTimer: number
  alienShootInterval: number
  p1X: number
  p2X: number
  p1Lives: number
  p2Lives: number
  p1Bullet: Bullet | null
  p2Bullet: Bullet | null
  p1FlashEnd: number
  p2FlashEnd: number
  ufo: UFO
  ufoTimer: number
  score: number
  wave: number
  explosions: Explosion[]
  scorePopups: ScorePopup[]
  lastTime: number
  p1BulletTimer: number
  p2BulletTimer: number
  alienBulletMoveTimer: number
  playerMoveTimer: number
}

// Stars (static)
const STARS = Array.from({ length: 40 }, () => ({
  x: Math.random(),
  y: Math.random(),
}))

function makeAliens(wave: number): Alien[] {
  const aliens: Alien[] = []
  for (let r = 0; r < ALIEN_ROWS; r++) {
    for (let c = 0; c < ALIEN_COLS; c++) {
      let type: AlienType = 'C'
      if (r === 0) type = 'A'
      else if (r <= 2) type = 'B'
      aliens.push({ col: c, row: r, type, alive: true })
    }
  }
  return aliens
}

function alienPoints(type: AlienType): number {
  if (type === 'A') return 30
  if (type === 'B') return 20
  return 10
}

export default function SpaceInvaders({ onClose, darkMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<GameState | null>(null)
  const animRef = useRef<number>(0)
  const keysRef = useRef<Set<string>>(new Set())

  const [phase, setPhase] = useState<Phase>('start')
  const [score, setScore] = useState(0)
  const [p1Lives, setP1Lives] = useState(3)
  const [p2Lives, setP2Lives] = useState(3)
  const [wave, setWave] = useState(1)
  const [cell, setCell] = useState(28)

  // Mobile button refs
  const p1LeftRef = useRef(false)
  const p1RightRef = useRef(false)
  const p1FireRef = useRef(false)
  const p2LeftRef = useRef(false)
  const p2RightRef = useRef(false)
  const p2FireRef = useRef(false)

  // Compute cell size from container
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth
        const c = Math.min(28, Math.floor((w - 8) / COLS))
        setCell(c)
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const initState = useCallback((waveNum: number): GameState => {
    const speedFactor = Math.pow(1.1, waveNum - 1)
    return {
      aliens: makeAliens(waveNum),
      alienDirX: 1,
      alienOffsetX: 1,  // starting col
      alienOffsetY: 2,  // starting row
      animFrame: 0,
      moveTimer: 0,
      alienBullets: [],
      alienShootTimer: 0,
      alienShootInterval: 2000,
      p1X: 2,
      p2X: 10,
      p1Lives: 3,
      p2Lives: 3,
      p1Bullet: null,
      p2Bullet: null,
      p1FlashEnd: 0,
      p2FlashEnd: 0,
      ufo: { x: -1, direction: 1, points: 100, active: false },
      ufoTimer: 0,
      score: 0,
      wave: waveNum,
      explosions: [],
      scorePopups: [],
      lastTime: 0,
      p1BulletTimer: 0,
      p2BulletTimer: 0,
      alienBulletMoveTimer: 0,
      playerMoveTimer: 0,
    }
  }, [])

  // Draw functions
  const drawAlien = useCallback((ctx: CanvasRenderingContext2D, type: AlienType, cx: number, cy: number, frame: number, c: number) => {
    const half = c * 0.5
    ctx.save()
    ctx.translate(cx, cy)

    if (type === 'A') {
      // Squid: white/yellow
      ctx.fillStyle = frame === 0 ? '#ffff44' : '#ffffff'
      // Body
      ctx.fillRect(-half * 0.7, -half * 0.5, half * 1.4, half)
      // Eyes
      ctx.fillStyle = '#000000'
      ctx.beginPath(); ctx.arc(-half * 0.3, -half * 0.1, half * 0.15, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(half * 0.3, -half * 0.1, half * 0.15, 0, Math.PI * 2); ctx.fill()
      // Tentacles
      ctx.fillStyle = frame === 0 ? '#ffff44' : '#ffffff'
      const tentX = [-0.55, -0.2, 0.2, 0.55]
      tentX.forEach(tx => {
        ctx.fillRect(tx * half - 1, half * 0.5, 2, half * (0.3 + (frame === 0 ? 0.2 : 0)))
      })
      // Top dome
      ctx.beginPath()
      ctx.arc(0, -half * 0.5, half * 0.5, Math.PI, 0)
      ctx.fill()
    } else if (type === 'B') {
      // Crab: cyan
      ctx.fillStyle = '#44ffff'
      // Body
      ctx.fillRect(-half * 0.9, -half * 0.4, half * 1.8, half * 0.8)
      // Claws
      if (frame === 0) {
        ctx.beginPath()
        ctx.moveTo(-half * 0.9, 0); ctx.lineTo(-half * 1.2, -half * 0.5); ctx.lineTo(-half * 0.9, -half * 0.4)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(half * 0.9, 0); ctx.lineTo(half * 1.2, -half * 0.5); ctx.lineTo(half * 0.9, -half * 0.4)
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(-half * 0.9, -half * 0.3); ctx.lineTo(-half * 1.3, half * 0.1); ctx.lineTo(-half * 0.9, half * 0.4)
        ctx.fill()
        ctx.beginPath()
        ctx.moveTo(half * 0.9, -half * 0.3); ctx.lineTo(half * 1.3, half * 0.1); ctx.lineTo(half * 0.9, half * 0.4)
        ctx.fill()
      }
      // Eyes
      ctx.fillStyle = '#000000'
      ctx.beginPath(); ctx.arc(-half * 0.35, -half * 0.1, half * 0.15, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc(half * 0.35, -half * 0.1, half * 0.15, 0, Math.PI * 2); ctx.fill()
    } else {
      // Tank: green
      ctx.fillStyle = '#44ff44'
      // Body
      ctx.fillRect(-half * 0.8, -half * 0.3, half * 1.6, half * 0.6)
      // Turret
      ctx.fillRect(-half * 0.25, -half * 0.6, half * 0.5, half * 0.35)
      // Legs / treads
      if (frame === 0) {
        ctx.fillRect(-half * 0.9, half * 0.2, half * 0.3, half * 0.25)
        ctx.fillRect(half * 0.6, half * 0.2, half * 0.3, half * 0.25)
      } else {
        ctx.fillRect(-half * 0.8, half * 0.2, half * 0.3, half * 0.25)
        ctx.fillRect(half * 0.5, half * 0.2, half * 0.3, half * 0.25)
      }
    }
    ctx.restore()
  }, [])

  const drawShip = useCallback((ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, c: number, flash: boolean) => {
    if (flash) return
    ctx.save()
    ctx.translate(cx, cy)
    ctx.fillStyle = color
    // Triangle body
    ctx.beginPath()
    ctx.moveTo(0, -c * 0.45)
    ctx.lineTo(-c * 0.45, c * 0.25)
    ctx.lineTo(c * 0.45, c * 0.25)
    ctx.closePath()
    ctx.fill()
    // Base rect
    ctx.fillRect(-c * 0.45, c * 0.2, c * 0.9, c * 0.1)
    // Cockpit
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath()
    ctx.arc(0, -c * 0.1, c * 0.1, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  const drawUFO = useCallback((ctx: CanvasRenderingContext2D, cx: number, cy: number, c: number) => {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.fillStyle = '#ff4444'
    // Main ellipse
    ctx.beginPath()
    ctx.ellipse(0, 0, c * 0.55, c * 0.22, 0, 0, Math.PI * 2)
    ctx.fill()
    // Dome
    ctx.fillStyle = '#ff8888'
    ctx.beginPath()
    ctx.ellipse(0, -c * 0.15, c * 0.25, c * 0.2, 0, Math.PI, 0)
    ctx.fill()
    // Lights
    ctx.fillStyle = '#ffff44'
    ;[-0.3, 0, 0.3].forEach(ox => {
      ctx.beginPath(); ctx.arc(ox * c, c * 0.05, 2, 0, Math.PI * 2); ctx.fill()
    })
    ctx.restore()
  }, [])

  const drawExplosion = useCallback((ctx: CanvasRenderingContext2D, ex: number, ey: number, c: number) => {
    ctx.save()
    ctx.translate(ex, ey)
    ctx.strokeStyle = '#ff8844'
    ctx.lineWidth = 2
    const dirs = [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]]
    dirs.forEach(([dx, dy]) => {
      ctx.beginPath()
      ctx.moveTo(dx * c * 0.1, dy * c * 0.1)
      ctx.lineTo(dx * c * 0.45, dy * c * 0.45)
      ctx.stroke()
    })
    ctx.restore()
  }, [])

  const render = useCallback((state: GameState, c: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = COLS * c
    const H = ROWS * c
    const now = Date.now()

    // Background
    ctx.fillStyle = '#050010'
    ctx.fillRect(0, 0, W, H)

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    STARS.forEach(s => {
      ctx.fillRect(Math.floor(s.x * W), Math.floor(s.y * H), 1, 1)
    })

    // Ground line
    ctx.fillStyle = '#33ff33'
    ctx.fillRect(0, 26 * c, W, 1)

    // Aliens
    state.aliens.forEach(alien => {
      if (!alien.alive) return
      const worldCol = state.alienOffsetX + alien.col
      const worldRow = state.alienOffsetY + alien.row
      const cx = (worldCol + 0.5) * c
      const cy = (worldRow + 0.5) * c
      drawAlien(ctx, alien.type, cx, cy, state.animFrame, c)
    })

    // UFO
    if (state.ufo.active) {
      const ux = (state.ufo.x + 0.5) * c
      const uy = 1.5 * c
      drawUFO(ctx, ux, uy, c)
    }

    // Player ships
    const p1Flash = now < state.p1FlashEnd && Math.floor(now / 80) % 2 === 0
    const p2Flash = now < state.p2FlashEnd && Math.floor(now / 80) % 2 === 0
    drawShip(ctx, (state.p1X + 0.5) * c, 25.5 * c, '#8844cc', c, p1Flash)
    drawShip(ctx, (state.p2X + 0.5) * c, 25.5 * c, '#dd4477', c, p2Flash)

    // Bullets
    if (state.p1Bullet) {
      ctx.fillStyle = '#8844cc'
      ctx.fillRect(state.p1Bullet.x * c - 1, state.p1Bullet.y * c, 2, c * 0.4)
    }
    if (state.p2Bullet) {
      ctx.fillStyle = '#dd4477'
      ctx.fillRect(state.p2Bullet.x * c - 1, state.p2Bullet.y * c, 2, c * 0.4)
    }
    state.alienBullets.forEach(b => {
      ctx.fillStyle = '#ffff44'
      ctx.fillRect(b.x * c - 1.5, b.y * c, 3, c * 0.35)
    })

    // Explosions
    state.explosions.forEach(exp => {
      if (now < exp.endTime) drawExplosion(ctx, exp.x * c, exp.y * c, c)
    })

    // Score popups
    state.scorePopups.forEach(sp => {
      if (now < sp.endTime) {
        const alpha = (sp.endTime - now) / 600
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.fillStyle = '#ffff44'
        ctx.font = `bold ${Math.floor(c * 0.6)}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(`+${sp.value}`, sp.x * c, sp.y * c)
        ctx.restore()
      }
    })
  }, [drawAlien, drawShip, drawUFO, drawExplosion])

  const update = useCallback((state: GameState, dt: number, c: number, waveNum: number): { newPhase?: Phase; newScore?: number; newP1Lives?: number; newP2Lives?: number; newWave?: number } => {
    const now = Date.now()
    const result: { newPhase?: Phase; newScore?: number; newP1Lives?: number; newP2Lives?: number; newWave?: number } = {}

    // Player movement
    state.playerMoveTimer += dt
    if (state.playerMoveTimer >= 60) {
      state.playerMoveTimer = 0

      const p1Left = keysRef.current.has('a') || keysRef.current.has('ArrowLeft') || p1LeftRef.current
      const p1Right = keysRef.current.has('d') || keysRef.current.has('ArrowRight') || p1RightRef.current
      const p2Left = keysRef.current.has('j') || p2LeftRef.current
      const p2Right = keysRef.current.has('l') || p2RightRef.current

      if (p1Left && state.p1X > 0) state.p1X--
      if (p1Right && state.p1X < COLS - 1) state.p1X++
      if (p2Left && state.p2X > 0) state.p2X--
      if (p2Right && state.p2X < COLS - 1) state.p2X++
    }

    // Player shooting
    state.p1BulletTimer += dt
    state.p2BulletTimer += dt

    const p1Fire = keysRef.current.has(' ') || keysRef.current.has('z') || p1FireRef.current
    const p2Fire = keysRef.current.has('k') || p2FireRef.current

    if (p1Fire && !state.p1Bullet && state.p1BulletTimer > 300) {
      state.p1Bullet = { x: state.p1X + 0.5, y: 25, owner: 'p1' }
      state.p1BulletTimer = 0
    }
    if (p2Fire && !state.p2Bullet && state.p2BulletTimer > 300) {
      state.p2Bullet = { x: state.p2X + 0.5, y: 25, owner: 'p2' }
      state.p2BulletTimer = 0
    }

    // Move player bullets
    if (state.p1Bullet) {
      state.p1Bullet.y -= dt / 40
      if (state.p1Bullet.y < 0) state.p1Bullet = null
    }
    if (state.p2Bullet) {
      state.p2Bullet.y -= dt / 40
      if (state.p2Bullet.y < 0) state.p2Bullet = null
    }

    // Move alien bullets
    state.alienBulletMoveTimer += dt
    if (state.alienBulletMoveTimer >= 120) {
      state.alienBulletMoveTimer = 0
      state.alienBullets = state.alienBullets.filter(b => b.y < ROWS)
      state.alienBullets.forEach(b => { b.y += 1 })
    }

    // Alien movement
    const aliveAliens = state.aliens.filter(a => a.alive)
    const aliveCount = aliveAliens.length

    if (aliveCount === 0) {
      result.newPhase = 'victory'
      return result
    }

    const moveInterval = Math.max(80, 1200 / aliveCount)
    state.moveTimer += dt
    if (state.moveTimer >= moveInterval) {
      state.moveTimer = 0
      state.animFrame = state.animFrame === 0 ? 1 : 0

      // Check edges
      const minCol = Math.min(...aliveAliens.map(a => state.alienOffsetX + a.col))
      const maxCol = Math.max(...aliveAliens.map(a => state.alienOffsetX + a.col))

      if (state.alienDirX === 1 && maxCol >= COLS - 1) {
        state.alienDirX = -1
        state.alienOffsetY += 1
      } else if (state.alienDirX === -1 && minCol <= 0) {
        state.alienDirX = 1
        state.alienOffsetY += 1
      } else {
        state.alienOffsetX += state.alienDirX
      }

      // Check if aliens reached player row
      const maxRow = Math.max(...aliveAliens.map(a => state.alienOffsetY + a.row))
      if (maxRow >= 24) {
        result.newPhase = 'gameover'
        return result
      }
    }

    // Alien shooting
    state.alienShootTimer += dt
    if (state.alienShootTimer >= state.alienShootInterval && state.alienBullets.length < 3 && aliveCount > 0) {
      state.alienShootTimer = 0
      state.alienShootInterval = 1500 + Math.random() * 2000

      const shooter = aliveAliens[Math.floor(Math.random() * aliveAliens.length)]
      const bx = state.alienOffsetX + shooter.col + 0.5
      const by = state.alienOffsetY + shooter.row + 1
      state.alienBullets.push({ x: bx, y: by, owner: 'alien' })
    }

    // UFO
    state.ufoTimer += dt
    if (!state.ufo.active && state.ufoTimer >= 25000) {
      state.ufoTimer = 0
      const pts = [50, 100, 150, 300][Math.floor(Math.random() * 4)]
      state.ufo = { x: 0, direction: 1, points: pts, active: true }
    }
    if (state.ufo.active) {
      state.ufo.x += state.ufo.direction * dt / 200
      if (state.ufo.x > COLS || state.ufo.x < -1) {
        state.ufo.active = false
      }
    }

    // Collision: player bullets vs aliens
    ;[state.p1Bullet, state.p2Bullet].forEach((bullet, bi) => {
      if (!bullet) return
      const bx = bullet.x
      const by = bullet.y

      for (let i = 0; i < state.aliens.length; i++) {
        const alien = state.aliens[i]
        if (!alien.alive) continue
        const ax = state.alienOffsetX + alien.col + 0.5
        const ay = state.alienOffsetY + alien.row + 0.5
        if (Math.abs(bx - ax) < 0.6 && Math.abs(by - ay) < 0.6) {
          alien.alive = false
          const pts = alienPoints(alien.type)
          state.score += pts
          result.newScore = state.score
          state.explosions.push({ x: ax, y: ay, endTime: now + 400 })
          state.scorePopups.push({ x: ax, y: ay - 0.5, value: pts, endTime: now + 600 })
          if (bi === 0) state.p1Bullet = null
          else state.p2Bullet = null
          break
        }
      }
    })

    // Collision: player bullets vs UFO
    if (state.ufo.active) {
      const ux = state.ufo.x + 0.5
      const uy = 1.5
      ;[state.p1Bullet, state.p2Bullet].forEach((bullet, bi) => {
        if (!bullet || !state.ufo.active) return
        if (Math.abs(bullet.x - ux) < 0.7 && Math.abs(bullet.y - uy) < 0.5) {
          state.score += state.ufo.points
          result.newScore = state.score
          state.explosions.push({ x: ux, y: uy, endTime: now + 400 })
          state.scorePopups.push({ x: ux, y: uy - 0.5, value: state.ufo.points, endTime: now + 800 })
          state.ufo.active = false
          if (bi === 0) state.p1Bullet = null
          else state.p2Bullet = null
        }
      })
    }

    // Collision: alien bullets vs players
    state.alienBullets = state.alienBullets.filter(b => {
      const hitP1 = Math.abs(b.x - (state.p1X + 0.5)) < 0.6 && Math.abs(b.y - 25.5) < 0.6
      const hitP2 = Math.abs(b.x - (state.p2X + 0.5)) < 0.6 && Math.abs(b.y - 25.5) < 0.6

      if (hitP1 && now > state.p1FlashEnd) {
        state.p1Lives = Math.max(0, state.p1Lives - 1)
        result.newP1Lives = state.p1Lives
        state.p1FlashEnd = now + 1200
        state.explosions.push({ x: state.p1X + 0.5, y: 25.5, endTime: now + 400 })
        if (state.p1Lives <= 0 && state.p2Lives <= 0) {
          result.newPhase = 'gameover'
        }
        return false
      }
      if (hitP2 && now > state.p2FlashEnd) {
        state.p2Lives = Math.max(0, state.p2Lives - 1)
        result.newP2Lives = state.p2Lives
        state.p2FlashEnd = now + 1200
        state.explosions.push({ x: state.p2X + 0.5, y: 25.5, endTime: now + 400 })
        if (state.p1Lives <= 0 && state.p2Lives <= 0) {
          result.newPhase = 'gameover'
        }
        return false
      }
      return true
    })

    // Clean up old explosions & popups
    state.explosions = state.explosions.filter(e => now < e.endTime)
    state.scorePopups = state.scorePopups.filter(s => now < s.endTime)

    return result
  }, [])

  // Game loop
  const gameLoop = useCallback((timestamp: number) => {
    const state = stateRef.current
    if (!state) return

    const dt = state.lastTime === 0 ? 16 : Math.min(timestamp - state.lastTime, 50)
    state.lastTime = timestamp

    const results = update(state, dt, cell, state.wave)

    render(state, cell)

    if (results.newScore !== undefined) setScore(results.newScore)
    if (results.newP1Lives !== undefined) setP1Lives(results.newP1Lives)
    if (results.newP2Lives !== undefined) setP2Lives(results.newP2Lives)

    if (results.newPhase) {
      setPhase(results.newPhase)
      if (results.newPhase === 'victory') {
        // Start next wave after delay
        setTimeout(() => {
          const currentScore = stateRef.current?.score || 0
          const currentWave = stateRef.current?.wave || 1
          const newWave = currentWave + 1
          const newState = initState(newWave)
          newState.score = currentScore
          stateRef.current = newState
          setWave(newWave)
          setPhase('playing')
          setP1Lives(3)
          setP2Lives(3)
        }, 2000)
      }
      return
    }

    animRef.current = requestAnimationFrame(gameLoop)
  }, [cell, update, render, initState])

  // Start / restart game
  const startGame = useCallback(() => {
    const state = initState(1)
    stateRef.current = state
    setScore(0)
    setP1Lives(3)
    setP2Lives(3)
    setWave(1)
    setPhase('playing')
  }, [initState])

  // Launch game loop when playing
  useEffect(() => {
    if (phase === 'playing') {
      if (stateRef.current) stateRef.current.lastTime = 0
      animRef.current = requestAnimationFrame(gameLoop)
      return () => cancelAnimationFrame(animRef.current)
    }
  }, [phase, gameLoop])

  // Keep rendering when phase changes but still playing
  useEffect(() => {
    if (phase !== 'playing') {
      cancelAnimationFrame(animRef.current)
    }
  }, [phase])

  // Keyboard handlers
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key)
      if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault()
      }
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  // Auto-start countdown
  useEffect(() => {
    if (phase === 'start') {
      const t = setTimeout(() => startGame(), 2000)
      return () => clearTimeout(t)
    }
  }, [phase, startGame])

  const canvasW = COLS * cell
  const canvasH = ROWS * cell

  const lives = (n: number, color: string) =>
    Array.from({ length: 3 }, (_, i) => (
      <span key={i} style={{ color: i < n ? color : '#333', fontSize: 14 }}>♥</span>
    ))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#050010',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflowY: 'auto',
    }}>
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 12, right: 16,
          background: 'transparent', border: '1px solid #444',
          color: '#aaa', borderRadius: 8,
          padding: '4px 10px', cursor: 'pointer', zIndex: 10, fontSize: 14,
        }}
      >✕</button>

      {/* HUD */}
      <div style={{ width: canvasW, paddingTop: 12, paddingBottom: 4, color: '#fff', fontFamily: 'monospace' }}>
        <div style={{ textAlign: 'center', color: '#44ff44', fontSize: 16, fontWeight: 700 }}>
          SCORE: {score}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, marginTop: 2 }}>
          <span>P1 {lives(p1Lives, '#8844cc')}</span>
          <span style={{ color: '#888' }}>WAVE {wave}</span>
          <span>{lives(p2Lives, '#dd4477')} P2</span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ width: '100%', maxWidth: canvasW + 16, padding: '0 4px', position: 'relative' }}>
        <canvas
          ref={canvasRef}
          width={canvasW}
          height={canvasH}
          style={{ display: 'block', margin: '0 auto', border: '1px solid #1a0030' }}
        />

        {/* Overlays */}
        {phase === 'start' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
          }}>
            <div style={{ color: '#44ff44', fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>READY</div>
            <div style={{ color: '#888', fontSize: 14, marginTop: 8, fontFamily: 'monospace' }}>Starting in 2 seconds…</div>
          </div>
        )}
        {phase === 'victory' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
          }}>
            <div style={{ color: '#ffff44', fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>WAVE CLEAR!</div>
            <div style={{ color: '#888', fontSize: 13, marginTop: 8, fontFamily: 'monospace' }}>Next wave starting…</div>
          </div>
        )}
        {phase === 'gameover' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.8)',
            gap: 12,
          }}>
            <div style={{ color: '#ff4444', fontSize: 28, fontWeight: 700, fontFamily: 'monospace' }}>GAME OVER</div>
            <div style={{ color: '#ffff44', fontSize: 16, fontFamily: 'monospace' }}>SCORE: {score}</div>
            <button
              onClick={startGame}
              style={{
                marginTop: 8, padding: '8px 24px',
                background: '#8844cc', color: '#fff',
                border: 'none', borderRadius: 8,
                fontFamily: 'monospace', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >PLAY AGAIN</button>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        width: '100%', maxWidth: canvasW + 16,
        padding: '8px 4px', gap: 8, marginTop: 4,
      }}>
        {/* P1 controls */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onPointerDown={() => { p1LeftRef.current = true }} onPointerUp={() => { p1LeftRef.current = false }} onPointerLeave={() => { p1LeftRef.current = false }}
            style={{ width: 48, height: 48, background: '#8844cc44', border: '1px solid #8844cc', color: '#8844cc', borderRadius: 8, fontSize: 18, cursor: 'pointer', userSelect: 'none' }}
          >←</button>
          <button
            onPointerDown={() => { p1FireRef.current = true }} onPointerUp={() => { p1FireRef.current = false }} onPointerLeave={() => { p1FireRef.current = false }}
            style={{ width: 60, height: 48, background: '#8844cc88', border: '2px solid #8844cc', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
          >FIRE</button>
          <button
            onPointerDown={() => { p1RightRef.current = true }} onPointerUp={() => { p1RightRef.current = false }} onPointerLeave={() => { p1RightRef.current = false }}
            style={{ width: 48, height: 48, background: '#8844cc44', border: '1px solid #8844cc', color: '#8844cc', borderRadius: 8, fontSize: 18, cursor: 'pointer', userSelect: 'none' }}
          >→</button>
        </div>
        {/* P2 controls */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onPointerDown={() => { p2LeftRef.current = true }} onPointerUp={() => { p2LeftRef.current = false }} onPointerLeave={() => { p2LeftRef.current = false }}
            style={{ width: 48, height: 48, background: '#dd447744', border: '1px solid #dd4477', color: '#dd4477', borderRadius: 8, fontSize: 18, cursor: 'pointer', userSelect: 'none' }}
          >←</button>
          <button
            onPointerDown={() => { p2FireRef.current = true }} onPointerUp={() => { p2FireRef.current = false }} onPointerLeave={() => { p2FireRef.current = false }}
            style={{ width: 60, height: 48, background: '#dd447788', border: '2px solid #dd4477', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', userSelect: 'none' }}
          >FIRE</button>
          <button
            onPointerDown={() => { p2RightRef.current = true }} onPointerUp={() => { p2RightRef.current = false }} onPointerLeave={() => { p2RightRef.current = false }}
            style={{ width: 48, height: 48, background: '#dd447744', border: '1px solid #dd4477', color: '#dd4477', borderRadius: 8, fontSize: 18, cursor: 'pointer', userSelect: 'none' }}
          >→</button>
        </div>
      </div>

      {/* Key reference */}
      <div style={{ color: '#444', fontSize: 10, fontFamily: 'monospace', textAlign: 'center', paddingBottom: 12 }}>
        P1: A/D move · Space/Z fire &nbsp;|&nbsp; P2: J/L move · K fire
      </div>
    </div>
  )
}
