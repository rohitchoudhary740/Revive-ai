import React, { useState } from 'react';
import {
  X,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Check,
  Zap,
  Info,
  Layers,
  Gauge,
  Sliders,
} from 'lucide-react';
import { RecoveryStrategyItem } from '../../types';

interface StrategyDetailDrawerProps {
  strategy: RecoveryStrategyItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectStrategy?: (id: string) => void;
}

export const StrategyDetailDrawer: React.FC<StrategyDetailDrawerProps> = ({
  strategy,
  isOpen,
  onClose,
  onSelectStrategy,
}) => {
  const [isApplied, setIsApplied] = useState<boolean>(false);

  if (!isOpen || !strategy) return null;

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleApply = () => {
    setIsApplied(true);
    if (onSelectStrategy) {
      onSelectStrategy(strategy.id);
    }
    setTimeout(() => {
      setIsApplied(false);
    }, 2500);
  };

  return (
    <div
      id="strategy-detail-drawer-overlay"
      className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity"
      onClick={onClose}
    >
      <div
        id="strategy-detail-drawer"
        className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col border-l border-slate-200/80 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-150 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-extrabold flex items-center justify-center text-sm border border-indigo-100 shadow-xs">
              <Zap className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {strategy.name}
                </h2>
                <span className="text-[10px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                  {strategy.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{strategy.bestFor}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6 flex-1">
          {/* STATS MATRIX */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-150">
              <div className="text-[10px] text-emerald-800 font-bold uppercase font-mono">
                Success Rate
              </div>
              <div className="text-xl font-black text-emerald-800 font-mono mt-0.5">
                {strategy.successRate}%
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150">
              <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                Avg. Recovery
              </div>
              <div className="text-base font-black text-slate-900 font-mono mt-0.5">
                {strategy.avgRecovery > 0 ? formatINR(strategy.avgRecovery) : 'N/A'}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150">
              <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                Customer Friction
              </div>
              <div
                className={`text-xs font-extrabold font-mono mt-1 ${
                  strategy.customerFriction === 'Low' || strategy.customerFriction === 'None'
                    ? 'text-emerald-700'
                    : strategy.customerFriction === 'Medium'
                    ? 'text-amber-700'
                    : 'text-rose-700'
                }`}
              >
                {strategy.customerFriction}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-150">
              <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                Risk Rating
              </div>
              <div className="text-xs font-extrabold text-slate-800 font-mono mt-1">
                {strategy.risk}
              </div>
            </div>
          </div>

          {/* AI EXPLANATION BOX */}
          <div className="bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/40 rounded-2xl p-5 border border-indigo-200 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider font-mono">
                AI Reasoning & Behavioral Logic
              </h3>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              "{strategy.aiExplanation}"
            </p>
          </div>

          {/* PARAMETERS & CONFIGURATION */}
          <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-slate-500" />
              <span>Operational Parameters</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                  Recommended Timing Delay
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {strategy.recommendedDelay || 'Immediate'}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                  Maximum Auto Attempts
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  {strategy.maxAttempts} attempt{strategy.maxAttempts > 1 ? 's' : ''}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                  Suitable Amount Range
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block font-mono">
                  {strategy.suitableAmountRange}
                </span>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-150">
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">
                  Optimal Trigger
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {strategy.bestTrigger}
                </span>
              </div>
            </div>
          </div>

          {/* POLICY RULES & GUARDRAILS */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Policy Guardrails Checklist</span>
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                100% Policy Compliant
              </span>
            </div>

            <div className="space-y-2">
              {strategy.policy.map((pol, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-150 text-xs"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-800 font-medium">{pol.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md px-6 py-4 border-t border-slate-150 flex items-center justify-between">
          <span className="text-xs text-slate-500 font-mono">
            Autonomous Policy Sentinel
          </span>

          <button
            onClick={handleApply}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-2 active:scale-[0.98] ${
              isApplied
                ? 'bg-emerald-600 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isApplied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Strategy Priority Updated ✓</span>
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Use This Strategy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
