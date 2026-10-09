import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  BrainCircuit,
  ArrowRight,
  TrendingUp,
  Smartphone,
  ExternalLink,
  Bot,
  Activity,
  Check,
  ChevronRight,
  Sparkles,
  Lock,
  RefreshCw,
  Send,
  MessageSquare,
  ShieldAlert,
  Layers,
  CircleAlert,
  Play,
  Zap
} from 'lucide-react';
import { RecoveryJourneyData, RecoveryJourneyStep, RecoveryStrategyDefinition } from '../../types';
import { WhyThisActionModal } from './WhyThisActionModal';

interface RecoveryJourneyViewProps {
  caseId?: string;
  onRefresh?: () => void;
}

export const RecoveryJourneyView: React.FC<RecoveryJourneyViewProps> = ({
  caseId = 'REC-DEMO-ADAPTIVE',
  onRefresh
}) => {
  const [journeyData, setJourneyData] = useState<RecoveryJourneyData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeScenario, setActiveScenario] = useState<'adaptive' | 'instant' | 'escalate' | 'stopped'>('adaptive');
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [whyActionModalOpen, setWhyActionModalOpen] = useState<boolean>(false);

  // Preset demo scenarios to demonstrate all Layer 2 capabilities visually
  const DEMO_SCENARIOS: Record<string, RecoveryJourneyData> = {
    adaptive: {
      caseId: 'REC-92831',
      status: 'recovered',
      currentStage: 'Payment Verified & Settled',
      totalAttempts: 2,
      isTerminal: true,
      finalDecision: 'RECOVERED',
      steps: [
        {
          id: 'STEP-REC-92831-1',
          case_id: 'REC-92831',
          attempt_number: 1,
          strategy_id: 'smart_retry',
          strategy_name: 'Smart Immediate Gateway Retry',
          reasoning: 'Temporary bank degradation detected on HDFC primary node. Retrying immediately through alternate backup acquiring route.',
          policy_approved: 1,
          policy_checks: JSON.stringify([
            { name: 'Amount within auto-limit', passed: true, detail: '₹5,000 ≤ ₹25,000 threshold' },
            { name: 'Strategy retry budget', passed: true, detail: '0/2 attempts used for Smart Retry' },
            { name: 'Recovery probability', passed: true, detail: '87% ≥ 30% guardrail' },
            { name: 'No consecutive duplicate', passed: true, detail: 'Initial attempt' }
          ]),
          policy_status_text: '🟢 ACTION APPROVED',
          action_status: 'executed',
          action_payload: JSON.stringify({ channel: 'gateway_reroute', target_node: 'HDFC_SECONDARY_NODE' }),
          outcome: 'failure',
          failure_reason: 'Secondary gateway timed out (504 Gateway Timeout)',
          next_action: 'RE_EVALUATION',
          created_at: '10:41:02',
          updated_at: '10:41:05'
        },
        {
          id: 'STEP-REC-92831-2',
          case_id: 'REC-92831',
          attempt_number: 2,
          strategy_id: 'whatsapp_payment_link',
          strategy_name: 'WhatsApp Customer Recovery Link',
          reasoning: 'Immediate retry failed due to gateway timeout. Adapting strategy to direct 1-click WhatsApp customer recovery token.',
          policy_approved: 1,
          policy_checks: JSON.stringify([
            { name: 'Amount within auto-limit', passed: true, detail: '₹5,000 ≤ ₹25,000 threshold' },
            { name: 'Strategy retry budget', passed: true, detail: '0/2 attempts used for WhatsApp Link' },
            { name: 'Customer contact quota', passed: true, detail: '0/2 communications today' },
            { name: 'No consecutive duplicate', passed: true, detail: 'Strategy switched from smart_retry' }
          ]),
          policy_status_text: '🟢 ACTION APPROVED',
          action_status: 'executed',
          action_payload: JSON.stringify({ channel: 'whatsapp', payment_link_id: 'plink_92831', phone: '+91 98765 43210' }),
          outcome: 'success',
          failure_reason: null,
          next_action: 'CASE_RECOVERED',
          created_at: '10:41:10',
          updated_at: '10:41:25'
        }
      ]
    },

    instant: {
      caseId: 'REC-44109',
      status: 'recovered',
      currentStage: 'Payment Verified & Settled',
      totalAttempts: 1,
      isTerminal: true,
      finalDecision: 'RECOVERED',
      steps: [
        {
          id: 'STEP-REC-44109-1',
          case_id: 'REC-44109',
          attempt_number: 1,
          strategy_id: 'whatsapp_payment_link',
          strategy_name: 'WhatsApp Customer Recovery Link',
          reasoning: 'High-confidence recoverable failure. Dispatched 1-click WhatsApp payment link directly to customer.',
          policy_approved: 1,
          policy_checks: JSON.stringify([
            { name: 'Amount within auto-limit', passed: true, detail: '₹3,200 ≤ ₹25,000 threshold' },
            { name: 'Recovery probability', passed: true, detail: '91% ≥ 30% guardrail' },
            { name: 'Customer contact quota', passed: true, detail: '0/2 communications used' }
          ]),
          policy_status_text: '🟢 ACTION APPROVED',
          action_status: 'executed',
          action_payload: JSON.stringify({ channel: 'whatsapp', payment_link_id: 'plink_44109' }),
          outcome: 'success',
          failure_reason: null,
          next_action: 'CASE_RECOVERED',
          created_at: '09:15:20',
          updated_at: '09:15:45'
        }
      ]
    },

    escalate: {
      caseId: 'REC-78012',
      status: 'human_review',
      currentStage: 'Awaiting Operator Approval',
      totalAttempts: 2,
      isTerminal: false,
      finalDecision: 'ESCALATED',
      steps: [
        {
          id: 'STEP-REC-78012-1',
          case_id: 'REC-78012',
          attempt_number: 1,
          strategy_id: 'payment_method_update',
          strategy_name: 'Request Payment Method Update',
          reasoning: 'Card mandate declined due to daily limit. Prompted customer to switch to Netbanking or UPI.',
          policy_approved: 1,
          policy_checks: JSON.stringify([
            { name: 'Amount check', passed: true, detail: '₹45,000' },
            { name: 'Quota check', passed: true, detail: '1/2 customer touch' }
          ]),
          policy_status_text: '🟢 ACTION APPROVED',
          action_status: 'executed',
          action_payload: JSON.stringify({ channel: 'whatsapp_nudge' }),
          outcome: 'failure',
          failure_reason: 'Customer declined alternate payment method',
          next_action: 'RE_EVALUATION',
          created_at: '11:20:00',
          updated_at: '11:23:10'
        },
        {
          id: 'STEP-REC-78012-2',
          case_id: 'REC-78012',
          attempt_number: 2,
          strategy_id: 'human_review',
          strategy_name: 'Escalate to Human Review',
          reasoning: 'High-ticket order (> ₹25,000 auto limit) following customer decline. Requiring operator review.',
          policy_approved: 0,
          policy_checks: JSON.stringify([
            { name: 'Amount within auto-limit', passed: false, detail: '₹45,000 exceeds ₹25,000 threshold' },
            { name: 'Requires Human Approval', passed: false, detail: 'Operator sign-off required' }
          ]),
          policy_status_text: '🟡 HUMAN APPROVAL REQUIRED (High value order)',
          action_status: 'skipped',
          action_payload: JSON.stringify({ escalated: true }),
          outcome: 'failure',
          failure_reason: 'Amount exceeds merchant auto-limit guardrail',
          next_action: 'ESCALATED',
          created_at: '11:23:15',
          updated_at: '11:23:15'
        }
      ]
    },

    stopped: {
      caseId: 'REC-55190',
      status: 'stopped',
      currentStage: 'Recovery Halted',
      totalAttempts: 1,
      isTerminal: true,
      finalDecision: 'STOPPED',
      steps: [
        {
          id: 'STEP-REC-55190-1',
          case_id: 'REC-55190',
          attempt_number: 1,
          strategy_id: 'stop',
          strategy_name: 'Halt Recovery (Terminal Stop)',
          reasoning: 'Risk Sentinel detected high-velocity decline signatures matching fraud pattern. Autonomous recovery halted.',
          policy_approved: 1,
          policy_checks: JSON.stringify([
            { name: 'Risk Sentinel Check', passed: false, detail: 'Multiple card velocity triggers flagged' },
            { name: 'Recovery Probability', passed: false, detail: '8% below 30% guardrail threshold' }
          ]),
          policy_status_text: '🛑 ACTION STOPPED (Risk Sentinel Flag)',
          action_status: 'executed',
          action_payload: JSON.stringify({ stopped: true, reason: 'risk_sentinel_flag' }),
          outcome: 'failure',
          failure_reason: 'Card blocked by issuer risk rules',
          next_action: 'CASE_STOPPED',
          created_at: '08:04:12',
          updated_at: '08:04:13'
        }
      ]
    }
  };

  // Fetch real journey from backend if available, fallback to preset
  const loadJourney = async () => {
    if (activeScenario !== 'adaptive') {
      setJourneyData(DEMO_SCENARIOS[activeScenario]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/recovery/cases/${caseId}/journey`);
      if (res.ok) {
        const data: RecoveryJourneyData = await res.json();
        if (data.steps && data.steps.length > 0) {
          setJourneyData(data);
          setLoading(false);
          return;
        }
      }
    } catch {
      // Backend journey not found or endpoint offline
    }
    setJourneyData(DEMO_SCENARIOS.adaptive);
    setLoading(false);
  };

  const selectScenario = (s: 'adaptive' | 'instant' | 'escalate' | 'stopped') => {
    setActiveScenario(s);
    setJourneyData(DEMO_SCENARIOS[s]);
  };

  useEffect(() => {
    loadJourney();
  }, [caseId, activeScenario]);

  // Simulate real multi-attempt adaptive run via backend
  const handleSimulateAdaptive = async () => {
    setIsSimulating(true);
    try {
      const res = await fetch(`/api/recovery/cases/${caseId}/journey/simulate-adaptive`, {
        method: 'POST'
      });
      if (res.ok) {
        const json = await res.json();
        if (json.journey) {
          setJourneyData(json.journey);
          setActiveScenario('adaptive');
          setIsSimulating(false);
          return;
        }
      }
    } catch {
      // Simulation endpoint error fallback
    }
    // Animate locally
    setJourneyData(DEMO_SCENARIOS.adaptive);
    setIsSimulating(false);
  };

  const currentJourney = journeyData || DEMO_SCENARIOS[activeScenario];

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      {/* Top Header */}
      <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-widest font-mono">
              <Sparkles className="w-3 h-3 text-indigo-400" /> Layer 2 Closed-Loop Agent
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 font-mono">
              Deterministic Policy Authority
            </span>
          </div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            Adaptive Recovery Journey
          </h2>
          <p className="text-xs text-slate-300 mt-0.5">
            Multi-attempt adaptive pipeline: <code className="text-indigo-300 font-mono font-bold">Detect → Diagnose → Decide → Policy → Act → Verify → Evaluate → Re-evaluate</code>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-slate-800/80 p-1 rounded-xl border border-slate-700/80 flex items-center gap-1">
            <button
              onClick={() => selectScenario('adaptive')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeScenario === 'adaptive'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Adaptive Switch
            </button>
            <button
              onClick={() => selectScenario('instant')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeScenario === 'instant'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Single Pass
            </button>
            <button
              onClick={() => selectScenario('escalate')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeScenario === 'escalate'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Human Escalation
            </button>
            <button
              onClick={() => selectScenario('stopped')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeScenario === 'stopped'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Policy Halt
            </button>
          </div>

          <button
            onClick={handleSimulateAdaptive}
            disabled={isSimulating}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-60"
          >
            {isSimulating ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            Simulate Journey
          </button>
        </div>
      </div>

      {/* Invariants & Guardrails Status Bar */}
      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-4 text-slate-600 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-slate-700">Loop Budget:</span>
            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
              {currentJourney.totalAttempts} / 3 Iterations
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span className="font-semibold text-slate-700">Customer Touches:</span>
            <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-800 font-bold">
              {currentJourney.steps.filter((s) => s.strategy_id === 'whatsapp_payment_link' || s.strategy_id === 'payment_method_update').length} / 2 Max
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="font-semibold text-slate-700">Consecutive Duplicates:</span>
            <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              Prohibited (Enforced)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px] uppercase tracking-wider font-mono font-bold">Verdict:</span>
          <span
            className={`px-2.5 py-1 rounded-full font-mono text-[11px] font-black uppercase tracking-wider ${
              currentJourney.finalDecision === 'RECOVERED'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : currentJourney.finalDecision === 'ESCALATED'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : currentJourney.finalDecision === 'STOPPED'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-indigo-100 text-indigo-800 border border-indigo-300'
            }`}
          >
            {currentJourney.finalDecision}
          </span>
          <button
            onClick={() => setWhyActionModalOpen(true)}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
            title="Inspect Layer 3 Explainability & Strategy Intelligence"
          >
            <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
            <span>Why this action?</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Attempt Journey Visualization */}
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          {currentJourney.steps.map((step, idx) => {
            const isLast = idx === currentJourney.steps.length - 1;
            const isFailed = step.outcome === 'failure';
            const isSuccess = step.outcome === 'success';
            const parsedChecks = step.policy_checks ? JSON.parse(step.policy_checks) : [];

            return (
              <div key={step.id} className="relative">
                {/* Connecting Arrow Line to Next Attempt */}
                {!isLast && (
                  <div className="absolute left-8 top-full h-8 w-0.5 bg-gradient-to-b from-slate-300 to-indigo-400 z-0"></div>
                )}

                <div
                  className={`relative z-1 rounded-2xl border transition-all p-5 ${
                    isSuccess
                      ? 'bg-emerald-50/40 border-emerald-200 shadow-sm'
                      : isFailed && !isLast
                        ? 'bg-amber-50/30 border-amber-200/90'
                        : isFailed && step.strategy_id === 'stop'
                          ? 'bg-rose-50/40 border-rose-200 shadow-sm'
                          : 'bg-slate-50/70 border-slate-200 shadow-sm'
                  }`}
                >
                  {/* Step Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/70">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm font-mono shadow-sm ${
                          isSuccess
                            ? 'bg-emerald-600 text-white'
                            : isFailed && !isLast
                              ? 'bg-amber-500 text-white'
                              : isFailed && step.strategy_id === 'stop'
                                ? 'bg-rose-600 text-white'
                                : 'bg-indigo-600 text-white'
                        }`}
                      >
                        0{step.attempt_number}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">
                            Attempt #{step.attempt_number}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono ${
                              step.strategy_id === 'smart_retry'
                                ? 'bg-blue-100 text-blue-800'
                                : step.strategy_id === 'whatsapp_payment_link'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : step.strategy_id === 'payment_method_update'
                                    ? 'bg-purple-100 text-purple-800'
                                    : step.strategy_id === 'human_review'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {step.strategy_name}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-slate-900 mt-0.5">
                          {step.strategy_name}
                        </h4>
                      </div>
                    </div>

                    {/* Step Status Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-white border border-slate-200 text-slate-700 shadow-2xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        {step.policy_status_text}
                      </span>

                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black font-mono uppercase tracking-wider ${
                          isSuccess
                            ? 'bg-emerald-600 text-white'
                            : isFailed
                              ? 'bg-rose-600 text-white'
                              : 'bg-indigo-600 text-white'
                        }`}
                      >
                        {isSuccess ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> VERIFIED SUCCESS
                          </>
                        ) : (
                          <>
                            <AlertCircle className="w-3.5 h-3.5" /> ATTEMPT FAILED
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Step Reasoning & Execution Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {/* Left: AI Rationale & Policy Check */}
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <BrainCircuit className="w-4 h-4 text-indigo-600" />
                          <span className="text-xs font-bold uppercase tracking-wider font-mono text-slate-700">
                            Reasoning & Recommendation
                          </span>
                        </div>
                        <button
                          onClick={() => setWhyActionModalOpen(true)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer"
                          title="Inspect AI Strategy Intelligence and Policy Guardrails"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-600" />
                          <span>Why this action?</span>
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed font-sans">
                        {step.reasoning}
                      </p>

                      {/* Deterministic Policy Guardrail Checks */}
                      <div className="pt-2 border-t border-slate-100 space-y-1">
                        <span className="text-[10px] font-mono font-bold text-slate-500 uppercase block">
                          Policy Sentinel Evaluated:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {parsedChecks.slice(0, 4).map((chk: any, cidx: number) => (
                            <div
                              key={cidx}
                              className="flex items-center gap-1 text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded border border-slate-100"
                            >
                              <span className={chk.passed ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                {chk.passed ? '✓' : '⚠️'}
                              </span>
                              <span className="truncate">{chk.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right: Action Dispatch & Outcome Telemetry */}
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs space-y-2.5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-slate-600 mb-1.5">
                          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider font-mono text-slate-700">
                            <Activity className="w-4 h-4 text-emerald-600" /> Action Dispatch
                          </span>
                          <span className="text-[10px] font-mono text-slate-600">
                            Status: <strong className="uppercase">{step.action_status}</strong>
                          </span>
                        </div>
                        <div className="bg-slate-900 text-emerald-400 p-2.5 rounded-lg font-mono text-[11px] overflow-x-auto">
                          {step.action_payload}
                        </div>
                      </div>

                      {/* Outcome / Failure Reason */}
                      <div className="pt-2 border-t border-slate-100">
                        {isSuccess ? (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>
                              <strong>Payment verified via webhook:</strong> Funds captured into merchant Razorpay balance.
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                            <CircleAlert className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>Failure reason:</strong> {step.failure_reason || 'Action failed to settle.'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Dedicated Strategy Decision Card (Step 10 Authority Transparency) */}
                  <div className="mt-4 p-4 rounded-xl bg-slate-900 text-white border border-slate-800 space-y-3 text-xs shadow-md">
                    <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                      <span className="font-mono text-[10px] uppercase font-bold text-indigo-400 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-indigo-400" />
                        STRATEGY DECISION (AUTHORITATIVE BOUNDED RESOLUTION)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Attempt #{step.attempt_number}
                      </span>
                    </div>

                    {/* Selected & Why + Alternatives */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80 space-y-1">
                        <span className="text-[9px] font-mono uppercase font-bold text-emerald-400 block">
                          Selected Strategy: {step.strategy_id}
                        </span>
                        <div className="font-bold text-slate-100">{step.strategy_name}</div>
                        <p className="text-[11px] text-slate-300 leading-snug pt-0.5">
                          <strong>Why: </strong>
                          {step.strategy_id === 'smart_retry'
                            ? 'Temporary bank timeout with no prior retry; retry is lower-friction than customer outreach.'
                            : step.strategy_id === 'whatsapp_payment_link'
                              ? 'Direct 1-click tokenized payment link after bank recovery; highest conversion yield without repeated friction.'
                              : step.strategy_id === 'delayed_retry'
                                ? 'Acquiring cluster undergoing transient cool-down; delay enables node normalization.'
                                : 'Customer payment instrument invalid/expired; prompt method update for settlement.'}
                        </p>
                      </div>

                      {/* Alternatives Considered & Why Rejected */}
                      <div className="p-3 rounded-lg bg-slate-800/90 border border-slate-700/80 space-y-1">
                        <span className="text-[9px] font-mono uppercase font-bold text-amber-400 block">
                          Alternatives Considered & Why Not Selected:
                        </span>
                        <ul className="space-y-1 text-[11px] text-slate-300 pt-0.5">
                          {step.strategy_id !== 'smart_retry' && (
                            <li>
                              <strong className="text-slate-200">Smart Retry:</strong>{' '}
                              {step.attempt_number > 1 ? 'Previous retry failed or consecutive duplicate prohibited.' : 'Customer abandoned checkout.'}
                            </li>
                          )}
                          {step.strategy_id !== 'whatsapp_payment_link' && (
                            <li>
                              <strong className="text-slate-200">WhatsApp Link:</strong> Reserved for checkout drop-off or secondary attempt; passive retry preferred first.
                            </li>
                          )}
                          {step.strategy_id !== 'delayed_retry' && (
                            <li>
                              <strong className="text-slate-200">Delayed Retry:</strong> High urgency checkout; immediate recovery or direct notification yields faster completion.
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>

                    {/* Triad: AI Recommendation vs Policy Verdict vs Final Authorized Strategy */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-800 font-mono text-[11px]">
                      <div className="p-2.5 rounded bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[9px] text-slate-400 block uppercase">AI Recommendation</span>
                        <span className="font-bold text-amber-400 truncate block mt-0.5">
                          {step.strategy_name}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-800/60 border border-slate-700/50">
                        <span className="text-[9px] text-slate-400 block uppercase">Policy Verdict</span>
                        <span className="font-bold text-blue-400 truncate block mt-0.5">
                          {step.policy_status_text}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-slate-800/60 border border-emerald-500/40">
                        <span className="text-[9px] text-emerald-400 block uppercase">Final Authorized Strategy</span>
                        <span className="font-bold text-emerald-300 truncate block mt-0.5">
                          {step.strategy_id}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Transition Banner between Attempts */}
                {!isLast && (
                  <div className="my-2.5 ml-6 pl-6 flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 border border-indigo-200 text-[11px] font-bold font-mono flex items-center gap-1.5 shadow-2xs">
                      <RefreshCw className="w-3 h-3 text-indigo-600 animate-spin" />
                      Closed-Loop Transition: RE_EVALUATION triggered → Strategy Switched
                      <ArrowRight className="w-3 h-3 text-indigo-600" />
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Final Decision Banner */}
        <div
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            currentJourney.finalDecision === 'RECOVERED'
              ? 'bg-gradient-to-r from-emerald-900 via-teal-900 to-emerald-950 text-white border-emerald-700/60 shadow-lg'
              : currentJourney.finalDecision === 'ESCALATED'
                ? 'bg-gradient-to-r from-amber-900 via-yellow-950 to-amber-950 text-white border-amber-700/60 shadow-lg'
                : 'bg-gradient-to-r from-slate-900 via-rose-950 to-slate-950 text-white border-rose-700/60 shadow-lg'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${
                currentJourney.finalDecision === 'RECOVERED'
                  ? 'bg-emerald-500 text-white'
                  : currentJourney.finalDecision === 'ESCALATED'
                    ? 'bg-amber-500 text-white'
                    : 'bg-rose-500 text-white'
              }`}
            >
              {currentJourney.finalDecision === 'RECOVERED' ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : currentJourney.finalDecision === 'ESCALATED' ? (
                <AlertCircle className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-300 font-mono">
                Closed-Loop Terminal Outcome
              </span>
              <h3 className="text-lg font-black tracking-tight">
                {currentJourney.finalDecision === 'RECOVERED' && 'Case Recovered & Settled — Loop Terminated'}
                {currentJourney.finalDecision === 'ESCALATED' && 'Case Escalated to Merchant Dashboard'}
                {currentJourney.finalDecision === 'STOPPED' && 'Recovery Permanently Stopped by Sentinel'}
              </h3>
              <p className="text-xs text-slate-300">
                {currentJourney.finalDecision === 'RECOVERED' &&
                  'Revenue successfully retrieved. All terminal safety invariants satisfied with zero duplicate touch.'}
                {currentJourney.finalDecision === 'ESCALATED' &&
                  'High ticket threshold or retry limit reached. Routed safely to human operator queue.'}
                {currentJourney.finalDecision === 'STOPPED' &&
                  'Risk sentinel flag or non-viable probability. Transaction halted to protect merchant from fees.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-mono font-bold">
              {currentJourney.totalAttempts} Attempt(s) Logged
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs font-mono font-bold">
              Status: {currentJourney.status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Layer 3: Why This Action Modal */}
      <WhyThisActionModal
        isOpen={whyActionModalOpen}
        onClose={() => setWhyActionModalOpen(false)}
        caseId={currentJourney.caseId || caseId}
      />
    </div>
  );
};
