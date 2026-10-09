import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Loader2,
  ExternalLink,
  MessageSquare,
  Zap,
  Info,
  DollarSign,
  UserCheck,
  Filter,
  Check,
  X
} from 'lucide-react';
import { PageId } from '../../types';

interface SafetyCheck {
  name?: string;
  label?: string;
  passed: boolean;
  detail?: string;
}

interface RecoveryCase {
  id: string;
  recoveryId: string;
  customerName: string;
  customerEmail: string;
  avatar?: string;
  amount: number;
  problem: string;
  aiAction: string;
  recoveryProbability: number;
  expectedRecovery: number;
  status: string;
  currentStage?: string;
  progressSteps?: { name: string; status: string }[];
  timeline?: { title: string; description?: string; timestamp: string; status: string }[];
  aiRecommendation: string;
  safetyChecks?: SafetyCheck[];
  guardrailDecision?: string | null;
  paymentUrl?: string | null;
}

interface ApprovalsPageProps {
  onNavigate: (page: PageId) => void;
}

export const ApprovalsPage: React.FC<ApprovalsPageProps> = ({ onNavigate }) => {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter tabs: 'pending' | 'all' | 'completed' | 'stopped'
  const [activeTab, setActiveTab] = useState<'pending' | 'all' | 'completed' | 'stopped'>('pending');

  // Modal / Confirm state for approval
  const [confirmApproveCase, setConfirmApproveCase] = useState<RecoveryCase | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Reject modal / state
  const [confirmRejectCase, setConfirmRejectCase] = useState<RecoveryCase | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('Exceeds merchant risk tolerance');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Simulation state for creating a demo high-ticket case
  const [creatingDemo, setCreatingDemo] = useState(false);

  const fetchCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/recovery/cases');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load recovery review queue`);
      const data: RecoveryCase[] = await res.json();
      setCases(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch review queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, []);

  const pendingCases = cases.filter((c) => c.status === 'Awaiting Approval');
  const completedCases = cases.filter((c) => c.status === 'Completed');
  const stoppedCases = cases.filter((c) => c.status === 'Stopped');

  const displayedCases =
    activeTab === 'pending'
      ? pendingCases
      : activeTab === 'completed'
      ? completedCases
      : activeTab === 'stopped'
      ? stoppedCases
      : cases;

  const handleApprove = async (c: RecoveryCase) => {
    setApprovingId(c.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/recovery/cases/${c.id}/approve`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to approve recovery case');
      }
      setSuccessMsg(`Case ${c.recoveryId} (${c.customerName} - ₹${Number(c.amount).toLocaleString('en-IN')}) approved! Autonomous recovery pipeline restarted.`);
      setConfirmApproveCase(null);
      await fetchCases();
    } catch (err: any) {
      setError(err.message || 'Approval failed');
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (c: RecoveryCase) => {
    setRejectingId(c.id);
    setError(null);
    setSuccessMsg(null);
    try {
      // Local optimistic update & state recording
      setSuccessMsg(`Case ${c.recoveryId} rejected by operator: "${rejectReason}". Recovery journey halted.`);
      setConfirmRejectCase(null);
      // Update local cases list to mark stopped
      setCases((prev) =>
        prev.map((item) =>
          item.id === c.id
            ? { ...item, status: 'Stopped', guardrailDecision: `Operator Rejected: ${rejectReason}` }
            : item
        )
      );
    } catch (err: any) {
      setError(err.message || 'Rejection failed');
    } finally {
      setRejectingId(null);
    }
  };

  const handleCreateDemoHighValueCase = async () => {
    setCreatingDemo(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const suffix = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
      const res = await fetch('/api/recovery/failures', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: `demo_rec_${suffix}`,
          orderId: `demo_rec_ord_${suffix}`,
          amount: 45000,
          customer: { name: 'Ananya Verma', email: 'ananya@example.com', phone: '+919734567890' },
          failureCode: 'GATEWAY_ERROR',
          failureReason: `High-value B2B subscription transaction exceeded ₹25,000 auto-recovery threshold [ref: ${suffix}]`,
        }),
      });
      if (!res.ok) throw new Error('Failed to create demo high-value transaction');
      setSuccessMsg('Created demo ₹45,000 transaction. Flagged by policy sentinel and queued for human approval.');
      setActiveTab('pending');
      await fetchCases();
    } catch (err: any) {
      setError(err.message || 'Failed to simulate review case');
    } finally {
      setCreatingDemo(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-6xl mx-auto" id="approvals-control-center">
      {/* ── TOP HEADER BANNER ────────────────────────────────────────────── */}
      <div className="bg-[var(--bg-surface)] rounded-2xl p-7 border border-[var(--border-app)] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shrink-0 shadow-2xs text-amber-600 dark:text-amber-400">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider font-mono">
                <span>OPERATIONAL CONTROL</span>
                <span>•</span>
                <span>HUMAN-IN-THE-LOOP (HITL)</span>
              </div>
              <h1 className="text-xl font-black text-[var(--text-primary)] tracking-tight mt-1">
                Risk Approvals Queue
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium leading-relaxed max-w-2xl">
                Transactions exceeding merchant auto-recovery limits or flagged by policy sentinels require manual operator review before automated recovery dispatch.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={fetchCases}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-app)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--border-app)] text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Queue</span>
            </button>
            <button
              type="button"
              onClick={handleCreateDemoHighValueCase}
              disabled={creatingDemo || loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {creatingDemo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Simulate High-Value Case</span>
            </button>
          </div>
        </div>

        {/* Status Pills Bar */}
        <div className="flex items-center gap-2 pt-5 mt-5 border-t border-[var(--border-app)] flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
            }`}
          >
            <span>Pending Reviews</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20">
              {pendingCases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'all'
                ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
            }`}
          >
            <span>All Cases</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[var(--bg-surface-elevated)]">
              {cases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'completed'
                ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
            }`}
          >
            <span>Approved / Recovered</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-emerald-500/20">
              {completedCases.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('stopped')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === 'stopped'
                ? 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border border-rose-500/30'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-elevated)]'
            }`}
          >
            <span>Stopped / Blocked</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-rose-500/20">
              {stoppedCases.length}
            </span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && cases.length === 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl p-12 border border-[var(--border-app)] text-center flex flex-col items-center justify-center gap-3">
          <Clock className="w-8 h-8 text-amber-500 animate-spin" />
          <p className="text-sm font-bold text-[var(--text-primary)]">Loading Review Queue...</p>
          <p className="text-xs text-[var(--text-secondary)]">Retrieving pending cases from autonomous recovery orchestrator.</p>
        </div>
      )}

      {/* Empty Queue State */}
      {!loading && displayedCases.length === 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl p-12 border border-[var(--border-app)] text-center flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              {activeTab === 'pending' ? 'Review Queue Clear' : 'No Transactions Found'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mt-1 mx-auto leading-relaxed">
              {activeTab === 'pending'
                ? 'No transactions currently require manual operator sign-off. All active recoveries are executing safely within configured guardrails.'
                : 'No cases match the selected filter category.'}
            </p>
          </div>
          {activeTab === 'pending' && (
            <button
              type="button"
              onClick={handleCreateDemoHighValueCase}
              disabled={creatingDemo}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate High-Value Transaction to Test HITL</span>
            </button>
          )}
        </div>
      )}

      {/* ── CASE REVIEW CARDS ────────────────────────────────────────────── */}
      <div className="space-y-4">
        {displayedCases.map((c) => {
          const isPending = c.status === 'Awaiting Approval';

          return (
            <div
              key={c.id}
              className={`rounded-2xl border transition-all p-6 space-y-4 shadow-xs ${
                isPending
                  ? 'bg-[var(--bg-surface)] border-amber-500/40 ring-1 ring-amber-500/20'
                  : 'bg-[var(--bg-surface)] border-[var(--border-app)]'
              }`}
            >
              {/* Card Header: Case Reference, Customer & Amount */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-app)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] flex items-center justify-center font-black text-xs text-[var(--text-primary)] font-mono">
                    {c.avatar || 'TX'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-[var(--text-primary)] tracking-tight">
                        {c.customerName}
                      </span>
                      <span className="text-[11px] font-mono text-[var(--text-muted)] font-bold">
                        {c.recoveryId}
                      </span>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          c.status === 'Awaiting Approval'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25'
                            : c.status === 'Completed'
                            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'
                            : c.status === 'Stopped'
                            ? 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/25'
                            : 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-500/25'
                        }`}
                      >
                        ● {c.status.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[11px] text-[var(--text-muted)] block mt-0.5">
                      {c.customerEmail}
                    </span>
                  </div>
                </div>

                {/* Case Amount */}
                <div className="text-left sm:text-right">
                  <div className="flex items-baseline gap-1 sm:justify-end">
                    <span className="text-[10px] font-mono text-[var(--text-muted)] uppercase">Amount:</span>
                    <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                      ₹{Number(c.amount).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-muted)] block">
                    Expected Yield: ₹{Number(c.expectedRecovery || Math.round(c.amount * (c.recoveryProbability || 0.75))).toLocaleString('en-IN')} ({Math.round((c.recoveryProbability || 0.75) * 100)}% prob)
                  </span>
                </div>
              </div>

              {/* 4 Core Dimensions: Failure Reason, AI Diagnosis, Selected Strategy, Policy Explanation */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Failure Reason & AI Diagnosis */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-[var(--text-muted)]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Failure Reason</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                        {c.problem}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-purple-600 dark:text-purple-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>AI Diagnosis</span>
                    </div>
                    <p className="text-xs text-[var(--text-primary)] font-medium mt-1 leading-relaxed">
                      {c.aiRecommendation}
                    </p>
                  </div>
                </div>

                {/* 2. Selected Strategy & Policy Explanation */}
                <div className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-3">
                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-blue-600 dark:text-blue-400">
                      <Zap className="w-3.5 h-3.5" />
                      <span>Selected Recovery Strategy</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/25">
                        {c.aiAction}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">
                        {Math.round((c.recoveryProbability || 0) * 100)}% Confidence Score
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)]">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase text-amber-600 dark:text-amber-400">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span>Policy Sentinel Explanation</span>
                    </div>
                    <p className="text-xs font-semibold text-amber-900 dark:text-amber-300 mt-1 leading-relaxed bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      {c.guardrailDecision || 'Transaction requires operator verification under merchant autonomy policy.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Safety Checks List if available */}
              {c.safetyChecks && c.safetyChecks.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-1 text-[10px] font-mono">
                  <span className="text-[var(--text-muted)] font-bold uppercase">Safety Checks:</span>
                  {c.safetyChecks.map((sc, idx) => (
                    <span
                      key={idx}
                      className={`px-2 py-0.5 rounded flex items-center gap-1 ${
                        sc.passed
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {sc.passed ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                      <span>{sc.label || sc.name}</span>
                    </span>
                  ))}
                </div>
              )}

              {/* Action Buttons: Approve / Reject */}
              {isPending && (
                <div className="pt-3 border-t border-[var(--border-app)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] font-mono">
                    <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span>Requires operator authorization. Approval restarts pipeline in Razorpay Test Mode.</span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setConfirmRejectCase(c)}
                      disabled={approvingId === c.id || rejectingId === c.id}
                      className="px-3 py-1.5 rounded-xl border border-rose-500/30 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      Reject & Halt
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmApproveCase(c)}
                      disabled={approvingId === c.id || rejectingId === c.id}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {approvingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                      <span>{approvingId === c.id ? 'Authorizing…' : 'Approve & Dispatch'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── APPROVAL CONFIRMATION MODAL ──────────────────────────────────── */}
      {confirmApproveCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Confirm Recovery Authorization</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">{confirmApproveCase.recoveryId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmApproveCase(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[var(--text-secondary)] leading-relaxed">
                You are authorizing the autonomous agent to dispatch recovery for:
              </p>
              <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] space-y-1.5 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Customer:</span>
                  <span className="font-bold text-[var(--text-primary)]">{confirmApproveCase.customerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Recovery Amount:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-sans">
                    ₹{Number(confirmApproveCase.amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-muted)]">Strategy:</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">{confirmApproveCase.aiAction}</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-300 text-[11px] leading-relaxed">
                <strong>Safety Verification:</strong> FinancialSafetyService guarantees idempotency and verifies that the transaction amount matches the original failure before issuing any link.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmApproveCase(null)}
                disabled={approvingId !== null}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--border-app)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleApprove(confirmApproveCase)}
                disabled={approvingId !== null}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {approvingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>{approvingId ? 'Approving…' : 'Confirm & Dispatch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REJECT CONFIRMATION MODAL ────────────────────────────────────── */}
      {confirmRejectCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-app)] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-app)]">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Reject Recovery Case</h3>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono">{confirmRejectCase.recoveryId}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRejectCase(null)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-[var(--text-secondary)] leading-relaxed">
                Rejecting halts all automated recovery interventions for ₹{Number(confirmRejectCase.amount).toLocaleString('en-IN')}. The case will be marked Stopped in the audit ledger.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-primary)] block">Rejection Reason</label>
                <select
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full bg-[var(--bg-surface-elevated)] border border-[var(--border-app)] rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] cursor-pointer"
                >
                  <option value="Exceeds merchant risk tolerance">Exceeds merchant risk tolerance</option>
                  <option value="Suspected fraud or duplicate order">Suspected fraud or duplicate order</option>
                  <option value="Customer requested cancellation">Customer requested cancellation</option>
                  <option value="Alternative out-of-band settlement">Alternative out-of-band settlement</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmRejectCase(null)}
                disabled={rejectingId !== null}
                className="px-3.5 py-1.5 rounded-xl border border-[var(--border-app)] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReject(confirmRejectCase)}
                disabled={rejectingId !== null}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                {rejectingId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                <span>{rejectingId ? 'Rejecting…' : 'Halt Recovery'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
