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

export interface AiDiagnosisResult {
  rootCause: string;
  rootCauseLabel: string;
  confidence: number; // e.g. 0.94
  recoveryProbability: number; // e.g. 0.87
  recommendedAction: 'whatsapp_recovery' | 'delayed_retry' | 'payment_link' | 'stop' | 'human_approval';
  recommendedActionLabel: string;
  expectedRecoveryValue: number; // e.g. 4350
  reason: string;
  telemetryEvidence: string[];
  interventions: InterventionOption[];
}

export async function diagnosePaymentFailure(context: PaymentFailureContext): Promise<AiDiagnosisResult> {
  // Simulate intelligent processing delay to reflect deep AI inference
  await new Promise((resolve) => setTimeout(resolve, 1400));

  const recoveryProbability = 0.87;
  const confidence = 0.94;
  const expectedValue = Math.round(context.amount * recoveryProbability); // 4350 for 5000

  const interventions: InterventionOption[] = [
    {
      id: 'retry_now',
      name: 'Retry Now',
      channel: 'Direct PSP Retry',
      probability: 0.42,
      expectedValue: Math.round(context.amount * 0.42),
      isRecommended: false,
      notes: 'High risk of duplicate timeout while HDFC issuer node is degraded.',
    },
    {
      id: 'delayed_retry',
      name: 'Delayed Retry',
      channel: 'Auto-Retry Queue',
      probability: 0.81,
      expectedValue: Math.round(context.amount * 0.81),
      isRecommended: false,
      notes: 'Good passive recovery, but customer may assume purchase was abandoned.',
    },
    {
      id: 'whatsapp_recovery',
      name: 'WhatsApp Recovery',
      channel: 'WhatsApp 1-Click Pay',
      probability: 0.87,
      expectedValue: expectedValue,
      isRecommended: true,
      notes: 'Direct frictionless re-authorization link after bank normalization with highest conversion.',
    },
    {
      id: 'payment_link',
      name: 'Payment Link (SMS)',
      channel: 'SMS Gateway',
      probability: 0.64,
      expectedValue: Math.round(context.amount * 0.64),
      isRecommended: false,
      notes: 'Moderate click-through rate compared to instant messaging.',
    },
    {
      id: 'email',
      name: 'Email Recovery',
      channel: 'Transactional Email',
      probability: 0.38,
      expectedValue: Math.round(context.amount * 0.38),
      isRecommended: false,
      notes: 'Low urgency for instantaneous checkout failure.',
    },
  ];

  return {
    rootCause: 'temporary_bank_degradation',
    rootCauseLabel: 'Temporary Bank Degradation',
    confidence: confidence,
    recoveryProbability: recoveryProbability,
    recommendedAction: 'whatsapp_recovery',
    recommendedActionLabel: 'WhatsApp Recovery',
    expectedRecoveryValue: expectedValue,
    reason:
      'Customer has high recovery probability (87%) and the bank issue appears temporary. A recovery notification allows the customer to complete the original payment after the issue is resolved.',
    telemetryEvidence: [
      'HDFC/NPCI switch latency spiked +480ms in last 5 mins (Bank Success Rate: 69%)',
      '17 clustered gateway timeouts detected across payment cluster',
      'Customer previous retry count is 0 (clean state, zero fatigue)',
      'WhatsApp interactive notification conversion benchmark: 87.4%',
    ],
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
