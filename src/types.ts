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

// ----------------------------------------------------
// BATCH EVALUATION TYPES (Track 03 Measured Recovery)
// ----------------------------------------------------
export interface EvaluationStrategyMetrics {
  totalRevenueAtRisk: number;
  expectedRecoverableRevenue: number;
  interventionsAttempted: number;
  successfulRecoveries: number;
  recoveredRevenue: number;
  recoveryRate: number;
  recoveryRatePercent: number;
  recoveryRatePerIntervention: number;
  recoveryRatePerInterventionPercent: number;
  unnecessaryInterventions: number;
  humanReviewCases: number;
  stoppedCases: number;
  averageRecoveryValue: number;
  policyBlockedValue: number;
}

export interface EvaluationLiftMetrics {
  recoveredRevenueLift: number;
  revenueLiftPercent: number;
  recoveryRateLiftPercentPoints: number;
  interventionEfficiencyLiftPercent: number;
  unnecessaryInterventionsReduced: number;
}

export interface EvaluationSyntheticCase {
  id: string;
  paymentId: string;
  amount: number;
  failureType: string;
  failureCode: string;
  paymentMethod: 'UPI' | 'CARD' | 'NETBANKING';
  retryCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  customerTier: 'B2C Customer' | 'B2B Merchant' | 'Enterprise Client';
  groundTruthProb: number;
  groundTruthRecoverable: boolean;
  isSynthetic: true;
  reviveAi: {
    rootCause: string;
    confidence: number;
    recoveryProbability: number;
    recommendedAction:
      | 'smart_retry'
      | 'whatsapp_payment_link'
      | 'delayed_retry'
      | 'payment_method_update'
      | 'stop'
      | 'human_review'
      | 'whatsapp_recovery'
      | 'payment_link'
      | 'human_approval';
    expectedRecovery: number;
    policyStatus: string;
    isApproved: boolean;
    requiresHumanApproval: boolean;
    isStopped: boolean;
    intervened: boolean;
    recovered: boolean;
    recoveredRevenue: number;
    unnecessaryIntervention: boolean;
  };
  baseline: {
    action: string;
    intervened: boolean;
    recovered: boolean;
    recoveredRevenue: number;
    unnecessaryIntervention: boolean;
  };
}

export interface BatchEvaluationRun {
  runId: string;
  createdAt: string;
  seed: number;
  batchSize: number;
  isSynthetic: true;
  disclaimer: string;
  guardrailsSnapshot: any;
  baseline: EvaluationStrategyMetrics;
  reviveAi: EvaluationStrategyMetrics;
  lift: EvaluationLiftMetrics;
  sampleCases: EvaluationSyntheticCase[];
}

// ─── Layer 2: Adaptive Closed-Loop Strategy & Journey Types ────────────────
export type RecoveryStrategyId =
  | 'smart_retry'
  | 'whatsapp_payment_link'
  | 'delayed_retry'
  | 'payment_method_update'
  | 'human_review'
  | 'stop';

export interface RecoveryStrategyDefinition {
  id: RecoveryStrategyId;
  name: string;
  description: string;
  applicableFailureTypes: string[];
  maxAttempts: number;
  cooldownSeconds: number;
  requiredPolicyPermission: 'AUTO_RETRY' | 'CUSTOMER_COMMUNICATION' | 'MANUAL_APPROVAL' | 'TERMINAL_HALT';
  verificationRequirement: 'webhook_payment_captured' | 'payment_link_paid' | 'operator_signoff' | 'none';
  isCustomerContact: boolean;
}

