'use client';

import React from 'react';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: number;
  color: string;
  icon?: string;
  description?: string;
}

export default function MetricCard({
  label,
  value,
  trend,
  color,
  icon,
  description,
}: MetricCardProps) {
  const isPositive = trend && trend > 0;

  return (
    <div className={styles.card} style={{ borderTopColor: color }}>
      <div className={styles.header}>
        <div className={styles.labelSection}>
          <span className={styles.label}>{label}</span>
          {description && <span className={styles.description}>{description}</span>}
        </div>
        {icon && <span className={styles.icon}>{icon}</span>}
      </div>

      <div className={styles.value}>{value}</div>

      {trend !== undefined && (
        <div className={`${styles.trend} ${isPositive ? styles.positive : styles.negative}`}>
          <span className={styles.arrow}>{isPositive ? '↑' : '↓'}</span>
          <span className={styles.trendValue}>{Math.abs(trend)}% from last period</span>
        </div>
      )}
    </div>
  );
}
