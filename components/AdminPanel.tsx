"use client";

import { useState, useEffect } from "react";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { useCurrentUser } from "../lib/useCurrentUser";
import styles from "./AdminPanel.module.css";

interface User {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  subscription?: {
    status: string;
    plan: string;
    createdAt?: string;
  };
}

interface Card {
  id: string;
  userId: string;
  name: string;
  player?: string;
  estimatedValue: number;
  createdAt?: any;
}

export default function AdminPanel() {
  const { user: currentUser } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCards: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "cards">(
    "overview"
  );
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [myDisplayName, setMyDisplayName] = useState("");

  useEffect(() => {
    if (currentUser) {
      setMyDisplayName(currentUser.displayName || "");
    }
  }, [currentUser]);

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleUpdateMyProfile = async () => {
    try {
      if (!currentUser) {
        alert("No user logged in");
        return;
      }

      if (!myDisplayName.trim()) {
        alert("Display name cannot be empty");
        return;
      }

      console.log("[Admin] Current user:", currentUser);
      console.log("[Admin] Current user UID:", currentUser.uid);
      console.log("[Admin] Current user email:", currentUser.email);
      console.log("[Admin] Updating my profile to:", myDisplayName);

      // Update Firebase Auth profile
      try {
        console.log("[Admin] Updating Firebase Auth profile...");
        await updateProfile(currentUser, {
          displayName: myDisplayName.trim(),
        });
        console.log("[Admin] Auth profile updated successfully");
      } catch (authErr: any) {
        console.error("[Admin] Auth update error:", authErr);
        throw new Error(`Auth update failed: ${authErr.message}`);
      }

      // Create or update Firestore document with lifetime subscription
      try {
        console.log("[Admin] Updating Firestore document...");
        const userRef = doc(db, "users", currentUser.uid);
        const userData = {
          email: currentUser.email,
          displayName: myDisplayName.trim(),
          role: "admin",
          subscription: {
            status: "active",
            plan: "lifetime",
            isLifetime: true,
            lifetimeActivatedAt: new Date(),
          },
          updatedAt: new Date(),
          createdAt: new Date(),
        };
        console.log("[Admin] Writing data:", userData);
        
        await setDoc(userRef, userData, { merge: true });
        
        console.log("[Admin] Firestore document updated successfully");
      } catch (firestoreErr: any) {
        console.error("[Admin] Firestore update error:", firestoreErr);
        throw new Error(`Firestore update failed: ${firestoreErr.message}`);
      }

      console.log("[Admin] Profile updated successfully");
      alert(`✅ Successfully updated!\nDisplay Name: "${myDisplayName}"\nSubscription: Lifetime Plan`);
      
      // Reload data
      await loadAdminData();
    } catch (err: any) {
      console.error("[Admin] Error updating profile:", err);
      alert(`❌ Failed: ${err.message}`);
    }
  };

  const handleEditClick = (user: User) => {
    console.log("[Admin] EDIT CLICKED for user:", user.email);
    setEditingUserId(user.uid);
    setEditDisplayName(user.displayName || "");
    console.log("[Admin] Edit mode enabled for", user.uid);
  };

  const handleSaveDisplayName = async (userId: string, email: string) => {
    try {
      console.log(`[Admin] Starting save for user: ${userId}, email: ${email}`);
      
      if (!editDisplayName.trim()) {
        console.log("[Admin] Display name is empty");
        alert("Display name cannot be empty");
        return;
      }

      console.log(`[Admin] Saving display name for ${email}: "${editDisplayName}"`);

      const userRef = doc(db, "users", userId);
      console.log(`[Admin] User ref path: users/${userId}`);
      
      const updateData = {
        displayName: editDisplayName.trim(),
        updatedAt: new Date(),
      };
      console.log(`[Admin] Update data:`, updateData);

      await updateDoc(userRef, updateData);

      console.log(`[Admin] updateDoc call completed successfully`);

      // Reload all data to ensure consistency
      console.log("[Admin] Reloading admin data...");
      await loadAdminData();

      setEditingUserId(null);
      setEditDisplayName("");
      
      console.log(`[Admin] SUCCESS: Updated ${email} to "${editDisplayName}"`);
      alert(`✅ Successfully updated ${email} to "${editDisplayName}"`);
    } catch (err: any) {
      console.error("[Admin] Error updating display name:", err);
      console.error("[Admin] Error code:", err.code);
      console.error("[Admin] Error message:", err.message);
      alert(`❌ Failed to update: ${err.message}`);
    }
  };

  const loadAdminData = async () => {
    try {
      setLoading(true);
      let usersData: User[] = [];

      // Load users
      try {
        const usersSnapshot = await getDocs(collection(db, "users"));
        usersData = usersSnapshot.docs.map((doc) => ({
          uid: doc.id,
          email: doc.data().email || "",
          displayName: doc.data().displayName || "Unknown",
          role: doc.data().role || "user",
          subscription: doc.data().subscription || { status: "none", plan: "free" },
        }));
        setUsers(usersData);
      } catch (err) {
        console.error("Error loading users:", err);
      }

      // Load cards
      try {
        const cardsSnapshot = await getDocs(collection(db, "cards"));
        const cardsData = cardsSnapshot.docs.map((doc) => ({
          id: doc.id,
          userId: doc.data().userId || "",
          name: doc.data().name || "Unknown Card",
          player: doc.data().player || "",
          estimatedValue: doc.data().estimatedValue || 0,
          createdAt: doc.data().createdAt,
        }));
        setCards(cardsData);

        // Calculate stats
        const totalValue = cardsData.reduce(
          (sum, card) => sum + (card.estimatedValue || 0),
          0
        );
        setStats({
          totalUsers: usersData.length,
          totalCards: cardsData.length,
          totalValue,
        });
      } catch (err) {
        console.error("Error loading cards:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading admin data...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Admin Dashboard</h1>
        <p>Manage users, cards, and platform settings</p>
      </div>

      {/* My Profile Section */}
      {currentUser && (
        <div className={styles.content} style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "1rem", color: "#ffffff" }}>My Profile</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <strong>Email:</strong> {currentUser.email}
            </div>
            <div>
              <strong>User ID:</strong> {currentUser.uid}
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <strong>Display Name:</strong>
              <input
                type="text"
                value={myDisplayName}
                onChange={(e) => setMyDisplayName(e.target.value)}
                placeholder="Enter your display name (e.g., Shelbie)"
                style={{
                  padding: "0.5rem 0.8rem",
                  borderRadius: "4px",
                  border: "1px solid rgba(30, 144, 255, 0.5)",
                  background: "rgba(30, 144, 255, 0.1)",
                  color: "white",
                  width: "250px",
                }}
              />
            </div>
            <div>
              <button
                className={styles.actionBtn}
                onClick={handleUpdateMyProfile}
                style={{ 
                  padding: "0.6rem 1.5rem",
                  fontSize: "1rem",
                  fontWeight: "600",
                  background: "linear-gradient(135deg, #1e90ff, #0052cc)",
                  border: "none",
                  borderRadius: "6px",
                }}
              >
                💾 Update Name & Set Lifetime Plan
              </button>
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>
                This will update your display name to what you entered and set your account to Lifetime Plan
              </p>
            </div>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "overview" ? styles.active : ""}`}
          onClick={() => setActiveTab("overview")}
        >
          Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === "users" ? styles.active : ""}`}
          onClick={() => setActiveTab("users")}
        >
          Users ({stats.totalUsers})
        </button>
        <button
          className={`${styles.tab} ${activeTab === "cards" ? styles.active : ""}`}
          onClick={() => setActiveTab("cards")}
        >
          Cards ({stats.totalCards})
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === "overview" && (
          <div className={styles.overview}>
            <div className={styles.statCard}>
              <h3>Total Users</h3>
              <p className={styles.statValue}>{stats.totalUsers}</p>
            </div>
            <div className={styles.statCard}>
              <h3>Total Cards</h3>
              <p className={styles.statValue}>{stats.totalCards}</p>
            </div>
            <div className={styles.statCard}>
              <h3>Total Card Value</h3>
              <p className={styles.statValue}>
                ${stats.totalValue.toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className={styles.table}>
            <h2>User Management</h2>
            {users.length === 0 ? (
              <p>No users found</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Display Name</th>
                    <th>Role</th>
                    <th>Subscription</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.uid}>
                      <td>{user.email}</td>
                      <td>
                        {editingUserId === user.uid ? (
                          <input
                            type="text"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            placeholder="Enter display name"
                            style={{
                              padding: "0.4rem 0.6rem",
                              borderRadius: "4px",
                              border: "1px solid rgba(30, 144, 255, 0.5)",
                              background: "rgba(30, 144, 255, 0.1)",
                              color: "white",
                              width: "150px",
                            }}
                          />
                        ) : (
                          user.displayName
                        )}
                      </td>
                      <td>{user.role}</td>
                      <td>{user.subscription?.plan || "free"}</td>
                      <td>
                        {editingUserId === user.uid ? (
                          <>
                            <button
                              className={styles.actionBtn}
                              onClick={() => {
                                console.log("[Admin] SAVE button clicked");
                                alert("Save clicked for: " + user.email);
                                handleSaveDisplayName(user.uid, user.email);
                              }}
                            >
                              Save
                            </button>
                            <button
                              className={styles.actionBtn}
                              onClick={() => {
                                console.log("[Admin] CANCEL button clicked");
                                setEditingUserId(null);
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className={styles.actionBtn}
                              onClick={() => handleEditClick(user)}
                            >
                              Edit
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === "cards" && (
          <div className={styles.table}>
            <h2>Card Inventory</h2>
            {cards.length === 0 ? (
              <p>No cards found</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Card Name</th>
                    <th>Player</th>
                    <th>Estimated Value</th>
                    <th>Owner</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map((card) => (
                    <tr key={card.id}>
                      <td>{card.name}</td>
                      <td>{card.player || "-"}</td>
                      <td>${card.estimatedValue.toLocaleString()}</td>
                      <td>{card.userId.substring(0, 8)}...</td>
                      <td>
                        <button className={styles.actionBtn}>View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button onClick={loadAdminData} className={styles.refreshBtn}>
          Refresh Data
        </button>
      </div>
    </div>
  );
}
