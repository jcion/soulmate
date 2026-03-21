'use client'

import Ghost from './Ghost'
import { FarmState, getCropStage } from '@/lib/farmData'

interface Props {
  farm: FarmState
  weather: { temp: number; code: number } | null
  darkMode: boolean
}

type WeatherType = 'clear' | 'cloudy' | 'foggy' | 'rainy' | 'snowy' | 'showers' | 'stormy'

function wmoToType(code: number): WeatherType {
  if (code === 0) return 'clear'
  if (code <= 3)  return 'cloudy'
  if (code <= 48) return 'foggy'
  if (code <= 67) return 'rainy'
  if (code <= 77) return 'snowy'
  if (code <= 82) return 'showers'
  return 'stormy'
}

export default function FarmGhosts({ farm, weather, darkMode }: Props) {
  const plots = farm.plots
  const hasReady  = plots.some(p => getCropStage(p) === 'ready')
  const hasWilted = plots.some(p => getCropStage(p) === 'wilted')
  const hasStalled = plots.some(p => p.stalledAt !== null)
  const isEmpty   = plots.length === 0
  const weatherType = weather ? wmoToType(weather.code) : null

  // ── Jason's messages ────────────────────────────────────────────────────────
  const jasonMessages: string[] = []

  if (weatherType === 'clear')   jasonMessages.push('Perfect farming weather ☀️', 'What a gorgeous day to be outside!')
  if (weatherType === 'rainy')   jasonMessages.push('Good watering weather 🌧️', 'The plants must love this rain')
  if (weatherType === 'snowy')   jasonMessages.push('Brrr! Hope the farm survives ❄️', 'Snow day farm check 🧤')
  if (weatherType === 'stormy')  jasonMessages.push('Wild weather out there ⛈️', 'Hope our crops are okay!')
  if (isEmpty)    jasonMessages.push('Should we plant something? 🌱', 'The soil\'s just waiting for us')
  if (hasReady)   jasonMessages.push('Something\'s ready to harvest! 🌾', 'Harvest time, let\'s go 🎉', 'Look at that, it\'s ready! 🌻')
  if (hasWilted)  jasonMessages.push('Uh oh, something wilted 😬', 'We waited too long on that one...', 'Note to self: harvest faster 😅')
  if (hasStalled) jasonMessages.push('I think something needs water 💧', 'The plants are thirsty!')

  jasonMessages.push(
    'Our farm is looking good 🌿',
    'What should we plant next?',
    'Farming is surprisingly satisfying',
    'I love our little patch 🌾',
    'We make a good farming team',
    'Can\'t believe we grew all this',
  )

  // ── Rui's messages ──────────────────────────────────────────────────────────
  const ruiMessages: string[] = []

  if (weatherType === 'clear')   ruiMessages.push('The sun feels so good today ☀️', 'Perfect Toronto afternoon')
  if (weatherType === 'rainy')   ruiMessages.push('Rainy days have their own magic 🌧️', 'Cozy farm weather ☔')
  if (weatherType === 'snowy')   ruiMessages.push('Snow in Toronto 🇨🇦 classic ❄️', 'The farm looks so quiet in the snow')
  if (weatherType === 'stormy')  ruiMessages.push('I love a dramatic sky ⛈️', 'The farm is riding out the storm')
  if (isEmpty)    ruiMessages.push('The soil is ready for new life 🌱', 'Blank canvas, infinite potential')
  if (hasReady)   ruiMessages.push('Oh! Something\'s ready 🌸', 'All that patience paid off 🌺', 'It bloomed! ✨')
  if (hasWilted)  ruiMessages.push('Aww, we should check on our plants more 🥺', 'Rest in peace little plant 😢')
  if (hasStalled) ruiMessages.push('I think something\'s thirsty 💧', 'The roses need water 🌹')

  ruiMessages.push(
    'I love watching things grow 🌱',
    'Our little patch of nature 🌿',
    'This is so peaceful',
    'Being here with you 💕',
    'Every plant has its own vibe',
    'The farm smells amazing 🌸',
  )

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <Ghost name="Jason" color="#8844cc" startX={3} startY={8}
        darkMode={darkMode} placedItems={[]}
        gridCols={16} gridRows={12} customMessages={jasonMessages} />
      <Ghost name="Rui" color="#dd4477" startX={11} startY={8}
        darkMode={darkMode} placedItems={[]}
        gridCols={16} gridRows={12} customMessages={ruiMessages} />
    </div>
  )
}
