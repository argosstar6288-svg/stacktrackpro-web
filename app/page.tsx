"use client";

import { useRouter } from "next/navigation";
import { useCurrentUser } from "./lib/useCurrentUser";
import styles from "./page.module.css";
import { useEffect } from "react";

export default function Home() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    // Redirect based on auth status
    if (!loading && !user) {
      router.push("/login");
    } else if (user) {
      router.push("/dashboard/discover");
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className={styles.page}><div className={styles.loading}>Loading...</div></div>;
  }

  return null;
}
