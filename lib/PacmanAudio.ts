/**
 * PacmanAudio — Animal Crossing × Pac-Man sound engine
 * Pure Web Audio API, no files, no deps.
 * AC vibe: marimba tones, pentatonic melodies, gentle bells.
 */

// ── Note frequencies (Hz) ────────────────────────────────────────────────────

const N = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  Cs4: 277.18, Ds4: 311.13, Fs4: 369.99, Gs4: 415.30, As4: 466.16,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  Cs5: 554.37, Ds5: 622.25, Fs5: 739.99, Gs5: 830.61, As5: 932.33,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98, A6: 1760.00,
  C7: 2093.00,
}

// ── BGM sequences ────────────────────────────────────────────────────────────
// [freq, duration_seconds]
type Seq = [number, number][]

// Main theme — AC-flavoured, C major, marimba lead
// Tempo ≈ 120 BPM (8th note = 0.25 s)
const MELODY_MAIN: Seq = [
  [N.G5, 0.25], [N.E5, 0.25], [N.C5, 0.25], [N.E5, 0.25],
  [N.G5, 0.25], [N.A5, 0.5 ], [N.G5, 0.25],
  [N.E5, 0.25], [N.D5, 0.25], [N.E5, 0.25], [N.G5, 0.25],
  [N.A5, 0.25], [N.G5, 0.25], [N.E5, 0.5 ],
  [N.C5, 0.25], [N.D5, 0.25], [N.E5, 0.25], [N.G5, 0.25],
  [N.E5, 0.5 ], [N.D5, 0.25], [N.C5, 0.5 ],
]

const BASS_MAIN: Seq = [
  [N.C3, 1.0], [N.G3, 1.0],
  [N.A3, 0.5], [N.G3, 0.5],
  [N.F3, 1.0], [N.G3, 1.0],
]

// Power-pellet mode — faster, wilder, still AC-ish
const MELODY_POWER: Seq = [
  [N.C5, 0.13], [N.Ds5, 0.13], [N.G5, 0.13], [N.As5, 0.13],
  [N.G5, 0.13], [N.Ds5, 0.13], [N.C5, 0.13], [N.As4, 0.13],
  [N.C5, 0.13], [N.E5, 0.13], [N.G5, 0.13], [N.C6, 0.26],
  [N.A5, 0.13], [N.G5, 0.13], [N.E5, 0.13], [N.C5, 0.26],
]

// ── Audio class ──────────────────────────────────────────────────────────────

