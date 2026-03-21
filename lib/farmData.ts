// ── Crop & Tree definitions ───────────────────────────────────────────────────

export interface CropDef {
  id: string
  label: string
  emoji: string
  type: 'tree' | 'bush' | 'annual' | 'fungus' | 'perennial'
  /** true for the oak tree (legacy compat) */
  isTee: boolean
  growthMs: number           // ms from last watering → ready
  wiltWindowMs: number | null  // ms after ready before wilting; null = never
  wateringsNeeded: number    // 0 | 1 | 2
  waterAt: number[]          // growth fractions requiring a watering, e.g. [0] or [0, 0.5]
  harvestType: 'pick' | 'cut' | 'shake' | 'dig'
  drops: Array<{ resource: keyof FarmResources; amount: number }>
  regrows: boolean
  maxRegrows?: number
  requiresNearTree: boolean
  treeProximity?: number     // max Chebyshev distance to a full oak
  spacing: number            // min Chebyshev distance from other trees (1 for crops)
  phases: Array<{ label: string; emoji: string; threshold: number }> // threshold = fraction of growthMs
  stalledEmoji: string       // shown when stalled waiting for a watering
}

export interface FarmResources {
  acorns: number
  wood: number
  gems: number
  blueberries: number
  sunflowerSeeds: number
  petals: number
  wheat: number
  mushrooms: number
  strawberries: number
  lavender: number
  truffles: number
}

export const MARKET_PRICES: Partial<Record<keyof FarmResources, number>> = {
  blueberries:    2,
  strawberries:   3,
  sunflowerSeeds: 2,
  petals:         2,
  wheat:          1,
  mushrooms:      4,
  lavender:       2,
  truffles:       20,
  acorns:         1,
}

export const EMPTY_RESOURCES: FarmResources = {
  acorns: 0, wood: 0, gems: 0,
  blueberries: 0, sunflowerSeeds: 0, petals: 0, wheat: 0,
  mushrooms: 0, strawberries: 0, lavender: 0, truffles: 0,
}

// Growth times in milliseconds
const H = (n: number) => n * 60 * 60 * 1000   // hours → ms

