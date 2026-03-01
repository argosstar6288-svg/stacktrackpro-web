"use client";

import { useEffect, useState } from "react";
import { auth } from "../lib/firebase";
import { signInAnonymously } from "firebase/auth";

export default function FirebaseTest() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Log the config being used
    console.log("Firebase Config:", {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCN4I_INUKp1qyqLiATrH0HXFZU4Y5Iumg",
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "stacktrackpro.firebaseapp.com",
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "stacktrackpro",
    });
  }, []);

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // Try anonymous sign-in to test if Firebase is working
      const userCredential = await signInAnonymously(auth);
      setResult({
        success: true,
        message: "✅ Firebase connection successful!",
        user: userCredential.user.uid,
      });
    } catch (error: any) {
      setResult({
        success: false,
        message: "❌ Firebase connection failed",
        error: error.code,
        errorMessage: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "monospace" }}>
      <h1>Firebase Connection Test</h1>
      
      <div style={{ background: "#222", padding: "20px", borderRadius: "8px", marginTop: "20px" }}>
        <h3>Current Config:</h3>
        <div>API Key: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCN4I_INUKp1qyqLiATrH0HXFZU4Y5Iumg"}</div>
        <div>Auth Domain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "stacktrackpro.firebaseapp.com"}</div>
        <div>Project ID: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "stacktrackpro"}</div>
      </div>

      <button 
        onClick={testConnection}
        disabled={loading}
        style={{
          marginTop: "20px",
          padding: "15px 30px",
          fontSize: "16px",
          background: "#ff7a00",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: loading ? "wait" : "pointer",
        }}
      >
        {loading ? "Testing..." : "Test Firebase Connection"}
      </button>

      {result && (
        <div style={{
          marginTop: "20px",
          padding: "20px",
          background: result.success ? "#0a4d0a" : "#4d0a0a",
          borderRadius: "8px",
        }}>
          <h3>{result.message}</h3>
          {result.error && <div>Error Code: {result.error}</div>}
          {result.errorMessage && <div>Error: {result.errorMessage}</div>}
          {result.user && <div>User ID: {result.user}</div>}
        </div>
      )}

      <div style={{ marginTop: "40px", color: "#888", lineHeight: "1.6" }}>
        <h3>If you see "auth/api-key-not-valid" error:</h3>
        <ol>
          <li>Go to <a href="https://console.firebase.google.com/project/stacktrackpro/authentication/providers" target="_blank" style={{ color: "#ff7a00" }}>Firebase Console → Authentication</a></li>
          <li>Click "Get Started" if you haven't enabled Authentication yet</li>
          <li>Enable "Email/Password" sign-in method</li>
          <li>Enable "Anonymous" sign-in method (for testing)</li>
          <li>Go to Project Settings → General → Your apps → Web app</li>
          <li>Copy the EXACT config values (especially the API key)</li>
        </ol>
      </div>
    </div>
  );
}
