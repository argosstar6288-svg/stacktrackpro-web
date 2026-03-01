"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { CollectionManager } from "../../components/CollectionManager";
import styles from "./collection.module.css";

export default function CollectionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.replace("/login");
      } else {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Collection</p>
          <h1 className={styles.title}>Your Collection</h1>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.search}>
            <input type="text" placeholder="Quick search..." />
          </div>
          <button 
            className={styles.addButton}
            onClick={() => router.push('/dashboard/collection/add')}
          >
            + Add Card
          </button>
        </div>
      </div>

      <section className={`panel ${styles.panel}`}>
        <CollectionManager />
      </section>
    </div>
  );
}