export const CROP_DEFS: Record<string, CropDef> = {
  oak: {
    id: 'oak', label: 'Oak Tree', emoji: '🌳',
    type: 'tree', isTee: true,
    growthMs: H(4),          // 4h per stage (sapling→young, young→full)
    wiltWindowMs: null,
    wateringsNeeded: 1, waterAt: [0],
    harvestType: 'shake',
    drops: [{ resource: 'acorns', amount: 1 }],
    regrows: true,
    requiresNearTree: false, spacing: 3,
    phases: [
      { label: 'Sapling', emoji: '🌱', threshold: 0 },
      { label: 'Young',   emoji: '🌿', threshold: 0.5 },
      { label: 'Full',    emoji: '🌳', threshold: 1 },
    ],
    stalledEmoji: '💧',
  },
  blueberry: {
    id: 'blueberry', label: 'Blueberry Bush', emoji: '🫐',
    type: 'bush', isTee: false,
    growthMs: H(4), wiltWindowMs: null,
    wateringsNeeded: 1, waterAt: [0],
    harvestType: 'pick',
    drops: [{ resource: 'blueberries', amount: 3 }],
    regrows: true,
    requiresNearTree: false, spacing: 1,
    phases: [
      { label: 'Seedling', emoji: '🌱', threshold: 0 },
      { label: 'Growing',  emoji: '🌿', threshold: 0.4 },
      { label: 'Ready',    emoji: '🫐', threshold: 1 },
    ],
    stalledEmoji: '💧',
  },
  sunflower: {
    id: 'sunflower', label: 'Sunflower', emoji: '🌻',
    type: 'annual', isTee: false,
    growthMs: H(2), wiltWindowMs: H(24),
    wateringsNeeded: 1, waterAt: [0],
    harvestType: 'cut',
    drops: [{ resource: 'sunflowerSeeds', amount: 2 }, { resource: 'petals', amount: 1 }],
    regrows: false,
    requiresNearTree: false, spacing: 1,
    phases: [
      { label: 'Seedling', emoji: '🌱', threshold: 0 },
      { label: 'Budding',  emoji: '🌼', threshold: 0.4 },
      { label: 'Bloom',    emoji: '🌻', threshold: 1 },
    ],
    stalledEmoji: '💧',
  },
  wheat: {
    id: 'wheat', label: 'Wheat', emoji: '🌾',
    type: 'annual', isTee: false,
    growthMs: H(3), wiltWindowMs: H(12),
    wateringsNeeded: 1, waterAt: [0],
    harvestType: 'cut',
    drops: [{ resource: 'wheat', amount: 2 }],
    regrows: false,
    requiresNearTree: false, spacing: 1,
    phases: [
      { label: 'Seedling', emoji: '🌱', threshold: 0 },
      { label: 'Growing',  emoji: '🌿', threshold: 0.4 },
      { label: 'Ready',    emoji: '🌾', threshold: 1 },
    ],
    stalledEmoji: '💧',
  },
  rose: {
    id: 'rose', label: 'Rose', emoji: '🌹',
    type: 'perennial', isTee: false,
    growthMs: H(6), wiltWindowMs: H(8),
    wateringsNeeded: 2, waterAt: [0, 0.5],
    harvestType: 'cut',
    drops: [{ resource: 'petals', amount: 3 }],
    regrows: false,
    requiresNearTree: false, spacing: 1,
    phases: [
      { label: 'Seedling', emoji: '🌱', threshold: 0 },
      { label: 'Budding',  emoji: '🌹', threshold: 0.4 },
      { label: 'Bloom',    emoji: '🌸', threshold: 1 },
    ],
    stalledEmoji: '💧',
  },
  mushroom: {
    id: 'mushroom', label: 'Mushroom', emoji: '🍄',
    type: 'fungus', isTee: false,
    growthMs: H(8), wiltWindowMs: H(48),
    wateringsNeeded: 0, waterAt: [],
    harvestType: 'pick',
    drops: [{ resource: 'mushrooms', amount: 2 }],
    regrows: true,
    requiresNearTree: true, treeProximity: 2, spacing: 1,
    phases: [
      { label: 'Spore',  emoji: '🟤', threshold: 0 },
      { label: 'Pin',    emoji: '⬜', threshold: 0.4 },
      { label: 'Mature', emoji: '🍄', threshold: 1 },
    ],
    stalledEmoji: '🌳',
  },
  strawberry: {
    id: 'strawberry', label: 'Strawberry', emoji: '🍓',
    type: 'bush', isTee: false,
    growthMs: H(3), wiltWindowMs: H(6),
    wateringsNeeded: 2, waterAt: [0, 0.5],
    harvestType: 'pick',
    drops: [{ resource: 'strawberries', amount: 2 }],
    regrows: true,
    requiresNearTree: false, spacing: 1,
    phases: [
      { label: 'Seedling',   emoji: '🌱', threshold: 0 },
      { label: 'Flowering',  emoji: '🌸', threshold: 0.4 },
      { label: 'Berry',      emoji: '🍓', threshold: 1 },
    ],
    stalledEmoji: '💧',
  },
  lavender: {
    id: 'lavender', label: 'Lavender', emoji: '🪻',
    type: 'annual', isTee: false,
    growthMs: H(5), wiltWindowMs: H(72),
    wateringsNeeded: 1, waterAt: [0],
    harvestType: 'cut',
    drops: [{ resource: 'lavender', amount: 4 }],
    regrows: false,
    requiresNearTree: false, spacing: 1,
    phases: [
      { label: 'Seedling', emoji: '🌱', threshold: 0 },
      { label: 'Growing',  emoji: '💜', threshold: 0.4 },
      { label: 'Bloom',    emoji: '🪻', threshold: 1 },
    ],
    stalledEmoji: '💧',
  },
  truffle: {
    id: 'truffle', label: 'Truffle', emoji: '🔎',
    type: 'fungus', isTee: false,
    growthMs: H(24), wiltWindowMs: null,
    wateringsNeeded: 0, waterAt: [],
    harvestType: 'dig',
    drops: [{ resource: 'truffles', amount: 1 }],
    regrows: false,
    requiresNearTree: true, treeProximity: 3, spacing: 1,
    phases: [
      { label: 'Hidden',  emoji: '🟫', threshold: 0 },
      { label: 'Growing', emoji: '🟫', threshold: 0.4 },
      { label: 'Ready',   emoji: '🔎', threshold: 1 },
    ],
    stalledEmoji: '🌳',
  },
}

export const TREE_STAGES = [
  { name: 'sapling', emoji: '🌱', minMs: 0 },
  { name: 'young',   emoji: '🌿', minMs: H(4) },
  { name: 'full',    emoji: '🌳', minMs: H(8) },   // 4h sapling + 4h young = 8h total
]

export const OAK_ACORN_INTERVAL_MS = H(6)   // acorn every 6h
export const OAK_WOOD_BY_STAGE: Record<string, number> = {
  sapling: 0, young: 1, full: 4,
}

// ── Plot type ─────────────────────────────────────────────────────────────────

export interface FarmPlot {
  id: string
  cropType: string
  x: number
  y: number
  plantedAt: string        // ISO timestamp
  wateredAt: string | null // ISO timestamp; null = not yet watered (first watering)
  secondWateredAt: string | null  // ISO timestamp of second watering (for 2-watering crops)
  waterCount: number       // total times this plot has been watered (defaults to 0)
  stalledAt: string | null // ISO timestamp when crop stalled waiting for next watering
  lastHarvestedAt: string | null
  harvestCount: number
}

// ── Stage calculation ─────────────────────────────────────────────────────────

export type CropStage = 'unwatered' | 'growing' | 'stalled' | 'ready' | 'wilted'
export type TreeStage = 'sapling' | 'young' | 'full'

