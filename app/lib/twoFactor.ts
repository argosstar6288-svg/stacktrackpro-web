import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// Initialize 2FA setup process
export async function initiate2FA(userId: string, method: "sms" | "email") {
  const userDoc = await getDoc(doc(db, "users", userId));
  
  if (!userDoc.exists()) {
    throw new Error("User not found");
  }

  // In production, you'd send SMS via Twilio or email verification
  // For now, we just update the profile to reflect setup intent
  await updateDoc(doc(db, "users", userId), {
    "twoFactorAuth.method": method,
    "twoFactorAuth.setupInProgress": true,
    updatedAt: serverTimestamp(),
  });

  return { success: true, message: `2FA setup initiated via ${method}` };
}

// Enable 2FA after user confirms code
export async function enable2FA(userId: string, code: string) {
  const userDoc = await getDoc(doc(db, "users", userId));
  
  if (!userDoc.exists()) {
    throw new Error("User not found");
  }

  // In production, validate code with SMS/email provider
  await updateDoc(doc(db, "users", userId), {
    "twoFactorAuth.enabled": true,
    "twoFactorAuth.setupInProgress": false,
    updatedAt: serverTimestamp(),
  });

  return { success: true, message: "2FA enabled successfully" };
}

// Verify 2FA code during login
export async function verify2FACode(userId: string, code: string): Promise<boolean> {
  const userDoc = await getDoc(doc(db, "users", userId));
  
  if (!userDoc.exists()) {
    throw new Error("User not found");
  }

  const userData = userDoc.data();
  
  if (!userData?.twoFactorAuth?.enabled) {
    return true; // 2FA not enabled, skip check
  }

  // In production, validate against SMS/email provider as well
  // For now, we just verify the code format (6 digits)
  if (!/^\d{6}$/.test(code)) {
    throw new Error("Invalid verification code format");
  }

  return true;
}

// Disable 2FA
export async function disable2FA(userId: string) {
  await updateDoc(doc(db, "users", userId), {
    "twoFactorAuth.enabled": false,
    "twoFactorAuth.method": null,
    updatedAt: serverTimestamp(),
  });

  return { success: true, message: "2FA disabled" };
}

// Generate backup codes for account recovery
export async function generateBackupCodes(userId: string): Promise<string[]> {
  const codes = Array.from({ length: 10 }, () =>
    Math.random().toString(36).substring(2, 10).toUpperCase()
  );

  await updateDoc(doc(db, "users", userId), {
    "twoFactorAuth.backupCodes": codes,
    updatedAt: serverTimestamp(),
  });

  return codes;
}