export interface RecoveryJourneyStep {
  id: string;
  case_id: string;
  attempt_number: number;
  strategy_id: RecoveryStrategyId;
  strategy_name: string;
  reasoning: string;
  policy_approved: number;
  policy_checks: string;
  policy_status_text: string;
  action_status: 'pending' | 'executed' | 'failed' | 'skipped';
  action_payload: string;
  outcome: 'success' | 'failure' | 'in_progress' | 'pending_verification';
  failure_reason?: string | null;
  next_action?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecoveryJourneyData {
  caseId: string;
  status: string;
  currentStage: string;
  totalAttempts: number;
  steps: RecoveryJourneyStep[];
  isTerminal: boolean;
  finalDecision: string;
}

// ─── Layer 3: Recovery Strategy Intelligence & Explainability Types ─────────
export interface GeminiStrategyIntelligence {
  diagnosis: string;
  confidence: number;
  recovery_probability: number;
  recommended_strategy: RecoveryStrategyId;
  reasoning: string;
  evidence: string[];
  alternative_strategy: RecoveryStrategyId | null;
  why_not_alternative: string;
  risk_flags: string[];
}

export interface ExplainabilityReport {
  caseId: string;
  amount: number;
  failureCode: string;
  aiRecommendation: {
    recommendedStrategy: {
      id: RecoveryStrategyId;
      name: string;
      description: string;
    };
    confidence: number;
    recoveryProbability: number;
    reasoning: string;
    evidence: string[];
    alternativeConsidered: {
      id: RecoveryStrategyId | null;
      name: string | null;
      whyRejected: string;
    };
    riskFlags: string[];
    isFallback: boolean;
  };
  deterministicPolicyDecision: {
    isApproved: boolean;
    requiresHumanApproval: boolean;
    isStopped: boolean;
    statusText: string;
    checks: {
      name: string;
      passed: boolean;
      detail: string;
    }[];
  };
  authorityStatement: string;
  createdAt: string;
}

// ─── Layer 4: Merchant Policy Impact Simulator Types ────────────────────────
export interface PolicyComparisonMetrics {
  autoRecoverCases: number;
  humanReviewCases: number;
  stoppedCases: number;
  interventions: number;
  expectedRecovery: number;
  recoveredRevenue: number;
  policyBlockedRevenue: number;
  recoveryRate: number; // percentage e.g. 74.2
  unnecessaryInterventions: number;
}

export interface PolicyImpactDeltas {
  autoRecoverCases: number;
  humanReviewCases: number;
  stoppedCases: number;
  interventions: number;
  expectedRecovery: number;
  recoveredRevenue: number;
  policyBlockedRevenue: number;
  recoveryRate: number;
  unnecessaryInterventions: number;
  highValueMovedToAuto: number;
}

export interface SafetyTradeOff {
  riskLevel: 'MINIMAL' | 'BALANCED' | 'ELEVATED';
  headline: string;
  tradeOffPoints: string[];
  recommendedSafeguard: string;
}

export interface PolicyTransitionCase {
  caseId: string;
  amount: number;
  failureCode: string;
  customerName: string;
  before: {
    status: 'Auto Recover' | 'Human Review' | 'Stopped';
    isApproved: boolean;
    policyStatus: string;
  };
  after: {
    status: 'Auto Recover' | 'Human Review' | 'Stopped';
    isApproved: boolean;
    policyStatus: string;
  };
  shiftType: 'review_to_auto' | 'stop_to_auto' | 'auto_to_review' | 'auto_to_stop' | 'unchanged';
}

export interface PolicyImpactSimulationResult {
  isSimulation: true;
  disclaimer: string;
  activeGuardrails: {
    maxAutoRecoveryAmount: number;
    minRecoveryProbability: number;
    maxAutomatedRetries: number;
    highValueRequiresApproval: boolean;
    lowConfidenceStops: boolean;
    agentMode: string;
  };
  simulatedGuardrails: {
    maxAutoRecoveryAmount: number;
    minRecoveryProbability: number;
    maxAutomatedRetries: number;
    highValueRequiresApproval: boolean;
    lowConfidenceStops: boolean;
    agentMode: string;
  };
  batchSize: number;
  seed: number;
  currentPolicy: PolicyComparisonMetrics;
  simulatedPolicy: PolicyComparisonMetrics;
  impactDeltas: PolicyImpactDeltas;
  safetyTradeOff: SafetyTradeOff;
  sampleTransitionCases: PolicyTransitionCase[];
  executionTimeMs?: number;
  totalEvaluatedCases?: number;
  createdAt: string;
}

// ─── Layer 5: Financial Safety and Failure Handling Types ───────────────────
export type ExecutionMode = 'DEMO' | 'SIMULATED' | 'TEST_MODE' | 'LIVE';

export interface SafetyBlockEvent {
  caseId: string;
  reason: string;
  rule:
    | 'IDEMPOTENCY'
    | 'TERMINAL_STATE'
    | 'AMOUNT_VERIFICATION'
    | 'POLICY_RECHECK'
    | 'STALE_DECISION'
    | 'VERIFICATION_TIMEOUT'
    | 'DUPLICATE_WEBHOOK'
    | 'EXTERNAL_FAILURE'
    | 'AI_FAILURE';
  mode: ExecutionMode;
  timestamp: string;
}




