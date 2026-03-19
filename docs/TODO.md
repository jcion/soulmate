# 🗒️ Soulmate — Feature TODO List

Items that have been deliberately deferred. Revisit these as the core loop stabilizes.

---

## 🌾 Farm

### Cooking / Crafting System
Berries, mushrooms, wheat, corn, strawberries, truffles, and petals are placeholders for a cooking mechanic. When cooking is built:
- A "Kitchen" or "Cooking" screen (likely on the Home tab or a fourth tab)
- Recipes that combine farm resources into meals/items
- Meals could buff soul happiness, earn coins, or be gifted to partner

### Visiting Mechanics
Players can already navigate to a partner's farm. Full visiting needs:
- Can a visitor water crops as a gift?
- Does watering by a visitor count the same as owner watering?
- Visual indicator when partner has recently visited ("Rui was here 2h ago")
- Ghost wanders the farm on visit (already decided — just needs implementation)

### Progression System
- Unlocking new crop types over time (e.g., truffles unlock after 10 harvests)
- Farm level / experience system
- Grid expansion (start 12×8, expand to 16×12 with milestones)

### Push Notifications
- "Your sunflowers are ready to harvest 🌻"
- "Your roses are about to wilt 🌹 — check in soon"
- Requires web push permission flow + service worker

### Seasonal Events
- Different crops available in different seasons
- Holiday-themed decorations
- Limited-time seeds

### Farm Decorations Shop
- Aesthetic items for the farm (scarecrow, fence, garden path)
- Funded by coins or wood
- No gameplay effect — purely cosmetic

### Land Expansion
- Start smaller (e.g., 10×8), unlock full 16×12 via milestones
- Could require a certain wood/resource investment

---

## 🎮 Games

### Multiplayer Space Invaders
Space Invaders currently has no multiplayer. Apply the same host/guest architecture used for Pac-Man.

### Additional Minigames
- Multiplayer Trivia Night (currently local-only on explore page)
- Other location-based games on the explore page

---

## 🌍 Explore

### Visiting Mechanic (Explore page)
When two real users are at the same location on the explore map, enable deeper interaction beyond voice chat — e.g., start a game, send a connection request.

### More Cities
Currently: Williamsburg (NYC) + Toronto. Candidates: London, Tokyo, Paris, Mexico City.

### Soul Profiles
Tapping a wandering soul could show a mini profile card — a precursor to the dating/matching phase.

---

## 💕 Dating Phase (Future)

The full solo → partner discovery flow:
- Soul creation (name, color, personality)
- Wandering the explore map as a real-time presence
- Compatibility signals based on farm/home style choices
- Match request and acceptance
- Transition from "solo soul" to "bonded couple" game room

---

## ⚙️ Technical Debt

### Notifications
Full web push notification system — crops ready, partner visited, daily puzzle available.

### Demo Mode for Farm
Ensure the farm feature works in Demo Mode (localStorage) the same way the home base does.

### Gems — Server vs. Local
Currently unimplemented. Decide: Supabase column on `farms` table vs. localStorage for MVP.

### Farm Realtime Sync
If visiting is implemented, the visitor needs to see the farm state in near-real-time (Supabase Realtime subscription on `farm_plots` by player_token).

---

*Last updated: March 2026*
