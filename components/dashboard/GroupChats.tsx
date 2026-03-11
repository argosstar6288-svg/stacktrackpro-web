"use client";

import { useState } from "react";

const chatGroups = [
  {
    id: "general",
    name: "🌎 General",
    icon: "🌎",
    members: 47,
    lastMessage: "Jamie Fox: Just joined the community! 👋",
    lastTime: "1m",
    unread: 3,
  },
  {
    id: "baseball",
    name: "⚾ Baseball",
    icon: "⚾",
    members: 34,
    lastMessage: "Derek Jeter: Trading some Yankees cards 🗽",
    lastTime: "5m",
    unread: 1,
  },
  {
    id: "basketball",
    name: "🏀 Basketball",
    icon: "🏀",
    members: 29,
    lastMessage: "Kobe Fan: Anyone have Kobe cards? 💛💜",
    lastTime: "8m",
    unread: 0,
  },
  {
    id: "football",
    name: "🏈 Football",
    icon: "🏈",
    members: 22,
    lastMessage: "Tom Brady: Patriots collection for sale! 🏆",
    lastTime: "20m",
    unread: 0,
  },
  {
    id: "trading",
    name: "💱 Trading",
    icon: "💱",
    members: 18,
    lastMessage: "Card Trader: Fair trades only! 🤝",
    lastTime: "30m",
    unread: 2,
  },
];

const groupMessagesData: Record<string, any[]> = {
  general: [
    { id: 1, user: "Alex Rivera", avatar: "AR", message: "Just pulled a rookie card! 🎉", time: "2m" },
    { id: 2, user: "Sam Taylor", avatar: "ST", message: "Anyone selling Pokémon cards? 🔍", time: "5m" },
    { id: 3, user: "Jordan Lee", avatar: "JL", message: "Check out my new listing in marketplace 🔥", time: "12m" },
    { id: 10, user: "Jamie Fox", avatar: "JF", message: "Just joined the community! 👋", time: "1h" },
  ],
  baseball: [
    { id: 4, user: "Casey Morgan", avatar: "CM", message: "Great deals on vintage baseball cards! ⚾", time: "18m" },
    { id: 11, user: "Mike Trout", avatar: "MT", message: "Looking for vintage Topps cards", time: "10m" },
    { id: 12, user: "Derek Jeter", avatar: "DJ", message: "Trading some Yankees cards 🗽", time: "22m" },
  ],
  basketball: [
    { id: 6, user: "Morgan Blake", avatar: "MB", message: "Looking for LeBron rookies 🏀", time: "32m" },
    { id: 13, user: "Kobe Fan", avatar: "KF", message: "Anyone have Kobe cards? 💛💜", time: "8m" },
    { id: 14, user: "Jordan Collector", avatar: "JC", message: "MJ cards never go out of style! 🐐", time: "15m" },
  ],
  football: [
    { id: 8, user: "Chris Evans", avatar: "CE", message: "Trading some football cards 🏈", time: "45m" },
    { id: 15, user: "Tom Brady", avatar: "TB", message: "Patriots collection for sale! 🏆", time: "20m" },
  ],
  trading: [
    { id: 9, user: "Dana White", avatar: "DW", message: "Best prices in town! 💰", time: "1h" },
    { id: 16, user: "Deal Hunter", avatar: "DH", message: "Looking to trade soccer cards ⚽", time: "30m" },
    { id: 17, user: "Card Trader", avatar: "CT", message: "Fair trades only! 🤝", time: "50m" },
  ],
};

const quickEmojis = ["👍", "🔥", "⚾", "🏀", "🏈", "⚽", "🎉", "💯", "😊", "❤️", "🎴", "🃏"];

export default function GroupChats() {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupMessages, setGroupMessages] = useState(groupMessagesData);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const selectedGroup = chatGroups.find((g) => g.id === selectedGroupId);
  const messages = selectedGroupId ? groupMessages[selectedGroupId] || [] : [];

  const sendMessage = () => {
    if (!newMessage.trim() || !selectedGroupId) return;

    const message = {
      id: Date.now(),
      user: "You",
      avatar: "YO",
      message: newMessage,
      time: "now",
    };

    setGroupMessages({
      ...groupMessages,
      [selectedGroupId]: [message, ...messages],
    });
    setNewMessage("");
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage();
  };

  const handleGroupInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    sendMessage();
  };

  const handleDeleteGroupMessage = (messageId: number) => {
    if (!selectedGroupId) return;
    setGroupMessages((current) => ({
      ...current,
      [selectedGroupId]: (current[selectedGroupId] || []).filter((msg) => msg.id !== messageId),
    }));
  };

  const addEmoji = (emoji: string) => {
    setNewMessage(newMessage + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <div className="group-chats-container">
      {/* Group List */}
      <div className="group-list">
        <div className="group-list-header">
          <h3>Group Chats</h3>
          <button className="create-group-btn" title="Create Group">+</button>
        </div>
        <div className="group-items">
          {chatGroups.map((group) => (
            <button
              key={group.id}
              className={`group-item ${selectedGroupId === group.id ? "active" : ""}`}
              onClick={() => setSelectedGroupId(group.id)}
            >
              <div className="group-icon">{group.icon}</div>
              <div className="group-info">
                <div className="group-name-row">
                  <span className="group-name">{group.name}</span>
                  <span className="group-time">{group.lastTime}</span>
                </div>
                <div className="group-last-message">{group.lastMessage}</div>
                <div className="group-meta">
                  <span className="group-members">{group.members} members</span>
                  {group.unread > 0 && (
                    <span className="group-unread">{group.unread}</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat View */}
      <div className="group-chat-view">
        {selectedGroup ? (
          <>
            <div className="group-chat-header">
              <div>
                <h3>{selectedGroup.name}</h3>
                <p className="group-chat-members">{selectedGroup.members} members</p>
              </div>
              <button className="group-info-btn" title="Group Info">ℹ️</button>
            </div>

            <div className="group-messages">
              {messages.map((msg) => (
                <div key={msg.id} className="group-message">
                  <div className="group-msg-avatar">{msg.avatar}</div>
                  <div className="group-msg-content">
                    <div className="group-msg-header">
                      <span className="group-msg-user">{msg.user}</span>
                      <div className="group-msg-actions">
                        <span className="group-msg-time">{msg.time}</span>
                        {msg.user === "You" && (
                          <button
                            type="button"
                            className="group-msg-delete-btn"
                            onClick={() => handleDeleteGroupMessage(msg.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="group-msg-text">{msg.message}</p>
                  </div>
                </div>
              ))}
            </div>

            <form className="group-input-form" onSubmit={handleSendMessage}>
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
              <div className="group-input-wrapper">
                <input
                  type="text"
                  className="group-input"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleGroupInputKeyDown}
                />
                <button
                  type="button"
                  className="emoji-toggle-btn"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                >
                  😊
                </button>
              </div>
              <button type="submit" className="group-send-btn">
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="group-empty-state">
            <div className="empty-icon">💬</div>
            <h3>Select a Group Chat</h3>
            <p>Choose a group from the list to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}
