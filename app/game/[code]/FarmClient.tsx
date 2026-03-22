'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CROP_DEFS, FarmState, FarmPlot, FarmResources,
  makeStarterFarm, canPlaceCrop, getTreeStage, getCropStage,
  getGrowthPct, isAcornReady, OAK_WOOD_BY_STAGE, MARKET_PRICES,
} from '@/lib/farmData'
import SudowoodoTutorial, { SudowoodoHint, SUDOWOODO_HINTS, TUTORIAL_SCREENS } from './Sudowoodo'
import FarmGhosts from './FarmGhosts'

const GRID_COLS = 16
const GRID_ROWS = 12
// makeUUID — same pattern as GameClient
function makeUUID(): string {
  try { return crypto.randomUUID() }
  catch {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
  }
}

interface Props {
  code: string
  myToken: string
  darkMode: boolean
}

type Tool = 'none' | 'water' | 'plant' | 'axe' | 'acorn' | 'info'

export default function FarmClient({ code, myToken, darkMode }: Props) {
  const [farm, setFarm] = useState<FarmState | null>(null)
  const [loading, setLoading] = useState(true)
  const [tool, setTool] = useState<Tool>('none')
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [weather, setWeather] = useState<{ temp: number; code: number } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [infoPlot, setInfoPlot] = useState<string | null>(null)  // cropType being inspected
  const [tutorialVisible, setTutorialVisible] = useState(false)
  const [showMarket, setShowMarket] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const tutorialBaseline = useRef({ acorns: 0, plotCount: 0, wateredCount: 0, capturedStep: -1 })
  const [cellSize, setCellSize] = useState(28)

  // ── Data loading ────────────────────────────────────────────────────────────

  // Normalize a raw DB row's plots array to fill in fields added after initial deploy
  function rowToFarmState(row: Record<string, unknown>): FarmState {
    const rawPlots = (row.plots as FarmPlot[]) ?? []
    const plots = rawPlots.map(p => ({
      ...p,
      secondWateredAt: p.secondWateredAt ?? null,
      waterCount: p.waterCount ?? (p.wateredAt ? 1 : 0),
      stalledAt: p.stalledAt ?? null,
    } as FarmPlot))
    return {
      resources: row.resources as FarmResources,
      plots,
      seeds: row.seeds as Record<string, number>,
      tutorialDone: row.tutorial_done as boolean,
      tutorialStep: row.tutorial_step as number,
    }
  }

  useEffect(() => {
    if (!myToken) return

    const loadFarm = async () => {
      // Farm is shared per room — look up by room_code, not player_token
      const { data, error } = await supabase
        .from('farms')
        .select('*')
        .eq('room_code', code)
        .single()

      if (error || !data) {
        // No shared farm yet — create one (select→insert→retry to avoid races)
        const starter = makeStarterFarm()
        const { data: inserted, error: insertErr } = await supabase
          .from('farms')
          .insert({
            player_token: myToken,   // record who created it; not used for lookup
            room_code: code,
            resources: starter.resources,
            plots: starter.plots,
            seeds: starter.seeds,
            tutorial_done: starter.tutorialDone,
            tutorial_step: starter.tutorialStep,
          })
          .select()
          .single()

        if (insertErr || !inserted) {
          // Another device beat us to the insert — retry the select
          const { data: retry } = await supabase
            .from('farms').select('*').eq('room_code', code).single()
          const farmState = retry ? rowToFarmState(retry as Record<string, unknown>) : starter
          setFarm(farmState)
          setTutorialVisible(!farmState.tutorialDone)
        } else {
          const farmState = rowToFarmState(inserted as Record<string, unknown>)
          setFarm(farmState)
          setTutorialVisible(!farmState.tutorialDone)
        }
      } else {
        const farmState = rowToFarmState(data as Record<string, unknown>)
        setFarm(farmState)
        setTutorialVisible(!farmState.tutorialDone)
      }

      setLoading(false)
    }

    loadFarm()
  }, [myToken, code])

  // ── farmUpdate helper ───────────────────────────────────────────────────────

  const farmUpdate = useCallback((patch: Partial<FarmState>) => {
    setFarm(prev => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      supabase.from('farms').update({
        resources: next.resources,
        plots: next.plots,
        seeds: next.seeds,
        tutorial_done: next.tutorialDone,
        tutorial_step: next.tutorialStep,
      }).eq('room_code', code).then(() => {})
      return next
    })
  }, [code])

  // ── Real-time farm sync (shared across devices) ─────────────────────────────

  useEffect(() => {
    if (!farm) return
    const channel = supabase.channel(`farm-${code}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'farms' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          if (row.room_code !== code) return
          setFarm(rowToFarmState(row))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, !!farm])

  // ── Weather fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/weather').then(r => r.json()).then(setWeather).catch(() => {})
  }, [])

  // ── Tick timer (re-render growth) ───────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  // ── Cell size (responsive) ──────────────────────────────────────────────────

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const w = containerRef.current.clientWidth - 4
        setCellSize(Math.max(26, Math.floor(w / GRID_COLS)))
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // ── showMessage helper ──────────────────────────────────────────────────────

  const showMessage = (msg: string) => {
    setMessage(msg)
    setTimeout(() => setMessage(null), 2200)
  }

  // ── Tutorial handlers ───────────────────────────────────────────────────────

  const handleTutorialNext = () => {
    if (!farm) return
    const nextStep = farm.tutorialStep + 1
    if (nextStep >= TUTORIAL_SCREENS.length) {
      // Give berry seeds
      const newSeeds = { ...farm.seeds, blueberry: (farm.seeds.blueberry || 0) + 2 }
      farmUpdate({ tutorialDone: true, tutorialStep: nextStep, seeds: newSeeds })
      setTutorialVisible(false)
      showMessage('🫐 You received 2 blueberry seeds!')
    } else {
      farmUpdate({ tutorialStep: nextStep })
    }
  }

  const handleTutorialSkip = () => {
    farmUpdate({ tutorialDone: true })
    setTutorialVisible(false)
  }

  // ── Market handlers ───────────────────────────────────────────────────────

  const handleSell = async (resource: keyof FarmResources, amount: number) => {
    const pricePerUnit = MARKET_PRICES[resource]
    if (!pricePerUnit || amount <= 0) return
    const earned = pricePerUnit * amount
    const { data: roomData } = await supabase.from('rooms').select('coins').eq('code', code).single()
    const newCoins = (roomData?.coins ?? 0) + earned
    await supabase.from('rooms').update({ coins: newCoins }).eq('code', code)
    farmUpdate({ resources: { ...farm!.resources, [resource]: 0 } })
    showMessage(`🪙 Sold ${amount} ${resource} for ${earned} coins!`)
  }

  const handleSellAll = async () => {
    if (!farm) return
    let totalEarned = 0
    const newResources = { ...farm.resources }
    for (const [resource, price] of Object.entries(MARKET_PRICES) as [keyof FarmResources, number][]) {
      const amount = farm.resources[resource]
      if (amount > 0 && price) {
        totalEarned += price * amount
        newResources[resource] = 0
      }
    }
    if (totalEarned === 0) { showMessage('Nothing to sell!'); return }
    const { data: roomData } = await supabase.from('rooms').select('coins').eq('code', code).single()
    const newCoins = (roomData?.coins ?? 0) + totalEarned
    await supabase.from('rooms').update({ coins: newCoins }).eq('code', code)
    farmUpdate({ resources: newResources })
    showMessage(`🪙 Sold everything for ${totalEarned} coins!`)
  }

  // ── Sudowoodo post-tutorial hints ───────────────────────────────────────────

  useEffect(() => {
    if (!farm?.tutorialDone) return
    const lastHint = localStorage.getItem(`sudowoodo_hint_${code}`)
    const now = Date.now()
    const lastTime = lastHint ? parseInt(lastHint) : 0
    if (now - lastTime > 2 * 24 * 3600 * 1000) {
      const h = SUDOWOODO_HINTS[Math.floor(Math.random() * SUDOWOODO_HINTS.length)]
      setHint(h)
      localStorage.setItem(`sudowoodo_hint_${code}`, String(now))
    }
  }, [farm?.tutorialDone, code])

  // ── Tutorial auto-advance on action detection ─────────────────────────────

  useEffect(() => {
    if (!farm || farm.tutorialDone) return

    if (farm.tutorialStep !== tutorialBaseline.current.capturedStep) {
      tutorialBaseline.current = {
        acorns: farm.resources.acorns,
        plotCount: farm.plots.length,
        wateredCount: farm.plots.filter(p => !!p.wateredAt).length,
        capturedStep: farm.tutorialStep,
      }
      return
    }

    const b = tutorialBaseline.current
    if (farm.tutorialStep === 1 && farm.resources.acorns > b.acorns) handleTutorialNext()
    if (farm.tutorialStep === 2 && farm.plots.length > b.plotCount) handleTutorialNext()
    if (farm.tutorialStep === 3 && farm.plots.filter(p => !!p.wateredAt).length > b.wateredCount) handleTutorialNext()
  }, [farm]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cell tap handler ────────────────────────────────────────────────────────

  const handleCellTap = (x: number, y: number) => {
    if (!farm) return
    const existing = farm.plots.find(p => p.x === x && p.y === y)

    // INFO TOOL
    if (tool === 'info') {
      if (!existing) { showMessage('Nothing planted here'); return }
      setInfoPlot(existing.cropType)
      return
    }

    // WATER TOOL
    if (tool === 'water') {
      if (!existing || existing.cropType === 'oak') {
        showMessage('Nothing to water here'); return
      }
      if (existing.wateredAt && getCropStage(existing) !== 'unwatered') {
        showMessage('Already watered!'); return
      }
      const newPlots = farm.plots.map(p =>
        p.id === existing.id ? { ...p, wateredAt: new Date().toISOString() } : p
      )
      farmUpdate({ plots: newPlots })
      showMessage('💧 Watered!')
      return
    }

    // AXE TOOL (only on oak trees)
    if (tool === 'axe') {
      if (!existing || existing.cropType !== 'oak') {
        showMessage('No tree to chop here'); return
      }
      const stage = getTreeStage(existing)
      const wood = OAK_WOOD_BY_STAGE[stage]
      const newPlots = farm.plots.filter(p => p.id !== existing.id)
      const newResources = { ...farm.resources, wood: farm.resources.wood + wood }
      farmUpdate({ plots: newPlots, resources: newResources })
      showMessage(wood > 0 ? `🪵 Chopped! Got ${wood} wood.` : '🌱 Removed sapling.')
      return
    }

    // PLANT TOOL (selected seed)
    if (tool === 'plant' && selectedSeed) {
      const seedCount = farm.seeds[selectedSeed] || 0
      if (seedCount <= 0) { showMessage('No seeds left!'); return }
      const check = canPlaceCrop(farm.plots, selectedSeed, x, y, GRID_COLS, GRID_ROWS)
      if (!check.ok) { showMessage(`❌ ${check.reason}`); return }
      const newPlot: FarmPlot = {
        id: makeUUID(), cropType: selectedSeed, x, y,
        plantedAt: new Date().toISOString(),
        wateredAt: null, secondWateredAt: null, waterCount: 0, stalledAt: null,
        lastHarvestedAt: null, harvestCount: 0,
      }
      const newSeeds = { ...farm.seeds, [selectedSeed]: seedCount - 1 }
      farmUpdate({ plots: [...farm.plots, newPlot], seeds: newSeeds })
      showMessage(`🌱 ${CROP_DEFS[selectedSeed]?.label ?? selectedSeed} planted!`)
      return
    }

    // ACORN TOOL (plant oak tree)
    if (tool === 'acorn') {
      if (farm.resources.acorns <= 0) { showMessage('No acorns!'); return }
      const check = canPlaceCrop(farm.plots, 'oak', x, y, GRID_COLS, GRID_ROWS)
      if (!check.ok) { showMessage(`❌ ${check.reason}`); return }
      const newPlot: FarmPlot = {
        id: makeUUID(), cropType: 'oak', x, y,
        plantedAt: new Date().toISOString(),
        wateredAt: new Date().toISOString(), secondWateredAt: null, waterCount: 1, stalledAt: null,
        lastHarvestedAt: null, harvestCount: 0,
      }
      const newResources = { ...farm.resources, acorns: farm.resources.acorns - 1 }
      farmUpdate({ plots: [...farm.plots, newPlot], resources: newResources })
      showMessage('🌱 Oak sapling planted!')
      return
    }

    // NO TOOL — tap to harvest/collect
    if (!existing) return

    if (existing.cropType === 'oak') {
      if (!isAcornReady(existing)) {
        const stage = getTreeStage(existing)
        if (stage !== 'full') showMessage(`🌳 Oak is ${stage} — needs more time.`)
        else showMessage('🌰 Acorn not ready yet — check back in a few hours!')
        return
      }
      const newResources = { ...farm.resources, acorns: farm.resources.acorns + 1 }
      const newPlots = farm.plots.map(p =>
        p.id === existing.id ? { ...p, lastHarvestedAt: new Date().toISOString() } : p
      )
      farmUpdate({ plots: newPlots, resources: newResources })
      showMessage('🌰 Acorn collected!')
      return
    }

    // Crop harvest
    const stage = getCropStage(existing)
    if (stage === 'unwatered') { showMessage('💧 Water this first!'); return }
    if (stage === 'growing') {
      const pct = Math.round(getGrowthPct(existing) * 100)
      showMessage(`⏳ ${pct}% grown — not ready yet.`)
      return
    }
    if (stage === 'wilted') {
      const newPlots = farm.plots.filter(p => p.id !== existing.id)
      farmUpdate({ plots: newPlots })
      showMessage('💀 Wilted — removed.')
      return
    }

    // Ready!
    const def = CROP_DEFS[existing.cropType]
    const newResources = { ...farm.resources }
    def.drops.forEach(d => { newResources[d.resource] = (newResources[d.resource] || 0) + d.amount })
    const dropText = def.drops.map(d => `+${d.amount} ${d.resource}`).join(', ')

    if (def.regrows && (existing.harvestCount < (def.maxRegrows ?? Infinity) - 1 || !def.maxRegrows)) {
      const newPlots = farm.plots.map(p =>
        p.id === existing.id
          ? { ...p, lastHarvestedAt: new Date().toISOString(), harvestCount: p.harvestCount + 1 }
          : p
      )
      farmUpdate({ plots: newPlots, resources: newResources })
    } else {
      // Remove (doesn't regrow or maxed out)
      const newPlots = farm.plots.filter(p => p.id !== existing.id)
      farmUpdate({ plots: newPlots, resources: newResources })
    }
    showMessage(`✨ Harvested! ${dropText}`)
  }

  // ── Weather helper ──────────────────────────────────────────────────────────

  function weatherEmoji(code: number): string {
    if (code === 0) return '☀️'
    if (code <= 3)  return '⛅'
    if (code <= 48) return '🌫️'
    if (code <= 67) return '🌧️'
    if (code <= 77) return '❄️'
    if (code <= 82) return '🌦️'
    return '⛈️'
  }

  // ── getCellContent — what to render in each cell ────────────────────────────

  const getCellContent = (x: number, y: number) => {
    const plot = farm?.plots.find(p => p.x === x && p.y === y)
    if (!plot) return null

    if (plot.cropType === 'oak') {
      const stage = getTreeStage(plot)
      const acornReady = isAcornReady(plot)
      return {
        emoji: stage === 'full' ? '🌳' : stage === 'young' ? '🌿' : '🌱',
        fontSize: stage === 'full' ? cellSize * 0.7 : stage === 'young' ? cellSize * 0.55 : cellSize * 0.4,
        badge: acornReady ? '🌰' : null,
        pct: null,
        filter: null,
      }
    }

    const stage = getCropStage(plot)
    const pct = getGrowthPct(plot)
    const def = CROP_DEFS[plot.cropType]
    const emojiSize = stage === 'ready' ? cellSize * 0.65
      : stage === 'growing' ? cellSize * 0.5
      : stage === 'unwatered' ? cellSize * 0.35
      : cellSize * 0.6

    return {
      emoji: stage === 'unwatered' ? '🌱' : def?.emoji ?? '🌿',
      fontSize: emojiSize,
      badge: null,
      pct: stage === 'growing' ? pct : null,
      filter: stage === 'wilted' ? 'grayscale(100%) opacity(0.5)' : null,
    }
  }

  // ── Cell background colors ──────────────────────────────────────────────────

  const getCellBg = (x: number, y: number, hasPlot: boolean, isValidTarget: boolean) => {
    const isSky = y <= 1
    if (isSky && !hasPlot) {
      return { bg: darkMode ? '#1a2a3a' : '#d0e8f8', border: 'transparent' }
    }
    if (hasPlot) {
      return { bg: darkMode ? '#3a2a14' : '#c8a870', border: darkMode ? '#5a4020' : '#a0804a' }
    }
    if (tool !== 'none' && isValidTarget) {
      return { bg: darkMode ? '#1a3a1a' : '#c8e8c8', border: darkMode ? '#2a6a2a' : '#80b880' }
    }
    if (tool !== 'none' && !isValidTarget) {
      return { bg: darkMode ? '#2a1a1a' : '#f0d0d0', border: 'transparent' }
    }
    // Normal grass
    const shade = (x + y) % 2 === 0
    return {
      bg: darkMode ? (shade ? '#1a2e1a' : '#1e321e') : (shade ? '#7ab870' : '#82c478'),
      border: 'transparent',
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  // Suppress unused tick warning — it's used to trigger re-renders
  void tick

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

      {/* Loading */}
      {loading && (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ opacity: 0.5, fontSize: 13 }}>Loading your farm...</p>
        </div>
      )}

      {!loading && farm && (
        <>
          {/* Toast message */}
          {message && (
            <div style={{
              position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
              background: darkMode ? '#1a3a1a' : '#e8f5e8',
              border: '1px solid #4db84d', borderRadius: 20,
              padding: '8px 18px', fontSize: 13, fontWeight: 600,
              color: darkMode ? '#e8f5e8' : '#1a3a1a',
              zIndex: 100, pointerEvents: 'none',
              boxShadow: '0 4px 20px rgba(0,80,0,0.3)',
            }}>{message}</div>
          )}

          {/* Resource bar */}
          <div style={{
            display: 'flex', gap: 12, padding: '8px 16px', overflowX: 'auto',
            background: darkMode ? '#0d1a0d' : '#e8f5e8',
            borderBottom: `1px solid ${darkMode ? '#1a3a1a' : '#c8e8c8'}`,
            flexShrink: 0, alignItems: 'center',
          }}>
            {[
              { icon: '🌰', val: farm.resources.acorns, label: 'Acorns' },
              { icon: '🪵', val: farm.resources.wood, label: 'Wood' },
              { icon: '💎', val: farm.resources.gems, label: 'Gems' },
              { icon: '🫐', val: farm.resources.blueberries, label: 'Blueberries' },
              { icon: '🌻', val: farm.resources.sunflowerSeeds, label: 'Seeds' },
              { icon: '🌾', val: farm.resources.wheat, label: 'Wheat' },
            ].map(r => (
              <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>{r.icon}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>{r.val}</span>
              </div>
            ))}
            {weather && (
              <span style={{ fontSize: 11, opacity: 0.7, flexShrink: 0, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>
                {weatherEmoji(weather.code)} {weather.temp}°C · Toronto
              </span>
            )}
            <button
              onClick={() => setShowMarket(true)}
              style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 700, flexShrink: 0,
                padding: '4px 10px', borderRadius: 8,
                background: darkMode ? '#1a3a1a' : '#d0eed0',
                border: `1px solid ${darkMode ? '#2a5a2a' : '#90c890'}`,
                color: darkMode ? '#c8e8c8' : '#1a3a1a',
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}>
              🏪 Market
            </button>
          </div>

          {/* Tool bar */}
          <div style={{
            display: 'flex', gap: 8, padding: '8px 16px',
            background: darkMode ? '#0d1a0d' : '#f0f8f0',
            borderBottom: `1px solid ${darkMode ? '#1a3a1a' : '#c8e8c8'}`,
            overflowX: 'auto', flexShrink: 0,
          }}>
            {/* Tool buttons: none (deselect), water, axe, acorn, info */}
            {[
              { t: 'none' as Tool, icon: '👆', label: 'Harvest' },
              { t: 'water' as Tool, icon: '🪣', label: 'Water' },
              { t: 'axe' as Tool, icon: '🪓', label: 'Chop' },
              { t: 'acorn' as Tool, icon: '🌰', label: `Plant oak (${farm.resources.acorns})` },
              { t: 'info' as Tool, icon: 'ℹ️', label: 'Info' },
            ].map(({ t, icon, label }) => (
              <button key={t}
                onTouchStart={(e) => { e.preventDefault(); setTool(t); setSelectedSeed(null) }}
                onClick={() => { setTool(t); setSelectedSeed(null) }}
                style={{
                  padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                  background: tool === t && selectedSeed === null ? '#4db84d' : (darkMode ? '#1a3a1a' : '#e0f0e0'),
                  color: tool === t && selectedSeed === null ? 'white' : (darkMode ? '#c8e8c8' : '#1a3a1a'),
                  border: `1px solid ${tool === t && selectedSeed === null ? '#4db84d' : (darkMode ? '#2a5a2a' : '#a8d8a8')}`,
                  cursor: 'pointer', flexShrink: 0,
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {icon} {label}
              </button>
            ))}

            {/* Seed buttons */}
            {Object.entries(farm.seeds).filter(([, count]) => count > 0).map(([seedType, count]) => {
              const def = CROP_DEFS[seedType]
              if (!def) return null
              const isSelected = tool === 'plant' && selectedSeed === seedType
              return (
                <button key={seedType}
                  onTouchStart={(e) => { e.preventDefault(); setTool('plant'); setSelectedSeed(seedType) }}
                  onClick={() => { setTool('plant'); setSelectedSeed(seedType) }}
                  style={{
                    padding: '6px 12px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                    background: isSelected ? '#4db84d' : (darkMode ? '#1a3a1a' : '#e0f0e0'),
                    color: isSelected ? 'white' : (darkMode ? '#c8e8c8' : '#1a3a1a'),
                    border: `1px solid ${isSelected ? '#4db84d' : (darkMode ? '#2a5a2a' : '#a8d8a8')}`,
                    cursor: 'pointer', flexShrink: 0,
                    WebkitTapHighlightColor: 'transparent',
                  }}>
                  {def.emoji} Plant {def.label} ({count})
                </button>
              )
            })}
          </div>

          {/* Farm grid — scrollable */}
          <div style={{ overflowY: 'auto', flex: 1, position: 'relative' }}>
            <div style={{ position: 'relative' }}>
            <FarmGhosts farm={farm} weather={weather} darkMode={darkMode} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${GRID_COLS}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${GRID_ROWS}, ${cellSize}px)`,
              gap: 1,
              padding: 2,
              width: 'fit-content',
              minWidth: '100%',
              touchAction: tool !== 'none' ? 'none' : 'auto',
              position: 'relative',
            }}>
              {Array.from({ length: GRID_ROWS * GRID_COLS }).map((_, idx) => {
                const x = idx % GRID_COLS
                const y = Math.floor(idx / GRID_COLS)
                const plot = farm.plots.find(p => p.x === x && p.y === y)
                const content = getCellContent(x, y)

                // Validity check for current tool
                let isValid = false
                if (tool === 'plant' && selectedSeed) {
                  isValid = canPlaceCrop(farm.plots, selectedSeed, x, y, GRID_COLS, GRID_ROWS).ok
                } else if (tool === 'acorn') {
                  isValid = canPlaceCrop(farm.plots, 'oak', x, y, GRID_COLS, GRID_ROWS).ok
                } else if (tool === 'water') {
                  isValid = !!plot && plot.cropType !== 'oak' && getCropStage(plot) === 'unwatered'
                } else if (tool === 'axe') {
                  isValid = !!plot && plot.cropType === 'oak'
                } else if (tool === 'none') {
                  isValid = !!plot
                }

                const { bg, border } = getCellBg(x, y, !!plot, isValid)

                return (
                  <div
                    key={idx}
                    onTouchStart={(e) => { if (tool !== 'none' || plot) { e.preventDefault(); handleCellTap(x, y) } }}
                    onClick={() => handleCellTap(x, y)}
                    style={{
                      width: cellSize, height: cellSize,
                      background: bg,
                      border: `1px solid ${border}`,
                      borderRadius: 2,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: isValid ? 'pointer' : (plot ? 'pointer' : 'default'),
                      position: 'relative',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      WebkitTapHighlightColor: 'transparent',
                      userSelect: 'none',
                    }}>
                    {content && (
                      <>
                        <span style={{
                          fontSize: content.fontSize,
                          filter: content.filter ?? undefined,
                          lineHeight: 1,
                        }}>
                          {content.emoji}
                        </span>
                        {/* Acorn ready badge */}
                        {content.badge && (
                          <span style={{
                            position: 'absolute', top: 1, right: 1,
                            fontSize: cellSize * 0.28, lineHeight: 1,
                          }}>{content.badge}</span>
                        )}
                        {/* Growth progress bar */}
                        {content.pct !== null && (
                          <div style={{
                            position: 'absolute', bottom: 1, left: 1, right: 1,
                            height: 3, background: 'rgba(0,0,0,0.2)', borderRadius: 2,
                          }}>
                            <div style={{
                              width: `${content.pct * 100}%`, height: '100%',
                              background: '#4db84d', borderRadius: 2,
                            }} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
            </div>

            {/* Sudowoodo — always visible post-tutorial */}
            {farm.tutorialDone && (
              <SudowoodoHint hint={hint} onDismiss={() => setHint(null)} darkMode={darkMode} />
            )}
          </div>
        </>
      )}

      {/* Crop info modal */}
      {infoPlot && (() => {
        const def = CROP_DEFS[infoPlot]
        if (!def) return null
        const fmtMs = (ms: number) => {
          const h = ms / 3_600_000
          return h < 1 ? `${Math.round(h * 60)}m` : `${h}h`
        }
        return (
          <div
            onClick={() => setInfoPlot(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 200,
              background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}>
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: darkMode ? '#0f1f0f' : '#f0f8f0',
                border: `1px solid ${darkMode ? '#2a5a2a' : '#a8d8a8'}`,
                borderRadius: 16, padding: 20, maxWidth: 300, width: '100%',
              }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 36 }}>{def.emoji}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>{def.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6, color: darkMode ? '#c8e8c8' : '#1a3a1a', textTransform: 'capitalize' }}>{def.type}</div>
                </div>
              </div>
              {/* Stats */}
              {[
                { label: 'Growth time', value: fmtMs(def.growthMs) },
                { label: 'Waterings needed', value: def.wateringsNeeded === 0 ? 'None' : `${def.wateringsNeeded}×` },
                { label: 'Wilts after ready', value: def.wiltWindowMs ? fmtMs(def.wiltWindowMs) : 'Never' },
                { label: 'Harvest', value: def.drops.map(d => `+${d.amount} ${d.resource}`).join(', ') },
                { label: 'Regrows', value: def.regrows ? (def.maxRegrows ? `Yes (×${def.maxRegrows})` : 'Yes') : 'No' },
                ...(def.requiresNearTree ? [{ label: 'Requires', value: `Oak tree within ${def.treeProximity ?? 2} cells` }] : []),
              ].map(({ label, value }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', borderBottom: `1px solid ${darkMode ? '#1a3a1a' : '#d0ecd0'}`,
                }}>
                  <span style={{ fontSize: 12, opacity: 0.65, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>{value}</span>
                </div>
              ))}
              <button
                onClick={() => setInfoPlot(null)}
                style={{
                  marginTop: 14, width: '100%', padding: '8px 0', borderRadius: 10,
                  background: darkMode ? '#1a3a1a' : '#c8e8c8',
                  color: darkMode ? '#c8e8c8' : '#1a3a1a',
                  border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                Close
              </button>
            </div>
          </div>
        )
      })()}

      {/* Market modal */}
      {showMarket && farm && (
        <div
          onClick={() => setShowMarket(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            padding: '0 16px 32px',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: darkMode ? '#0f1f0f' : '#f0f8f0',
              border: `1px solid ${darkMode ? '#2a5a2a' : '#a8d8a8'}`,
              borderRadius: 20, padding: 20, maxWidth: 400, width: '100%',
              maxHeight: '75vh', overflowY: 'auto',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>🏪 Farm Market</span>
              <button
                onClick={() => setShowMarket(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: darkMode ? '#c8e8c8' : '#1a3a1a', padding: '0 4px' }}>
                ✕
              </button>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.55, marginBottom: 8, letterSpacing: 1, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>SELL CROPS</div>
            {(Object.entries(MARKET_PRICES) as [keyof FarmResources, number][]).map(([resource, price]) => {
              const amount = farm.resources[resource]
              const earned = price * amount
              return (
                <div key={resource} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 0',
                  borderBottom: `1px solid ${darkMode ? '#1a3a1a' : '#d0ecd0'}`,
                  opacity: amount === 0 ? 0.35 : 1,
                }}>
                  <span style={{ fontSize: 13, color: darkMode ? '#c8e8c8' : '#1a3a1a' }}>
                    {resource} ×{amount}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#f0a830', fontWeight: 700 }}>
                      {earned > 0 ? `= ${earned} 🪙` : `${price}/ea`}
                    </span>
                    <button
                      disabled={amount === 0}
                      onClick={() => handleSell(resource, amount)}
                      style={{
                        padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                        background: amount > 0 ? '#f0a830' : (darkMode ? '#1a3a1a' : '#e0e0e0'),
                        color: amount > 0 ? '#1a1a00' : (darkMode ? '#4a4a4a' : '#aaaaaa'),
                        border: 'none', cursor: amount > 0 ? 'pointer' : 'default',
                      }}>
                      Sell
                    </button>
                  </div>
                </div>
              )
            })}
            <button
              onClick={handleSellAll}
              style={{
                width: '100%', marginTop: 10, padding: '9px 0', borderRadius: 10,
                background: '#f0a830', border: 'none', fontWeight: 700,
                fontSize: 13, color: '#1a1a00', cursor: 'pointer',
              }}>
              Sell Everything →
            </button>

          </div>
        </div>
      )}

      {/* Tutorial overlay */}
      {tutorialVisible && farm && (
        <SudowoodoTutorial
          screen={farm.tutorialStep}
          total={TUTORIAL_SCREENS.length}
          onNext={handleTutorialNext}
          onSkip={handleTutorialSkip}
          darkMode={darkMode}
        />
      )}
    </div>
  )
}
