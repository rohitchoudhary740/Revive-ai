import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Search,
  Zap,
  RefreshCw,
  AlertOctagon,
} from 'lucide-react';
import { useRecovery } from '../context/RecoveryContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusFilter = 'all' | 'Completed' | 'In Progress' | 'Stopped' | 'Awaiting Approval';

export const RecentActivityTable: React.FC = () => {
  const { activeRecoveries, metricsLoading, metricsError, refreshMetrics } = useRecovery();

  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = activeRecoveries.filter((item) => {
    const matchesFilter =
      filterStatus === 'all' ||
      item.status === filterStatus ||
      (filterStatus === 'In Progress' && item.status === 'In Progress') ||
      (filterStatus === 'Completed' && item.status === 'Completed') ||
      (filterStatus === 'Stopped' && item.status === 'Stopped') ||
      (filterStatus === 'Awaiting Approval' && item.status === 'Awaiting Approval');

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      item.customerName.toLowerCase().includes(q) ||
      item.customerEmail.toLowerCase().includes(q) ||
      item.problem.toLowerCase().includes(q) ||
      item.aiAction.toLowerCase().includes(q) ||
      item.recoveryId.toLowerCase().includes(q);

    return matchesFilter && matchesSearch;
  });

  const formatINR = (val: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  const formatTime = (ts: string) => {
    if (!ts || ts === 'Just now') return ts;
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      const diffMs = Date.now() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffH = Math.floor(diffMins / 60);
      if (diffH < 24) return `${diffH}h ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return ts;
    }
  };

  const statusCounts = {
    all: activeRecoveries.length,
    Completed: activeRecoveries.filter(r => r.status === 'Completed').length,
    'In Progress': activeRecoveries.filter(r => r.status === 'In Progress').length,
    Stopped: activeRecoveries.filter(r => r.status === 'Stopped').length,
    'Awaiting Approval': activeRecoveries.filter(r => r.status === 'Awaiting Approval').length,
  };

  return (
    <div
      id="recent-recovery-activity-card"
      className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden"
    >
      {/* Table Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              4. Recovery Cases
            </h2>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/60 font-mono">
              Live from DB
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            All recovery cases created from real failed payment events
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
            {(['all', 'Completed', 'In Progress', 'Stopped', 'Awaiting Approval'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg transition-all capitalize ${
                  filterStatus === s
                    ? 'bg-white text-indigo-600 shadow-sm font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s === 'all' ? `All (${statusCounts.all})` : `${s}${statusCounts[s] ? ` (${statusCounts[s]})` : ''}`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases..."
              className="pl-8 pr-3.5 py-1.5 text-xs bg-slate-50/80 border border-slate-200/80 rounded-xl w-40 sm:w-48 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
            />
          </div>

          <button
            onClick={refreshMetrics}
            title="Refresh from backend"
            className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error state */}
      {metricsError && (
        <div className="flex items-center gap-3 px-6 py-4 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
          <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Backend unavailable: {metricsError}</span>
          <button onClick={refreshMetrics} className="ml-auto font-bold underline">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150">
            <tr>
              <th className="py-3 px-5">Recovery ID / Customer</th>
              <th className="py-3 px-5">Failure Reason</th>
              <th className="py-3 px-5">AI Strategy</th>
              <th className="py-3 px-5 text-right">Amount</th>
              <th className="py-3 px-5 text-center">Status</th>
              <th className="py-3 px-5 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {metricsLoading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-slate-400 text-xs">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin opacity-40" />
                    <span>Loading recovery cases…</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-slate-300" />
                    </div>
                    {activeRecoveries.length === 0
                      ? <>
                          <p className="font-medium text-slate-500">No recovery cases in the database yet.</p>
                          <p className="text-slate-400">Use the <span className="font-semibold text-indigo-600">Command Center</span> to simulate a payment failure and create your first case.</p>
                        </>
                      : <p className="font-medium text-slate-500">No cases match the current filter.</p>
                    }
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const timeline = item.timeline || [];
                const latestEvent = timeline[timeline.length - 1];
                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                    {/* ID & Customer */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-[10px] shrink-0 border border-indigo-100">
                          {item.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 leading-tight">{item.customerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.recoveryId}</div>
                        </div>
                      </div>
                    </td>

                    {/* Failure Reason */}
                    <td className="py-3.5 px-5 text-slate-700 font-medium max-w-[200px] truncate">
                      {item.problem}
                    </td>

                    {/* AI Strategy */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="font-semibold text-slate-900">{item.aiAction}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        Prob: <strong className="text-indigo-600">{Math.round(item.recoveryProbability * 100)}%</strong>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-5 text-right font-bold text-slate-900 font-mono text-sm">
                      {formatINR(item.amount)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5 text-center">
                      {item.status === 'Completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono shadow-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Recovered
                        </span>
                      )}
                      {item.status === 'In Progress' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 font-mono shadow-xs">
                          <Clock className="w-3 h-3 animate-spin" />
                          In Progress
                        </span>
                      )}
                      {item.status === 'Stopped' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200/80 font-mono shadow-xs">
                          <XCircle className="w-3 h-3" />
                          Stopped
                        </span>
                      )}
                      {item.status === 'Awaiting Approval' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/80 font-mono shadow-xs">
                          <Clock className="w-3 h-3" />
                          Awaiting Approval
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-5 text-right text-[11px] text-slate-400 font-medium font-mono">
                      {latestEvent ? formatTime(latestEvent.timestamp) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div>
          Showing <strong>{filtered.length}</strong> of <strong>{activeRecoveries.length}</strong> recovery cases
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Live data from SQLite · Razorpay verified</span>
        </div>
      </div>
    </div>
  );
};
