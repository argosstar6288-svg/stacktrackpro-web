import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function createUserProfile(
  user: any,
  firstName: string,
  lastName: string
) {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
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

      createdAt: serverTimestamp(),
    });
  }
}

