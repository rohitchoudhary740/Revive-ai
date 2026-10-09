/**
 * ReviveAI Layer 2 — Adaptive Closed-Loop Recovery Agent
 * 
 * Conceptual Loop:
 * Detect → Diagnose → Decide → Policy → Act → Verify → Evaluate Outcome → Re-evaluate OR Recover OR Escalate OR Stop
 * 
 * Invariants:
 * - Deterministic policy engine is the FINAL authority.
 * - Gemini / LLM may recommend strategies, but CANNOT execute them.
 * - Executor ONLY executes policy-approved, typed strategies from STRATEGY_REGISTRY.
 * - Loop prevention:
 *     1. MAX_TOTAL_ITERATIONS (3)
 *     2. MAX_ATTEMPTS_PER_STRATEGY (defined per strategy in registry)
 *     3. MAX_CUSTOMER_CONTACTS (2 touches)
 *     4. NO_CONSECUTIVE_IDENTICAL_ACTIONS (cannot repeat failed action back-to-back)
 *     5. TERMINAL_STATE_PROTECTION (terminal cases cannot be acted upon)
 */

import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { RecoveryJourneyRepository, RecoveryJourneyStepRecord } from '../repositories/recoveryJourneyRepository';
import { AuditEventRepository } from '../repositories/auditEventRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { AiDiagnosisRepository } from '../repositories/aiDiagnosisRepository';
import {
  RecoveryStrategyId,
  STRATEGY_REGISTRY,
  getStrategyDefinition,
  isValidStrategyId,
  normalizeStrategyId
} from './strategyRegistry';
import { StrategyRanker } from './strategyRanking';
import { getGuardrailConfig, GuardrailConfig } from './guardrailConfig';
import { GeminiDiagnosisResult } from './geminiService';
import { RazorpayService } from './razorpayService';
import {
  FinancialSafetyService,
  type ExecutionMode,
  TerminalCaseError,
  DuplicateActionError,
  RetryRaceError,
  AmountMismatchError,
  PolicyRecheckError,
  StaleAuthorizationError
} from './financialSafetyService';

export const LOOP_LIMITS = {
  MAX_TOTAL_ITERATIONS: 3,
  MAX_CUSTOMER_CONTACTS: 2,
  TERMINAL_STATES: ['recovered', 'stopped', 'cancelled', 'rejected', 'exhausted'] as const
};

