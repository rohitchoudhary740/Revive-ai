import React from 'react';
import { Sparkles } from 'lucide-react';
import { FunnelStage } from '../types';

interface RecoveryFunnelProps {
  stages: FunnelStage[];
}

export const RecoveryFunnel: React.FC<RecoveryFunnelProps> = ({ stages }) => {
  return (
    <div
      id="revenue-recovery-funnel"
      className="bg-[var(--bg-surface)] rounded-2xl p-6 border border-[var(--border-app)] shadow-xs transition-colors"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-[var(--border-app)]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Recovery Pipeline Conversion Funnel
            </h2>
            <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full fintech-badge-ai">
              Live Pipeline
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Stage-by-stage diagnosis and conversion from failed payment to settled revenue
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-surface-elevated)] px-3.5 py-1.5 rounded-xl border border-[var(--border-app)] shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-blue-500" />
          <span>AI Conversion Velocity: <strong className="text-[var(--text-primary)]">4.2 mins</strong></span>
        </div>
      </div>

      {/* Funnel Pipeline Horizontal Visualization */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {stages.map((stage, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === stages.length - 1;

          let colorStyles = {
            bg: 'bg-[var(--bg-surface-elevated)]',
            border: 'border-[var(--border-app)]',
            amountColor: 'text-[var(--text-primary)]',
            stepBadge: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-app)]',
          };

          if (stage.status === 'start') {
            colorStyles = {
              bg: 'bg-amber-500/5 dark:bg-amber-500/10',
              border: 'border-amber-500/20 dark:border-amber-500/30',
              amountColor: 'text-amber-600 dark:text-amber-400',
              stepBadge: 'bg-amber-500 text-white',
            };
          } else if (stage.status === 'diagnosing') {
            colorStyles = {
              bg: 'bg-blue-500/5 dark:bg-blue-500/10',
              border: 'border-blue-500/20 dark:border-blue-500/30',
              amountColor: 'text-blue-600 dark:text-blue-400',
              stepBadge: 'bg-blue-600 text-white',
            };
          } else if (stage.status === 'opportunity') {
            colorStyles = {
              bg: 'bg-indigo-500/5 dark:bg-indigo-500/10',
              border: 'border-indigo-500/20 dark:border-indigo-500/30',
              amountColor: 'text-indigo-600 dark:text-indigo-400',
              stepBadge: 'bg-indigo-600 text-white',
            };
          } else if (stage.status === 'active') {
            colorStyles = {
              bg: 'bg-purple-500/5 dark:bg-purple-500/10',
              border: 'border-purple-500/20 dark:border-purple-500/30',
              amountColor: 'text-purple-600 dark:text-purple-400',
              stepBadge: 'bg-purple-600 text-white',
            };
          } else if (stage.status === 'success') {
            colorStyles = {
              bg: 'bg-emerald-500/5 dark:bg-emerald-500/10',
              border: 'border-emerald-500/20 dark:border-emerald-500/30',
              amountColor: 'text-emerald-600 dark:text-emerald-400',
              stepBadge: 'bg-emerald-600 text-white',
            };
          }

          return (
            <div
              key={stage.id}
              id={`funnel-stage-${stage.id}`}
              className={`rounded-xl p-4 border ${colorStyles.border} ${colorStyles.bg} transition-all relative flex flex-col justify-between shadow-xs hover:border-[var(--border-strong)]`}
            >
              {/* Top Step Counter & Name */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`w-5 h-5 rounded-full ${colorStyles.stepBadge} text-[10px] font-bold flex items-center justify-center font-mono`}
                  >
                    0{idx + 1}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    {isFirst ? 'Total Inflow' : isLast ? 'Final Yield' : 'Stage ' + (idx + 1)}
                  </span>
                </div>

                <div className="font-bold text-xs text-[var(--text-primary)] tracking-tight">
                  {stage.name}
                </div>

                {/* Amount */}
                <div className={`text-xl font-extrabold font-mono mt-1 ${colorStyles.amountColor}`}>
                  {stage.amount}
                </div>

                <div className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  {stage.count}
                </div>
              </div>

              {/* Conversion and Drop Metrics */}
              <div className="mt-4 pt-2.5 border-t border-[var(--border-subtle)] flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-[var(--text-secondary)] font-medium">Conversion:</span>
                  <span className="font-bold text-[var(--text-primary)] font-mono">
                    {stage.conversionRate}
                  </span>
                </div>
                {stage.dropRate && (
                  <div className="text-[10px] text-[var(--text-muted)] truncate" title={stage.dropRate}>
                    {stage.dropRate}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Summary Bar */}
      <div className="mt-4 p-3.5 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border-app)] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs" />
          <span className="text-[var(--text-secondary)] font-medium">
            <strong className="text-[var(--text-primary)]">₹3.82L recovered</strong> out of <strong className="text-[var(--text-primary)]">₹6.42L recoverable</strong> failed volume today
          </span>
        </div>
        <div className="text-[var(--text-muted)] text-[11px]">
          Target Recovery: <span className="font-bold text-[var(--text-primary)] font-mono">₹4.50L / Day</span>
        </div>
      </div>
    </div>
  );
};
