import type { StepProps } from './OnboardingFlow';

export default function ReturnHookScreen({ step, onBack, isLast }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="rounded-3xl bg-slate-900 p-6 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Day 2 Reward</p>
          <h3 className="mt-3 text-3xl font-semibold text-white">Collector Arena Access</h3>
          <p className="mt-4 text-slate-300">Come back tomorrow and claim your free return bonus chest.</p>
        </div>
        <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-900 p-5 text-slate-300">
          {isLast ? 'You’re ready for the next step. Your room, rival list, and tournament access are waiting.' : 'Unlock the next stage when you return.'}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-400 transition hover:border-slate-500">
          Back
        </button>
        <button type="button" className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
          {step.primaryLabel}
        </button>
      </div>
    </div>
  );
}
