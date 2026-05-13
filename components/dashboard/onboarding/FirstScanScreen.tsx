import type { StepProps } from './OnboardingFlow';

export default function FirstScanScreen({ step, onNext, onBack, creditBalance }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-800/80 bg-slate-900/80 p-4 text-sm text-slate-300">
        Your credits: <span className="font-semibold text-white">{creditBalance}</span>. Earn more by scanning your first card.
      </div>
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <button className="rounded-3xl border border-slate-700 bg-slate-900 px-5 py-6 text-left text-slate-200">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Demo Card</p>
            <p className="mt-3 text-lg font-semibold text-white">Instant onboarding</p>
          </button>
          <button className="rounded-3xl border border-slate-700 bg-slate-900 px-5 py-6 text-left text-slate-200">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Scan Real Card</p>
            <p className="mt-3 text-lg font-semibold text-white">Use your camera</p>
          </button>
        </div>
        <div className="rounded-3xl bg-slate-900 p-5 text-sm text-slate-400">Choose the quick start option or scan a physical card to continue. The demo path is ideal for first-time players.</div>
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
