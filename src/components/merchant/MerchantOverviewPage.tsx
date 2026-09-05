import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Activity,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Loader2,
  ServerCrash,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
} from 'lucide-react';
import { PageId } from '../../types';

interface RecoveryCaseFromApi {
  id: string;
  recoveryId: string;
  customerName: string;
  customerEmail: string;
  avatar: string;
  amount: number;
  problem: string;
  aiAction: string;
  recoveryProbability: number;
  expectedRecovery: number;
  status: string;
  currentStage: string;
  progressSteps: { name: string; status: string }[];
  timeline: { title: string; description?: string; timestamp: string; status: string }[];
  aiRecommendation: string;
  safetyChecks: { name?: string; label?: string; passed: boolean; detail?: string }[];
  guardrailDecision?: string | null;
  paymentUrl: string | null;
}

interface MerchantOverviewPageProps {
  onNavigate: (page: PageId) => void;
}

type SortField = 'amount' | 'recoveryProbability' | 'expectedRecovery' | 'status';
type SortDir = 'asc' | 'desc';

// ─── Revenue Leak Types (demo scenario simulator) ───────────────────────────
// Each option is a DEMO/TEST scenario — there is no live checkout, subscription,
// or receivables integration. Selecting one and simulating sends a scenario
// through the EXISTING recovery pipeline (POST /api/recovery/failures →
// real Gemini diagnosis → real policy engine → real case lifecycle). The leak
// type is encoded in failureCode and the scenario context in failureReason, so
// no schema/API changes are required. Cases only ever become "Recovered" when
// their real backend status is Completed — this simulator never fakes that.
type LeakKey = 'payment_failure' | 'checkout_abandonment' | 'subscription_halt' | 'overdue_receivable';

interface LeakScenario {
  key: LeakKey;
  label: string;
  failureCode: string;
  amount: number;
  idPrefix: string;
  customer: { name: string; email: string; phone: string };
  reason: string;
}

// Labels below are fixed by product spec — do not rename.
const LEAK_SCENARIOS: LeakScenario[] = [
  {
    key: 'payment_failure',
    label: 'Payment Failure',
    failureCode: 'BANK_TIMEOUT',
    amount: 4999,
    idPrefix: 'demo_pf',
    customer: { name: 'Demo Rahul Verma', email: 'demo.rahul@example.com', phone: '+919000000001' },
    reason:
      'Demo scenario — UPI payment failed during authorization: temporary bank gateway timeout (504). Payment method: UPI.',
  },
  {
    key: 'checkout_abandonment',
    label: 'Checkout Abandonment',
    failureCode: 'CHECKOUT_ABANDONMENT',
    amount: 7499,
    idPrefix: 'demo_chk',
    customer: { name: 'Demo Sneha Iyer', email: 'demo.sneha@example.com', phone: '+919000000002' },
    reason:
      'Demo scenario — Checkout abandoned ~2h 15m ago at the payment step. Cart items reserved; no payment attempt was completed. Context: customer left after selecting UPI.',
  },
  {
    key: 'subscription_halt',
    label: 'Subscription Halt',
    failureCode: 'SUBSCRIPTION_HALT',
    amount: 1299,
    idPrefix: 'demo_sub',
    customer: { name: 'Demo Arjun Nair', email: 'demo.arjun@example.com', phone: '+919000000003' },
    reason:
      'Demo scenario — Subscription halted: recurring charge failed (mandate declined / insufficient balance). Plan: Pro Monthly, billing cycle 8; last successful charge 32 days ago.',
  },
  {
    key: 'overdue_receivable',
    label: 'Overdue Receivable',
    failureCode: 'OVERDUE_RECEIVABLE',
    amount: 48500,
    idPrefix: 'demo_inv',
    customer: { name: 'Demo Meridian Textiles', email: 'demo.ap@meridian.example', phone: '+919000000004' },
    reason:
      'Demo scenario — B2B invoice overdue by 21 days, outstanding balance unpaid past net-30 terms. Dispute status: undisputed.',
  },
];

