import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";
import { createUserProfile } from "../../lib/createUserProfile";

// PASSWORD STRENGTH VALIDATION
export function validatePasswordStrength(password: string): {
  isStrong: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("Password must be at least 8 characters.");
  }
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter.");
  }
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter.");
  }
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number.");
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push("Password must contain at least one special character (!@#$%^&* etc).");
  }

  return {
    isStrong: errors.length === 0,
    errors,
  };
}

// SIGN UP
export async function signUp(email: string, password: string, firstName: string, lastName: string) {
  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isStrong) {
    throw new Error(passwordValidation.errors.join(" "));
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedFirstName = firstName.trim();
  const normalizedLastName = lastName.trim();

  try {
    const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);

    // Send verification email
    await sendEmailVerification(cred.user);

    // Create Firestore profile (includes 30-day trial)
    await createUserProfile(cred.user, normalizedFirstName, normalizedLastName);

    return cred.user;
  } catch (err: any) {
    const code = err?.code as string | undefined;

    if (code === "auth/email-already-in-use") {
      throw new Error("That email is already in use. Try logging in instead.");
    }

    if (code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    }

    if (code === "auth/operation-not-allowed") {
      throw new Error("Email/password signup is currently disabled.");
    }

    if (code === "auth/network-request-failed") {
      throw new Error("Network error. Check your connection and try again.");
    }

    if (code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait a few minutes and try again.");
    }

    if (code === "auth/weak-password") {
      throw new Error("Password is too weak. Use a stronger password.");
    }

    if (code === "permission-denied") {
      throw new Error("Account created, but profile setup was blocked. Try logging in once; if it persists, contact support.");
    }

    throw new Error(err?.message || "Failed to create account. Please try again.");
  }
}

// LOGIN
export async function logIn(email: string, password: string) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // Temporarily disabled for testing - uncomment to require email verification
  // if (!userCredential.user.emailVerified) {
  //   throw new Error("Please verify your email before logging in.");
  // }
  
  return userCredential.user;
}

export async function logOut() {
  await signOut(auth);
}
