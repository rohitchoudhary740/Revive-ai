import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { TrendingUp, BarChart2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { RECOVERY_CHART_DATA } from '../data/mockData';

export const RecoveryChart: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  // Currency Formatter for Axis & Tooltip
  const formatINR = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    }
    return `₹${(value / 1000).toFixed(0)}k`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const atRisk = payload.find((p: any) => p.dataKey === 'atRisk')?.value || 0;
      const recovered = payload.find((p: any) => p.dataKey === 'recovered')?.value || 0;
      const rate = atRisk > 0 ? ((recovered / atRisk) * 100).toFixed(1) : '0';

      return (
        <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-xl shadow-2xl border border-slate-800 text-xs font-mono">
          <div className="font-bold text-slate-300 mb-2 pb-1.5 border-b border-slate-800 flex items-center justify-between gap-4">
            <span>Time: {label}</span>
            <span className="text-emerald-400 font-bold">{rate}% Recovered</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-6 text-amber-300">
              <span className="text-slate-300">Revenue at Risk:</span>
              <span className="font-bold">{formatINR(atRisk)}</span>
            </div>
            <div className="flex items-center justify-between gap-6 text-emerald-300">
              <span className="text-slate-300">Recovered Revenue:</span>
              <span className="font-bold">{formatINR(recovered)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div
      id="revenue-recovery-chart-card"
      className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]"
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              2. Revenue Recovery Trend
            </h2>
            <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60 font-mono">
              +24.6% WoW
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of failed payment spikes vs AI automated recovery capture
          </p>
        </div>

        {/* Time Selector Pills */}
        <div className="flex items-center bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-3 py-1 rounded-lg transition-all ${
              timeRange === '24h'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today (24h)
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 rounded-lg transition-all ${
              timeRange === '7d'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 rounded-lg transition-all ${
              timeRange === '30d'
                ? 'bg-white text-indigo-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Chart Legend Metrics */}
      <div className="flex flex-wrap items-center gap-6 mt-4 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span className="text-slate-600 font-medium">Recovered Revenue</span>
          <span className="font-bold text-slate-900 font-mono">₹3.82 Lakh</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs" />
          <span className="text-slate-600 font-medium">Revenue at Risk</span>
          <span className="font-bold text-slate-900 font-mono">₹10.24 Lakh</span>
        </div>
        <div className="flex items-center gap-2 ml-auto text-slate-500 font-mono text-[11px]">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          <span>Avg. Recovery Efficiency: <strong>59.5%</strong></span>
        </div>
      </div>

      {/* Recharts Area Container */}
      <div className="h-72 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={RECOVERY_CHART_DATA}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="colorRecovered" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              tickFormatter={formatINR}
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="atRisk"
              name="Revenue at Risk"
              stroke="#f59e0b"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRisk)"
            />
            <Area
              type="monotone"
              dataKey="recovered"
              name="Recovered Revenue"
              stroke="#10b981"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRecovered)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
