import { NextResponse } from 'next/server'

export async function GET() {
  const res = await fetch(
    'https://api.open-meteo.com/v1/forecast?latitude=43.6532&longitude=-79.3832&current=temperature_2m,weathercode,precipitation,windspeed_10m',
    { next: { revalidate: 1800 } }
  )
  if (!res.ok) return NextResponse.json(null, { status: 500 })
  const data = await res.json()
  const c = data.current
  return NextResponse.json({
    temp: Math.round(c.temperature_2m),
    code: c.weathercode,
    precipitation: c.precipitation,
    windspeed: c.windspeed_10m,
  })
}
