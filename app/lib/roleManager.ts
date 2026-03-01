import { doc, getDoc, updateDoc, serverTimestamp, writeBatch, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type UserRole = "free" | "pro" | "premium" | "founder" | "admin" | "moderator";

export interface RoleFeatures {
  canCreateAuctions: boolean;
  canListCards: number; // unlimited = -1
  canAccessMarketplace: boolean;
  canAccessAnalytics: boolean;
  canAccessFolders: boolean;
  canAccessPortfolioNotes: boolean;
  canAccessAdvancedSearch: boolean;
  can2FA: boolean;
  canAccessAPI: boolean;
  advertisingFree: boolean;
  monthlyExportLimit: number; // 0 = none, -1 = unlimited
}

export const ROLE_PERMISSIONS: Record<UserRole, RoleFeatures> = {
  free: {
    canCreateAuctions: false,
    canListCards: 100,
    canAccessMarketplace: true,
    canAccessAnalytics: false,
    canAccessFolders: false,
    canAccessPortfolioNotes: false,
    canAccessAdvancedSearch: false,
    can2FA: true,
    canAccessAPI: false,
    advertisingFree: false,
    monthlyExportLimit: 0,
  },
  pro: {
    canCreateAuctions: true,
    canListCards: 1000,
    canAccessMarketplace: true,
    canAccessAnalytics: true,
    canAccessFolders: true,
    canAccessPortfolioNotes: true,
    canAccessAdvancedSearch: true,
    can2FA: true,
    canAccessAPI: false,
    advertisingFree: true,
    monthlyExportLimit: 12,
  },
  premium: {
    canCreateAuctions: true,
    canListCards: -1,
    canAccessMarketplace: true,
    canAccessAnalytics: true,
    canAccessFolders: true,
    canAccessPortfolioNotes: true,
    canAccessAdvancedSearch: true,
    can2FA: true,
    canAccessAPI: true,
    advertisingFree: true,
    monthlyExportLimit: -1,
  },
  founder: {
    canCreateAuctions: true,
    canListCards: -1,
    canAccessMarketplace: true,
    canAccessAnalytics: true,
    canAccessFolders: true,
    canAccessPortfolioNotes: true,
    canAccessAdvancedSearch: true,
    can2FA: true,
    canAccessAPI: true,
    advertisingFree: true,
    monthlyExportLimit: -1,
  },
  admin: {
    canCreateAuctions: true,
    canListCards: -1,
    canAccessMarketplace: true,
    canAccessAnalytics: true,
    canAccessFolders: true,
    canAccessPortfolioNotes: true,
    canAccessAdvancedSearch: true,
    can2FA: true,
    canAccessAPI: true,
    advertisingFree: true,
    monthlyExportLimit: -1,
  },
  moderator: {
    canCreateAuctions: true,
    canListCards: -1,
    canAccessMarketplace: true,
    canAccessAnalytics: true,
    canAccessFolders: true,
    canAccessPortfolioNotes: true,
    canAccessAdvancedSearch: true,
    can2FA: true,
    canAccessAPI: false,
    advertisingFree: true,
    monthlyExportLimit: 12,
  },
};

/**
 * Get user's role
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      return userDoc.data()?.role || "free";
    }
    return "free";
  } catch (error) {
    console.error("Error fetching user role:", error);
    return "free";
  }
}

/**
 * Get user's role permissions
 */
export async function getUserPermissions(userId: string): Promise<RoleFeatures> {
  const role = await getUserRole(userId);
  return ROLE_PERMISSIONS[role];
}

/**
 * Check if user has specific permission
 */
export async function hasPermission(userId: string, permission: keyof RoleFeatures): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  const value = permissions[permission];
  
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0; // 0 means disabled, -1 and positive numbers are enabled
  }
  return false;
}

/**
 * Upgrade user role (requires admin privileges in Firestore rules)
 */
export async function upgradeUserRole(userId: string, newRole: UserRole): Promise<void> {
  const validRoles: UserRole[] = ["free", "pro", "premium"];
  
  if (!validRoles.includes(newRole)) {
    throw new Error(`Cannot upgrade to role: ${newRole}`);
  }

  await updateDoc(doc(db, "users", userId), {
    role: newRole,
    "subscription.tier": newRole,
    "subscription.status": "active",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Downgrade user role
 */
export async function downgradeUserRole(userId: string, newRole: UserRole): Promise<void> {
  const validRoles: UserRole[] = ["free", "pro", "premium"];
  
  if (!validRoles.includes(newRole)) {
    throw new Error(`Cannot downgrade to role: ${newRole}`);
  }

  await updateDoc(doc(db, "users", userId), {
    role: newRole,
    "subscription.tier": newRole,
    updatedAt: serverTimestamp(),
  });
}

/**
 * ADMIN FUNCTIONS
 */

/**
 * Promote user to admin (admin only)
 */
export async function promoteUserToAdmin(userId: string): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    role: "admin",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Promote user to moderator (admin only)
 */
export async function promoteUserToModerator(userId: string): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    role: "moderator",
    updatedAt: serverTimestamp(),
  });
}

