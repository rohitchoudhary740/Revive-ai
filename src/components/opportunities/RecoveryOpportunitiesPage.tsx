import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Search,
  Zap,
  SlidersHorizontal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Target,
  ShieldCheck,
  Filter,
  ArrowUpDown,
  FileSpreadsheet,
  AlertOctagon,
  RefreshCw,
} from 'lucide-react';
import {
  RecoveryOpportunity,
  OpportunityFilterOption,
  OpportunitySortOption,
  OpportunityStatus,
} from '../../types';
import { AnalysisDrawer } from './AnalysisDrawer';

interface OpportunitySummary {
  potentiallyRecoverable: number;
  recoveryOpportunitiesCount: number;
  expectedRecovery: number;
  needApprovalCount: number;
  netYieldPercent: number;
}

export const RecoveryOpportunitiesPage: React.FC = () => {
  const [opportunities, setOpportunities] = useState<RecoveryOpportunity[]>([]);
  const [summary, setSummary] = useState<OpportunitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<OpportunityFilterOption>('all');
  const [activeSort, setActiveSort] = useState<OpportunitySortOption>('expected_recovery');
  const [selectedOpportunityId, setSelectedOpportunityId] = useState<string | null>(null);
  const [executedIds, setExecutedIds] = useState<Set<string>>(new Set());

  const fetchOpportunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let res = await fetch('/api/recovery/opportunities');
      if (!res.ok) {
        // Fallback to /api/recovery/cases if /api/recovery/opportunities route is not yet loaded
        res = await fetch('/api/recovery/cases');
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        const cases: any[] = await res.json();
        const opps: RecoveryOpportunity[] = cases.map((c) => {
          const prob = Math.round((c.recoveryProbability || 0.75) * (c.recoveryProbability > 1 ? 1 : 100));
          const amt = c.amount || 0;
          return {
            id: c.id,
            customerName: c.customerName || 'Valued Customer',
            customerEmail: c.customerEmail || 'customer@example.com',
            customerType: amt >= 25000 ? 'Enterprise Client' : amt >= 10000 ? 'B2B Merchant' : 'B2C Customer',
            avatar: c.avatar || 'CU',
            paymentId: c.recoveryId || c.id,
            amount: amt,
            problem: c.problem || 'Payment failure',
            category: 'payment_failure',
            recoveryProbability: prob,
            expectedRecovery: c.expectedRecovery || Math.round((amt * prob) / 100),
            recommendation: {
              type: c.status === 'Stopped' ? 'stop' : 'delayed_retry',
              actionText: c.status === 'Stopped' ? 'STOP' : (c.aiAction || 'Delayed retry'),
              iconType: c.status === 'Stopped' ? 'stop' : 'lightning',
              detailedAction: c.aiRecommendation || 'Autonomous recovery route queued.',
              reason: c.problem || 'Transient bank failure detected.',
            },
            status: c.status === 'Stopped' ? 'stopped' : c.status === 'Awaiting Approval' ? 'approval_required' : prob < 30 ? 'low_probability' : 'recoverable',
            analysis: {
              rootCause: c.problem || 'Payment failure',
              aiConfidence: 88,
              evidence: [
                `Failure: ${c.problem || 'Payment Declined'}`,
                `Case ID: ${c.recoveryId || c.id}`,
                `Amount: ₹${amt.toLocaleString('en-IN')}`,
              ],
              safetyChecks: (c.safetyChecks || []).map((s: any) => ({
                label: typeof s === 'string' ? s : s.label || s.name || 'Safety Check',
                passed: typeof s === 'object' && s.passed !== undefined ? s.passed : true,
              })),
            },
          };
        });
        setOpportunities(opps);
        return;
      }
      const data = await res.json();
      setOpportunities(data.opportunities || []);
      setSummary(data.summary || null);
    } catch (err: any) {
      console.error('[RecoveryOpportunities] Error fetching data:', err);
      setError(err.message || 'Failed to load recovery opportunities');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const selectedOpportunity = useMemo(() => {
    return opportunities.find((o) => o.id === selectedOpportunityId) || null;
  }, [opportunities, selectedOpportunityId]);

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const formatINRCompact = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  // Derived or backend summary metrics
  const displaySummary = useMemo(() => {
    if (summary) return summary;
    const potentiallyRecoverable = opportunities
      .filter((o) => o.status !== 'stopped')
      .reduce((sum, o) => sum + o.amount, 0);
    const expectedRecovery = opportunities
      .filter((o) => o.status !== 'stopped')
      .reduce((sum, o) => sum + o.expectedRecovery, 0);
    const needApprovalCount = opportunities
      .filter((o) => o.status === 'approval_required')
      .length;
    return {
      potentiallyRecoverable,
      recoveryOpportunitiesCount: opportunities.length,
      expectedRecovery,
      needApprovalCount,
      netYieldPercent: potentiallyRecoverable > 0
        ? Math.round((expectedRecovery / potentiallyRecoverable) * 1000) / 10
        : 0,
    };
  }, [summary, opportunities]);

  const handleExecuteRecovery = async (id: string) => {
    setExecutedIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/recovery/cases/${id}/approve`, { method: 'POST' });
    } catch (err) {
      console.warn('[RecoveryOpportunities] Approve error:', err);
    }
    setOpportunities((prev) =>
      prev.map((opp) => {
        if (opp.id === id) {
          return {
            ...opp,
            status: 'in_progress' as OpportunityStatus,
          };
        }
        return opp;
      })
    );
  };

  // Filter and Sort Logic
  const filteredAndSortedOpportunities = useMemo(() => {
    return opportunities
      .filter((item) => {
        // Search query check
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          item.customerName.toLowerCase().includes(query) ||
          item.paymentId.toLowerCase().includes(query) ||
          item.problem.toLowerCase().includes(query) ||
          item.customerEmail.toLowerCase().includes(query);

        if (!matchesSearch) return false;

        // Filter tab check
        if (activeFilter === 'all') return true;
        if (activeFilter === 'high_value') return item.amount >= 25000;
        if (activeFilter === 'high_probability') return item.recoveryProbability >= 75;
        if (activeFilter === 'payment_failure') return item.category === 'payment_failure';
        if (activeFilter === 'checkout_abandonment') return item.category === 'checkout_abandonment';
        if (activeFilter === 'subscription_failure') return item.category === 'subscription_failure';

        return true;
      })
      .sort((a, b) => {
        if (activeSort === 'expected_recovery') {
          return b.expectedRecovery - a.expectedRecovery;
        }
        if (activeSort === 'amount') {
          return b.amount - a.amount;
        }
        if (activeSort === 'recovery_probability') {
          return b.recoveryProbability - a.recoveryProbability;
        }
        return 0;
      });
  }, [opportunities, searchQuery, activeFilter, activeSort]);

  // Helper for recommendation badge
  const renderRecommendationBadge = (opp: RecoveryOpportunity) => {
    const rec = opp.recommendation;
    if (rec.type === 'stop') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs font-mono">
          <AlertOctagon className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>STOP</span>
        </div>
      );
    }
    if (rec.type === 'reminder_later') {
      return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-xs">
          <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>Send reminder later</span>
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs">
        <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
        <span>{rec.actionText}</span>
      </div>
    );
  };

  // Helper for status badge
  const renderStatusBadge = (status: OpportunityStatus) => {
    switch (status) {
      case 'recoverable':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Recoverable
          </span>
        );
      case 'approval_required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300/80 font-mono shadow-xs">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Approval Required
          </span>
        );
      case 'low_probability':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono shadow-xs">
            <Clock className="w-3 h-3 text-slate-400" />
            Low Probability
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono shadow-xs">
            <XCircle className="w-3 h-3 text-rose-600" />
            Stopped
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.8 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono shadow-xs">
            <Clock className="w-3 h-3 text-indigo-600 animate-spin" />
            In Progress
          </span>
        );
    }
  };

  return (
    <div id="recovery-opportunities-page" className="space-y-6 pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider font-mono bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded">
              ReviveAI Engine
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              Live Priority Queue
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Recovery Opportunities
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            AI-ranked opportunities based on expected recovered revenue.
          </p>
        </div>

        {/* Live sync pill & export */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/70 rounded-xl text-xs font-semibold text-emerald-700 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-mono">Auto-Ranked by AI</span>
          </div>

          <button
            onClick={() => fetchOpportunities()}
            title="Refresh opportunities"
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200 transition-all shadow-xs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="opportunities-kpi-grid">
        {/* KPI 1: Potentially Recoverable */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-indigo-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Potentially Recoverable
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shadow-xs">
                <Target className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {formatINRCompact(displaySummary.potentiallyRecoverable)}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Failed transaction pool</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              Active
            </span>
          </div>
        </div>

        {/* KPI 2: Recovery Opportunities */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Recovery Opportunities
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-xs">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {displaySummary.recoveryOpportunitiesCount}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Actionable high-confidence cases</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-blue-500/10 text-blue-700 border border-blue-500/20">
              Ranked
            </span>
          </div>
        </div>

        {/* KPI 3: Expected Recovery */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-indigo-200/90 shadow-[0_2px_12px_-2px_rgba(79,70,229,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-200/40 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">
                Expected Recovery
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
                {formatINRCompact(displaySummary.expectedRecovery)}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">Weighted probability yield</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
              {displaySummary.netYieldPercent}% Net
            </span>
          </div>
        </div>

        {/* KPI 4: Need Approval */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-200/40 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Need Approval
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {displaySummary.needApprovalCount}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Above merchant threshold</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-amber-500/10 text-amber-800 border border-amber-500/20">
              High Value
            </span>
          </div>
        </div>
      </div>

      {/* FILTER / SEARCH / CONTROLS AREA */}
      <div
        id="opportunities-filter-bar"
        className="bg-white/80 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col lg:flex-row lg:items-center justify-between gap-4"
      >
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="search-opportunities-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search customer or payment ID..."
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50/90 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 placeholder:text-slate-400 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filters and Sort Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/80 backdrop-blur-sm p-1 rounded-xl border border-slate-200/80 text-xs">
            <button
              id="filter-tab-all"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                activeFilter === 'all'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              id="filter-tab-high-value"
              onClick={() => setActiveFilter('high_value')}
              className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                activeFilter === 'high_value'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              High Value
            </button>
            <button
              id="filter-tab-high-prob"
              onClick={() => setActiveFilter('high_probability')}
              className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                activeFilter === 'high_probability'
                  ? 'bg-white text-emerald-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              High Probability
            </button>
            <button
              id="filter-tab-payment-failure"
              onClick={() => setActiveFilter('payment_failure')}
              className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                activeFilter === 'payment_failure'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Payment Failure
            </button>
            <button
              id="filter-tab-checkout-abandon"
              onClick={() => setActiveFilter('checkout_abandonment')}
              className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                activeFilter === 'checkout_abandonment'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Checkout Abandonment
            </button>
            <button
              id="filter-tab-subscription-fail"
              onClick={() => setActiveFilter('subscription_failure')}
              className={`px-3 py-1.5 rounded-lg transition-all text-xs font-semibold ${
                activeFilter === 'subscription_failure'
                  ? 'bg-white text-indigo-600 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Subscription Failure
            </button>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200/80 px-3 py-1.5 rounded-xl shadow-xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Sort:</span>
            <select
              id="sort-opportunities-select"
              value={activeSort}
              onChange={(e) => setActiveSort(e.target.value as OpportunitySortOption)}
              className="text-xs font-semibold text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="expected_recovery">Expected Recovery</option>
              <option value="amount">Amount</option>
              <option value="recovery_probability">Recovery Probability</option>
            </select>
          </div>
        </div>
      </div>

      {/* MAIN TABLE */}
      <div
        id="opportunities-main-table-card"
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150">
              <tr>
                <th className="py-3.5 px-5">Customer</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4 text-right">Amount</th>
                <th className="py-3.5 px-5">Problem</th>
                <th className="py-3.5 px-5">Recovery Probability</th>
                <th className="py-3.5 px-5 text-right">
                  <span className="text-indigo-600 font-black">★ Expected Recovery</span>
                </th>
                <th className="py-3.5 px-5">AI Recommendation</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAndSortedOpportunities.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-6 h-6 text-slate-300" />
                      <p className="font-semibold text-slate-700">No opportunities match the criteria</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setActiveFilter('all');
                        }}
                        className="text-xs font-bold text-indigo-600 hover:underline mt-1"
                      >
                        Reset filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedOpportunities.map((opp) => {
                  const isSelected = selectedOpportunityId === opp.id;
                  const isHighExpected = opp.expectedRecovery >= 15000;

                  return (
                    <tr
                      key={opp.id}
                      id={`opportunity-row-${opp.id}`}
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isSelected ? 'bg-indigo-50/40 ring-1 ring-inset ring-indigo-500/30' : ''
                      }`}
                    >
                      {/* Customer */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100 shadow-xs">
                            {opp.avatar}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{opp.customerName}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {opp.customerEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="py-4 px-4 font-mono text-slate-600 text-xs">
                        <span className="px-2 py-0.5 bg-slate-100/90 rounded-md border border-slate-200/80 text-[11px]">
                          {opp.paymentId}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-4 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                        {formatINR(opp.amount)}
                      </td>

                      {/* Problem */}
                      <td className="py-4 px-5">
                        <span className="font-semibold text-slate-800 block">
                          {opp.problem}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize">
                          {opp.category.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Recovery Probability */}
                      <td className="py-4 px-5 min-w-[140px]">
                        <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                          <span
                            className={
                              opp.recoveryProbability >= 70
                                ? 'text-emerald-700'
                                : opp.recoveryProbability >= 40
                                ? 'text-amber-700'
                                : 'text-slate-600'
                            }
                          >
                            {opp.recoveryProbability}%
                          </span>
                          <span className="text-[10px] text-slate-400 font-normal">
                            {opp.recoveryProbability >= 75 ? 'High' : opp.recoveryProbability >= 50 ? 'Med' : 'Low'}
                          </span>
                        </div>
                        {/* Mini progress bar */}
                        <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              opp.recoveryProbability >= 70
                                ? 'bg-gradient-to-r from-emerald-500 to-indigo-600'
                                : opp.recoveryProbability >= 40
                                ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                                : 'bg-slate-400'
                            }`}
                            style={{ width: `${opp.recoveryProbability}%` }}
                          />
                        </div>
                      </td>

                      {/* Expected Recovery (CORE VISUAL DIFFERENTIATOR) */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`font-mono text-sm font-extrabold ${
                              isHighExpected
                                ? 'text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded-lg border border-indigo-200/60'
                                : 'text-slate-900 font-bold'
                            }`}
                          >
                            {formatINR(opp.expectedRecovery)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {opp.recoveryProbability}% of {formatINR(opp.amount)}
                          </span>
                        </div>
                      </td>

                      {/* AI Recommendation */}
                      <td className="py-4 px-5">
                        {renderRecommendationBadge(opp)}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        {renderStatusBadge(opp.status)}
                      </td>

                      {/* Action: View Analysis */}
                      <td className="py-4 px-5 text-right">
                        <button
                          id={`view-analysis-btn-${opp.id}`}
                          onClick={() => setSelectedOpportunityId(opp.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200/80 shadow-xs hover:shadow transition-all active:scale-[0.98] group/btn shrink-0"
                        >
                          <span>View Analysis</span>
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-500 group-hover/btn:translate-x-0.5 transition-transform" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="px-6 py-4 bg-slate-50/50 backdrop-blur-xs border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <strong>{filteredAndSortedOpportunities.length}</strong> of{' '}
            <strong>{opportunities.length}</strong> AI-ranked recovery opportunities
          </div>
          <div className="flex items-center gap-2 text-slate-600 font-medium">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>AI Risk Threshold Engine: ₹25,000 Auto-Approval Ceiling</span>
          </div>
        </div>
      </div>

      {/* RIGHT-SIDE ANALYSIS DRAWER */}
      <AnalysisDrawer
        opportunity={selectedOpportunity}
        isOpen={Boolean(selectedOpportunity)}
        onClose={() => setSelectedOpportunityId(null)}
        onExecuteRecovery={handleExecuteRecovery}
        isExecuted={selectedOpportunity ? executedIds.has(selectedOpportunity.id) : false}
      />
    </div>
  );
};
