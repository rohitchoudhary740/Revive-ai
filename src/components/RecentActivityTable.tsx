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
      className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-app)] shadow-xs overflow-hidden transition-colors"
    >
      {/* Table Header */}
      <div className="p-6 border-b border-[var(--border-app)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Recovery Cases Telemetry
            </h2>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full fintech-badge-ai">
              Live from DB
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Active and resolved recovery cases created from failed payment signals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border-app)] text-xs font-semibold">
            {(['all', 'Completed', 'In Progress', 'Stopped', 'Awaiting Approval'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1 rounded-lg transition-all capitalize cursor-pointer ${
                  filterStatus === s
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs font-bold border border-[var(--border-app)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {s === 'all' ? `All (${statusCounts.all})` : `${s}${statusCounts[s] ? ` (${statusCounts[s]})` : ''}`}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cases..."
              className="pl-8 pr-3.5 py-1.5 text-xs bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] rounded-xl w-40 sm:w-48 text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500 focus:bg-[var(--bg-surface)] transition-all shadow-xs"
            />
          </div>

          <button
            onClick={refreshMetrics}
            title="Refresh from backend"
            className="p-2 rounded-lg border border-[var(--border-app)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error state */}
      {metricsError && (
        <div className="flex items-center gap-3 px-6 py-4 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
          <AlertOctagon className="w-4 h-4 text-amber-500 shrink-0" />
          <span>Backend unavailable: {metricsError}</span>
          <button onClick={refreshMetrics} className="ml-auto font-bold underline cursor-pointer">Retry</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-[var(--text-secondary)]">
          <thead className="bg-[var(--bg-surface-elevated)] text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono border-b border-[var(--border-app)]">
            <tr>
              <th className="py-3 px-5">Recovery ID / Customer</th>
              <th className="py-3 px-5">Failure Reason</th>
              <th className="py-3 px-5">AI Strategy</th>
              <th className="py-3 px-5 text-right">Amount</th>
              <th className="py-3 px-5 text-center">Status</th>
              <th className="py-3 px-5 text-right">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {metricsLoading ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[var(--text-muted)] text-xs">
                  <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin opacity-40 text-blue-500" />
                    <span>Loading recovery cases…</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-xs text-[var(--text-muted)]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] flex items-center justify-center">
                      <Zap className="w-5 h-5 text-[var(--text-muted)]" />
                    </div>
                    {activeRecoveries.length === 0
                      ? <>
                          <p className="font-medium text-[var(--text-secondary)]">No recovery cases in the database yet.</p>
                          <p className="text-[var(--text-muted)]">Use the <span className="font-semibold text-blue-500">Command Center</span> to simulate a payment failure and create your first case.</p>
                        </>
                      : <p className="font-medium text-[var(--text-secondary)]">No cases match the current filter.</p>
                    }
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const timeline = item.timeline || [];
                const latestEvent = timeline[timeline.length - 1];
                return (
                  <tr key={item.id} className="hover:bg-[var(--bg-surface-elevated)]/60 transition-colors group">
                    {/* ID & Customer */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0 border border-blue-500/20">
                          {item.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--text-primary)] leading-tight">{item.customerName}</div>
                          <div className="text-[10px] text-[var(--text-muted)] font-mono">{item.recoveryId}</div>
                        </div>
                      </div>
                    </td>

                    {/* Failure Reason */}
                    <td className="py-3.5 px-5 text-[var(--text-secondary)] font-medium max-w-[200px] truncate">
                      {item.problem}
                    </td>

                    {/* AI Strategy */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                        <span className="font-semibold text-[var(--text-primary)]">{item.aiAction}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                        Prob: <strong className="text-blue-600 dark:text-blue-400">{Math.round(item.recoveryProbability * 100)}%</strong>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-5 text-right font-bold text-[var(--text-primary)] font-mono text-sm">
                      {formatINR(item.amount)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-5 text-center">
                      {item.status === 'Completed' && (
                        <span className="fintech-badge fintech-badge-success">
                          <CheckCircle2 className="w-3 h-3" />
                          Recovered
                        </span>
                      )}
                      {item.status === 'In Progress' && (
                        <span className="fintech-badge fintech-badge-warn">
                          <Clock className="w-3 h-3 animate-spin" />
                          In Progress
                        </span>
                      )}
                      {item.status === 'Stopped' && (
                        <span className="fintech-badge fintech-badge-danger">
                          <XCircle className="w-3 h-3" />
                          Stopped
                        </span>
                      )}
                      {item.status === 'Awaiting Approval' && (
                        <span className="fintech-badge fintech-badge-ai">
                          <Clock className="w-3 h-3" />
                          Awaiting Approval
                        </span>
                      )}
                    </td>

                    {/* Timestamp */}
                    <td className="py-3.5 px-5 text-right text-[11px] text-[var(--text-muted)] font-medium font-mono">
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
      <div className="px-6 py-3.5 bg-[var(--bg-surface-elevated)]/50 border-t border-[var(--border-app)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <div>
          Showing <strong>{filtered.length}</strong> of <strong>{activeRecoveries.length}</strong> recovery cases
        </div>
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Live data from SQLite · Razorpay verified</span>
        </div>
      </div>
    </div>
  );
};
