"use client";

import { useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";

export default function TestAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function testSignup() {
    setLoading(true);
    setResult(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      setResult({ success: true, action: "signup", uid: cred.user.uid, email: cred.user.email });
    } catch (error: any) {
      setResult({ success: false, action: "signup", error: error.code, message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function testLogin() {
    setLoading(true);
    setResult(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      setResult({ success: true, action: "login", uid: cred.user.uid, email: cred.user.email });
    } catch (error: any) {
      setResult({ success: false, action: "login", error: error.code, message: error.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "40px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>🔥 Direct Firebase Auth Test</h1>
      
      <div style={{ background: "#222", padding: "20px", borderRadius: "8px", marginBottom: "20px" }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "10px",
            fontSize: "16px",
            borderRadius: "4px",
            border: "1px solid #555",
            background: "#333",
            color: "#fff",
          }}
        />
        <input
          type="password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: "12px",
            marginBottom: "15px",
            fontSize: "16px",
            borderRadius: "4px",
            border: "1px solid #555",
            background: "#333",
            color: "#fff",
          }}
        />
        
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={testSignup}
            disabled={loading || !email || !password}
            style={{
              flex: 1,
              padding: "12px 24px",
              background: "#ff7a00",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: loading ? "wait" : "pointer",
              opacity: loading || !email || !password ? 0.5 : 1,
            }}
          >
            {loading ? "..." : "Create Account"}
          </button>
          
          <button
            onClick={testLogin}
            disabled={loading || !email || !password}
            style={{
              flex: 1,
              padding: "12px 24px",
              background: "#00c2ff",
              color: "white",
              border: "none",
              borderRadius: "4px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: loading ? "wait" : "pointer",
              opacity: loading || !email || !password ? 0.5 : 1,
            }}
          >
            {loading ? "..." : "Login"}
          </button>
        </div>
      </div>

      {result && (
        <div
          style={{
            padding: "20px",
            borderRadius: "8px",
            background: result.success ? "#0a4d0a" : "#4d0a0a",
            border: `2px solid ${result.success ? "#0f0" : "#f00"}`,
          }}
        >
          <h2 style={{ margin: "0 0 10px 0" }}>
            {result.success ? "✅ SUCCESS" : "❌ FAILED"}
          </h2>
          <div><strong>Action:</strong> {result.action}</div>
          {result.uid && <div><strong>User ID:</strong> {result.uid}</div>}
          {result.email && <div><strong>Email:</strong> {result.email}</div>}
          {result.error && (
            <>
              <div style={{ marginTop: "10px" }}><strong>Error Code:</strong> {result.error}</div>
              <div><strong>Message:</strong> {result.message}</div>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: "30px", padding: "20px", background: "#1a1a1a", borderRadius: "8px", fontSize: "14px", lineHeight: "1.6" }}>
        <h3 style={{ marginTop: 0 }}>Instructions:</h3>
        <ol>
          <li>Enter any email (doesn't need to be real)</li>
          <li>Enter password (min 6 characters)</li>
          <li>Click "Create Account" first</li>
          <li>If successful, you'll see a User ID</li>
          <li>Then click "Login" with same credentials</li>
          <li>If both work, Firebase is configured correctly!</li>
        </ol>
        
        <p style={{ color: "#888", marginBottom: 0 }}>
          This page directly calls Firebase Authentication without any middleware or validation layers.
          If this fails, the problem is in Google Cloud Console API settings.
        </p>
      </div>
    </div>
  );
}
