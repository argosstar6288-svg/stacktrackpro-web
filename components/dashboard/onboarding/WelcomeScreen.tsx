import type { OnboardingStep } from '@/lib/onboarding-steps';
import type { StepProps } from './OnboardingFlow';

export default function WelcomeScreen({ step, onNext, isFirst, creditBalance }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="mb-6 rounded-3xl bg-slate-900 p-4 text-sm text-slate-300">
          Starting wallet: <span className="font-semibold text-white">{creditBalance} credits</span>
        </div>
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-sky-600/15 to-violet-600/15 p-6 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-sky-200">Welcome</p>
          <h2 className="mt-3 text-2xl font-semibold text-white">Your journey begins now.</h2>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-sky-400"
        >
          {step.primaryLabel}
        </button>
      </div>
    </div>
  );
}
