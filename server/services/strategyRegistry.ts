/**
 * ReviveAI Layer 2 — Typed Recovery Strategy Registry
 * 
 * Bounded strategies available to the adaptive recovery agent.
 * Gemini reasoning may recommend from this registry, but CANNOT invent
 * arbitrary actions or execute them. Policy Engine retains ultimate authority.
 */

export type RecoveryStrategyId =
  | 'smart_retry'
  | 'whatsapp_payment_link'
  | 'delayed_retry'
  | 'payment_method_update'
  | 'human_review'
  | 'stop';

export type PolicyPermission =
  | 'AUTO_RETRY'
  | 'CUSTOMER_COMMUNICATION'
  | 'MANUAL_APPROVAL'
  | 'TERMINAL_HALT';

export type VerificationRequirement =
  | 'webhook_payment_captured'
  | 'payment_link_paid'
  | 'operator_signoff'
  | 'none';

export interface RecoveryStrategyDefinition {
  id: RecoveryStrategyId;
  name: string;
  description: string;
  applicableFailureTypes: string[];
  maxAttempts: number;
  cooldownSeconds: number;
  requiredPolicyPermission: PolicyPermission;
  verificationRequirement: VerificationRequirement;
  isCustomerContact: boolean;
}

export const STRATEGY_REGISTRY: Record<RecoveryStrategyId, RecoveryStrategyDefinition> = {
  smart_retry: {
    id: 'smart_retry',
    name: 'Smart Immediate Gateway Retry',
    description: 'Autonomous zero-wait retry through an alternate acquiring bank route or backup payment gateway.',
    applicableFailureTypes: [
      'BANK_TIMEOUT',
      '504',
      'GATEWAY_ERROR',
      'TEMPORARY_DEGRADATION',
      'NETWORK_TIMEOUT',
      'NETWORK_ERROR',
      'ISSUER_DOWN'
    ],
    maxAttempts: 2,
    cooldownSeconds: 5,
    requiredPolicyPermission: 'AUTO_RETRY',
    verificationRequirement: 'webhook_payment_captured',
    isCustomerContact: false
  },

  whatsapp_payment_link: {
    id: 'whatsapp_payment_link',
    name: 'WhatsApp Customer Recovery Link',
    description: 'Personalized WhatsApp recovery message with 1-click Razorpay checkout link and customer token.',
    applicableFailureTypes: [
      'BANK_TIMEOUT',
      '504',
      'GATEWAY_ERROR',
      'TEMPORARY_DEGRADATION',
      'USER_DROPPED',
      'AUTH_FAILED',
      'AUTH_EXPIRED',
      'USER_CANCELLED',
      'SOFT_DECLINE'
    ],
    maxAttempts: 2,
    cooldownSeconds: 120,
    requiredPolicyPermission: 'CUSTOMER_COMMUNICATION',
    verificationRequirement: 'payment_link_paid',
    isCustomerContact: true
  },

  delayed_retry: {
    id: 'delayed_retry',
    name: 'Delayed Intelligent Retry',
    description: 'Scheduled background retry queued for dispatch after issuer maintenance or high-latency window clears.',
    applicableFailureTypes: [
      'BANK_TIMEOUT',
      '504',
      'DOWNTIME_WINDOW',
      'GATEWAY_MAINTENANCE',
      'RATE_LIMITED',
      'SCHEDULED_DOWNTIME',
      'GATEWAY_ERROR',
      'TEMPORARY_DEGRADATION'
    ],
    maxAttempts: 1,
    cooldownSeconds: 60,
    requiredPolicyPermission: 'AUTO_RETRY',
    verificationRequirement: 'webhook_payment_captured',
    isCustomerContact: false
  },

  payment_method_update: {
    id: 'payment_method_update',
    name: 'Request Payment Method Update',
    description: 'Interactive nudge prompting customer to switch payment instrument (e.g., Card to UPI or Netbanking).',
    applicableFailureTypes: [
      'INSUFFICIENT_FUNDS',
      'ERR_INSUFFICIENT_FUNDS',
      'LIMIT_EXCEEDED',
      'MANDATE_LIMIT_EXCEEDED',
      'CARD_EXPIRED',
      'EXPIRED_PAYMENT_METHOD',
      'PAYMENT_METHOD_INVALID'
    ],
    maxAttempts: 1,
    cooldownSeconds: 180,
    requiredPolicyPermission: 'CUSTOMER_COMMUNICATION',
    verificationRequirement: 'payment_link_paid',
    isCustomerContact: true
  },

  human_review: {
    id: 'human_review',
    name: 'Escalate to Human Review',
    description: 'Manual escalation to merchant operator triage queue for high-value or edge-case transactions.',
    applicableFailureTypes: [
      'HIGH_VALUE_THRESHOLD',
      'LOW_CONFIDENCE',
      'SUSPECTED_RISK',
      'MAX_RETRIES_EXCEEDED',
      'LIMIT_EXCEEDED',
      'MANUAL_OVERRIDE_REQUIRED'
    ],
    maxAttempts: 1,
    cooldownSeconds: 0,
    requiredPolicyPermission: 'MANUAL_APPROVAL',
    verificationRequirement: 'operator_signoff',
    isCustomerContact: false
  },

  stop: {
    id: 'stop',
    name: 'Halt Recovery (Terminal Stop)',
    description: 'Permanent termination of recovery workflow to prevent fee burn, customer fatigue, or fraud exposure.',
    applicableFailureTypes: [
      'FRAUD_DETECTED',
      'SUSPECTED_FRAUD',
      'CARD_LOST_OR_STOLEN',
      'POLICY_VIOLATION',
      'UNRECOVERABLE_FAILURE',
      'QUOTA_EXHAUSTED'
    ],
    maxAttempts: 1,
    cooldownSeconds: 0,
    requiredPolicyPermission: 'TERMINAL_HALT',
    verificationRequirement: 'none',
    isCustomerContact: false
  }
};

