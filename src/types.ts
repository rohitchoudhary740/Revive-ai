export type PageId =
  | 'recovery-control'
  | 'overview'
  | 'merchant-overview'
  | 'revenue-at-risk'
  | 'recovery-opportunities'
  | 'customers'
  | 'active-recoveries'
  | 'campaigns'
  | 'recovery-strategies'
  | 'approvals'
  | 'audit-trail'
  | 'ask-revive-ai'
  | 'settings';

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export interface NavItem {
  id: PageId;
  label: string;
  badge?: string;
  badgeType?: 'purple' | 'green' | 'amber' | 'neutral';
}

export interface KpiData {
  title: string;
  value: string;
  subtext: string;
  change?: string;
  isPositive?: boolean;
  type: 'risk' | 'recoverable' | 'recovered' | 'rate';
}

export interface FunnelStage {
  id: string;
  name: string;
  amount: string;
  count: string;
  conversionRate?: string;
  dropRate?: string;
  status: 'start' | 'diagnosing' | 'opportunity' | 'active' | 'success';
}

export interface RecoveryTrendPoint {
  time: string;
  atRisk: number;
  recovered: number;
  recoveredRate: number;
}

export interface RecoveryActivity {
  id: string;
  paymentId: string;
  customerName: string;
  customerEmail: string;
  avatar: string;
  gateway: string;
  failureReason: string;
  recoveryAction: string;
  amount: string;
  status: 'recovered' | 'failed' | 'in_progress';
  timestamp: string;
  aiConfidence: number;
}

export type OpportunityStatus =
  | 'recoverable'
  | 'approval_required'
  | 'low_probability'
  | 'stopped'
  | 'in_progress';

export type OpportunityCategory =
  | 'payment_failure'
  | 'checkout_abandonment'
  | 'subscription_failure';

export interface RecoveryOpportunity {
  id: string;
  customerName: string;
  customerEmail: string;
  customerType: 'B2C Customer' | 'B2B Merchant' | 'Enterprise Client' | 'D2C Shopper';
  avatar: string;
  paymentId: string;
  amount: number; // numeric in INR
  problem: string;
  category: OpportunityCategory;
  recoveryProbability: number; // 0 to 100
  expectedRecovery: number; // calculated INR
  recommendation: {
    type: 'delayed_retry' | 'payment_link' | 'subscription_retry' | 'stop' | 'reminder_later';
    actionText: string;
    iconType: 'lightning' | 'stop' | 'link' | 'clock';
    detailedAction: string;
    reason: string;
  };
  status: OpportunityStatus;
  analysis: {
    rootCause: string;
    aiConfidence: number;
    evidence: string[];
    safetyChecks: {
      label: string;
      passed: boolean;
    }[];
  };
}

export type OpportunityFilterOption =
  | 'all'
  | 'high_value'
  | 'high_probability'
  | 'payment_failure'
  | 'checkout_abandonment'
  | 'subscription_failure';

export type OpportunitySortOption =
  | 'expected_recovery'
  | 'amount'
  | 'recovery_probability';

export type CustomerFilterOption =
  | 'all'
  | 'high_risk'
  | 'recoverable'
  | 'recovered'
  | 'stopped';

export interface CustomerTimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  type: 'initiated' | 'failed' | 'diagnosed' | 'sent' | 'clicked' | 'successful' | 'recovered';
  amount?: number;
}

export interface CustomerRecoveryHistoryItem {
  id: string;
  attemptNumber: number;
  action: string;
  result: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  recoveredAmount: number;
  date: string;
  channel: string;
}

export interface CustomerProfile {
  id: string;
  name: string;
  customerId: string;
  email: string;
  avatar: string;
  totalRevenue: number;
  revenueAtRisk: number;
  recoverable: number;
  recoveredRevenue: number;
  recoveryRate: number; // e.g. 70
  recoveryProbability: number; // e.g. 87
  expectedRecovery: number; // e.g. 21750
  previousAttempts: number;
  lastEvent: string;
  status: 'Recoverable' | 'Approval Required' | 'Low Probability' | 'Stopped' | 'Recovered';
  riskCategory: 'High' | 'Medium' | 'Low';
  timeline: CustomerTimelineItem[];
  recoveryHistory: CustomerRecoveryHistoryItem[];
  aiInsight: {
    headline: string;
    reasons: string[];
    recommendedAction: string;
  };
  recoveryMemory: {
    preferredIntervention: string;
    historicalSuccessRate: number;
    averageSuccessfulRecovery: number;
    bestContactChannel: string;
  };
  safetyStatus: {
    contactLimitOk: boolean;
    retryLimitOk: boolean;
    noDuplicateRecovery: boolean;
    amountWithinPolicy: boolean;
  };
}

