import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  BarChart3,
  Play,
  RotateCcw,
  Check,
  Clock,
  Layers,
  ArrowUpRight,
  Flame,
} from 'lucide-react';
import { CampaignSimulationResult } from '../../types';
import { CAMPAIGN_SIMULATION_RESULT } from '../../data/campaignsData';

interface CampaignSimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaignName: string;
}

export const CampaignSimulationModal: React.FC<CampaignSimulationModalProps> = ({
  isOpen,
  onClose,
  campaignName,
}) => {
  const [simulationState, setSimulationState] = useState<
    'ready' | 'simulating' | 'completed'
  >('ready');
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  const simulationSteps = [
    'Analyzing transactions...',
    'Diagnosing failure reasons & PSP telemetry...',
    'Calculating multi-factor recovery probabilities...',
    'Applying safety policies & threshold caps...',
    'Simulating smart multi-rail execution actions...',
    'Verifying simulated capture & settlement...',
  ];

  const results: CampaignSimulationResult = CAMPAIGN_SIMULATION_RESULT;

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleStartSimulation = () => {
    setSimulationState('simulating');
    setCurrentStepIndex(0);

    // Step progression timer
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < simulationSteps.length) {
        setCurrentStepIndex(step);
      } else {
        clearInterval(interval);
        setSimulationState('completed');
      }
    }, 600);
  };

  const handleReset = () => {
    setSimulationState('ready');
    setCurrentStepIndex(0);
  };

  if (!isOpen) return null;

  return (
    <div
      id="campaign-simulation-modal-overlay"
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 transition-opacity"
      onClick={onClose}
    >
      <div
        id="campaign-simulation-modal"
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-slate-50/90 px-6 py-4 border-b border-slate-150 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  {campaignName}
                </h2>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                  Campaign Created ✓
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Batch recovery workflow simulation & financial yield analysis.
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

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* READY STATE */}
          {simulationState === 'ready' && (
            <div className="space-y-5 text-center py-6">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200/80 shadow-xs">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
              <div className="max-w-md mx-auto space-y-1.5">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Status: Ready to Run
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  ReviveAI has staged 1,000 transactions at risk. Run a full simulation to evaluate projected recovery rate, financial lift vs baseline, and strategy distribution.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 max-w-md mx-auto grid grid-cols-2 gap-3 text-left">
                <div className="p-2.5 bg-white rounded-xl border border-slate-150">
                  <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                    Staged Volume
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">
                    1,000 Transactions
                  </div>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-slate-150">
                  <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                    Revenue at Risk
                  </div>
                  <div className="text-sm font-extrabold text-amber-900 font-mono mt-0.5">
                    ₹10.24 Lakhs
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleStartSimulation}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all inline-flex items-center gap-2 active:scale-[0.98]"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Run Simulation</span>
                </button>
              </div>
            </div>
          )}

          {/* SIMULATING PROGRESS STATE */}
          {simulationState === 'simulating' && (
            <div className="space-y-6 py-8">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-200">
                  <span className="w-6 h-6 rounded-full border-3 border-indigo-600 border-t-transparent animate-spin inline-block" />
                </div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Simulating Batch Recovery Workflow
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  Processing 1,000 transactions across ReviveAI inference engine
                </p>
              </div>

              <div className="max-w-lg mx-auto bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-3">
                {simulationSteps.map((stepText, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isActive = idx === currentStepIndex;
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 text-xs transition-opacity duration-200 ${
                        isDone
                          ? 'text-emerald-700 font-semibold'
                          : isActive
                          ? 'text-indigo-700 font-bold'
                          : 'text-slate-400'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0">
                        {isDone ? (
                          <Check className="w-4 h-4 text-emerald-600" />
                        ) : isActive ? (
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-300" />
                        )}
                      </div>
                      <span>{stepText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* COMPLETED RESULTS STATE */}
          {simulationState === 'completed' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* STATUS BANNER */}
              <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-950 font-mono uppercase">
                      Simulation Complete ✓
                    </div>
                    <div className="text-xs text-emerald-800">
                      Evaluated 1,000 transactions across all diagnostic dimensions.
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  className="px-3 py-1.5 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 shadow-2xs"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Rerun</span>
                </button>
              </div>

              {/* CORE FINANCIAL OUTCOMES */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150">
                  <div className="text-[10px] text-slate-400 font-bold uppercase font-mono">
                    Transactions Analyzed
                  </div>
                  <div className="text-xl font-black text-slate-900 font-mono mt-1">
                    {results.transactionsAnalyzed.toLocaleString()}
                  </div>
                </div>

                <div className="bg-amber-50/70 p-4 rounded-xl border border-amber-200/70">
                  <div className="text-[10px] text-amber-800 font-bold uppercase font-mono">
                    Revenue at Risk
                  </div>
                  <div className="text-xl font-black text-amber-900 font-mono mt-1">
                    {formatINR(results.revenueAtRisk)}
                  </div>
                </div>

                <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200/70">
                  <div className="text-[10px] text-indigo-800 font-bold uppercase font-mono">
                    Potentially Recoverable
                  </div>
                  <div className="text-xl font-black text-indigo-900 font-mono mt-1">
                    {formatINR(results.potentiallyRecoverable)}
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                  <div className="text-[10px] text-emerald-800 font-bold uppercase font-mono">
                    Recovered Revenue
                  </div>
                  <div className="text-xl font-black text-emerald-700 font-mono mt-1">
                    {formatINR(results.recovered)}
                  </div>
                  <div className="text-[10px] text-emerald-700 font-bold font-mono mt-0.5">
                    {results.recoveryRate}% conversion yield
                  </div>
                </div>
              </div>

              {/* SECTION: RECOVERY BY STRATEGY */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    <span>Recovery Breakdown by Strategy</span>
                  </h3>
                  <span className="text-[10px] font-mono text-slate-400">Yield Allocation</span>
                </div>

                <div className="space-y-3">
                  {results.byStrategy.map((strat, idx) => (
                    <div key={idx} className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{strat.strategy}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-400">{strat.share}%</span>
                          <span className="font-extrabold text-emerald-700">
                            {formatINR(strat.amount)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${strat.share}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* SECTION: AI VS BASELINE (CRITICAL FINANCIAL PROOF) */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 font-bold">
                      Razorpay Benchmark Analysis
                    </span>
                    <h3 className="text-sm font-bold text-white tracking-tight mt-0.5 flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>AI Orchestration vs Baseline Approaches</span>
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    +36.4% Net Lift
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-1">
                  {results.aiVsBaseline.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border ${
                        item.method === 'ReviveAI'
                          ? 'bg-indigo-600/30 border-indigo-400/50 shadow-inner'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="text-[10px] text-slate-300 font-bold uppercase font-mono">
                        {item.method}
                      </div>
                      <div
                        className={`text-lg font-black font-mono mt-1 ${
                          item.method === 'ReviveAI' ? 'text-emerald-300' : 'text-slate-100'
                        }`}
                      >
                        {formatINR(item.amount)}
                      </div>
                      {item.lift && (
                        <div className="text-[10px] text-indigo-300 font-mono mt-0.5">
                          {item.lift}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50/90 px-6 py-4 border-t border-slate-150 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            ReviveAI Policy Engine v2.4
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
