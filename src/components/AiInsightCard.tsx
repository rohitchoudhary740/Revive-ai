import React from 'react';
import { AlertOctagon, Sparkles, ArrowRight, ShieldAlert, TrendingDown } from 'lucide-react';
import { PageId } from '../types';

interface AiInsightCardProps {
  onReviewOpportunities: (targetPage?: PageId) => void;
}

export const AiInsightCard: React.FC<AiInsightCardProps> = ({ onReviewOpportunities }) => {
  return (
    <div
      id="ai-insight-card"
      className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-indigo-900 p-6 rounded-2xl text-white shadow-xl shadow-indigo-950/15 border border-indigo-400/30 relative overflow-hidden backdrop-blur-md"
    >
      {/* Background Subtle Pattern & Glass Glow */}
      <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-52 h-52 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-40 h-40 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
        {/* Left Indicator and Content */}
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-md shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-indigo-200" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-white/20 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full border border-white/30 font-mono">
                Live AI Sentinel Alert
              </span>
              <span className="text-xs text-indigo-200 font-medium">
                • Triggered 4m ago
              </span>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Bank degradation detected</span>
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 px-2 py-0.5 rounded-full font-mono">
                <TrendingDown className="w-3 h-3" />
                -27%
              </span>
            </h3>

            <p className="text-xs text-indigo-100 font-normal leading-relaxed max-w-2xl">
              Bank success rate dropped <strong className="text-white font-semibold">27%</strong> in the last 20 minutes across HDFC & SBI UPI gateways. Automated dynamic routing is currently diverting high-value transactions.
            </p>
          </div>
        </div>

        {/* Right Metric & Action Button */}
        <div className="flex items-center gap-5 self-end lg:self-center shrink-0 border-t lg:border-t-0 lg:border-l border-indigo-400/30 pt-4 lg:pt-0 lg:pl-6 w-full lg:w-auto justify-between lg:justify-end">
          <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/15">
            <div className="text-[10px] font-bold text-indigo-200 uppercase tracking-wider font-mono">
              Exposure Value
            </div>
            <div className="text-lg font-extrabold text-white font-mono mt-0.5">
              ₹72,400 <span className="text-xs font-normal text-indigo-200 font-sans">at risk</span>
            </div>
          </div>

          <button
            id="review-opportunities-btn"
            onClick={() => onReviewOpportunities('recovery-opportunities')}
            className="inline-flex items-center gap-2 px-5 py-3 bg-white text-indigo-900 hover:bg-indigo-50 rounded-xl text-xs font-bold shadow-lg shadow-indigo-950/20 hover:shadow-xl transition-all active:scale-[0.98] group shrink-0"
          >
            <span>Review opportunities</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};
