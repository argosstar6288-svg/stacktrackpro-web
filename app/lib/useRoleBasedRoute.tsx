"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useCurrentUser } from "./useCurrentUser";

export type UserRole = "admin" | "moderator" | "free" | "pro" | "premium";

export interface UserWithRole {
  uid: string;
  email: string;
  role: UserRole;
  customClaims?: Record<string, any>;
}

export function useRoleBasedRoute(requiredRoles: UserRole[]) {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const fetchUserRole = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const role = userDoc.data()?.role || "free";
            setUserRole(role);
            setIsAuthorized(requiredRoles.includes(role));
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setIsAuthorized(false);
        } finally {
          setRoleLoading(false);
        }
      };

      fetchUserRole();
    } else if (!loading && !user) {
      setRoleLoading(false);
      router.push("/login");
    }
  }, [user, loading, requiredRoles, router]);

  return {
    userRole,
    isAuthorized,
    loading: loading || roleLoading,
  };
}

// HOC for protecting pages by role
export function withRoleProtection(
  Component: React.ComponentType,
  requiredRoles: UserRole[]
) {
  return function ProtectedComponent(props: any) {
    const { isAuthorized, loading } = useRoleBasedRoute(requiredRoles);
    const router = useRouter();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!isAuthorized) {
      return (
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h1>Access Denied</h1>
          <p>You don't have permission to access this page.</p>
          <button onClick={() => router.push("/dashboard")}>
            Go to Dashboard
          </button>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
