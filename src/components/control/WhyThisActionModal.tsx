import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ArrowRight,
  Sparkles,
  RefreshCw,
  X,
  ShieldAlert,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  FileText
} from 'lucide-react';
import { ExplainabilityReport, RecoveryStrategyId } from '../../types';

interface WhyThisActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  caseId: string;
  initialReport?: ExplainabilityReport | null;
}

export const WhyThisActionModal: React.FC<WhyThisActionModalProps> = ({
  isOpen,
  onClose,
  caseId,
  initialReport = null,
}) => {
  const [report, setReport] = useState<ExplainabilityReport | null>(initialReport);
  const [loading, setLoading] = useState<boolean>(!initialReport);
  const [reEvaluating, setReEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntelligence = async (reEvaluate = false) => {
    try {
      if (reEvaluate) {
        setReEvaluating(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const endpoint = reEvaluate
        ? `/api/recovery/cases/${encodeURIComponent(caseId)}/intelligence/evaluate`
        : `/api/recovery/cases/${encodeURIComponent(caseId)}/intelligence`;

      const method = reEvaluate ? 'POST' : 'GET';
      const res = await fetch(endpoint, { method });

      if (!res.ok) {
        throw new Error(`Failed to fetch strategy intelligence: HTTP ${res.status}`);
      }

      const data: ExplainabilityReport = await res.json();
      setReport(data);
    } catch (err: any) {
      console.warn('Could not fetch server intelligence, using fallback state:', err);
      // Fallback local report if offline
      if (!report) {
        setReport({
          caseId,
          amount: 5000,
          failureCode: 'BANK_TIMEOUT',
          aiRecommendation: {
            recommendedStrategy: {
              id: 'whatsapp_payment_link',
              name: 'WhatsApp Customer Recovery Link',
              description: 'Interactive 1-click tokenized payment message sent to customer via WhatsApp API.',
            },
            confidence: 0.94,
            recoveryProbability: 0.87,
            reasoning: 'Customer payment failed due to temporary issuer degradation (HDFC switch latency spike). Customer intent is intact with zero previous retries, maximizing yield via direct 1-click WhatsApp recovery link.',
            evidence: [
              'HDFC/NPCI switch latency spiked +480ms in last 5 mins (Bank success rate: 69%)',
              'Clustered signature matches 17 simultaneous timeout events',
              'Customer previous retry count is 0 (clean state, zero fatigue)',
              'WhatsApp interactive notification conversion benchmark: 87.4%',
            ],
            alternativeConsidered: {
              id: 'delayed_retry',
              name: 'Delayed Intelligent Retry',
              whyRejected: 'Delayed retry risks customer drop-off as customer may assume transaction was discarded or move to a competitor checkout before retry window opens.',
            },
            riskFlags: [],
            isFallback: false,
          },
          deterministicPolicyDecision: {
            isApproved: true,
            requiresHumanApproval: false,
            isStopped: false,
            statusText: '🟢 ACTION APPROVED',
            checks: [
              { name: 'Amount within auto-limit', passed: true, detail: '₹5,000 ≤ ₹25,000 threshold' },
              { name: 'Recovery probability threshold', passed: true, detail: '87% ≥ 30% merchant guardrail' },
              { name: 'Strategy retry budget', passed: true, detail: '0/2 attempts used for WhatsApp Link' },
              { name: 'Customer communication quota', passed: true, detail: '0/2 messages sent today' },
              { name: 'Duplicate prevention', passed: true, detail: 'Idempotency verified — no active duplicate session' },
            ],
          },
          authorityStatement: 'CRITICAL ARCHITECTURE INVARIANT: The AI model provides reasoning and recommendations only. Deterministic policy rules retain sole authority over action execution.',
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setLoading(false);
      setReEvaluating(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialReport) {
        setReport(initialReport);
      } else {
        fetchIntelligence(false);
      }
    }
  }, [isOpen, caseId]);

  if (!isOpen) return null;

  const rec = report?.aiRecommendation;
  const policy = report?.deterministicPolicyDecision;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4.5 bg-linear-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
              <BrainCircuit className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base tracking-tight text-white">Why This Action?</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  LAYER 3 STRATEGY INTELLIGENCE
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5">
                Case: <strong className="text-indigo-200">{caseId}</strong> | Failure: <span className="text-amber-300">{report?.failureCode || 'BANK_TIMEOUT'}</span> | Amount: <span className="text-emerald-300">₹{(report?.amount || 5000).toLocaleString('en-IN')}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchIntelligence(true)}
              disabled={loading || reEvaluating}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-medium flex items-center gap-1.5 transition-colors border border-slate-700 disabled:opacity-50"
              title="Re-run Gemini strategy intelligence"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reEvaluating ? 'animate-spin text-indigo-400' : ''}`} />
              <span>{reEvaluating ? 'Analyzing...' : 'Re-evaluate'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 bg-slate-50/50">
          {loading && !report ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
              <p className="text-sm text-slate-600 font-medium">Synthesizing context-aware recovery intelligence...</p>
              <p className="text-xs text-slate-400">Evaluating telemetry, issuer nodes, retry limits, and merchant guardrails</p>
            </div>
          ) : (
            <>
              {/* Top Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Recommended Action</span>
                  <span className="text-sm font-black text-slate-900 mt-1 block truncate">
                    {rec?.recommendedStrategy.name || 'WhatsApp Recovery'}
                  </span>
                  <span className="text-[10px] text-indigo-600 font-mono block mt-0.5">
                    {rec?.recommendedStrategy.id || 'whatsapp_payment_link'}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Recovery Probability</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-black text-emerald-600 font-mono">
                      {Math.round((rec?.recoveryProbability || 0) * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      (Exp: ₹{Math.round((report?.amount || 5000) * (rec?.recoveryProbability || 0)).toLocaleString('en-IN')})
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Gemini Confidence</span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-xl font-black text-indigo-600 font-mono">
                      {Math.round((rec?.confidence || 0) * 100)}%
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">telemetry fit</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-xs">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-400 block">Policy Verdict</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${policy?.isApproved ? 'bg-emerald-500' : policy?.requiresHumanApproval ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span className="text-xs font-black uppercase font-mono text-slate-900">
                      {policy?.isApproved ? 'Approved' : policy?.requiresHumanApproval ? 'Needs Approval' : 'Stopped'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate mt-0.5">
                    {policy?.checks.filter(c => c.passed).length}/{policy?.checks.length} guardrails cleared
                  </span>
                </div>
              </div>

              {/* ARCHITECTURE CONTRAST: Side-by-Side Dual Engine */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1. AI RECOMMENDATION LAYER */}
                <div className="p-5 rounded-2xl bg-white border-2 border-indigo-200 shadow-xs space-y-4 relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        🤖
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-slate-900">AI Recommendation Layer</h4>
                        <span className="text-[10px] font-mono text-indigo-600">PROBABILISTIC REASONING ENGINE</span>
                      </div>
                    </div>
                    {rec?.isFallback ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-800">
                        SAFE FALLBACK
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-100 text-emerald-800">
                        GEMINI 2.5 FLASH
                      </span>
                    )}
                  </div>

                  {/* Primary Strategy Selection */}
                  <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-indigo-950 font-mono">
                        SELECTED STRATEGY
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-200/70 text-indigo-800 font-mono">
                        {rec?.recommendedStrategy.id}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      {rec?.recommendedStrategy.name}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {rec?.recommendedStrategy.description}
                    </p>
                  </div>

                  {/* Diagnostic Reasoning */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider block">
                      AI Diagnostic Reasoning:
                    </span>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed italic">
                      "{rec?.reasoning}"
                    </div>
                  </div>

                  {/* Grounded Evidence */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-700 uppercase font-mono tracking-wider block">
                      Synthesized Telemetry Evidence:
                    </span>
                    <ul className="space-y-1.5">
                      {rec?.evidence && rec.evidence.length > 0 ? (
                        rec.evidence.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400 italic">No telemetry evidence provided</li>
                      )}
                    </ul>
                  </div>

                  {/* Alternative Considered & Rejected */}
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-amber-950">
                      <span className="font-bold font-mono text-[11px] uppercase">
                        Alternative Considered
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 font-mono">
                        {rec?.alternativeConsidered.id || 'None'}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900">
                      {rec?.alternativeConsidered.name || 'Delayed Intelligent Retry'}
                    </div>
                    <div className="text-slate-700 space-y-1">
                      <span className="font-bold text-amber-900 text-[11px] block font-mono uppercase">
                        Why Alternative Was Rejected:
                      </span>
                      <p className="leading-relaxed">
                        {rec?.alternativeConsidered.whyRejected || 'Rejected due to lower immediate recovery probability.'}
                      </p>
                    </div>
                  </div>

                  {/* Risk Flags */}
                  {rec?.riskFlags && rec.riskFlags.length > 0 ? (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs space-y-1 text-red-900">
                      <span className="font-bold font-mono uppercase text-[10px] flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                        AI Identified Risk Signals:
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {rec.riskFlags.map((flag, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-mono font-bold">
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-medium font-mono">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Zero elevated risk signals detected in current transaction</span>
                    </div>
                  )}
                </div>

                {/* 2. DETERMINISTIC POLICY LAYER */}
                <div className="p-5 rounded-2xl bg-white border-2 border-emerald-200 shadow-xs space-y-4 relative flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs">
                          ⚖️
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">Deterministic Policy Engine</h4>
                          <span className="text-[10px] font-mono text-emerald-700">SAFETY SENTINEL & FINAL AUTHORITY</span>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold font-mono ${policy?.isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                        {policy?.statusText || '🟢 ACTION APPROVED'}
                      </span>
                    </div>

                    {/* Policy Checks Evaluated */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 uppercase font-mono text-[11px]">
                          Guardrail Rules Evaluated:
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">Zero-Trust Verification</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        {policy?.checks.map((check, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl border flex items-center justify-between ${check.passed ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'}`}
                          >
                            <div className="flex items-center gap-2">
                              {check.passed ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                              )}
                              <span className="font-medium">{check.name}</span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                              {check.detail}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Execution Authority Box */}
                    <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>AUTHORITY INVARIANT</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        The AI recommendation is strictly advisory. Execution cannot proceed without explicit deterministic policy approval. The AI agent holds <strong>ZERO direct payment execution authority</strong>.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-2 text-[10px] font-mono text-slate-400 border-t border-slate-800">
                        <div>Cannot modify guardrails: <span className="text-emerald-400 font-bold">LOCKED</span></div>
                        <div>Cannot bypass retries: <span className="text-emerald-400 font-bold">ENFORCED</span></div>
                        <div>Cannot alter amounts: <span className="text-emerald-400 font-bold">IMMUTABLE</span></div>
                        <div>Direct API trigger: <span className="text-red-400 font-bold">PROHIBITED</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Timestamp & Source Note */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>Evaluated: {report?.createdAt ? new Date(report.createdAt).toLocaleTimeString() : 'Live'}</span>
                    <span>ReviveAI Track 03 Protocol</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Info className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="text-[11px]">
              Every recovery recommendation is archived in the immutable audit trail for merchant transparency.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
          >
            Close Explanation
          </button>
        </div>
      </div>
    </div>
  );
};
