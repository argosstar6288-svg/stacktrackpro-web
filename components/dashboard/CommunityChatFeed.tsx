"use client";

import { useState } from "react";

const initialMessages = [
  { id: 1, user: "Alex Rivera", avatar: "AR", message: "Just pulled a rookie card! 🎉", time: "2m" },
  { id: 2, user: "Sam Taylor", avatar: "ST", message: "Anyone selling Pokémon cards? 🔍", time: "5m" },
  { id: 3, user: "Jordan Lee", avatar: "JL", message: "Check out my new listing in marketplace 🔥", time: "12m" },
  { id: 4, user: "Casey Morgan", avatar: "CM", message: "Great deals on vintage baseball cards! ⚾", time: "18m" },
  { id: 5, user: "Riley Quinn", avatar: "RQ", message: "Who's watching the game tonight? 📺", time: "25m" },
  { id: 6, user: "Morgan Blake", avatar: "MB", message: "Looking for LeBron rookies 🏀", time: "32m" },
  { id: 7, user: "Taylor Swift", avatar: "TS", message: "My collection is growing! 💪", time: "40m" },
  { id: 8, user: "Chris Evans", avatar: "CE", message: "Trading some football cards 🏈", time: "45m" },
  { id: 9, user: "Dana White", avatar: "DW", message: "Best prices in town! 💰", time: "1h" },
  { id: 10, user: "Jamie Fox", avatar: "JF", message: "Just joined the community! 👋", time: "1h" },
];

const quickEmojis = ["👍", "🔥", "⚾", "🏀", "🏈", "⚽", "🎉", "💯", "😊", "❤️", "🎴", "🃏"];

export default function CommunityChatFeed() {
  const [messages, setMessages] = useState(initialMessages);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const message = {
      id: Date.now(),
      user: "You",
      avatar: "YO",
      message: newMessage,
      time: "now",
    };

    setMessages([message, ...messages]);
    setNewMessage("");
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(newMessage + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Community Chat</h2>
          <p className="panel-subtitle">Connect with collectors</p>
        </div>
        <span className="online-badge">🟢 {Math.floor(Math.random() * 50) + 20} online</span>
      </div>
      
      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className="chat-message">
              <div className="chat-avatar">{msg.avatar}</div>
              <div className="chat-content">
                <div className="chat-header">
                  <span className="chat-user">{msg.user}</span>
                  <span className="chat-time">{msg.time}</span>
                </div>
                <p className="chat-text">{msg.message}</p>
              </div>
            </div>
          ))}
        </div>
        
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          {showEmojiPicker && (
            <div className="emoji-picker">
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="emoji-btn"
                  onClick={() => addEmoji(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
          <div className="chat-input-wrapper">
            <input
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              type="button"
              className="emoji-toggle-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              😊
            </button>
          </div>
          <button type="submit" className="chat-send-btn">
            Send
          </button>
        </form>
      </div>
    </section>
  );
}
