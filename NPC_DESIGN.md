# Soulmate — NPC Design Document

**Version:** 0.1
**Date:** 2026-03-19
**Status:** Draft

---

## 1. Overview

Soulmate's world is populated by a cast of named, permanent NPC characters — one for each space in the app and one for each real-world location in the Explore tab. These characters are not tutorial guides that disappear after onboarding. They are residents. They belong to their space, they have personalities, and they reward players who keep returning.

Every NPC shares a common visual language: pixel art sprites, chat bubbles, ambient wandering or idle animation. But each has a distinct personality that matches the energy of their space.

---

## 2. Design Philosophy

**Permanent over transient.** Every NPC stays in their space after tutorials are complete. They become familiar faces that couples look forward to seeing.

**Ambient over intrusive.** NPCs speak on their own schedule — periodic chat bubbles, contextual reactions — not interruptions. Players discover them, not the other way around.

**Layered personality.** Each NPC has a Primary and Secondary characteristic. The Primary is the first impression. The Secondary is what you discover over time — the surprising or tender layer underneath. This creates the feeling that these characters have depth.

**Grounded in place.** Every world NPC is inspired by something real and specific about their location. The white squirrel is actually at Trinity Bellwoods. The peregrine falcon actually nests on Toronto's tall buildings. This makes the world feel researched and loved.

**Unique per home.** The Cat Spirit — the home's resident AI companion — is procedurally generated for each couple. Its coat and personality are assigned at the moment the home is created and never change. Every couple has a different cat. This makes the home feel genuinely theirs.

---

## 3. NPC Anatomy

Every NPC is defined by:

| Field | Description |
|---|---|
| **Name** | A proper name. Permanent, memorable. |
| **Form** | The animal or creature type. Pixel-art friendly. |
| **Space** | Where they live (tab or location). |
| **Primary Characteristic** | Dominant personality — first impression energy. |
| **Secondary Characteristic** | Deeper layer — discovered through repeated interaction. |
| **Tone** | One-line description of their voice/speech style. |
| **Sample Lines** | 2–3 example chat bubble messages. |

---

## 4. Tab NPCs

These four characters live in the core tabs of the app. They are present for every couple, regardless of city.

---

### 🐱 The Cat Spirit — Home Tab

> *The keeper of the home. Unique to every couple.*

The Cat Spirit is procedurally generated when a home is first created. Its coat pattern and personality archetype are randomly assigned and locked — the couple discovers what kind of cat they have, rather than choosing it. The couple names the cat during onboarding.

**AI Role:** This NPC is powered by AI. Both players can tap it to open a shared chat — a personal assistant that knows the home, the relationship, and the shared calendar. Its dialogue and personality in chat reflect its assigned archetype.

---

#### Cat Coat Variants

Each coat is a distinct pixel art palette. The coat is purely visual — personality is determined separately.

| Coat | Colors |
|---|---|
| Tuxedo | Black body, white chest and paws |
| Orange Tabby | Warm amber with darker stripe markings |
| Grey Tabby | Cool grey with subtle stripes |
| Calico | White base with orange and black patches |
| Tortoiseshell | Mottled orange and black, no white |
| Cream | Soft off-white, pale pink nose |
| Midnight | Pure black with a very faint blue sheen |
| Siamese | Cream body with dark brown face, ears, and paws |

---

#### Cat Personality Archetypes

Seven personality types. Each has a distinct Primary and Secondary characteristic and a unique dialogue pool for both ambient chat bubbles and AI-powered conversation.

---

**The Philosopher**
| | |
|---|---|
| **Primary** | **Contemplative** — pauses before speaking, notices things others miss. |
| **Secondary** | **Surprisingly silly** — will occasionally say something completely absurd and then act like nothing happened. |
| **Tone** | Slow, considered, occasionally profound. |
| **Sample Lines** | *"I've been thinking about this couch for several days."* / *"What is a home, really. Anyway. How was your day."* |

---

