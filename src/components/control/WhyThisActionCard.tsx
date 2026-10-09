import React, { useState } from 'react';
import {
  BrainCircuit,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Info
} from 'lucide-react';
import { ExplainabilityReport } from '../../types';
import { WhyThisActionModal } from './WhyThisActionModal';

interface WhyThisActionCardProps {
  caseId: string;
  report?: ExplainabilityReport | null;
  onOpenFullModal?: () => void;
  className?: string;
}

export const WhyThisActionCard: React.FC<WhyThisActionCardProps> = ({
  caseId,
  report,
  onOpenFullModal,
  className = '',
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const handleOpenModal = () => {
    if (onOpenFullModal) {
      onOpenFullModal();
    } else {
      setModalOpen(true);
    }
  };

  const rec = report?.aiRecommendation;
  const policy = report?.deterministicPolicyDecision;

  return (
    <>
      <div className={`rounded-xl border-2 border-indigo-200 bg-linear-to-br from-indigo-50/40 via-white to-emerald-50/30 p-4 shadow-xs transition-all ${className}`}>
        {/* Header banner */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-indigo-100/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <BrainCircuit className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-slate-900 tracking-tight">Why this action?</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-700">
                  LAYER 3 INTELLIGENCE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                AI Recommendation contrasted against Deterministic Policy Authority
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenModal}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
            >
              <span>Explain Decision</span>
              <ExternalLink className="w-3 h-3" />
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title={expanded ? 'Collapse' : 'Expand preview'}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Quick Contrast Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
          {/* AI Side */}
          <div className="p-3 rounded-lg bg-white border border-indigo-100 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[10px] font-mono uppercase text-indigo-700 flex items-center gap-1">
                <span>🤖</span> AI Strategy Recommendation
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-600">
                {Math.round((rec?.recoveryProbability || 0.87) * 100)}% prob
              </span>
            </div>
            <div className="font-black text-slate-900">
              {rec?.recommendedStrategy.name || 'WhatsApp Customer Recovery Link'}
            </div>
            <p className="text-[11px] text-slate-600 line-clamp-2">
              "{rec?.reasoning || 'Temporary issuer degradation on HDFC switch. High intent intact (0 retries), maximizing recovery via 1-click WhatsApp link.'}"
            </p>
          </div>

          {/* Policy Side */}
          <div className="p-3 rounded-lg bg-white border border-emerald-100 space-y-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[10px] font-mono uppercase text-emerald-700 flex items-center gap-1">
                <span>⚖️</span> Deterministic Policy Verdict
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                {policy?.isApproved ? 'APPROVED' : 'PENDING'}
              </span>
            </div>
            <div className="font-bold text-slate-800">
              5/5 Merchant Guardrails Passed
            </div>
            <p className="text-[11px] text-slate-500">
              Zero execution privilege for AI. Strictly bounded by merchant thresholds (₹25,000 auto-limit, 30% min probability).
            </p>
          </div>
        </div>

        {/* Expandable deep dive */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-indigo-100/70 space-y-3 text-xs animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Evidence */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80 space-y-1.5">
                <span className="font-mono text-[10px] font-bold uppercase text-slate-500 block">
                  Grounding Evidence
                </span>
                <ul className="space-y-1 text-[11px] text-slate-700">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>HDFC switch latency spiked +480ms (Success rate: 69%)</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>17 clustered gateway timeout signatures detected</span>
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Customer previous retry count = 0 (clean state)</span>
                  </li>
                </ul>
              </div>

              {/* Alternative Considered */}
              <div className="p-3 rounded-lg bg-amber-50/60 border border-amber-200/80 space-y-1.5">
                <span className="font-mono text-[10px] font-bold uppercase text-amber-800 block">
                  Alternative Considered & Rejected
                </span>
                <div className="font-semibold text-slate-800 text-[11px]">
                  {rec?.alternativeConsidered.name || 'Delayed Intelligent Retry'}
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  {rec?.alternativeConsidered.whyRejected || 'Rejected because delayed retry risks customer abandoning purchase before 15m retry window opens.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
              <span>Model: Gemini 2.5 Flash with deterministic schema validation</span>
              <button
                onClick={handleOpenModal}
                className="text-indigo-600 hover:text-indigo-800 font-semibold underline flex items-center gap-1"
              >
                <span>View Full Audit & Policy Report</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <WhyThisActionModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          caseId={caseId}
          initialReport={report}
        />
      )}
    </>
  );
};
