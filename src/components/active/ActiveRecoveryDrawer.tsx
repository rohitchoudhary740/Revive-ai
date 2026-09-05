import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Pause,
  Play,
  RotateCcw,
  Check,
  XCircle,
  FileText,
  Mail,
  Zap,
  Info,
} from 'lucide-react';
import { ActiveRecoveryItem } from '../../types';

interface ActiveRecoveryDrawerProps {
  recovery: ActiveRecoveryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onTogglePause?: (id: string) => void;
}

export const ActiveRecoveryDrawer: React.FC<ActiveRecoveryDrawerProps> = ({
  recovery,
  isOpen,
  onClose,
  onTogglePause,
}) => {
  const [isPaused, setIsPaused] = useState<boolean>(recovery?.isPaused || false);
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);

  if (!isOpen || !recovery) return null;

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handlePauseToggle = () => {
    const nextState = !isPaused;
    setIsPaused(nextState);
    if (onTogglePause) {
      onTogglePause(recovery.id);
    }
  };

  return (
    <div
      id="active-recovery-drawer-overlay"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity"
      onClick={onClose}
    >
      <div
        id="active-recovery-drawer"
        className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-150 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-sm border border-indigo-100 shadow-xs">
              {recovery.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60">
                  {recovery.recoveryId}
                </span>
                <span className="text-slate-300">•</span>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {recovery.customerName}
                </h2>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-slate-400" />
                <span>{recovery.customerEmail}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6 flex-1">
          {/* TOP SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150">
              <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                Amount at Risk
              </div>
              <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                {formatINR(recovery.amount)}
              </div>
            </div>

            <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-150">
              <div className="text-[10px] text-indigo-700 font-bold uppercase font-mono">
                AI Action
              </div>
              <div className="text-sm font-bold text-indigo-950 mt-0.5">
                {recovery.aiAction}
              </div>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-150">
              <div className="text-[10px] text-emerald-700 font-bold uppercase font-mono">
                Recovery Prob.
              </div>
              <div className="text-lg font-black text-emerald-800 font-mono mt-0.5">
                {recovery.recoveryProbability}%
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150">
              <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                Expected Value
              </div>
              <div className="text-lg font-black text-slate-900 font-mono mt-0.5">
                {formatINR(recovery.expectedRecovery)}
              </div>
            </div>
          </div>

          {/* CURRENT STAGE CALLOUT */}
          <div className="bg-indigo-900 text-white rounded-2xl p-5 shadow-sm space-y-2 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 font-bold">
                Current Execution Stage
              </span>
              <span
                className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full ${
                  isPaused
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                }`}
              >
                {isPaused ? 'Paused by Merchant' : 'Workflow Active'}
              </span>
            </div>
            <div className="text-lg font-bold text-white tracking-tight">
              {recovery.currentStage}
            </div>
            <p className="text-xs text-indigo-200 leading-relaxed">
              ReviveAI is monitoring live webhook health indicators and will execute the optimal intervention with zero manual friction.
            </p>
          </div>

          {/* AI RECOMMENDATION */}
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/40 rounded-2xl p-5 border border-indigo-200/90 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider font-mono">
                AI Agent Recommendation
              </h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              "{recovery.aiRecommendation}"
            </p>
          </div>

          {/* WORKFLOW TIMELINE */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Execution Timeline</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Sequential Trail</span>
            </div>

            <div className="relative pl-6 space-y-3.5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {recovery.timeline.map((step, idx) => (
                <div key={idx} className="relative group">
                  <div
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                      step.status === 'done'
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : step.status === 'active'
                        ? 'bg-indigo-600 text-white border-indigo-700 animate-pulse'
                        : step.status === 'failed'
                        ? 'bg-rose-500 text-white border-rose-600'
                        : 'bg-white text-slate-400 border-slate-300'
                    }`}
                  >
                    {step.status === 'done' ? (
                      <Check className="w-3 h-3 text-white" />
                    ) : step.status === 'active' ? (
                      <span className="w-2 h-2 rounded-full bg-white" />
                    ) : step.status === 'failed' ? (
                      <XCircle className="w-3 h-3 text-white" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    )}
                  </div>

                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-150">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900">{step.title}</div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {step.timestamp}
                      </span>
                    </div>
                    {step.description && (
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SAFETY GUARDRAILS */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Safety Guardrails</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                Verified Safe
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-700">
              {recovery.safetyChecks.map((chk, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-150"
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      chk.passed ? 'text-emerald-600' : 'text-rose-500'
                    }`}
                  />
                  <span className="truncate">{chk.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AUDIT MODAL INLINE PREVIEW */}
          {showAuditModal && (
            <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl space-y-2 text-xs font-mono animate-in fade-in duration-150">
              <div className="flex items-center justify-between text-indigo-300 font-bold pb-1 border-b border-slate-800">
                <span>AUDIT RECORD // {recovery.recoveryId}</span>
                <button
                  onClick={() => setShowAuditModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[11px] space-y-1 text-slate-300">
                <div>[16:14:02.102] PAY_EVENT: Failure received (HDFC_PSP_BUSY)</div>
                <div>[16:14:02.341] AI_AGENT: Diagnosed degradation pattern (prob=87%)</div>
                <div>[16:14:02.502] POLICY_PASS: Max attempts (1), Risk cap (25000)</div>
                <div>[16:14:03.001] SCHEDULER: Recovery window held for +600s</div>
                <div>[16:14:03.110] STATE: In Progress / Idempotency Token #TOK_998124</div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md px-6 py-4 border-t border-slate-150 flex items-center justify-between gap-3">
          <button
            onClick={() => setShowAuditModal((prev) => !prev)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Audit</span>
          </button>

          <button
            onClick={handlePauseToggle}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 ${
              isPaused
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            }`}
          >
            {isPaused ? (
              <>
                <Play className="w-4 h-4" />
                <span>Resume Recovery</span>
              </>
            ) : (
              <>
                <Pause className="w-4 h-4" />
                <span>Pause Recovery</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
