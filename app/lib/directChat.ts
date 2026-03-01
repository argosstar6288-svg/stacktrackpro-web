// Firestore friend-to-friend chat API
import { db } from "./firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
} from "firebase/firestore";

export interface DirectMessage {
  id?: string;
  chatId: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  text: string;
  createdAt: any;
}

// Generate a unique chatId for two users (sorted)
export function getDirectChatId(userA: string, userB: string) {
  return [userA, userB].sort().join("_");
}

// Send a direct message
export async function sendDirectMessage(chatId: string, senderId: string, senderName: string, recipientId: string, text: string) {
  await addDoc(collection(db, "directChats", chatId, "messages"), {
    chatId,
    senderId,
    senderName,
    recipientId,
    text,
    createdAt: serverTimestamp(),
  });
}

// Subscribe to direct messages between two users
export function subscribeToDirectChat(chatId: string, callback: (messages: DirectMessage[]) => void) {
  const q = query(
    collection(db, "directChats", chatId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as DirectMessage)));
  });
}
