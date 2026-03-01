"use client";

import { useState } from "react";
import { signUp, validatePasswordStrength } from "../lib/auth";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    const validation = validatePasswordStrength(value);
    setPasswordErrors(validation.errors);
  };

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signUp(email, password, firstName, lastName);
      alert("Account created! Verification email sent. Please verify before logging in.");
      router.push("/login");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const passwordStrength = validatePasswordStrength(password);

  return (
    <div className="auth-container" style={{ maxWidth: "400px", margin: "0 auto" }}>
      <h1>Create Account</h1>
      <form onSubmit={handleSignup}>
        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
          style={{ marginBottom: "10px", padding: "8px", width: "100%", boxSizing: "border-box" }}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
          style={{ marginBottom: "10px", padding: "8px", width: "100%", boxSizing: "border-box" }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ marginBottom: "10px", padding: "8px", width: "100%", boxSizing: "border-box" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => handlePasswordChange(e.target.value)}
          required
          style={{ marginBottom: "10px", padding: "8px", width: "100%", boxSizing: "border-box" }}
        />

        {/* Password Strength Indicator */}
        {password && (
          <div style={{ marginBottom: "15px" }}>
            <div style={{ marginBottom: "8px" }}>
              <strong>Password Strength:</strong>
              <div
                style={{
                  height: "6px",
                  backgroundColor: "#ddd",
                  borderRadius: "3px",
                  marginTop: "5px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${((5 - passwordErrors.length) / 5) * 100}%`,
                    backgroundColor:
                      passwordErrors.length === 0
                        ? "#10b3f0"
                        : passwordErrors.length <= 2
                          ? "#ffc107"
                          : "#ff6b6b",
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {passwordErrors.length > 0 && (
              <ul style={{ margin: "8px 0", paddingLeft: "20px", fontSize: "12px" }}>
                {passwordErrors.map((error) => (
                  <li key={`${error}`} style={{ color: "#ff6b6b", marginBottom: "4px" }}>
                    {error}
                  </li>
                ))}
              </ul>
            )}

            {passwordStrength.isStrong && (
              <p style={{ color: "#10b3f0", margin: "8px 0", fontSize: "12px" }}>
                ✓ Strong password
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !passwordStrength.isStrong}
          style={{
            width: "100%",
            padding: "10px",
            backgroundColor: passwordStrength.isStrong ? "#10b3f0" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: passwordStrength.isStrong ? "pointer" : "not-allowed",
            fontSize: "16px",
          }}
        >
          {loading ? "Creating Account..." : "Sign Up"}
        </button>

        {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
      </form>
    </div>
  );
}
