import {
  AvatarEvent,
  AvatarReward,
  RivalProfile,
  RivalRewardParams,
  AvatarRarity,
  CosmeticItem,
  RivalProgression,
} from './avatar-types';

export function calculateReward(params: RivalRewardParams): number {
  const streakMultiplier = params.streakBonus > 0 ? 1 + params.streakBonus : 1;
  const bonus = params.bonusForBeatRival ? params.bonusForBeatRival : 0;
  return Math.max(
    0,
    Math.floor(params.baseReward * params.difficultyMultiplier * streakMultiplier + bonus)
  );
}

export function isUltraCosmetic(item: CosmeticItem): boolean {
  return item.rarity === 'ultra';
}

export function getEventEffectName(event: AvatarEvent): string {
  switch (event) {
    case 'RARE_PULL':
      return 'RarePullEffect';
    case 'RANK_UP':
      return 'RankUpPulse';
    case 'SCAN_CARD':
      return 'ScanBurst';
    case 'PLACE_CARD':
      return 'PlaceGlow';
    case 'LOSE_REACTION':
      return 'RivalPassFlash';
    default:
      return 'DefaultAvatarEffect';
  }
}

export function getCosmeticUnlockForRival(rival: RivalProfile): string | null {
  return rival.cosmeticUnlockId || null;
}

export function getRivalProgressionReward(
  rival: RivalProfile,
  progression: RivalProgression
): RivalRewardParams {
  const streakBonus = progression.winStreak * 0.05;
  return {
    baseReward: rival.baseRewardCredits,
    difficultyMultiplier: 1 + rival.difficultyTier * 0.1,
    streakBonus,
    bonusForBeatRival: rival.difficultyTier * 10,
  };
}

export function buildAvatarEventPayload(event: AvatarEvent, playerId: string) {
  return {
    type: 'AVATAR_EVENT',
    playerId,
    event,
    timestamp: Date.now(),
  };
}