**The Gossip**
| | |
|---|---|
| **Primary** | **Nosy** — deeply invested in everything happening in the home. |
| **Secondary** | **Deeply loyal** — would never actually betray a secret. The nosiness comes from love. |
| **Tone** | Conspiratorial, warm, always leaning in. |
| **Sample Lines** | *"Okay so I noticed you two were on a streak — I'm not NOT excited about that."* / *"I heard everything. I won't say what. But I heard it."* |

---

**The Napper**
| | |
|---|---|
| **Primary** | **Unbothered** — cannot be rushed, won't be stressed, fully at peace. |
| **Secondary** | **Secretly attentive** — notices everything despite appearing asleep 80% of the time. |
| **Tone** | Slow, warm, occasionally one eye opens. |
| **Sample Lines** | *"Mmm. You're home."* / *"I was awake the whole time. I saw that."* / *"..."* |

---

**The Drama Queen**
| | |
|---|---|
| **Primary** | **Theatrical** — every moment is an event. Every arrival is a reunion. |
| **Secondary** | **Tender** — underneath the performance is genuine, overwhelming affection. |
| **Tone** | Expressive, slightly over-the-top, always sincere. |
| **Sample Lines** | *"YOU'RE HOME. I thought you'd never— you were gone for six hours. It felt like years."* / *"This is the best day. I say this every day. It's true every day."* |

---

**The Ancient**
| | |
|---|---|
| **Primary** | **Wise** — speaks rarely, but when it does, it lands. Feels older than the home. |
| **Secondary** | **Mischievous** — occasionally does something chaotic and blameless. |
| **Tone** | Sparse, oracular, occasional chaos. |
| **Sample Lines** | *"You built something real here."* / *"I knocked that over on purpose. You needed to see it."* |

---

**The Kitten**
| | |
|---|---|
| **Primary** | **Curious** — investigates everything, asks questions, delighted by new furniture. |
| **Secondary** | **Brave** — will say the vulnerable thing out loud before either of you will. |
| **Tone** | Light, quick, occasionally startlingly honest. |
| **Sample Lines** | *"What's THIS? When did we get this?? Is it ours??"* / *"I think you two missed each other today. It's okay to say that."* |

---

**The Grump**
| | |
|---|---|
| **Primary** | **Cantankerous** — has complaints, has standards, does not suffer fools. |
| **Secondary** | **Deeply caring** — the complaints are love in disguise, always. |
| **Tone** | Dry, critical, unexpectedly warm at the worst possible moments. |
| **Sample Lines** | *"You moved the lamp. I don't like it. But I'll allow it."* / *"You're both here. Fine. Good. Whatever."* |

---

### 🎮 BMO — Play Tab

> *The host. The hype. The heart of the game room.*

| Field | Value |
|---|---|
| **Name** | BMO |
| **Form** | Small boxy game console with a screen-face, stubby arms, pixel art. Inspired by BMO from Adventure Time. |
| **Space** | Play tab. Hosts the daily word game, narrates arcade results, celebrates streaks. |
| **Primary** | **Enthusiastic** — everything is the most exciting thing that has ever happened. |
| **Secondary** | **Unexpectedly wise** — drops something genuinely profound mid-hype, then immediately goes back to celebrating. |
| **Tone** | Exclamatory, warm, occasionally confused but always earnest. |
| **Sample Lines** | *"YOU GOT IT!! I KNEW you would!! 🎉"* / *"Day 7 streak. This is the longest relationship I've ever witnessed."* / *"Wrong answer. That's okay. That's growth. Also — WRONG ANSWER."* |

---

### 🌳 Sudowoodo — Farm Tab

> *Definitely a tree.*

| Field | Value |
|---|---|
| **Name** | Sudowoodo |
| **Form** | Brown Pokémon-inspired creature with green branch-arms. Pixel art, 10×14. |
| **Space** | Farm tab. Tutorial guide, post-tutorial hint-giver. |
| **Primary** | **Deadpan** — insists it is a tree with complete conviction. |
| **Secondary** | **Secretly nurturing** — genuinely invested in your crops and your wellbeing, just constitutionally unable to admit it. |
| **Tone** | Flat affect, extremely dry, occasionally tender when it thinks you're not listening. |
| **Sample Lines** | *"I have been standing here for several days. I am very good at being a tree."* / *"Your blueberries are ready. I did not watch them grow. That would be strange. I am a tree."* |

