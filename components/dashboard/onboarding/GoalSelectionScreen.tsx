import type { StepProps } from './OnboardingFlow';

export default function GoalSelectionScreen({ step, onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-slate-300">{step.description}</p>
      <div className="grid gap-4 rounded-3xl border border-slate-800/80 bg-slate-950 p-6 sm:grid-cols-2">
        <button className="rounded-3xl border border-slate-700 bg-slate-900 p-6 text-left text-slate-200">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Grow Collection Value</p>
          <p className="mt-3 text-lg font-semibold text-white">Focus on rare finds</p>
        </button>
        <button className="rounded-3xl border border-slate-700 bg-slate-900 p-6 text-left text-slate-200">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Win Tournaments</p>
          <p className="mt-3 text-lg font-semibold text-white">Chase leaderboard glory</p>
        </button>
        <button className="rounded-3xl border border-slate-700 bg-slate-900 p-6 text-left text-slate-200">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Find Rare Cards</p>
          <p className="mt-3 text-lg font-semibold text-white">Hunt exclusive drops</p>
        </button>
        <button className="rounded-3xl border border-slate-700 bg-slate-900 p-6 text-left text-slate-200">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Build the Ultimate Room</p>
          <p className="mt-3 text-lg font-semibold text-white">Customize your space</p>
        </button>
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
