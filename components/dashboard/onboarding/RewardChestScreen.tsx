import type { StepProps } from './OnboardingFlow';

export default function RewardChestScreen({ step, onNext, onBack, creditBalance }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 text-sm text-slate-300">
        Your wallet after the chest: <span className="font-semibold text-white">{creditBalance} credits</span>.
      </div>
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="rounded-3xl bg-slate-900 p-6 text-center">
          <div className="mx-auto mb-5 h-28 w-28 rounded-full bg-gradient-to-br from-orange-500 to-fuchsia-500" />
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Reward Chest</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Exclusive Starter Loot</h3>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-center text-slate-200">+500 Credits</div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-center text-slate-200">Starter Hoodie</div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 text-center text-slate-200">Room Shelf</div>
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
