"use client";

import { useEffect, useState } from "react";
import { useCurrentUser } from "./useCurrentUser";
import { getUserPermissions, RoleFeatures, hasPermission } from "./roleManager";

export function useFeatureAccess() {
  const { user, loading } = useCurrentUser();
  const [permissions, setPermissions] = useState<RoleFeatures | null>(null);
  const [permLoading, setPermLoading] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      const fetchPermissions = async () => {
        try {
          const perms = await getUserPermissions(user.uid);
          setPermissions(perms);
        } catch (error) {
          console.error("Error fetching permissions:", error);
        } finally {
          setPermLoading(false);
        }
      };

      fetchPermissions();
    } else if (!loading && !user) {
      setPermLoading(false);
    }
  }, [user, loading]);

  const canAccess = async (feature: keyof RoleFeatures): Promise<boolean> => {
    if (!user) return false;
    return hasPermission(user.uid, feature);
  };

  return {
    permissions,
    loading: loading || permLoading,
    canAccess,
    user,
  };
}

// Feature gate HOC
export function withFeatureGate(
  Component: React.ComponentType<any>,
  requiredFeature: keyof RoleFeatures
) {
  return function FeatureGatedComponent(props: any) {
    const { permissions, loading } = useFeatureAccess();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!permissions) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", backgroundColor: "#f5f5f5", borderRadius: "8px" }}>
          <h3>Feature Not Available</h3>
          <p>You need to upgrade your plan to access this feature.</p>
        </div>
      );
    }

    const permission = permissions[requiredFeature];
    
    // Check if permission is granted
    let hasAccess = false;
    if (typeof permission === "boolean") {
      hasAccess = permission;
    } else if (typeof permission === "number") {
      hasAccess = permission !== 0;
    }

    if (!hasAccess) {
      return (
        <div style={{ padding: "2rem", textAlign: "center", backgroundColor: "#fff3cd", border: "1px solid #ffc107", borderRadius: "8px" }}>
          <h3>Premium Feature Required</h3>
          <p>Upgrade to Pro or Premium to unlock this feature.</p>
          <button
            onClick={() => window.location.href = "/dashboard/settings"}
            style={{
              padding: "10px 20px",
              backgroundColor: "#10b3f0",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              marginTop: "10px"
            }}
          >
            View Plans
          </button>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
