// ── Crop & Tree definitions ───────────────────────────────────────────────────

export interface CropDef {
  id: string
  label: string
  emoji: string
  isTee: boolean          // is it a tree (not a regular crop)
  growthMs: number        // ms from watered → ready  (trees: ms per stage)
  wiltWindowMs: number | null   // ms after ready before wilting; null = never
  drops: Array<{ resource: keyof FarmResources; amount: number }>
  regrows: boolean        // does it regrow after harvest?
  maxRegrows?: number     // how many times before replanting needed
  requiresNearTree: boolean   // must be within treeProximity cells of a tree
  treeProximity?: number
  spacing: number         // min Chebyshev distance from other trees (1 for crops)
}

export interface FarmResources {
  acorns: number
  wood: number
  gems: number
  blueberries: number
  sunflowerSeeds: number
  petals: number
  wheat: number
}

export const EMPTY_RESOURCES: FarmResources = {
  acorns: 0, wood: 0, gems: 0,
  blueberries: 0, sunflowerSeeds: 0, petals: 0, wheat: 0,
}

// Growth times in milliseconds
const H = (n: number) => n * 60 * 60 * 1000   // hours → ms

export const CROP_DEFS: Record<string, CropDef> = {
  oak: {
    id: 'oak', label: 'Oak Tree', emoji: '🌳', isTee: true,
    growthMs: H(4),          // 4h per stage (sapling→young, young→full)
    wiltWindowMs: null,
    drops: [{ resource: 'acorns', amount: 1 }],
    regrows: true,
    requiresNearTree: false, spacing: 3,
  },
  blueberry: {
    id: 'blueberry', label: 'Blueberry Bush', emoji: '🫐', isTee: false,
    growthMs: H(4), wiltWindowMs: null,
    drops: [{ resource: 'blueberries', amount: 3 }],
    regrows: true,
    requiresNearTree: false, spacing: 1,
  },
  sunflower: {
    id: 'sunflower', label: 'Sunflower', emoji: '🌻', isTee: false,
    growthMs: H(2), wiltWindowMs: H(24),
    drops: [{ resource: 'sunflowerSeeds', amount: 2 }, { resource: 'petals', amount: 1 }],
    regrows: false,
    requiresNearTree: false, spacing: 1,
  },
  wheat: {
    id: 'wheat', label: 'Wheat', emoji: '🌾', isTee: false,
    growthMs: H(3), wiltWindowMs: H(12),
    drops: [{ resource: 'wheat', amount: 2 }],
    regrows: false,
    requiresNearTree: false, spacing: 1,
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
  wateredAt: string | null // ISO timestamp; null = not yet watered
  lastHarvestedAt: string | null
  harvestCount: number
}

// ── Stage calculation ─────────────────────────────────────────────────────────

export type CropStage = 'unwatered' | 'growing' | 'ready' | 'wilted'
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
  if (!plot.wateredAt) return 'unwatered'
  // After regrow harvests, use lastHarvestedAt as the new "watered" baseline
  const baseTime = plot.lastHarvestedAt && def.regrows
    ? new Date(plot.lastHarvestedAt).getTime()
    : new Date(plot.wateredAt).getTime()
  const age = Date.now() - baseTime
  if (age < def.growthMs) return 'growing'
  if (def.wiltWindowMs !== null && age > def.growthMs + def.wiltWindowMs) return 'wilted'
  return 'ready'
}

export function getGrowthPct(plot: FarmPlot): number {
  const def = CROP_DEFS[plot.cropType]
  if (!def || def.isTee || !plot.wateredAt) return 0
  const baseTime = plot.lastHarvestedAt && def.regrows
    ? new Date(plot.lastHarvestedAt).getTime()
    : new Date(plot.wateredAt).getTime()
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
