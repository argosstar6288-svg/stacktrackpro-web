import type { StepProps } from './OnboardingFlow';

export default function ProgressionOverviewScreen({ step, onNext, onBack, creditBalance }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 text-sm text-slate-300">
        Credit balance: <span className="font-semibold text-white">{creditBalance}</span>. Use credits to enter tournaments or buy cosmetics.
      </div>
      <p className="text-slate-300">{step.description}</p>
      <div className="grid gap-4 rounded-3xl border border-slate-800/80 bg-slate-950 p-8 sm:grid-cols-2">
        <div className="rounded-3xl bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Level</p>
          <p className="mt-3 text-3xl font-semibold text-white">Level 1 Collector</p>
          <p className="mt-2 text-sm text-slate-400">Next unlock: SilentBinder in 2 rivals</p>
        </div>
        <div className="rounded-3xl bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Wallet</p>
          <p className="mt-3 text-3xl font-semibold text-white">750 Credits</p>
          <p className="mt-2 text-sm text-slate-400">Daily reward preview included</p>
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
