/**
 * Referral Tiers & Perks System
 * Automatic tier progression based on referral count
 */

export interface ReferralTier {
  level: number;
  name: string;
  minReferrals: number;
  bonusPerReferral: number; // in cents
  perks: string[];
  badge: string;
  color: string;
}

export interface ReferralPerk {
  id: string;
  name: string;
  description: string;
  unlockedAt: number; // referral count threshold
  type: "badge" | "feature" | "priority" | "exclusive";
}

/**
 * Tiered referral structure
 * Bonuses increase as you refer more people
 */
export const REFERRAL_TIERS: Record<number, ReferralTier> = {
  1: {
    level: 1,
    name: "Emerging",
    minReferrals: 1,
    bonusPerReferral: 5000, // $50
    perks: [
      "Standard Support",
      "Share Referral Code",
      "Referral Stats Dashboard",
    ],
    badge: "🌱",
    color: "#10b34099",
  },
  2: {
    level: 2,
    name: "Rising",
    minReferrals: 3,
    bonusPerReferral: 7500, // $75
    perks: [
      "$75 Per Referral",
      "Priority Support (Email)",
      "Exclusive Referrer Badge",
      "Featured on Wall",
    ],
    badge: "⭐",
    color: "#ffc10799",
  },
  3: {
    level: 3,
    name: "Influencer",
    minReferrals: 5,
    bonusPerReferral: 10000, // $100
    perks: [
      "$100 Per Referral",
      "Priority Support (Chat)",
      "Influencer Badge",
      "VIP Leaderboard Placement",
      "Early Feature Access",
    ],
    badge: "🏆",
    color: "#ff980099",
  },
  4: {
    level: 4,
    name: "Ambassador",
    minReferrals: 10,
    bonusPerReferral: 15000, // $150
    perks: [
      "$150 Per Referral",
      "24/7 Priority Support",
      "Ambassador Badge",
      "Top Leaderboard Placement",
      "Beta Feature Access",
      "Custom Branded Referral Link",
      "Monthly Bonus Multiplier",
    ],
    badge: "👑",
    color: "#ff0099ff",
  },
};

/**
 * Unlock perks based on referral count
 */
export const REFERRAL_PERKS: ReferralPerk[] = [
  {
    id: "share_code",
    name: "Share & Earn",
    description: "Share your unique referral code and earn $50 per friend",
    unlockedAt: 1,
    type: "feature",
  },
  {
    id: "priority_email",
    name: "Priority Email Support",
    description: "Your support tickets are prioritized",
    unlockedAt: 3,
    type: "priority",
  },
  {
    id: "referrer_badge",
    name: "Referrer Badge",
    description: "Exclusive badge displayed on your profile",
    unlockedAt: 3,
    type: "badge",
  },
  {
    id: "priority_chat",
    name: "Priority Chat Support",
    description: "Direct chat support with priority queue",
    unlockedAt: 5,
    type: "priority",
  },
  {
    id: "early_access",
    name: "Early Feature Access",
    description: "Access new features 2 weeks before general release",
    unlockedAt: 5,
    type: "feature",
  },
  {
    id: "custom_link",
    name: "Custom Referral Link",
    description: "Create branded links like yourname.invites.stacktrackpro.com",
    unlockedAt: 10,
    type: "feature",
  },
  {
    id: "24_7_support",
    name: "24/7 Premium Support",
    description: "Round-the-clock support with <1hr response time",
    unlockedAt: 10,
    type: "priority",
  },
  {
    id: "monthly_bonus",
    name: "Monthly Bonus Multiplier",
    description: "Earn 1.5x bonus on all referrals during bonus month",
    unlockedAt: 10,
    type: "exclusive",
  },
];

/**
 * Get user's current tier based on completed referrals
 */
export function getUserReferralTier(completedReferrals: number): ReferralTier {
  // Find the highest tier the user qualifies for
  const tiers = Object.values(REFERRAL_TIERS).sort((a, b) => b.minReferrals - a.minReferrals);
  
  for (const tier of tiers) {
    if (completedReferrals >= tier.minReferrals) {
      return tier;
    }
  }
  
  // Default to tier 1 if no referrals
  return REFERRAL_TIERS[1];
}

/**
 * Get unlocked perks for a user
 */
export function getUnlockedPerks(completedReferrals: number): ReferralPerk[] {
  return REFERRAL_PERKS.filter(perk => completedReferrals >= perk.unlockedAt);
}

/**
 * Get next tier milestone
 */
export function getNextTierMilestone(completedReferrals: number): {
  tierLevel: number;
  referralsNeeded: number;
  reward: string;
} | null {
  const sortedTiers = Object.values(REFERRAL_TIERS)
    .sort((a, b) => a.minReferrals - b.minReferrals)
    .reverse();

  for (const tier of sortedTiers) {
    if (completedReferrals < tier.minReferrals) {
      return {
        tierLevel: tier.level,
        referralsNeeded: tier.minReferrals - completedReferrals,
        reward: `$${(tier.bonusPerReferral / 100).toFixed(0)} per referral`,
      };
    }
  }

  return null; // Already at max tier
}

/**
 * Calculate total bonus with tiered rates
 */
export function calculateTotalBonus(completedReferrals: number): number {
  let totalBonus = 0;
  const tier1Bonus = REFERRAL_TIERS[1].bonusPerReferral;
  const tier2Bonus = REFERRAL_TIERS[2].bonusPerReferral;
  const tier3Bonus = REFERRAL_TIERS[3].bonusPerReferral;
  const tier4Bonus = REFERRAL_TIERS[4].bonusPerReferral;

  if (completedReferrals >= 10) {
    totalBonus += (completedReferrals - 10) * tier4Bonus + 5 * tier3Bonus + 2 * tier2Bonus + 1 * tier1Bonus;
  } else if (completedReferrals >= 5) {
    totalBonus += (completedReferrals - 5) * tier3Bonus + 2 * tier2Bonus + 1 * tier1Bonus;
  } else if (completedReferrals >= 3) {
    totalBonus += (completedReferrals - 3) * tier2Bonus + 1 * tier1Bonus;
  } else if (completedReferrals >= 1) {
    totalBonus += completedReferrals * tier1Bonus;
  }

  return totalBonus;
}

/**
 * Calculate bonus for next referral
 */
export function getNextReferralBonus(completedReferrals: number): number {
  const tier = getUserReferralTier(completedReferrals);
  return tier.bonusPerReferral;
}

/**
 * Format tier display
 */
export function formatTierBadge(completedReferrals: number): string {
  const tier = getUserReferralTier(completedReferrals);
  return `${tier.badge} ${tier.name}`;
}

/**
 * Get leaderboard rank (simplified - counts completed referrals)
 */
export function getLeaderboardRank(completedReferrals: number): "Ambassador" | "Influencer" | "Rising" | "Emerging" {
  if (completedReferrals >= 10) return "Ambassador";
  if (completedReferrals >= 5) return "Influencer";
  if (completedReferrals >= 3) return "Rising";
  return "Emerging";
}
