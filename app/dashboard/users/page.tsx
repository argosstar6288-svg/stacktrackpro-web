"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import styles from "./users.module.css";

type UserSearchResult = {
  uid: string;
  displayName: string;
  email: string;
};

export default function DashboardUsersPage() {
  const { user, loading } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");

  const getAuthHeaders = useCallback(async () => {
    if (!user) return {};

    const token = await user.getIdToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }, [user]);

  const loadRecommendedUsers = useCallback(async () => {
    if (!user) return;

    setIsSearching(true);
    setError("");

    try {
      const response = await fetch(
        `/api/search-users?recommendations=true&currentUserId=${encodeURIComponent(user.uid)}`,
        {
          headers: await getAuthHeaders(),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload?.error || "Unable to load users");
      }

      const payload = await response.json();
      setResults(Array.isArray(payload?.results) ? payload.results : []);
    } catch (loadError) {
      console.error("Error loading recommended users:", loadError);
      setResults([]);
      setError("Unable to load users right now.");
    } finally {
      setIsSearching(false);
    }
  }, [getAuthHeaders, user]);

  const runSearch = useCallback(async () => {
    if (!user) return;

    const term = query.trim();
    if (term.length < 2) {
      setError("Enter at least 2 characters.");
      setResults([]);
      return;
    }

    setIsSearching(true);
    setError("");

    try {
      const response = await fetch(
        `/api/search-users?q=${encodeURIComponent(term)}&currentUserId=${encodeURIComponent(user.uid)}`,
        {
          headers: await getAuthHeaders(),
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Search failed");
      }

      setResults(Array.isArray(payload?.results) ? payload.results : []);
    } catch (searchError) {
      console.error("Error searching users:", searchError);
      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Unable to search users right now."
      );
    } finally {
      setIsSearching(false);
    }
  }, [getAuthHeaders, query, user]);

  useEffect(() => {
    if (loading || !user) return;
    void loadRecommendedUsers();
  }, [loadRecommendedUsers, loading, user]);

  const headerText = useMemo(() => {
    if (query.trim().length >= 2) return "Search Results";
    return "Recommended Users";
  }, [query]);

  return (
    <div className={styles.page}>
      <section className={`panel ${styles.panel}`}>
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Community</p>
            <h1 className={styles.title}>Find Users</h1>
          </div>
          <Link className={styles.inboxLink} href="/dashboard/inbox">
            Inbox
          </Link>
        </div>

        <div className={styles.searchRow}>
          <input
            className={styles.searchInput}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!event.target.value.trim()) {
                setError("");
                void loadRecommendedUsers();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void runSearch();
              }
            }}
            placeholder="Search by name or email"
          />
          <button
            className={styles.searchButton}
            type="button"
            onClick={() => void runSearch()}
            disabled={isSearching}
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </div>

        {error ? <p className={styles.errorText}>{error}</p> : null}

        <div className={styles.resultsWrap}>
          <h2 className={styles.sectionTitle}>{headerText}</h2>

          {isSearching ? (
            <p className={styles.stateText}>Loading users...</p>
          ) : results.length === 0 ? (
            <p className={styles.stateText}>No users found.</p>
          ) : (
            <div className={styles.resultsList}>
              {results.map((result) => (
                <article key={result.uid} className={styles.userCard}>
                  <div className={styles.userMeta}>
                    <p className={styles.userName}>{result.displayName || result.uid}</p>
                    <p className={styles.userEmail}>{result.email || "No email available"}</p>
                  </div>
                  <div className={styles.actions}>
                    <Link
                      className={styles.primaryAction}
                      href={`/dashboard/profile/${encodeURIComponent(result.uid)}`}
                    >
                      View Profile
                    </Link>
                    <Link
                      className={styles.secondaryAction}
                      href={`/dashboard/inbox?tab=direct&user=${encodeURIComponent(result.uid)}`}
                    >
                      Message
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