export class PacmanAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private muted = false

  // BGM sequencer state
  private bgmTimer: ReturnType<typeof setTimeout> | null = null
  private melodyStep = 0
  private bassStep = 0
  private powerMode = false

  // Waka alternator
  private wakaFlip = false

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return
    }
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.28
    this.master.connect(this.ctx.destination)
  }

  destroy() {
    this._stopBGM()
    try { this.ctx?.close() } catch (_) { /* ignore */ }
    this.ctx = null
    this.master = null
  }

  setMuted(m: boolean) {
    this.muted = m
    if (this.master) this.master.gain.value = m ? 0 : 0.28
  }
  get isMuted() { return this.muted }

  // ── Primitive oscillators ──────────────────────────────────────────────────

  private _tone(
    freq: number,
    dur: number,
    vol: number,
    when: number,
    type: OscillatorType = 'sine',
    detune = 0,
    attack = 0.005,
  ) {
    if (!this.ctx || !this.master || freq <= 0) return
    const ctx = this.ctx
    const t = ctx.currentTime + when
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    osc.detune.value = detune
    env.gain.setValueAtTime(0.0001, t)
    env.gain.linearRampToValueAtTime(vol, t + attack)
    env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(dur, 0.02))
    osc.connect(env)
    env.connect(this.master)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  }

  // Marimba: sine + faint upper partial, quick decay
  private _marimba(freq: number, vol = 0.28, when = 0) {
    this._tone(freq,         0.45, vol,       when, 'sine')
    this._tone(freq * 2.01,  0.18, vol * 0.18, when, 'sine') // 2nd harmonic shimmer
  }

  // Bell: longer tail, slight inharmonic partial (AC clock-bell feel)
  private _bell(freq: number, vol = 0.22, when = 0) {
    this._tone(freq,         0.9,  vol,       when, 'sine')
    this._tone(freq * 2.756, 0.45, vol * 0.14, when, 'sine') // bell partial
  }

  // Soft bass pluck
  private _bass(freq: number, vol = 0.18, when = 0) {
    this._tone(freq, 0.38, vol, when, 'triangle')
  }

  // Short percussive blip (AC dialogue pop)
  private _blip(freq: number, vol = 0.15, when = 0) {
    this._tone(freq, 0.07, vol, when, 'sine', 0, 0.002)
  }

  // ── Game sounds ────────────────────────────────────────────────────────────

  /** Waka-waka — two alternating AC dialogue blips */
  playWaka() {
    if (!this.ctx) return
    this.wakaFlip = !this.wakaFlip
    this._blip(this.wakaFlip ? N.C5 : N.G4, 0.16)
  }

  /** Power pellet collected — excited ascending bell run */
  playPowerPellet() {
    if (!this.ctx) return
    const run = [N.C5, N.E5, N.G5, N.A5, N.C6]
    run.forEach((f, i) => this._bell(f, 0.28, i * 0.06))
  }

  /** Ghost eaten — happy ascending chime */
  playGhostEaten() {
    if (!this.ctx) return
    const run = [N.E6, N.G6, N.A6, N.C7]
    run.forEach((f, i) => this._bell(f, 0.25, i * 0.055))
  }

  /** Death — sad descending chromatic marimba phrase (AC "uh oh" vibe) */
  playDeath() {
    if (!this.ctx) return
    const notes = [N.G4, N.Fs4, N.F4, N.E4, N.Ds4, N.D4, N.Cs4, N.C4]
    notes.forEach((f, i) => this._marimba(f, 0.22, i * 0.11))
  }

  /** Level complete — bright rising AC fanfare */
  playVictory() {
    if (!this.ctx) return
    // C major arpeggio up then triumphant high note
    const phrase: Seq = [
      [N.C5, 0.14], [N.E5, 0.14], [N.G5, 0.14],
      [N.C6, 0.35], [N.G5, 0.14], [N.E5, 0.14],
      [N.C6, 0.55],
    ]
    let t = 0
    for (const [f, d] of phrase) {
      this._bell(f, 0.32, t)
      t += d
    }
  }

  // ── Background music ───────────────────────────────────────────────────────

  startBGM() {
    this._stopBGM()
    this.powerMode = false
    this.melodyStep = 0
    this.bassStep = 0
    this._tickBGM()
  }

  startPowerMode() {
    this._stopBGM()
    this.powerMode = true
    this.melodyStep = 0
    this._tickBGM()
  }

  endPowerMode() {
    this.startBGM()
  }

  stopBGM() {
    this._stopBGM()
  }

  private _stopBGM() {
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer)
      this.bgmTimer = null
    }
  }

  private _tickBGM() {
    if (!this.ctx || !this.master) return

    const melody = this.powerMode ? MELODY_POWER : MELODY_MAIN
    const [freq, dur] = melody[this.melodyStep % melody.length]

    // Lead marimba
    this._marimba(freq, this.powerMode ? 0.22 : 0.19)

    // Bass on every other note in normal mode
    if (!this.powerMode && this.melodyStep % 2 === 0) {
      const [bFreq] = BASS_MAIN[this.bassStep % BASS_MAIN.length]
      this._bass(bFreq, 0.14)
      this.bassStep++
    }

    // Gentle bell accent on phrase peak notes
    if (!this.powerMode && [2, 6, 10, 14].includes(this.melodyStep % melody.length)) {
      this._bell(freq * 2, 0.08, 0.01) // soft shimmer
    }

    this.melodyStep++
    this.bgmTimer = setTimeout(() => this._tickBGM(), dur * 1000)
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

let _instance: PacmanAudio | null = null
export function getPacmanAudio(): PacmanAudio {
  if (!_instance) _instance = new PacmanAudio()
  return _instance
}
