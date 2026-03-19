"use client";

import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { isAdminEmail } from "@/lib/adminAccess";

interface TopbarProps {
  onMenuToggle?: () => void;
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { user } = useCurrentUser();

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[linear-gradient(180deg,rgba(20,15,12,0.98),rgba(15,11,9,0.92))] px-4 py-4 backdrop-blur-xl md:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1600px] items-center gap-3">
        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-xl leading-none text-white md:hidden"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          ☰
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-white/10 bg-[#171211]/90 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <span className="text-lg text-white/50">⌕</span>
          <input
            placeholder="Search cards, sets, players..."
            className="w-full min-w-0 bg-transparent text-sm text-white outline-none placeholder:text-white/45"
          />
          <button
            type="button"
            onClick={() => router.push("/dashboard/discover")}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#ff7a00] text-lg font-bold text-white shadow-[0_10px_22px_rgba(255,122,0,0.32)] transition hover:bg-[#ff8c1f]"
            aria-label="Search"
          >
            ⌕
          </button>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2 md:gap-3">
          {isAdminEmail(user?.email) && (
            <button
              type="button"
              className="hidden rounded-full border border-[#ff7a00]/25 bg-[#ff7a00]/10 px-4 py-2 text-sm font-semibold text-[#ffb06b] transition hover:bg-[#ff7a00]/20 lg:inline-flex"
              onClick={() => router.push("/dashboard/admin")}
            >
              Admin
            </button>
          )}

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-xl text-white transition hover:border-[#ff7a00]/35 hover:bg-[#ff7a00]/12"
            onClick={() => router.push("/dashboard/marketplace/create")}
            aria-label="Create listing"
          >
            +
          </button>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-lg text-white transition hover:border-[#ff7a00]/35 hover:bg-[#ff7a00]/12"
            onClick={() => router.push("/dashboard/notifications")}
            aria-label="Notifications"
          >
            🔔
          </button>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-lg text-white transition hover:border-[#ff7a00]/35 hover:bg-[#ff7a00]/12"
            onClick={() => router.push("/dashboard/marketplace")}
            aria-label="Marketplace"
          >
            🛒
          </button>

          <button
            type="button"
            className="hidden items-center gap-3 rounded-2xl bg-[linear-gradient(180deg,#ff8a00,#f37300)] px-5 py-3 text-base font-semibold text-white shadow-[0_14px_28px_rgba(255,122,0,0.28)] transition hover:brightness-105 lg:inline-flex"
            onClick={() => router.push("/dashboard/scan")}
          >
            <span className="text-lg">📷</span>
            Scan Card
          </button>

          <button
            type="button"
            className="relative inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#ff7a00]/30 bg-[#241915] text-sm font-bold text-white shadow-[0_10px_22px_rgba(0,0,0,0.25)]"
            onClick={() => router.push("/dashboard/settings")}
            title="Settings"
          >
            {user?.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.photoURL}
                alt="avatar"
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              initials
            )}
            <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-[#1c1411] bg-emerald-400" />
          </button>
        </div>
      </div>
    </header>
  );
}
