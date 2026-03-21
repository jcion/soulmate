export interface ShopItem {
  id: string
  label: string
  emoji: string
  cost: number
  w: number
  h: number
  beauty: number
  noShop?: boolean  // starter items — always present, not purchasable
  woodCost?: number  // if set, item is craftable with wood (not bought with coins)
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: 'couch',        label: 'Couch',        emoji: '🛋️', cost: 10, w: 1, h: 2, beauty: 3 },
  { id: 'lamp',         label: 'Lamp',         emoji: '🪔', cost:  5, w: 1, h: 1, beauty: 2 },
  { id: 'rug',          label: 'Rug',          emoji: '🟫', cost:  8, w: 3, h: 2, beauty: 4 },
  { id: 'coffee_table', label: 'Coffee Table', emoji: '🪵', cost:  8, w: 2, h: 1, beauty: 2 },
  { id: 'bookshelves',  label: 'Bookshelves',  emoji: '📚', cost: 12, w: 3, h: 1, beauty: 3 },
  { id: 'plant',        label: 'Plant',        emoji: '🪴', cost:  6, w: 1, h: 1, beauty: 3 },
  { id: 'tv',           label: 'TV',           emoji: '📺', cost: 15, w: 2, h: 1, beauty: 2 },
  { id: 'fireplace',    label: 'Fireplace',    emoji: '🔥', cost: 20, w: 2, h: 1, beauty: 5 },
  { id: 'piano',        label: 'Piano',        emoji: '🎹', cost: 25, w: 2, h: 1, beauty: 5 },
  { id: 'cat',          label: 'Cat',          emoji: '🐱', cost: 18, w: 1, h: 1, beauty: 4 },
  { id: 'arcade',     label: 'Arcade Machine', emoji: '🕹️', cost: 60, w: 1, h: 2, beauty: 6 },
  { id: 'newspaper',  label: 'Newspaper',      emoji: '📰', cost: 0,  w: 1, h: 1, beauty: 1, noShop: true },
  { id: 'wood_shelf',   label: 'Wooden Shelf',  emoji: '🪵', cost: 0, w: 3, h: 1, beauty: 3, noShop: true, woodCost: 4  },
  { id: 'cabin_table',  label: 'Cabin Table',   emoji: '🪑', cost: 0, w: 2, h: 1, beauty: 3, noShop: true, woodCost: 6  },
  { id: 'garden_bench', label: 'Garden Bench',  emoji: '🛖', cost: 0, w: 2, h: 1, beauty: 4, noShop: true, woodCost: 8  },
]

export const STARTER_LAYOUT: Array<{ itemId: string; x: number; y: number }> = [
  { itemId: 'bookshelves',  x: 0, y: 0 }, // 3×1
  { itemId: 'lamp',         x: 7, y: 0 }, // 1×1
  { itemId: 'couch',        x: 3, y: 0 }, // 1×2
  { itemId: 'coffee_table', x: 3, y: 2 }, // 2×1
  { itemId: 'rug',          x: 1, y: 3 }, // 3×2
  { itemId: 'newspaper',    x: 6, y: 0 }, // 1×1
]

export function getItemDef(itemId: string): ShopItem | undefined {
  return SHOP_ITEMS.find(s => s.id === itemId)
}

export interface HappinessLevel {
  label: string
  emoji: string
  color: string
  nextAt: number   // beauty needed for next level; -1 = max
  prevAt: number   // beauty at start of this level
}

export function getHappiness(beauty: number): HappinessLevel {
  if (beauty >= 25) return { label: 'Thriving',    emoji: '✨', color: '#f0c040', nextAt: -1, prevAt: 25 }
  if (beauty >= 20) return { label: 'Cozy',        emoji: '🥰', color: '#e06080', nextAt: 25, prevAt: 20 }
  if (beauty >= 15) return { label: 'Happy',       emoji: '😄', color: '#9060e0', nextAt: 20, prevAt: 15 }
  if (beauty >= 10) return { label: 'Content',     emoji: '😊', color: '#5a9a5a', nextAt: 15, prevAt: 10 }
  return                   { label: 'Settling In', emoji: '🏠', color: '#a09080', nextAt: 10, prevAt: 0  }
}
