/**
 * ReviveAI Layer 5 — Financial Safety and Failure Handling
 * 
 * Strict Execution Safety Invariants:
 * 1. Idempotency: Every recovery action must have a unique idempotency key.
 * 2. Terminal-state protection: RECOVERED, STOPPED, CANCELLED, REJECTED, EXHAUSTED cases cannot execute actions.
 * 3. Amount verification: Recovered amount must match case amount and expected authorized amount.
 * 4. Policy re-check: Before EVERY financial/customer-facing action, re-read policy and revalidate.
 * 5. Stale decision protection: If merchant guardrails changed after diagnosis, invalidate and re-evaluate.
 * 6. Verification timeout: Unverified payment moves to VERIFY_PENDING or HUMAN_REVIEW, never RECOVERED.
 * 7. Duplicate webhook protection: Same webhook event cannot create duplicate recovery results.
 * 8. Graceful external failure: Record failure, do not mark recovered, do not silently retry.
 * 9. Safe AI failure: Gemini failures route safely to human review, never execute unvalidated action.
 * 10. Mode labeling: Clearly indicates DEMO, SIMULATED, TEST_MODE, or LIVE. Never labels Test Mode as real revenue.
 */

import { dbQuery } from '../db';
import { AuditEventRepository } from '../repositories/auditEventRepository';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { IdempotencyRepository, type ExecutionMode, EXECUTION_MODES } from '../repositories/idempotencyRepository';
import { getGuardrailConfig, getGuardrailVersion, GuardrailConfig } from './guardrailConfig';
import { ClosedLoopAgent, ClosedLoopPolicyCheckResult } from './closedLoopAgent';
import { RecoveryStrategyId } from './strategyRegistry';

export { EXECUTION_MODES };
export type { ExecutionMode };

export const TERMINAL_STATES = ['recovered', 'stopped', 'cancelled', 'rejected', 'exhausted'] as const;
export type TerminalState = typeof TERMINAL_STATES[number];

// Custom Error Classes for Clean Testing and Error Handling
export class TerminalCaseError extends Error {
  constructor(public caseId: string, public status: string) {
    super(`Terminal case in state "${status}" cannot be acted upon again. Cannot execute further recovery actions.`);
    this.name = 'TerminalCaseError';
  }
}

export class DuplicateActionError extends Error {
  constructor(public key: string, public caseId: string) {
    super(`Duplicate recovery action blocked: key "${key}" has already executed for case "${caseId}".`);
    this.name = 'DuplicateActionError';
  }
}

export class RetryRaceError extends Error {
  constructor(public caseId: string, public key?: string) {
    super(`Concurrent execution attempt blocked for case "${caseId}". Retry race prevented.`);
    this.name = 'RetryRaceError';
  }
}

export class AmountMismatchError extends Error {
  constructor(public caseId: string, public requested: number, public expected: number) {
    super(`Amount verification failed for case "${caseId}": requested ₹${requested} does not match expected ₹${expected}.`);
    this.name = 'AmountMismatchError';
  }
}

export class PolicyRecheckError extends Error {
  constructor(public caseId: string, public reason: string) {
    super(`Pre-execution policy re-check failed for case "${caseId}": ${reason}`);
    this.name = 'PolicyRecheckError';
  }
}

export class StaleAuthorizationError extends Error {
  constructor(public caseId: string, public authorizedVersion: number, public currentVersion: number) {
    super(`Stale authorization invalidated for case "${caseId}": merchant guardrails updated from v${authorizedVersion} to v${currentVersion}.`);
    this.name = 'StaleAuthorizationError';
  }
}

export class VerificationTimeoutError extends Error {
  constructor(public caseId: string) {
    super(`Payment verification timed out for case "${caseId}". Moving to VERIFY_PENDING.`);
    this.name = 'VerificationTimeoutError';
  }
}

// In-flight execution mutex to prevent concurrent retry races on the same case
const inFlightCases = new Set<string>();

export class FinancialSafetyService {
  /**
   * Resets in-flight locks (useful for test harnesses)
   */
  public static clearLocks(): void {
    inFlightCases.clear();
  }

  /**
   * Formats details string with prominent execution mode label.
   */
  public static tagMode(details: string, mode: ExecutionMode = 'TEST_MODE'): string {
    return `[${mode}] ${details}`;
  }