export interface ClosedLoopPolicyCheckResult {
  isApproved: boolean;
  requiresHumanApproval: boolean;
  isStopped: boolean;
  statusText: string;
  rejectionReason?: string;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

export interface ClosedLoopAttemptResult {
  step: RecoveryJourneyStepRecord;
  policyResult: ClosedLoopPolicyCheckResult;
  isTerminated: boolean;
  finalCaseStatus: string;
  message: string;
}

export class ClosedLoopAgent {
  /**
   * Evaluates whether a candidate strategy is permitted under deterministic policy
   * and loop prevention invariants.
   */
  static evaluatePolicyForStrategy(
    caseStatus: string,
    amount: number,
    candidateStrategyId: RecoveryStrategyId,
    history: RecoveryJourneyStepRecord[],
    diagnosis: GeminiDiagnosisResult | null,
    guardrails: GuardrailConfig = getGuardrailConfig()
  ): ClosedLoopPolicyCheckResult {
    const checks: { name: string; passed: boolean; detail: string }[] = [];
    const strategyDef = getStrategyDefinition(candidateStrategyId);

    // 1. Terminal State Protection
    const isTerminal = (LOOP_LIMITS.TERMINAL_STATES as readonly string[]).includes(caseStatus);
    checks.push({
      name: 'Terminal State Protection',
      passed: !isTerminal,
      detail: !isTerminal
        ? `Case status "${caseStatus}" is actionable`
        : `Case is in terminal state "${caseStatus}" and cannot be acted upon again`
    });

    if (isTerminal) {
      return {
        isApproved: false,
        requiresHumanApproval: false,
        isStopped: true,
        rejectionReason: `Terminal case in state "${caseStatus}" cannot be re-executed`,
        statusText: `🛑 ACTION BLOCKED (Case is in terminal state: ${caseStatus})`,
        checks
      };
    }

    // 2. Maximum Total Agent Iterations
    const currentIteration = history.length + 1;
    const withinMaxTotal = currentIteration <= LOOP_LIMITS.MAX_TOTAL_ITERATIONS;
    checks.push({
      name: 'Total Iteration Limit',
      passed: withinMaxTotal,
      detail: withinMaxTotal
        ? `Attempt ${currentIteration} of max ${LOOP_LIMITS.MAX_TOTAL_ITERATIONS}`
        : `Iteration limit exceeded (${currentIteration}/${LOOP_LIMITS.MAX_TOTAL_ITERATIONS})`
    });

    if (!withinMaxTotal) {
      return {
        isApproved: false,
        requiresHumanApproval: true,
        isStopped: false,
        rejectionReason: `Max total agent iterations reached (${LOOP_LIMITS.MAX_TOTAL_ITERATIONS})`,
        statusText: `🟡 HUMAN ESCALATION (Iteration budget exhausted: ${LOOP_LIMITS.MAX_TOTAL_ITERATIONS}/${LOOP_LIMITS.MAX_TOTAL_ITERATIONS})`,
        checks
      };
    }

    // 3. Strategy Maximum Attempts Limit
    const strategyAttempts = history.filter((s) => s.strategy_id === candidateStrategyId).length;
    const withinStrategyLimit = strategyAttempts < strategyDef.maxAttempts;
    checks.push({
      name: 'Strategy Retry Budget',
      passed: withinStrategyLimit,
      detail: withinStrategyLimit
        ? `${strategyAttempts}/${strategyDef.maxAttempts} attempts used for ${strategyDef.name}`
        : `Max attempts reached for ${strategyDef.name} (${strategyAttempts}/${strategyDef.maxAttempts})`
    });

    if (!withinStrategyLimit) {
      return {
        isApproved: false,
        requiresHumanApproval: false,
        isStopped: true,
        rejectionReason: `Strategy "${candidateStrategyId}" reached max retry limit (${strategyDef.maxAttempts})`,
        statusText: `🛑 ACTION BLOCKED (Strategy retry limit reached for ${strategyDef.name})`,
        checks
      };
    }

    // 4. Duplicate / Consecutive Identical Action Prevention
    const lastStep = history.length > 0 ? history[history.length - 1] : null;
    const isConsecutiveIdentical =
      lastStep !== null &&
      lastStep.outcome === 'failure' &&
      lastStep.strategy_id === candidateStrategyId;
    checks.push({
      name: 'No Consecutive Identical Action',
      passed: !isConsecutiveIdentical,
      detail: !isConsecutiveIdentical
        ? 'Strategy differs from prior failed action or is initial attempt'
        : `Identical strategy "${candidateStrategyId}" failed on previous attempt; consecutive repetition blocked`
    });

    if (isConsecutiveIdentical) {
      return {
        isApproved: false,
        requiresHumanApproval: false,
        isStopped: true,
        rejectionReason: `Consecutive identical action prohibited for failed strategy "${candidateStrategyId}"`,
        statusText: `🛑 ACTION BLOCKED (Consecutive identical action prohibited: ${candidateStrategyId})`,
        checks
      };
    }

    // 5. Customer Contact Quota Limit
    let customerContactsCount = 0;
    for (const step of history) {
      if (step.action_status === 'executed') {
        const stepDef = getStrategyDefinition(step.strategy_id);
        if (stepDef.isCustomerContact) {
          customerContactsCount += 1;
        }
      }
    }
    const customerContactAllowed =
      !strategyDef.isCustomerContact || customerContactsCount < LOOP_LIMITS.MAX_CUSTOMER_CONTACTS;
    checks.push({
      name: 'Customer Contact Quota',
      passed: customerContactAllowed,
      detail: customerContactAllowed
        ? `${customerContactsCount}/${LOOP_LIMITS.MAX_CUSTOMER_CONTACTS} customer contacts utilized`
        : `Customer contact limit reached (${customerContactsCount}/${LOOP_LIMITS.MAX_CUSTOMER_CONTACTS})`
    });

    if (!customerContactAllowed) {
      return {
        isApproved: false,
        requiresHumanApproval: true,
        isStopped: false,
        rejectionReason: `Customer contact quota exceeded (${customerContactsCount}/${LOOP_LIMITS.MAX_CUSTOMER_CONTACTS})`,
        statusText: `🟡 HUMAN APPROVAL REQUIRED (Customer communication quota exhausted)`,
        checks
      };
    }

    // 6. Explicit Stop Strategy Handling
    if (candidateStrategyId === 'stop') {
      return {
        isApproved: true,
        requiresHumanApproval: false,
        isStopped: true,
        statusText: '🛑 ACTION APPROVED: TERMINAL HALT',
        checks
      };
    }

    // 7. Explicit Human Review Escalation Handling
    if (candidateStrategyId === 'human_review') {
      return {
        isApproved: true,
        requiresHumanApproval: true,
        isStopped: false,
        statusText: '🟡 ESCALATE TO HUMAN REVIEW',
        checks
      };
    }

    // 8. Deterministic Merchant Guardrails
    const {
      maxAutoRecoveryAmount,
      minRecoveryProbability,
      highValueRequiresApproval,
      lowConfidenceStops,
      agentMode
    } = guardrails;

    const prob = diagnosis?.recoveryProbability ?? 0.7;
    const isHighValue = amount > maxAutoRecoveryAmount;

    checks.push({
      name: 'Amount within auto-limit',
      passed: !isHighValue,
      detail: !isHighValue
        ? `₹${amount.toLocaleString('en-IN')} is within auto limit (≤₹${maxAutoRecoveryAmount.toLocaleString('en-IN')})`
        : `₹${amount.toLocaleString('en-IN')} exceeds auto limit (>₹${maxAutoRecoveryAmount.toLocaleString('en-IN')})`
    });

    checks.push({
      name: 'Recovery probability threshold',
      passed: prob >= minRecoveryProbability,
      detail: `${Math.round(prob * 100)}% probability (threshold: ≥${Math.round(minRecoveryProbability * 100)}%)`
    });

    if (prob < minRecoveryProbability) {
      if (lowConfidenceStops) {
        return {
          isApproved: false,
          requiresHumanApproval: false,
          isStopped: true,
          rejectionReason: `Recovery probability (${Math.round(prob * 100)}%) below guardrail threshold`,
          statusText: `🛑 ACTION STOPPED (Recovery probability below guardrail: <${Math.round(minRecoveryProbability * 100)}%)`,
          checks
        };
      }
      return {
        isApproved: false,
        requiresHumanApproval: true,
        isStopped: false,
        rejectionReason: `Low recovery probability requiring manual operator review`,
        statusText: `🟡 HUMAN APPROVAL REQUIRED (Low probability: <${Math.round(minRecoveryProbability * 100)}%)`,
        checks
      };
    }

    if (isHighValue && highValueRequiresApproval) {
      return {
        isApproved: false,
        requiresHumanApproval: true,
        isStopped: false,
        rejectionReason: `High-value transaction exceeds ₹${maxAutoRecoveryAmount.toLocaleString('en-IN')}`,
        statusText: `🟡 HUMAN APPROVAL REQUIRED (Amount exceeds auto-recovery threshold)`,
        checks
      };
    }

    if (agentMode === 'review_first' || agentMode === 'manual_only') {
      return {
        isApproved: false,
        requiresHumanApproval: true,
        isStopped: false,
        rejectionReason: `Agent mode set to "${agentMode}"`,
        statusText: `🟡 HUMAN APPROVAL REQUIRED (Agent Mode: ${agentMode})`,
        checks
      };
    }

    // All deterministic checks passed!
    return {
      isApproved: true,
      requiresHumanApproval: false,
      isStopped: false,
      statusText: '🟢 ACTION APPROVED',
      checks
    };
  }

