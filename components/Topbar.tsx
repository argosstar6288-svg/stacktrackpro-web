"use client";

import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { isAdminEmail } from "@/lib/adminAccess";

interface TopbarProps {
  onMenuToggle?: () => void;
}

export default function Topbar({ onMenuToggle }: TopbarProps) {
  const router = useRouter();
  const { user } = useCurrentUser();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const initials = user?.displayName
    ? user.displayName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "?";

  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-white/10 bg-[#070d19] gap-3">
      {/* Left: hamburger + search */}
      <div className="flex items-center gap-3 flex-1">
        <button
          type="button"
          className="md:hidden text-white text-xl leading-none"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          ☰
        </button>

        <input
          placeholder="Search cards..."
          className="bg-white/5 border border-white/10 px-3 py-2 rounded-md outline-none w-full max-w-xl text-sm"
        />
      </div>

      {/* Right: action buttons + avatar */}
      <div className="flex items-center gap-3 shrink-0">
        {isAdminEmail(user?.email) && (
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => router.push("/dashboard/admin")}
          >
            Admin
          </button>
        )}

        <button
          type="button"
          className="btn-primary text-sm px-3 py-1.5"
          onClick={() => router.push("/scan")}
        >
          Scan
        </button>

        <button
          type="button"
          className="btn-secondary text-sm px-3 py-1.5"
          onClick={() => router.push("/dashboard/marketplace/create")}
        >
          Sell Card
        </button>

        <button
          type="button"
          className="btn-secondary text-sm px-3 py-1.5"
          onClick={handleLogout}
        >
          Log Out
        </button>

        {/* Profile avatar */}
        <button
          type="button"
          className="w-8 h-8 rounded-full bg-[#ff8f00] flex items-center justify-center text-xs font-bold text-white shrink-0"
          onClick={() => router.push("/dashboard/settings")}
          title="Settings"
        >
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt="avatar"
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            initials
          )}
        </button>
      </div>
    </div>
  );
}
