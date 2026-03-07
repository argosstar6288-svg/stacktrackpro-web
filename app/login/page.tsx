"use client";

import { useState, useEffect } from "react";
import { logIn } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/useCurrentUser";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const { user } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      console.log("User logged in, redirecting to dashboard");
      router.push("/dashboard");
    }
  }, [user, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await logIn(email, password);
      console.log("Login successful, waiting for auth state...");
      // The useEffect above will handle the redirect
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <h1>Log In</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Log In"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
        <p style={{ marginTop: "12px", fontSize: "14px" }}>
          Don&apos;t have an account? <Link href="/create-account">Create Account</Link>
        </p>
      </form>
    </div>
  );
}
