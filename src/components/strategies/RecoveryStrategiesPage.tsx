import React, { useState } from 'react';
import {
  GitFork,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Zap,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Eye,
  Sliders,
  Layers,
  Search,
  Check,
  Ban,
  Mail,
  MessageSquare,
  Shield,
  CreditCard,
  UserCheck,
} from 'lucide-react';
import { RECOVERY_STRATEGIES_DATA } from '../../data/strategiesData';
import { RecoveryStrategyItem, PageId } from '../../types';
import { StrategyDetailDrawer } from './StrategyDetailDrawer';

interface RecoveryStrategiesPageProps {
  onNavigate?: (page: PageId) => void;
}

export const RecoveryStrategiesPage: React.FC<RecoveryStrategiesPageProps> = ({
  onNavigate,
}) => {
  const [strategies, setStrategies] = useState<RecoveryStrategyItem[]>(
    RECOVERY_STRATEGIES_DATA
  );
  const [selectedStrategy, setSelectedStrategy] = useState<RecoveryStrategyItem | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleOpenDrawer = (strat: RecoveryStrategyItem) => {
    setSelectedStrategy(strat);
    setIsDrawerOpen(true);
  };

  const filteredStrategies = strategies.filter((strat) => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      strat.name.toLowerCase().includes(q) ||
      strat.bestFor.toLowerCase().includes(q) ||
      strat.bestTrigger.toLowerCase().includes(q)
    );
  });

  return (
    <div id="recovery-strategies-page" className="space-y-7 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider font-mono bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded">
              Dynamic Policy Matrix
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              AI Multi-Factor Orchestration
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Recovery Strategies
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Choose how ReviveAI should recover revenue while respecting merchant policies.
          </p>
        </div>

        {/* Action Header Nav */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate && onNavigate('active-recoveries')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <span>Live Recoveries</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* TOP 4 STRATEGY HIGHLIGHT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="strategies-kpi-grid">
        {/* Card 1: Best Strategy */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-indigo-200/90 shadow-[0_2px_12px_-2px_rgba(79,70,229,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-indigo-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                Best Strategy
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shadow-xs">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-extrabold text-indigo-900 tracking-tight">
                Delayed Retry
              </div>
              <p className="text-xs text-indigo-700/80 font-mono mt-0.5">
                81% Success Rate
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Auto-executes in 10m</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              Highest Conversion
            </span>
          </div>
        </div>

        {/* Card 2: Highest Recovery */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-emerald-200/90 shadow-[0_2px_12px_-2px_rgba(16,185,129,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Highest Recovery
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-xs">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-extrabold text-emerald-800 tracking-tight">
                Payment Link
              </div>
              <p className="text-xs text-emerald-700 font-mono mt-0.5">
                ₹1.18L Captured
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Multi-rail checkout</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
              Top Volume
            </span>
          </div>
        </div>

        {/* Card 3: Lowest Friction */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-blue-200/90 shadow-[0_2px_12px_-2px_rgba(59,130,246,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                Lowest Friction
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-xs">
                <Mail className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-extrabold text-blue-900 tracking-tight">
                Email
              </div>
              <p className="text-xs text-blue-700 font-mono mt-0.5">
                Zero intrusive pings
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Clean B2B invoice</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-blue-500/10 text-blue-700 border border-blue-500/20">
              Gentle
            </span>
          </div>
        </div>

        {/* Card 4: Safest */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-amber-200/90 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Safest Strategy
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5">
              <div className="text-xl font-extrabold text-amber-900 tracking-tight">
                Human Approval
              </div>
              <p className="text-xs text-amber-800 font-mono mt-0.5">
                &gt;₹25k Governance
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">92% Signoff Success</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-amber-500/10 text-amber-800 border border-amber-500/20">
              Zero Risk
            </span>
          </div>
        </div>
      </div>

      {/* CORE AI ARCHITECTURE CONCEPT SECTION */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-indigo-300 text-xs font-mono font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>ReviveAI Autonomous Decision Engine</span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight mt-1">
              One Strategy Does NOT Fit Everyone
            </h2>
            <p className="text-xs text-slate-300 max-w-2xl mt-1 leading-relaxed">
              ReviveAI dynamically evaluates 7 contextual signals before executing any action, maximizing recovered revenue while protecting customer trust and merchant safety policies.
            </p>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/15 backdrop-blur-md text-[11px] font-mono text-indigo-200 shrink-0">
            Dynamic Factor Matrix
          </div>
        </div>

        {/* 7-FACTOR FORMULA PILLS */}
        <div className="p-4 bg-white/5 rounded-xl border border-white/10">
          <div className="text-[10px] font-mono uppercase tracking-widest text-indigo-300 font-bold mb-2">
            The ReviveAI Multi-Factor Decision Formula:
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-lg">
              Failure Reason
            </span>
            <span className="text-slate-400">+</span>
            <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-lg">
              Customer History
            </span>
            <span className="text-slate-400">+</span>
            <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-lg">
              Transaction Amount
            </span>
            <span className="text-slate-400">+</span>
            <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-lg">
              Recovery Probability
            </span>
            <span className="text-slate-400">+</span>
            <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-lg">
              Expected Recovery Value
            </span>
            <span className="text-slate-400">+</span>
            <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 px-2.5 py-1 rounded-lg">
              Customer Friction
            </span>
            <span className="text-slate-400">+</span>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-2.5 py-1 rounded-lg font-bold">
              Merchant Policy
            </span>
          </div>
        </div>

        {/* 4 CONCRETE DECISION EXAMPLES */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="text-slate-400 text-[10px] font-mono uppercase">Case 1</div>
            <div className="font-bold text-white">₹50,000 Bank Timeout</div>
            <div className="flex items-center gap-1.5 text-amber-300 font-mono font-bold text-[11px] pt-1">
              <ArrowRight className="w-3 h-3 text-amber-400" />
              <span>Human Approval / Retry</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              High value triggers strict safety threshold.
            </p>
          </div>

          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="text-slate-400 text-[10px] font-mono uppercase">Case 2</div>
            <div className="font-bold text-white">₹5,000 Bank Failure</div>
            <div className="flex items-center gap-1.5 text-emerald-300 font-mono font-bold text-[11px] pt-1">
              <ArrowRight className="w-3 h-3 text-emerald-400" />
              <span>Delayed Retry (10m)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Transient glitch auto-resolves with 0 friction.
            </p>
          </div>

          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="text-slate-400 text-[10px] font-mono uppercase">Case 3</div>
            <div className="font-bold text-white">₹8,500 Abandoned Cart</div>
            <div className="flex items-center gap-1.5 text-indigo-300 font-mono font-bold text-[11px] pt-1">
              <ArrowRight className="w-3 h-3 text-indigo-400" />
              <span>1-Click Payment Link</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Multi-rail link captures high purchase intent.
            </p>
          </div>

          <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 space-y-1.5">
            <div className="text-slate-400 text-[10px] font-mono uppercase">Case 4</div>
            <div className="font-bold text-white">₹500 Repeated Failure</div>
            <div className="flex items-center gap-1.5 text-rose-300 font-mono font-bold text-[11px] pt-1">
              <Ban className="w-3 h-3 text-rose-400" />
              <span>STOP (Zero Retries)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Prevents spam & protects merchant score.
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH AND CONTROLS */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="text-xs text-slate-600 font-medium">
          Available Recovery Strategies: <strong>{filteredStrategies.length}</strong> configured
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search strategy..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* STRATEGY TABLE */}
      <div
        id="section-strategies-table"
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150">
              <tr>
                <th className="py-3.5 px-5">Strategy</th>
                <th className="py-3.5 px-4">Best For</th>
                <th className="py-3.5 px-4 text-center">Success Rate</th>
                <th className="py-3.5 px-4 text-right">Avg Recovery</th>
                <th className="py-3.5 px-4 text-center">Customer Friction</th>
                <th className="py-3.5 px-4 text-center">Risk</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStrategies.map((strat) => (
                <tr
                  key={strat.id}
                  className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                  onClick={() => handleOpenDrawer(strat)}
                >
                  {/* Strategy */}
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span>{strat.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {strat.suitableAmountRange}
                    </div>
                  </td>

                  {/* Best For */}
                  <td className="py-3.5 px-4 max-w-xs">
                    <span className="font-medium text-slate-700">{strat.bestFor}</span>
                  </td>

                  {/* Success Rate */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`font-mono font-bold text-xs ${
                        strat.successRate >= 70
                          ? 'text-emerald-700'
                          : strat.successRate > 0
                          ? 'text-amber-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {strat.successRate > 0 ? `${strat.successRate}%` : '0%'}
                    </span>
                  </td>

                  {/* Avg Recovery */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {strat.avgRecovery > 0 ? formatINR(strat.avgRecovery) : '—'}
                  </td>

                  {/* Customer Friction */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                        strat.customerFriction === 'Low' || strat.customerFriction === 'None'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : strat.customerFriction === 'Medium'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {strat.customerFriction}
                    </span>
                  </td>

                  {/* Risk */}
                  <td className="py-3.5 px-4 text-center font-mono font-medium text-slate-600 text-xs">
                    {strat.risk}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono shadow-xs">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Active
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDrawer(strat);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL DRAWER */}
      <StrategyDetailDrawer
        strategy={selectedStrategy}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </div>
  );
};
