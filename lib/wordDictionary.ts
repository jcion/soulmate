let cachedDict: Set<string> | null = null

export async function getDictionary(): Promise<Set<string>> {
  if (cachedDict) return cachedDict
  const res = await fetch('/words.txt')
  if (!res.ok) throw new Error('Failed to load dictionary')
  const text = await res.text()
  cachedDict = new Set(text.split('\n').map(w => w.trim().toLowerCase()).filter(Boolean))
  return cachedDict
}

export function isValidWord(word: string, dict: Set<string>): boolean {
  return dict.has(word.toLowerCase())
}
