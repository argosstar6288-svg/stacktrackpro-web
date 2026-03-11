"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gradient-to-br from-[#050914] via-[#0b1322] to-[#050a12] overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onMenuToggle={() => setSidebarOpen((previous) => !previous)} />
        <main className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
