"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  type KeyboardEvent,
} from "react";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useCurrentUser } from "../../../lib/useCurrentUser";
import GroupChats from "../../../components/dashboard/GroupChats";
import styles from "./inbox.module.css";

type ThreadSummary = {
  id: string;
  otherUserId: string;
  name: string;
  handle: string;
  lastMessage: string;
  lastTimestamp: number;
  status: string;
  unread: number;
};

type ChatMessage = {
  id: string;
  body: string;
  time: string;
  mine: boolean;
};

const formatTime = (value: number) =>
  new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));

const formatRelative = (value: number) => {
  const diff = Math.max(0, Date.now() - value);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const getStatusLabelFromTimestamp = (timestamp: number) => {
  if (!timestamp) return "Active";
  const diff = Date.now() - timestamp;
  if (diff <= 5 * 60 * 1000) return "Online";
  return `Last active ${formatRelative(timestamp)}`;
};

const normalizeRecipientId = (value: string) => value.trim().replace(/^@/, "");

export default function InboxPage() {
  const { user, loading } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<"direct" | "groups">("direct");
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeError, setComposeError] = useState("");
  const [sendingCompose, setSendingCompose] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ uid: string; displayName: string; email: string }>>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; sender?: string } | null>(null);
  const previousMessagesLengthRef = useRef(0);

  const searchUsers = useCallback(
    async (query: string) => {
      if (!user || query.length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const response = await fetch(
          `/api/search-users?q=${encodeURIComponent(query)}&currentUserId=${user.uid}`
        );
        const data = await response.json();
        setSearchResults(data.results || []);
      } catch (error) {
        console.error("Error searching users:", error);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [user]
  );

  const loadRecommendedUsers = useCallback(async () => {
    if (!user) return;

    try {
      const response = await fetch(
        `/api/search-users?recommendations=true&currentUserId=${user.uid}`
      );
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error("Error loading recommended users:", error);
      setSearchResults([]);
    }
  }, [user]);

  const handleOpenCompose = () => {
    setComposeOpen(true);
    loadRecommendedUsers();
  };

  const handleSelectUser = (userId: string, displayName: string) => {
    setComposeRecipient(userId);
    setSelectedUserId(userId);
    setSearchResults([]);
  };

  const showNotification = useCallback(
    (message: string, sender?: string) => {
      // Show in-app notification
      setNotification({ message, sender });
      setTimeout(() => setNotification(null), 5000);

      // Request browser notification permission and show desktop notification
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(sender ? `Message from ${sender}` : "New Message", {
          body: message.substring(0, 50) + (message.length > 50 ? "..." : ""),
          icon: "/stacktrack-logo.png",
          tag: "stacktrack-message",
        });
      }
    },
    []
  );

  // Request notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    setLoadingThreads(true);
    try {
      const messagesRef = collectionGroup(db, "messages");
      const [sentSnap, receivedSnap] = await Promise.all([
        getDocs(query(messagesRef, where("senderId", "==", user.uid))),
        getDocs(query(messagesRef, where("recipientId", "==", user.uid))),
      ]);

      const combined = new Map<string, any>();
      sentSnap.forEach((docSnap) => combined.set(docSnap.ref.path, docSnap));
      receivedSnap.forEach((docSnap) => combined.set(docSnap.ref.path, docSnap));

      const threadMap = new Map<string, ThreadSummary>();

      combined.forEach((docSnap) => {
        const data = docSnap.data() as any;
        const chatId = docSnap.ref.parent.parent?.id ?? data.chatId;
        if (!chatId) return;

        const otherUserId =
          data.senderId === user.uid ? data.recipientId : data.senderId;
        if (!otherUserId) return;

        const createdAt = data.createdAt?.toDate?.().getTime() ?? 0;
        const lastMessage = data.message ?? data.body ?? "";

        const existing = threadMap.get(chatId);
        const isUnread =
          data.recipientId === user.uid && (data.readAt == null || data.readAt === undefined);
        if (!existing || createdAt > existing.lastTimestamp) {
          threadMap.set(chatId, {
            id: chatId,
            otherUserId,
            name: otherUserId,
            handle: `@${otherUserId.slice(0, 6)}`,
            lastMessage,
            lastTimestamp: createdAt,
            status: getStatusLabelFromTimestamp(createdAt),
            unread: isUnread ? 1 : 0,
          });
        } else if (isUnread) {
          threadMap.set(chatId, { ...existing, unread: existing.unread + 1 });
        }
      });

      const sortedThreads = Array.from(threadMap.values()).sort(
        (a, b) => b.lastTimestamp - a.lastTimestamp
      );

      setThreads(sortedThreads);
      setActiveThreadId((current) => current ?? sortedThreads[0]?.id ?? null);
    } catch (error) {
      console.error("Error loading inbox threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadThreads();
  }, [user, loadThreads]);

  useEffect(() => {
    if (!user || !activeThreadId) return;

    const messagesRef = collection(db, "directChats", activeThreadId, "messages");
    const unsubscribe = onSnapshot(
      query(messagesRef),
      (snapshot) => {
        let unreadCount = 0;
        const nextMessages = snapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as any;
            const timestamp = data.createdAt?.toDate?.().getTime() ?? 0;
            const mine = data.senderId === user.uid;
            if (!mine && (data.readAt == null || data.readAt === undefined)) {
              unreadCount += 1;
            }
            return {
              id: docSnap.id,
              body: data.message ?? data.body ?? "",
              time: timestamp ? formatTime(timestamp) : "",
              mine,
              timestamp,
              senderId: data.senderId,
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(({ timestamp, senderId, ...rest }) => rest);

        // Check for new messages
        if (nextMessages.length > previousMessagesLengthRef.current) {
          const lastMessage = nextMessages[nextMessages.length - 1];
          if (lastMessage && !lastMessage.mine) {
            const senderThread = threads.find((t) => t.id === activeThreadId);
            const senderName = senderThread?.name || "Someone";
            showNotification(lastMessage.body, senderName);
          }
        }
        previousMessagesLengthRef.current = nextMessages.length;

        setMessages(nextMessages);
        setThreads((current) =>
          current.map((thread) =>
            thread.id === activeThreadId ? { ...thread, unread: unreadCount } : thread
          )
        );
      },
      (error) => {
        console.error("Error loading messages:", error);
      }
    );

    return () => unsubscribe();
  }, [user, activeThreadId, showNotification, threads]);

  const activeThread = useMemo(() => {
    return threads.find((thread) => thread.id === activeThreadId) ?? null;
  }, [threads, activeThreadId]);

  const initials = activeThread?.name
    ? activeThread.name
        .split(" ")
        .map((part) => part[0])
        .slice(0, 2)
        .join("")
    : "";

  useEffect(() => {
    if (activeThread) {
      setActiveRecipientId(activeThread.otherUserId);
    }
  }, [activeThread]);

  const markThreadRead = useCallback(async () => {
    if (!user || !activeThreadId) return;
    try {
      const messagesRef = collection(db, "directChats", activeThreadId, "messages");
      const unreadSnap = await getDocs(
        query(messagesRef, where("recipientId", "==", user.uid), where("readAt", "==", null))
      );

      if (unreadSnap.empty) return;
      const batch = writeBatch(db);
      unreadSnap.docs.forEach((docSnap) => {
        batch.update(docSnap.ref, { readAt: serverTimestamp() });
      });
      await batch.commit();

      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThreadId ? { ...thread, unread: 0 } : thread
        )
      );
    } catch (error) {
      console.error("Error marking thread read:", error);
    }
  }, [user, activeThreadId]);

  useEffect(() => {
    if (!activeThreadId || !user) return;
    markThreadRead();
  }, [activeThreadId, user, markThreadRead]);

  const handleSend = async () => {
    if (!user || !activeRecipientId || !activeThreadId || !draft.trim()) return;

    try {
      const messageText = draft.trim();
      setDraft("");
      await addDoc(collection(db, "directChats", activeThreadId ?? "", "messages"), {
        message: messageText,
        senderId: user.uid,
        recipientId: activeRecipientId,
        createdAt: serverTimestamp(),
        readAt: null,
      });

      setThreads((current) =>
        current.map((thread) =>
          thread.id === activeThreadId
            ? {
                ...thread,
                lastMessage: messageText,
                lastTimestamp: Date.now(),
              }
            : thread
        )
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!activeThreadId || !messageId) return;

    try {
      await deleteDoc(doc(db, "directChats", activeThreadId, "messages", messageId));
      setMessages((current) => current.filter((message) => message.id !== messageId));
      loadThreads();
    } catch (error) {
      console.error("Error deleting message:", error);
      alert("Failed to delete message");
    }
  };

  const handleStartChat = async () => {
    if (!user) return;
    const recipientId = normalizeRecipientId(composeRecipient);
    const messageText = composeMessage.trim();

    if (!recipientId) {
      setComposeError("Enter a recipient user id.");
      return;
    }

    if (recipientId === user.uid) {
      setComposeError("You cannot message yourself.");
      return;
    }

    if (!messageText) {
      setComposeError("Write a message to start the chat.");
      return;
    }

    setComposeError("");
    setSendingCompose(true);
    try {
      const chatId = [user.uid, recipientId].sort().join("__");
      await addDoc(collection(db, "directChats", chatId, "messages"), {
        message: messageText,
        senderId: user.uid,
        recipientId,
        createdAt: serverTimestamp(),
        readAt: null,
      });

      setActiveThreadId(chatId);
      setActiveRecipientId(recipientId);
      setThreads((current) => {
        if (current.some((thread) => thread.id === chatId)) return current;
        return [
          {
            id: chatId,
            otherUserId: recipientId,
            name: recipientId,
            handle: `@${recipientId.slice(0, 6)}`,
            lastMessage: messageText,
            lastTimestamp: Date.now(),
            status: "Active",
            unread: 0,
          },
          ...current,
        ];
      });

      setComposeMessage("");
      setComposeRecipient("");
      setComposeOpen(false);
      loadThreads();
    } catch (error) {
      console.error("Error creating chat:", error);
      setComposeError("Unable to start chat. Check permissions.");
    } finally {
      setSendingCompose(false);
    }
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!draft.trim() || !activeRecipientId) return;
    void handleSend();
  };

  const handleStartChatKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (sendingCompose) return;
    void handleStartChat();
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tabParam = new URLSearchParams(window.location.search).get("tab");
    if (tabParam === "groups") {
      setActiveTab("groups");
      return;
    }
    if (tabParam === "direct") {
      setActiveTab("direct");
    }
  }, []);

  return (
    <div className={styles.wrapper}>
      {notification && (
        <div className={styles.notificationToast}>
          <div className={styles.notificationContent}>
            <span className={styles.notificationIcon}>💬</span>
            <div>
              <div className={styles.notificationTitle}>
                {notification.sender || "New Message"}
              </div>
              <div className={styles.notificationBody}>{notification.message}</div>
            </div>
          </div>
        </div>
      )}
      <div className={`panel ${styles.listPanel}`}>
        <div className={styles.listHeader}>
          <div>
            <p className={styles.eyebrow}>Inbox</p>
            <h2 className={styles.title}>Messages</h2>
          </div>
          <button
            className={styles.primaryButton}
            type="button"
            onClick={handleOpenCompose}
          >
            New Message
          </button>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === "direct" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("direct")}
          >
            💬 Direct Messages
          </button>
          <button
            className={`${styles.tab} ${activeTab === "groups" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("groups")}
          >
            👥 Group Chats
          </button>
        </div>

        {activeTab === "direct" ? (
          <>
            <div className={styles.searchRow}>
              <input
                className={styles.searchInput}
                type="search"
                placeholder="Search conversations"
                aria-label="Search conversations"
              />
              <button className={styles.filterButton} type="button">
                Filters
              </button>
            </div>
            <div className={styles.threadList}>
              {!user && !loading ? (
                <div className={styles.emptyState}>Please sign in to view messages.</div>
              ) : loading || loadingThreads ? (
                <div className={styles.emptyState}>Loading messages...</div>
              ) : threads.length === 0 ? (
                <div className={styles.emptyState}>No conversations yet.</div>
              ) : (
                threads.map((thread) => {
            const isActive = thread.id === activeThreadId;
            return (
            <button
              key={thread.id}
              className={`${styles.threadCard} ${thread.unread ? styles.threadUnread : ""} ${
                isActive ? styles.threadActive : ""
              }`}
              type="button"
              onClick={() => {
                setActiveThreadId(thread.id);
                setActiveRecipientId(thread.otherUserId);
              }}
            >
              <div className={styles.avatar}>{thread.name.slice(0, 2)}</div>
              <div className={styles.threadBody}>
                <div className={styles.threadTop}>
                  <p className={styles.threadName}>{thread.name}</p>
                  <span className={styles.threadTime}>
                    {thread.lastTimestamp ? formatRelative(thread.lastTimestamp) : ""}
                  </span>
                </div>
                <p className={styles.threadMessage}>{thread.lastMessage}</p>
                <div className={styles.threadMeta}>
                  <span className={styles.threadHandle}>{thread.handle}</span>
                  <span className={styles.threadStatus}>{thread.status}</span>
                </div>
              </div>
              {thread.unread > 0 && (
                <span className={styles.unreadBadge}>{thread.unread}</span>
              )}
            </button>
            );
          })
          )}
        </div>
          </>
        ) : (
          <GroupChats />
        )}
      </div>

      {activeTab === "direct" && (
      <div className={`panel ${styles.chatPanel}`}>
        <div className={styles.chatHeader}>
          <div className={styles.chatIdentity}>
            <div className={styles.chatAvatar}>{initials}</div>
            <div>
              <p className={styles.chatName}>
                {activeThread?.name ?? "Select a conversation"}
              </p>
              <p className={styles.chatStatus}>{activeThread?.status ?? ""}</p>
            </div>
          </div>
          <div className={styles.chatActions}>
            <button className={styles.secondaryButton} type="button">
              View Profile
            </button>
            <button className={styles.secondaryButton} type="button">
              Archive
            </button>
          </div>
        </div>

        <div className={styles.messageList}>
          {!activeThread ? (
            <div className={styles.emptyState}>Select a thread to view messages.</div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>No messages yet.</div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`${styles.messageRow} ${
                  message.mine ? styles.messageMine : styles.messageTheirs
                }`}
              >
                <div className={styles.messageBubble}>
                  <p className={styles.messageText}>{message.body}</p>
                  <div className={styles.messageMetaRow}>
                    <span className={styles.messageTime}>{message.time}</span>
                    {message.mine && (
                      <button
                        className={styles.messageDeleteButton}
                        type="button"
                        onClick={() => handleDeleteMessage(message.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.composer}>
          <input
            className={styles.composerInput}
            type="text"
            placeholder="Write a message"
            aria-label="Write a message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleComposerKeyDown}
          />
          <button
            className={styles.primaryButton}
            type="button"
            onClick={handleSend}
            disabled={!draft.trim() || !activeRecipientId}
          >
            Send
          </button>
        </div>
      </div>
      )}

      {composeOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} role="dialog" aria-modal="true">
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalEyebrow}>New Message</p>
                <h3 className={styles.modalTitle}>Start a chat</h3>
              </div>
              <button
                className={styles.closeButton}
                type="button"
                onClick={() => {
                  setComposeOpen(false);
                  setSearchResults([]);
                  setSelectedUserId(null);
                }}
              >
                Close
              </button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.modalField}>
                <span className={styles.modalLabel}>Find a user to chat with</span>
                <div className={styles.searchContainer}>
                  <input
                    className={styles.modalInput}
                    type="text"
                    placeholder="Search by name or email"
                    value={composeRecipient}
                    onChange={(event) => {
                      setComposeRecipient(event.target.value);
                      setSelectedUserId(null);
                      searchUsers(event.target.value);
                    }}
                  />
                  {searchResults.length > 0 || searchLoading ? (
                    <div className={styles.searchDropdown}>
                      {!composeRecipient && (
                        <div style={{ padding: "12px 14px", fontSize: "12px", color: "rgba(255, 255, 255, 0.5)", fontWeight: 600 }}>
                          ✨ Recommended Users
                        </div>
                      )}
                      {searchLoading ? (
                        <div className={styles.searchLoading}>Searching...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((result) => (
                          <button
                            key={result.uid}
                            className={styles.searchResultItem}
                            type="button"
                            onClick={() => handleSelectUser(result.uid, result.displayName)}
                          >
                            <span className={styles.searchResultName}>{result.displayName}</span>
                            <span className={styles.searchResultEmail}>{result.email}</span>
                          </button>
                        ))
                      ) : (
                        <div className={styles.searchEmpty}>No users found</div>
                      )}
                    </div>
                  ) : null}
                </div>
              </label>
              <label className={styles.modalField}>
                <span className={styles.modalLabel}>Message</span>
                <textarea
                  className={styles.modalTextArea}
                  placeholder="Write your first message"
                  rows={4}
                  value={composeMessage}
                  onChange={(event) => setComposeMessage(event.target.value)}
                  onKeyDown={handleStartChatKeyDown}
                />
              </label>
              {composeError && (
                <div className={styles.modalError}>{composeError}</div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.ghostButton}
                type="button"
                onClick={() => {
                  setComposeOpen(false);
                  setSearchResults([]);
                  setSelectedUserId(null);
                }}
              >
                Cancel
              </button>
              <button
                className={styles.primaryButton}
                type="button"
                onClick={handleStartChat}
                disabled={sendingCompose}
              >
                {sendingCompose ? "Sending..." : "Start Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
