import { CampaignItem, CampaignSimulationResult } from '../types';

export const CAMPAIGNS_DATA: CampaignItem[] = [
  {
    id: 'camp-1',
    name: 'Bank Degradation Recovery',
    target: 'Payment Failures',
    transactions: 183,
    revenueAtRisk: 280000,
    recovered: 142000,
    recoveryRate: 50.7,
    status: 'Completed',
    failureType: 'Temporary Bank/PSP Glitches',
    strategy: 'Delayed Retry + Fallback Rails',
    createdAt: 'Yesterday, 10:00 AM',
  },
  {
    id: 'camp-2',
    name: 'Checkout Recovery',
    target: 'Checkout Abandonment',
    transactions: 312,
    revenueAtRisk: 210000,
    recovered: 118000,
    recoveryRate: 56.2,
    status: 'Running',
    failureType: 'OTP Delay & Cart Drop-offs',
    strategy: 'WhatsApp 1-Click Link',
    createdAt: 'Today, 08:30 AM',
  },
  {
    id: 'camp-3',
    name: 'Subscription Recovery',
    target: 'Subscription Failures',
    transactions: 94,
    revenueAtRisk: 180000,
    recovered: 38000,
    recoveryRate: 21.1,
    status: 'Running',
    failureType: 'Recurring Mandate Timing Lag',
    strategy: 'Regulatory Timing Window Retry',
    createdAt: 'Today, 06:00 AM',
  },
  {
    id: 'camp-4',
    name: 'Overdue Invoice Recovery',
    target: 'Overdue Receivables',
    transactions: 71,
    revenueAtRisk: 114000,
    recovered: 84000,
    recoveryRate: 73.7,
    status: 'Completed',
    failureType: 'Corporate Netbanking Latency',
    strategy: 'Multi-Rail Dynamic Payment Links',
    createdAt: '25 Aug 2026',
  },
  {
    id: 'camp-5',
    name: 'High-Value UPI Rescue Batch',
    target: 'Payment Failures',
    transactions: 240,
    revenueAtRisk: 240000,
    recovered: 148000,
    recoveryRate: 61.6,
    status: 'Running',
    failureType: 'UPI Server Congestion',
    strategy: 'Dynamic Intent + Deferred Collect',
    createdAt: 'Today, 11:15 AM',
  },
];

export const CAMPAIGN_SIMULATION_RESULT: CampaignSimulationResult = {
  transactionsAnalyzed: 1000,
  revenueAtRisk: 1024000, // ₹10.24L
  potentiallyRecoverable: 642000, // ₹6.42L
  recovered: 382000, // ₹3.82L
  recoveryRate: 59.5, // 59.5% of recoverable
  byStrategy: [
    { strategy: 'Delayed Retry', amount: 142000, share: 37.2 },
    { strategy: 'Payment Link', amount: 118000, share: 30.9 },
    { strategy: 'WhatsApp Recovery', amount: 82000, share: 21.5 },
    { strategy: 'Subscription Retry', amount: 38000, share: 9.9 },
    { strategy: 'Manual / Human Approval', amount: 2000, share: 0.5 },
  ],
  aiVsBaseline: [
    { method: 'No Intervention', amount: 0, lift: '0%' },
    { method: 'Blind Retry', amount: 190000, lift: '+90% baseline' },
    { method: 'Rule Based', amount: 280000, lift: '+47% vs Blind' },
    { method: 'ReviveAI', amount: 382000, lift: '+36.4% vs Rule-based' },
  ],
};
