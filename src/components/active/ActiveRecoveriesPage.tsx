import React, { useState, useMemo } from 'react';
import {
  Activity,
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Eye,
  Check,
  Zap,
  ArrowRight,
  ShieldCheck,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { ACTIVE_RECOVERIES_DATA } from '../../data/activeRecoveriesData';
import { ActiveRecoveryItem, ActiveRecoveryTab, PageId } from '../../types';
import { ActiveRecoveryDrawer } from './ActiveRecoveryDrawer';
import { useRecovery } from '../../context/RecoveryContext';

interface ActiveRecoveriesPageProps {
  onNavigate?: (page: PageId) => void;
}

export const ActiveRecoveriesPage: React.FC<ActiveRecoveriesPageProps> = ({ onNavigate }) => {
  const { activeRecoveries } = useRecovery();
  const [activeTab, setActiveTab] = useState<ActiveRecoveryTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recoveries, setRecoveries] = useState<ActiveRecoveryItem[]>(activeRecoveries || ACTIVE_RECOVERIES_DATA);
  const [selectedRecovery, setSelectedRecovery] = useState<ActiveRecoveryItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  React.useEffect(() => {
    if (activeRecoveries) {
      setRecoveries(activeRecoveries);
    }
  }, [activeRecoveries]);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const filteredRecoveries = useMemo(() => {
    return recoveries.filter((item) => {
      // Tab filter
      const matchesTab =
        activeTab === 'all' ||
        (activeTab === 'in_progress' && item.status === 'In Progress') ||
        (activeTab === 'awaiting_approval' && item.status === 'Awaiting Approval') ||
        (activeTab === 'completed' && item.status === 'Completed') ||
        (activeTab === 'stopped' && item.status === 'Stopped');

      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.customerName.toLowerCase().includes(q) ||
        item.customerEmail.toLowerCase().includes(q) ||
        item.recoveryId.toLowerCase().includes(q) ||
        item.problem.toLowerCase().includes(q) ||
        item.aiAction.toLowerCase().includes(q);

      return matchesTab && matchesSearch;
    });
  }, [recoveries, activeTab, searchQuery]);

  const handleOpenDrawer = (item: ActiveRecoveryItem) => {
    setSelectedRecovery(item);
    setIsDrawerOpen(true);
  };

  const handleTogglePause = (id: string) => {
    setRecoveries((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newPaused = !item.isPaused;
          return {
            ...item,
            isPaused: newPaused,
            currentStage: newPaused ? 'Paused by Merchant' : 'Waiting for recovery window',
          };
        }
        return item;
      })
    );
  };

  const renderStatusBadge = (status: ActiveRecoveryItem['status'], isPaused?: boolean) => {
    if (isPaused) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono shadow-xs">
          <Pause className="w-3 h-3 text-amber-600" />
          Paused
        </span>
      );
    }

    switch (status) {
      case 'In Progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-mono shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
            In Progress
          </span>
        );
      case 'Awaiting Approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono shadow-xs">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Awaiting Approval
          </span>
        );
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Completed
          </span>
        );
      case 'Stopped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono shadow-xs">
            <XCircle className="w-3 h-3 text-rose-600" />
            Stopped
          </span>
        );
    }
  };

  const renderProgressSteps = (steps: ActiveRecoveryItem['progressSteps']) => {
    return (
      <div className="flex items-center gap-1.5 font-mono text-[10px]">
        {steps.map((step, idx) => {
          if (step.status === 'done') {
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/60"
                title={`${step.name}: Done`}
              >
                <span>{step.name}</span>
                <Check className="w-2.5 h-2.5 text-emerald-600" />
              </span>
            );
          }
          if (step.status === 'active') {
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-indigo-700 font-bold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/80"
                title={`${step.name}: Active / Waiting`}
              >
                <span>{step.name}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse ml-0.5" />
              </span>
            );
          }
          if (step.status === 'halted' || step.status === 'failed') {
            return (
              <span
                key={idx}
                className="inline-flex items-center gap-0.5 text-rose-700 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                title={`${step.name}: Halted`}
              >
                <span>{step.name}</span>
                <XCircle className="w-2.5 h-2.5 text-rose-600" />
              </span>
            );
          }
          return (
            <span
              key={idx}
              className="inline-flex items-center gap-0.5 text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60"
              title={`${step.name}: Pending`}
            >
              <span>{step.name}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 ml-0.5" />
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div id="active-recoveries-page" className="space-y-7 pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider font-mono bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded">
              Autonomous Execution
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              Live Agent Telemetry
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Active Recoveries
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Monitor recovery workflows currently being executed by ReviveAI.
          </p>
        </div>

        {/* Action Header Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate && onNavigate('campaigns')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <span>View Campaigns</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="active-kpi-grid">
        {/* KPI 1: Active Recoveries */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-indigo-200/90 shadow-[0_2px_12px_-2px_rgba(79,70,229,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-indigo-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                Active Recoveries
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-900 tracking-tight font-mono">
                24
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Total workflows queued</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              Live Feed
            </span>
          </div>
        </div>

        {/* KPI 2: In Progress */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-blue-200/90 shadow-[0_2px_12px_-2px_rgba(59,130,246,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                In Progress
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-900 tracking-tight font-mono">
                17
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Autonomous execution</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-blue-500/10 text-blue-700 border border-blue-500/20">
              70.8% Active
            </span>
          </div>
        </div>

        {/* KPI 3: Awaiting Approval */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-amber-200/90 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Awaiting Approval
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-900 tracking-tight font-mono">
                4
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">&gt;₹25k policy threshold</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-amber-500/10 text-amber-800 border border-amber-500/20">
              Operator Signoff
            </span>
          </div>
        </div>

        {/* KPI 4: Recovered Today */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-emerald-200/90 shadow-[0_2px_12px_-2px_rgba(16,185,129,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Recovered Today
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
                ₹86,400
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">18 rescued transactions</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
              Settled
            </span>
          </div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            { id: 'all', label: 'All (24)' },
            { id: 'in_progress', label: 'In Progress (17)' },
            { id: 'awaiting_approval', label: 'Awaiting Approval (4)' },
            { id: 'completed', label: 'Completed' },
            { id: 'stopped', label: 'Stopped' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveRecoveryTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 font-mono ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer, ID, or problem..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* MAIN TABLE */}
      <div
        id="section-active-recoveries-table"
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150">
              <tr>
                <th className="py-3.5 px-5">Customer</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-4">Problem</th>
                <th className="py-3.5 px-4">AI Action</th>
                <th className="py-3.5 px-4 text-center">Recovery Prob.</th>
                <th className="py-3.5 px-4 text-right">Expected Recovery</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-5">Progress</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecoveries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No active recoveries match your current filters.
                  </td>
                </tr>
              ) : (
                filteredRecoveries.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => handleOpenDrawer(item)}
                  >
                    {/* Customer */}
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 shadow-xs">
                          {item.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{item.customerName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {item.recoveryId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatINR(item.amount)}
                    </td>

                    {/* Problem */}
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800">{item.problem}</span>
                    </td>

                    {/* AI Action */}
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-semibold text-[11px] border border-indigo-150">
                        <Zap className="w-3 h-3 text-indigo-600" />
                        {item.aiAction}
                      </span>
                    </td>

                    {/* Recovery Probability */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`font-mono font-bold text-xs ${
                          item.recoveryProbability >= 70
                            ? 'text-emerald-700'
                            : item.recoveryProbability >= 40
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {item.recoveryProbability}%
                      </span>
                    </td>

                    {/* Expected Recovery */}
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700 text-xs">
                      {formatINR(item.expectedRecovery)}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {renderStatusBadge(item.status, item.isPaused)}
                    </td>

                    {/* Progress */}
                    <td className="py-3.5 px-5 min-w-[200px]">
                      {renderProgressSteps(item.progressSteps)}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDrawer(item);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-4 bg-slate-50/50 backdrop-blur-xs border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Showing <strong>{filteredRecoveries.length}</strong> active recovery workflows
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>ReviveAI Sentinel Guard: Active</span>
          </div>
        </div>
      </div>

      {/* DETAIL DRAWER */}
      <ActiveRecoveryDrawer
        recovery={selectedRecovery}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onTogglePause={handleTogglePause}
      />
    </div>
  );
};