/**
 * Revoke admin/moderator status (admin only)
 */
export async function revokeAdminStatus(userId: string, downgradeToRole: UserRole = "free"): Promise<void> {
  const validRoles: UserRole[] = ["free", "pro", "premium"];
  
  if (!validRoles.includes(downgradeToRole)) {
    throw new Error(`Invalid downgrade role: ${downgradeToRole}`);
  }

  await updateDoc(doc(db, "users", userId), {
    role: downgradeToRole,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all admins (admin only)
 */
export async function getAllAdmins(): Promise<Array<{ uid: string; email: string; firstName: string; lastName: string }>> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "admin"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email,
      firstName: doc.data().firstName,
      lastName: doc.data().lastName,
    }));
  } catch (error) {
    console.error("Error fetching admins:", error);
    return [];
  }
}

/**
 * Get all moderators (admin only)
 */
export async function getAllModerators(): Promise<Array<{ uid: string; email: string; firstName: string; lastName: string }>> {
  try {
    const q = query(collection(db, "users"), where("role", "==", "moderator"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      email: doc.data().email,
      firstName: doc.data().firstName,
      lastName: doc.data().lastName,
    }));
  } catch (error) {
    console.error("Error fetching moderators:", error);
    return [];
  }
}

/**
 * Get all users with pagination (admin only)
 */
export async function getAllUsers(pageSize: number = 50, startAfterDoc?: any): Promise<any[]> {
  try {
    const q = collection(db, "users");
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      uid: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

/**
 * Get user stats for admin dashboard
 */
export async function getUserStats(): Promise<{
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  premiumUsers: number;
  adminUsers: number;
  moderatorUsers: number;
}> {
  try {
    const allUsers = await getAllUsers();
    return {
      totalUsers: allUsers.length,
      freeUsers: allUsers.filter(u => u.role === "free").length,
      proUsers: allUsers.filter(u => u.role === "pro").length,
      premiumUsers: allUsers.filter(u => u.role === "premium").length,
      adminUsers: allUsers.filter(u => u.role === "admin").length,
      moderatorUsers: allUsers.filter(u => u.role === "moderator").length,
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return {
      totalUsers: 0,
      freeUsers: 0,
      proUsers: 0,
      premiumUsers: 0,
      adminUsers: 0,
      moderatorUsers: 0,
    };
  }
}

/**
 * Suspend/unsuspend user account (admin only)
 */
export async function toggleUserSuspension(userId: string, suspended: boolean): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    suspended,
    suspendedAt: suspended ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Check if user is a founding member (lifetime)
 */
export async function isFoundingMember(userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData?.role === "founder" || userData?.subscription?.isLifetime === true;
    }
    return false;
  } catch (error) {
    console.error("Error checking founding member status:", error);
    return false;
  }
}

/**
 * Safely downgrade user role, protecting founder accounts
 * Founder accounts can only be downgraded by admin via separate function
 */
export async function safeDowngradeRole(userId: string, newRole: UserRole): Promise<boolean> {
  try {
    // Check if user is a founder
    const isFounder = await isFoundingMember(userId);
    
    if (isFounder && newRole !== "founder") {
      console.warn(`Prevented downgrade of founder account ${userId} to ${newRole}`);
      return false; // Founder cannot be downgraded
    }

    await updateDoc(doc(db, "users", userId), {
      role: newRole,
      updatedAt: serverTimestamp(),
    });

    return true;
  } catch (error) {
    console.error("Error downgrading user role:", error);
    return false;
  }
}

/**
 * Admin-only: Force downgrade any user including founders
 * Should only be called with proper admin context verification
 */
export async function forceDowngradeRole(userId: string, newRole: UserRole): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    role: newRole,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete user data (admin only)
 */
export async function deleteUserData(userId: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete user profile
  batch.delete(doc(db, "users", userId));

  // Could add more deletion logic here (cards, auctions, etc.)

  await batch.commit();
}
