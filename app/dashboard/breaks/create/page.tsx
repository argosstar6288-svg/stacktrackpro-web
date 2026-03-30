"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import styles from "../breaks.module.css";

export default function CreateBreakPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    title: "",
    productName: "",
    breakType: "random",
    spotCount: 30,
    spotPrice: 25,
    minFillRequirement: 20,
    scheduledAt: "",
    shippingRules: "Ships in 2-3 business days after break completion.",
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Authentication required");

      const response = await fetch("/api/breaks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "Failed to create break");

      router.push(`/dashboard/breaks/${encodeURIComponent(payload.breakId)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create break");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Seller Setup</p>
          <h1 className={styles.title}>Create A Break</h1>
        </div>
      </div>

      <form className={styles.form} onSubmit={submit}>
        <div className={styles.formGrid}>
          <label className={styles.field}>
            <span>Break Title</span>
            <input
              className={styles.input}
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="2024 Topps Jumbo Random Team"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Product</span>
            <input
              className={styles.input}
              value={form.productName}
              onChange={(event) => setForm((prev) => ({ ...prev, productName: event.target.value }))}
              placeholder="Topps Chrome Hobby Box"
              required
            />
          </label>

          <label className={styles.field}>
            <span>Break Type</span>
            <select
              className={styles.select}
              value={form.breakType}
              onChange={(event) => setForm((prev) => ({ ...prev, breakType: event.target.value }))}
            >
              <option value="team">Team</option>
              <option value="random">Random Team</option>
              <option value="pyt">Pick Your Team (PYT)</option>
              <option value="hit-draft">Hit Draft</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Spots</span>
            <input
              className={styles.input}
              type="number"
              min={2}
              max={100}
              value={form.spotCount}
              onChange={(event) => setForm((prev) => ({ ...prev, spotCount: Number(event.target.value || 2) }))}
            />
          </label>

          <label className={styles.field}>
            <span>Price Per Spot</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              step="0.01"
              value={form.spotPrice}
              onChange={(event) => setForm((prev) => ({ ...prev, spotPrice: Number(event.target.value || 1) }))}
            />
          </label>

          <label className={styles.field}>
            <span>Minimum Fill</span>
            <input
              className={styles.input}
              type="number"
              min={1}
              value={form.minFillRequirement}
              onChange={(event) => setForm((prev) => ({ ...prev, minFillRequirement: Number(event.target.value || 1) }))}
            />
          </label>

          <label className={styles.field}>
            <span>Scheduled Time</span>
            <input
              className={styles.input}
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(event) => setForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
            />
          </label>
        </div>

        <label className={styles.field}>
          <span>Shipping Rules</span>
          <textarea
            className={styles.textarea}
            value={form.shippingRules}
            onChange={(event) => setForm((prev) => ({ ...prev, shippingRules: event.target.value }))}
          />
        </label>

        {error && <p className={styles.error}>{error}</p>}
        <button className={styles.submit} disabled={loading} type="submit">
          {loading ? "Creating..." : "Create Break"}
        </button>
      </form>
    </div>
  );
}