// Recovery Guardrails — merchant-configurable policy boundaries (mirrors the
// server GuardrailConfig; edited here, enforced by the backend policy engine).
type AgentMode = 'auto_recover' | 'review_first' | 'manual_only';

interface GuardrailConfig {
  maxAutoRecoveryAmount: number;
  minRecoveryProbability: number; // 0..1
  maxAutomatedRetries: number;
  highValueRequiresApproval: boolean;
  lowConfidenceStops: boolean;
  agentMode: AgentMode;
}

const AGENT_MODES: { key: AgentMode; label: string }[] = [
  { key: 'auto_recover', label: 'Auto Recover' },
  { key: 'review_first', label: 'Review First' },
  { key: 'manual_only', label: 'Manual Only' },
];

// Client-side mirror of the server's DEFAULT_GUARDRAILS. State is seeded with
// these so the panel renders immediately on mount; a successful
// GET /api/guardrails then overwrites them with the true active config. Values
// match server/services/guardrailConfig.ts DEFAULT_GUARDRAILS.
const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxAutoRecoveryAmount: 25000,
  minRecoveryProbability: 0.3,
  maxAutomatedRetries: 3,
  highValueRequiresApproval: true,
  lowConfidenceStops: true,
  agentMode: 'auto_recover',
};

// Truthful, active-guardrail-aware one-line explanation of WHY a case was
// allowed / escalated / stopped. Every value is real: amount + probability come
// from the case, thresholds from the ACTIVE merchant guardrails, and the reason
// from the real backend policy verdict / lifecycle status — nothing fabricated.
const cleanVerdict = (s?: string | null): string =>
  (s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

const buildGuardrailExplanation = (c: RecoveryCaseFromApi, cfg: GuardrailConfig): string => {
  const amt = `₹${Math.round(c.amount).toLocaleString('en-IN')}`;
  const limit = `₹${cfg.maxAutoRecoveryAmount.toLocaleString('en-IN')}`;
  const probPct = Math.round((c.recoveryProbability || 0) * 100);
  const minPct = Math.round(cfg.minRecoveryProbability * 100);

  if (c.status === 'Awaiting Approval' || c.status === 'Stopped') {
    // Prefer the authoritative reason emitted by the backend policy engine.
    const real = cleanVerdict(c.guardrailDecision);
    if (real) return `Guardrail: ${real}`;
    return c.status === 'Stopped'
      ? 'Guardrail: recovery halted by policy → Stopped'
      : 'Guardrail: held for merchant approval → Human Approval';
  }
  // Auto-recovery path: the approved verdict carries no numbers, so spell them out.
  return `Guardrail: ${amt} ≤ ${limit} auto-limit; ${probPct}% ≥ ${minPct}% confidence → Auto Recovery`;
};

const formatCurrency = (val: number): string => {
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3" /> Recovered
        </span>
      );
    case 'Stopped':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
          <XCircle className="w-3 h-3" /> Stopped
        </span>
      );
    case 'Awaiting Approval':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Clock className="w-3 h-3" /> Awaiting Approval
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Activity className="w-3 h-3" /> In Progress
        </span>
      );
  }
};

const strategyIcon = (action: string) => {
  if (action.toLowerCase().includes('whatsapp'))
    return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
  return <Zap className="w-3.5 h-3.5 text-amber-500" />;
};