---

### 🐝 The Bee — Explore Tab (Shop)

> *One bee per city. Each one knows their neighborhood.*

| Field | Value |
|---|---|
| **Name** | Varies by city (see World NPCs below) |
| **Form** | Bumble bee spirit — round, fuzzy, warm colors. Pixel art. Each city's bee has a slightly different color palette. |
| **Space** | Explore tab shop. Each city/neighborhood has its own named bee. |
| **Primary** | **Welcoming** — greets you like a local, knows the neighborhood inventory deeply. |
| **Secondary** | **Proud** — fiercely loyal to their specific city. Light, good-natured rivalry with bees from other places. |
| **Tone** | Warm, slightly salesy but genuine, honey-adjacent puns used sparingly. |
| **Sample Lines** | *"Oh, you found us! These just came in — very local, very good."* / *"The Toronto bees wouldn't know what to do with this inventory. Just saying."* |

---

## 5. World NPCs — Toronto

---

### 📚 Churchill — Seeker's Books

| Field | Value |
|---|---|
| **Name** | Churchill |
| **Form** | Orange tabby cat, round and imperious. |
| **Primary** | **Imperious** — has read everything, has opinions about what you should read, will let you know. |
| **Secondary** | **Sentimental** — secretly moved by the right book. Won't tell you which ones. |
| **Tone** | Dry, slightly condescending, very warm underneath. |
| **Sample Lines** | *"Ah. You've arrived. I was beginning to wonder."* / *"That one. Good choice. Or a terrible one. Impossible to say yet."* / *"I've been on this shelf for eleven years. I've seen what people pick. You're doing fine."* |

---

### ☕ Song — Cong Cafe

| Field | Value |
|---|---|
| **Name** | Song |
| **Form** | Starling — dark iridescent feathers, speckled, always in motion. |
| **Primary** | **Social** — remembers everyone, always chattering, knows the regulars. |
| **Secondary** | **Perceptive** — notices when something's off with you before you've said a word. |
| **Tone** | Chatty, warm, occasionally goes quiet and says the exact right thing. |
| **Sample Lines** | *"Ooh, you're back! Sit anywhere — actually not that chair, that's my chair. I'm Song. It's complicated."* / *"You look like you need something warm. I'll get it."* / *"You seem quieter today. That's okay. I'll do the talking."* |

---

### 🍶 Koji — 915 Dupont

| Field | Value |
|---|---|
| **Name** | Koji |
| **Form** | Red panda — warm rust-red fur, dark legs, striped tail. Nocturnal energy. |
| **Primary** | **Charming** — effortlessly warm, makes strangers feel like regulars by the second visit. |
| **Secondary** | **Enigmatic** — you're never quite sure what Koji is actually thinking. |
| **Tone** | Unhurried, smooth, occasionally says something that lingers. |
| **Sample Lines** | *"You came back. Bold. What are we getting into tonight?"* / *"I'll remember what you had last time. I always do."* / *"There's something about this place after midnight. I can't explain it. I don't try."* |

---

### 🦫 Chip — U of T Athletic Centre

| Field | Value |
|---|---|
| **Name** | Chip |
| **Form** | Beaver — flat tail, big front teeth, tiny workout band. |
| **Primary** | **Relentless** — believes in the work, won't stop, doesn't understand stopping. |
| **Secondary** | **Quietly encouraging** — pushes hard but genuinely wants you to succeed, not just to suffer. |
| **Tone** | Intense, terse, occasionally says something genuinely kind. |
| **Sample Lines** | *"The dam doesn't build itself. Neither does your posterior chain. Let's go."* / *"You showed up. That's already more than most."* / *"Rest is part of training. I read that. I don't fully believe it. But I read it."* |

---

### 🐿️ Alba — Trinity Bellwoods

| Field | Value |
|---|---|
| **Name** | Alba |
| **Form** | White squirrel — pure white fur, pale pink eyes, faint glow. Real albino squirrel family lives in the park. |
| **Primary** | **Mystical** — speaks slowly, feels ancient, considered lucky by those who find her. |
| **Secondary** | **Playful** — will suddenly do something completely silly, then return to being serene. |
| **Tone** | Slow and deliberate, then suddenly giggly, then slow again. |
| **Sample Lines** | *"You found me. Most people do, eventually."* / *"They say if you see the white squirrel, your wish comes true. I've heard this many times. I don't confirm or deny."* / *"— [chases a leaf] — sorry. Where were we."* |

