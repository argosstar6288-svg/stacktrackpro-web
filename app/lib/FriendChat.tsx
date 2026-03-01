"use client";
import { useEffect, useState } from "react";
import { useCurrentUser } from "../lib/useCurrentUser";
import { getDirectChatId, sendDirectMessage, subscribeToDirectChat, DirectMessage } from "../lib/directChat";

interface FriendChatProps {
  friendId: string;
  friendName: string;
}

export function FriendChat({ friendId, friendName }: FriendChatProps) {
  const { user } = useCurrentUser();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const chatId = user && friendId ? getDirectChatId(user.uid, friendId) : "";

  useEffect(() => {
    if (!chatId) return;
    const unsub = subscribeToDirectChat(chatId, setMessages);
    return () => unsub();
  }, [chatId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user) {
      setError("Login required");
      return;
    }
    if (!input.trim()) return;
    try {
      await sendDirectMessage(
        chatId,
        user.uid,
        user.displayName || user.email || "User",
        friendId,
        input.trim()
      );
      setInput("");
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    }
  }

  return (
    <div style={{background:'#181818', borderRadius:10, padding:20, maxWidth:400}}>
      <h3 style={{color:'#10b3f0', marginBottom:10}}>Chat with {friendName}</h3>
      <div style={{maxHeight:200, overflowY:'auto', marginBottom:10, background:'#222', borderRadius:6, padding:10}}>
        {messages.length === 0 ? (
          <div style={{color:'#888'}}>No messages yet.</div>
        ) : (
          <ul style={{listStyle:'none', padding:0, margin:0}}>
            {messages.map(msg => (
              <li key={msg.id} style={{marginBottom:8, color: msg.senderId === user?.uid ? '#10b3f0' : '#fff'}}>
                <span style={{fontWeight:'bold'}}>{msg.senderName}:</span> {msg.text}
                <span style={{fontSize:'0.8em', color:'#aaa', marginLeft:8}}>
                  {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString() : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <form onSubmit={handleSend} style={{display:'flex', gap:8}}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Message..."
          style={{flex:1, padding:8, borderRadius:4, border:'1px solid #333', background:'#111', color:'#fff'}}
          disabled={!user}
        />
        <button type="submit" style={{padding:'8px 16px', borderRadius:4, background:'#10b3f0', color:'#000', border:'none', fontWeight:'bold'}} disabled={!user || !input.trim()}>
          Send
        </button>
      </form>
      {error && <div style={{color:'red', marginTop:6}}>{error}</div>}
    </div>
  );
}
