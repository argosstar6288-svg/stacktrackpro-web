"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { CURRENCIES } from "@/lib/currency";
import { useCurrency } from "@/hooks/useCurrency";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState("dark");
  const { currency, setCurrency, isLoaded } = useCurrency();

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

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>Settings</p>
          <h1 className={styles.title}>Account Settings</h1>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.main}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Preferences</h2>
                <p className={styles.panelSubtitle}>Customize your experience</p>
              </div>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Email Notifications</div>
                <div className={styles.settingDescription}>
                  Receive updates about your account and activity
                </div>
              </div>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
              />
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Theme</div>
                <div className={styles.settingDescription}>
                  Choose your preferred color scheme
                </div>
              </div>
              <select 
                value={theme} 
                onChange={(e) => setTheme(e.target.value)}
                className={styles.select}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <div className={styles.settingLabel}>Currency</div>
                <div className={styles.settingDescription}>
                  Choose your preferred currency for all prices
                </div>
              </div>
              <select 
                value={currency} 
                onChange={(e) => setCurrency(e.target.value)}
                className={styles.select}
                disabled={!isLoaded}
              >
                {Object.values(CURRENCIES).map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Account Actions</h2>
                <p className={styles.panelSubtitle}>Manage your account</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className={styles.dangerButton}
            >
              Sign Out
            </button>
          </section>
        </div>

        <aside className={styles.side}>
          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Account</h2>
                <p className={styles.panelSubtitle}>Quick links</p>
              </div>
            </div>
            
            <div className={styles.accountItem}>
              <span className={styles.accountLabel}>Privacy</span>
              <span className={styles.accountIcon}>⏱</span>
            </div>
            
            <div className={styles.accountItem}>
              <span className={styles.accountLabel}>Security</span>
              <span className={styles.accountIcon}>✓</span>
            </div>
            
            <div className={styles.accountItem}>
              <span className={styles.accountLabel}>Billing</span>
              <span className={styles.accountIcon}>✓</span>
            </div>
          </section>

          <section className={`panel ${styles.panel}`}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Help & Support</h2>
              </div>
            </div>
            <p className={styles.helpText}>
              Need assistance? Check our FAQ or contact support for help with your account.
            </p>
            <Link href="/dashboard/help" className={styles.helpLink}>
              Visit Help Center
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
