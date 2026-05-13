# Avatar System Design

## 1. Overview
This document defines the avatar system, cosmetic rarity model, animation/effects pipeline, economy integration, rival progression, and Unity data asset structure.

The goal: a server-driven avatar system with client-side visual assets, event mapping, and backend reward logic.

---

## 2. Avatar Entity Model

### AvatarProfile
Stored per player and used to build the in-game avatar.

Fields:
- `id: string`
- `userId: string`
- `baseModelId: string`
- `selectedSlots: Record<AvatarSlot, string>`
- `gender?: string`
- `skinTone?: string`
- `animationStyleId?: string`
- `glowAuraId?: string`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

### AvatarSlot
Defined slots for customization:
- `head`
- `hair`
- `hat`
- `body`
- `shirt`
- `legs`
- `glowAura`
- `animationStyle`

### CosmeticItem
Defines a cosmetic asset and rarity.

Fields:
- `id: string`
- `name: string`
- `slot: AvatarSlot`
- `rarity: "common" | "rare" | "ultra"`
- `meshAsset: string` (Unity asset key/path)
- `materialAsset: string`
- `animationVariantId?: string`
- `effectId?: string`
- `unlockCondition?: string`
- `costCredits?: number`
- `costPremium?: number`
- `isExclusive?: boolean`
- `createdAt: Timestamp`
- `updatedAt: Timestamp`

### AvatarRarityBehavior
Rarity maps to visual behavior:
- `common` = static clothing
- `rare` = animated trims, subtle motion
- `ultra` = glow, particle trails, particle aura

### RivalProfile
Rival identities that connect to the avatar and economy loop.

Fields:
- `id: string`
- `name: string`
- `type: string`
- `playStyle: string`
- `difficultyTier: number`
- `baseRewardCredits: number`
- `cosmeticUnlockId?: string`
- `rivalryTier: number`
- `winLossRecord: { wins: number, losses: number }`
- `badge?: string`
- `lastActiveAt: Timestamp`
- `ghostDataId?: string`

### GhostProfile
Future replay bot profile.

Fields:
- `id: string`
- `playerId: string`
- `avgGainRate: number`
- `spikeFrequency: number`
- `playStyle: string`
- `eventPattern: string[]`
- `createdAt: Timestamp`

---

## 3. Unity Data Asset Layout

### ScriptableObjects
Use Unity `ScriptableObject` assets to define the avatar system.

#### CosmeticItemData
Fields:
- `string id`
- `string displayName`
- `AvatarSlot slot`
- `Rarity rarity`
- `GameObject prefab`
- `Material material`
- `AnimationClip[] bonusAnimations`
- `EffectData effect`
- `int costCredits`
- `int costPremium`
- `bool unlockOnRivalWin`
- `string unlockRivalId`

#### AvatarSlotData
Fields:
- `AvatarSlot slot`
- `Transform attachPoint`
- `GameObject defaultPrefab`

#### AvatarAnimationData
Fields:
- `string id`
- `AnimationClip idle`
- `AnimationClip walk`
- `AnimationClip scanCard`
- `AnimationClip placeCard`
- `AnimationClip celebrate`
- `AnimationClip loseReaction`
- `AnimationClip rarePull`
- `AnimationClip rankUp`

#### AvatarRarityData
Fields:
- `Rarity rarity`
- `Color glowColor`
- `ParticleSystem particlePrefab`
- `bool hasAnimatedTrim`
- `float effectIntensity`

#### EffectData
Fields:
- `string id`
- `ParticleSystem particleSystem`
- `AudioClip sound`
- `float duration`
- `Color tint`
- `bool screenFlash`
- `bool cameraShake`

#### RivalProfileData
Fields:
- `string id`
- `string displayName`
- `RivalPlayStyle playStyle`
- `int difficultyTier`
- `int baseRewardCredits`
- `AvatarStyleData avatarStyle`
- `string[] signatureEvents`

### Prefab Structure
Create a base avatar prefab with attach points for every slot.
- `AvatarRoot`
  - `Body`
  - `Head`
  - `HairAnchor`
  - `HatAnchor`
  - `TorsoAnchor`
  - `LegsAnchor`
  - `GlowAnchor`
  - `AnimationRig`
  - `EffectAnchor`

The avatar prefab holds the `Animator` and the `AvatarController` component.

### Animator Controller
States:
- `Idle`
- `Walk`
- `ScanCard`
- `PlaceCard`
- `Celebrate`
- `LoseReaction`
- `RarePull`
- `RankUp`

Transitions driven by event triggers.

---

## 4. Unity Runtime API

