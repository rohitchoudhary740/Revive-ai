import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Activity,
  ShieldAlert,
  ShieldCheck,
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
  FlaskConical,
  CreditCard,
  Sliders,
  RotateCcw,
  Info,
  Lock,
  Sparkles,
  Bot
} from 'lucide-react';
import { PageId } from '../../types';
import { RecoveryEvaluationSection } from './RecoveryEvaluationSection';
import { PolicyImpactSimulatorPanel } from './PolicyImpactSimulatorPanel';

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

type AgentMode = 'auto_recover' | 'review_first' | 'manual_only';

interface GuardrailConfig {
  maxAutoRecoveryAmount: number;
  minRecoveryProbability: number; // 0..1
  maxAutomatedRetries: number;
  highValueRequiresApproval: boolean;
  lowConfidenceStops: boolean;
  agentMode: AgentMode;
}

const AGENT_MODES: { key: AgentMode; label: string; badge: string; desc: string; detail: string }[] = [
  {
    key: 'manual_only',
    label: 'MANUAL',
    badge: '100% Supervised',
    desc: 'All recovery interventions require manual trigger',
    detail: 'Zero autonomous execution. AI diagnoses failure causes and recommends strategies, but no payment link or retry is dispatched without operator review.',
  },
  {
    key: 'review_first',
    label: 'REVIEW FIRST',
    badge: 'Human-Gated',
    desc: 'Interventions require operator approval before execution',
    detail: 'Conservative hybrid mode. Standard low-risk retries proceed, but high-value cases and borderline confidence scores are held for Risk Approvals.',
  },
  {
    key: 'auto_recover',
    label: 'AUTONOMOUS',
    badge: 'Zero-Touch',
    desc: 'Autonomous execution within merchant policy boundaries',
    detail: 'Full autonomous execution. AI agent dispatches smart retries, WhatsApp interactive pay hooks, and fallback rails within configured limits.',
  },
];

const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxAutoRecoveryAmount: 25000,
  minRecoveryProbability: 0.3,
  maxAutomatedRetries: 3,
  highValueRequiresApproval: true,
  lowConfidenceStops: true,
  agentMode: 'auto_recover',
};

const cleanVerdict = (s?: string | null): string =>
  (s || '').replace(/^[^\p{L}\p{N}]+/u, '').trim();

const buildGuardrailExplanation = (c: RecoveryCaseFromApi, cfg: GuardrailConfig): string => {
  const amt = `₹${Math.round(c.amount).toLocaleString('en-IN')}`;
  const limit = `₹${cfg.maxAutoRecoveryAmount.toLocaleString('en-IN')}`;
  const probPct = Math.round((c.recoveryProbability || 0) * 100);
  const minPct = Math.round(cfg.minRecoveryProbability * 100);

  if (c.status === 'Awaiting Approval' || c.status === 'Stopped') {
    const real = cleanVerdict(c.guardrailDecision);
    if (real) return `Guardrail: ${real}`;
    return c.status === 'Stopped'
      ? 'Guardrail: recovery halted by policy → Stopped'
      : 'Guardrail: held for merchant approval → Human Approval';
  }
  return `Guardrail: ${amt} ≤ ${limit} limit; ${probPct}% ≥ ${minPct}% conf → Auto Recovery`;
};

const formatCurrency = (val: number): string => {
  if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
  if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
  return `₹${Math.round(val).toLocaleString('en-IN')}`;
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
          <CheckCircle2 className="w-3 h-3" /> Recovered
        </span>
      );
    case 'Stopped':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
          <XCircle className="w-3 h-3" /> Stopped
        </span>
      );
    case 'Awaiting Approval':
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25">
          <Clock className="w-3 h-3" /> Awaiting Approval
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25">
          <Activity className="w-3 h-3" /> In Progress
        </span>
      );
  }
};

