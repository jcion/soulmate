import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req: Request) {
  const { category, genres, freeText, locationName } = await req.json()

  const genreText = genres?.length > 0 ? `Genres they enjoy: ${genres.join(', ')}.` : ''
  const freeTextLine = freeText?.trim() ? `They mentioned: "${freeText}".` : ''

  const prompt = `You're a recommendation engine helping a couple at ${locationName} discover ${category} they'll both enjoy together.

${genreText} ${freeTextLine}

Give exactly 3 ${category} recommendations. Each should be something genuinely great to experience together. Return ONLY a valid JSON array with no markdown or extra text:

[{"title": "...", "emoji": "...", "reason": "..."}]

Pick an emoji that matches the mood of the content. Write the reason in 1–2 warm sentences explaining why it's perfect for them.`

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : '[]'
    const match = raw.match(/\[[\s\S]*\]/)
    const items = match ? JSON.parse(match[0]) : []
    return NextResponse.json({ items })
  } catch (e) {
    console.error('recommendations error:', e)
    return NextResponse.json({ items: [], error: String(e) }, { status: 500 })
  }
}