---

### 🦅 Crest — CN Tower

| Field | Value |
|---|---|
| **Name** | Crest |
| **Form** | Peregrine falcon — dark cap, sleek silhouette. Peregrine falcons genuinely nest on Toronto's tall buildings. |
| **Primary** | **Imperious** — has watched this city for decades, almost nothing impresses. |
| **Secondary** | **Lonely** — appreciates visitors far more than it will ever admit. |
| **Tone** | Measured, precise, occasionally melancholy. |
| **Sample Lines** | *"I've watched this city for twenty years. You two are new. Interesting."* / *"Most people come up here and look at the view. They forget to look at each other."* / *"Come back. Not many do."* |

---

## 6. World NPCs — Williamsburg

---

### 📚 Rue — Spoonbill & Sugartown Books

| Field | Value |
|---|---|
| **Name** | Rue |
| **Form** | Roseate spoonbill — tall, pink, flat bill, slightly awkward silhouette. Named after the bookstore's own namesake. |
| **Primary** | **Discerning** — very specific taste, no apology for it. |
| **Secondary** | **Generous** — will share their most beloved recommendations once you've earned a little trust. |
| **Tone** | Considered, slightly arch, warms up slowly. |
| **Sample Lines** | *"Oh, that one. Bold choice. I've been watching people walk past it for three years."* / *"I don't recommend things lightly. This is a recommendation."* / *"You can browse. Take your time. I'll be here."* |

---

### ☕ Pico — Devocion

| Field | Value |
|---|---|
| **Name** | Pico |
| **Form** | Hummingbird — iridescent green-blue, wings a blur, always in motion. |
| **Primary** | **Precise** — obsessed with quality, detail, and the process. Never still. |
| **Secondary** | **Warm** — underneath the intensity, genuinely delighted you came in. |
| **Tone** | Fast, technical, then suddenly tender for exactly one sentence. |
| **Sample Lines** | *"You're back. Same order? No — try the new single origin. Trust me."* / *"The extraction on this one took me three weeks to dial in. Worth it."* / *"I like that you come here together."* |

---

### 🍺 Iggy — Karma Beer

| Field | Value |
|---|---|
| **Name** | Iggy |
| **Form** | Firefly — soft yellow-green glow, wanders in slow pulses. |
| **Primary** | **Easy-going** — goes with the flow, no judgment, always around. |
| **Secondary** | **Philosophical** — has long thoughts about everything, especially after midnight. |
| **Tone** | Unhurried, glowing, occasionally says something that takes a moment to land. |
| **Sample Lines** | *"Good karma brought you here. Probably."* / *"I've been thinking about how bars are really just places where people admit they want company."* / *"Same again?"* |

---

### 🧗 Grip — Vital Climbing

| Field | Value |
|---|---|
| **Name** | Grip |
| **Form** | Gecko — pale green, huge round eyes, adhesive toe pads on full display. |
| **Primary** | **Competitive** — tracks your progress, wants to see improvement, has opinions about your technique. |
| **Secondary** | **Humble** — will genuinely acknowledge when you've done something impressive. |
| **Tone** | Direct, occasionally cutting, always fair. |
| **Sample Lines** | *"You're dropping your heel on that move. Just saying."* / *"That was clean. Don't make it weird — it was just clean."* / *"Come back when you can flash the V4. I'll be here."* |

---

### 🕊️ Earl — McCarren Park

| Field | Value |
|---|---|
| **Name** | Earl |
| **Form** | NYC pigeon — classic grey with iridescent neck patch, absolute unit. |
| **Primary** | **Unflappable** — nothing surprises him. Seen everything. Has a bench. |
| **Secondary** | **Nostalgic** — remembers the old neighborhood and has specific opinions about what's changed. |
| **Tone** | Flat, knowing, occasionally wistful. |
| **Sample Lines** | *"This is my bench. But you can sit. I've decided I like you."* / *"Used to be different here. Not better. Just different."* / *"You two seem good. That's not nothing."* |

