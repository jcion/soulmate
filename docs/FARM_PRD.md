# 🌾 Farm — Product Requirements Document

**Version:** 1.0
**Status:** Ready for implementation
**Last updated:** March 2026

---

## Overview

The Farm is a solo-owned, persistently-growing space where each player cultivates crops, tends trees, and collects resources that feed into the shared home base. While the Home Base is a *bond* feature (built together), the Farm is *personal* — your land, your choices, your pace.

It sits alongside the Game and Home tabs as a third tab in the game room: `🎮 Game | 🏡 Home | 🌾 Farm`.

---

## Core Philosophy

- **Personal ownership:** Each player has their own farm. Your partner can visit, but it's yours.
- **Real time:** Growth happens on the clock, not the session. A sunflower takes 2 hours whether you're in the app or not.
- **Low pressure, high reward:** Trees are hearty. Some plants are delicate. The risk curve is gentle at first and deepens with rarer crops.
- **Loops back to the bond:** Resources from your farm build furniture in your *shared* home — solo effort, shared result.

---

## Navigation

- **Location:** Third tab in the game room view, to the right of 🏡 Home.
- **Tab label:** `🌾 Farm`
- **Each player has their own farm** — the farm state is owned by the user (not the room/bond).
- **Visiting:** You can view your partner's farm. Your ghost wanders their farm when you visit. (Full visiting mechanics are in TODO.)

---

## Grid & Layout

| Property | Value |
|----------|-------|
| Grid size | 16 columns × 12 rows |
| Cell size | Responsive (fills screen width) |
| Visual style | Distinct from Home — green grass background, brown soil tiles, sky gradient top border |

### Visual Language
- **Grass tiles:** Default empty cells. Light green, slight texture variation.
- **Soil tiles:** A cell becomes soil when something is planted in it. Darker brown, visible texture.
- **Water animation:** Brief ripple effect when a cell is watered.
- **Sky strip:** Top 1–2 rows have a soft sky-blue background to give the farm a horizon feel.
- **Overall palette:** Earthy greens, warm browns, soft blues — contrasts clearly with the Home's wood/purple aesthetic.

---

## Starting State

When a player first opens their Farm tab:

| Item | Count | Notes |
|------|-------|-------|
| Oak trees (planted) | 5 | Pre-placed at starter positions, fully grown |
| Seeds (in inventory) | 3 | Generic seed packets, used during tutorial |
| Berry seeds | 0 | Awarded at end of tutorial |

The 5 oak trees are placed at predetermined positions that demonstrate the 3-cell spacing rule visually.

---

## Trees

### Oak Tree
The foundational tree of the farm. Permanent, hardy, productive.

| Property | Value |
|----------|-------|
| Spacing rule | Minimum 3 cells from any other tree (measured center-to-center) |
| Growth stages | Sapling → Young Tree → Full Oak (see below) |
| Hardiness | Very hardy — does not wilt |
| Produces | Acorns (tap to collect, respawn every 6 hours) |
| Can be chopped | Yes — tap and hold (or confirm dialog) to chop for Wood |
| Planted by | Planting an Acorn on a valid soil cell |

### Tree Growth Stages

| Stage | Visual | Time to reach |
|-------|--------|---------------|
| 🌱 Acorn/Sapling | Tiny green sprout, 3px pixel art | Planted |
| 🌿 Young Tree | Small branchy tree, ~half height | 4 hours after planting |
| 🌳 Full Oak | Full canopy, wide trunk | 12 hours after Young Tree stage |

Growth can be **sped up with 5 Gems** at any stage transition.

### Acorn Economy
- Fully grown oak trees produce **1 acorn every 6 hours**, visible as a small collectible on the tree cell.
- Tap the tree to collect the acorn. It goes into your personal inventory.
- Acorns are used to **plant new trees** — drag/place an acorn onto an empty grass cell.
- Extra acorns can be stored indefinitely.

### Wood
- Chopping a **Full Oak** yields **4 Wood**.
- Chopping a **Young Tree** yields **1 Wood**.
- Chopping a **Sapling** yields nothing (just removes it).
- Wood is a personal resource that unlocks **buildable furniture** in the Home Base shop (see Wood Furniture section).

