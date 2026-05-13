import type { StepProps } from './OnboardingFlow';

export default function AvatarCreationScreen({ step, onNext, onBack, isFirst }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-slate-300">{step.description}</p>
      <div className="grid gap-4 rounded-3xl border border-slate-800/80 bg-slate-950 p-8 sm:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Avatar Preview</p>
            <div className="mt-6 h-56 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm text-slate-200">Face</button>
            <button className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm text-slate-200">Hair</button>
            <button className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm text-slate-200">Jacket</button>
            <button className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-sm text-slate-200">Shoes</button>
          </div>
        </div>
        <div className="space-y-4 rounded-3xl border border-slate-800/80 bg-slate-900 p-6">
          <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Starter Theme</p>
          <div className="space-y-3">
            <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-left text-slate-200">Casual Collector</button>
            <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-left text-slate-200">Street Trader</button>
            <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-left text-slate-200">Neon Pro</button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={onBack} disabled={isFirst} className="rounded-full border border-slate-700 px-5 py-3 text-sm text-slate-400 transition hover:border-slate-500">
          Back
        </button>
        <button type="button" onClick={onNext} className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
          {step.primaryLabel}
        </button>
      </div>
    </div>
  );
}
