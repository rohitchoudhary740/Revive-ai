import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
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
        <div className="bg-[var(--bg-surface)] text-[var(--text-primary)] p-3.5 rounded-xl shadow-xl border border-[var(--border-app)] text-xs font-mono">
          <div className="font-bold text-[var(--text-secondary)] mb-2 pb-1.5 border-b border-[var(--border-subtle)] flex items-center justify-between gap-4">
            <span>Time: {label}</span>
            <span className="text-emerald-500 font-bold">{rate}% Recovered</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-6 text-amber-500">
              <span className="text-[var(--text-secondary)]">Revenue at Risk:</span>
              <span className="font-bold">{formatINR(atRisk)}</span>
            </div>
            <div className="flex items-center justify-between gap-6 text-emerald-500">
              <span className="text-[var(--text-secondary)]">Recovered Revenue:</span>
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
      className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-app)] shadow-xs transition-colors"
    >
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border-app)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Recovery Performance Trajectory
            </h2>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full fintech-badge-success">
              +24.6% WoW
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Real-time tracking of failed payment spikes vs AI automated recovery capture
          </p>
        </div>

        {/* Time Selector Pills */}
        <div className="flex items-center bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-app)] text-xs font-semibold">
          <button
            onClick={() => setTimeRange('24h')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              timeRange === '24h'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-bold border border-[var(--border-app)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Today (24h)
          </button>
          <button
            onClick={() => setTimeRange('7d')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              timeRange === '7d'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-bold border border-[var(--border-app)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            7 Days
          </button>
          <button
            onClick={() => setTimeRange('30d')}
            className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
              timeRange === '30d'
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-bold border border-[var(--border-app)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            30 Days
          </button>
        </div>
      </div>

      {/* Chart Legend Metrics */}
      <div className="flex flex-wrap items-center gap-6 mt-4 mb-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs" />
          <span className="text-[var(--text-secondary)] font-medium">Recovered Revenue</span>
          <span className="font-bold text-[var(--text-primary)] font-mono">₹3.82 Lakh</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-2xs" />
          <span className="text-[var(--text-secondary)] font-medium">Revenue at Risk</span>
          <span className="font-bold text-[var(--text-primary)] font-mono">₹10.24 Lakh</span>
        </div>
        <div className="flex items-center gap-2 ml-auto text-[var(--text-secondary)] font-mono text-[11px]">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          <span>Avg. Recovery Efficiency: <strong className="text-[var(--text-primary)]">59.5%</strong></span>
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
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-[var(--border-subtle)] opacity-60" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-[var(--text-muted)]"
              tickLine={false}
              axisLine={{ stroke: 'currentColor' }}
            />
            <YAxis
              tickFormatter={formatINR}
              tick={{ fontSize: 11, fill: 'currentColor' }}
              className="text-[var(--text-muted)]"
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
