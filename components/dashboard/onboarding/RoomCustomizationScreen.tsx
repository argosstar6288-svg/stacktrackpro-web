import type { StepProps } from './OnboardingFlow';

export default function RoomCustomizationScreen({ step, onNext, onBack, creditBalance }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 text-sm text-slate-300">
        Spend credits on furniture and room upgrades. Available: <span className="font-semibold text-white">{creditBalance}</span> credits.
      </div>
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="grid gap-4 sm:grid-cols-[1fr_260px]">
          <div className="rounded-3xl bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white">Preview</h3>
            <div className="mt-4 h-64 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-950" />
          </div>
          <div className="space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-5">
            <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-left text-slate-200">Place Shelf</button>
            <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-left text-slate-200">Change Wall Theme</button>
            <button className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-left text-slate-200">Add Trophy</button>
          </div>
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