/**
 * Canonical strategy IDs available for automated recovery
 */
export const CANONICAL_RECOVERY_STRATEGIES: readonly RecoveryStrategyId[] = [
  'smart_retry',
  'whatsapp_payment_link',
  'delayed_retry',
  'payment_method_update'
] as const;

/**
 * Normalizes legacy, alias, or loose strategy names into canonical RecoveryStrategyId
 */
export function normalizeStrategyId(raw: string | undefined | null): RecoveryStrategyId {
  if (!raw || typeof raw !== 'string') {
    return 'human_review';
  }
  const clean = raw.trim().toLowerCase();

  // Smart retry aliases
  if (clean === 'smart_retry' || clean === 'retry_now' || clean === 'immediate_retry') {
    return 'smart_retry';
  }

  // WhatsApp / payment link aliases
  if (
    clean === 'whatsapp_payment_link' ||
    clean === 'whatsapp_recovery' ||
    clean === 'whatsapp' ||
    clean === 'payment_link'
  ) {
    return 'whatsapp_payment_link';
  }

  // Delayed retry aliases
  if (clean === 'delayed_retry' || clean === 'scheduled_retry') {
    return 'delayed_retry';
  }

  // Payment method update aliases
  if (
    clean === 'payment_method_update' ||
    clean === 'update_payment_method' ||
    clean === 'switch_instrument'
  ) {
    return 'payment_method_update';
  }

  // Human review aliases
  if (
    clean === 'human_review' ||
    clean === 'human_approval' ||
    clean === 'manual_review' ||
    clean === 'manual_approval'
  ) {
    return 'human_review';
  }

  // Terminal stop aliases
  if (clean === 'stop' || clean === 'halt' || clean === 'terminate') {
    return 'stop';
  }

  if (isValidStrategyId(raw as any)) {
    return raw as RecoveryStrategyId;
  }

  return 'human_review';
}

/**
 * Type-guard to verify whether an arbitrary string is a valid strategy ID
 */
export function isValidStrategyId(id: string): id is RecoveryStrategyId {
  return (
    id in STRATEGY_REGISTRY ||
    id === 'update_payment_method' // accepted alias
  );
}

/**
 * Retrieve strategy definition with runtime check and alias resolution
 */
export function getStrategyDefinition(id: string): RecoveryStrategyDefinition {
  const normalized = normalizeStrategyId(id);
  const strategy = STRATEGY_REGISTRY[normalized];
  if (!strategy) {
    throw new Error(`Strategy "${id}" (normalized: "${normalized}") is not registered in STRATEGY_REGISTRY`);
  }
  return strategy;
}

/**
 * List all registered recovery strategies
 */
export function getAllStrategies(): RecoveryStrategyDefinition[] {
  return Object.values(STRATEGY_REGISTRY);
}

/**
 * Find recommended strategies compatible with a specific failure code
 */
export function getCompatibleStrategies(failureCode: string): RecoveryStrategyDefinition[] {
  const code = failureCode.toUpperCase();
  return getAllStrategies().filter((strategy) =>
    strategy.applicableFailureTypes.some((type) => code.includes(type) || type.includes(code))
  );
}