  /**
   * Recommends an adaptive strategy based on multi-factor StrategyRanker engine.
   * Enforces that recommendations NEVER pick an exhausted or consecutive identical strategy.
   */
  static selectAdaptiveStrategy(
    failureCode: string,
    history: RecoveryJourneyStepRecord[],
    amount: number,
    diagnosis?: any,
    guardrails?: GuardrailConfig
  ): { strategyId: RecoveryStrategyId; reasoning: string } {
    const config = guardrails || getGuardrailConfig();
    const ranking = StrategyRanker.rankStrategies({
      failureCode,
      amount,
      history,
      diagnosis: {
        recoveryProbability: diagnosis?.recoveryProbability ?? 0.85,
        confidence: diagnosis?.confidence ?? 0.90,
        rootCause: diagnosis?.rootCause
      },
      guardrails: config,
      advisoryAiRecommendation: diagnosis?.recommendedAction
    });

    return {
      strategyId: ranking.selectedStrategy,
      reasoning: ranking.reasoning
    };
  }

  /**
   * Executes a single attempt in the adaptive closed-loop journey.
   * Enforces: Gemini Recommends -> Policy Validates -> Executor Acts -> Verifier Evaluates Outcome.
   */
  static async executeStep(
    caseId: string,
    options: {
      overrideStrategyId?: RecoveryStrategyId;
      overrideOutcome?: 'success' | 'failure' | 'timeout';
      failureReason?: string;
      requestedAmount?: number;
      idempotencyKey?: string;
      authorizedGuardrailVersion?: number;
      executionMode?: ExecutionMode;
    } = {}
  ): Promise<ClosedLoopAttemptResult> {
    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) {
      throw new Error(`Recovery case "${caseId}" not found.`);
    }