export const MerchantOverviewPage: React.FC<MerchantOverviewPageProps> = ({ onNavigate }) => {
  const [cases, setCases] = useState<RecoveryCaseFromApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('amount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [sweepRunning, setSweepRunning] = useState(false);
  const [showSweepResults, setShowSweepResults] = useState(false);

  // Revenue Leak Type demo simulator state
  const [selectedLeak, setSelectedLeak] = useState<LeakKey>('payment_failure');
  const [simulating, setSimulating] = useState(false);
  const [simMsg, setSimMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  // Recovery Guardrails state — `guardrails` is the ACTIVE server config, `draft`
  // is the merchant's in-progress edit. Seeded with client-side defaults so the
  // panel renders immediately; the mount fetch overwrites them with the server's
  // true active config when it resolves.
  const [guardrails, setGuardrails] = useState<GuardrailConfig | null>(DEFAULT_GUARDRAILS);
  const [guardrailDraft, setGuardrailDraft] = useState<GuardrailConfig | null>(DEFAULT_GUARDRAILS);
  const [savingGuardrails, setSavingGuardrails] = useState(false);
  const [guardrailMsg, setGuardrailMsg] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/recovery/cases');
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setCases(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch recovery cases');
    } finally {
      setLoading(false);
    }
  };

  // Refresh the case list without flipping the full-page loading state — used
  // after a demo scenario is submitted so the new case (and its real, evolving
  // backend status) appears in-place without a spinner flash.
  const refreshCasesSilently = async () => {
    try {
      const res = await fetch('/api/recovery/cases');
      if (res.ok) setCases(await res.json());
    } catch {
      /* keep existing data on transient error */
    }
  };

  // Submit the selected Revenue Leak Type as a demo scenario through the
  // existing recovery pipeline. No new endpoint, no schema change: the leak
  // type rides in failureCode and the scenario context in failureReason.
  const simulateScenario = async () => {
    const scenario = LEAK_SCENARIOS.find((s) => s.key === selectedLeak);
    if (!scenario || simulating) return;

    setSimulating(true);
    setSimMsg(null);

    const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const primaryId = `${scenario.idPrefix}_${suffix}`;
    const orderId = `${scenario.idPrefix}_ord_${suffix}`;

    try {
      const res = await fetch('/api/recovery/failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: primaryId,
          orderId,
          amount: scenario.amount,
          customer: scenario.customer,
          failureCode: scenario.failureCode,
          failureReason: `${scenario.reason} [ref: ${primaryId}]`,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server responded with ${res.status}`);
      }

      const data = await res.json();
      setSimMsg({
        type: 'ok',
        text: `Demo "${scenario.label}" case created (${data.caseId}). Running real AI diagnosis + policy check — status updates below.`,
      });

      // The backend pipeline runs asynchronously; refresh now (shows the new
      // case) and again shortly after (shows its settled real status).
      refreshCasesSilently();
      setTimeout(refreshCasesSilently, 2600);
    } catch (err: any) {
      setSimMsg({ type: 'error', text: err.message || 'Failed to create demo case' });
    } finally {
      setSimulating(false);
    }
  };

  // Load the ACTIVE guardrail config from the server and adopt it as both the
  // active config and the editable draft, replacing the seeded defaults so the
  // UI reflects the true active configuration.
  const fetchGuardrails = async () => {
    try {
      const res = await fetch('/api/guardrails');
      if (res.ok) {
        const cfg: GuardrailConfig = await res.json();
        setGuardrails(cfg);
        setGuardrailDraft(cfg);
      }
    } catch {
      /* keep the seeded defaults visible if the server is unreachable */
    }
  };

  // Persist the draft. The server validates/clamps and returns the normalized
  // config, which we adopt as both active + draft so the UI shows exactly what
  // the policy engine will now enforce.
  const saveGuardrails = async () => {
    if (!guardrailDraft || savingGuardrails) return;
    setSavingGuardrails(true);
    setGuardrailMsg(null);
    try {
      const res = await fetch('/api/guardrails', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guardrailDraft),
      });
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const cfg: GuardrailConfig = await res.json();
      setGuardrails(cfg);
      setGuardrailDraft(cfg);
      setGuardrailMsg({
        type: 'ok',
        text: 'Guardrails updated. New recovery cases are now evaluated against these boundaries.',
      });
    } catch (err: any) {
      setGuardrailMsg({ type: 'error', text: err.message || 'Failed to update guardrails' });
    } finally {
      setSavingGuardrails(false);
    }
  };

  useEffect(() => {
    fetchCases();
    fetchGuardrails();
  }, []);

  const runSweep = () => {
    setSweepRunning(true);
    setShowSweepResults(false);
    setTimeout(() => {
      setSweepRunning(false);
      setShowSweepResults(true);
    }, 1500);
  };

  // ── Derived metrics ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalCases = cases.length;
    const activeCases = cases.filter(
      (c) => c.status !== 'Completed' && c.status !== 'Stopped'
    );
    const revenueAtRisk = activeCases.reduce((sum, c) => sum + c.amount, 0);
    const expectedRecoverableRevenue = cases.reduce((sum, c) => sum + c.expectedRecovery, 0);
    const avgRecoveryProbability =
      totalCases > 0
        ? cases.reduce((sum, c) => sum + c.recoveryProbability, 0) / totalCases
        : 0;
    const inProgress = cases.filter((c) => c.status === 'In Progress').length;
    const needAttention = cases.filter(
      (c) =>
        c.status === 'Stopped' ||
        c.status === 'Awaiting Approval' ||
        c.currentStage.toLowerCase().includes('failed')
    ).length;

    // Strategy distribution
    const strategyMap: Record<string, number> = {};
    for (const c of cases) {
      const key = c.aiAction || 'Unknown';
      strategyMap[key] = (strategyMap[key] || 0) + 1;
    }
    const strategyDistribution = Object.entries(strategyMap)
      .map(([name, count]) => ({ name, count, share: totalCases > 0 ? count / totalCases : 0 }))
      .sort((a, b) => b.count - a.count);

    const sweepTotalCases = totalCases;
    const sweepRevenueAtRisk = cases.reduce((sum, c) => sum + c.amount, 0);
    const sweepExpectedRecovery = cases.reduce((sum, c) => sum + c.amount * c.recoveryProbability, 0);
    const sweepRecoveredRevenue = cases.filter(c => c.status === 'Completed').reduce((sum, c) => sum + c.amount, 0);
    const sweepRecoveryRate = sweepRevenueAtRisk > 0 ? sweepRecoveredRevenue / sweepRevenueAtRisk : 0;
    
    const sweepCasesRecovered = cases.filter(c => c.status === 'Completed').length;
    const sweepCasesReview = cases.filter(c => c.status === 'Awaiting Approval').length;
    const sweepCasesStopped = cases.filter(c => c.status === 'Stopped').length;

    const channelsUsed = Array.from(new Set(cases.map(c => c.aiAction))).filter(Boolean).join(', ') || 'None';

    return {
      totalCases,
      revenueAtRisk,
      expectedRecoverableRevenue,
      avgRecoveryProbability,
      inProgress,
      needAttention,
      strategyDistribution,
      sweepMetrics: {
        totalCases: sweepTotalCases,
        revenueAtRisk: sweepRevenueAtRisk,
        expectedRecovery: sweepExpectedRecovery,
        recoveredRevenue: sweepRecoveredRevenue,
        recoveryRate: sweepRecoveryRate,
        casesRecovered: sweepCasesRecovered,
        casesReview: sweepCasesReview,
        casesStopped: sweepCasesStopped,
        channelsUsed
      }
    };
  }, [cases]);

  // ── Sorted cases ─────────────────────────────────────────────────────────
  const sortedCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      switch (sortField) {
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'recoveryProbability':
          aVal = a.recoveryProbability;
          bVal = b.recoveryProbability;
          break;
        case 'expectedRecovery':
          aVal = a.expectedRecovery;
          bVal = b.expectedRecovery;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          return sortDir === 'asc' ? (aVal < bVal ? -1 : 1) : aVal > bVal ? -1 : 1;
        default:
          return 0;
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [cases, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === 'desc' ? (
      <ChevronDown className="w-3 h-3 text-indigo-500" />
    ) : (
      <ChevronUp className="w-3 h-3 text-indigo-500" />
    );
  };

  // ── RENDER ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4" id="merchant-overview-loading">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Loading recovery cases…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4" id="merchant-overview-error">
        <ServerCrash className="w-10 h-10 text-red-400" />
        <p className="text-sm text-red-600 font-medium">{error}</p>
        <button
          onClick={fetchCases}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const guardrailsDirty =
    !!guardrailDraft && !!guardrails && JSON.stringify(guardrailDraft) !== JSON.stringify(guardrails);

  return (
    <div className="space-y-6 pb-12" id="merchant-overview-content">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">Merchant Overview</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 ml-9">
            Live metrics derived from <span className="font-mono text-indigo-600">{metrics.totalCases}</span> recovery cases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runSweep}
            disabled={sweepRunning || cases.length === 0}
            className={`inline-flex items-center gap-1.5 px-4 py-2 ${sweepRunning ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white text-xs font-bold rounded-xl shadow-sm transition-all`}
          >
            {sweepRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {sweepRunning ? 'Running Sweep...' : 'Run Recovery Sweep'}
          </button>
          <button
            id="merchant-overview-refresh-btn"
            onClick={fetchCases}
            title="Refresh data"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl shadow-sm transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* ── Revenue Leak Type — Demo Scenario Simulator ──────── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs" id="revenue-leak-simulator">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
            <Zap className="w-4 h-4" />
          </span>
          <h3 className="text-sm font-bold text-slate-900">Revenue Leak Type</h3>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
            Demo
          </span>
        </div>
        <p className="text-[11px] text-slate-500 mt-1.5 ml-9 max-w-xl">
          Test / demo scenarios only — no live checkout, subscription, or receivables source is connected.
          Each scenario is sent through the real diagnosis + policy recovery pipeline; a case is marked
          <span className="font-semibold text-slate-600"> Recovered</span> only when its actual backend status is Completed.
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {LEAK_SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedLeak(s.key)}
              disabled={simulating}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60 ${
                selectedLeak === s.key
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
              }`}
            >
              {s.label}
            </button>
          ))}
          <button
            type="button"
            onClick={simulateScenario}
            disabled={simulating}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 sm:ml-auto ${
              simulating ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
            } text-white text-xs font-bold rounded-lg shadow-sm transition-all`}
          >
            {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {simulating ? 'Sending…' : 'Simulate Demo Case'}
          </button>
        </div>

        {simMsg && (
          <div
            className={`mt-3 flex items-start gap-2 text-[11px] font-medium px-3 py-2 rounded-lg border ${
              simMsg.type === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {simMsg.type === 'error' ? (
              <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <span>{simMsg.text}</span>
          </div>
        )}
      </div>

      {/* ── Recovery Guardrails — merchant-configurable policy boundaries ── */}
      {guardrailDraft && (
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs" id="recovery-guardrails">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recovery Guardrails</h3>
                <p className="text-[11px] text-slate-500">Agent operates within merchant-defined boundaries.</p>
              </div>
            </div>
            {guardrailsDirty && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <Clock className="w-3 h-3" /> Unsaved changes — not yet active
              </span>
            )}
          </div>

          {/* Numeric boundaries */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Maximum Auto-Recovery Amount</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">₹</span>
                <input
                  type="number"
                  min={0}
                  value={guardrailDraft.maxAutoRecoveryAmount}
                  onChange={(e) =>
                    setGuardrailDraft((prev) =>
                      prev ? { ...prev, maxAutoRecoveryAmount: Number(e.target.value) } : prev
                    )
                  }
                  className="w-full pl-7 pr-3 py-2 text-sm font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Above this, recovery is treated as high-value.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Minimum Recovery Probability</label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={Math.round(guardrailDraft.minRecoveryProbability * 100)}
                  onChange={(e) =>
                    setGuardrailDraft((prev) =>
                      prev ? { ...prev, minRecoveryProbability: Number(e.target.value) / 100 } : prev
                    )
                  }
                  className="w-full pl-3 pr-8 py-2 text-sm font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-400">%</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Below this, low-confidence handling applies.</p>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Maximum Automated Retries</label>
              <input
                type="number"
                min={0}
                max={10}
                value={guardrailDraft.maxAutomatedRetries}
                onChange={(e) =>
                  setGuardrailDraft((prev) =>
                    prev ? { ...prev, maxAutomatedRetries: Number(e.target.value) } : prev
                  )
                }
                className="w-full px-3 py-2 text-sm font-mono font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">Retries allowed before recovery halts.</p>
            </div>
          </div>

          {/* Boolean guardrails */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-800">High-Value Recovery</p>
                <p className="text-[10px] text-slate-500">Require human approval above the auto-limit.</p>
              </div>
              <button
                type="button"
                aria-pressed={guardrailDraft.highValueRequiresApproval}
                onClick={() =>
                  setGuardrailDraft((prev) =>
                    prev ? { ...prev, highValueRequiresApproval: !prev.highValueRequiresApproval } : prev
                  )
                }
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                  guardrailDraft.highValueRequiresApproval ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    guardrailDraft.highValueRequiresApproval ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <div>
                <p className="text-xs font-semibold text-slate-800">Low-Confidence Recovery</p>
                <p className="text-[10px] text-slate-500">Stop recovery below the probability threshold.</p>
              </div>
              <button
                type="button"
                aria-pressed={guardrailDraft.lowConfidenceStops}
                onClick={() =>
                  setGuardrailDraft((prev) =>
                    prev ? { ...prev, lowConfidenceStops: !prev.lowConfidenceStops } : prev
                  )
                }
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                  guardrailDraft.lowConfidenceStops ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    guardrailDraft.lowConfidenceStops ? 'translate-x-4' : ''
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Agent Mode */}
          <div className="mt-4">
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Agent Mode</label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              {AGENT_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() =>
                    setGuardrailDraft((prev) => (prev ? { ...prev, agentMode: m.key } : prev))
                  }
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    guardrailDraft.agentMode === m.key
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1.5">
              Auto Recover acts within the boundaries above; Review First and Manual Only route otherwise-approved cases to human review.
            </p>
          </div>

          {guardrailMsg && (
            <div
              className={`mt-4 flex items-start gap-2 text-[11px] font-medium px-3 py-2 rounded-lg border ${
                guardrailMsg.type === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {guardrailMsg.type === 'error' ? (
                <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              )}
              <span>{guardrailMsg.text}</span>
            </div>
          )}

          {/* Footer: persistence note + actions */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[10px] text-slate-400 max-w-md">
              Session configuration — applied immediately to new cases. Values are held in server memory (no database change) and reset to defaults if the server restarts.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGuardrailDraft(guardrails)}
                disabled={!guardrailsDirty || savingGuardrails}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={saveGuardrails}
                disabled={!guardrailsDirty || savingGuardrails}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-white text-xs font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                  savingGuardrails ? 'bg-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {savingGuardrails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                {savingGuardrails ? 'Saving…' : 'Save Guardrails'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recovery Sweep Section ───────────────────────────── */}
      {(sweepRunning || showSweepResults) && (
        <div className="bg-white rounded-2xl p-5 border border-indigo-200/90 shadow-sm relative overflow-hidden">
          {sweepRunning && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-700">Analyzing Cases & Running Recovery Logic...</p>
            </div>
          )}
          
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-indigo-600" />
            <h3 className="text-md font-bold text-slate-900">Recovery Sweep Results</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total Analyzed</p>
              <p className="text-xl font-black text-slate-900 font-mono">{metrics.sweepMetrics.totalCases}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-1">Revenue At Risk</p>
              <p className="text-xl font-black text-slate-900 font-mono">{formatCurrency(metrics.sweepMetrics.revenueAtRisk)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Expected Recovery</p>
              <p className="text-xl font-black text-slate-900 font-mono">{formatCurrency(metrics.sweepMetrics.expectedRecovery)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Recovered Revenue</p>
              <p className="text-xl font-black text-slate-900 font-mono">{formatCurrency(metrics.sweepMetrics.recoveredRevenue)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider mb-1">Recovery Rate</p>
              <p className="text-xl font-black text-slate-900 font-mono">{(metrics.sweepMetrics.recoveryRate * 100).toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider mb-1">Cases Recovered</p>
              <p className="text-xl font-black text-emerald-800 font-mono">{metrics.sweepMetrics.casesRecovered}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Human Review</p>
              <p className="text-xl font-black text-amber-800 font-mono">{metrics.sweepMetrics.casesReview}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 border border-red-100">
              <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Cases Stopped</p>
              <p className="text-xl font-black text-red-800 font-mono">{metrics.sweepMetrics.casesStopped}</p>
            </div>
          </div>
          
          <p className="text-xs text-slate-600 mb-3"><span className="font-semibold">Channels Used:</span> {metrics.sweepMetrics.channelsUsed}</p>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-4 py-2 border-b border-slate-200">Case</th>
                  <th className="px-4 py-2 border-b border-slate-200">Amount</th>
                  <th className="px-4 py-2 border-b border-slate-200">AI Probability</th>
                  <th className="px-4 py-2 border-b border-slate-200">Decision</th>
                  <th className="px-4 py-2 border-b border-slate-200">Expected Recovery</th>
                  <th className="px-4 py-2 border-b border-slate-200">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cases.map(c => {
                  let decision = 'RECOVER';
                  let decisionColor = 'text-emerald-600';
                  let reason = '';
                  if (c.status === 'Stopped') {
                    decision = 'STOP';
                    decisionColor = 'text-red-600';
                    const failedCheck = c.safetyChecks?.find(chk => !chk.passed);
                    reason = failedCheck ? (failedCheck.label || failedCheck.name || 'Policy Violation') : 'Policy Violation';
                  } else if (c.status === 'Awaiting Approval') {
                    decision = 'HUMAN REVIEW';
                    decisionColor = 'text-amber-600';
                    const failedCheck = c.safetyChecks?.find(chk => !chk.passed);
                    reason = failedCheck ? (failedCheck.label || failedCheck.name || 'Exceeds Auto Limit') : 'Exceeds Auto Limit';
                  } else if (c.status === 'Completed' || c.status === 'In Progress') {
                    decision = 'RECOVER';
                    decisionColor = 'text-emerald-600';
                    reason = c.aiRecommendation || '';
                  }

                  const guardrailLine = guardrails ? buildGuardrailExplanation(c, guardrails) : null;

                  return (
                    <tr key={`sweep-case-${c.id}`} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 text-xs font-mono text-slate-700">{c.recoveryId}</td>
                      <td className="px-4 py-2 text-xs font-mono font-bold text-slate-900">{formatCurrency(c.amount)}</td>
                      <td className="px-4 py-2 text-xs font-mono text-slate-700">{(c.recoveryProbability * 100).toFixed(0)}%</td>
                      <td className="px-4 py-2 text-xs font-bold">
                        <span className={decisionColor}>{decision}</span>
                        {reason && <p className="text-[10px] text-slate-500 font-normal mt-0.5 max-w-[220px] truncate" title={reason}>{reason}</p>}
                        {guardrailLine && (
                          <p
                            className="text-[10px] text-indigo-600/90 font-normal mt-0.5 max-w-[240px] truncate"
                            title={guardrailLine}
                          >
                            {guardrailLine}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs font-mono text-slate-700">{formatCurrency(c.amount * c.recoveryProbability)}</td>
                      <td className="px-4 py-2 text-xs">{statusBadge(c.status)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── KPI Cards (4 primary) ────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue At Risk */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 rounded-xl bg-red-50 text-red-500 border border-red-100 group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider font-mono">
              At Risk
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(metrics.revenueAtRisk)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Revenue at risk across {cases.filter((c) => c.status !== 'Completed' && c.status !== 'Stopped').length} active cases
          </p>
        </div>

        {/* Expected Recovery */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-500 border border-emerald-100 group-hover:scale-110 transition-transform">
              <TrendingUp className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider font-mono">
              Recoverable
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{formatCurrency(metrics.expectedRecoverableRevenue)}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Expected recoverable revenue (AI-estimated)
          </p>
        </div>

        {/* Active Recovery Cases */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-500 border border-indigo-100 group-hover:scale-110 transition-transform">
              <Activity className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider font-mono">
              In Progress
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{metrics.inProgress}</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Cases actively being recovered
          </p>
        </div>

        {/* Avg Recovery Probability */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between mb-3">
            <span className="p-2 rounded-xl bg-purple-50 text-purple-500 border border-purple-100 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-4 h-4" />
            </span>
            <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider font-mono">
              Probability
            </span>
          </div>
          <p className="text-2xl font-black text-slate-900 tracking-tight">
            {(metrics.avgRecoveryProbability * 100).toFixed(0)}%
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            Average recovery probability across all cases
          </p>
        </div>
      </div>

      {/* ── Secondary Stats Row ──────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attention Required */}
        {metrics.needAttention > 0 && (
          <div className="bg-white rounded-2xl p-5 border border-amber-200/80 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-amber-50 text-amber-500 border border-amber-200">
                <ShieldAlert className="w-4 h-4" />
              </span>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {metrics.needAttention} Case{metrics.needAttention !== 1 ? 's' : ''} Requiring Attention
                </p>
                <p className="text-[11px] text-slate-500">
                  Stopped, failed, or awaiting manual approval
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Strategy Distribution */}
        <div className={`bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs ${metrics.needAttention === 0 ? 'md:col-span-2' : ''}`}>
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
            Recovery Strategy Distribution
          </p>
          <div className="space-y-2">
            {metrics.strategyDistribution.map((s) => (
              <div key={s.name} className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 w-44 shrink-0">
                  {strategyIcon(s.name)}
                  <span className="text-xs font-medium text-slate-700 truncate">{s.name}</span>
                </div>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(s.share * 100, 4)}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-600 w-14 text-right shrink-0">
                  {s.count} ({(s.share * 100).toFixed(0)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recovery Cases Table ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recovery Cases</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click any case to open the Recovery Control view
            </p>
          </div>
          <span className="text-[10px] font-bold font-mono px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
            {metrics.totalCases} TOTAL
          </span>
        </div>

        {cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Activity className="w-8 h-8 text-slate-300" />
            <p className="text-sm text-slate-400 font-medium">No recovery cases found</p>
            <p className="text-xs text-slate-400">
              Trigger a payment failure from Recovery Control to create cases
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left" id="merchant-cases-table">
              <thead>
                <tr className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  <th className="px-5 py-3">Customer</th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors select-none"
                    onClick={() => toggleSort('amount')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Amount <SortIcon field="amount" />
                    </span>
                  </th>
                  <th className="px-3 py-3">AI Strategy</th>
                  <th className="px-3 py-3">Current Stage</th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors select-none"
                    onClick={() => toggleSort('status')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Status <SortIcon field="status" />
                    </span>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors select-none"
                    onClick={() => toggleSort('expectedRecovery')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Expected Recovery <SortIcon field="expectedRecovery" />
                    </span>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-slate-600 transition-colors select-none"
                    onClick={() => toggleSort('recoveryProbability')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Probability <SortIcon field="recoveryProbability" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedCases.map((c) => (
                  <tr
                    key={c.id}
                    id={`merchant-case-row-${c.id}`}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                    onClick={() => onNavigate('recovery-control')}
                  >
                    {/* Customer */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-full flex items-center justify-center text-[10px] font-bold text-indigo-700 border border-indigo-200/60 shrink-0">
                          {c.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-900 truncate">{c.customerName}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{c.recoveryId}</p>
                        </div>
                      </div>
                    </td>
                    {/* Amount */}
                    <td className="px-3 py-3.5">
                      <span className="text-xs font-bold text-slate-900 font-mono">{formatCurrency(c.amount)}</span>
                    </td>
                    {/* AI Strategy */}
                    <td className="px-3 py-3.5">
                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                        {strategyIcon(c.aiAction)}
                        <span className="text-[11px] font-medium text-slate-700">{c.aiAction}</span>
                      </div>
                    </td>
                    {/* Stage */}
                    <td className="px-3 py-3.5">
                      <span className="text-[11px] font-medium text-slate-600">{c.currentStage}</span>
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3.5">{statusBadge(c.status)}</td>
                    {/* Expected Recovery */}
                    <td className="px-3 py-3.5">
                      <span className="text-xs font-bold text-emerald-700 font-mono">{formatCurrency(c.expectedRecovery)}</span>
                    </td>
                    {/* Probability */}
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              c.recoveryProbability >= 0.7
                                ? 'bg-emerald-500'
                                : c.recoveryProbability >= 0.4
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${c.recoveryProbability * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700 font-mono w-8 text-right">
                          {(c.recoveryProbability * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    {/* Action */}
                    <td className="px-5 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 group-hover:text-indigo-800 transition-colors">
                        <Eye className="w-3.5 h-3.5" />
                        View
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
