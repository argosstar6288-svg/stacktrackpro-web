import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCN4I_INUKp1qyqLiATrH0HXFZU4Y5Iumg",
  authDomain: "stacktrackpro.firebaseapp.com",
  projectId: "stacktrackpro",
  storageBucket: "stacktrackpro.firebasestorage.app",
  messagingSenderId: "1043025959147",
  appId: "1:1043025959147:web:e0b19fcb3eaa54328646ae",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);