---

## Crops

### Spacing & Placement
- Crops can be planted on **any grass cell** not occupied by another crop or tree.
- No minimum spacing between crops (unlike trees).
- Crops must be **watered once** after planting to begin their growth timer.

### Crop Catalogue

| Crop | Emoji | Grow time | Wilt window | Drops | Regrows | Notes |
|------|-------|-----------|-------------|-------|---------|-------|
| Blueberry Bush | 🫐 | 4h | Never wilts | 3 Blueberries | Yes (every 4h after harvest) | Hardy perennial |
| Sunflower | 🌻 | 2h | 24h after ready | Sunflower Seeds, Petals | No (replant) | Good starter crop |
| Mushroom | 🍄 | 6h | 48h after ready | Mushrooms | No | Only grows within 2 cells of a tree |
| Wheat | 🌾 | 3h | 12h after ready | Wheat | No | Common crafting ingredient |
| Rose | 🌹 | 8h | 6h after ready | Petals | No | Delicate — high attention required |
| Corn | 🌽 | 5h | 24h after ready | Corn | No | Medium hardiness |
| Strawberry | 🍓 | 3h | 18h after ready | Strawberries | Yes (2× before replanting) | Popular early crop |
| Truffle | 🪨 | 12h | Never wilts | Truffles | No | Rare — only grows within 1 cell of a Full Oak |

### Wilting Rules
- A crop enters **"wilting"** state when the wilt window expires after harvest-readiness.
- Wilted crops: visual turns grey/droopy, cannot be harvested for full yield.
- Wilted crops can still be removed to clear the soil.
- **No penalty** for wilted crops beyond the lost harvest — don't punish, just gently remind.

### Watering
- After planting, a crop must be **watered once** to start the growth timer.
- Watering = single tap on the crop cell while holding the watering can (or just tap when in water mode).
- No repeat watering required (except: **Roses** need watering again at the halfway point or they wilt early).
- Watering is **solo** — one player tap is enough. No asymmetric mechanic here.

---

## Gems System

Gems are a **premium soft currency** earned through relationship interactions — not purchased.

### Earning Gems

| Interaction | Gems earned |
|-------------|-------------|
| Completing a daily puzzle together | 1 gem |
| Visiting your partner's farm | 1 gem |
| Partner visits your farm | 1 gem |
| Sending a message in the bond | 1 gem |
| Playing a game together (Pac-Man, Chess, etc.) | 1 gem |

Max earn rate is capped at **5 gems per day** across all interactions (prevents grinding).

### Spending Gems

| Use | Cost |
|-----|------|
| Speed up a growth stage transition | 5 gems |
| (Future) Revive a wilted crop | 3 gems |

Gems are **personal** (like farm resources) — each player has their own gem count.

---

## Resources & Inventory

All resources are **personal** (tied to the player, not the bond/room).

### Resource Types

| Resource | Source | Used for |
|----------|--------|---------|
| 🌰 Acorns | Oak trees | Planting new oak trees |
| 🪵 Wood | Chopping trees | Wood furniture in Home Base |
| 🫐 Blueberries | Blueberry bush | Cooking (future) |
| 🌻 Sunflower Seeds | Sunflower | Replanting, cooking (future) |
| 🌸 Petals | Rose, Sunflower | Cooking (future), decoration (future) |
| 🍄 Mushrooms | Mushroom crop | Cooking (future) |
| 🌾 Wheat | Wheat crop | Cooking (future) |
| 🌽 Corn | Corn crop | Cooking (future) |
| 🍓 Strawberries | Strawberry crop | Cooking (future) |
| 🪨 Truffles | Truffle crop | Cooking (future), high-value trade |

### Wood Furniture (Home Base unlocks)

When a player has Wood in their inventory, new buildable items appear in the Home Base shop:

| Item | Wood cost | Coins cost | Beauty |
|------|-----------|-----------|--------|
| 🪑 Wooden Chair | 2 wood | 5 coins | 2 |
| 🪵 Wooden Desk | 3 wood | 8 coins | 3 |
| 📚 Wooden Bookcase | 4 wood | 10 coins | 4 |
| 🛏️ Wooden Bed Frame | 6 wood | 15 coins | 5 |

