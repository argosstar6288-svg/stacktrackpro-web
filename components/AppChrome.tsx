"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import GlobalImageLightbox from "@/components/GlobalImageLightbox";
import { shouldUseInternalChrome } from "@/lib/appChromeRoutes";
import { useCurrentUser } from "@/lib/useCurrentUser";

export default function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!shouldUseInternalChrome(pathname)) return;
    if (!loading && !user) {
      router.replace("/auth");
    }
  }, [loading, user, pathname, router]);

  if (!shouldUseInternalChrome(pathname)) {
    return <>{children}</>;
  }

  // Prevent flash of protected content while resolving auth
  if (loading || !user) {
    return null;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0907] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,122,0,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(255,122,0,0.1),transparent_28%),linear-gradient(180deg,#14110f_0%,#0b0908_100%)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-[320px] bg-[radial-gradient(circle_at_bottom_left,rgba(255,106,0,0.18),transparent_45%)] opacity-90" />
      <div className="pointer-events-none absolute right-0 top-24 h-[420px] w-[420px] rounded-full bg-[#ff7a00]/[0.08] blur-3xl" />

      <div className="relative flex min-h-screen">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenuToggle={() => setSidebarOpen((open) => !open)} />
          <main className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-5 lg:px-8 lg:py-6">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>

      <GlobalImageLightbox />
    </div>
  );
}
