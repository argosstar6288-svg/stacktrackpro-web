import type { StepProps } from './OnboardingFlow';

export default function RoomTourScreen({ step, onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="aspect-[16/9] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-800" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">Display Shelves</div>
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4">Neon Lighting</div>
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