export function getTreeStage(plot: FarmPlot): TreeStage {
  const age = Date.now() - new Date(plot.plantedAt).getTime()
  if (age >= TREE_STAGES[2].minMs) return 'full'
  if (age >= TREE_STAGES[1].minMs) return 'young'
  return 'sapling'
}

export function getCropStage(plot: FarmPlot): CropStage {
  const def = CROP_DEFS[plot.cropType]
  if (!def || def.isTee) return 'growing'
  if (def.wateringsNeeded > 0 && !plot.wateredAt) return 'unwatered'
  if (plot.stalledAt) return 'stalled'
  // After regrow harvests, use lastHarvestedAt as the new "watered" baseline
  const baseTime = plot.lastHarvestedAt && def.regrows
    ? new Date(plot.lastHarvestedAt).getTime()
    : new Date(plot.wateredAt ?? plot.plantedAt).getTime()
  const age = Date.now() - baseTime
  if (age < def.growthMs) return 'growing'
  if (def.wiltWindowMs !== null && age > def.growthMs + def.wiltWindowMs) return 'wilted'
  return 'ready'
}

export function getGrowthPct(plot: FarmPlot): number {
  const def = CROP_DEFS[plot.cropType]
  if (!def || def.isTee) return 0
  // Fungus crops (mushroom/truffle) grow from plantedAt with no watering
  const startTime = def.wateringsNeeded === 0
    ? new Date(plot.plantedAt).getTime()
    : plot.wateredAt
      ? new Date(plot.wateredAt).getTime()
      : null
  if (startTime === null) return 0
  const baseTime = plot.lastHarvestedAt && def.regrows
    ? new Date(plot.lastHarvestedAt).getTime()
    : startTime
  if (plot.stalledAt) {
    // Return the stalled fraction (frozen)
    const stalledAge = new Date(plot.stalledAt).getTime() - baseTime
    return Math.min(1, stalledAge / def.growthMs)
  }
  const age = Date.now() - baseTime
  return Math.min(1, age / def.growthMs)
}

export function isAcornReady(plot: FarmPlot): boolean {
  if (plot.cropType !== 'oak') return false
  if (getTreeStage(plot) !== 'full') return false
  const base = plot.lastHarvestedAt
    ? new Date(plot.lastHarvestedAt).getTime()
    : new Date(plot.plantedAt).getTime() + TREE_STAGES[2].minMs
  return Date.now() - base >= OAK_ACORN_INTERVAL_MS
}

// ── Placement validation ──────────────────────────────────────────────────────

export function canPlaceCrop(
  plots: FarmPlot[], cropType: string, x: number, y: number,
  gridCols: number, gridRows: number
): { ok: boolean; reason?: string } {
  const def = CROP_DEFS[cropType]
  if (!def) return { ok: false, reason: 'Unknown crop' }
  if (x < 0 || x >= gridCols || y < 0 || y >= gridRows)
    return { ok: false, reason: 'Out of bounds' }
  if (plots.some(p => p.x === x && p.y === y))
    return { ok: false, reason: 'Cell occupied' }
  // Tree spacing rule
  if (def.spacing > 1) {
    const tooClose = plots
      .filter(p => CROP_DEFS[p.cropType]?.isTee)
      .some(p => Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) < def.spacing)
    if (tooClose) return { ok: false, reason: `Trees need ${def.spacing} cells apart` }
  }
  // Near-tree requirement (mushroom, truffle)
  if (def.requiresNearTree) {
    const dist = def.treeProximity ?? 2
    const hasNearbyFullOak = plots.some(p =>
      p.cropType === 'oak' &&
      getTreeStage(p) === 'full' &&
      Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) <= dist
    )
    if (!hasNearbyFullOak)
      return { ok: false, reason: `Needs a full oak within ${dist} cells` }
  }
  return { ok: true }
}

// ── Starter farm state ────────────────────────────────────────────────────────

const LONG_AGO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

export const STARTER_OAK_POSITIONS = [
  { x: 2,  y: 2 },
  { x: 7,  y: 2 },
  { x: 13, y: 2 },
  { x: 3,  y: 7 },
  { x: 11, y: 7 },
]

export function makeStarterPlots(): FarmPlot[] {
  return STARTER_OAK_POSITIONS.map((pos, i) => ({
    id: `starter-oak-${i}`,
    cropType: 'oak',
    x: pos.x,
    y: pos.y,
    plantedAt: LONG_AGO,
    wateredAt: LONG_AGO,
    secondWateredAt: null,
    waterCount: 1,
    stalledAt: null,
    lastHarvestedAt: null,
    harvestCount: 0,
  }))
}

export interface FarmState {
  resources: FarmResources
  plots: FarmPlot[]
  seeds: Record<string, number>
  tutorialDone: boolean
  tutorialStep: number
}

export function makeStarterFarm(): FarmState {
  return {
    resources: { ...EMPTY_RESOURCES, acorns: 0, gems: 0 },
    plots: makeStarterPlots(),
    seeds: { sunflower: 1, blueberry: 1, wheat: 1 },
    tutorialDone: false,
    tutorialStep: 0,
  }
}
