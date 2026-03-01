"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminPanel from "../../../components/AdminPanel";
import { useCurrentUser } from "../../../lib/useCurrentUser";
import { isAdminEmail } from "../../../lib/adminAccess";

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!user) {
      console.log('[Admin Page] No user, redirecting to login');
      router.replace("/login");
      return;
    }

    console.log('[Admin Page] User email:', user.email, '| Is admin:', isAdminEmail(user.email));
    
    if (!isAdminEmail(user.email)) {
      console.log('[Admin Page] Not admin, redirecting to dashboard');
      router.replace("/dashboard");
      return;
    }

    console.log('[Admin Page] Admin access granted!');
    setAuthorized(true);
  }, [loading, router, user]);

  if (loading || !authorized) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "rgba(255,255,255,0.7)" }}>
        Loading...
      </div>
    );
  }

  return <AdminPanel />;
}

