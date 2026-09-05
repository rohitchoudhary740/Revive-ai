import React from 'react';
import { ArrowRight, Sparkles, Filter, CheckCircle2, ChevronRight } from 'lucide-react';
import { FunnelStage } from '../types';

interface RecoveryFunnelProps {
  stages: FunnelStage[];
}

export const RecoveryFunnel: React.FC<RecoveryFunnelProps> = ({ stages }) => {
  return (
    <div
      id="revenue-recovery-funnel"
      className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)]"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              1. Revenue Recovery Funnel
            </h2>
            <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200/60 font-mono">
              Live Pipeline
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Stage-by-stage diagnosis and conversion from failed payment to settled revenue
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-50/80 backdrop-blur-sm px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          <span>AI Conversion Velocity: <strong>4.2 mins</strong></span>
        </div>
      </div>

      {/* Funnel Pipeline Horizontal Visualization */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {stages.map((stage, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === stages.length - 1;

          let colorStyles = {
            bg: 'bg-slate-50/70 hover:bg-slate-50',
            border: 'border-slate-200/70',
            amountColor: 'text-slate-900',
            stepBadge: 'bg-slate-200 text-slate-800',
          };

          if (stage.status === 'start') {
            colorStyles = {
              bg: 'bg-amber-50/50 hover:bg-amber-50/80',
              border: 'border-amber-200/80',
              amountColor: 'text-amber-900',
              stepBadge: 'bg-amber-500 text-white',
            };
          } else if (stage.status === 'diagnosing') {
            colorStyles = {
              bg: 'bg-blue-50/50 hover:bg-blue-50/80',
              border: 'border-blue-200/80',
              amountColor: 'text-blue-900',
              stepBadge: 'bg-blue-600 text-white',
            };
          } else if (stage.status === 'opportunity') {
            colorStyles = {
              bg: 'bg-indigo-50/50 hover:bg-indigo-50/80',
              border: 'border-indigo-200/80',
              amountColor: 'text-indigo-900',
              stepBadge: 'bg-indigo-600 text-white',
            };
          } else if (stage.status === 'active') {
            colorStyles = {
              bg: 'bg-purple-50/50 hover:bg-purple-50/80',
              border: 'border-purple-200/80',
              amountColor: 'text-purple-900',
              stepBadge: 'bg-purple-600 text-white',
            };
          } else if (stage.status === 'success') {
            colorStyles = {
              bg: 'bg-emerald-50/60 hover:bg-emerald-50/90',
              border: 'border-emerald-300/80',
              amountColor: 'text-emerald-900',
              stepBadge: 'bg-emerald-600 text-white',
            };
          }

          return (
            <div
              key={stage.id}
              id={`funnel-stage-${stage.id}`}
              className={`rounded-xl p-4 border ${colorStyles.border} ${colorStyles.bg} backdrop-blur-xs transition-all relative flex flex-col justify-between shadow-xs`}
            >
              {/* Top Step Counter & Name */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-5 h-5 rounded-full ${colorStyles.stepBadge} text-[10px] font-bold flex items-center justify-center font-mono`}
                  >
                    0{idx + 1}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                    {isFirst ? 'Total Inflow' : isLast ? 'Final Yield' : 'Stage ' + (idx + 1)}
                  </span>
                </div>

                <div className="font-bold text-xs text-slate-800 tracking-tight">
                  {stage.name}
                </div>

                {/* Amount */}
                <div className={`text-xl font-extrabold font-mono mt-1 ${colorStyles.amountColor}`}>
                  {stage.amount}
                </div>

                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  {stage.count}
                </div>
              </div>

              {/* Conversion and Drop Metrics */}
              <div className="mt-4 pt-2.5 border-t border-slate-200/50 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Conversion:</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {stage.conversionRate}
                  </span>
                </div>
                {stage.dropRate && (
                  <div className="text-[10px] text-slate-500 truncate" title={stage.dropRate}>
                    {stage.dropRate}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Summary Bar */}
      <div className="mt-4 p-3.5 bg-slate-50/70 backdrop-blur-sm rounded-xl border border-slate-200/70 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
          <span className="text-slate-700 font-medium">
            <strong>₹3.82L recovered</strong> out of <strong>₹6.42L recoverable</strong> failed volume today
          </span>
        </div>
        <div className="text-slate-500 text-[11px]">
          Target Recovery: <span className="font-bold text-slate-800 font-mono">₹4.50L / Day</span>
        </div>
      </div>
    </div>
  );
};
