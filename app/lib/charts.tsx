"use client";

import React from "react";

interface DataPoint {
  name: string;
  value?: number;
  [key: string]: any;
}

interface LineChartProps {
  data: DataPoint[];
  dataKey: string;
  height?: number;
  color?: string;
  width?: string | number;
}

interface BarChartProps {
  data: DataPoint[];
  dataKey: string;
  dataKey2?: string;
  height?: number;
  color?: string;
  width?: string | number;
}

export function CustomLineChart({ 
  data, 
  dataKey, 
  height = 250,
  color = "#10b3f0",
  width = "100%"
}: LineChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>No data</div>;
  }

  const values = data.map(d => d[dataKey] || 0);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  // Create SVG path
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1 || 1)) * 100;
    const normalized = (d[dataKey] - minValue) / range;
    const y = 100 - normalized * 80 - 10;
    return `${x},${y}`;
  });

  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        width: width,
        height: height,
        border: "1px solid #333",
        borderRadius: "6px",
        background: "#0a0a0a",
      }}
    >
      {/* Grid lines */}
      {[0, 20, 40, 60, 80, 100].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#222" strokeWidth="0.2" />
      ))}

      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth="0.5"
        vectorEffect="non-scaling-stroke"
      />

      {/* Points */}
      {data.map((d, i) => {
        const x = (i / (data.length - 1 || 1)) * 100;
        const normalized = (d[dataKey] - minValue) / range;
        const y = 100 - normalized * 80 - 10;
        return <circle key={i} cx={x} cy={y} r="0.5" fill={color} vectorEffect="non-scaling-stroke" />;
      })}

      {/* Labels */}
      <text x="2" y="95" fontSize="3" fill="#999">
        Min
      </text>
      <text x="85" y="95" fontSize="3" fill="#999" textAnchor="end">
        Max
      </text>
    </svg>
  );
}

export function CustomBarChart({ 
  data, 
  dataKey, 
  dataKey2,
  height = 250,
  color = "#10b3f0",
  width = "100%"
}: BarChartProps) {
  if (!data || data.length === 0) {
    return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "#999" }}>No data</div>;
  }

  const values = data.map(d => d[dataKey] || 0);
  const values2 = dataKey2 ? data.map(d => d[dataKey2] || 0) : [];
  const maxValue = Math.max(...values, ...(values2.length > 0 ? values2 : [0]));

  return (
    <svg
      viewBox="0 0 100 100"
      style={{
        width: width,
        height: height,
        border: "1px solid #333",
        borderRadius: "6px",
        background: "#0a0a0a",
      }}
    >
      {/* Grid lines */}
      {[0, 20, 40, 60, 80, 100].map((y) => (
        <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#222" strokeWidth="0.2" />
      ))}

      {/* Bars */}
      {data.map((d, i) => {
        const barWidth = 100 / data.length / (dataKey2 ? 2.5 : 1.5);
        const spacing = 100 / data.length;
        const value = d[dataKey] || 0;
        const normalized = (value / maxValue) * 80;
        const x = i * spacing + spacing / 4;
        const y = 90 - normalized;

        return (
          <g key={i}>
            {/* First bar */}
            <rect
              x={dataKey2 ? x : x + barWidth / 2}
              y={y}
              width={barWidth}
              height={normalized}
              fill={color}
              opacity="0.8"
            />

            {/* Second bar if provided */}
            {dataKey2 && (
              <rect
                x={x + barWidth}
                y={90 - ((d[dataKey2] || 0) / maxValue) * 80}
                width={barWidth}
                height={((d[dataKey2] || 0) / maxValue) * 80}
                fill="#ffc107"
                opacity="0.6"
              />
            )}
          </g>
        );
      })}

      {/* Labels */}
      <text x="2" y="95" fontSize="2.5" fill="#999">
        0
      </text>
      <text x="98" y="12" fontSize="2.5" fill="#999" textAnchor="end">
        {Math.round(maxValue)}
      </text>
    </svg>
  );
}
