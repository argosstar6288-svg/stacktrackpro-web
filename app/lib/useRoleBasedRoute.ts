"use client";

import { useEffect, useState, ReactElement, ComponentType, createElement } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "../../lib/useCurrentUser";
import { isAdminEmail } from "../../lib/adminAccess";

type AllowedRole = "admin" | string;

export function withRoleProtection(
  Component: ComponentType<any>,
  allowedRoles: AllowedRole[]
) {
  return function ProtectedRoute() {
    const router = useRouter();
    const { user, loading } = useCurrentUser();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
      if (loading) {
        return;
      }

      if (!user) {
        console.log('[Admin Route] No user, redirecting to login');
        router.replace("/login");
        return;
      }

      const requiresAdmin = allowedRoles.includes("admin");
      console.log('[Admin Route] User email:', user.email, '| Requires admin:', requiresAdmin);
      
      if (requiresAdmin && !isAdminEmail(user.email)) {
        console.log('[Admin Route] Not admin, redirecting to dashboard');
        router.replace("/dashboard");
        return;
      }

      console.log('[Admin Route] Access granted');
      setAuthorized(true);
    }, [allowedRoles, loading, router, user]);

    if (loading || !authorized) {
      return null;
    }

    return createElement(Component);
  } as ComponentType<any>;
}


