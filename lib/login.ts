import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebase";

export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}
