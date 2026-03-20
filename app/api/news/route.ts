import { NextResponse } from 'next/server'

const NYT_KEY = process.env.NYT_API_KEY

interface Article {
  title: string
  abstract: string
  url: string
  byline: string
  published: string
  image: string | null
}

async function fetchNYT(section: string): Promise<Article[]> {
  if (!NYT_KEY) return []
  try {
    const res = await fetch(
      `https://api.nytimes.com/svc/topstories/v2/${section}.json?api-key=${NYT_KEY}`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.results || []).slice(0, 6).map((a: any) => ({
      title: a.title,
      abstract: a.abstract,
      url: a.url,
      byline: a.byline,
      published: a.published_date,
      image: a.multimedia?.[0]?.url ?? null,
    }))
  } catch {
    return []
  }
}

async function fetchTorontoRSS(): Promise<Article[]> {
  try {
    const res = await fetch('https://www.cbc.ca/cmlink/rss-canada-toronto', {
      next: { revalidate: 1800 },
    })
    if (!res.ok) return []
    const text = await res.text()

    const itemMatches = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)]

    const extract = (block: string, tag: string): string => {
      // Try CDATA first
      const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
      if (cdata) return cdata[1].trim()
      const plain = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))
      return plain ? plain[1].trim() : ''
    }

    return itemMatches.slice(0, 6).map(match => {
      const block = match[1]
      const abstract = extract(block, 'description')
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, 280)
      return {
        title: extract(block, 'title'),
        abstract,
        url: extract(block, 'link'),
        byline: '',
        published: extract(block, 'pubDate'),
        image: null,
      }
    })
  } catch {
    return []
  }
}

export async function GET() {
  const [newYork, travel, food, toronto] = await Promise.all([
    fetchNYT('nyregion'),
    fetchNYT('travel'),
    fetchNYT('food'),
    fetchTorontoRSS(),
  ])
  return NextResponse.json({ newYork, travel, food, toronto })
}
