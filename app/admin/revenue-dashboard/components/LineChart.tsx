'use client';

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { RevenueTrend } from '../../../lib/revenueMetrics';
import styles from './LineChart.module.css';

interface LineChartProps {
  data: RevenueTrend[];
  isLive?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.tooltip}>
        <p className={styles.tooltipLabel}>{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: ${(entry.value / 100).toFixed(2)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function LineChartComponent({ data, isLive = false }: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No data available yet</p>
      </div>
    );
  }

  const chartData = data.map(d => ({
    ...d,
    month: d.month || d.date,
  }));

  return (
    <div className={styles.chartWrapper}>
      {isLive && (
        <div className={styles.liveIndicator}>
          <span className={styles.liveDot}></span>
          <span>Live Data</span>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#fa709a" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#fa709a" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSubscriptions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#30cfd0" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#30cfd0" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFounders" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a8edea" stopOpacity={0.8} />
              <stop offset="95%" stopColor="#a8edea" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="month"
            stroke="#666"
            style={{ fontSize: '12px' }}
          />
          <YAxis
            stroke="#666"
            style={{ fontSize: '12px' }}
            label={{ value: 'Revenue ($)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ paddingTop: '20px' }}
            iconType="line"
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#fa709a"
            fillOpacity={1}
            fill="url(#colorRevenue)"
            name="Total Revenue"
          />
          <Area
            type="monotone"
            dataKey="subscriptions"
            stroke="#30cfd0"
            fillOpacity={0.3}
            fill="url(#colorSubscriptions)"
            name="Subscriptions"
          />
          <Area
            type="monotone"
            dataKey="founders"
            stroke="#a8edea"
            fillOpacity={0.3}
            fill="url(#colorFounders)"
            name="Founder Revenue"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className={styles.insight}>
        {data.length > 1 && (
          <>
            <div className={styles.insightItem}>
              <span className={styles.insightLabel}>Highest Month:</span>
              <span className={styles.insightValue}>
                ${(Math.max(...data.map(d => d.revenue)) / 100).toFixed(2)}
              </span>
            </div>
            <div className={styles.insightItem}>
              <span className={styles.insightLabel}>Average Monthly:</span>
              <span className={styles.insightValue}>
                ${(data.reduce((sum, d) => sum + d.revenue, 0) / data.length / 100).toFixed(2)}
              </span>
            </div>
            <div className={styles.insightItem}>
              <span className={styles.insightLabel}>Latest Month:</span>
              <span className={styles.insightValue}>
                ${(data[data.length - 1].revenue / 100).toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
