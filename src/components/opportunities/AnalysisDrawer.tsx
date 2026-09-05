import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Zap,
  ShieldCheck,
  Clock,
  Sparkles,
  Check,
  AlertOctagon,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { RecoveryOpportunity } from '../../types';

interface AnalysisDrawerProps {
  opportunity: RecoveryOpportunity | null;
  isOpen: boolean;
  onClose: () => void;
  onExecuteRecovery: (id: string) => void;
  isExecuted?: boolean;
}

export const AnalysisDrawer: React.FC<AnalysisDrawerProps> = ({
  opportunity,
  isOpen,
  onClose,
  onExecuteRecovery,
  isExecuted = false,
}) => {
  const [executionState, setExecutionState] = useState<{
    started: boolean;
    policyPassed: boolean;
    actionScheduled: boolean;
    waitingWindow: boolean;
  }>({
    started: false,
    policyPassed: false,
    actionScheduled: false,
    waitingWindow: false,
  });

  // Reset or sync execution state when opportunity changes
  useEffect(() => {
    if (isExecuted) {
      setExecutionState({
        started: true,
        policyPassed: true,
        actionScheduled: true,
        waitingWindow: true,
      });
    } else {
      setExecutionState({
        started: false,
        policyPassed: false,
        actionScheduled: false,
        waitingWindow: false,
      });
    }
  }, [opportunity?.id, isExecuted]);

  // Handle ESC key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !opportunity) return null;

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleExecute = () => {
    if (executionState.started) return;

    setExecutionState({
      started: true,
      policyPassed: false,
      actionScheduled: false,
      waitingWindow: false,
    });

    onExecuteRecovery(opportunity.id);

    // Staggered progressive feedback for the workflow
    setTimeout(() => {
      setExecutionState((prev) => ({ ...prev, policyPassed: true }));
    }, 400);

    setTimeout(() => {
      setExecutionState((prev) => ({ ...prev, actionScheduled: true }));
    }, 900);

    setTimeout(() => {
      setExecutionState((prev) => ({ ...prev, waitingWindow: true }));
    }, 1400);
  };

  const isStopped = opportunity.status === 'stopped';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" id="ai-analysis-drawer-portal">
      {/* Backdrop with frosted blur */}
      <div
        id="drawer-backdrop"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div
          id="drawer-panel"
          className="w-screen max-w-xl bg-white/95 backdrop-blur-xl border-l border-slate-200/80 shadow-2xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-300 selection:bg-indigo-500 selection:text-white"
        >
          {/* Top Sticky Header */}
          <div className="sticky top-0 bg-white/90 backdrop-blur-md px-6 py-5 border-b border-slate-200/80 z-20 flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200/60 font-mono">
                  <Sparkles className="w-3 h-3 text-indigo-600" />
                  AI Recovery Analysis
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {opportunity.paymentId}
                </span>
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {opportunity.customerName}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {formatINR(opportunity.amount)}
                </span>
                <span className="text-slate-300">•</span>
                <span className="inline-flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60 text-[11px]">
                  <AlertOctagon className="w-3 h-3 text-rose-600" />
                  Payment Failed
                </span>
              </div>
            </div>

            <button
              id="close-drawer-btn"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Close drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body Sections */}
          <div className="p-6 space-y-6 flex-1">
            {/* SECTION 1 — WHY DID THIS HAPPEN? */}
            <div
              id="drawer-section-root-cause"
              className="bg-white/80 rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  SECTION 1 — WHY DID THIS HAPPEN?
                </h3>
                <span className="text-[11px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/60 font-mono">
                  AI Confidence: <strong>{opportunity.analysis?.aiConfidence ?? 85}%</strong>
                </span>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Root Cause:
                </span>
                <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-2">
                  <span>{opportunity.analysis?.rootCause || opportunity.problem || 'Payment failure detected'}</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Evidence:
                </span>
                <ul className="mt-2 space-y-2 text-xs text-slate-700">
                  {opportunity.analysis?.evidence && opportunity.analysis.evidence.length > 0 ? (
                    opportunity.analysis.evidence.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                          ✓
                        </div>
                        <span className="font-medium">{item}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-slate-400 italic">No additional gateway telemetry captured</li>
                  )}
                </ul>
              </div>
            </div>

            {/* SECTION 2 — RECOVERY PROBABILITY */}
            <div
              id="drawer-section-probability"
              className="bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-blue-50/40 rounded-2xl p-5 border border-indigo-100 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-indigo-100/60">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  SECTION 2 — RECOVERY PROBABILITY
                </h3>
                <span className="text-xs font-black text-indigo-700 font-mono">
                  {opportunity.recoveryProbability}% Probability
                </span>
              </div>

              {/* Progress visual bar */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      opportunity.recoveryProbability >= 70
                        ? 'bg-gradient-to-r from-emerald-500 to-indigo-600'
                        : opportunity.recoveryProbability >= 40
                        ? 'bg-gradient-to-r from-amber-500 to-indigo-500'
                        : 'bg-gradient-to-r from-slate-400 to-red-400'
                    }`}
                    style={{ width: `${opportunity.recoveryProbability}%` }}
                  />
                </div>
              </div>

              <div className="bg-white/80 backdrop-blur-xs p-4 rounded-xl border border-indigo-200/60">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Expected Recovery
                </div>
                <div className="text-2xl font-extrabold text-indigo-900 font-mono mt-0.5">
                  {formatINR(opportunity.expectedRecovery)}
                </div>
                <div className="mt-2 text-xs font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70 inline-block">
                  {formatINR(opportunity.amount)} × {opportunity.recoveryProbability}% ={' '}
                  <strong className="text-indigo-600">
                    {formatINR(opportunity.expectedRecovery)}
                  </strong>
                </div>
              </div>
            </div>

            {/* SECTION 3 — AI RECOMMENDATION */}
            <div
              id="drawer-section-recommendation"
              className="bg-white/80 rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-600" />
                  SECTION 3 — AI RECOMMENDATION
                </h3>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Recommended Action:
                </span>
                <div className="mt-1 flex items-center gap-2 text-sm font-bold text-slate-900 bg-slate-50/90 border border-slate-200/80 p-3 rounded-xl">
                  {isStopped ? (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  ) : (
                    <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                  <span>{opportunity.recommendation.detailedAction}</span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Reason:
                </span>
                <p className="mt-1 text-xs text-slate-700 leading-relaxed bg-amber-50/40 border border-amber-200/50 p-3 rounded-xl italic">
                  "{opportunity.recommendation.reason}"
                </p>
              </div>
            </div>

            {/* SECTION 4 — SAFETY CHECKS */}
            <div
              id="drawer-section-safety-checks"
              className="bg-white/80 rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  SECTION 4 — SAFETY CHECKS
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-mono">
                  Guardrails Active
                </span>
              </div>

              <ul className="space-y-2 text-xs text-slate-700">
                {opportunity.analysis?.safetyChecks && opportunity.analysis.safetyChecks.length > 0 ? (
                  opportunity.analysis.safetyChecks.map((check, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-[10px] ${
                          check.passed
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                            : 'bg-rose-50 text-rose-600 border border-rose-200'
                        }`}
                      >
                        {check.passed ? '✓' : '✕'}
                      </div>
                      <span className={`font-medium ${check.passed ? 'text-slate-800' : 'text-rose-700'}`}>
                        {check.label}
                      </span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">No automated safety checks recorded</li>
                )}
              </ul>
            </div>

            {/* Workflow Progress Status Alert (when executed) */}
            {executionState.started && (
              <div
                id="recovery-workflow-started-alert"
                className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-5 text-emerald-900 space-y-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300"
              >
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider font-mono text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  Recovery Workflow Started
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Check
                      className={`w-3.5 h-3.5 transition-opacity ${
                        executionState.policyPassed
                          ? 'text-emerald-600 opacity-100'
                          : 'opacity-30'
                      }`}
                    />
                    <span className={executionState.policyPassed ? 'font-semibold' : 'text-slate-500'}>
                      Policy check passed
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Check
                      className={`w-3.5 h-3.5 transition-opacity ${
                        executionState.actionScheduled
                          ? 'text-emerald-600 opacity-100'
                          : 'opacity-30'
                      }`}
                    />
                    <span className={executionState.actionScheduled ? 'font-semibold' : 'text-slate-500'}>
                      Recovery action scheduled
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        executionState.waitingWindow
                          ? 'bg-amber-500 animate-pulse'
                          : 'bg-slate-300'
                      }`}
                    />
                    <span className={executionState.waitingWindow ? 'font-semibold text-amber-900' : 'text-slate-500'}>
                      Waiting for recovery window
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 5 — ACTION BUTTONS */}
          <div
            id="drawer-section-actions"
            className="sticky bottom-0 bg-white/95 backdrop-blur-md p-6 border-t border-slate-200/80 z-20 space-y-2"
          >
            <div className="flex items-center gap-3">
              {isStopped ? (
                <button
                  disabled
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <AlertOctagon className="w-4 h-4" />
                  <span>Recovery Halted by Safety Sentinel</span>
                </button>
              ) : executionState.started ? (
                <button
                  disabled
                  id="recovery-in-progress-btn"
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs flex items-center justify-center gap-2 font-mono"
                >
                  <Clock className="w-4 h-4 animate-spin text-indigo-600" />
                  <span>Recovery In Progress</span>
                </button>
              ) : (
                <button
                  id="execute-recovery-btn"
                  onClick={handleExecute}
                  className="flex-1 py-3 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  <span>Execute Recovery</span>
                </button>
              )}

              <button
                id="dismiss-drawer-btn"
                onClick={onClose}
                className="py-3 px-5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors"
              >
                Dismiss
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 font-mono">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Zero Risk Simulation Mode
              </span>
              <span>ReviveAI Engine v2.4</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
