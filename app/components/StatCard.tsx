import styles from "./StatCard.module.css";

interface StatCardProps {
  label: string;
  value: string | number;
  loading?: boolean;
  subtitle?: string;
}

export default function StatCard({ label, value, loading = false, subtitle }: StatCardProps) {
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <strong className={styles.value}>{loading ? "Loading..." : value}</strong>
      {subtitle ? <span className={styles.subtitle}>{subtitle}</span> : null}
    </div>
  );
}
