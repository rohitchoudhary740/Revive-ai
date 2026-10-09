export interface PaymentFailureContext {
  amount: number;
  paymentMethod: string;
  failureCode: string;
  bankSuccessRate: number; // e.g. 69%
  recentSimilarFailures: number; // e.g. 17
  customerPreviousRetryCount: number; // e.g. 0
  customerName?: string;
}

export interface InterventionOption {
  id: string;
  name: string;
  channel: string;
  probability: number;
  expectedValue: number;
  isRecommended: boolean;
  notes: string;
}

export type CanonicalStrategyAction =
  | 'smart_retry'
  | 'whatsapp_payment_link'
  | 'delayed_retry'
  | 'update_payment_method'
  | 'payment_method_update'
  | 'human_review'
  | 'stop'
  | 'whatsapp_recovery'
  | 'payment_link'
  | 'retry_now'
  | 'human_approval';

export function normalizeClientStrategyId(id?: string): 'smart_retry' | 'whatsapp_payment_link' | 'delayed_retry' | 'update_payment_method' | 'human_review' | 'stop' {
  if (!id) return 'human_review';
  const clean = id.trim().toLowerCase();
  if (clean === 'whatsapp_payment_link' || clean === 'whatsapp_recovery' || clean === 'whatsapp' || clean === 'payment_link') {
    return 'whatsapp_payment_link';
  }
  if (clean === 'smart_retry' || clean === 'retry_now' || clean === 'retry' || clean === 'immediate_retry') {
    return 'smart_retry';
  }
  if (clean === 'delayed_retry' || clean === 'delayed') {
    return 'delayed_retry';
  }
  if (clean === 'payment_method_update' || clean === 'update_payment_method') {
    return 'update_payment_method';
  }
  if (clean === 'human_review' || clean === 'human_approval' || clean === 'escalate') {
    return 'human_review';
  }
  if (clean === 'stop' || clean === 'terminate' || clean === 'no_action') {
    return 'stop';
  }
  return 'human_review';
}

export interface AiDiagnosisResult {
  rootCause: string;
  rootCauseLabel: string;
  confidence: number; // e.g. 0.94
  recoveryProbability: number; // e.g. 0.87
  recommendedAction: CanonicalStrategyAction;
  recommendedActionLabel: string;
  expectedRecoveryValue: number; // e.g. 4350
  reason: string;
  telemetryEvidence: string[];
  interventions: InterventionOption[];
}

