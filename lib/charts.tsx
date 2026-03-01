import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export interface ChartData {
  name: string;
  [key: string]: string | number;
}

interface LineChartProps {
  data: ChartData[];
  dataKey: string;
  title?: string;
  height?: number;
  color?: string;
}

type AreaChartProps = LineChartProps;

interface BarChartProps extends LineChartProps {
  dataKey2?: string;
}

export function CustomLineChart({
  data,
  dataKey,
  title = "Chart",
  height = 300,
  color = "#10b3f0",
}: LineChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="name" stroke="#999" />
        <YAxis stroke="#999" />
        <Tooltip 
          contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          dot={false}
          strokeWidth={2}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function CustomAreaChart({
  data,
  dataKey,
  title = "Chart",
  height = 300,
  color = "#10b3f0",
}: AreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="name" stroke="#999" />
        <YAxis stroke="#999" />
        <Tooltip 
          contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fillOpacity={1}
          fill="url(#colorValue)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CustomBarChart({
  data,
  dataKey,
  dataKey2,
  title = "Chart",
  height = 300,
  color = "#10b3f0",
}: BarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="name" stroke="#999" />
        <YAxis stroke="#999" />
        <Tooltip 
          contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333" }}
          labelStyle={{ color: "#fff" }}
        />
        <Legend />
        <Bar dataKey={dataKey} fill={color} />
        {dataKey2 && <Bar dataKey={dataKey2} fill="#ffc107" />}
      </BarChart>
    </ResponsiveContainer>
  );
}
