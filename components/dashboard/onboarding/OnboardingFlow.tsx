"use client";

import { useMemo, useState } from 'react';
import { ONBOARDING_STEPS, type OnboardingStep } from '@/lib/onboarding-steps';
import { formatCredits } from '@/lib/credits';
import AvatarCreationScreen from './AvatarCreationScreen';
import FirstScanScreen from './FirstScanScreen';
import GoalSelectionScreen from './GoalSelectionScreen';
import PracticeMatchScreen from './PracticeMatchScreen';
import ProgressionOverviewScreen from './ProgressionOverviewScreen';
import RaceAwardScreen from './RewardChestScreen';
import RivalIntroScreen from './RivalIntroScreen';
import RoomCustomizationScreen from './RoomCustomizationScreen';
import RoomTourScreen from './RoomTourScreen';
import ReturnHookScreen from './ReturnHookScreen';
import SocialPreviewScreen from './SocialPreviewScreen';
import WelcomeScreen from './WelcomeScreen';

const stepComponents: Record<OnboardingStep['id'], React.ComponentType<StepProps>> = {
  welcome: WelcomeScreen,
  avatar_creation: AvatarCreationScreen,
  room_tour: RoomTourScreen,
  first_scan: FirstScanScreen,
  rival_intro: RivalIntroScreen,
  practice_match: PracticeMatchScreen,
  reward_chest: RaceAwardScreen,
  room_customization: RoomCustomizationScreen,
  progression_overview: ProgressionOverviewScreen,
  social_preview: SocialPreviewScreen,
  goal_selection: GoalSelectionScreen,
  return_hook: ReturnHookScreen,
};

export interface StepProps {
  step: OnboardingStep;
  onNext: () => void;
  onBack: () => void;
  isFirst: boolean;
  isLast: boolean;
  creditBalance: number;
}

export default function OnboardingFlow() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [creditBalance, setCreditBalance] = useState(1250);
  const step = ONBOARDING_STEPS[activeIndex];
  const StepComponent = stepComponents[step.id];

  const progress = useMemo(() => Math.round(((activeIndex + 1) / ONBOARDING_STEPS.length) * 100), [activeIndex]);

  const handleNext = () => {
    setActiveIndex((current) => Math.min(current + 1, ONBOARDING_STEPS.length - 1));
  };

  const handleBack = () => {
    setActiveIndex((current) => Math.max(current - 1, 0));
  };

  return (
    <section className="mx-auto max-w-7xl rounded-3xl border border-slate-800/80 bg-slate-900/90 p-6 shadow-2xl sm:p-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.32em] text-sky-300">Onboarding</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">{step.title}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Progress</p>
          <p className="text-lg font-semibold text-white">{progress}%</p>
        </div>
      </div>

      <div className="mb-4 rounded-3xl border border-slate-800/80 bg-slate-900/90 p-4 text-sm text-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-white">Wallet</span>
          <span className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.2em] text-sky-300">{formatCredits(creditBalance)}</span>
        </div>
        <p className="mt-2 text-slate-400">Credits are used for entry fees, cosmetics, furniture, emotes, and boosts.</p>
      </div>

      <StepComponent
        step={step}
        onNext={handleNext}
        onBack={handleBack}
        isFirst={activeIndex === 0}
        isLast={activeIndex === ONBOARDING_STEPS.length - 1}
        creditBalance={creditBalance}
      />
    </section>
  );
}
