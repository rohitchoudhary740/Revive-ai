/**
 * ReviveAI Canonical Strategy Ranking Engine
 * 
 * Deterministic, context-aware candidate-ranking engine.
 * Computes transparent, multi-factor scores for all registered recovery strategies.
 * Evaluates:
 * - Failure type compatibility
 * - Recovery probability & confidence
 * - Transaction amount & merchant guardrails
 * - History & repetition invariants (no consecutive identical failed actions)
 * - Channel friction & recovery yield
 * - Customer contact count & channel fatigue
 */

import {
  RecoveryStrategyId,
  STRATEGY_REGISTRY,
  CANONICAL_RECOVERY_STRATEGIES,
  getStrategyDefinition,
  normalizeStrategyId
} from './strategyRegistry';
import { GuardrailConfig, getGuardrailConfig } from './guardrailConfig';

export interface StrategyRankingContext {
  failureCode: string;
  amount?: number;
  history?: Array<{
    attempt_number?: number;
    strategy_id: string;
    strategy_name?: string;
    outcome?: string;
    action_status?: string;
    failure_reason?: string | null;
  }>;
  previousAttempts?: Array<{
    attemptNumber?: number;
    strategyId: string;
    status?: string;
    outcome?: string;
    reason?: string;
  }>;
  diagnosis?: {
    recoveryProbability: number;
    confidence: number;
    rootCause?: string;
  };
  recoveryProbability?: number;
  diagnosisConfidence?: number;
  guardrails?: GuardrailConfig;
  merchantGuardrails?: GuardrailConfig;
  customer?: {
    name?: string;
    phone?: string;
    retryCount?: number;
  };
  customerContactsCount?: number;
  retryCount?: number;
  advisoryAiRecommendation?: string | null;
  [key: string]: any;
}

export interface StrategyScoreBreakdown {
  compatibility: number;
  frictionYield: number;
  probContribution: number;
  historyPenalty: number;
  fatiguePenalty: number;
  guardrailAdjustment: number;
  aiAdvisoryBoost: number;
}

export interface CandidateStrategyEvaluation {
  strategyId: RecoveryStrategyId;
  strategyName: string;
  score: number;
  isEligible: boolean;
  reasoning: string;
  whyRejectedIfAlternative: string;
  breakdown: StrategyScoreBreakdown;
}

export interface StrategySelectionDecision {
  selectedStrategy: RecoveryStrategyId;
  score: number;
  reasoning: string;
  evidence: string[];
  alternatives: {
    strategyId: RecoveryStrategyId;
    strategyName: string;
    score: number;
    whyRejected: string;
  }[];
  candidates: CandidateStrategyEvaluation[];
}