### AvatarController
```csharp
public class AvatarController : MonoBehaviour
{
    public Animator animator;
    public ParticleSystem glowEffect;

    public void PlayIdle() => animator.Play("Idle");
    public void PlayWalk() => animator.Play("Walk");
    public void ScanCard() => animator.SetTrigger("Scan");
    public void PlaceCard() => animator.SetTrigger("Place");
    public void Celebrate() => animator.SetTrigger("Celebrate");
    public void LoseReaction() => animator.SetTrigger("Lose");
    public void RarePull() => animator.SetTrigger("RarePull");
    public void RankUp() => animator.SetTrigger("RankUp");

    public void ApplyGlow(Color color)
    {
        if (glowEffect == null) return;
        var main = glowEffect.main;
        main.startColor = color;
        glowEffect.Play();
    }
}
```

### AvatarCustomizationManager
```csharp
public class AvatarCustomizationManager : MonoBehaviour
{
    public AvatarController avatarController;
    public AvatarSlotData[] slotDefinitions;

    public void ApplyCustomization(AvatarProfileData profile)
    {
        foreach (var slot in slotDefinitions)
        {
            var itemId = profile.GetItemForSlot(slot.slot);
            var itemData = CosmeticDatabase.GetItem(itemId);
            if (itemData != null)
            {
                slot.AttachItem(itemData.prefab);
                if (itemData.effect != null)
                    avatarController.ApplyGlow(itemData.effect.tint);
            }
        }
    }
}
```

---

## 5. Event Mapping
Map game events to avatar animations and effects.

| Event | Avatar | Effect | Sound |
|---|---|---|---|
| Rare Pull | `RarePull()` | explosion + glow | hit sound |
| Rank Up | `RankUp()` | pulse + upward motion | chime |
| Rival Pass | `LoseReaction()` | red flash | impact |
| Scan Card | `ScanCard()` | scan burst | scan click |

Example trigger:
```csharp
public void TriggerEvent(string eventName)
{
    switch (eventName)
    {
        case "RARE_PULL":
            avatarController.RarePull();
            effectSystem.Play("RarePull");
            cameraController.ZoomIn();
            break;
        case "RANK_UP":
            avatarController.RankUp();
            effectSystem.Play("RankUp");
            break;
    }
}
```

---

## 6. Economy Model

### Currencies
- `credits`
- `premiumCurrency` (optional later)

### Spend
- Tournament entry fees
- Cosmetic purchases
- Room upgrades
- animation packs

### Reward Types
- base win credits
- top-3 bonus
- rival beat multiplier
- streak chest

### Reward formula
```js
const reward = baseReward * difficultyMultiplier * streakBonus;
```
Example:
- `baseReward = 100`
- `difficultyMultiplier = 1.25`
- `streakBonus = 1 + streakCount * 0.05`

---

## 7. Rival & Economy Integration

Beating a rival should deliver:
- extra credits
- cosmetic unlock or fragment progress
- rivalry tier increase
- win streak boost

This creates a powerful loop:
- emotional investment in rivals
- financial reward for performance
- unlockable cosmetics tied to rival progression

### RivalProgression entity
Fields:
- `playerId`
- `rivalId`
- `tier`
- `winStreak`
- `lastResult`
- `nextUnlockId?`
- `multiplierBonus`

---

## 8. Backend Data Schema

### AvatarInventory
- `playerId`
- `ownedItemIds: string[]`
- `equippedSlots: Record<AvatarSlot, string>`
- `defaultStyle`

### Cosmetic definitions collection
- `cosmeticItems/{id}`
- maintain rarity, cost, unlocks, effect references

### Rival collection
- `rivals/{id}`
- store profile metadata, reward mapping, unlock item

### Ghost profiles collection
- `ghosts/{id}`
- store playback-specific behavior metadata

---

## 9. Unity Asset Directory Structure

Suggested folder layout:
- `Assets/Avatars/Models/`
- `Assets/Avatars/Prefabs/`
- `Assets/Avatars/ScriptableObjects/`
  - `Cosmetics/`
  - `Animations/`
  - `Effects/`
  - `Rivals/`
- `Assets/Avatars/Materials/`
- `Assets/Avatars/Textures/`
- `Assets/Avatars/Particles/`

---

## 10. Build Roadmap
- Week 1–2: backend match engine + leaderboard
- Week 3–4: Unity UI + live feed + bot personalities
- Week 5–6: avatar system + animations
- Week 7–8: effects + polish

---

## 11. Implementation Notes
- Keep cosmetics data driven via ScriptableObjects
- Keep avatar assembly modular with attach points
- Keep bots server-side and send only event/state updates to client
- Use rarity to drive both visuals and reward gating
- Build rival victory as both financial and cosmetic progression
