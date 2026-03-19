# Soulmate — Product Requirements Document

**Tagline:** A place your relationship lives.
**Version:** 0.1 (MVP)
**Date:** 2026-03-17
**Status:** Draft

---

## 1. Vision

Soulmate is a relationship app — not a dating app. While it targets the same people (those looking for love or already in love), its business model is fundamentally different: we succeed when relationships thrive, not when users are stuck scrolling.

The core metaphor is a shared home. Two people — two souls — build a life together inside Soulmate. The home grows through daily rituals and cooperation. It reflects the health of the relationship.

---

## 2. The Problem

Dating apps are optimized for engagement, not outcomes. They profit from loneliness. Even couples who find each other drift apart without a shared space to nurture what they've built.

There is no product that:
- Gives a relationship a place to live
- Makes daily connection feel like play, not obligation
- Grows *with* the couple over time

---

## 3. Target Users

**Primary (MVP):** Existing couples, especially long-distance relationships.
**Secondary (future):** Singles looking for a partner.

### User Personas

**The Long-Distance Couple**
Together but apart. They communicate through iMessage and FaceTime, but there's no shared *place* — no ritual, no game, no world that belongs to both of them. Soulmate gives their relationship a home.

**The New Couple**
Recently together. Enthusiastic, but looking for ways to stay connected beyond texting. Soulmate provides a daily touchpoint that feels like play.

**The Solo Wanderer** *(future phase)*
Single and looking. Wants to meet someone in a context that's more meaningful than swiping.

---

## 4. Product Phases

### Phase 1 — MVP (Building Mode)
Two connected users build a shared home together. Daily cooperative mini-games earn coins to furnish and expand the home.

### Phase 2 — Discovery Mode (future)
A solo experience where your "soul" wanders a virtual world, plays compatibility mini-games with other souls, and eventually chooses to build a home with one of them. The dating feature.

---

## 5. Core Concept: The Shared Home

Each couple shares a single **home base** — a persistent, isometric world rendered in top-down 3D, inspired by Animal Crossing and Pokémon. The home is the relationship. It grows when you show up together.

### Home Mechanics
- The home starts small (a plot of land, a single room)
- Coins earned from daily games are spent to build rooms, add furniture, and expand the land
- Both players' **souls** (their avatars) live in and wander the home
- The home is persistent — it's always there, always yours
- **One home per person at a time.** If a relationship ends, the homebase is deleted. Starting over means starting fresh.

### Visual Style
- Top-down isometric 3D
- Warm, cozy aesthetic — Animal Crossing palette
- Mobile-first layout (web app, iOS-optimized)
- Each soul is a small customizable character

---

## 6. The Daily Loop

The anchor of daily engagement is a **cooperative word mini-game**, played together each day.

### The Word Game

Inspired by the NYT Mini Crossword — short, completable in under 5 minutes, satisfying.

**Key mechanic: Asymmetric Information**

| Player A | Player B |
|----------|----------|
| Receives the **word clues** | Receives the **hints** |
| Knows what they're solving for | Has additional context clues |
| Must communicate with Player B | Must communicate with Player A |

Neither player can solve the puzzle alone. The game *requires* conversation — a built-in reason to call, text, or message your partner every day.

### Earning Coins

| Condition | Reward |
|-----------|--------|
| Participating (any score) | Base coins |
| Completing the puzzle | Bonus coins |
| Winning / high score | Extra coins |
| Daily streak (consecutive days) | Streak multiplier on all rewards |

Streaks reward consistency. Even couples who don't finish the puzzle still earn — showing up matters.

### Notifications
- "Rui just completed today's puzzle — your turn."
- Streak reminders before midnight
- "Your home is waiting."

---

## 7. User Flows

### Onboarding: Existing Couple
1. Player A creates an account, sets up their soul
2. Player A invites partner via link or code
3. Player B accepts, creates their soul
4. Both are dropped into a fresh home base — empty land, ready to build
5. First daily puzzle is immediately available

### Onboarding: Solo (Future Phase 2)
1. Player creates account, sets up soul
2. Soul enters the wandering world
3. Plays compatibility mini-games with other souls
4. Mutual decision to "build together" → transitions to Building Mode

### Breaking Up
1. Either player initiates "End homebase"
2. Confirmation screen — this is intentionally weighty
3. Home is deleted permanently
4. Both players return to solo state, can start again

---

## 8. MVP Feature List

### Must Have
- [ ] User authentication (email or OAuth)
- [ ] Partner invite / linking system (link or code)
- [ ] Isometric home base (render a simple starting home)
- [ ] Soul avatars (basic customization)
- [ ] Daily word mini-game with asymmetric information mechanic
- [ ] Coin earning system with streak tracking
- [ ] Basic coin spending (buy furniture / home items)
- [ ] Push / browser notifications for daily game prompt
- [ ] Home persistence (state saved between sessions)

### Nice to Have (Post-MVP)
- [ ] Expanded home building (more rooms, land expansion)
- [ ] More mini-game types
- [ ] Relationship milestones / achievements
- [ ] Time zone awareness (show partner's local time)
- [ ] Soul wandering / dating phase

### Out of Scope (MVP)
- In-app messaging / video
- Monetization
- Android / native app
- Social/community features (leaderboards, other couples)
- Breakup/archive distinction

---

## 9. Technical Considerations

**Platform:** Web app, mobile-first, iOS Safari optimized
**Rendering:** Isometric home will require a canvas/WebGL approach — Phaser.js or a lightweight game engine embedded in the web app
**Real-time:** The cooperative word game needs a real-time layer for both players to play simultaneously — WebSockets (e.g., Supabase Realtime, Ably, or Pusher)
**State:** Home state, coin balance, streak data, and puzzle completion need a persistent backend
**Puzzle generation:** Daily word puzzles need a content pipeline — can start with a curated bank, later auto-generated

---

## 10. Success Metrics (MVP)

| Metric | Goal |
|--------|------|
| D7 retention | > 40% |
| Daily puzzle completion rate | > 60% of active couples |
| Average streak length | > 5 days |
| Couples who spend first coins | > 70% within first week |
| Qualitative: "This made us talk today" | Validate in user interviews |

---

## 11. Open Questions

1. **Solo wandering phase (Phase 2):** What does the day-to-day experience feel like before you find a partner? Is the soul doing anything meaningful while alone?
2. **Home decay:** Does the home visually degrade if you miss days? (High emotional impact, but risks feeling punishing)
3. **Asymmetric game roles:** Are roles fixed per player, or randomized each day?
4. **Puzzle content:** Relationship-themed clues only, or general?
5. **Monetization model:** To be defined post-MVP

---

## 12. Design Principles

1. **Presence over performance.** Showing up matters more than winning.
2. **The game is a reason to talk.** Every mechanic should create a moment between two people.
3. **The home is the relationship.** What you see should feel like it means something.
4. **End with grace.** Breakups are real. The app should honor that.
