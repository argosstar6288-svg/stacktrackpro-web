export type OnboardingStepId =
  | 'welcome'
  | 'avatar_creation'
  | 'room_tour'
  | 'first_scan'
  | 'rival_intro'
  | 'practice_match'
  | 'reward_chest'
  | 'room_customization'
  | 'progression_overview'
  | 'social_preview'
  | 'goal_selection'
  | 'return_hook';

export interface OnboardingStep {
  id: OnboardingStepId;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Track. Compete. Build Your Collector Empire.',
    description: 'Scan cards, grow your collection, and battle rivals in a living virtual world.',
    primaryLabel: 'Start Your Journey',
  },
  {
    id: 'avatar_creation',
    title: 'Create Your Identity',
    description: 'Choose your look and claim a starter hoodie.',
    primaryLabel: 'Confirm Avatar',
  },
  {
    id: 'room_tour',
    title: 'Your Collector Room',
    description: 'This is your space. Every card you scan appears here.',
    primaryLabel: 'Place Starter Case',
  },
  {
    id: 'first_scan',
    title: 'Add Your First Card',
    description: 'Scan a real card or use a demo card to get started instantly.',
    primaryLabel: 'Use Demo Card',
    secondaryLabel: 'Scan Real Card',
  },
  {
    id: 'rival_intro',
    title: 'Meet BinderKid',
    description: 'A friendly rival who wants to test your collection.',
    primaryLabel: 'Challenge BinderKid',
  },
  {
    id: 'practice_match',
    title: 'Guided Practice Match',
    description: 'Compete in your first mini tournament and learn the leaderboard.',
    primaryLabel: 'Start Match',
  },
  {
    id: 'reward_chest',
    title: 'Reward Chest',
    description: 'Open your chest and claim new items for your room.',
    primaryLabel: 'Open Chest',
  },
  {
    id: 'room_customization',
    title: 'Customize Your Room',
    description: 'Place new furniture and decorate your space.',
    primaryLabel: 'Apply Customization',
  },
  {
    id: 'progression_overview',
    title: 'Collector Progression',
    description: 'Track your level, credits, and upcoming unlocks.',
    primaryLabel: 'Continue',
  },
  {
    id: 'social_preview',
    title: 'Social & Competitive Features',
    description: 'See what tournaments, leaderboards, and rival rematches are coming.',
    primaryLabel: 'View Leaderboard',
  },
  {
    id: 'goal_selection',
    title: 'What Motivates You?',
    description: 'Choose the path that fits your collector style.',
    primaryLabel: 'Save Preference',
  },
  {
    id: 'return_hook',
    title: 'Come Back Tomorrow',
    description: 'Unlock the Collector Arena and claim a free reward chest.',
    primaryLabel: 'Claim Return Bonus',
  },
];
