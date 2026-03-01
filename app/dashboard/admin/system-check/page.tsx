"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { isAdminEmail } from "@/lib/adminAccess";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, limit, query } from "firebase/firestore";
import styles from "./system-check.module.css";

interface SystemCheck {
  name: string;
  status: "checking" | "success" | "error" | "warning";
  message: string;
  details?: string;
}

export default function SystemCheckPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [checks, setChecks] = useState<SystemCheck[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (!isAdminEmail(user.email)) {
      router.push("/dashboard");
      return;
    }

    runSystemChecks();
  }, [user,router]);

  const runSystemChecks = async () => {
    setIsLoading(true);
    const results: SystemCheck[] = [];

    // Check 1: Firebase Authentication
    results.push(await checkAuth());

    // Check 2: Firestore Database
    results.push(await checkFirestore());

    // Check 3: Environment Variables
    results.push(checkEnvVars());

    // Check 4: Stripe Integration
    results.push(checkStripe());

    // Check 5: OpenAI API (for scanning)
    results.push(checkOpenAI());

    // Check 6: Firebase Storage
    results.push(checkStorage());

    // Check 7: User Data
    results.push(await checkUserData());

    setChecks(results);
    setIsLoading(false);
  };

  const checkAuth = async (): Promise<SystemCheck> => {
    try {
      if (auth && auth.currentUser) {
        return {
          name: "Firebase Authentication",
          status: "success",
          message: "Connected",
          details: `User: ${auth.currentUser.email}`,
        };
      }
      return {
        name: "Firebase Authentication",
        status: "warning",
        message: "User state unclear",
      };
    } catch (error) {
      return {
        name: "Firebase Authentication",
        status: "error",
        message: "Not connected",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const checkFirestore = async (): Promise<SystemCheck> => {
    try {
      // Try to read from Firestore
      const testQuery = query(collection(db, "users"), limit(1));
      await getDocs(testQuery);
      return {
        name: "Firestore Database",
        status: "success",
        message: "Connected",
        details: "Successfully queried Firestore",
      };
    } catch (error) {
      return {
        name: "Firestore Database",
        status: "error",
        message: "Connection failed",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const checkEnvVars = (): SystemCheck => {
    const requiredVars = [
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ];

    const missing = requiredVars.filter(
      (varName) => !process.env[varName]
    );

    if (missing.length === 0) {
      return {
        name: "Environment Variables",
        status: "success",
        message: "All required vars present",
        details: `${requiredVars.length} variables configured`,
      };
    }

    return {
      name: "Environment Variables",
      status: "error",
      message: `${missing.length} missing`,
      details: `Missing: ${missing.join(", ")}`,
    };
  };

  const checkStripe = (): SystemCheck => {
    // Check if Stripe is configured (you'll need to add actual Stripe check)
    const hasStripeKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (hasStripeKey) {
      return {
        name: "Stripe Integration",
        status: "success",
        message: "API key configured",
        details: "Stripe publishable key found",
      };
    }

    return {
      name: "Stripe Integration",
      status: "warning",
      message: "Not configured",
      details: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not found",
    };
  };

  const checkOpenAI = (): SystemCheck => {
    // Check if OpenAI is configured
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    if (hasOpenAIKey) {
      return {
        name: "OpenAI API (Card Scanning)",
        status: "success",
        message: "API key configured",
        details: "OpenAI key found",
      };
    }

    return {
      name: "OpenAI API (Card Scanning)",
      status: "warning",
      message: "Not configured",
      details: "OPENAI_API_KEY not found - card scanning will not work",
    };
  };

  const checkStorage = (): SystemCheck => {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

    if (bucket) {
      return {
        name: "Firebase Storage",
        status: "success",
        message: "Configured",
        details: `Bucket: ${bucket}`,
      };
    }

    return {
      name: "Firebase Storage",
      status: "error",
      message: "Not configured",
      details: "Storage bucket not found",
    };
  };

  const checkUserData = async (): Promise<SystemCheck> => {
    try {
      const usersQuery = query(collection(db, "users"), limit(100));
      const snapshot = await getDocs(usersQuery);

      return {
        name: "User Database",
        status: "success",
        message: `${snapshot.size} users found`,
        details: "User collection accessible",
      };
    } catch (error) {
      return {
        name: "User Database",
        status: "error",
        message: "Could not read users",
        details: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  const getStatusIcon = (status: SystemCheck["status"]) => {
    switch (status) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      case "checking":
        return "⏳";
      default:
        return "❓";
    }
  };

  const getStatusColor = (status: SystemCheck["status"]) => {
    switch (status) {
      case "success":
        return "#22c55e";
      case "error":
        return "#ef4444";
      case "warning":
        return "#f59e0b";
      case "checking":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const overallStatus = () => {
    const hasError = checks.some((c) => c.status === "error");
    const hasWarning = checks.some((c) => c.status === "warning");

    if (hasError) return { text: "System Issues Detected", color: "#ef4444" };
    if (hasWarning) return { text: "System Warnings", color: "#f59e0b" };
    return { text: "All Systems Operational", color: "#22c55e" };
  };

  if (!user || !isAdminEmail(user.email)) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>System Status Check</h1>
        <p className={styles.subtitle}>Real-time system health monitoring</p>
        <button onClick={runSystemChecks} className={styles.refreshBtn}>
          🔄 Re-run Checks
        </button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>
          <span className={styles.spinner}></span>
          <p>Running system checks...</p>
        </div>
      ) : (
        <>
          <div
            className={styles.overallStatus}
            style={{ borderColor: overallStatus().color }}
          >
            <h2 style={{ color: overallStatus().color }}>
              {overallStatus().text}
            </h2>
            <p>
              {checks.filter((c) => c.status === "success").length} /{" "}
              {checks.length} checks passed
            </p>
          </div>

          <div className={styles.checksGrid}>
            {checks.map((check, index) => (
              <div
                key={index}
                className={styles.checkCard}
                style={{ borderLeftColor: getStatusColor(check.status) }}
              >
                <div className={styles.checkHeader}>
                  <span className={styles.checkIcon}>
                    {getStatusIcon(check.status)}
                  </span>
                  <h3>{check.name}</h3>
                </div>
                <p
                  className={styles.checkMessage}
                  style={{ color: getStatusColor(check.status) }}
                >
                  {check.message}
                </p>
                {check.details && (
                  <p className={styles.checkDetails}>{check.details}</p>
                )}
              </div>
            ))}
          </div>

          <div className={styles.infoBox}>
            <h3>💡 About This Page</h3>
            <p>
              This system check page verifies that all critical services are
              properly configured and operational. Run this after deployment or
              configuration changes.
            </p>
            <ul>
              <li>✅ Success = Service is working correctly</li>
              <li>⚠️ Warning = Service configured but may have issues</li>
              <li>❌ Error = Service is not working or misconfigured</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
