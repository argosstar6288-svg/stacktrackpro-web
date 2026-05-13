# StackTrack Onboarding UI Flow

## Goal
Turn a brand-new user into someone who:
- understands what StackTrack is
- creates their avatar and collector room
- scans their first card
- beats their first AI rival
- earns their first reward
- feels emotionally invested
- returns tomorrow

---

## High-Level Flow
1. Welcome Cinematic
2. Avatar Creation
3. Collector Room Tour
4. First Scan Tutorial
5. Meet First Rival
6. Guided Practice Match
7. Reward Chest
8. Room Customization
9. Progression Overview
10. Social/Competitive Preview
11. Personal Goal Selection
12. Return Incentive

---

## Screen-by-Screen Wireframe

### Screen 1: Welcome Cinematic
**Duration:** 0–20s

Components:
- Full-screen hero background
- Animated neon light sweep
- Floating 3D card art
- Rising leaderboard graphic
- Avatar celebration loop
- Headline: `Track. Compete. Build Your Collector Empire.`
- Subtext: `Scan cards, grow your collection, and battle rivals in a living virtual world.`
- Primary CTA button: `Start Your Journey`
- Secondary hint: `Tap to begin your onboarding adventure`

Behavior:
- CTA enters onboarding funnel
- subtle camera movement and particle motion

---

### Screen 2: Create Your Identity
**Duration:** 20–60s

Components:
- Avatar preview stage with spotlight
- Selection panels for:
  - Face
  - Hair
  - Hoodie / Jacket
  - Pants
  - Shoes
- Starter theme presets:
  - Casual Collector
  - Street Trader
  - Neon Pro
- Reward preview: `🎁 Welcome Gift: Exclusive Starter Hoodie`
- Continue button: `Confirm Avatar`

Behavior:
- live preview updates on selection
- idle animation loop on avatar
- apply selected cosmetics instantly
- theme presets auto-populate slots

---

### Screen 3: Collector Room Tour
**Duration:** 60–90s

Components:
- Room overview camera pan
- UI text overlay: `This is your Collector Room. Every card you scan appears here.`
- interactive room hotspots:
  - display shelves
  - desk
  - neon lighting
  - empty trophy pedestal
- action button: `Place starter display case`
- reward callout: `+100 Credits`

Behavior:
- tap hotspot triggers placement animation
- room lighting brightens when starter case placed
- credit reward animation on completion

---

### Screen 4: First Scan Tutorial
**Duration:** 90–150s

Components:
- prompt panel: `Let’s add your first card.`
- choice buttons:
  - `Scan a real card`
  - `Use demo card`
- if demo card chosen:
  - animated card visual rotates
  - value badge appears
  - card slides to glowing shelf
- reward summary:
  - `+250 Credits`
  - `First Card Badge`
  - `XP Boost`

Behavior:
- demo card path is instant onboarding
- scan path shows scanning UI and success animation
- room upgrades visually after scan
- spark/glow FX when card lands on shelf

---

### Screen 5: Meet Your First Rival
**Duration:** 150–210s

Components:
- rival intro card
- rival portrait: `BinderKid`
- dialogue bubble: `Hey! Think your collection can beat mine?`
- rival stats panel:
  - Difficulty: Rookie
  - Play Style: Steady Collector
- CTA button: `Challenge BinderKid`
- supporting text: `This match helps you learn how scoring and leaderboards work.`

Behavior:
- play short rival animation when displayed
- highlight rival personality traits

---

### Screen 6: Guided Practice Match
**Duration:** 3–5 minutes

Components:
- mini arena UI
- live leaderboard panel
- player/rival score cards
- visible point sources:
  - card values
  - rare bonus events
- objective text: `Overtake BinderKid to win.`
- progress indicator: `First match` or `Practice mode`

Behavior:
- scripted match curve with tension
- player gains points from tutorial actions
- leaderboard updates in real time
- win by narrow margin
- final victory sequence:
  - fireworks
  - avatar celebration
  - trophy appears in room

Rewards:
- `+500 Credits`
- `Rookie Champion Badge`
- `3-Day Win Streak Booster`

Note: practice matches and watching tournament replays are free, so players can learn the system without spending credits.

---

### Screen 7: Reward Chest
**Duration:** 5–6 minutes

Components:
- glowing chest in center
- unlock animation
- reward reveal list:
  - credits
  - cosmetic item
  - furniture piece
  - new emote
- callout text: `Legendary Neon Shelf Unlocked!`
- button: `Use it now`

Behavior:
- chest opens with sound and particles
- rewards display one-by-one
- CTA returns to room customization

---

### Screen 8: Room Customization Tutorial
**Duration:** 6–8 minutes

Components:
- room customization UI
- new shelf placement tool
- wall theme swatches
- trophy pedestal interaction
- step-by-step guide:
  1. place new shelf
  2. change wall theme
  3. put trophy on pedestal
