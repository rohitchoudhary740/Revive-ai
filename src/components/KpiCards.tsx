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
          badgeBg: 'bg-slate-100 text-slate-700',
          iconBg: 'bg-slate-100 text-slate-700',
          icon: <AlertCircle className="w-4 h-4" />,
          accentGlow: 'bg-slate-200/40',
        };

        if (kpi.type === 'risk') {
          cardTheme = {
            badgeBg: 'bg-amber-500/10 text-amber-700 border border-amber-500/20',
            iconBg: 'bg-amber-50 text-amber-600 border border-amber-200/60',
            icon: <AlertCircle className="w-4 h-4" />,
            accentGlow: 'bg-amber-400/20',
          };
        } else if (kpi.type === 'recoverable') {
          cardTheme = {
            badgeBg: 'bg-indigo-500/10 text-indigo-700 border border-indigo-500/20',
            iconBg: 'bg-indigo-50 text-indigo-600 border border-indigo-200/60',
            icon: <Target className="w-4 h-4" />,
            accentGlow: 'bg-indigo-400/20',
          };
        } else if (kpi.type === 'recovered') {
          cardTheme = {
            badgeBg: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
            iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
            icon: <CheckCircle2 className="w-4 h-4" />,
            accentGlow: 'bg-emerald-400/20',
          };
        } else if (kpi.type === 'rate') {
          cardTheme = {
            badgeBg: 'bg-blue-500/10 text-blue-700 border border-blue-500/20',
            iconBg: 'bg-blue-50 text-blue-600 border border-blue-200/60',
            icon: <TrendingUp className="w-4 h-4" />,
            accentGlow: 'bg-blue-400/20',
          };
        }

        return (
          <div
            key={idx}
            id={`kpi-card-${kpi.type}`}
            className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between"
          >
            {/* Ambient subtle glow orb on hover */}
            <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full ${cardTheme.accentGlow} blur-xl pointer-events-none`} />

            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {kpi.title}
                </span>
                <div className={`w-8 h-8 rounded-xl ${cardTheme.iconBg} flex items-center justify-center shadow-xs`}>
                  {cardTheme.icon}
                </div>
              </div>

              <div className="mt-2.5 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                  {kpi.value}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100/90 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium truncate">
                  {kpi.subtext}
                </span>
                {kpi.change && (
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 ${cardTheme.badgeBg}`}
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
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-0.5">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full"
                    style={{ width: `${Math.min(100, parseFloat(kpi.value) || 0)}%` }}
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
