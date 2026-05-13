import type { StepProps } from './OnboardingFlow';

export default function RivalIntroScreen({ step, onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="flex flex-col gap-5 rounded-3xl bg-slate-900 p-6 sm:flex-row sm:items-center">
          <div className="h-28 w-28 rounded-3xl bg-gradient-to-br from-fuchsia-500 to-sky-500" />
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Rival</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">BinderKid</h3>
            <p className="mt-2 text-sm text-slate-300">Difficulty: Rookie • Play Style: Steady Collector</p>
          </div>
        </div>
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
          "Hey! Think your collection can beat mine? This match helps you learn how scoring and leaderboards work."
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
