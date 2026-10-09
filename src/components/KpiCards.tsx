import React from 'react';
import { AlertCircle, Target, CheckCircle2, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { KpiData } from '../types';

interface KpiCardsProps {
  kpis: KpiData[];
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="kpi-cards-grid">
      {kpis.map((kpi, idx) => {
        let cardTheme = {
          badgeClass: 'fintech-badge-neutral',
          iconBg: 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border border-[var(--border-app)]',
          icon: <AlertCircle className="w-4 h-4" />,
          accentGlow: 'bg-slate-500/10',
        };

        if (kpi.type === 'risk') {
          cardTheme = {
            badgeClass: 'fintech-badge-warn',
            iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
            icon: <AlertCircle className="w-4 h-4" />,
            accentGlow: 'bg-amber-500/10',
          };
        } else if (kpi.type === 'recoverable') {
          cardTheme = {
            badgeClass: 'fintech-badge-ai',
            iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
            icon: <Target className="w-4 h-4" />,
            accentGlow: 'bg-blue-500/10',
          };
        } else if (kpi.type === 'recovered') {
          cardTheme = {
            badgeClass: 'fintech-badge-success',
            iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
            icon: <CheckCircle2 className="w-4 h-4" />,
            accentGlow: 'bg-emerald-500/10',
          };
        } else if (kpi.type === 'rate') {
          cardTheme = {
            badgeClass: 'fintech-badge-ai',
            iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
            icon: <TrendingUp className="w-4 h-4" />,
            accentGlow: 'bg-blue-500/10',
          };
        }

        return (
          <div
            key={idx}
            id={`kpi-card-${kpi.type}`}
            className="bg-[var(--bg-surface)] p-5 rounded-2xl border border-[var(--border-app)] hover:border-[var(--border-strong)] shadow-xs hover:shadow-md transition-all duration-200 relative overflow-hidden flex flex-col justify-between group"
          >
            {/* Ambient subtle glow orb on hover */}
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${cardTheme.accentGlow} blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-300`} />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider font-mono">
                  {kpi.title}
                </span>
                <div className={`w-8 h-8 rounded-xl ${cardTheme.iconBg} flex items-center justify-center shadow-2xs`}>
                  {cardTheme.icon}
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-[var(--text-primary)] tracking-tight font-mono">
                  {kpi.value}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)] font-medium truncate text-[11px]">
                  {kpi.subtext}
                </span>
                {kpi.change && (
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${cardTheme.badgeClass}`}
                  >
                    {kpi.isPositive ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {kpi.change}
                  </span>
                )}
              </div>

              {/* Recovery Rate Mini Progress Indicator */}
              {kpi.type === 'rate' && kpi.value !== '…' && kpi.value !== 'N/A' && (
                <div className="w-full bg-[var(--bg-surface-elevated)] h-1.5 rounded-full overflow-hidden mt-0.5 border border-[var(--border-subtle)]">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, parseFloat(kpi.value) || 0))}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