const strategyIcon = (action: string) => {
  const act = (action || '').toLowerCase();
  if (act.includes('whatsapp')) return <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />;
  if (act.includes('retry')) return <RefreshCw className="w-3.5 h-3.5 text-blue-500" />;
  if (act.includes('method')) return <CreditCard className="w-3.5 h-3.5 text-purple-500" />;
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

  // Recovery Guardrails state
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

  const refreshCasesSilently = async () => {
    try {
      const res = await fetch('/api/recovery/cases');
      if (res.ok) setCases(await res.json());
    } catch {
      // keep existing data
    }
  };

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
        text: `Demo "${scenario.label}" case created (${data.caseId}). Evaluated by AI diagnosis & policy engine.`,
      });

      refreshCasesSilently();
      setTimeout(refreshCasesSilently, 2500);
    } catch (err: any) {
      setSimMsg({ type: 'error', text: err.message || 'Failed to create demo case' });
    } finally {
      setSimulating(false);
    }
  };

  const fetchGuardrails = async () => {
    try {
      const res = await fetch('/api/guardrails');
      if (res.ok) {
        const cfg: GuardrailConfig = await res.json();
        setGuardrails(cfg);
        setGuardrailDraft(cfg);
      }
    } catch {
      // keep seeded defaults
    }
  };

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
        text: 'Guardrails updated. New recovery cases are evaluated against these boundaries.',
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
    }, 1200);
  };

  // Derived metrics
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
    const awaitingApproval = cases.filter((c) => c.status === 'Awaiting Approval').length;
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
    const sweepRecoveredRevenue = cases.filter((c) => c.status === 'Completed').reduce((sum, c) => sum + c.amount, 0);
    const sweepRecoveryRate = sweepRevenueAtRisk > 0 ? sweepRecoveredRevenue / sweepRevenueAtRisk : 0;

    const sweepCasesRecovered = cases.filter((c) => c.status === 'Completed').length;
    const sweepCasesReview = awaitingApproval;
    const sweepCasesStopped = cases.filter((c) => c.status === 'Stopped').length;

    const channelsUsed = Array.from(new Set(cases.map((c) => c.aiAction))).filter(Boolean).join(', ') || 'None';

    return {
      totalCases,
      revenueAtRisk,
      expectedRecoverableRevenue,
      avgRecoveryProbability,
      inProgress,
      awaitingApproval,
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
        channelsUsed,
      },
    };
  }, [cases]);

  // Sorted cases
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
      <ChevronDown className="w-3 h-3 text-blue-500" />
    ) : (
      <ChevronUp className="w-3 h-3 text-blue-500" />
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4" id="merchant-overview-loading">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-[var(--text-secondary)] font-medium">Loading revenue recovery intelligence…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4" id="merchant-overview-error">
        <ServerCrash className="w-10 h-10 text-rose-500" />
        <p className="text-sm text-rose-600 dark:text-rose-400 font-medium">{error}</p>
        <button
          onClick={fetchCases}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      </div>
    );
  }

  const guardrailsDirty =
    !!guardrailDraft && !!guardrails && JSON.stringify(guardrailDraft) !== JSON.stringify(guardrails);

  return (
    <div className="space-y-7 pb-16" id="merchant-overview-content">
      {/* ========================================================================= */}
      {/* 4. MERCHANT OVERVIEW — HERO SECTION */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
              REVIVEAI OS
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              Live telemetry · {metrics.totalCases} cases monitored
            </span>
          </div>
          <h2 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">
            Autonomous Revenue Recovery
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-xl">
            Real-time detection, AI diagnostic synthesis, and bounded policy-authorized recovery execution.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={runSweep}
            disabled={sweepRunning || cases.length === 0}
            className={`inline-flex items-center gap-1.5 px-4 py-2 ${
              sweepRunning ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50`}
          >
            {sweepRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {sweepRunning ? 'Sweeping Cases...' : 'Run Recovery Sweep'}
          </button>
          <button
            id="merchant-overview-refresh-btn"
            onClick={fetchCases}
            title="Refresh recovery cases"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] text-[var(--text-primary)] text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)]" /> Refresh
          </button>
        </div>
      </div>

      {/* TOP SECTION: Primary Financial Metrics + Premium Agent Status Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT: 4 Primary Financial Metrics (8 Cols) */}
        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* PRIMARY METRIC 1: Revenue at Risk */}
          <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs hover:border-rose-300 dark:hover:border-rose-900/50 transition-all sm:col-span-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-4 h-4" />
                </span>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Primary Financial Metric · 01
                </span>
              </div>
              <span className="fintech-badge fintech-badge-danger">
                ACTIVE LEAKAGE
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-[var(--text-primary)]">
                {formatCurrency(metrics.revenueAtRisk)}
              </span>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                Revenue at Risk ({cases.filter((c) => c.status !== 'Completed' && c.status !== 'Stopped').length} active cases)
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] mt-2">
              Total transaction volume exposed to temporary gateway timeouts, user drop-offs, and mandate failures.
            </p>
          </div>

          {/* PRIMARY METRIC 2: Expected Recovery */}
          <div className="p-4.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <TrendingUp className="w-4 h-4" />
              </span>
              <span className="fintech-badge fintech-badge-ai">
                AI EST. YIELD
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono block">
              Expected Recovery
            </span>
            <span className="text-2xl font-black font-mono text-[var(--text-primary)] block mt-1">
              {formatCurrency(metrics.expectedRecoverableRevenue)}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)] block mt-1">
              AI-weighted probability projection (~{(metrics.avgRecoveryProbability * 100).toFixed(0)}%)
            </span>
          </div>

          {/* PRIMARY METRIC 3: Verified Recovered Revenue */}
          <div className="p-4.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
              </span>
              <span className="fintech-badge fintech-badge-success">
                VERIFIED
              </span>
            </div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono block">
              Verified Recovered Revenue
            </span>
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 block mt-1">
              {formatCurrency(metrics.sweepMetrics.recoveredRevenue)}
            </span>
            <span className="text-[11px] text-[var(--text-secondary)] block mt-1">
              {metrics.sweepMetrics.casesRecovered} settled via verified webhooks
            </span>
          </div>

          {/* PRIMARY METRIC 4: Recovery Rate */}
          <div className="p-4.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs sm:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-mono block">
                  Recovery Rate
                </span>
                <span className="text-2xl font-black font-mono text-[var(--text-primary)] block mt-0.5">
                  {(metrics.sweepMetrics.recoveryRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {metrics.sweepMetrics.casesRecovered} of {metrics.totalCases} cases recovered
                </span>
                <p className="text-[10px] text-[var(--text-muted)]">
                  Avg confidence: {(metrics.avgRecoveryProbability * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden mt-3 border border-[var(--border-subtle)]">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(metrics.sweepMetrics.recoveryRate * 100, 4)}%` }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Premium Agent Status Panel (4 Cols) */}
        <div className="lg:col-span-4 p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-sm flex flex-col justify-between space-y-4 relative overflow-hidden">
          {/* Subtle decorative glow */}
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            {/* Panel Top: Agent Mode */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2">
                <div className="relative flex h-3 w-3">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    (guardrails?.agentMode || 'auto_recover') === 'auto_recover' ? 'bg-emerald-400' : 'bg-amber-400'
                  }`} />
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${
                    (guardrails?.agentMode || 'auto_recover') === 'auto_recover' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                </div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  AGENT STATUS
                </span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                (guardrails?.agentMode || 'auto_recover') === 'auto_recover'
                  ? 'fintech-badge-success'
                  : 'fintech-badge-warn'
              }`}>
                ● {(guardrails?.agentMode || 'auto_recover') === 'auto_recover'
                    ? 'AUTONOMOUS'
                    : (guardrails?.agentMode || '').replace('_', ' ').toUpperCase()}
              </span>
            </div>

            {/* Current Agent Mode Detail */}
            <div className="mt-3.5 space-y-1">
              <span className="text-[10px] font-mono font-bold uppercase text-[var(--text-muted)] tracking-wider">
                Current Agent Mode
              </span>
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {(guardrails?.agentMode || 'auto_recover') === 'auto_recover'
                  ? 'Autonomous Execution'
                  : (guardrails?.agentMode || 'review_first') === 'review_first'
                    ? 'Review First (Operator Approval Required)'
                    : 'Manual Interventions Only'}
              </p>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Policy boundaries enforce ₹{(guardrails?.maxAutoRecoveryAmount || 25000).toLocaleString('en-IN')} cap & {(Math.round((guardrails?.minRecoveryProbability || 0.3) * 100))}% minimum confidence.
              </p>
            </div>

            {/* Current Activity */}
            <div className="mt-4 p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-1">
              <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-[var(--text-muted)]">
                <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                <span>Current Activity</span>
              </div>
              <p className="text-xs font-medium text-[var(--text-primary)] leading-relaxed">
                {sweepRunning
                  ? 'Executing automated recovery sweep across active failure signals...'
                  : metrics.inProgress > 0
                    ? `Monitoring & synthesizing ${metrics.inProgress} active recovery cases`
                    : 'Monitoring live payment telemetry & webhook signals'}
              </p>
            </div>

            {/* Real Data Grid: Active Cases & Pending Approvals */}
            <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Active Recovery Cases</span>
                <span className="text-xl font-black text-[var(--text-primary)] mt-0.5 block">{metrics.inProgress}</span>
                <span className="text-[9px] text-[var(--text-secondary)]">In flight</span>
              </div>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
                <span className="text-[10px] text-[var(--text-muted)] block uppercase">Pending Human Approvals</span>
                <span className="text-xl font-black text-amber-500 mt-0.5 block">{metrics.awaitingApproval}</span>
                <span className="text-[9px] text-[var(--text-secondary)]">Gated by policy</span>
              </div>
            </div>
          </div>

          {/* Panel Footer */}
          <div className="pt-3 border-t border-[var(--border-app)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span>Razorpay Track 03</span>
            <button
              onClick={() => onNavigate('recovery-control')}
              className="text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>Command Center</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* RECOVERY PERFORMANCE */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-app)]">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">RECOVERY PERFORMANCE</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Empirical distribution of bounded strategies across detected revenue leak cases.
            </p>
          </div>
          <span className="text-[11px] font-mono font-bold text-[var(--text-muted)]">
            Total Cases: {metrics.totalCases}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Strategy Distribution */}
          <div className="space-y-2.5">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] block">
              Strategy Dispatch Mix
            </span>
            <div className="space-y-2">
              {metrics.strategyDistribution.map((s) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 w-44 shrink-0">
                    {strategyIcon(s.name)}
                    <span className="text-xs font-medium text-[var(--text-primary)] truncate">{s.name}</span>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(s.share * 100, 5)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono font-bold text-[var(--text-secondary)] w-14 text-right shrink-0">
                    {s.count} ({(s.share * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Metrics Breakdown */}
          <div className="grid grid-cols-2 gap-3 self-center">
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] text-center">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Resolved Recoveries</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5 block">
                {metrics.sweepMetrics.casesRecovered}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">Captures verified via HMAC</span>
            </div>
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] text-center">
              <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase block">Policy Blocked / Stopped</span>
              <span className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono mt-0.5 block">
                {metrics.sweepMetrics.casesStopped}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">Terminal stopping invariants</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ACTIVE RECOVERY OPERATIONS TABLE */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--border-app)]">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">ACTIVE RECOVERY OPERATIONS</h3>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Live case pipeline with verified root-cause diagnoses and authorized interventions.
            </p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            {metrics.totalCases} OPERATIONS
          </span>
        </div>

        {cases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Activity className="w-8 h-8 text-[var(--text-muted)]" />
            <p className="text-sm text-[var(--text-secondary)] font-medium">No recovery cases found</p>
            <p className="text-xs text-[var(--text-muted)]">
              Trigger a payment failure scenario from the simulator below or the live Command Center.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-app)]">
            <table className="w-full text-left" id="merchant-cases-table">
              <thead>
                <tr className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider bg-[var(--bg-surface-elevated)] border-b border-[var(--border-app)]">
                  <th className="px-4 py-3">Case</th>
                  <th className="px-3 py-3">Failure</th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
                    onClick={() => toggleSort('amount')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Amount <SortIcon field="amount" />
                    </span>
                  </th>
                  <th className="px-3 py-3">Selected Strategy</th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
                    onClick={() => toggleSort('status')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Status <SortIcon field="status" />
                    </span>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-[var(--text-primary)] transition-colors select-none"
                    onClick={() => toggleSort('recoveryProbability')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Confidence <SortIcon field="recoveryProbability" />
                    </span>
                  </th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
                {sortedCases.map((c) => (
                  <tr
                    key={c.id}
                    id={`merchant-case-row-${c.id}`}
                    className="hover:bg-[var(--bg-surface-elevated)] cursor-pointer transition-colors group"
                    onClick={() => onNavigate('recovery-control')}
                  >
                    {/* Case */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center text-[10px] shrink-0 border border-blue-500/20 font-mono">
                          {c.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--text-primary)] truncate">{c.customerName}</p>
                          <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{c.recoveryId}</p>
                        </div>
                      </div>
                    </td>

                    {/* Failure */}
                    <td className="px-3 py-3">
                      <span className="text-[11px] font-mono text-[var(--text-secondary)] truncate max-w-[140px] block" title={c.problem}>
                        {c.problem}
                      </span>
                    </td>

                    {/* Amount */}
                    <td className="px-3 py-3 font-mono font-bold text-[var(--text-primary)]">
                      {formatCurrency(c.amount)}
                    </td>

                    {/* Selected Strategy */}
                    <td className="px-3 py-3">
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border-app)]">
                        {strategyIcon(c.aiAction)}
                        <span className="text-[11px] font-medium text-[var(--text-secondary)]">{c.aiAction}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">{statusBadge(c.status)}</td>

                    {/* Confidence */}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[var(--bg-surface-elevated)] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              c.recoveryProbability >= 0.7
                                ? 'bg-emerald-500'
                                : c.recoveryProbability >= 0.4
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${c.recoveryProbability * 100}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-mono font-bold text-[var(--text-secondary)]">
                          {(c.recoveryProbability * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 group-hover:underline">
                        <Eye className="w-3.5 h-3.5" />
                        Inspect
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 8. GUARDRAILS — AGENT AUTONOMY CONTROL CENTER */}
      {/* ========================================================================= */}
      {guardrailDraft && (
        <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs space-y-6" id="recovery-guardrails">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border-app)]">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs">
                <Sliders className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">AGENT AUTONOMY CONTROL CENTER</h3>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                    POLICY SENTINEL
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Deterministic boundaries and human-in-the-loop controls governing AI recovery execution authority.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {guardrailsDirty ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 animate-pulse">
                  <Clock className="w-3.5 h-3.5" /> Unsaved draft changes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                  <ShieldCheck className="w-3.5 h-3.5" /> Session policy synchronized
                </span>
              )}
            </div>
          </div>

          {/* PROMINENT CURRENT AGENT MODE SPOTLIGHT */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 border border-blue-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Current Operating Mode
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-black bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                    ACTIVE IN SESSION: {guardrails?.agentMode === 'manual_only' ? 'MANUAL' : guardrails?.agentMode === 'review_first' ? 'REVIEW FIRST' : 'AUTONOMOUS'}
                  </span>
                </div>
                <p className="text-xs font-semibold text-[var(--text-primary)] mt-0.5">
                  {guardrails?.agentMode === 'manual_only'
                    ? '100% Supervised · All AI recovery proposals require manual operator click to execute.'
                    : guardrails?.agentMode === 'review_first'
                    ? 'Supervised Automation · Standard low-risk retries execute; high-value cases require review.'
                    : 'Autonomous Revenue Recovery · Agent automatically executes recovery playbooks within guardrails.'}
                </p>
              </div>
            </div>

            {guardrailDraft.agentMode !== guardrails?.agentMode && (
              <div className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-lg shrink-0">
                Draft: {guardrailDraft.agentMode === 'manual_only' ? 'MANUAL' : guardrailDraft.agentMode === 'review_first' ? 'REVIEW FIRST' : 'AUTONOMOUS'} (Click Save to apply)
              </div>
            )}
          </div>

          {/* AGENT MODE SELECTOR: MANUAL | REVIEW FIRST | AUTONOMOUS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
                Agent Autonomy Mode Selection
              </label>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                Click a mode card to change draft setting
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {AGENT_MODES.map((m) => {
                const isSelectedInDraft = guardrailDraft.agentMode === m.key;
                const isCurrentlyActiveInSession = guardrails?.agentMode === m.key;

                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() =>
                      setGuardrailDraft((prev) => (prev ? { ...prev, agentMode: m.key } : prev))
                    }
                    className={`p-4 rounded-xl border text-left transition-all cursor-pointer relative ${
                      isSelectedInDraft
                        ? 'bg-[var(--bg-surface-elevated)] border-blue-500 ring-2 ring-blue-500/25 shadow-xs'
                        : 'bg-[var(--bg-surface-elevated)]/60 border-[var(--border-app)] hover:border-slate-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className={`text-xs font-extrabold font-mono tracking-wider ${
                        isSelectedInDraft ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--text-primary)]'
                      }`}>
                        {m.label}
                      </span>
                      <div className="flex items-center gap-1">
                        {isCurrentlyActiveInSession && (
                          <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                            LIVE
                          </span>
                        )}
                        {isSelectedInDraft ? (
                          <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-[var(--border-app)] shrink-0" />
                        )}
                      </div>
                    </div>

                    <div className="mb-2">
                      <span className="text-[10px] font-bold text-[var(--text-secondary)] font-mono">
                        {m.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                      {m.detail}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* NUMERIC BOUNDARIES & SAFETY RULES */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-[var(--text-primary)]">
              Recovery Guardrail Parameters
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Maximum Auto-Recovery Amount */}
              <div className="p-4.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-primary)] block">
                      Maximum Auto-Recovery Amount
                    </label>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      Configured: ₹{guardrails?.maxAutoRecoveryAmount.toLocaleString('en-IN') || '25,000'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400 block">
                      ₹{guardrailDraft.maxAutoRecoveryAmount.toLocaleString('en-IN')}
                    </span>
                    {guardrailDraft.maxAutoRecoveryAmount !== guardrails?.maxAutoRecoveryAmount && (
                      <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400">
                        Draft value
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min={5000}
                  max={100000}
                  step={5000}
                  value={guardrailDraft.maxAutoRecoveryAmount}
                  onChange={(e) =>
                    setGuardrailDraft((prev) =>
                      prev ? { ...prev, maxAutoRecoveryAmount: Number(e.target.value) } : prev
                    )
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                  aria-label="Maximum Auto-Recovery Amount slider"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[10000, 25000, 50000, 75000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() =>
                        setGuardrailDraft((prev) => (prev ? { ...prev, maxAutoRecoveryAmount: amt } : prev))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        guardrailDraft.maxAutoRecoveryAmount === amt
                          ? 'bg-blue-600 text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-app)] hover:border-slate-400'
                      }`}
                    >
                      ₹{amt >= 100000 ? '1L' : `${amt / 1000}K`}
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">
                  <strong>Operational Effect:</strong> Transactions exceeding this INR threshold are blocked from automated execution and held in Risk Approvals for manual operator sign-off.
                </p>
              </div>

              {/* 2. Minimum Recovery Probability */}
              <div className="p-4.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-primary)] block">
                      Minimum Recovery Probability
                    </label>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      Configured: {Math.round((guardrails?.minRecoveryProbability ?? 0.3) * 100)}%
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400 block">
                      {Math.round(guardrailDraft.minRecoveryProbability * 100)}%
                    </span>
                    {Math.round(guardrailDraft.minRecoveryProbability * 100) !== Math.round((guardrails?.minRecoveryProbability ?? 0.3) * 100) && (
                      <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400">
                        Draft value
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min={10}
                  max={90}
                  step={5}
                  value={Math.round(guardrailDraft.minRecoveryProbability * 100)}
                  onChange={(e) =>
                    setGuardrailDraft((prev) =>
                      prev ? { ...prev, minRecoveryProbability: Number(e.target.value) / 100 } : prev
                    )
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                  aria-label="Minimum Recovery Probability slider"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[20, 30, 50, 70].map((prob) => (
                    <button
                      key={prob}
                      type="button"
                      onClick={() =>
                        setGuardrailDraft((prev) => (prev ? { ...prev, minRecoveryProbability: prob / 100 } : prev))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        Math.round(guardrailDraft.minRecoveryProbability * 100) === prob
                          ? 'bg-blue-600 text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-app)] hover:border-slate-400'
                      }`}
                    >
                      {prob}%
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">
                  <strong>Operational Effect:</strong> Minimum AI recovery score required to attempt automated intervention. Lower-probability cases halt to avoid merchant fees and unnecessary dunning friction.
                </p>
              </div>

              {/* 3. Maximum Automated Retries */}
              <div className="p-4.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-[var(--text-primary)] block">
                      Maximum Automated Retries
                    </label>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      Configured: {guardrails?.maxAutomatedRetries || 3} retries
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-mono font-black text-blue-600 dark:text-blue-400 block">
                      {guardrailDraft.maxAutomatedRetries} retries
                    </span>
                    {guardrailDraft.maxAutomatedRetries !== guardrails?.maxAutomatedRetries && (
                      <span className="text-[9px] font-mono font-bold text-amber-600 dark:text-amber-400">
                        Draft value
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={guardrailDraft.maxAutomatedRetries}
                  onChange={(e) =>
                    setGuardrailDraft((prev) =>
                      prev ? { ...prev, maxAutomatedRetries: Number(e.target.value) } : prev
                    )
                  }
                  className="w-full accent-blue-600 cursor-pointer"
                  aria-label="Maximum Automated Retries slider"
                />

                <div className="flex items-center gap-1.5 flex-wrap">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() =>
                        setGuardrailDraft((prev) => (prev ? { ...prev, maxAutomatedRetries: num } : prev))
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        guardrailDraft.maxAutomatedRetries === num
                          ? 'bg-blue-600 text-white'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-app)] hover:border-slate-400'
                      }`}
                    >
                      {num}x
                    </button>
                  ))}
                </div>

                <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">
                  <strong>Operational Effect:</strong> Hard ceiling on automated recovery attempts per failed transaction before the agent terminates the journey or escalates to manual operator review.
                </p>
              </div>
            </div>

            {/* TOGGLE SWITCHES: High-Value Recovery Approval & Low-Confidence Stopping Rule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* 4. High-Value Recovery Approval */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      High-Value Recovery Approval
                    </label>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      guardrailDraft.highValueRequiresApproval
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/25'
                    }`}>
                      {guardrailDraft.highValueRequiresApproval ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    <strong>Operational Effect:</strong> When enabled, any recovery amount exceeding the configured limit is gated for explicit human operator sign-off in the Risk Approvals queue.
                  </p>
                  <p className="text-[10px] font-mono text-[var(--text-muted)]">
                    Configured in session: {guardrails?.highValueRequiresApproval ? 'Enabled' : 'Disabled'}
                  </p>
                </div>

                <button
                  type="button"
                  aria-pressed={guardrailDraft.highValueRequiresApproval}
                  onClick={() =>
                    setGuardrailDraft((prev) =>
                      prev ? { ...prev, highValueRequiresApproval: !prev.highValueRequiresApproval } : prev
                    )
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                    guardrailDraft.highValueRequiresApproval ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  aria-label="Toggle High-Value Recovery Approval"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      guardrailDraft.highValueRequiresApproval ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* 5. Low-Confidence Stopping Rule */}
              <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-[var(--text-primary)]">
                      Low-Confidence Stopping Rule
                    </label>
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      guardrailDraft.lowConfidenceStops
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/25'
                    }`}>
                      {guardrailDraft.lowConfidenceStops ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
                    <strong>Operational Effect:</strong> When enabled, transactions falling below the minimum recovery probability are automatically terminated without attempting further payment rails.
                  </p>
                  <p className="text-[10px] font-mono text-[var(--text-muted)]">
                    Configured in session: {guardrails?.lowConfidenceStops ? 'Enabled' : 'Disabled'}
                  </p>
                </div>

                <button
                  type="button"
                  aria-pressed={guardrailDraft.lowConfidenceStops}
                  onClick={() =>
                    setGuardrailDraft((prev) =>
                      prev ? { ...prev, lowConfidenceStops: !prev.lowConfidenceStops } : prev
                    )
                  }
                  className={`relative w-12 h-6 rounded-full transition-colors shrink-0 cursor-pointer ${
                    guardrailDraft.lowConfidenceStops ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                  aria-label="Toggle Low-Confidence Stopping Rule"
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      guardrailDraft.lowConfidenceStops ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* SESSION-BASED RUNTIME NOTIFICATION CALLOUT */}
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3 text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-900 dark:text-amber-200">
                Session-Based Runtime Configuration Notice
              </span>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                All agent autonomy settings and numeric guardrail thresholds are stored in active server memory for the current runtime session. Configuration applies immediately to all incoming payment failures, but will reset to factory default policies whenever the backend restarts. Database tables are not permanently altered.
              </p>
            </div>
          </div>

          {guardrailMsg && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                guardrailMsg.type === 'error'
                  ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                  : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
              }`}
            >
              {guardrailMsg.type === 'error' ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{guardrailMsg.text}</span>
            </div>
          )}

          {/* ACTIONS FOOTER: Reset & Apply Guardrails */}
          <div className="pt-4 border-t border-[var(--border-app)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-mono">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>PUT /api/guardrails · Immediate hot-reload across active recovery pipelines</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGuardrailDraft(guardrails)}
                disabled={!guardrailsDirty || savingGuardrails}
                className="px-3 py-1.5 rounded-xl border border-[var(--border-app)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
              >
                Reset to Configured
              </button>
              <button
                type="button"
                onClick={() => setGuardrailDraft(DEFAULT_GUARDRAILS)}
                disabled={savingGuardrails}
                className="px-3 py-1.5 rounded-xl border border-[var(--border-app)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)] text-xs font-semibold transition-all cursor-pointer disabled:opacity-40"
              >
                Factory Defaults
              </button>
              <button
                type="button"
                onClick={saveGuardrails}
                disabled={!guardrailsDirty || savingGuardrails}
                className={`inline-flex items-center gap-1.5 px-4.5 py-1.5 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-40 ${
                  savingGuardrails ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                }`}
              >
                {savingGuardrails ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                {savingGuardrails ? 'Saving Guardrails…' : 'Save Guardrails'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. POLICY IMPACT SIMULATOR (Layer 4) */}
      {/* ========================================================================= */}
      {guardrails && (
        <PolicyImpactSimulatorPanel activeGuardrails={guardrails} />
      )}

      {/* ========================================================================= */}
      {/* BATCH RECOVERY EVALUATION ENGINE (Track 03 Measured Recovery) */}
      {/* ========================================================================= */}
      <RecoveryEvaluationSection />

      {/* ========================================================================= */}
      {/* REVENUE LEAK DEMO SCENARIO SIMULATOR (Demo scenarios) */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-app)] shadow-xs space-y-4" id="revenue-leak-simulator">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <Zap className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Revenue Leak Type Simulator</h3>
          </div>
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            DEMO / TEST MODE
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Synthesizes payment failure signals and routes them through the live Gemini diagnosis and deterministic policy pipeline.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {LEAK_SCENARIOS.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSelectedLeak(s.key)}
              disabled={simulating}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                selectedLeak === s.key
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-app)] hover:border-blue-400 hover:text-blue-600'
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
              simulating ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50`}
          >
            {simulating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {simulating ? 'Simulating…' : 'Simulate Demo Case'}
          </button>
        </div>

        {simMsg && (
          <div
            className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
              simMsg.type === 'error'
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/25'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25'
            }`}
          >
            {simMsg.type === 'error' ? <XCircle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
            <span>{simMsg.text}</span>
          </div>
        )}
      </div>
    </div>
  );
};