---

## Tutorial — Sudowoodo

### Character
**Sudowoodo** (Pokémon #185) — a rock-type Pokémon that disguises itself as a tree. The joke: he introduces himself as "definitely a tree" with complete sincerity. He stays on the farm permanently after the tutorial as a periodic hint-giver and personality presence.

### Tutorial Flow (max 5 screens)

**Screen 1 — Introduction**
> *[Sudowoodo appears near the pre-planted oaks, doing his best tree impression — arms out, frozen]*
> "...Oh! You surprised me. I was just... standing here. Being a tree. As trees do."
> "Welcome to your farm. I'm Sudowoodo. I am a tree. Now let's get started."

**Screen 2 — Oak Trees**
> *[Highlights one of the 5 pre-planted oaks]*
> "These 5 oak trees were here before you arrived. Very noble. Very... treelike."
> "Tap one to see what it's growing. Fully grown oaks drop acorns every 6 hours — collect them to plant more trees."
> *[Player taps tree, sees acorn collection animation]*

**Screen 3 — Planting**
> *[Highlights the 3 seed packets in inventory]*
> "You've got 3 seeds. They're feeling restless."
> "Tap an empty patch of soil to plant one. Remember: trees need 3 cells of personal space. Very dignified."
> *[Player plants a seed]*

**Screen 4 — Watering**
> *[Watering can appears in toolbar]*
> "A planted seed is just... potential. Tap the watering can, then tap your seed. Start the clock."
> "This one will be ready in a couple of hours. Check back. I'll be here. Definitely not moving."
> *[Player waters the seed, growth timer starts]*

**Screen 5 — Berry Seeds reward**
> *[Sudowoodo presents berry seeds with a flourish]*
> "You did it. You're a farmer now."
> "Take these berry seeds — your first real crop. Berries are useful. For cooking. Which is a whole thing we'll get to."
> "I'll stick around. In case you need... tree advice."
> *[Player receives Berry Seeds. Tutorial complete.]*

### Post-Tutorial Sudowoodo
- Sudowoodo lives in a fixed spot on the farm (bottom-left corner, for example).
- Every **2–3 days** of app activity, he appears with a random hint or observation:
  - *"Your roses look stressed. Water them before sunset."* (when rose is near wilting)
  - *"A truffle only grows in the shadow of a great oak. Just saying."* (hint for advanced crops)
  - *"Your partner visited today. They complimented the sunflowers. I pretended not to notice."*
  - *"I have been standing here for 47 days. I am very good at being a tree."*

---

## Data Model (Supabase)

### New table: `farms`
```sql
CREATE TABLE farms (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_token text NOT NULL UNIQUE,  -- the player's personal token
  room_code    text NOT NULL,          -- links back to the game room
  resources    jsonb NOT NULL DEFAULT '{}',  -- { acorns: 0, wood: 0, gems: 0, ... }
  tutorial_done boolean NOT NULL DEFAULT false,
  tutorial_step int NOT NULL DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);
```

### New table: `farm_plots`
```sql
CREATE TABLE farm_plots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_token text NOT NULL,
  crop_type    text NOT NULL,   -- 'oak', 'blueberry', 'sunflower', etc.
  x            int NOT NULL,
  y            int NOT NULL,
  planted_at   timestamptz NOT NULL DEFAULT now(),
  watered_at   timestamptz,
  last_harvested_at timestamptz,
  stage        text NOT NULL DEFAULT 'seed',  -- 'seed' | 'young' | 'mature' | 'wilted'
  harvest_count int NOT NULL DEFAULT 0,  -- for regrowable crops
  UNIQUE(player_token, x, y)
);
```

---

## Out of Scope (see TODO.md)

- Cooking / crafting system
- Visiting mechanics (can you water a partner's crops?)
- Progression system (unlocking crop types over time, farm level)
- Push notifications for crop readiness
- Seasonal events
- Farm decorations / aesthetics shop
- Land expansion

---

## Open Questions (to revisit)

1. Should acorns be plantable anywhere, or only on designated "tree zones"?
2. Does the farm use the same Demo Mode pattern as the home base (localStorage fallback)?
3. Are gems stored server-side per player, or localStorage for now?
