import React, { useState } from 'react';
import {
  Megaphone,
  Plus,
  Play,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Layers,
  Search,
  ArrowRight,
  Sparkles,
  BarChart3,
  Clock,
  Zap,
  Filter,
} from 'lucide-react';
import { CAMPAIGNS_DATA } from '../../data/campaignsData';
import { CampaignItem, CampaignTarget, NewCampaignFormData, PageId } from '../../types';
import { NewCampaignModal } from './NewCampaignModal';
import { CampaignSimulationModal } from './CampaignSimulationModal';

interface CampaignsPageProps {
  onNavigate?: (page: PageId) => void;
}

export const CampaignsPage: React.FC<CampaignsPageProps> = ({ onNavigate }) => {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>(CAMPAIGNS_DATA);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTarget, setSelectedTarget] = useState<string>('All');
  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [isSimModalOpen, setIsSimModalOpen] = useState<boolean>(false);
  const [activeSimCampaignName, setActiveSimCampaignName] = useState<string>('Bank Degradation Recovery');

  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleCreateCampaign = (formData: NewCampaignFormData) => {
    const newCamp: CampaignItem = {
      id: `camp-${Date.now()}`,
      name: formData.name,
      target: formData.target,
      transactions: 250,
      revenueAtRisk: 175000,
      recovered: 0,
      recoveryRate: 0,
      status: 'Ready to Run',
      failureType: formData.failureType,
      strategy: formData.strategy,
      createdAt: 'Just now',
    };

    setCampaigns([newCamp, ...campaigns]);
    setIsNewModalOpen(false);
    setActiveSimCampaignName(newCamp.name);
    setIsSimModalOpen(true);
  };

  const handleOpenSimulation = (campaignName: string) => {
    setActiveSimCampaignName(campaignName);
    setIsSimModalOpen(true);
  };

  const filteredCampaigns = campaigns.filter((camp) => {
    const matchesTarget = selectedTarget === 'All' || camp.target === selectedTarget;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      camp.name.toLowerCase().includes(q) ||
      camp.target.toLowerCase().includes(q) ||
      (camp.strategy && camp.strategy.toLowerCase().includes(q));

    return matchesTarget && matchesSearch;
  });

  return (
    <div id="campaigns-page" className="space-y-7 pb-12">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider font-mono bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded">
              Batch Orchestration
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-slate-500 font-medium font-mono">
              Cohort Optimization
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Recovery Campaigns
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Run controlled recovery workflows across groups of revenue-at-risk transactions.
          </p>
        </div>

        {/* Primary "+ New Campaign" CTA */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenSimulation('Smart Batch Simulation')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-xs"
          >
            <Play className="w-3.5 h-3.5 text-indigo-600 fill-indigo-600/20" />
            <span>Simulation Lab</span>
          </button>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ New Campaign</span>
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" id="campaigns-kpi-grid">
        {/* KPI 1: Active Campaigns */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-indigo-200/90 shadow-[0_2px_12px_-2px_rgba(79,70,229,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-indigo-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                Active Campaigns
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shadow-xs">
                <Megaphone className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-900 tracking-tight font-mono">
                4
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-indigo-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Running cohorts</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-indigo-500/10 text-indigo-700 border border-indigo-500/20">
              Live
            </span>
          </div>
        </div>

        {/* KPI 2: Transactions Processed */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-blue-200/90 shadow-[0_2px_12px_-2px_rgba(59,130,246,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-blue-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                Transactions Processed
              </span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shadow-xs">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-blue-900 tracking-tight font-mono">
                1,284
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-blue-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Total volume evaluated</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-blue-500/10 text-blue-700 border border-blue-500/20">
              100% Routed
            </span>
          </div>
        </div>

        {/* KPI 3: Revenue at Risk */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-amber-200/90 shadow-[0_2px_12px_-2px_rgba(245,158,11,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-amber-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                Revenue at Risk
              </span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shadow-xs">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-900 tracking-tight font-mono">
                ₹10.24L
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-amber-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Total cohort exposure</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-amber-500/10 text-amber-800 border border-amber-500/20">
              Assessed
            </span>
          </div>
        </div>

        {/* KPI 4: Revenue Recovered */}
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl border border-emerald-200/90 shadow-[0_2px_12px_-2px_rgba(16,185,129,0.08)] hover:shadow-lg transition-all duration-200 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-emerald-200/30 blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                Revenue Recovered
              </span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shadow-xs">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight font-mono">
                ₹3.82L
              </span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-emerald-100/90 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Net captured balance</span>
            <span className="inline-flex items-center gap-0.5 font-bold text-[11px] px-2 py-0.5 rounded-full font-mono shrink-0 bg-emerald-500/15 text-emerald-800 border border-emerald-500/30">
              59.5% Yield
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Target filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {[
            'All',
            'Payment Failures',
            'Checkout Abandonment',
            'Subscription Failures',
            'Overdue Receivables',
          ].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTarget(t)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 font-mono ${
                selectedTarget === t
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/70'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200/80 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-xs"
          />
        </div>
      </div>

      {/* CAMPAIGN LIST TABLE */}
      <div
        id="section-campaigns-table"
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-150/80 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.04)] overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/70 text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono border-b border-slate-150">
              <tr>
                <th className="py-3.5 px-5">Campaign</th>
                <th className="py-3.5 px-4">Target Segment</th>
                <th className="py-3.5 px-4 text-center">Transactions</th>
                <th className="py-3.5 px-4 text-right">Revenue at Risk</th>
                <th className="py-3.5 px-4 text-right">Recovered</th>
                <th className="py-3.5 px-4 text-center">Recovery Rate</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCampaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors group">
                  {/* Campaign */}
                  <td className="py-3.5 px-5">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{camp.name}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {camp.strategy || camp.failureType || camp.createdAt}
                    </div>
                  </td>

                  {/* Target Segment */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px] border border-slate-200">
                      {camp.target}
                    </span>
                  </td>

                  {/* Transactions */}
                  <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                    {camp.transactions.toLocaleString()}
                  </td>

                  {/* Revenue at Risk */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    {formatINR(camp.revenueAtRisk)}
                  </td>

                  {/* Recovered */}
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-700">
                    {formatINR(camp.recovered)}
                  </td>

                  {/* Recovery Rate */}
                  <td className="py-3.5 px-4 text-center">
                    <span
                      className={`font-mono font-bold text-xs ${
                        camp.recoveryRate >= 50
                          ? 'text-emerald-700'
                          : camp.recoveryRate > 0
                          ? 'text-amber-700'
                          : 'text-slate-400'
                      }`}
                    >
                      {camp.recoveryRate > 0 ? `${camp.recoveryRate}%` : '—'}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 text-center">
                    {camp.status === 'Running' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono shadow-xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse" />
                        Running
                      </span>
                    ) : camp.status === 'Completed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono shadow-xs">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300 font-mono shadow-xs">
                        <Clock className="w-3 h-3 text-amber-600" />
                        {camp.status}
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td className="py-3.5 px-5 text-right">
                    <button
                      onClick={() => handleOpenSimulation(camp.name)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg transition-all border border-indigo-200/70"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Simulate</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODALS */}
      <NewCampaignModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onCreateSuccess={handleCreateCampaign}
      />

      <CampaignSimulationModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
        campaignName={activeSimCampaignName}
      />
    </div>
  );
};