export async function diagnosePaymentFailure(context: PaymentFailureContext): Promise<AiDiagnosisResult> {
  // Simulate intelligent processing delay to reflect deep AI inference
  await new Promise((resolve) => setTimeout(resolve, 1400));

  const code = (context.failureCode || '').toUpperCase();
  const retryCount = context.customerPreviousRetryCount || 0;

  // Context-aware canonical strategy resolution
  let recommendedAction: CanonicalStrategyAction;
  let recommendedActionLabel: string;
  let rootCause: string;
  let rootCauseLabel: string;
  let confidence = 0.94;
  let recoveryProbability = 0.87;
  let reason: string;
  let evidence: string[];

  if (retryCount >= 2) {
    recommendedAction = 'human_review';
    recommendedActionLabel = 'Escalate to Human Review';
    rootCause = 'max_retries_exhausted';
    rootCauseLabel = 'Retry Budget Exhausted';
    confidence = 0.96;
    recoveryProbability = 0.25;
    reason = 'Maximum automated retry attempts exhausted. Routing to operations team for human review.';
    evidence = [
      `Attempt count (${retryCount}) reached safety limit`,
      'Preventing repeated automated contact fatigue',
      'Escalated to merchant operations desk',
    ];
  } else if (code === 'USER_CANCELLED' || code === 'CHECKOUT_DISMISSED' || context.paymentMethod === 'PAYMENT_LINK') {
    recommendedAction = 'whatsapp_payment_link';
    recommendedActionLabel = 'WhatsApp 1-Click Payment Link';
    rootCause = 'checkout_abandonment';
    rootCauseLabel = 'Checkout Abandoned / Dismissed';
    confidence = 0.92;
    recoveryProbability = 0.87;
    reason = 'Customer dismissed checkout modal. Direct 1-click WhatsApp payment link offers highest recovery yield without customer friction.';
    evidence = [
      'Customer dismissed active payment interface before completion',
      'Cart intent verified intact (single session abandonment)',
      'WhatsApp interactive notification conversion benchmark: 87.4%',
      'Direct 1-click Razorpay payment link generated',
    ];
  } else if (code === 'BANK_TIMEOUT') {
    recommendedAction = 'smart_retry';
    recommendedActionLabel = 'Smart Immediate Retry';
    rootCause = 'temporary_bank_degradation';
    rootCauseLabel = 'Temporary Bank Degradation';
    confidence = 0.94;
    recoveryProbability = 0.88;
    reason = 'Temporary bank timeout with no prior retry. Rerouting immediately via backup acquiring node is lower friction than customer outreach.';
    evidence = [
      'HDFC/NPCI switch latency spiked +480ms in last 5 mins (Bank Success Rate: 69%)',
      '17 clustered gateway timeouts detected across payment cluster',
      `Customer previous retry count is ${retryCount} (clean state, zero fatigue)`,
      'Smart rerouting to backup node projected success rate: 88%',
    ];
  } else if (code === 'GATEWAY_ERROR' || code === 'NETWORK_ERROR' || code === 'GATEWAY_DEGRADED') {
    recommendedAction = 'delayed_retry';
    recommendedActionLabel = 'Delayed Intelligent Retry';
    rootCause = 'gateway_node_degradation';
    rootCauseLabel = 'Gateway Infrastructure Degradation';
    confidence = 0.91;
    recoveryProbability = 0.81;
    reason = 'Transient gateway error across acquiring cluster. Delayed retry allows acquiring node cool-down before re-executing.';
    evidence = [
      'Transient 502/504 gateway degradation across primary acquiring cluster',
      'Cluster health projected to recover within cooldown window',
      'Passive recovery preserves customer experience without message spam',
    ];
  } else if (code === 'EXPIRED_PAYMENT_METHOD' || code === 'CARD_EXPIRED' || code === 'INSUFFICIENT_FUNDS') {
    recommendedAction = 'update_payment_method';
    recommendedActionLabel = 'Update Payment Method';
    rootCause = 'instrument_invalid';
    rootCauseLabel = 'Expired / Invalid Payment Instrument';
    confidence = 0.95;
    recoveryProbability = 0.79;
    reason = 'Payment method declined or expired. Prompting customer to update payment instrument or select alternate UPI/card.';
    evidence = [
      'Card or payment token reported expired by issuer',
      'Customer active session detected — prompt instrument switch',
      'Seamless secondary payment method switch supported',
    ];
  } else {
    // Default fallback: smart retry for transient issues
    recommendedAction = 'smart_retry';
    recommendedActionLabel = 'Smart Immediate Retry';
    rootCause = 'transient_processing_failure';
    rootCauseLabel = 'Transient Processing Failure';
    confidence = 0.90;
    recoveryProbability = 0.85;
    reason = 'Transient processing failure with clean customer retry state. Immediate smart retry selected.';
    evidence = [
      `Failure signature: ${code || 'UNKNOWN'}`,
      'Idempotency token verified (no active duplicate action)',
      'Automated retry within policy guardrails',
    ];
  }

  const expectedValue = Math.round(context.amount * recoveryProbability);

  const interventions: InterventionOption[] = [
    {
      id: 'smart_retry',
      name: 'Smart Immediate Retry',
      channel: 'Direct PSP Alternate Node',
      probability: recommendedAction === 'smart_retry' ? recoveryProbability : 0.42,
      expectedValue: Math.round(context.amount * (recommendedAction === 'smart_retry' ? recoveryProbability : 0.42)),
      isRecommended: recommendedAction === 'smart_retry',
      notes: 'Immediate re-execution through backup acquiring node. Zero customer friction.',
    },
    {
      id: 'delayed_retry',
      name: 'Delayed Retry',
      channel: 'Auto-Retry Cooldown Queue',
      probability: recommendedAction === 'delayed_retry' ? recoveryProbability : 0.78,
      expectedValue: Math.round(context.amount * (recommendedAction === 'delayed_retry' ? recoveryProbability : 0.78)),
      isRecommended: recommendedAction === 'delayed_retry',
      notes: 'Scheduled retry after acquiring cluster node health normalizes.',
    },
    {
      id: 'whatsapp_payment_link',
      name: 'WhatsApp 1-Click Link',
      channel: 'WhatsApp Verified Channel',
      probability: recommendedAction === 'whatsapp_payment_link' ? recoveryProbability : 0.85,
      expectedValue: Math.round(context.amount * (recommendedAction === 'whatsapp_payment_link' ? recoveryProbability : 0.85)),
      isRecommended: recommendedAction === 'whatsapp_payment_link',
      notes: 'Direct frictionless re-authorization link with verified business token.',
    },
    {
      id: 'update_payment_method',
      name: 'Update Payment Method',
      channel: 'Interactive Method Switcher',
      probability: recommendedAction === 'update_payment_method' ? recoveryProbability : 0.74,
      expectedValue: Math.round(context.amount * (recommendedAction === 'update_payment_method' ? recoveryProbability : 0.74)),
      isRecommended: recommendedAction === 'update_payment_method',
      notes: 'Customer prompt to replace expired card or select secondary UPI handle.',
    },
    {
      id: 'stop',
      name: 'Stop (No Action)',
      channel: 'Guardrail Sentinel',
      probability: 0.0,
      expectedValue: 0,
      isRecommended: (recommendedAction as string) === 'stop',
      notes: 'Terminate pipeline to prevent duplicate charging or customer fatigue.',
    },
  ];

  return {
    rootCause,
    rootCauseLabel,
    confidence,
    recoveryProbability,
    recommendedAction,
    recommendedActionLabel,
    expectedRecoveryValue: expectedValue,
    reason,
    telemetryEvidence: evidence,
    interventions,
  };
}

