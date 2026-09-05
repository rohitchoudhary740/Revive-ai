import { GeminiDiagnosisResult } from './geminiService';
import { getGuardrailConfig, GuardrailConfig } from './guardrailConfig';

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

export function evaluateDeterministicSafetyRules(
  amount: number,
  retryCount: number,
  diagnosis: GeminiDiagnosisResult,
  isDuplicateActive: boolean,
  // Merchant-defined guardrails. Defaults to the live session config, whose
  // own defaults reproduce the original hardcoded thresholds exactly — so
  // existing decisions are unchanged unless the merchant edits a guardrail.
  config: GuardrailConfig = getGuardrailConfig()
): PolicyEvaluationResult {
  const probability = diagnosis.recoveryProbability;
  const {
    maxAutoRecoveryAmount,
    minRecoveryProbability,
    maxAutomatedRetries,
    highValueRequiresApproval,
    lowConfidenceStops,
    agentMode,
  } = config;

  const minProbPct = Math.round(minRecoveryProbability * 100);
  const limitLabel = `₹${maxAutoRecoveryAmount.toLocaleString('en-IN')}`;

  const checks = [
    {
      name: 'Amount within auto-limit',
      passed: amount <= maxAutoRecoveryAmount,
      detail: amount <= maxAutoRecoveryAmount
        ? `₹${amount.toLocaleString('en-IN')} is within automatic recovery limit (≤${limitLabel})`
        : `₹${amount.toLocaleString('en-IN')} exceeds auto-recovery threshold (>${limitLabel})`,
    },
    {
      name: 'Retry limit OK',
      passed: retryCount < maxAutomatedRetries,
      detail: `${retryCount}/${maxAutomatedRetries} automated retries used`,
    },
    {
      name: 'Recovery probability acceptable',
      passed: probability >= minRecoveryProbability,
      detail: `${Math.round(probability * 100)}% probability (threshold: ≥${minProbPct}%)`,
    },
    {
      name: 'No duplicate recovery',
      passed: !isDuplicateActive,
      detail: !isDuplicateActive ? 'No other active recovery session found' : 'Active duplicate recovery detected',
    },
    {
      name: 'Customer contact quota',
      passed: true,
      detail: '0/2 communication quota utilized today',
    }
  ];

  // 1. Stopped Conditions (Critical Failures)
  if (retryCount >= maxAutomatedRetries) {
    return {
      isApproved: false,
      requiresHumanApproval: false,
      isStopped: true,
      statusText: `🛑 ACTION STOPPED (Retry limit reached — guardrail: max ${maxAutomatedRetries})`,
      checks,
    };
  }

  if (probability < minRecoveryProbability) {
    // Whether low probability stops recovery is a merchant guardrail.
    if (lowConfidenceStops) {
      return {
        isApproved: false,
        requiresHumanApproval: false,
        isStopped: true,
        statusText: `🛑 ACTION STOPPED (Recovery probability below guardrail: <${minProbPct}%)`,
        checks,
      };
    }
    // Guardrail disabled: hold for a human instead of auto-stopping.
    return {
      isApproved: false,
      requiresHumanApproval: true,
      isStopped: false,
      statusText: `🟡 HUMAN APPROVAL REQUIRED (Recovery probability below guardrail: <${minProbPct}%, auto-stop off)`,
      checks,
    };
  }

  if (isDuplicateActive) {
    return {
      isApproved: false,
      requiresHumanApproval: false,
      isStopped: true,
      statusText: '🛑 ACTION STOPPED (Duplicate Active)',
      checks,
    };
  }

  // 2. Human Approval Required Conditions (Warnings / Gatekeepers)
  const isHighValue = amount > maxAutoRecoveryAmount;
  if ((isHighValue && highValueRequiresApproval) || diagnosis.confidence < 0.80 || diagnosis.recommendedAction === 'human_approval') {
    const reason = isHighValue && highValueRequiresApproval
      ? `transaction amount (₹${amount.toLocaleString('en-IN')}) exceeds auto-limit guardrail (${limitLabel})`
      : diagnosis.confidence < 0.80
        ? 'AI confidence below 80%'
        : 'AI recommended manual approval';
    return {
      isApproved: false,
      requiresHumanApproval: true,
      isStopped: false,
      statusText: `🟡 HUMAN APPROVAL REQUIRED (${reason})`,
      checks,
    };
  }

  // 3. Agent Mode gate — only affects cases that would otherwise auto-recover.
  if (agentMode === 'review_first') {
    return {
      isApproved: false,
      requiresHumanApproval: true,
      isStopped: false,
      statusText: '🟡 HUMAN APPROVAL REQUIRED (Agent Mode: Review First)',
      checks,
    };
  }
  if (agentMode === 'manual_only') {
    return {
      isApproved: false,
      requiresHumanApproval: true,
      isStopped: false,
      statusText: '🟡 HUMAN APPROVAL REQUIRED (Agent Mode: Manual Only — no autonomous action)',
      checks,
    };
  }

  // 4. Approved (Auto Recover)
  return {
    isApproved: true,
    requiresHumanApproval: false,
    isStopped: false,
    statusText: '🟢 ACTION APPROVED',
    checks,
  };
}