export class StrategyRanker {
  /**
   * Deterministically evaluates and ranks all canonical recovery strategies.
   */
  static rankStrategies(context: StrategyRankingContext): StrategySelectionDecision {
    const code = (context.failureCode || 'BANK_TIMEOUT').toUpperCase();
    const amount = context.amount ?? 5000;
    const history = context.history || (context.previousAttempts?.map((p: any, idx: number) => {
      if (typeof p === 'string') {
        return {
          attempt_number: idx + 1,
          strategy_id: p,
          outcome: 'failure',
          action_status: 'executed',
          failure_reason: 'Previous attempt failed'
        };
      }
      return {
        attempt_number: p.attemptNumber ?? (idx + 1),
        strategy_id: p.strategyId,
        outcome: p.outcome ?? 'failure',
        action_status: p.status ?? 'executed',
        failure_reason: p.reason
      };
    })) || [];
    const guardrails = context.guardrails || context.merchantGuardrails || getGuardrailConfig();
    const prob = context.recoveryProbability ?? (context.diagnosis?.recoveryProbability ?? 0.85);
    const conf = context.diagnosisConfidence ?? (context.diagnosis?.confidence ?? 0.90);

    const lastStep = history.length > 0 ? history[history.length - 1] : null;
    const totalIterations = history.length;
    const maxIterations = 3;

    // Count customer contacts already executed
    let customerContactsCount = context.customerContactsCount ?? 0;
    for (const step of history) {
      if (step.action_status === 'executed' || step.outcome === 'success' || step.outcome === 'failure') {
        const def = getStrategyDefinition(step.strategy_id);
        if (def && def.isCustomerContact) {
          customerContactsCount += 1;
        }
      }
    }

    const isFraudOrRisk =
      code.includes('FRAUD') ||
      code.includes('STOLEN') ||
      code.includes('BLOCKED') ||
      code.includes('RISK_SENTINEL') ||
      code.includes('SUSPECTED_RISK');

    const isHighValue = amount > guardrails.maxAutoRecoveryAmount;
    const isBelowMinProb = prob < guardrails.minRecoveryProbability;
    const isIterationExhausted = totalIterations >= maxIterations;

    const normalizedAiRec = context.advisoryAiRecommendation
      ? normalizeStrategyId(context.advisoryAiRecommendation)
      : null;

    const candidateIds: RecoveryStrategyId[] = [
      'smart_retry',
      'whatsapp_payment_link',
      'delayed_retry',
      'payment_method_update',
      'human_review',
      'stop'
    ];

    const evaluations: CandidateStrategyEvaluation[] = candidateIds.map((stratId) => {
      const def = STRATEGY_REGISTRY[stratId];
      let compatibility = 0;
      let frictionYield = 0;
      let probContribution = 0;
      let historyPenalty = 0;
      let fatiguePenalty = 0;
      let guardrailAdjustment = 0;
      let aiAdvisoryBoost = 0;
      let isEligible = true;
      let reasoning = '';
      let whyRejected = '';

      // Count prior attempts of this exact strategy
      const attemptsUsed = history.filter((h) => h.strategy_id === stratId).length;
      const isConsecutiveIdentical =
        lastStep !== null &&
        lastStep.outcome === 'failure' &&
        lastStep.strategy_id === stratId;

      // ── 1. COMPATIBILITY SCORING (0 to 40) ──────────────────────────────
      if (stratId === 'stop') {
        if (isFraudOrRisk) {
          compatibility = 45;
          reasoning = 'Critical risk / fraud signature detected; recovery must be permanently halted.';
        } else if (isBelowMinProb && guardrails.lowConfidenceStops) {
          compatibility = 35;
          reasoning = 'Recovery probability below merchant floor with low-confidence stop rule active.';
        } else {
          compatibility = 5;
          whyRejected = 'Terminal halt not warranted for potentially recoverable payment failure.';
        }
      } else if (stratId === 'human_review') {
        if (isHighValue && guardrails.highValueRequiresApproval) {
          compatibility = 45;
          reasoning = `Transaction amount (₹${amount.toLocaleString('en-IN')}) exceeds auto-limit (₹${guardrails.maxAutoRecoveryAmount.toLocaleString('en-IN')}); operator review required.`;
        } else if (isIterationExhausted) {
          compatibility = 45;
          reasoning = `Maximum recovery attempts (${maxIterations}) reached; escalating to operator queue.`;
        } else if (guardrails.agentMode === 'review_first' || guardrails.agentMode === 'manual_only') {
          compatibility = 40;
          reasoning = `Merchant policy mode is "${guardrails.agentMode}"; autonomous execution is gated behind human review.`;
        } else {
          compatibility = 15;
          whyRejected = 'Autonomous recovery within merchant bounds is preferred before operator escalation.';
        }
      } else if (stratId === 'payment_method_update') {
        if (
          code.includes('INSUFFICIENT_FUNDS') ||
          code.includes('BALANCE') ||
          code.includes('LIMIT_EXCEEDED') ||
          code.includes('CARD_EXPIRED') ||
          code.includes('EXPIRED_PAYMENT_METHOD') ||
          code.includes('PAYMENT_METHOD_INVALID')
        ) {
          compatibility = 40;
          reasoning = 'Decline caused by instrument balance, limit, or expiration; customer instrument update required.';
        } else {
          compatibility = 0;
          whyRejected = 'Failure is network or gateway related; instrument switch is unnecessary.';
        }
      } else if (stratId === 'smart_retry') {
        if (
          code.includes('GATEWAY_ERROR') ||
          code.includes('TEMPORARY_DEGRADATION') ||
          code.includes('TRANSIENT_DEGRADATION')
        ) {
          compatibility = 25;
          whyRejected = 'Gateway infrastructure is degraded; delayed retry window prevents hammering the degraded endpoint.';
        } else if (
          code.includes('BANK_TIMEOUT') ||
          code.includes('TIMEOUT') ||
          code.includes('504') ||
          code.includes('NETWORK') ||
          code.includes('ISSUER_DOWN')
        ) {
          compatibility = 40;
          reasoning = 'Temporary bank or network timeout detected; immediate secondary route retry offers fastest recovery.';
        } else {
          compatibility = 0;
          whyRejected = 'Failure signature does not indicate temporary gateway latency.';
        }
      } else if (stratId === 'delayed_retry') {
        if (
          code.includes('DOWNTIME') ||
          code.includes('MAINTENANCE') ||
          code.includes('RATE_LIMITED') ||
          code.includes('SCHEDULED_DOWNTIME') ||
          code.includes('GATEWAY_ERROR') ||
          code.includes('TRANSIENT_DEGRADATION') ||
          code.includes('TEMPORARY_DEGRADATION')
        ) {
          compatibility = 42;
          reasoning = 'Issuer or gateway degradation window detected; scheduled retry after latency window clears offers highest success.';
        } else if (code.includes('504') || code.includes('TIMEOUT') || code.includes('NETWORK')) {
          compatibility = 25;
          whyRejected = 'Immediate retry is faster than delayed queuing when bank node is partially responsive.';
        } else {
          compatibility = 0;
          whyRejected = 'Delayed queueing not compatible with non-downtime failure code.';
        }
      } else if (stratId === 'whatsapp_payment_link') {
        if (
          code.includes('USER_DROPPED') ||
          code.includes('AUTH_EXPIRED') ||
          code.includes('USER_CANCELLED') ||
          code.includes('AUTH_FAILED') ||
          code.includes('SOFT_DECLINE')
        ) {
          compatibility = 40;
          reasoning = 'Customer checkout abandonment or authentication drop; direct WhatsApp 1-click link yields highest re-conversion.';
        } else if (
          code.includes('BANK_TIMEOUT') ||
          code.includes('504') ||
          code.includes('GATEWAY_ERROR') ||
          code.includes('TEMPORARY_DEGRADATION')
        ) {
          compatibility = 30;
          whyRejected = 'Autonomous gateway retry is zero-friction; WhatsApp customer link incurs buyer interaction delay.';
        } else {
          compatibility = 10;
          whyRejected = 'Outreach not optimal for non-customer-facing decline code.';
        }
      }

      // ── 2. CHANNEL FRICTION & RECOVERY YIELD (0 to 25) ───────────────────
      if (stratId === 'smart_retry') {
        frictionYield = 25; // Zero customer friction
      } else if (stratId === 'delayed_retry') {
        frictionYield = 18; // Zero customer friction, but delayed order turnaround
      } else if (stratId === 'whatsapp_payment_link') {
        frictionYield = 20; // High conversion, but requires customer attention
      } else if (stratId === 'payment_method_update') {
        frictionYield = 16; // Requires customer to input new card/UPI
      } else if (stratId === 'human_review') {
        frictionYield = 10;
      } else if (stratId === 'stop') {
        frictionYield = 0;
      }

      // ── 3. PROBABILITY & CONFIDENCE CONTRIBUTION (0 to 20) ──────────────
      if (stratId !== 'stop' && stratId !== 'human_review') {
        probContribution = Math.round(prob * conf * 20);
        if (isBelowMinProb) {
          guardrailAdjustment -= 30;
        }
      } else if (stratId === 'stop' && isBelowMinProb) {
        probContribution = 20;
      }

      // ── 4. PREVIOUS ATTEMPTS & LOOP INVARIANTS ───────────────────────────
      if (isConsecutiveIdentical) {
        historyPenalty -= 100;
        isEligible = false;
        whyRejected = `Consecutive identical failed action prohibited for "${def.name}".`;
      }

      if (attemptsUsed >= def.maxAttempts) {
        historyPenalty -= 100;
        isEligible = false;
        whyRejected = `Max attempts budget exhausted (${attemptsUsed}/${def.maxAttempts}) for "${def.name}".`;
      } else if (attemptsUsed > 0) {
        historyPenalty -= attemptsUsed * 25;
      }

      if (isIterationExhausted && stratId !== 'human_review' && stratId !== 'stop') {
        historyPenalty -= 100;
        isEligible = false;
        whyRejected = `Total iteration limit (${maxIterations}) reached.`;
      }

      // ── 5. CUSTOMER CONTACT & CHANNEL FATIGUE ────────────────────────────
      if (def.isCustomerContact) {
        if (customerContactsCount >= 2) {
          fatiguePenalty -= 100;
          isEligible = false;
          whyRejected = `Customer contact quota exhausted (${customerContactsCount}/2 max).`;
        } else if (customerContactsCount === 1) {
          fatiguePenalty -= 25;
          whyRejected = `Channel fatigue: customer was already contacted in previous attempt.`;
        }
      }

      // ── 6. MERCHANT GUARDRAILS & RISK SAFETY ─────────────────────────────
      if (isFraudOrRisk) {
        if (stratId !== 'stop') {
          guardrailAdjustment -= 150;
          isEligible = false;
          whyRejected = 'Critical risk signature blocks automated recovery.';
        }
      } else if (isHighValue && guardrails.highValueRequiresApproval) {
        if (stratId !== 'human_review' && stratId !== 'stop') {
          guardrailAdjustment -= 60;
          whyRejected = `High-value payment (₹${amount.toLocaleString('en-IN')}) requires operator signoff.`;
        }
      }

      // ── 7. ADVISORY AI RECOMMENDATION BOOST ──────────────────────────────
      if (normalizedAiRec === stratId && isEligible) {
        aiAdvisoryBoost = 5;
      }

      const totalScore = Math.max(
        0,
        compatibility +
          frictionYield +
          probContribution +
          historyPenalty +
          fatiguePenalty +
          guardrailAdjustment +
          aiAdvisoryBoost
      );

      return {
        strategyId: stratId,
        strategyName: def.name,
        score: totalScore,
        isEligible: isEligible && compatibility > 0,
        reasoning: reasoning || def.description,
        whyRejectedIfAlternative: whyRejected || 'Ranked lower based on recovery friction and channel yield.',
        breakdown: {
          compatibility,
          frictionYield,
          probContribution,
          historyPenalty,
          fatiguePenalty,
          guardrailAdjustment,
          aiAdvisoryBoost
        }
      };
    });

    // Sort by score descending; if score tied, prefer lower friction
    evaluations.sort((a, b) => {
      if (b.isEligible !== a.isEligible) {
        return b.isEligible ? 1 : -1;
      }
      return b.score - a.score;
    });

    const topCandidate = evaluations.find((e) => e.isEligible) || evaluations[0];
    const alternatives = evaluations
      .filter((e) => e.strategyId !== topCandidate.strategyId)
      .map((e) => ({
        strategyId: e.strategyId,
        strategyName: e.strategyName,
        score: e.score,
        whyRejected: e.whyRejectedIfAlternative
      }));

    const evidence = [
      `Failure classified as "${context.failureCode}" (${Math.round(prob * 100)}% recovery probability)`,
      `Order amount ₹${amount.toLocaleString('en-IN')} with ${history.length} previous attempts`,
      `Channel contact quota: ${customerContactsCount}/2 customer interactions utilized`,
      `Strategy ranking evaluated 6 candidates; top choice scored ${topCandidate.score}/100 pts`
    ];

    return {
      selectedStrategy: topCandidate.strategyId,
      score: topCandidate.score,
      reasoning: topCandidate.reasoning,
      evidence,
      alternatives,
      candidates: evaluations
    };
  }
}