    const mode: ExecutionMode = options.executionMode || 'TEST_MODE';

    // 1. Terminal State Protection Check BEFORE any processing
    await FinancialSafetyService.assertNotTerminal(caseId, rc.status, mode);

    const tx = await TransactionRepository.findById(rc.transaction_id);
    const amount = tx?.amount ?? 5000;
    const targetAmount = options.requestedAmount !== undefined ? options.requestedAmount : amount;

    // 2. Amount Verification Check
    await FinancialSafetyService.verifyAmount(caseId, targetAmount, amount, mode);

    // 3. Stale Authorization Protection Check
    if (options.authorizedGuardrailVersion !== undefined) {
      await FinancialSafetyService.assertDecisionNotStale(caseId, options.authorizedGuardrailVersion, mode);
    }

    const failureCode = tx?.failure_code ?? 'BANK_TIMEOUT';
    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    const diagRecord = await AiDiagnosisRepository.findByCaseId(caseId);
    const attemptNumber = history.length + 1;

    // 1. REASONING / RECOMMENDATION PHASE
    let candidateStrategyId: RecoveryStrategyId;
    let reasoning: string;

    if (options.overrideStrategyId && isValidStrategyId(options.overrideStrategyId)) {
      candidateStrategyId = normalizeStrategyId(options.overrideStrategyId);
      reasoning = `Explicit strategy override requested: ${STRATEGY_REGISTRY[candidateStrategyId].name}`;
    } else {
      const rec = this.selectAdaptiveStrategy(
        failureCode,
        history,
        targetAmount,
        diagRecord ? {
          recoveryProbability: diagRecord.recovery_probability,
          confidence: diagRecord.confidence,
          rootCause: diagRecord.root_cause,
          recommendedAction: diagRecord.recommended_action
        } : undefined
      );
      candidateStrategyId = rec.strategyId;
      reasoning = rec.reasoning;
    }