- text: `This room grows with every victory.`

Behavior:
- interactive drag/drop or tap to place
- immediate visual update in room
- confirmation CTA: `Save room look`

---

### Screen 9: Progression Overview
**Duration:** 8–9 minutes

Components:
- collector dashboard
- current level: `Level 1 Collector`
- credits balance
- next unlock goals
- next rivals list
- daily reward preview
- progress text: `Beat 2 more rivals to unlock SilentBinder.`

Behavior:
- show progression bar
- show upcoming rewards and clear next objective

---

### Screen 10: Social & Competitive Hook
**Duration:** 9–10 minutes

Components:
- feature preview cards:
  - weekly tournaments
  - global leaderboards
  - rival rematches
  - room visits
- headline: `Your collection is your reputation.`
- CTA: `See today's leaderboard`

Behavior:
- highlight community/competitive benefits
- emphasize repeat play and identity

---

### Screen 11: Personal Goal Selection
Components:
- prompt: `What motivates you most?`
- option cards:
  - `Grow Collection Value`
  - `Win Tournaments`
  - `Find Rare Cards`
  - `Build the Ultimate Room`
- visual feedback on selection
- note: this customizes recommendations

Behavior:
- selection stores player preference
- use preference to shape future suggestions and notifications

---

### Screen 12: Daily Retention Hook
Components:
- day 2 message:
  - `Come back tomorrow to unlock the Collector Arena and a free reward chest.`
- countdown reward meter
- CTA: `Claim your return bonus`

Behavior:
- encourage next-day return
- build anticipation with a timed reward

---

## Wireframe Flow Diagram

1. **Welcome Cinematic** → `Start Your Journey`
2. **Avatar Creation** → `Confirm Avatar`
3. **Collector Room Tour** → `Place starter display case`
4. **First Scan Tutorial** → `Use demo card` or `Scan real card`
5. **Meet BinderKid** → `Challenge BinderKid`
6. **Guided Practice Match** → `Win match`
7. **Reward Chest** → `Use it now`
8. **Room Customization** → `Save room look`
9. **Progression Overview** → `Continue`
10. **Social/Competitive Hook** → `See leaderboard`
11. **Goal Selection** → `Save preference`
12. **Day 2 Preview** → `Claim return bonus`

---

## Currency System

### Primary currency: Credits 🟠

Credits are the core in-game currency for StackTrack. Players earn them through:
- Scanning cards
- Practice matches
- Tournaments
- Daily rewards
- Achievements

Players spend credits on:
- Tournament entry fees
- Cosmetics
- Room furniture
- Emotes
- Temporary boosts

This currency should be surfaced clearly in the onboarding flow, especially on screens for:
- Tournament join and entry-fee confirmation
- Reward chest openings
- Room customization purchases
- Progression and wallet summaries

For detailed balance targets and reward benchmarks, see `CREDIT_ECONOMY_BENCHMARKS.md`.

## Key UX Principles
- Keep each phase short and focused
- Reward the player at every stage
- Use visual progression to reinforce growth
- Maintain emotional momentum via celebration and reward
- Always show the next objective clearly
- Use a mix of tutorial guidance and hands-on interaction

---

## Notes for Implementation
- Use a data-driven `onboardingStep` state machine
- Each screen should be a reusable component
- Keep visual transitions smooth and cinematic
- Reward popups should feel meaningful and surprise-driven
- Save avatar and room state immediately for future sessions

---

## Suggested File / Component Structure
- `OnboardingFlow.tsx`
- `WelcomeScreen.tsx`
- `AvatarCreationScreen.tsx`
- `RoomTourScreen.tsx`
- `FirstScanScreen.tsx`
- `RivalIntroScreen.tsx`
- `PracticeMatchScreen.tsx`
- `RewardChestScreen.tsx`
- `RoomCustomizationScreen.tsx`
- `ProgressionOverviewScreen.tsx`
- `SocialPreviewScreen.tsx`
- `GoalSelectionScreen.tsx`
- `ReturnHookScreen.tsx`

---

## Recommended Data Model for Onboarding Steps
Each step should include:
- `id`
- `title`
- `description`
- `mediaType` (video, 3D, UI)
- `actions` (primary CTA, secondary CTA)
- `rewards`
- `nextStepId`
- `analyticsTag`

Example:
```json
{
  "id": "avatar_creation",
  "title": "Create Your Identity",
  "description": "Choose your look and claim a starter hoodie.",
  "mediaType": "characterPreview",
  "actions": [
    { "label": "Confirm Avatar", "type": "continue" }
  ],
  "rewards": ["starter_hoodie"],
  "nextStepId": "room_tour"
}
```

---

## Deliverable
This wireframe/UI flow is ready to be turned into the first onboarding build for StackTrack.