// ----------------------------------------------------
// ACTIVE RECOVERIES TYPES
// ----------------------------------------------------
export type ActiveRecoveryStatus = 'In Progress' | 'Awaiting Approval' | 'Completed' | 'Stopped';
export type ActiveRecoveryTab = 'all' | 'in_progress' | 'awaiting_approval' | 'completed' | 'stopped';

export interface WorkflowProgressStep {
  name: string;
  status: 'done' | 'active' | 'pending' | 'failed' | 'halted';
}

export interface ActiveRecoveryItem {
  id: string;
  recoveryId: string; // e.g. '#REC-92831'
  customerName: string;
  customerEmail: string;
  avatar: string;
  amount: number;
  problem: string;
  aiAction: string;
  recoveryProbability: number;
  expectedRecovery: number;
  status: ActiveRecoveryStatus;
  currentStage: string;
  progressSteps: WorkflowProgressStep[];
  timeline: {
    title: string;
    description?: string;
    timestamp: string;
    status: 'done' | 'active' | 'pending' | 'failed';
  }[];
  aiRecommendation: string;
  safetyChecks: {
    label: string;
    passed: boolean;
  }[];
  isPaused?: boolean;
  /** Null until case has cleared the policy stage. Comes from policy_decisions.status_text. */
  guardrailDecision?: string | null;
  /** Razorpay payment recovery link URL, null if not yet dispatched. */
  paymentUrl?: string | null;
}

// ----------------------------------------------------
// CAMPAIGNS TYPES
// ----------------------------------------------------
export type CampaignTarget =
  | 'Payment Failures'
  | 'Checkout Abandonment'
  | 'Subscription Failures'
  | 'Overdue Receivables';

export type CampaignStatus = 'Running' | 'Completed' | 'Draft' | 'Ready to Run';

export interface CampaignItem {
  id: string;
  name: string;
  target: CampaignTarget;
  transactions: number;
  revenueAtRisk: number;
  recovered: number;
  recoveryRate: number;
  status: CampaignStatus;
  failureType?: string;
  strategy?: string;
  createdAt: string;
}

export interface NewCampaignFormData {
  name: string;
  target: CampaignTarget;
  failureType: 'All' | 'Temporary' | 'High Probability' | 'Custom';
  amountRangeMin: number;
  amountRangeMax: number;
  strategy: 'AI Optimized' | 'Delayed Retry' | 'Payment Link' | 'WhatsApp' | 'Email';
  maxAttempts: number;
  humanApprovalThreshold: number;
  communicationLimit: number;
}

export interface CampaignSimulationResult {
  transactionsAnalyzed: number;
  revenueAtRisk: number;
  potentiallyRecoverable: number;
  recovered: number;
  recoveryRate: number;
  byStrategy: {
    strategy: string;
    amount: number;
    share: number;
  }[];
  aiVsBaseline: {
    method: string;
    amount: number;
    lift?: string;
  }[];
}

// ----------------------------------------------------
// RECOVERY STRATEGIES TYPES
// ----------------------------------------------------
export type StrategyRisk = 'Very Low' | 'Low' | 'Medium' | 'High';
export type CustomerFriction = 'None' | 'Low' | 'Medium' | 'High';

export interface RecoveryStrategyItem {
  id: string;
  name: string;
  bestFor: string;
  successRate: number;
  avgRecovery: number;
  customerFriction: CustomerFriction;
  risk: StrategyRisk;
  status: 'Active' | 'Inactive' | 'Paused';
  recommendedDelay?: string;
  maxAttempts: number;
  aiExplanation: string;
  policy: {
    label: string;
    passed: boolean;
  }[];
  suitableAmountRange: string;
  bestTrigger: string;
}

