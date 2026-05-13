import { Timestamp } from 'firebase/firestore';

export type AvatarSlot =
  | 'head'
  | 'hair'
  | 'hat'
  | 'body'
  | 'shirt'
  | 'legs'
  | 'glowAura'
  | 'animationStyle';

export type AvatarRarity = 'common' | 'rare' | 'ultra';

export type AvatarEvent =
  | 'IDLE'
  | 'WALK'
  | 'SCAN_CARD'
  | 'PLACE_CARD'
  | 'CELEBRATE'
  | 'LOSE_REACTION'
  | 'RARE_PULL'
  | 'RANK_UP';

export interface AvatarProfile {
  id: string;
  userId: string;
  baseModelId: string;
  selectedSlots: Record<AvatarSlot, string>;
  skinTone?: string;
  animationStyleId?: string;
  glowAuraId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CosmeticItem {
  id: string;
  name: string;
  slot: AvatarSlot;
  rarity: AvatarRarity;
  meshAsset: string;
  materialAsset: string;
  animationVariantId?: string;
  effectId?: string;
  unlockCondition?: string;
  costCredits?: number;
  costPremium?: number;
  isExclusive?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AvatarRarityBehavior {
  rarity: AvatarRarity;
  glowColor?: string;
  particlePrefab?: string;
  animatedTrim?: boolean;
  effectIntensity?: number;
}

export interface RivalProfile {
  id: string;
  name: string;
  displayName: string;
  playStyle: string;
  difficultyTier: number;
  baseRewardCredits: number;
  cosmeticUnlockId?: string;
  rivalryTier: number;
  winLossRecord: {
    wins: number;
    losses: number;
  };
  badge?: string;
  lastActiveAt: Timestamp;
  ghostDataId?: string;
}

export interface RivalProgression {
  playerId: string;
  rivalId: string;
  tier: number;
  winStreak: number;
  lastResult: 'win' | 'loss' | 'draw';
  nextUnlockId?: string;
  multiplierBonus: number;
  updatedAt: Timestamp;
}

export interface GhostProfile {
  id: string;
  playerId: string;
  avgGainRate: number;
  spikeFrequency: number;
  playStyle: string;
  eventPattern: AvatarEvent[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AvatarInventory {
  playerId: string;
  ownedItemIds: string[];
  equippedSlots: Record<AvatarSlot, string>;
  defaultAnimationStyleId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AvatarReward {
  id: string;
  playerId: string;
  tournamentId?: string;
  rivalId?: string;
  creditsWon: number;
  badgeId?: string;
  unlockedCosmeticId?: string;
  streakBonus?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface EffectData {
  id: string;
  name: string;
  particlePrefab: string;
  soundClip: string;
  durationMs: number;
  tintHex?: string;
  screenFlash?: boolean;
  cameraShake?: boolean;
}

export interface RivalRewardParams {
  baseReward: number;
  difficultyMultiplier: number;
  streakBonus: number;
  bonusForBeatRival?: number;
}
