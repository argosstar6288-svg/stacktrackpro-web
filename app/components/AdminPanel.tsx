"use client";

import React, { useEffect, useState } from "react";
import { getAllUsers, promoteUserToAdmin, promoteUserToModerator, revokeAdminStatus, toggleUserSuspension, getUserStats } from "../lib/roleManager";

interface User {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  suspended?: boolean;
  createdAt?: any;
}

interface UserStats {
  totalUsers: number;
  freeUsers: number;
  proUsers: number;
  premiumUsers: number;
  adminUsers: number;
  moderatorUsers: number;
}

export default function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [allUsers, userStats] = await Promise.all([
        getAllUsers(),
        getUserStats(),
      ]);
      setUsers(allUsers);
      setStats(userStats);
    } catch (error) {
      console.error("Error loading data:", error);
      setMessage("Failed to load user data");
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteToAdmin = async (userId: string) => {
    try {
      setActionLoading(userId);
      await promoteUserToAdmin(userId);
      setMessage("User promoted to Admin");
      await loadData();
    } catch (error) {
      setMessage("Failed to promote user");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromoteToModerator = async (userId: string) => {
    try {
      setActionLoading(userId);
      await promoteUserToModerator(userId);
      setMessage("User promoted to Moderator");
      await loadData();
    } catch (error) {
      setMessage("Failed to promote user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAdmin = async (userId: string) => {
    try {
      setActionLoading(userId);
      await revokeAdminStatus(userId, "free");
      setMessage("Admin status revoked");
      await loadData();
    } catch (error) {
      setMessage("Failed to revoke admin status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleSuspend = async (userId: string, currentlySuspended: boolean) => {
    try {
      setActionLoading(userId);
      await toggleUserSuspension(userId, !currentlySuspended);
      setMessage(currentlySuspended ? "User unsuspended" : "User suspended");
      await loadData();
    } catch (error) {
      setMessage("Failed to toggle suspension");
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = !roleFilter || user.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <div style={{ padding: "2rem" }}>Loading...</div>;
  }

  return (
    <div style={{ padding: "2rem" }}>
      <h1>Admin Panel - User Management</h1>

      {/* Stats */}
      {stats && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem"
        }}>
          <div style={{ backgroundColor: "#f0f0f0", padding: "1rem", borderRadius: "8px" }}>
            <h3>Total Users</h3>
            <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0.5rem 0" }}>
              {stats.totalUsers}
            </p>
          </div>
          <div style={{ backgroundColor: "#e8f4f8", padding: "1rem", borderRadius: "8px" }}>
            <h3>Free Users</h3>
            <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0.5rem 0", color: "#666" }}>
              {stats.freeUsers}
            </p>
          </div>
          <div style={{ backgroundColor: "#fff4e8", padding: "1rem", borderRadius: "8px" }}>
            <h3>Pro Users</h3>
            <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0.5rem 0", color: "#ff9800" }}>
              {stats.proUsers}
            </p>
          </div>
          <div style={{ backgroundColor: "#f0e8ff", padding: "1rem", borderRadius: "8px" }}>
            <h3>Premium Users</h3>
            <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0.5rem 0", color: "#9c27b0" }}>
              {stats.premiumUsers}
            </p>
          </div>
          <div style={{ backgroundColor: "#ffe8e8", padding: "1rem", borderRadius: "8px" }}>
            <h3>Admins</h3>
            <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0.5rem 0", color: "#f44336" }}>
              {stats.adminUsers}
            </p>
          </div>
          <div style={{ backgroundColor: "#e8ffe8", padding: "1rem", borderRadius: "8px" }}>
            <h3>Moderators</h3>
            <p style={{ fontSize: "24px", fontWeight: "bold", margin: "0.5rem 0", color: "#4caf50" }}>
              {stats.moderatorUsers}
            </p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ marginBottom: "2rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Search by email, first name, or last name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: "4px",
            flex: "1",
            minWidth: "250px"
          }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            border: "1px solid #ddd",
            borderRadius: "4px"
          }}
        >
          <option value="">All Roles</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
        </select>
        <button
          onClick={loadData}
          style={{
            padding: "8px 16px",
            backgroundColor: "#10b3f0",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Refresh
        </button>
      </div>

      {/* Message */}
      {message && (
        <div style={{
          padding: "1rem",
          marginBottom: "1rem",
          backgroundColor: "#d4edda",
          border: "1px solid #c3e6cb",
          borderRadius: "4px",
          color: "#155724"
        }}>
          {message}
        </div>
      )}

      {/* Users Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: "white",
          borderRadius: "8px",
          overflow: "hidden"
        }}>
          <thead>
            <tr style={{ backgroundColor: "#f5f5f5", borderBottom: "2px solid #ddd" }}>
              <th style={{ padding: "12px", textAlign: "left" }}>Email</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Name</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Role</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Status</th>
              <th style={{ padding: "12px", textAlign: "left" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.uid} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "12px" }}>{user.email}</td>
                <td style={{ padding: "12px" }}>{user.firstName} {user.lastName}</td>
                <td style={{ padding: "12px" }}>
                  <span style={{
                    padding: "4px 8px",
                    borderRadius: "4px",
                    backgroundColor:
                      user.role === "admin" ? "#ffebee" :
                      user.role === "moderator" ? "#e8f5e9" :
                      user.role === "premium" ? "#f3e5f5" :
                      user.role === "pro" ? "#fff3e0" :
                      "#eceff1",
                    color:
                      user.role === "admin" ? "#c62828" :
                      user.role === "moderator" ? "#2e7d32" :
                      user.role === "premium" ? "#6a1b9a" :
                      user.role === "pro" ? "#e65100" :
                      "#37474f",
                    fontWeight: "bold",
                    fontSize: "12px",
                    textTransform: "uppercase"
                  }}>
                    {user.role}
                  </span>
                </td>
                <td style={{ padding: "12px" }}>
                  {user.suspended ? (
                    <span style={{ color: "#f44336", fontWeight: "bold" }}>Suspended</span>
                  ) : (
                    <span style={{ color: "#4caf50", fontWeight: "bold" }}>Active</span>
                  )}
                </td>
                <td style={{ padding: "12px" }}>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {user.role !== "admin" && (
                      <button
                        onClick={() => handlePromoteToAdmin(user.uid)}
                        disabled={actionLoading === user.uid}
                        style={{
                          padding: "6px 10px",
                          backgroundColor: "#f44336",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: actionLoading === user.uid ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          opacity: actionLoading === user.uid ? 0.6 : 1
                        }}
                      >
                        Make Admin
                      </button>
                    )}

                    {user.role !== "moderator" && user.role !== "admin" && (
                      <button
                        onClick={() => handlePromoteToModerator(user.uid)}
                        disabled={actionLoading === user.uid}
                        style={{
                          padding: "6px 10px",
                          backgroundColor: "#4caf50",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: actionLoading === user.uid ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          opacity: actionLoading === user.uid ? 0.6 : 1
                        }}
                      >
                        Make Moderator
                      </button>
                    )}

                    {(user.role === "admin" || user.role === "moderator") && (
                      <button
                        onClick={() => handleRevokeAdmin(user.uid)}
                        disabled={actionLoading === user.uid}
                        style={{
                          padding: "6px 10px",
                          backgroundColor: "#ff9800",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          cursor: actionLoading === user.uid ? "not-allowed" : "pointer",
                          fontSize: "12px",
                          opacity: actionLoading === user.uid ? 0.6 : 1
                        }}
                      >
                        Revoke Status
                      </button>
                    )}

                    <button
                      onClick={() => handleToggleSuspend(user.uid, user.suspended || false)}
                      disabled={actionLoading === user.uid}
                      style={{
                        padding: "6px 10px",
                        backgroundColor: user.suspended ? "#4caf50" : "#ff5722",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        cursor: actionLoading === user.uid ? "not-allowed" : "pointer",
                        fontSize: "12px",
                        opacity: actionLoading === user.uid ? 0.6 : 1
                      }}
                    >
                      {user.suspended ? "Unsuspend" : "Suspend"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredUsers.length === 0 && (
        <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
          No users found matching your criteria.
        </div>
      )}
    </div>
  );
}
