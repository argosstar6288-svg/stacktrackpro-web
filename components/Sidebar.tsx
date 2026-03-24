"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { auth } from "@/lib/firebase";
import { isAdminEmail } from "@/lib/adminAccess";
import { signOut } from "firebase/auth";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/dashboard/collection", label: "My Collection", icon: "▣" },
  { href: "/dashboard/marketplace", label: "Marketplace", icon: "◫" },
  { href: "/auctions/live", label: "Auctions", icon: "◌" },
  { href: "/dashboard/watchlist", label: "Watchlist", icon: "♡" },
  { href: "/dashboard/inbox", label: "Messages", icon: "✉" },
  { href: "/dashboard/share", label: "Flex Share", icon: "⬗" },
  { href: "/dashboard/users", label: "Find Users", icon: "⌕" },
  { href: "/dashboard/pricing", label: "Pricing", icon: "◈" },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙" },
];

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useCurrentUser();

  const handleLogout = async () => {
    await signOut(auth);
    onClose?.();
    router.push("/login");
  };

  const sidebarItems = isAdminEmail(user?.email)
    ? [...navItems, { href: "/dashboard/admin", label: "Admin", icon: "✦" }]
    : navItems;

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[270px] flex-col border-r border-white/10 bg-[linear-gradient(180deg,rgba(26,19,15,0.98)_0%,rgba(18,13,11,0.98)_45%,rgba(12,9,8,0.98)_100%)] text-white shadow-[0_0_30px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div className="flex flex-col">
            <span className="text-[2rem] font-black leading-none tracking-[-0.05em] text-white">
              STACK<span className="text-[#ff7a00]">TRACK</span>
            </span>
            <span className="mt-1 text-xs uppercase tracking-[0.35em] text-white/40">collector os</span>
          </div>
          <button
            type="button"
            className="text-2xl leading-none text-white/60 hover:text-white md:hidden"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-4 py-5">
          {sidebarItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-[linear-gradient(90deg,rgba(255,122,0,0.22),rgba(255,122,0,0.08))] text-[#ff9b3d] shadow-[inset_0_0_0_1px_rgba(255,122,0,0.24),0_10px_24px_rgba(0,0,0,0.18)]"
                    : "text-white/75 hover:bg-white/[0.04] hover:text-white"
                }`}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm transition-all ${
                  isActive
                    ? "border-[#ff7a00]/40 bg-[#ff7a00]/20 text-[#ff9b3d]"
                    : "border-white/10 bg-white/[0.03] text-white/65 group-hover:border-[#ff7a00]/25 group-hover:text-[#ff9b3d]"
                }`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/75 transition hover:border-[#ff7a00]/30 hover:bg-[#ff7a00]/10 hover:text-white"
          >
            Log Out
          </button>
        </div>
      </aside>
    </>
  );
}
