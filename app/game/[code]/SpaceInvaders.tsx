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

// ── Difficulty constants (tuned for fun, not punishment) ──────────────────────
const MOVE_INTERVAL_BASE = 17   // ms per alive alien — 55*17+70 = 1005ms at start
const MOVE_INTERVAL_MIN  = 70   // fastest possible (ms)
const MAX_ALIEN_BULLETS  = 2    // down from 3
const SHOOT_INTERVAL_MIN = 2500
const SHOOT_INTERVAL_VAR = 2500
const WAVE_SPEED_MULT    = 0.88 // each wave starts 12% faster

// ── Bunker geometry ───────────────────────────────────────────────────────────
const BUNKER_ROW  = 21  // world-row where bunkers sit
const BUNKER_COLS = [[0, 1, 2], [4, 5, 6], [9, 10, 11]] as const  // 3 bunkers × 3 cols
const BUNKER_HP   = 3   // hits per cell before destroyed

// ── Note table ────────────────────────────────────────────────────────────────
const N = {
  C2: 65.41, G2: 98.00, C3: 130.81, D3: 146.83, G3: 196.00,
  C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.00, A4: 440.00,
  C5: 523.25, E5: 659.25, G5: 783.99, A5: 880.00,
  C6: 1046.50, E6: 1318.51, G6: 1567.98,
}
const MARCH_NOTES = [N.G3, N.D3, N.C3, N.D3]

type AlienType = 'A' | 'B' | 'C'
type Phase = 'start' | 'playing' | 'gameover' | 'victory'

interface Alien   { col: number; row: number; type: AlienType; alive: boolean }
interface Bullet  { x: number; y: number; owner: 'p1' | 'p2' | 'alien' }
interface Explosion { x: number; y: number; endTime: number }
interface ScorePopup { x: number; y: number; value: number; endTime: number }
interface UFO { x: number; direction: 1 | -1; points: number; active: boolean }

// bunkers[bunkerIdx][row 0-1][col 0-2] = HP
type Bunkers = number[][][]

interface GameState {
  aliens: Alien[]
  alienDirX: 1 | -1
  alienOffsetX: number
  alienOffsetY: number
  animFrame: number
  moveTimer: number
  marchStep: number
  alienBullets: Bullet[]
  alienShootTimer: number
  alienShootInterval: number
  p1X: number; p2X: number
  p1Lives: number; p2Lives: number
  p1Bullet: Bullet | null; p2Bullet: Bullet | null
  p1FlashEnd: number; p2FlashEnd: number
  ufo: UFO
  ufoTimer: number
  score: number
  wave: number
  explosions: Explosion[]
  scorePopups: ScorePopup[]
  lastTime: number
  p1BulletTimer: number; p2BulletTimer: number
  alienBulletMoveTimer: number
  playerMoveTimer: number
  bunkers: Bunkers
  waveSpeedMult: number
}

const STARS = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random() }))

function makeBunkers(): Bunkers {
  return BUNKER_COLS.map(() =>
    Array.from({ length: 2 }, () => Array(3).fill(BUNKER_HP))
  )
}

function makeAliens(): Alien[] {
  const aliens: Alien[] = []
  for (let r = 0; r < ALIEN_ROWS; r++)
    for (let c = 0; c < ALIEN_COLS; c++) {
      const type: AlienType = r === 0 ? 'A' : r <= 2 ? 'B' : 'C'
      aliens.push({ col: c, row: r, type, alive: true })
    }
  return aliens
}

function alienPoints(type: AlienType) {
  return type === 'A' ? 30 : type === 'B' ? 20 : 10
}

function alienMoveInterval(aliveCount: number, waveSpeedMult: number) {
  // Starts slow (~1000ms), gets faster as aliens die
  const base = Math.max(MOVE_INTERVAL_MIN, aliveCount * MOVE_INTERVAL_BASE + MOVE_INTERVAL_MIN)
  return Math.max(MOVE_INTERVAL_MIN, base * waveSpeedMult)
}