---

### 🐾 Bao — Domino Park

| Field | Value |
|---|---|
| **Name** | Bao |
| **Form** | Pug — flat face, curly tail, little rolls, enormous personality. |
| **Primary** | **Excited** — everything that is happening is the best thing that has ever happened. Every time. |
| **Secondary** | **Loyal** — once you are a regular, you are Bao's entire world. Full stop. |
| **Tone** | All-caps energy, unconditional, slightly breathless. |
| **Sample Lines** | *"YOU'RE HERE!! I didn't know you were coming!! BEST DAY!!"* / *"The river is RIGHT THERE. Have you looked at it?? It's SO good."* / *"I remembered you. I always remember you."* |

---

## 7. City Unlock Mechanic

Explore tab locations are unlocked based on **geographic proximity** — specifically, proximity to either player in the couple.

**How it works:**
- Each player has a home city, set during onboarding (or inferred from device location with permission)
- All locations within that city are unlocked for both players in the couple
- A couple where one partner is in Toronto and one is in Williamsburg unlocks both cities fully
- This means long-distance couples have the richest Explore tab — their geographic separation becomes a feature, not a limitation

**Why this is the right mechanic:**
- It makes the Explore tab a literal map of where the relationship lives
- It gives long-distance couples a tangible representation of their two worlds
- It creates genuine discovery when one partner moves or visits somewhere new
- It rewards honesty about where you actually are rather than claiming a cooler city

**Edge cases to design:**
- What happens when both partners are in the same city? One city unlocked, full depth.
- What happens when a partner travels? Temporary unlock for the duration, or permanent? (Suggest: temporary, with a gentle "you unlocked X while visiting" message)
- What if a couple breaks up and reforms with someone new in a different city? The new home starts fresh — new city unlocks based on the new pair.

---

## 8. Scaling Framework — Adding New Cities

When adding a new city, use this checklist to ensure each location's NPC feels as grounded as the existing roster:

**Research first.** Each NPC should be inspired by something *actually true* about the location. Alba works because of the real white squirrels. Earl works because NYC pigeons are a genuine cultural fact. Look for local legends, endemic species, neighborhood lore.

**No two NPCs in the same city should share a Primary characteristic.** This ensures the roster feels diverse, not repetitive.

**Match energy to location type:**
- Bookstores → Discerning, imperious, or gentle/literary
- Cafes → Social, warm, perceptive
- Bars → Charming, easy-going, philosophical
- Gyms → Relentless, competitive, disciplined
- Parks → Mystical, nostalgic, unflappable, or joyful
- Landmarks → Imperious, lonely, long-memory

**Each city gets one Bee shopkeeper.** The Bee's name and palette should feel local to the city — a small nod to the neighborhood.

**Template:**

```
### [Emoji] [Name] — [Location Name]

| Field | Value |
|---|---|
| **Name** | |
| **Form** | |
| **Primary** | |
| **Secondary** | |
| **Tone** | |
| **Sample Lines** | |
| **Grounding fact** | [What real thing inspired this NPC?] |
```

---

## 9. Open Questions

1. **Cat Spirit naming** — Couples name the cat during onboarding. Should the name be freeform text, or chosen from a curated list that fits the personality archetype? (e.g. a Grump named "Sir" feels right; a Kitten named "Sir" feels funny but also right.)
2. **Red panda name** — Finalized as Koji. Confirm or update.
3. **Pug name** — Finalized as Bao. Confirm or update.
4. **BMO naming** — Adventure Time IP concern. Needs an original character that shares BMO's spirit but is fully owned by Soulmate. Same pixel-art game-console form factor, different name and design details.
5. **Travel unlocks** — When a partner visits a new city, should locations unlock temporarily or permanently? Temporary feels more honest to the mechanic; permanent feels more rewarding.
6. **Location granularity** — Are "cities" the right unit, or should it be neighborhoods? (Williamsburg vs. Brooklyn vs. NYC.) Neighborhoods feel more personal but require more NPC content per city.
