import React from 'react';
import { Sparkles, ArrowRight, TrendingDown } from 'lucide-react';
import { PageId } from '../types';

interface AiInsightCardProps {
  onReviewOpportunities: (targetPage?: PageId) => void;
}

export const AiInsightCard: React.FC<AiInsightCardProps> = ({ onReviewOpportunities }) => {
  return (
    <div
      id="ai-insight-card"
      className="bg-gradient-to-br from-blue-900 via-indigo-950 to-slate-950 p-6 rounded-2xl text-white shadow-lg border border-blue-500/25 relative overflow-hidden transition-all"
    >
      {/* Background Subtle Pattern & Glass Glow */}
      <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-52 h-52 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* Left Indicator and Content */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 backdrop-blur-md border border-blue-400/30 text-blue-300 flex items-center justify-center shadow-xs shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-blue-300" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-400/30 font-mono">
                Live AI Sentinel Alert
              </span>
              <span className="text-xs text-slate-400 font-medium">
                • Triggered 4m ago
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Bank degradation detected</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 rounded-full font-mono">
                <TrendingDown className="w-3 h-3" />
                -27%
              </span>
            </h3>

            <p className="text-xs text-slate-300 font-normal leading-relaxed max-w-2xl">
              Bank success rate dropped <strong className="text-white font-semibold">27%</strong> in the last 20 minutes across HDFC & SBI UPI gateways. Automated dynamic routing is currently diverting high-value transactions.
            </p>
          </div>
        </div>

        {/* Right Metric & Action Button */}
        <div className="flex items-center gap-5 self-end lg:self-center shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto justify-between lg:justify-end">
          <div className="bg-white/5 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/10">
            <div className="text-[10px] font-bold text-blue-300 uppercase tracking-wider font-mono">
              Exposure Value
            </div>
            <div className="text-lg font-extrabold text-white font-mono mt-0.5">
              ₹72,400 <span className="text-xs font-normal text-slate-400 font-sans">at risk</span>
            </div>
          </div>

          <button
            id="review-opportunities-btn"
            onClick={() => onReviewOpportunities('recovery-opportunities')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-slate-900 hover:bg-slate-100 rounded-xl text-xs font-bold shadow-md transition-all active:scale-[0.98] group shrink-0 cursor-pointer"
          >
            <span>Review opportunities</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