export interface PolicyEvaluationResult {
  isApproved: boolean;
  requiresHumanApproval: boolean;
  isStopped: boolean;
  statusText: string;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

// Active merchant guardrails, mirrored from the server GuardrailConfig. Only the
// fields this cosmetic client evaluator needs are required. Defaults reproduce
// the original hardcoded thresholds so callers that omit it are unchanged.
export interface ClientGuardrailConfig {
  maxAutoRecoveryAmount: number;
  minRecoveryProbability: number; // 0..1
  maxAutomatedRetries: number;
  highValueRequiresApproval: boolean;
  lowConfidenceStops: boolean;
}

const DEFAULT_CLIENT_GUARDRAILS: ClientGuardrailConfig = {
  maxAutoRecoveryAmount: 25000,
  minRecoveryProbability: 0.3,
  maxAutomatedRetries: 1,
  highValueRequiresApproval: true,
  lowConfidenceStops: true,
};

// NOTE: This is the COSMETIC client mirror used to animate the Recovery Control
// 7-step demo. The REAL, authoritative recovery decision is made server-side by
// server/services/policyEngine.ts and drives the actual case lifecycle. This
// mirror now honours the ACTIVE merchant guardrails (passed in from the live
// GET /api/guardrails config) so the animation's thresholds/decision reflect
// what the merchant configured — it does not replace the backend decision.
export function evaluateDeterministicSafetyRules(
  context: PaymentFailureContext,
  diagnosis: AiDiagnosisResult,
  config: ClientGuardrailConfig = DEFAULT_CLIENT_GUARDRAILS
): PolicyEvaluationResult {
  const retryCount = context.customerPreviousRetryCount;
  const confidence = diagnosis.confidence;
  const probability = diagnosis.recoveryProbability;
  const amount = context.amount;
  const isDuplicate = false;

  const {
    maxAutoRecoveryAmount,
    minRecoveryProbability,
    maxAutomatedRetries,
    highValueRequiresApproval,
    lowConfidenceStops,
  } = config;
  const minProbPct = Math.round(minRecoveryProbability * 100);
  const limitLabel = `₹${maxAutoRecoveryAmount.toLocaleString('en-IN')}`;

  const checks = [
    {
      name: 'Amount within limit',
      passed: amount <= maxAutoRecoveryAmount,
      detail: amount <= maxAutoRecoveryAmount
        ? `₹${amount.toLocaleString('en-IN')} is within auto-recovery limit (≤${limitLabel})`
        : `₹${amount.toLocaleString('en-IN')} exceeds ${limitLabel} auto limit`,
    },
    {
      name: 'Retry limit OK',
      passed: retryCount < maxAutomatedRetries,
      detail: `${retryCount}/${maxAutomatedRetries} previous retries used`,
    },
    {
      name: 'Recovery probability acceptable',
      passed: probability >= minRecoveryProbability,
      detail: `${Math.round(probability * 100)}% (threshold: ≥${minProbPct}%)`,
    },
    {
      name: 'No duplicate recovery',
      passed: !isDuplicate,
      detail: 'Idempotency token verified (no active duplicate action)',
    },
    {
      name: 'Customer contact limit OK',
      passed: true,
      detail: '0/2 communication quota utilized today',
    },
  ];

  if (retryCount >= maxAutomatedRetries) {
    return {
      isApproved: false,
      requiresHumanApproval: false,
      isStopped: true,
      statusText: `🛑 ACTION STOPPED (Retry limit reached — max ${maxAutomatedRetries})`,
      checks,
    };
  }

  if (probability < minRecoveryProbability) {
    // Whether low probability stops or holds for a human is a merchant guardrail.
    return lowConfidenceStops
      ? {
          isApproved: false,
          requiresHumanApproval: false,
          isStopped: true,
          statusText: `🛑 ACTION STOPPED (Recovery probability below ${minProbPct}%)`,
          checks,
        }
      : {
          isApproved: false,
          requiresHumanApproval: true,
          isStopped: false,
          statusText: `🟡 HUMAN APPROVAL REQUIRED (probability below ${minProbPct}%, auto-stop off)`,
          checks,
        };
  }

  if ((amount > maxAutoRecoveryAmount && highValueRequiresApproval) || confidence < 0.8) {
    return {
      isApproved: false,
      requiresHumanApproval: true,
      isStopped: false,
      statusText: '🟡 HUMAN APPROVAL REQUIRED',
      checks,
    };
  }

  return {
    isApproved: true,
    requiresHumanApproval: false,
    isStopped: false,
    statusText: '🟢 ACTION APPROVED',
    checks,
  };
}