export default function SpaceInvaders({ onClose, darkMode }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef     = useRef<GameState | null>(null)
  const animRef      = useRef<number>(0)
  const keysRef      = useRef<Set<string>>(new Set())

  // Audio
  const audioCtxRef    = useRef<AudioContext | null>(null)
  const audioMasterRef = useRef<GainNode | null>(null)
  const mutedRef       = useRef(false)
  const [muted, setMuted] = useState(false)

  // UFO sound interval
  const ufoSoundRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [phase, setPhase]     = useState<Phase>('start')
  const [score, setScore]     = useState(0)
  const [p1Lives, setP1Lives] = useState(3)
  const [p2Lives, setP2Lives] = useState(3)
  const [wave, setWave]       = useState(1)
  const [cell, setCell]       = useState(28)

  const p1LeftRef  = useRef(false); const p1RightRef = useRef(false); const p1FireRef = useRef(false)
  const p2LeftRef  = useRef(false); const p2RightRef = useRef(false); const p2FireRef = useRef(false)

  // ── Audio primitives ────────────────────────────────────────────────────────

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
      return
    }
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const master = ctx.createGain()
    master.gain.value = 0.25
    master.connect(ctx.destination)
    audioCtxRef.current = ctx
    audioMasterRef.current = master
  }, [])

  const playTone = useCallback((
    freq: number, dur: number, vol: number, when = 0,
    type: OscillatorType = 'sine', attack = 0.005
  ) => {
    const ctx = audioCtxRef.current; const master = audioMasterRef.current
    if (!ctx || !master || mutedRef.current || freq <= 0) return
    const t = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type; osc.frequency.value = freq
    env.gain.setValueAtTime(0.001, t)
    env.gain.linearRampToValueAtTime(vol, t + attack)
    env.gain.exponentialRampToValueAtTime(0.001, t + Math.max(dur, 0.02))
    osc.connect(env); env.connect(master)
    osc.start(t); osc.stop(t + dur + 0.02)
  }, [])

  const marimba = useCallback((freq: number, vol = 0.22, when = 0) => {
    playTone(freq, 0.35, vol, when, 'sine')
    playTone(freq * 2.01, 0.12, vol * 0.18, when, 'sine')
  }, [playTone])

  const bell = useCallback((freq: number, vol = 0.18, when = 0) => {
    playTone(freq, 0.75, vol, when, 'sine')
    playTone(freq * 2.756, 0.35, vol * 0.12, when, 'sine')
  }, [playTone])

  // March beat — 4-note AC marimba cycle, synced to alien steps
  const playMarch = useCallback((step: number, aliveCount: number) => {
    const freq = MARCH_NOTES[step % 4]
    // Volume gets slightly louder as aliens approach (fewer = louder / faster)
    const vol = 0.15 + (1 - aliveCount / 55) * 0.1
    marimba(freq, vol)
  }, [marimba])

  // Laser shoot — quick descending square blip (AC-ified)
  const playShoot = useCallback(() => {
    const ctx = audioCtxRef.current; const master = audioMasterRef.current
    if (!ctx || !master || mutedRef.current) return
    const t = ctx.currentTime
    const osc = ctx.createOscillator(); const env = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(N.G5, t)
    osc.frequency.exponentialRampToValueAtTime(N.C5, t + 0.07)
    env.gain.setValueAtTime(0.1, t)
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.09)
    osc.connect(env); env.connect(master)
    osc.start(t); osc.stop(t + 0.11)
  }, [])

  // Alien explodes — short burst of descending noise (AC pop)
  const playAlienDie = useCallback(() => {
    [N.A5, N.G5, N.E5, N.C5].forEach((f, i) =>
      playTone(f, 0.04, 0.14, i * 0.028, 'sawtooth')
    )
  }, [playTone])

  // Player hit — sad descending AC phrase (shorter than Pac-Man)
  const playPlayerDie = useCallback(() => {
    [N.G4, N.E4, N.D4, N.C4].forEach((f, i) => marimba(f, 0.2, i * 0.11))
  }, [marimba])

  // UFO — rising bell note (called periodically while UFO is on screen)
  const playUFOPing = useCallback(() => {
    bell(N.E6, 0.14)
  }, [bell])

  // Wave clear — bright AC fanfare
  const playWaveClear = useCallback(() => {
    const notes = [N.C5, N.E5, N.G5, N.C6, N.G5, N.C6]
    const times = [0, 0.13, 0.26, 0.42, 0.55, 0.68]
    notes.forEach((f, i) => bell(f, 0.28, times[i]))
  }, [bell])

  // Game over — longer sad descent
  const playGameOver = useCallback(() => {
    [N.G4, N.E4, N.D4, N.C4, N.G3, N.C3].forEach((f, i) => marimba(f, 0.2, i * 0.14))
  }, [marimba])

  // UFO siren — start/stop interval
  const startUFOSiren = useCallback(() => {
    if (ufoSoundRef.current) return
    ufoSoundRef.current = setInterval(() => playUFOPing(), 400)
    playUFOPing()
  }, [playUFOPing])

  const stopUFOSiren = useCallback(() => {
    if (ufoSoundRef.current) { clearInterval(ufoSoundRef.current); ufoSoundRef.current = null }
  }, [])

  // ── Cell size ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth
        setCell(Math.min(28, Math.floor((w - 8) / COLS)))
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── Init state ─────────────────────────────────────────────────────────────

  const initState = useCallback((waveNum: number, prevScore = 0): GameState => {
    const waveSpeedMult = Math.pow(WAVE_SPEED_MULT, waveNum - 1)
    return {
      aliens: makeAliens(),
      alienDirX: 1, alienOffsetX: 1, alienOffsetY: 2,
      animFrame: 0, moveTimer: 0, marchStep: 0,
      alienBullets: [], alienShootTimer: 0,
      alienShootInterval: SHOOT_INTERVAL_MIN + Math.random() * SHOOT_INTERVAL_VAR,
      p1X: 2, p2X: 10,
      p1Lives: 3, p2Lives: 3,
      p1Bullet: null, p2Bullet: null,
      p1FlashEnd: 0, p2FlashEnd: 0,
      ufo: { x: -1, direction: 1, points: 100, active: false },
      ufoTimer: 0,
      score: prevScore, wave: waveNum,
      explosions: [], scorePopups: [],
      lastTime: 0,
      p1BulletTimer: 0, p2BulletTimer: 0,
      alienBulletMoveTimer: 0, playerMoveTimer: 0,
      bunkers: makeBunkers(),
      waveSpeedMult,
    }
  }, [])

  // ── Drawing ────────────────────────────────────────────────────────────────

  const drawAlien = useCallback((
    ctx: CanvasRenderingContext2D, type: AlienType,
    cx: number, cy: number, frame: number, c: number
  ) => {
    const half = c * 0.5
    ctx.save(); ctx.translate(cx, cy)
    if (type === 'A') {
      ctx.fillStyle = frame === 0 ? '#ffff44' : '#ffffff'
      ctx.fillRect(-half * 0.7, -half * 0.5, half * 1.4, half)
      ctx.fillStyle = '#000000'
      ctx.beginPath(); ctx.arc(-half * 0.3, -half * 0.1, half * 0.15, 0, Math.PI * 2); ctx.fill()
      ctx.beginPath(); ctx.arc( half * 0.3, -half * 0.1, half * 0.15, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = frame === 0 ? '#ffff44' : '#ffffff'
      ;[-0.55, -0.2, 0.2, 0.55].forEach(tx => ctx.fillRect(tx * half - 1, half * 0.5, 2, half * (0.3 + (frame === 0 ? 0.2 : 0))))
      ctx.beginPath(); ctx.arc(0, -half * 0.5, half * 0.5, Math.PI, 0); ctx.fill()
    } else if (type === 'B') {
      ctx.fillStyle = '#44ffff'
      ctx.fillRect(-half * 0.9, -half * 0.4, half * 1.8, half * 0.8)
      if (frame === 0) {
        ctx.beginPath(); ctx.moveTo(-half*.9, 0); ctx.lineTo(-half*1.2,-half*.5); ctx.lineTo(-half*.9,-half*.4); ctx.fill()
        ctx.beginPath(); ctx.moveTo( half*.9, 0); ctx.lineTo( half*1.2,-half*.5); ctx.lineTo( half*.9,-half*.4); ctx.fill()
      } else {
        ctx.beginPath(); ctx.moveTo(-half*.9,-half*.3); ctx.lineTo(-half*1.3, half*.1); ctx.lineTo(-half*.9, half*.4); ctx.fill()
        ctx.beginPath(); ctx.moveTo( half*.9,-half*.3); ctx.lineTo( half*1.3, half*.1); ctx.lineTo( half*.9, half*.4); ctx.fill()
      }
      ctx.fillStyle = '#000000'
      ctx.beginPath(); ctx.arc(-half*.35,-half*.1, half*.15, 0, Math.PI*2); ctx.fill()
      ctx.beginPath(); ctx.arc( half*.35,-half*.1, half*.15, 0, Math.PI*2); ctx.fill()
    } else {
      ctx.fillStyle = '#44ff44'
      ctx.fillRect(-half*.8,-half*.3, half*1.6, half*.6)
      ctx.fillRect(-half*.25,-half*.6, half*.5, half*.35)
      if (frame === 0) {
        ctx.fillRect(-half*.9, half*.2, half*.3, half*.25)
        ctx.fillRect( half*.6, half*.2, half*.3, half*.25)
      } else {
        ctx.fillRect(-half*.8, half*.2, half*.3, half*.25)
        ctx.fillRect( half*.5, half*.2, half*.3, half*.25)
      }
    }
    ctx.restore()
  }, [])

  const drawShip = useCallback((
    ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string, c: number, flash: boolean
  ) => {
    if (flash) return
    ctx.save(); ctx.translate(cx, cy)
    ctx.fillStyle = color
    ctx.beginPath(); ctx.moveTo(0,-c*.45); ctx.lineTo(-c*.45,c*.25); ctx.lineTo(c*.45,c*.25); ctx.closePath(); ctx.fill()
    ctx.fillRect(-c*.45, c*.2, c*.9, c*.1)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.beginPath(); ctx.arc(0,-c*.1,c*.1,0,Math.PI*2); ctx.fill()
    ctx.restore()
  }, [])

  const drawUFO = useCallback((ctx: CanvasRenderingContext2D, cx: number, cy: number, c: number) => {
    ctx.save(); ctx.translate(cx, cy)
    ctx.fillStyle = '#ff4444'
    ctx.beginPath(); ctx.ellipse(0,0,c*.55,c*.22,0,0,Math.PI*2); ctx.fill()
    ctx.fillStyle = '#ff8888'
    ctx.beginPath(); ctx.ellipse(0,-c*.15,c*.25,c*.2,0,Math.PI,0); ctx.fill()
    ctx.fillStyle = '#ffff44'
    ;[-0.3, 0, 0.3].forEach(ox => { ctx.beginPath(); ctx.arc(ox*c, c*.05, 2, 0, Math.PI*2); ctx.fill() })
    ctx.restore()
  }, [])

  const drawExplosion = useCallback((ctx: CanvasRenderingContext2D, ex: number, ey: number, c: number) => {
    ctx.save(); ctx.translate(ex, ey)
    ctx.strokeStyle = '#ff8844'; ctx.lineWidth = 2
    ;[[1,0],[-1,0],[0,1],[0,-1],[.7,.7],[-.7,.7],[.7,-.7],[-.7,-.7]].forEach(([dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(dx*c*.1, dy*c*.1); ctx.lineTo(dx*c*.45, dy*c*.45); ctx.stroke()
    })
    ctx.restore()
  }, [])

  const render = useCallback((state: GameState, c: number) => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const W = COLS * c; const H = ROWS * c; const now = Date.now()

    ctx.fillStyle = '#050010'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    STARS.forEach(s => ctx.fillRect(Math.floor(s.x*W), Math.floor(s.y*H), 1, 1))

    // Ground
    ctx.fillStyle = '#33ff33'; ctx.fillRect(0, 26*c, W, 1)

    // Bunkers
    BUNKER_COLS.forEach((cols, bi) => {
      for (let r = 0; r < 2; r++) {
        for (let ci = 0; ci < 3; ci++) {
          const hp = state.bunkers[bi][r][ci]
          if (hp <= 0) continue
          const alpha = 0.35 + (hp / BUNKER_HP) * 0.65
          ctx.fillStyle = `rgba(80,255,80,${alpha.toFixed(2)})`
          // Slightly pixelated look — draw inner rect with gap
          const bx = cols[ci] * c; const by = (BUNKER_ROW + r) * c
          ctx.fillRect(bx + 1, by + 1, c - 2, c - 2)
        }
      }
    })

    // Aliens
    state.aliens.forEach(alien => {
      if (!alien.alive) return
      const ax = (state.alienOffsetX + alien.col + 0.5) * c
      const ay = (state.alienOffsetY + alien.row + 0.5) * c
      drawAlien(ctx, alien.type, ax, ay, state.animFrame, c)
    })

    // UFO
    if (state.ufo.active) drawUFO(ctx, (state.ufo.x + 0.5) * c, 1.5 * c, c)

    // Players
    const now2 = now
    const p1Flash = now2 < state.p1FlashEnd && Math.floor(now2 / 80) % 2 === 0
    const p2Flash = now2 < state.p2FlashEnd && Math.floor(now2 / 80) % 2 === 0
    drawShip(ctx, (state.p1X + 0.5)*c, 25.5*c, '#8844cc', c, p1Flash)
    drawShip(ctx, (state.p2X + 0.5)*c, 25.5*c, '#dd4477', c, p2Flash)

    // Bullets
    if (state.p1Bullet) {
      ctx.fillStyle = '#8844cc'
      ctx.fillRect(state.p1Bullet.x*c - 1, state.p1Bullet.y*c, 2, c*.4)
    }
    if (state.p2Bullet) {
      ctx.fillStyle = '#dd4477'
      ctx.fillRect(state.p2Bullet.x*c - 1, state.p2Bullet.y*c, 2, c*.4)
    }
    state.alienBullets.forEach(b => {
      ctx.fillStyle = '#ffff44'
      ctx.fillRect(b.x*c - 1.5, b.y*c, 3, c*.35)
    })

    // Explosions & popups
    state.explosions.forEach(e => { if (now < e.endTime) drawExplosion(ctx, e.x*c, e.y*c, c) })
    state.scorePopups.forEach(sp => {
      if (now < sp.endTime) {
        ctx.save()
        ctx.globalAlpha = (sp.endTime - now) / 600
        ctx.fillStyle = '#ffff44'
        ctx.font = `bold ${Math.floor(c * 0.6)}px monospace`
        ctx.textAlign = 'center'
        ctx.fillText(`+${sp.value}`, sp.x*c, sp.y*c)
        ctx.restore()
      }
    })
  }, [drawAlien, drawShip, drawUFO, drawExplosion])

  // ── Bunker collision helper ────────────────────────────────────────────────

  const checkBunkerHit = useCallback((state: GameState, bx: number, by: number): boolean => {
    const col = Math.floor(bx)
    const row = Math.floor(by)
    if (row < BUNKER_ROW || row > BUNKER_ROW + 1) return false
    for (let bi = 0; bi < BUNKER_COLS.length; bi++) {
      const colIdx = BUNKER_COLS[bi].indexOf(col as never)
      if (colIdx === -1) continue
      const localRow = row - BUNKER_ROW
      if (state.bunkers[bi][localRow][colIdx] > 0) {
        state.bunkers[bi][localRow][colIdx]--
        return true
      }
    }
    return false
  }, [])

  // ── Update ─────────────────────────────────────────────────────────────────

  const update = useCallback((
    state: GameState, dt: number,
    onMarch: (step: number, alive: number) => void,
    onShoot: () => void,
    onAlienDie: () => void,
    onPlayerDie: () => void,
    onUFOStart: () => void,
    onUFOEnd: () => void,
    onVictory: () => void,
  ): { newPhase?: Phase; newScore?: number; newP1Lives?: number; newP2Lives?: number } => {
    const now = Date.now()
    const result: { newPhase?: Phase; newScore?: number; newP1Lives?: number; newP2Lives?: number } = {}

    // ── Player movement ──────────────────────────────────────────────────────
    state.playerMoveTimer += dt
    if (state.playerMoveTimer >= 60) {
      state.playerMoveTimer = 0
      const p1L = keysRef.current.has('a') || keysRef.current.has('ArrowLeft') || p1LeftRef.current
      const p1R = keysRef.current.has('d') || keysRef.current.has('ArrowRight') || p1RightRef.current
      const p2L = keysRef.current.has('j') || p2LeftRef.current
      const p2R = keysRef.current.has('l') || p2RightRef.current
      if (p1L && state.p1X > 0) state.p1X--
      if (p1R && state.p1X < COLS - 1) state.p1X++
      if (p2L && state.p2X > 0) state.p2X--
      if (p2R && state.p2X < COLS - 1) state.p2X++
    }

    // ── Player shooting ──────────────────────────────────────────────────────
    state.p1BulletTimer += dt; state.p2BulletTimer += dt
    const p1Fire = keysRef.current.has(' ') || keysRef.current.has('z') || p1FireRef.current
    const p2Fire = keysRef.current.has('k') || p2FireRef.current
    if (p1Fire && !state.p1Bullet && state.p1BulletTimer > 280) {
      state.p1Bullet = { x: state.p1X + 0.5, y: 25, owner: 'p1' }
      state.p1BulletTimer = 0
      onShoot()
    }
    if (p2Fire && !state.p2Bullet && state.p2BulletTimer > 280) {
      state.p2Bullet = { x: state.p2X + 0.5, y: 25, owner: 'p2' }
      state.p2BulletTimer = 0
      onShoot()
    }

    // ── Move player bullets ──────────────────────────────────────────────────
    if (state.p1Bullet) {
      state.p1Bullet.y -= dt / 40
      // Bunker check
      if (checkBunkerHit(state, state.p1Bullet.x, state.p1Bullet.y)) { state.p1Bullet = null }
      else if (state.p1Bullet && state.p1Bullet.y < 0) state.p1Bullet = null
    }
    if (state.p2Bullet) {
      state.p2Bullet.y -= dt / 40
      if (checkBunkerHit(state, state.p2Bullet.x, state.p2Bullet.y)) { state.p2Bullet = null }
      else if (state.p2Bullet && state.p2Bullet.y < 0) state.p2Bullet = null
    }

    // ── Move alien bullets ───────────────────────────────────────────────────
    state.alienBulletMoveTimer += dt
    if (state.alienBulletMoveTimer >= 130) {
      state.alienBulletMoveTimer = 0
      state.alienBullets = state.alienBullets.filter(b => b.y < ROWS)
      state.alienBullets.forEach(b => {
        b.y += 1
        // Damage bunker
        checkBunkerHit(state, b.x, b.y)
      })
      state.alienBullets = state.alienBullets.filter(b => {
        // Remove if it hit a bunker (HP would have decremented but bullet should still pass in original SI,
        // but we remove here for easier gameplay)
        return b.y < ROWS
      })
    }

    // ── Alien movement ───────────────────────────────────────────────────────
    const aliveAliens = state.aliens.filter(a => a.alive)
    const aliveCount = aliveAliens.length

    if (aliveCount === 0) {
      onVictory()
      result.newPhase = 'victory'
      return result
    }

    const moveInterval = alienMoveInterval(aliveCount, state.waveSpeedMult)
    state.moveTimer += dt
    if (state.moveTimer >= moveInterval) {
      state.moveTimer = 0
      state.animFrame = state.animFrame === 0 ? 1 : 0

      // March beat
      onMarch(state.marchStep, aliveCount)
      state.marchStep = (state.marchStep + 1) % 4

      const minCol = Math.min(...aliveAliens.map(a => state.alienOffsetX + a.col))
      const maxCol = Math.max(...aliveAliens.map(a => state.alienOffsetX + a.col))

      if (state.alienDirX === 1 && maxCol >= COLS - 1) {
        state.alienDirX = -1; state.alienOffsetY += 1
      } else if (state.alienDirX === -1 && minCol <= 0) {
        state.alienDirX = 1; state.alienOffsetY += 1
      } else {
        state.alienOffsetX += state.alienDirX
      }

      // Reached players
      const maxRow = Math.max(...aliveAliens.map(a => state.alienOffsetY + a.row))
      if (maxRow >= 23) { result.newPhase = 'gameover'; return result }
    }

    // ── Alien shooting ───────────────────────────────────────────────────────
    state.alienShootTimer += dt
    if (state.alienShootTimer >= state.alienShootInterval
        && state.alienBullets.length < MAX_ALIEN_BULLETS
        && aliveCount > 0) {
      state.alienShootTimer = 0
      state.alienShootInterval = SHOOT_INTERVAL_MIN + Math.random() * SHOOT_INTERVAL_VAR

      // Prefer bottom-row aliens (most dangerous, authentic SI behaviour)
      const bottomAliens = aliveAliens.filter(a => {
        const row = state.alienOffsetY + a.row
        return !aliveAliens.some(b => b.alive && state.alienOffsetY + b.row > row && b.col === a.col)
      })
      const shooter = bottomAliens[Math.floor(Math.random() * bottomAliens.length)]
      state.alienBullets.push({
        x: state.alienOffsetX + shooter.col + 0.5,
        y: state.alienOffsetY + shooter.row + 1,
        owner: 'alien',
      })
    }

    // ── UFO ──────────────────────────────────────────────────────────────────
    state.ufoTimer += dt
    if (!state.ufo.active && state.ufoTimer >= 20000) {
      state.ufoTimer = 0
      const pts = [50, 100, 150, 300][Math.floor(Math.random() * 4)]
      state.ufo = { x: 0, direction: 1, points: pts, active: true }
      onUFOStart()
    }
    if (state.ufo.active) {
      state.ufo.x += state.ufo.direction * dt / 200
      if (state.ufo.x > COLS || state.ufo.x < -1) {
        state.ufo.active = false
        onUFOEnd()
      }
    }

    // ── Player bullets vs aliens ─────────────────────────────────────────────
    ;[state.p1Bullet, state.p2Bullet].forEach((bullet, bi) => {
      if (!bullet) return
      for (let i = 0; i < state.aliens.length; i++) {
        const alien = state.aliens[i]
        if (!alien.alive) continue
        const ax = state.alienOffsetX + alien.col + 0.5
        const ay = state.alienOffsetY + alien.row + 0.5
        if (Math.abs(bullet.x - ax) < 0.65 && Math.abs(bullet.y - ay) < 0.65) {
          alien.alive = false
          const pts = alienPoints(alien.type)
          state.score += pts
          result.newScore = state.score
          state.explosions.push({ x: ax, y: ay, endTime: now + 400 })
          state.scorePopups.push({ x: ax, y: ay - 0.5, value: pts, endTime: now + 600 })
          if (bi === 0) state.p1Bullet = null; else state.p2Bullet = null
          onAlienDie()
          break
        }
      }
    })

    // ── Player bullets vs UFO ────────────────────────────────────────────────
    if (state.ufo.active) {
      const ux = state.ufo.x + 0.5; const uy = 1.5
      ;[state.p1Bullet, state.p2Bullet].forEach((bullet, bi) => {
        if (!bullet || !state.ufo.active) return
        if (Math.abs(bullet.x - ux) < 0.7 && Math.abs(bullet.y - uy) < 0.5) {
          state.score += state.ufo.points
          result.newScore = state.score
          state.explosions.push({ x: ux, y: uy, endTime: now + 400 })
          state.scorePopups.push({ x: ux, y: uy - 0.5, value: state.ufo.points, endTime: now + 800 })
          state.ufo.active = false
          onUFOEnd()
          if (bi === 0) state.p1Bullet = null; else state.p2Bullet = null
        }
      })
    }

    // ── Alien bullets vs players ─────────────────────────────────────────────
    state.alienBullets = state.alienBullets.filter(b => {
      const hitP1 = Math.abs(b.x - (state.p1X + 0.5)) < 0.6 && Math.abs(b.y - 25.5) < 0.6
      const hitP2 = Math.abs(b.x - (state.p2X + 0.5)) < 0.6 && Math.abs(b.y - 25.5) < 0.6
      if (hitP1 && now > state.p1FlashEnd) {
        state.p1Lives = Math.max(0, state.p1Lives - 1)
        result.newP1Lives = state.p1Lives
        state.p1FlashEnd = now + 1500
        state.explosions.push({ x: state.p1X + 0.5, y: 25.5, endTime: now + 400 })
        onPlayerDie()
        if (state.p1Lives <= 0 && state.p2Lives <= 0) result.newPhase = 'gameover'
        return false
      }
      if (hitP2 && now > state.p2FlashEnd) {
        state.p2Lives = Math.max(0, state.p2Lives - 1)
        result.newP2Lives = state.p2Lives
        state.p2FlashEnd = now + 1500
        state.explosions.push({ x: state.p2X + 0.5, y: 25.5, endTime: now + 400 })
        onPlayerDie()
        if (state.p1Lives <= 0 && state.p2Lives <= 0) result.newPhase = 'gameover'
        return false
      }
      return true
    })

    state.explosions = state.explosions.filter(e => now < e.endTime)
    state.scorePopups = state.scorePopups.filter(s => now < s.endTime)
    return result
  }, [checkBunkerHit])

  // ── Game loop ──────────────────────────────────────────────────────────────

  const gameLoop = useCallback((timestamp: number) => {
    const state = stateRef.current; if (!state) return
    const dt = state.lastTime === 0 ? 16 : Math.min(timestamp - state.lastTime, 50)
    state.lastTime = timestamp

    const results = update(
      state, dt,
      playMarch, playShoot, playAlienDie, playPlayerDie,
      startUFOSiren, stopUFOSiren,
      playWaveClear,
    )

    render(state, cell)

    if (results.newScore  !== undefined) setScore(results.newScore)
    if (results.newP1Lives !== undefined) setP1Lives(results.newP1Lives)
    if (results.newP2Lives !== undefined) setP2Lives(results.newP2Lives)

    if (results.newPhase) {
      setPhase(results.newPhase)
      stopUFOSiren()
      if (results.newPhase === 'victory') {
        const currentScore = stateRef.current?.score || 0
        const currentWave  = stateRef.current?.wave  || 1
        setTimeout(() => {
          const newWave  = currentWave + 1
          const newState = initState(newWave, currentScore)
          stateRef.current = newState
          setWave(newWave); setPhase('playing')
          setP1Lives(3); setP2Lives(3)
        }, 2000)
      }
      if (results.newPhase === 'gameover') playGameOver()
      return
    }

    animRef.current = requestAnimationFrame(gameLoop)
  }, [cell, update, render, initState,
      playMarch, playShoot, playAlienDie, playPlayerDie,
      startUFOSiren, stopUFOSiren, playWaveClear, playGameOver])

  const startGame = useCallback(() => {
    initAudio()
    const state = initState(1)
    stateRef.current = state
    setScore(0); setP1Lives(3); setP2Lives(3); setWave(1); setPhase('playing')
  }, [initState, initAudio])

  useEffect(() => {
    if (phase === 'playing') {
      if (stateRef.current) stateRef.current.lastTime = 0
      animRef.current = requestAnimationFrame(gameLoop)
      return () => cancelAnimationFrame(animRef.current)
    }
  }, [phase, gameLoop])

  useEffect(() => {
    if (phase !== 'playing') cancelAnimationFrame(animRef.current)
  }, [phase])

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current.add(e.key)
      if ([' ','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault()
    }
    const up = (e: KeyboardEvent) => keysRef.current.delete(e.key)
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  useEffect(() => {
    if (phase === 'start') { const t = setTimeout(() => startGame(), 2000); return () => clearTimeout(t) }
  }, [phase, startGame])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      stopUFOSiren()
      try { audioCtxRef.current?.close() } catch (_) { /* ignore */ }
    }
  }, [stopUFOSiren])

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current
    mutedRef.current = next
    setMuted(next)
    if (audioMasterRef.current) audioMasterRef.current.gain.value = next ? 0 : 0.25
  }, [])

  // ── UI ─────────────────────────────────────────────────────────────────────

  const canvasW = COLS * cell; const canvasH = ROWS * cell

  const lives = (n: number, color: string) =>
    Array.from({ length: 3 }, (_, i) => (
      <span key={i} style={{ color: i < n ? color : '#333', fontSize: 14 }}>♥</span>
    ))

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#050010', display: 'flex', flexDirection: 'column',
      alignItems: 'center', overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: canvasW + 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 4px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#aaa', fontSize: 18, cursor: 'pointer', padding: 4,
          }}>✕</button>
          <button onClick={toggleMute} style={{
            background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', padding: 4,
            opacity: muted ? 0.5 : 1,
          }} title={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🎵'}
          </button>
        </div>

        <div style={{ color: '#44ff44', fontSize: 16, fontWeight: 700, fontFamily: 'monospace',
          textShadow: '0 0 8px #44ff44' }}>
          SCORE: {score}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontSize: 12, fontFamily: 'monospace', gap: 12 }}>
          <span>P1 {lives(p1Lives, '#8844cc')}</span>
          <span style={{ color: '#555' }}>W{wave}</span>
          <span>{lives(p2Lives, '#dd4477')} P2</span>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ width: '100%', maxWidth: canvasW + 16, padding: '0 4px', position: 'relative' }}>
        <canvas
          ref={canvasRef} width={canvasW} height={canvasH}
          style={{ display: 'block', margin: '0 auto', border: '1px solid #1a0030' }}
        />

        {phase === 'start' && (
          <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.75)' }}>
            <div style={{ color:'#44ff44',fontSize:28,fontWeight:700,fontFamily:'monospace',
              textShadow:'0 0 16px #44ff44' }}>SPACE INVADERS</div>
            <div style={{ color:'#888',fontSize:13,marginTop:8,fontFamily:'monospace' }}>Starting in 2 seconds…</div>
            <div style={{ color:'#555',fontSize:11,marginTop:16,fontFamily:'monospace',textAlign:'center',lineHeight:1.8 }}>
              P1: A/D · Space/Z&nbsp;&nbsp;|&nbsp;&nbsp;P2: J/L · K
            </div>
          </div>
        )}
        {phase === 'victory' && (
          <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.75)' }}>
            <div style={{ color:'#ffff44',fontSize:24,fontWeight:700,fontFamily:'monospace',
              textShadow:'0 0 16px #ffff44' }}>WAVE {wave} CLEAR!</div>
            <div style={{ color:'#888',fontSize:13,marginTop:8,fontFamily:'monospace' }}>Next wave incoming…</div>
          </div>
        )}
        {phase === 'gameover' && (
          <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.85)',gap:12 }}>
            <div style={{ color:'#ff4444',fontSize:28,fontWeight:700,fontFamily:'monospace',
              textShadow:'0 0 16px #ff4444' }}>GAME OVER</div>
            <div style={{ color:'#ffff44',fontSize:16,fontFamily:'monospace' }}>SCORE: {score}</div>
            <button onClick={startGame} style={{
              marginTop:8,padding:'8px 24px',
              background:'#8844cc',color:'#fff',border:'none',borderRadius:8,
              fontFamily:'monospace',fontWeight:700,fontSize:14,cursor:'pointer',
              boxShadow:'0 0 12px #8844cc',
            }}>PLAY AGAIN</button>
          </div>
        )}
      </div>

      {/* Mobile controls */}
      <div style={{ display:'flex',justifyContent:'space-between',
        width:'100%',maxWidth:canvasW+16,padding:'8px 4px',gap:8,marginTop:4 }}>
        {/* P1 */}
        <div style={{ display:'flex',gap:6,alignItems:'center' }}>
          <button onPointerDown={()=>{p1LeftRef.current=true}} onPointerUp={()=>{p1LeftRef.current=false}} onPointerLeave={()=>{p1LeftRef.current=false}}
            style={{ width:48,height:48,background:'#8844cc44',border:'1px solid #8844cc',color:'#8844cc',borderRadius:8,fontSize:18,cursor:'pointer',userSelect:'none' }}>←</button>
          <button onPointerDown={()=>{p1FireRef.current=true}} onPointerUp={()=>{p1FireRef.current=false}} onPointerLeave={()=>{p1FireRef.current=false}}
            style={{ width:60,height:48,background:'#8844cc88',border:'2px solid #8844cc',color:'#fff',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',userSelect:'none' }}>FIRE</button>
          <button onPointerDown={()=>{p1RightRef.current=true}} onPointerUp={()=>{p1RightRef.current=false}} onPointerLeave={()=>{p1RightRef.current=false}}
            style={{ width:48,height:48,background:'#8844cc44',border:'1px solid #8844cc',color:'#8844cc',borderRadius:8,fontSize:18,cursor:'pointer',userSelect:'none' }}>→</button>
        </div>
        {/* P2 */}
        <div style={{ display:'flex',gap:6,alignItems:'center' }}>
          <button onPointerDown={()=>{p2LeftRef.current=true}} onPointerUp={()=>{p2LeftRef.current=false}} onPointerLeave={()=>{p2LeftRef.current=false}}
            style={{ width:48,height:48,background:'#dd447744',border:'1px solid #dd4477',color:'#dd4477',borderRadius:8,fontSize:18,cursor:'pointer',userSelect:'none' }}>←</button>
          <button onPointerDown={()=>{p2FireRef.current=true}} onPointerUp={()=>{p2FireRef.current=false}} onPointerLeave={()=>{p2FireRef.current=false}}
            style={{ width:60,height:48,background:'#dd447788',border:'2px solid #dd4477',color:'#fff',borderRadius:8,fontSize:11,fontWeight:700,cursor:'pointer',userSelect:'none' }}>FIRE</button>
          <button onPointerDown={()=>{p2RightRef.current=true}} onPointerUp={()=>{p2RightRef.current=false}} onPointerLeave={()=>{p2RightRef.current=false}}
            style={{ width:48,height:48,background:'#dd447744',border:'1px solid #dd4477',color:'#dd4477',borderRadius:8,fontSize:18,cursor:'pointer',userSelect:'none' }}>→</button>
        </div>
      </div>

      <div style={{ color:'#444',fontSize:10,fontFamily:'monospace',textAlign:'center',paddingBottom:12 }}>
        P1: A/D move · Space/Z fire &nbsp;|&nbsp; P2: J/L move · K fire
      </div>
    </div>
  )
}
