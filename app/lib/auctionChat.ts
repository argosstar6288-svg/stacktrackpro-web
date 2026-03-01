// Simple Firestore chat API for real-time auction-linked chat
import { db } from "../../lib/firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  where,
} from "firebase/firestore";

export interface ChatMessage {
  id?: string;
  auctionId: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: any;
}

// Send a message to an auction chat
export async function sendAuctionMessage(auctionId: string, senderId: string, senderName: string, text: string) {
  await addDoc(collection(db, "auctionChats", auctionId, "messages"), {
    auctionId,
    senderId,
    senderName,
    text,
    createdAt: serverTimestamp(),
  });
}

// Subscribe to messages for an auction
export function subscribeToAuctionChat(auctionId: string, callback: (messages: ChatMessage[]) => void) {
  const q = query(
    collection(db, "auctionChats", auctionId, "messages"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage)));
  });
}
