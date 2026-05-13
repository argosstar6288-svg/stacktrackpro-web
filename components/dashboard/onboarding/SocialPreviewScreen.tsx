import type { StepProps } from './OnboardingFlow';

export default function SocialPreviewScreen({ step, onNext, onBack }: StepProps) {
  return (
    <div className="space-y-6">
      <p className="text-slate-300">{step.description}</p>
      <div className="rounded-3xl border border-slate-800/80 bg-slate-950 p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Weekly Tournaments</p>
            <p className="mt-3 text-lg font-semibold text-white">Join the next event</p>
          </div>
          <div className="rounded-3xl bg-slate-900 p-6">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Leaderboards</p>
            <p className="mt-3 text-lg font-semibold text-white">Compare your collection</p>
          </div>
        </div>
        <div className="mt-6 rounded-3xl bg-slate-900 p-6 text-slate-300">
          Share your room, challenge rivals, and see how your score stacks up across the community.
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
