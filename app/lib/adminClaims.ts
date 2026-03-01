import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

/**
 * ADMIN CUSTOM CLAIMS MANAGEMENT
 * 
 * This module requires Cloud Functions backend to actually set custom claims.
 * Custom claims must be set via admin SDK (not client SDK).
 * 
 * Cloud Function example (functions/index.js):
 * 
 * exports.setAdminClaim = functions.https.onCall(async (data, context) => {
 *   if (!context.auth || !context.auth.token.admin) {
 *     throw new Error("Only admins can set claims");
 *   }
 *   await admin.auth().setCustomUserClaims(data.uid, {
 *     admin: true,
 *     permissions: data.permissions
 *   });
 *   return { success: true };
 * });
 */

export interface CustomClaims {
  admin?: boolean;
  moderator?: boolean;
  canCreateAuctions?: boolean;
  canViewAnalytics?: boolean;
  canManageUsers?: boolean;
  [key: string]: any;
}

// Set custom claims (requires Cloud Function and admin role)
export async function setCustomClaims(
  targetUserId: string,
  claims: CustomClaims
) {
  try {
    // This function needs to be called from a Cloud Function
    // Client-side auth cannot set custom claims directly
    const setClaimsFunction = httpsCallable(functions, "setCustomClaims");
    
    const result = await setClaimsFunction({
      uid: targetUserId,
      claims,
    });

    // Also update Firestore for quick access
    await updateDoc(doc(db, "users", targetUserId), {
      customClaims: claims,
      updatedAt: serverTimestamp(),
    });

    return result.data;
  } catch (error) {
    console.error("Error setting custom claims:", error);
    throw error;
  }
}

// Promote user to admin
export async function promoteToAdmin(userId: string) {
  return setCustomClaims(userId, {
    admin: true,
    canCreateAuctions: true,
    canViewAnalytics: true,
    canManageUsers: true,
  });
}

// Promote user to moderator
export async function promoteToModerator(userId: string) {
  return setCustomClaims(userId, {
    moderator: true,
    canCreateAuctions: true,
    canViewAnalytics: false,
  });
}

// Remove admin role
export async function revokeAdminRole(userId: string) {
  return setCustomClaims(userId, {
    admin: false,
    moderator: false,
    canCreateAuctions: false,
    canViewAnalytics: false,
    canManageUsers: false,
  });
}

// Get user's custom claims
export async function getUserCustomClaims(userId: string): Promise<CustomClaims | null> {
  try {
    const userDoc = await getDoc(doc(db, "users", userId));
    return userDoc.data()?.customClaims || null;
  } catch (error) {
    console.error("Error fetching custom claims:", error);
    return null;
  }
}

// Check if user has specific permission
export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const claims = await getUserCustomClaims(userId);
  return claims?.[permission] === true;
}
