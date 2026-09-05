import React from 'react';
import { KpiCards } from './KpiCards';
import { AiInsightCard } from './AiInsightCard';
import { RecoveryFunnel } from './RecoveryFunnel';
import { RecoveryChart } from './RecoveryChart';
import { RecentActivityTable } from './RecentActivityTable';
import { FUNNEL_STAGES } from '../data/mockData';
import { PageId, KpiData } from '../types';
import { useRecovery } from '../context/RecoveryContext';
import { RefreshCw, AlertOctagon } from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (page: PageId) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const {
    revenueAtRisk,
    recoveredToday,
    recoverable,
    failedCount,
    metricsLoading,
    metricsError,
    refreshMetrics,
  } = useRecovery();

  // Recovery rate = recovered / (recovered + at-risk remaining). Show null if no data.
  const totalProcessed = recoveredToday + revenueAtRisk;
  const recoveryRate = totalProcessed > 0
    ? ((recoveredToday / totalProcessed) * 100).toFixed(1)
    : null;

  const formatLakh = (val: number) => {
    if (val >= 10000000) return `₹${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}K`;
    return `₹${val.toLocaleString('en-IN')}`;
  };

  const dynamicKpis: KpiData[] = [
    {
      title: 'Revenue at Risk',
      value: metricsLoading ? '…' : formatLakh(revenueAtRisk),
      subtext: metricsLoading ? 'Loading…' : `${failedCount} failed transaction${failedCount !== 1 ? 's' : ''} recorded`,
      change: revenueAtRisk > 0 ? 'Active leakage' : 'All clear',
      isPositive: revenueAtRisk === 0,
      type: 'risk',
    },
    {
      title: 'Recoverable (AI Est.)',
      value: metricsLoading ? '…' : formatLakh(recoverable),
      subtext: revenueAtRisk > 0 ? '~62% AI-weighted recovery potential' : 'No open cases',
      change: recoverable > 0 ? 'AI Actionable' : 'No estimate yet',
      isPositive: true,
      type: 'recoverable',
    },
    {
      title: 'Recovered',
      value: metricsLoading ? '…' : formatLakh(recoveredToday),
      subtext: 'Successful auto-interventions to date',
      change: recoveredToday > 0 ? 'Confirmed recovered' : 'None yet',
      isPositive: true,
      type: 'recovered',
    },
    {
      title: 'Recovery Rate',
      value: metricsLoading ? '…' : recoveryRate !== null ? `${recoveryRate}%` : 'N/A',
      subtext: recoveryRate !== null ? 'Recovered / (Recovered + At Risk)' : 'No closed cases yet',
      change: recoveryRate !== null ? `${recoveryRate}% of total processed` : 'Pending data',
      isPositive: parseFloat(recoveryRate ?? '0') > 50,
      type: 'rate',
    },
  ];

  if (metricsError) {
    return (
      <div className="space-y-6 pb-12">
        <div className="flex flex-col items-center justify-center min-h-[300px] gap-4 text-center">
          <AlertOctagon className="w-10 h-10 text-amber-400" />
          <div>
            <p className="text-sm font-semibold text-gray-800">Backend unavailable</p>
            <p className="text-xs text-gray-500 mt-1">{metricsError}</p>
            <p className="text-xs text-gray-400 mt-1">Make sure the Express server is running on port 4000.</p>
          </div>
          <button
            onClick={refreshMetrics}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" id="overview-content">
      {/* 4 KPI Cards — values from real backend */}
      <KpiCards kpis={dynamicKpis} />

      {/* AI Insight Card */}
      <AiInsightCard onReviewOpportunities={onNavigate} />

      {/* 1. Revenue Recovery Funnel — still uses static stages (no funnel data in DB yet) */}
      <RecoveryFunnel stages={FUNNEL_STAGES} />

      {/* 2. Revenue Recovery Chart */}
      <RecoveryChart />

      {/* 4. Recent Recovery Activity Table — connected to backend */}
      <RecentActivityTable />
    </div>
  );
};
