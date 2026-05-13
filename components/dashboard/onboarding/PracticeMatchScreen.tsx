import type { StepProps } from './OnboardingFlow';

export default function PracticeMatchScreen({ step, onNext, onBack, creditBalance }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 text-sm text-slate-300">
        This NPC practice match is free to play. Learn the leaderboard and build confidence before spending credits. Current wallet: <span className="font-semibold text-white">{creditBalance}</span>.
      </div>
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Player Score</p>
            <p className="mt-3 text-4xl font-semibold text-white">125</p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-5">
            <p className="text-sm text-slate-400">BinderKid Score</p>
            <p className="mt-3 text-4xl font-semibold text-white">118</p>
          </div>
        </div>
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
          This guided practice match shows how cards, bonuses, and leaderboard points combine in a real contest.
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-400 transition hover:border-slate-500">
          Back
        </button>
        <button type="button" onClick={onNext} className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
          {step.primaryLabel}
        </button>
      </div>
    </div>
  );
}
