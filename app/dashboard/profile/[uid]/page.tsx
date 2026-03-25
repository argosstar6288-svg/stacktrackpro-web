"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import styles from "./user-profile.module.css";

type UserProfileSummary = {
  uid: string;
  displayName: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

type PublicCollectionFolder = {
  id: string;
  name: string;
};

export default function UserProfilePage() {
  const params = useParams<{ uid: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useCurrentUser();
  const [profile, setProfile] = useState<UserProfileSummary | null>(null);
  const [publicFolders, setPublicFolders] = useState<PublicCollectionFolder[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");

  const targetUserId = useMemo(() => {
    const rawValue = params?.uid;
    if (Array.isArray(rawValue)) {
      return (rawValue[0] || "").trim();
    }

    return String(rawValue || "").trim();
  }, [params]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!targetUserId) {
      setProfile(null);
      setError("Invalid user profile.");
      setLoadingProfile(false);
      return;
    }

    if (targetUserId === user.uid) {
      router.replace("/dashboard/profile");
      return;
    }

    let cancelled = false;

    const loadProfile = async () => {
      setLoadingProfile(true);
      setError("");

      try {
        const token = await user.getIdToken();
        const response = await fetch(
          `/api/search-users?uid=${encodeURIComponent(targetUserId)}&currentUserId=${encodeURIComponent(user.uid)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload?.result) {
          if (!cancelled) {
            setProfile(null);
            setError(payload?.error || "Unable to load user profile.");
          }
          return;
        }

        if (!cancelled) {
          setProfile(payload.result as UserProfileSummary);

          const publicFoldersQuery = query(
            collection(db, "folders"),
            where("userId", "==", targetUserId),
            where("isPublic", "==", true)
          );
          const publicFoldersSnapshot = await getDocs(publicFoldersQuery);
          const nextFolders = publicFoldersSnapshot.docs.map((snapshot) => ({
            id: snapshot.id,
            name: String((snapshot.data() as any)?.name || "Collection"),
          }));
          setPublicFolders(nextFolders);
        }
      } catch (loadError) {
        console.error("Error loading user profile:", loadError);
        if (!cancelled) {
          setProfile(null);
          setPublicFolders([]);
          setError("Unable to load user profile.");
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    };

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [authLoading, router, targetUserId, user]);

  if (authLoading || loadingProfile) {
    return (
      <div className={styles.page}>
        <section className={`panel ${styles.card}`}>
          <p className={styles.loadingText}>Loading profile...</p>
        </section>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.page}>
        <section className={`panel ${styles.card}`}>
          <p className={styles.errorText}>{error || "Profile unavailable."}</p>
          <Link className={styles.secondaryAction} href="/dashboard/inbox">
            Back to Inbox
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <section className={`panel ${styles.card}`}>
        <p className={styles.eyebrow}>Member Profile</p>
        <h1 className={styles.name}>{profile.displayName || profile.uid}</h1>
        <p className={styles.handle}>@{profile.uid.slice(0, 12)}</p>

        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>User ID</span>
            <span className={styles.detailValue}>{profile.uid}</span>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Email</span>
            <span className={styles.detailValue}>{profile.email || "Not shared"}</span>
          </div>
        </div>

        {publicFolders.length > 0 && (
          <div className={styles.publicCollections}>
            <p className={styles.publicCollectionsTitle}>Public Collections</p>
            <div className={styles.publicCollectionsList}>
              {publicFolders.map((folder) => (
                <Link
                  key={folder.id}
                  className={styles.publicCollectionLink}
                  href={`/dashboard/collection/folder/${encodeURIComponent(folder.id)}`}
                >
                  {folder.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <Link
            className={styles.primaryAction}
            href={`/dashboard/inbox?tab=direct&user=${encodeURIComponent(profile.uid)}`}
          >
            Message User
          </Link>
          <Link className={styles.secondaryAction} href="/dashboard/inbox">
            Back to Inbox
          </Link>
        </div>
      </section>
    </div>
  );
}
