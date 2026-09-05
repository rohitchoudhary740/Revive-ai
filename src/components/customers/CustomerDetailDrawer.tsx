import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  BrainCircuit,
  RotateCcw,
  MessageSquare,
  Check,
  CreditCard,
  Building,
  Mail,
  Zap,
  CheckCircle,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { CustomerProfile, PageId } from '../../types';

interface CustomerDetailDrawerProps {
  customer: CustomerProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToOpportunities?: () => void;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  customer,
  isOpen,
  onClose,
  onNavigateToOpportunities,
}) => {
  const [isStartingRecovery, setIsStartingRecovery] = useState(false);
  const [recoveryStarted, setRecoveryStarted] = useState(false);
  const [workflowSteps, setWorkflowSteps] = useState<
    { label: string; status: 'pending' | 'active' | 'done' }[]
  >([
    { label: 'Customer eligibility checked', status: 'pending' },
    { label: 'Policy & safety limits checked', status: 'pending' },
    { label: 'Recovery workflow started', status: 'pending' },
  ]);

  if (!isOpen || !customer) return null;

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleStartRecovery = () => {
    setIsStartingRecovery(true);
    setRecoveryStarted(true);

    // Step 1 done immediately
    setWorkflowSteps((prev) => [
      { label: 'Customer eligibility checked', status: 'done' },
      { label: 'Policy & safety limits checked', status: 'active' },
      { label: 'Recovery workflow started', status: 'pending' },
    ]);

    // Step 2 after 400ms
    setTimeout(() => {
      setWorkflowSteps((prev) => [
        { label: 'Customer eligibility checked', status: 'done' },
        { label: 'Policy & safety limits checked', status: 'done' },
        { label: 'Recovery workflow started', status: 'active' },
      ]);
    }, 600);

    // Step 3 after 1100ms
    setTimeout(() => {
      setWorkflowSteps((prev) => [
        { label: 'Customer eligibility checked', status: 'done' },
        { label: 'Policy & safety limits checked', status: 'done' },
        { label: 'Recovery workflow started', status: 'done' },
      ]);
      setIsStartingRecovery(false);
    }, 1300);
  };

  return (
    <div
      id="customer-detail-drawer-overlay"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity"
      onClick={onClose}
    >
      <div
        id="customer-detail-drawer"
        className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DRAWER HEADER */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-150 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-sm border border-indigo-100 shadow-xs">
              {customer.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {customer.name}
                </h2>
                <span className="text-[11px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                  {customer.customerId}
                </span>
              </div>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Mail className="w-3 h-3 text-slate-400" />
                <span>{customer.email}</span>
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

        {/* DRAWER CONTENT */}
        <div className="p-6 space-y-6 flex-1">
          {/* SECTION 1 — CUSTOMER PROFILE METRICS */}
          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                Customer Financial Profile
              </span>
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/60 font-mono">
                Profile Active
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              {/* Total Revenue */}
              <div className="bg-white p-3 rounded-xl border border-slate-150 shadow-2xs">
                <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Total Revenue
                </div>
                <div className="text-base font-extrabold text-slate-900 font-mono mt-0.5">
                  {formatINR(customer.totalRevenue)}
                </div>
              </div>

              {/* Revenue at Risk */}
              <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/70 shadow-2xs">
                <div className="text-[10px] text-amber-800 font-bold uppercase font-mono">
                  At Risk
                </div>
                <div className="text-base font-extrabold text-amber-900 font-mono mt-0.5">
                  {formatINR(customer.revenueAtRisk)}
                </div>
              </div>

              {/* Recovered Revenue */}
              <div className="bg-emerald-50/60 p-3 rounded-xl border border-emerald-200/70 shadow-2xs">
                <div className="text-[10px] text-emerald-800 font-bold uppercase font-mono">
                  Recovered
                </div>
                <div className="text-base font-extrabold text-emerald-800 font-mono mt-0.5">
                  {formatINR(customer.recoveredRevenue)}
                </div>
              </div>

              {/* Recovery Rate */}
              <div className="bg-indigo-50/60 p-3 rounded-xl border border-indigo-200/70 shadow-2xs">
                <div className="text-[10px] text-indigo-800 font-bold uppercase font-mono">
                  Recovery Rate
                </div>
                <div className="text-base font-extrabold text-indigo-900 font-mono mt-0.5">
                  {customer.recoveryRate}%
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 — RECOVERY PROBABILITY GAUGE */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-900">Current Recovery Probability</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Multi-factor estimation based on customer history & gateway health
                </p>
              </div>
              <div className="text-right font-mono">
                <div className="text-2xl font-black text-indigo-600">
                  {customer.recoveryProbability}%
                </div>
              </div>
            </div>

            {/* Visual Probability Bar */}
            <div className="space-y-1.5">
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    customer.recoveryProbability >= 70
                      ? 'bg-gradient-to-r from-emerald-500 to-indigo-600'
                      : customer.recoveryProbability >= 40
                      ? 'bg-gradient-to-r from-amber-400 to-amber-500'
                      : 'bg-slate-400'
                  }`}
                  style={{ width: `${customer.recoveryProbability}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>0% Low</span>
                <span className="font-bold text-emerald-700">
                  Expected Recovery: {formatINR(customer.expectedRecovery)}
                </span>
                <span>100% High</span>
              </div>
            </div>
          </div>

          {/* SECTION 3 — AI CUSTOMER INSIGHT */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 rounded-2xl p-5 border border-indigo-200/90 shadow-xs space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider font-mono">
                AI Customer Insight
              </h3>
            </div>

            <div className="text-sm font-bold text-slate-900 leading-snug">
              "{customer.aiInsight.headline}"
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="text-[11px] font-bold text-slate-500 font-mono uppercase">
                Diagnostic Evidence:
              </div>
              <ul className="space-y-1 text-xs text-slate-700">
                {customer.aiInsight.reasons.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{reason}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-2 border-t border-indigo-100 flex items-start gap-2 text-xs text-indigo-950 bg-white/80 p-3 rounded-xl border border-indigo-150">
              <Zap className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-indigo-900 font-semibold">Recommended Action: </strong>
                <span>{customer.aiInsight.recommendedAction}</span>
              </div>
            </div>
          </div>

          {/* SECTION 4 — RECOVERY MEMORY */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">
                  AI Recovery Memory
                </h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                Learned Pattern
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              ReviveAI maintains customer-level memory to choose interventions with the highest historical probability of success.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Preferred Action
                </div>
                <div className="text-xs font-bold text-slate-900 mt-1">
                  {customer.recoveryMemory.preferredIntervention}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Historic Success
                </div>
                <div className="text-xs font-extrabold text-emerald-700 font-mono mt-1">
                  {customer.recoveryMemory.historicalSuccessRate}%
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Avg. Recovery
                </div>
                <div className="text-xs font-extrabold text-slate-900 font-mono mt-1">
                  {formatINR(customer.recoveryMemory.averageSuccessfulRecovery)}
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-150">
                <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                  Best Channel
                </div>
                <div className="text-xs font-bold text-indigo-700 mt-1">
                  {customer.recoveryMemory.bestContactChannel}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5 — CUSTOMER RECOVERY JOURNEY TIMELINE */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-slate-500" />
                <span>Customer Recovery Journey</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Chronological Trail</span>
            </div>

            <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {customer.timeline.map((event, idx) => (
                <div key={event.id || idx} className="relative group">
                  {/* Timeline bullet */}
                  <div
                    className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full border flex items-center justify-center text-[10px] ${
                      event.type === 'recovered' || event.type === 'successful'
                        ? 'bg-emerald-500 text-white border-emerald-600'
                        : event.type === 'failed'
                        ? 'bg-rose-500 text-white border-rose-600'
                        : event.type === 'diagnosed'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white text-slate-500 border-slate-300'
                    }`}
                  >
                    {idx + 1}
                  </div>

                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-150 group-hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900">{event.title}</div>
                      <span className="text-[10px] font-mono text-slate-400 shrink-0">
                        {event.timestamp}
                      </span>
                    </div>
                    {event.description && (
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                        {event.description}
                      </p>
                    )}
                    {event.amount && (
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100/70 text-emerald-800 rounded text-[10px] font-mono font-bold">
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Recovered {formatINR(event.amount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 6 — RECOVERY HISTORY */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-slate-500" />
                <span>Recovery History ({customer.recoveryHistory.length} attempts)</span>
              </h3>
              <span className="text-[10px] font-mono text-slate-400">Past Interventions</span>
            </div>

            <div className="space-y-2">
              {customer.recoveryHistory.map((hist) => (
                <div
                  key={hist.id}
                  className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-150 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-mono font-bold text-[11px] flex items-center justify-center border border-indigo-100">
                      #{hist.attemptNumber}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{hist.action}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {hist.channel} • {hist.date}
                      </div>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                        hist.result === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {hist.result}
                    </span>
                    {hist.recoveredAmount > 0 && (
                      <div className="text-xs font-extrabold text-emerald-700 mt-0.5">
                        +{formatINR(hist.recoveredAmount)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 7 — SAFETY STATUS */}
          <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Safety Guardrails</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                Passed
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs text-slate-700">
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-150">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    customer.safetyStatus.contactLimitOk ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                />
                <span>Customer contact limit OK</span>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-150">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    customer.safetyStatus.retryLimitOk ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                />
                <span>Retry limit OK</span>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-150">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    customer.safetyStatus.noDuplicateRecovery ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                />
                <span>No duplicate recovery</span>
              </div>
              <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-150">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    customer.safetyStatus.amountWithinPolicy ? 'text-emerald-600' : 'text-rose-500'
                  }`}
                />
                <span>Amount within policy</span>
              </div>
            </div>
          </div>

          {/* WORKFLOW INITIATED ANIMATION / STATUS */}
          {recoveryStarted && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 font-mono">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Recovery workflow initiated</span>
              </div>

              <div className="space-y-1.5 pl-6 text-xs text-emerald-800">
                {workflowSteps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    {step.status === 'done' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : step.status === 'active' ? (
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin inline-block" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-slate-300 ml-1 mr-0.5" />
                    )}
                    <span className={step.status === 'done' ? 'font-medium' : 'text-slate-600'}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DRAWER FOOTER / BOTTOM ACTIONS */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md px-6 py-4 border-t border-slate-150 flex items-center justify-between gap-3">
          <button
            onClick={() => {
              onClose();
              if (onNavigateToOpportunities) {
                onNavigateToOpportunities();
              }
            }}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
          >
            <span>View Recovery Opportunity</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleStartRecovery}
            disabled={isStartingRecovery || recoveryStarted || customer.status === 'Stopped'}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-2 ${
              customer.status === 'Stopped'
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : recoveryStarted
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98]'
            }`}
          >
            {isStartingRecovery ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                <span>Initiating...</span>
              </>
            ) : recoveryStarted ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Workflow Active</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Start Recovery</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
