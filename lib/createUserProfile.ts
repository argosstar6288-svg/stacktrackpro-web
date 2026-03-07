import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function createUserProfile(
  user: any,
  firstName: string,
  lastName: string
) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    // Calculate trial end date (30 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    await setDoc(userRef, {
      email: user.email,
      firstName,
      lastName,
      displayName: `${firstName} ${lastName}`,

      is18Confirmed: false,
      contractAccepted: false,
      contractAcceptedAt: null,

      totalCards: 0,
      totalCollectionValue: 0,
      activeAuctions: 0,

      // 30-day free trial
      subscription: {
        tier: "pro",
        status: "trialing",
        trialEndDate: Timestamp.fromDate(trialEndDate),
        renewalDate: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },

      createdAt: serverTimestamp(),
    });
  }
}

