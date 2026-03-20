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
  const urls = [
    'https://www.cbc.ca/cmlink/rss-canada-toronto',
    'https://rss.cbc.ca/lineup/canada-toronto.xml',
  ]

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        next: { revalidate: 1800 },
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SoulmateApp/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
      })
      if (!res.ok) continue
      const text = await res.text()
      if (!text.includes('<item')) continue

      const itemMatches = [...text.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g)]
      if (itemMatches.length === 0) continue

      const extract = (block: string, tag: string): string => {
        // CDATA
        const cdata = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))
        if (cdata) return cdata[1].trim()
        // Plain text
        const plain = block.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`))
        return plain ? plain[1].trim() : ''
      }

      const extractUrl = (block: string): string => {
        // Try <link> then <guid>
        const link = extract(block, 'link')
        if (link.startsWith('http')) return link
        const guid = extract(block, 'guid')
        if (guid.startsWith('http')) return guid
        return ''
      }

      return itemMatches.slice(0, 6).map(match => {
        const block = match[1]
        const abstract = extract(block, 'description')
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .trim()
          .slice(0, 400)
        return {
          title: extract(block, 'title').replace(/&amp;/g, '&').replace(/&#39;/g, "'"),
          abstract,
          url: extractUrl(block),
          byline: '',
          published: extract(block, 'pubDate'),
          image: null,
        }
      })
    } catch {
      continue
    }
  }

  return []
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