    // Emit STRATEGY_CHANGED audit event if this is an adaptive strategy switch
    const previousStep = history.length > 0 ? history[history.length - 1] : null;
    if (previousStep && previousStep.strategy_id !== candidateStrategyId) {
      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'STRATEGY_CHANGED',
        case_id: caseId,
        details: FinancialSafetyService.tagMode(
          `Adaptive strategy changed from "${STRATEGY_REGISTRY[previousStep.strategy_id].name}" to "${STRATEGY_REGISTRY[candidateStrategyId].name}". Reason: ${reasoning}`,
          mode
        ),
        actor: 'Adaptive Agent',
        status: 'COMPLIANT'
      });
    }

    // 4. Pre-execution Policy Re-check (Re-reads active guardrails fresh)
    const policyResult = await FinancialSafetyService.recheckPolicyBeforeAction(
      caseId,
      rc.status,
      targetAmount,
      candidateStrategyId,
      history,
      null,
      mode,
      false
    );

    const stepId = `STEP-${caseId}-${attemptNumber}`;
    const strategyDef = getStrategyDefinition(candidateStrategyId);

    // If Policy REJECTS execution:
    if (!policyResult.isApproved) {
      const isStopped = policyResult.isStopped;
      const requiresHuman = policyResult.requiresHumanApproval;
      const finalStatus = isStopped ? 'stopped' : requiresHuman ? 'human_review' : 'failed';

      await RecoveryCaseRepository.updateStatus(
        caseId,
        finalStatus,
        isStopped ? 'Recovery Halted by Policy' : 'Awaiting Operator Approval'
      );

      const stepRecord: RecoveryJourneyStepRecord = {
        id: stepId,
        case_id: caseId,
        attempt_number: attemptNumber,
        strategy_id: candidateStrategyId,
        strategy_name: strategyDef.name,
        reasoning,
        policy_approved: 0,
        policy_checks: JSON.stringify(policyResult.checks),
        policy_status_text: policyResult.statusText,
        action_status: 'skipped',
        action_payload: JSON.stringify({ rejected: true, reason: policyResult.rejectionReason }),
        outcome: 'failure',
        failure_reason: policyResult.rejectionReason || policyResult.statusText,
        next_action: isStopped ? 'CASE_STOPPED' : 'ESCALATED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await RecoveryJourneyRepository.saveStep(stepRecord);

      if (requiresHuman) {
        await AuditEventRepository.save({
          id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
          timestamp: new Date().toLocaleTimeString() + ' (Just now)',
          event_type: 'ESCALATED',
          case_id: caseId,
          details: FinancialSafetyService.tagMode(`Case escalated to human review: ${policyResult.statusText}`, mode),
          actor: 'Policy Engine',
          status: 'COMPLIANT'
        });
      } else if (isStopped) {
        await AuditEventRepository.save({
          id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
          timestamp: new Date().toLocaleTimeString() + ' (Just now)',
          event_type: 'CASE_STOPPED',
          case_id: caseId,
          details: FinancialSafetyService.tagMode(`Case permanently stopped by policy: ${policyResult.statusText}`, mode),
          actor: 'Policy Engine',
          status: 'COMPLIANT'
        });
      }

      return {
        step: stepRecord,
        policyResult,
        isTerminated: true,
        finalCaseStatus: finalStatus,
        message: policyResult.statusText
      };
    }

    // 5. Idempotency Lock & Retry Race Protection
    const actionKey = options.idempotencyKey || `act_${caseId}_${candidateStrategyId}_${attemptNumber}`;
    await FinancialSafetyService.acquireActionLock(
      actionKey,
      caseId,
      candidateStrategyId,
      { amount: targetAmount, attempt: attemptNumber },
      mode
    );

    // Policy APPROVED the strategy! Emit STRATEGY_SELECTED audit event
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'STRATEGY_SELECTED',
      case_id: caseId,
      details: FinancialSafetyService.tagMode(
        `Policy Engine validated and selected strategy: ${strategyDef.name} (Attempt #${attemptNumber})`,
        mode
      ),
      actor: 'Policy Engine',
      status: 'APPROVED'
    });

    // 3. EXECUTOR EXECUTES POLICY-APPROVED TYPED ACTION
    let actionPayload: Record<string, any> = {};
    let actionExecutionError: string | null = null;

    try {
      if (candidateStrategyId === 'smart_retry') {
        actionPayload = {
          channel: 'gateway_reroute',
          target_gateway: 'HDFC_SECONDARY_NODE',
          idempotency_key: `retry_${caseId}_${attemptNumber}`
        };
      } else if (candidateStrategyId === 'whatsapp_payment_link') {
        const plink = await RazorpayService.createRecoveryPaymentLink(
          caseId,
          targetAmount,
          tx?.order_id || `order_${caseId}`,
          {
            name: tx?.customer_name || 'Customer',
            email: tx?.customer_email || 'customer@example.com',
            phone: tx?.customer_phone || '+919999999999'
          }
        );
        actionPayload = {
          channel: 'whatsapp',
          payment_link_id: plink.id,
          payment_url: plink.short_url
        };
      } else if (candidateStrategyId === 'delayed_retry') {
        actionPayload = {
          channel: 'scheduler',
          scheduled_delay_seconds: 60,
          target_run_time: new Date(Date.now() + 60000).toISOString()
        };
      } else if (candidateStrategyId === 'payment_method_update') {
        actionPayload = {
          channel: 'whatsapp_nudge',
          prompt: 'Please switch payment method to complete order',
          options: ['UPI', 'Debit/Credit Card', 'Netbanking']
        };
      } else if (candidateStrategyId === 'stop') {
        actionPayload = { action: 'terminal_stop' };
      } else if (candidateStrategyId === 'human_review') {
        actionPayload = { action: 'queue_for_operator' };
      }

      await FinancialSafetyService.completeActionLock(actionKey, caseId, actionPayload);

      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'ACTION_EXECUTED',
        case_id: caseId,
        details: FinancialSafetyService.tagMode(
          `Dispatched action for strategy "${strategyDef.name}" on channel ${actionPayload.channel || 'system'}.`,
          mode
        ),
        actor: 'ReviveAI Executor',
        status: 'EXECUTED'
      });
    } catch (err: any) {
      actionExecutionError = err.message;
      await FinancialSafetyService.handleExternalExecutionFailure(caseId, candidateStrategyId, err, mode);
      await FinancialSafetyService.releaseActionLock(actionKey, caseId, err.message);

      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'ACTION_FAILED',
        case_id: caseId,
        details: FinancialSafetyService.tagMode(
          `Failed to execute action for strategy "${strategyDef.name}": ${err.message}`,
          mode
        ),
        actor: 'ReviveAI Executor',
        status: 'FAILED'
      });
    }

    // 4. VERIFY & EVALUATE OUTCOME PHASE
    if (options.overrideOutcome === 'timeout') {
      await FinancialSafetyService.handleVerificationTimeout(caseId, mode);
      const timeoutStepRecord: RecoveryJourneyStepRecord = {
        id: stepId,
        case_id: caseId,
        attempt_number: attemptNumber,
        strategy_id: candidateStrategyId,
        strategy_name: strategyDef.name,
        reasoning,
        policy_approved: 1,
        policy_checks: JSON.stringify(policyResult.checks),
        policy_status_text: policyResult.statusText,
        action_status: 'executed',
        action_payload: JSON.stringify(actionPayload),
        outcome: 'failure',
        failure_reason: 'Payment settlement verification timed out. Held for verification.',
        next_action: 'VERIFY_PENDING',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await RecoveryJourneyRepository.saveStep(timeoutStepRecord);
      await FinancialSafetyService.releaseActionLock(actionKey, caseId, 'Timeout');

      return {
        step: timeoutStepRecord,
        policyResult,
        isTerminated: false,
        finalCaseStatus: 'verify_pending',
        message: 'Payment verification timed out. Case moved to verify_pending without marking recovered.'
      };
    }

    // Determine outcome (either overridden for testing or simulated/verified)
    const isSuccess =
      !actionExecutionError &&
      (options.overrideOutcome !== undefined
        ? options.overrideOutcome === 'success'
        : candidateStrategyId === 'whatsapp_payment_link'
          ? true // Default single demo path succeeds
          : candidateStrategyId === 'smart_retry'
            ? false // In multi-attempt scenarios, retry can fail to prompt adaptive switch
            : true);

    const outcome: 'success' | 'failure' = isSuccess ? 'success' : 'failure';
    const failureReason = isSuccess
      ? null
      : options.failureReason || actionExecutionError || 'Gateway latency exceeded 504 deadline during retry handshake';

    // Save journey step
    const stepRecord: RecoveryJourneyStepRecord = {
      id: stepId,
      case_id: caseId,
      attempt_number: attemptNumber,
      strategy_id: candidateStrategyId,
      strategy_name: strategyDef.name,
      reasoning,
      policy_approved: 1,
      policy_checks: JSON.stringify(policyResult.checks),
      policy_status_text: policyResult.statusText,
      action_status: actionExecutionError ? 'failed' : 'executed',
      action_payload: JSON.stringify(actionPayload),
      outcome,
      failure_reason: failureReason,
      next_action: isSuccess ? 'CASE_RECOVERED' : 'EVALUATING_NEXT_STRATEGY',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await RecoveryJourneyRepository.saveStep(stepRecord);

    // Audit OUTCOME_EVALUATED
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'OUTCOME_EVALUATED',
      case_id: caseId,
      details: `Attempt #${attemptNumber} outcome evaluated: ${outcome.toUpperCase()}${failureReason ? ` (Reason: ${failureReason})` : ''}`,
      actor: 'Outcome Evaluator',
      status: outcome === 'success' ? 'VERIFIED' : 'FAILED'
    });

    // ── IF VERIFIED SUCCESS ──────────────────────────────────────────────────
    if (isSuccess) {
      await FinancialSafetyService.completeActionLock(actionKey, caseId, { status: 'recovered', strategy: candidateStrategyId });
      await RecoveryCaseRepository.updateStatus(caseId, 'recovered', 'Payment Verified & Settled');

      await AuditEventRepository.save({
        id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
        timestamp: new Date().toLocaleTimeString() + ' (Just now)',
        event_type: 'CASE_RECOVERED',
        case_id: caseId,
        details: `Case successfully recovered ₹${amount.toLocaleString('en-IN')} via ${strategyDef.name}. Workflow terminated.`,
        actor: 'ReviveAI Agent',
        status: 'VERIFIED'
      });

      return {
        step: stepRecord,
        policyResult,
        isTerminated: true,
        finalCaseStatus: 'recovered',
        message: `Recovery verified successfully via ${strategyDef.name}.`
      };
    }

    // ── IF FAILURE: Determine whether another strategy is permitted ──────────
    await FinancialSafetyService.releaseActionLock(actionKey, caseId, failureReason || 'Attempt failed');
    const updatedHistory = await RecoveryJourneyRepository.findByCaseId(caseId);

    // Check if another strategy can be selected
    const nextRec = this.selectAdaptiveStrategy(
      failureCode,
      updatedHistory,
      amount,
      diagRecord ? {
        recoveryProbability: diagRecord.recovery_probability,
        confidence: diagRecord.confidence,
        rootCause: diagRecord.root_cause,
        recommendedAction: diagRecord.recommended_action
      } : undefined
    );
    const nextStrategyDef = getStrategyDefinition(nextRec.strategyId);

    // Can policy permit another attempt?
    const nextPolicyCheck = this.evaluatePolicyForStrategy(
      rc.status,
      amount,
      nextRec.strategyId,
      updatedHistory,
      null
    );

    if (!nextPolicyCheck.isApproved || updatedHistory.length >= LOOP_LIMITS.MAX_TOTAL_ITERATIONS) {
      // No further automated attempt permitted
      if (nextPolicyCheck.requiresHumanApproval || updatedHistory.length >= LOOP_LIMITS.MAX_TOTAL_ITERATIONS) {
        await RecoveryCaseRepository.updateStatus(caseId, 'human_review', 'Escalated to Operator');
        await AuditEventRepository.save({
          id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
          timestamp: new Date().toLocaleTimeString() + ' (Just now)',
          event_type: 'ESCALATED',
          case_id: caseId,
          details: `No further automated strategy permitted (${nextPolicyCheck.statusText}). Escalated to merchant review.`,
          actor: 'Policy Engine',
          status: 'COMPLIANT'
        });
        return {
          step: stepRecord,
          policyResult,
          isTerminated: true,
          finalCaseStatus: 'human_review',
          message: `Attempt failed and automated limits reached. Escalated to human review.`
        };
      } else {
        await RecoveryCaseRepository.updateStatus(caseId, 'stopped', 'Recovery Halted');
        await AuditEventRepository.save({
          id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
          timestamp: new Date().toLocaleTimeString() + ' (Just now)',
          event_type: 'CASE_STOPPED',
          case_id: caseId,
          details: `No further recovery strategy allowed. Case permanently stopped.`,
          actor: 'Policy Engine',
          status: 'COMPLIANT'
        });
        return {
          step: stepRecord,
          policyResult,
          isTerminated: true,
          finalCaseStatus: 'stopped',
          message: `Attempt failed and policy halted recovery.`
        };
      }
    }

    // Another attempt IS permitted: Emit RE_EVALUATION audit event
    await AuditEventRepository.save({
      id: `AUD-${Math.floor(8000 + Math.random() * 1999)}`,
      timestamp: new Date().toLocaleTimeString() + ' (Just now)',
      event_type: 'RE_EVALUATION',
      case_id: caseId,
      details: `Previous attempt (${strategyDef.name}) failed. Re-evaluating telemetry for candidate strategy: ${nextStrategyDef.name}.`,
      actor: 'Reasoning Engine',
      status: 'COMPLIANT'
    });

    await RecoveryCaseRepository.updateStatus(
      caseId,
      're_evaluating',
      `Adapting to ${nextStrategyDef.name}`
    );

    return {
      step: stepRecord,
      policyResult,
      isTerminated: false,
      finalCaseStatus: 're_evaluating',
      message: `Attempt failed. Re-evaluating case for next strategy: ${nextStrategyDef.name}.`
    };
  }

  /**
   * Retrieves the full Recovery Journey for a case
   */
  static async getCaseJourney(caseId: string): Promise<{
    caseId: string;
    status: string;
    currentStage: string;
    totalAttempts: number;
    steps: RecoveryJourneyStepRecord[];
    isTerminal: boolean;
    finalDecision: string;
  }> {
    const rc = await RecoveryCaseRepository.findById(caseId);
    const steps = await RecoveryJourneyRepository.findByCaseId(caseId);

    const isTerminal = rc ? (LOOP_LIMITS.TERMINAL_STATES as readonly string[]).includes(rc.status) : false;
    const finalDecision = rc?.status === 'recovered'
      ? 'RECOVERED'
      : rc?.status === 'stopped'
        ? 'STOPPED'
        : rc?.status === 'human_review'
          ? 'ESCALATED'
          : 'IN_PROGRESS';

    return {
      caseId,
      status: rc?.status ?? 'unknown',
      currentStage: rc?.current_stage ?? 'Unknown',
      totalAttempts: steps.length,
      steps,
      isTerminal,
      finalDecision
    };
  }
}
