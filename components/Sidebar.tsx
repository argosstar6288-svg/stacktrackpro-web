"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { isAdminEmail } from "@/lib/adminAccess";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const navItems = [
  { href: "/dashboard", label: "🏠 Dashboard", icon: null },
  { href: "/scan",       label: "📷 Scan Card",  icon: null },
  { href: "/collection", label: "📦 Collection", icon: null },
  { href: "/dashboard/inbox", label: "💬 Inbox", icon: null },
  { href: "/marketplace",label: "🛒 Marketplace",icon: null },
  { href: "/auctions",   label: "⚡ Auctions",   icon: null },
];

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useCurrentUser();

  const sidebarItems = isAdminEmail(user?.email)
    ? [...navItems, { href: "/dashboard/admin", label: "🛡️ Admin", icon: null }]
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
        className={`fixed left-0 top-0 z-50 h-screen w-64 bg-black text-white flex flex-col border-r border-white/10 transform transition-transform duration-200 md:static md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <span className="text-xl font-bold text-[#ff8f00] tracking-tight">StackTrack</span>
          <button
            type="button"
            className="md:hidden text-2xl leading-none text-white/60 hover:text-white"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            ×
          </button>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {sidebarItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`sidebar-item text-sm font-medium ${
                  isActive ? "sidebar-active" : "text-white/70"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer hint */}
        <div className="p-4 border-t border-white/10 text-xs text-white/30">
          StackTrack Pro
        </div>
      </aside>
    </>
  );
}
