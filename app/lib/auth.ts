import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  User
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

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

  const cred = await createUserWithEmailAndPassword(auth, email, password);

  // Send verification email
  await sendEmailVerification(cred.user);

  // Create enhanced Firestore profile
  await setDoc(doc(db, "users", cred.user.uid), {
    uid: cred.user.uid,
    email,
    firstName,
    lastName,
    role: "free",
    subscription: {
      tier: "free",
      status: "active",
      renewalDate: null,
      stripeCustomerId: null,
    },
    twoFactorAuth: {
      enabled: false,
      phoneNumber: null,
      method: null, // "sms" or "email"
    },
    emailVerified: false,
    onboardingComplete: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return cred.user;
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
