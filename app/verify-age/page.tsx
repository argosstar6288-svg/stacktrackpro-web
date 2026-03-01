"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useCurrentUser } from "../lib/useCurrentUser";
import styles from "./verify-age.module.css";

function VerifyAgeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useCurrentUser();
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user && !loading) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!birthMonth || !birthDay || !birthYear) {
      setError("Please enter your complete date of birth");
      return;
    }

    if (!agreedToTerms) {
      setError("You must agree to the terms to continue");
      return;
    }

    // Calculate age
    const birthDate = new Date(
      parseInt(birthYear),
      parseInt(birthMonth) - 1,
      parseInt(birthDay)
    );
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < 18) {
      setError("You must be 18 or older to create auctions on StackTrack Pro");
      return;
    }

    if (!user) {
      setError("Please log in to continue");
      return;
    }

    setSubmitting(true);

    try {
      // Save verification to Firestore
      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          isAuctionVerified: true,
          ageVerifiedAt: new Date(),
          birthDate: birthDate,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Redirect to original destination or auctions page
      const redirect = searchParams.get("redirect") || "/auctions/create";
      router.push(redirect);
    } catch (err) {
      console.error("Error verifying age:", err);
      setError("Failed to verify age. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1>Age Verification Required</h1>
          <p>You must be 18 or older to create auctions</p>
        </div>

        <form onSubmit={handleVerify} className={styles.form}>
          <div className={styles.birthdateSection}>
            <label>Date of Birth</label>
            <div className={styles.dateInputs}>
              <select
                value={birthMonth}
                onChange={(e) => setBirthMonth(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">Month</option>
                <option value="1">January</option>
                <option value="2">February</option>
                <option value="3">March</option>
                <option value="4">April</option>
                <option value="5">May</option>
                <option value="6">June</option>
                <option value="7">July</option>
                <option value="8">August</option>
                <option value="9">September</option>
                <option value="10">October</option>
                <option value="11">November</option>
                <option value="12">December</option>
              </select>

              <select
                value={birthDay}
                onChange={(e) => setBirthDay(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>

              <select
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                required
                disabled={submitting}
              >
                <option value="">Year</option>
                {Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i).map(
                  (year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className={styles.checkbox}>
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              disabled={submitting}
            />
            <label htmlFor="terms">
              I confirm that I am 18 years or older and agree to the{" "}
              <a href="/legal/terms" target="_blank">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/legal/auction-rules" target="_blank">
                Auction Rules
              </a>
            </label>
          </div>

          {error && <div className={styles.error}>{error}</div>}

          <button
            type="submit"
            className={styles.submitBtn}
            disabled={submitting || !agreedToTerms}
          >
            {submitting ? "Verifying..." : "Verify & Continue"}
          </button>

          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => router.push("/dashboard")}
            disabled={submitting}
          >
            Cancel
          </button>
        </form>

        <div className={styles.info}>
          <h3>Why do we need this?</h3>
          <p>
            Legal regulations require auction participants to be 18 years or older.
            Your information is kept private and secure.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function VerifyAgePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading...</div>
      </div>
    }>
      <VerifyAgeContent />
    </Suspense>
  );
}
