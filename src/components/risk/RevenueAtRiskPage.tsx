import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';
import {
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Sparkles,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  CreditCard,
  ShoppingCart,
  RotateCcw,
  Receipt,
  Search,
  Layers,
  ChevronRight,
  Info,
  ShieldCheck,
  RefreshCw,
  AlertOctagon,
  Filter,
} from 'lucide-react';
import { PageId } from '../../types';

interface RevenueAtRiskPageProps {
  onNavigate: (page: PageId) => void;
}

// ─── Types from the backend /api/metrics/payment-signals response ────────────
interface PaymentSignalsMetrics {
  revenueAtRisk: number;
  affectedTransactions: number;
  potentiallyRecoverable: number;
  stoppedAmount: number;
  stoppedCount: number;
  recoveredAmount: number;
  recoveredCount: number;
  inProgressAmount: number;
  inProgressCount: number;
  recoveryRate: number | null;
  categories: {
    payment_failure: { amount: number; count: number; available: boolean };
    checkout_abandonment: { amount: number; count: number; available: boolean };
    subscription_failure: { amount: number; count: number; available: boolean };
    overdue_receivables: { amount: number; count: number; available: boolean };
  };
  reasonBreakdown: { reason: string; amount: number; count: number; percent: number }[];
  cases: {
    caseId: string;
    txId: string;
    customerName: string;
    customerEmail: string;
    avatar: string;
    amount: number;
    failureCode: string;
    failureReason: string;
    caseStatus: string;
    createdAt: string;
    recoveryProbability: number | null;
    riskLevel: 'High' | 'Medium' | 'Low';
    status: 'Recoverable' | 'Low Probability' | 'Stopped' | 'Approval Required' | 'Recovered';
    category: 'payment_failure';
  }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatINR = (val: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);

const formatINRCompact = (val: number): string => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val}`;
};

const REASON_COLORS: Record<string, string> = {
  BANK_TIMEOUT: '#4F46E5',
  INSUFFICIENT_FUNDS: '#F59E0B',
  CARD_FAILURE: '#EC4899',
  GATEWAY_ERROR: '#6366F1',
  AUTHENTICATION_FAILED: '#8B5CF6',
  UNKNOWN: '#94A3B8',
};
const getReasonColor = (code: string) =>
  REASON_COLORS[code] ?? REASON_COLORS.UNKNOWN;

const friendlyReason: Record<string, string> = {
  BANK_TIMEOUT: 'Bank / Gateway Timeout',
  INSUFFICIENT_FUNDS: 'Insufficient Funds',
  CARD_FAILURE: 'Card Failure',
  GATEWAY_ERROR: 'Gateway Error',
  AUTHENTICATION_FAILED: 'Auth Failure',
  UNKNOWN: 'Other / Unknown',
};
const getFriendlyReason = (code: string) => friendlyReason[code] ?? code;

export const RevenueAtRiskPage: React.FC<RevenueAtRiskPageProps> = ({ onNavigate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [tableSearch, setTableSearch] = useState<string>('');

  // ── Fetch state ────────────────────────────────────────────────────────────
  const [metrics, setMetrics] = useState<PaymentSignalsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/metrics/payment-signals');
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const data: PaymentSignalsMetrics = await res.json();
      setMetrics(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load payment signals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const chartReasonData = useMemo(() => {
    if (!metrics?.reasonBreakdown?.length) return [];
    return metrics.reasonBreakdown.map(r => ({
      reason: getFriendlyReason(r.reason),
      amount: r.amount,
      formatted: formatINRCompact(r.amount),
      percent: `${r.percent}%`,
      color: getReasonColor(r.reason),
    }));
  }, [metrics]);

  const filteredCases = useMemo(() => {
    if (!metrics?.cases) return [];
    return metrics.cases.filter(item => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const query = tableSearch.toLowerCase().trim();
      const matchSearch =
        !query ||
        item.customerName.toLowerCase().includes(query) ||
        item.failureReason.toLowerCase().includes(query) ||
        item.customerEmail.toLowerCase().includes(query) ||
        item.failureCode.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });
  }, [metrics, selectedCategory, tableSearch]);

  // ── Status badges ──────────────────────────────────────────────────────────
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'Recoverable':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 font-mono shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Recoverable
          </span>
        );
      case 'Recovered':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono shadow-xs">
            <CheckCircle2 className="w-3 h-3 text-blue-600" />
            Recovered
          </span>
        );
      case 'Low Probability':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono shadow-xs">
            <Clock className="w-3 h-3 text-slate-400" />
            Low Probability
          </span>
        );
      case 'Stopped':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 font-mono shadow-xs">
            <XCircle className="w-3 h-3 text-rose-600" />
            Stopped
          </span>
        );
      case 'Approval Required':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono shadow-xs">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Approval Required
          </span>
        );
      default:
        return <span className="text-slate-400 font-mono text-xs">{status}</span>;
    }
  };

  const renderRiskBadge = (risk: 'High' | 'Medium' | 'Low') => {
    switch (risk) {
      case 'High':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 font-mono">High</span>;
      case 'Medium':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/80 font-mono">Medium</span>;
      case 'Low':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 font-mono">Low</span>;
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <RefreshCw className="w-7 h-7 text-blue-500 animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Loading payment signals…</p>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center px-8">
        <AlertOctagon className="w-10 h-10 text-red-400" />
        <div>
          <p className="text-sm font-semibold text-gray-800">Unable to load payment signals</p>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const {
    revenueAtRisk,
    affectedTransactions,
    potentiallyRecoverable,
    stoppedAmount,
    recoveredAmount,
    recoveryRate,
    categories,
  } = metrics;

  // Recovery yield %
  const recoverableYield = revenueAtRisk > 0
    ? Math.round((potentiallyRecoverable / revenueAtRisk) * 100)
    : 0;

  return (
    <div id="revenue-at-risk-page" className="space-y-7 pb-12">
      {/* PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider font-mono bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded">
              ReviveAI Diagnostics
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              Live Leakage Analysis
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Payment Signals
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Identify where revenue is slipping away and understand why.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-[10px] text-slate-400 font-mono">
              Updated {lastRefreshed.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchMetrics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          {/* Workflow Breadcrumb */}
          <div className="hidden xl:flex items-center gap-1.5 px-3.5 py-1.5 bg-white/80 backdrop-blur-sm border border-slate-200/80 rounded-xl text-[11px] text-slate-600 shadow-xs font-mono">
            <span className="font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
              1. Risk
            </span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <span className="text-slate-500">2. Why</span>
            <ChevronRight className="w-3 h-3 text-slate-300" />
            <button
              onClick={() => onNavigate('recovery-opportunities')}
              className="text-indigo-600 font-bold hover:underline"
            >
              3. Recover →
            </button>
          </div>
        </div>
      </div>

      {/* TOP KPI CARDS — All values from real API */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="risk-top-kpi-grid">
        {/* KPI 1: Revenue at Risk */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-amber-200/90 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wide">Revenue at Risk</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-900 tracking-tight font-mono">
                {formatINRCompact(revenueAtRisk)}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Total uncollected volume</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-amber-500/10 text-amber-800 border border-amber-500/20">
              {revenueAtRisk > 0 ? 'Active' : 'Clear'}
            </span>
          </div>
        </div>

        {/* KPI 2: Potentially Recoverable */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-indigo-200/90 shadow-[0_2px_12px_-2px_rgba(79,70,229,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-indigo-200/40 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-900 uppercase tracking-wide">Potentially Recoverable</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
                {potentiallyRecoverable > 0 ? formatINRCompact(potentiallyRecoverable) : '₹0'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              {potentiallyRecoverable > 0
                ? `${recoverableYield}% AI-weighted recovery potential`
                : 'No open recovery cases'}
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
              AI Estimate
            </span>
          </div>
        </div>

        {/* KPI 3: Halted by Safety Gate */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-rose-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Stopped / Halted</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shadow-xs">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {stoppedAmount > 0 ? formatINRCompact(stoppedAmount) : '₹0'}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Flagged by safety sentinel</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-rose-500/10 text-rose-700 border border-rose-500/20">
              {metrics.stoppedCount > 0 ? `${metrics.stoppedCount} cases` : 'None'}
            </span>
          </div>
        </div>

        {/* KPI 4: Affected Transactions */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Failed Transactions</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                {affectedTransactions}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              {recoveredAmount > 0 ? `${formatINRCompact(recoveredAmount)} already recovered` : 'No recoveries yet'}
            </span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-blue-500/10 text-blue-700 border border-blue-500/20">
              {recoveryRate !== null ? `${recoveryRate}% rate` : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* MAIN SECTION 1 — REVENUE RISK BREAKDOWN (Category Cards) */}
      <div id="section-risk-breakdown" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              1. Revenue Risk Breakdown
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any category to filter the transaction table below
            </p>
          </div>
          {selectedCategory !== 'all' && (
            <button
              onClick={() => setSelectedCategory('all')}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60 font-mono transition-colors"
            >
              Clear Filter ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Payment Failures — REAL DATA */}
          <div
            id="risk-card-payment-failures"
            onClick={() => setSelectedCategory(selectedCategory === 'payment_failure' ? 'all' : 'payment_failure')}
            className={`p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md flex flex-col justify-between ${
              selectedCategory === 'payment_failure'
                ? 'bg-indigo-50/90 border-indigo-500 ring-2 ring-indigo-500/20'
                : 'bg-white/80 backdrop-blur-md border-slate-150/80 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Payment Failures</span>
              <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900 font-mono">
                {formatINRCompact(categories.payment_failure.amount)}
              </div>
              <div className="text-xs text-slate-500 font-medium mt-0.5">
                {categories.payment_failure.count} transactions
              </div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono">100% of tracked risk</span>
              <span className="text-indigo-600 font-bold">Inspect →</span>
            </div>
          </div>

          {/* Card 2: Checkout Abandonment — NOT TRACKED */}
          <div
            id="risk-card-checkout-abandonment"
            className="p-5 rounded-2xl border border-slate-150/80 bg-white/80 backdrop-blur-md shadow-xs flex flex-col justify-between opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Checkout Abandonment</span>
              <div className="w-7 h-7 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center">
                <ShoppingCart className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900 font-mono">₹0</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Not tracked in DB</div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono italic">No data source</span>
              <span className="text-slate-400 text-[10px] font-mono">Unavailable</span>
            </div>
          </div>

          {/* Card 3: Subscription Failures — NOT TRACKED */}
          <div
            id="risk-card-subscription-failures"
            className="p-5 rounded-2xl border border-slate-150/80 bg-white/80 backdrop-blur-md shadow-xs flex flex-col justify-between opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Subscription Failures</span>
              <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900 font-mono">₹0</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Not tracked in DB</div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono italic">No data source</span>
              <span className="text-slate-400 text-[10px] font-mono">Unavailable</span>
            </div>
          </div>

          {/* Card 4: Overdue Receivables — NOT TRACKED */}
          <div
            id="risk-card-overdue-receivables"
            className="p-5 rounded-2xl border border-slate-150/80 bg-white/80 backdrop-blur-md shadow-xs flex flex-col justify-between opacity-60 cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Overdue Receivables</span>
              <div className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center">
                <Receipt className="w-3.5 h-3.5" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-extrabold text-slate-900 font-mono">₹0</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">Not tracked in DB</div>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-mono italic">No data source</span>
              <span className="text-slate-400 text-[10px] font-mono">Unavailable</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2 font-mono">
          <Info className="w-3.5 h-3.5 shrink-0" />
          <span>Only <strong>Payment Failures</strong> are recorded in the current database. Checkout abandonment, subscription failures, and overdue receivables require additional data pipelines.</span>
        </div>
      </div>

      {/* REASON BREAKDOWN CHART */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div
          id="section-why-revenue-at-risk"
          className="lg:col-span-7 bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  2. Failure Reason Breakdown
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real failure codes from the Razorpay payment gateway
                </p>
              </div>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200/60 font-mono">
                {chartReasonData.length > 0 ? `${chartReasonData.length} Failure Types` : 'No Data'}
              </span>
            </div>

            {chartReasonData.length > 0 ? (
              <div className="h-[280px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartReasonData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 160, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      tickFormatter={(val) => formatINRCompact(val)}
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={{ stroke: '#e2e8f0' }}
                    />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                      axisLine={{ stroke: '#e2e8f0' }}
                      width={155}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-2xl border border-slate-800 text-xs font-mono">
                              <div className="font-bold text-slate-300 pb-1 mb-1.5 border-b border-slate-800">{data.reason}</div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-400">At Risk:</span>
                                <span className="font-bold text-amber-300">{data.formatted}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4 mt-1">
                                <span className="text-slate-400">Share:</span>
                                <span className="font-bold text-indigo-300">{data.percent}</span>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]} barSize={18}>
                      {chartReasonData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[280px] flex flex-col items-center justify-center text-slate-400 gap-2">
                <Filter className="w-8 h-8 opacity-30" />
                <p className="text-sm font-medium">No failure data yet</p>
                <p className="text-xs">Run a payment simulation to populate this chart.</p>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span className="text-[11px] font-mono text-slate-400">
              {chartReasonData.length} distinct failure codes · real-time from DB
            </span>
          </div>
        </div>

        {/* Recovery Performance Summary */}
        <div
          id="section-recovery-performance"
          className="lg:col-span-5 bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  3. Recovery Performance
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Outcome distribution for all cases
                </p>
              </div>
              {recoveryRate !== null && (
                <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200/60 font-mono">
                  {recoveryRate}% Success Rate
                </span>
              )}
            </div>

            <div className="mt-5 space-y-4">
              {[
                {
                  label: 'Recovered',
                  amount: metrics.recoveredAmount,
                  count: metrics.recoveredCount,
                  color: 'bg-emerald-500',
                  textColor: 'text-emerald-700',
                  bg: 'bg-emerald-50',
                  border: 'border-emerald-200',
                },
                {
                  label: 'In Progress',
                  amount: metrics.inProgressAmount,
                  count: metrics.inProgressCount,
                  color: 'bg-blue-500',
                  textColor: 'text-blue-700',
                  bg: 'bg-blue-50',
                  border: 'border-blue-200',
                },
                {
                  label: 'Stopped / Halted',
                  amount: metrics.stoppedAmount,
                  count: metrics.stoppedCount,
                  color: 'bg-rose-400',
                  textColor: 'text-rose-700',
                  bg: 'bg-rose-50',
                  border: 'border-rose-200',
                },
              ].map(item => {
                const pct = revenueAtRisk > 0 ? (item.amount / revenueAtRisk) * 100 : 0;
                return (
                  <div key={item.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-semibold ${item.textColor}`}>{item.label}</span>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className={`px-2 py-0.5 rounded ${item.bg} border ${item.border} ${item.textColor} font-bold text-[10px]`}>
                          {item.count} cases
                        </span>
                        <span className="font-bold text-slate-700">{formatINRCompact(item.amount)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${item.color} rounded-full transition-all duration-700`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{pct.toFixed(1)}% of at-risk</span>
                  </div>
                );
              })}
            </div>
          </div>

          {affectedTransactions === 0 && (
            <div className="mt-4 p-3 bg-slate-50/60 rounded-xl border border-slate-200/60 text-xs text-slate-600 flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-400 shrink-0" />
              <span>No payment failures recorded yet. Run a simulation from the Command Center to populate data.</span>
            </div>
          )}
        </div>
      </div>

      {/* TRANSACTION TABLE — Real cases from DB */}
      <div
        id="section-high-value-table"
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                4. Failed Payment Cases
              </h2>
              <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200 font-mono">
                Live from DB
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {metrics.cases.length} total cases · showing {filteredCases.length} matching filter
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Search by name, email, error code..."
              className="pl-8 pr-3.5 py-1.5 text-xs bg-slate-50/80 border border-slate-200/80 rounded-xl w-64 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/60 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150">
              <tr>
                <th className="py-3.5 px-5">Customer</th>
                <th className="py-3.5 px-5 text-right">Amount</th>
                <th className="py-3.5 px-5">Failure Code</th>
                <th className="py-3.5 px-4 text-center">Risk</th>
                <th className="py-3.5 px-5">Recovery Prob.</th>
                <th className="py-3.5 px-5 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <Layers className="w-7 h-7 opacity-30" />
                      {metrics.cases.length === 0
                        ? 'No payment failures recorded. Trigger a payment failure from the Command Center.'
                        : 'No cases match the current filter.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCases.map((item) => (
                  <tr key={item.caseId} className="hover:bg-slate-50/70 transition-colors group">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-[11px] shrink-0 border border-indigo-100 shadow-xs">
                          {item.avatar}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{item.customerName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{item.customerEmail || item.txId}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 text-sm">
                      {formatINR(item.amount)}
                    </td>

                    <td className="py-3.5 px-5">
                      <span className="font-semibold text-slate-800">{getFriendlyReason(item.failureCode)}</span>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.failureCode}</div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {renderRiskBadge(item.riskLevel)}
                    </td>

                    <td className="py-3.5 px-5 min-w-[130px]">
                      {item.recoveryProbability !== null ? (
                        <>
                          <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                            <span className={
                              item.recoveryProbability >= 70 ? 'text-emerald-700'
                              : item.recoveryProbability >= 40 ? 'text-amber-700'
                              : 'text-slate-600'
                            }>
                              {item.recoveryProbability}%
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                item.recoveryProbability >= 70 ? 'bg-emerald-500'
                                : item.recoveryProbability >= 40 ? 'bg-amber-400'
                                : 'bg-slate-400'
                              }`}
                              style={{ width: `${item.recoveryProbability}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-400 font-mono text-[10px]">Pending AI</span>
                      )}
                    </td>

                    <td className="py-3.5 px-5 text-center">
                      {renderStatusBadge(item.status)}
                    </td>

                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => onNavigate('recovery-opportunities')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        <span>Recover</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-3.5 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing <strong>{filteredCases.length}</strong> of <strong>{metrics.cases.length}</strong> cases
          </div>
          <div className="flex items-center gap-1.5 text-slate-600 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Live data from SQLite · Razorpay verified</span>
          </div>
        </div>
      </div>

      {/* BOTTOM CTA */}
      <div
        id="bottom-recovery-cta-card"
        className="bg-gradient-to-br from-[#1C1F2E] via-[#24293E] to-[#1E1B4B] rounded-2xl p-7 text-white shadow-xl border border-slate-800 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-500/30 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/30 font-mono">
              Action Plan
            </span>
            {recoverableYield > 0 && (
              <span className="text-xs text-emerald-400 font-mono font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {recoverableYield}% Recovery Yield
              </span>
            )}
          </div>

          <h3 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Ready to recover this revenue?
          </h3>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
            {potentiallyRecoverable > 0 ? (
              <>
                <strong className="text-emerald-400 font-mono text-base">{formatINRCompact(potentiallyRecoverable)}</strong> is potentially recoverable across {metrics.inProgressCount + metrics.recoveredCount} verified transaction cases.
              </>
            ) : (
              'No open recovery opportunities at this time. Trigger a payment simulation to create cases.'
            )}
          </p>
        </div>

        <div className="relative z-10 shrink-0">
          <button
            id="cta-view-recovery-opportunities-btn"
            onClick={() => onNavigate('recovery-opportunities')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all font-mono"
          >
            <span>View Recovery Opportunities</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