  /**
   * Persists a mandatory audit event for any safety sentinel block.
   */
  public static async logSafetyBlock(
    caseId: string,
    details: string,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<void> {
    const auditId = `AUD-${Math.floor(8000 + Math.random() * 1999)}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString() + ' (Just now)';

    await AuditEventRepository.save({
      id: auditId,
      timestamp: timeStr,
      event_type: 'SAFETY_BLOCKED',
      case_id: caseId,
      details: this.tagMode(details, mode),
      actor: 'Safety Sentinel',
      status: 'BLOCKED'
    });
  }

  /**
   * 1. Terminal-State Protection:
   * Asserts that a recovery case is actionable and not in a terminal state.
   */
  public static async assertNotTerminal(
    caseId: string,
    status: string,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<void> {
    const normalized = (status || '').toLowerCase().trim();
    if ((TERMINAL_STATES as readonly string[]).includes(normalized)) {
      await this.logSafetyBlock(
        caseId,
        `Terminal case in state "${status}" cannot execute further recovery actions. Execution blocked.`,
        mode
      );
      throw new TerminalCaseError(caseId, status);
    }
  }

  /**
   * 2. Idempotency & Retry Race Protection:
   * Acquires a unique action lock. Rejects duplicate calls and prevents concurrent retry races.
   */
  public static async acquireActionLock(
    idempotencyKey: string,
    caseId: string,
    actionType: string,
    payload?: any,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<{ acquired: boolean }> {
    // Check in-flight mutex for concurrent race
    if (inFlightCases.has(caseId)) {
      await this.logSafetyBlock(
        caseId,
        `Concurrent execution attempt blocked for case "${caseId}". Retry race prevented.`,
        mode
      );
      throw new RetryRaceError(caseId, idempotencyKey);
    }

    // Check DB idempotency record
    const existing = await IdempotencyRepository.findByKey(idempotencyKey);
    if (existing) {
      if (existing.status === 'completed') {
        await this.logSafetyBlock(
          caseId,
          `Duplicate action blocked by idempotency key: "${idempotencyKey}". Action already completed.`,
          mode
        );
        throw new DuplicateActionError(idempotencyKey, caseId);
      }
      if (existing.status === 'in_progress') {
        await this.logSafetyBlock(
          caseId,
          `Concurrent action execution blocked by idempotency key: "${idempotencyKey}". Currently in-progress.`,
          mode
        );
        throw new RetryRaceError(caseId, idempotencyKey);
      }
    }

    // Acquire locks
    inFlightCases.add(caseId);
    await IdempotencyRepository.save({
      key: idempotencyKey,
      case_id: caseId,
      action_type: actionType,
      status: 'in_progress',
      request_payload: payload ? JSON.stringify(payload) : null,
      response_payload: null,
      execution_mode: mode,
      created_at: new Date().toISOString()
    });

    return { acquired: true };
  }

  /**
   * Releases in-flight mutex and marks action idempotency as completed.
   */
  public static async completeActionLock(
    idempotencyKey: string,
    caseId: string,
    responsePayload?: any
  ): Promise<void> {
    inFlightCases.delete(caseId);
    await IdempotencyRepository.markCompleted(idempotencyKey, responsePayload);
  }

  /**
   * Releases in-flight mutex and marks action as failed (allows subsequent bounded strategies).
   */
  public static async releaseActionLock(
    idempotencyKey: string,
    caseId: string,
    errorReason?: string
  ): Promise<void> {
    inFlightCases.delete(caseId);
    await IdempotencyRepository.markFailed(idempotencyKey, errorReason);
  }

  /**
   * 3. Amount Verification:
   * Verifies that the amount being recovered strictly matches the authorized transaction amount.
   */
  public static async verifyAmount(
    caseId: string,
    requestedAmount: number,
    expectedAuthorizedAmount: number,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<void> {
    // Normalize if requestedAmount is in paise (100x expected INR amount)
    const normalizedRequested =
      requestedAmount > expectedAuthorizedAmount &&
      Math.abs(requestedAmount / 100 - expectedAuthorizedAmount) < 0.01
        ? requestedAmount / 100
        : requestedAmount;

    // Rupee comparison (handling float precision)
    if (Math.abs(normalizedRequested - expectedAuthorizedAmount) > 0.01) {
      await this.logSafetyBlock(
        caseId,
        `Amount verification mismatch: requested ₹${requestedAmount.toLocaleString('en-IN')} does not match expected ₹${expectedAuthorizedAmount.toLocaleString('en-IN')}. Action rejected.`,
        mode
      );
      throw new AmountMismatchError(caseId, requestedAmount, expectedAuthorizedAmount);
    }
  }

  /**
   * 4. Policy Re-check:
   * Before EVERY financial/customer-facing action, re-reads current policy and revalidates.
   */
  public static async recheckPolicyBeforeAction(
    caseId: string,
    currentCaseStatus: string,
    amount: number,
    strategyId: RecoveryStrategyId,
    history: any[],
    diagnosis: any,
    mode: ExecutionMode = 'TEST_MODE',
    throwOnReject: boolean = true
  ): Promise<ClosedLoopPolicyCheckResult> {
    // Re-read current guardrails fresh from memory/store
    const currentGuardrails = getGuardrailConfig();

    const policyResult = ClosedLoopAgent.evaluatePolicyForStrategy(
      currentCaseStatus,
      amount,
      strategyId,
      history,
      diagnosis,
      currentGuardrails
    );

    if (!policyResult.isApproved && throwOnReject) {
      const reason = policyResult.rejectionReason || policyResult.statusText;
      await this.logSafetyBlock(
        caseId,
        `Pre-execution policy re-check failed: ${reason}. Action blocked before dispatch.`,
        mode
      );
      throw new PolicyRecheckError(caseId, reason);
    }

    return policyResult;
  }

  /**
   * 5. Stale Decision Protection:
   * Invalidates previously approved decision if merchant guardrails changed after diagnosis.
   */
  public static async assertDecisionNotStale(
    caseId: string,
    authorizedGuardrailVersion: number,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<void> {
    const currentVersion = getGuardrailVersion();
    if (authorizedGuardrailVersion !== currentVersion) {
      await this.logSafetyBlock(
        caseId,
        `Stale decision invalidated: merchant guardrails were updated (v${authorizedGuardrailVersion} -> v${currentVersion}) after diagnosis. Re-evaluation required.`,
        mode
      );
      throw new StaleAuthorizationError(caseId, authorizedGuardrailVersion, currentVersion);
    }
  }

  /**
   * 6. Verification Timeout:
   * If payment result cannot be verified, moves case to VERIFY_PENDING or HUMAN_REVIEW, NEVER RECOVERED.
   */
  public static async handleVerificationTimeout(
    caseId: string,
    stepId?: string,
    actionKey?: string,
    reason?: string,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<{ status: 'verify_pending'; message: string }> {
    if (actionKey) {
      await this.releaseActionLock(actionKey, caseId, reason || 'Verification timeout');
    }
    await RecoveryCaseRepository.updateStatus(
      caseId,
      'verify_pending',
      'Payment Verification Timeout — Held for Settlement Confirmation'
    );

    const detailReason = reason || 'Payment verification timed out';
    await this.logSafetyBlock(
      caseId,
      `Payment verification timed out: ${detailReason}. Case moved to verify_pending. Cannot mark recovered without positive settlement confirmation.`,
      mode
    );

    return {
      status: 'verify_pending',
      message: 'Case moved to verify_pending without marking recovered.'
    };
  }

  /**
   * 7. Duplicate Webhook Protection:
   * Checks if a webhook event ID has already been processed. Rejects duplicate executions.
   */
  public static async isWebhookDuplicate(
    eventId: string,
    caseId?: string,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<boolean> {
    if (!eventId) return false;

    const existing = await dbQuery.get<{ event_id: string }>(
      `SELECT event_id FROM webhooks_received WHERE event_id = ?`,
      [eventId]
    );

    if (existing) {
      await this.logSafetyBlock(
        caseId || 'GLOBAL',
        `Duplicate webhook delivery ignored: event "${eventId}" has already been processed. Duplicate recovery capture prevented.`,
        mode
      );
      return true;
    }

    // Record webhook event as processed
    await dbQuery.run(
      `INSERT OR REPLACE INTO webhooks_received (event_id, case_id, processed_at) VALUES (?, ?, ?)`,
      [eventId, caseId ?? null, new Date().toISOString()]
    );

    return false;
  }

  /**
   * 8. Graceful External Execution Failure:
   * Records gateway failure, ensures case is NOT marked recovered or silently retried.
   */
  public static async handleExternalExecutionFailure(
    caseId: string,
    actionKey: string,
    strategyId: string,
    error: any,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<{ status: 'failed'; recorded: boolean }> {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await this.releaseActionLock(actionKey, caseId, errorMsg);
    await this.logSafetyBlock(
      caseId,
      `External gateway API execution failed for strategy "${strategyId}": ${errorMsg}. Halting silent execution.`,
      mode
    );
    return { status: 'failed', recorded: true };
  }

  /**
   * 9. Safe AI Failure Handling:
   * When Gemini fails, times out, or produces invalid output, routes safely to human review.
   */
  public static async handleSafeAiFailure(
    caseId: string,
    reason: string,
    _context?: any,
    mode: ExecutionMode = 'TEST_MODE'
  ): Promise<{ status: 'human_review'; isEscalated: true; reason: string }> {
    await RecoveryCaseRepository.updateStatus(
      caseId,
      'human_review',
      'AI Analysis Inconclusive — Escalated to Human Review'
    );
    await this.logSafetyBlock(
      caseId,
      `AI intelligence unavailable or invalid (${reason}). Routed safely to human_review fallback.`,
      mode
    );
    return {
      status: 'human_review',
      isEscalated: true,
      reason
    };
  }
}
