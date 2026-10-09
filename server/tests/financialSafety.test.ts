import { test, describe, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { initDb, dbQuery } from '../db';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { AuditEventRepository } from '../repositories/auditEventRepository';
import { RecoveryJourneyRepository } from '../repositories/recoveryJourneyRepository';
import { IdempotencyRepository } from '../repositories/idempotencyRepository';
import {
  FinancialSafetyService,
  TerminalCaseError,
  DuplicateActionError,
  RetryRaceError,
  AmountMismatchError,
  PolicyRecheckError,
  StaleAuthorizationError,
  VerificationTimeoutError,
  TERMINAL_STATES
} from '../services/financialSafetyService';
import {
  getGuardrailConfig,
  updateGuardrailConfig,
  resetGuardrailConfig,
  getGuardrailVersion
} from '../services/guardrailConfig';
import { ClosedLoopAgent } from '../services/closedLoopAgent';
import { StrategyIntelligenceService } from '../services/strategyIntelligence';

describe('Layer 5: Financial Safety & Failure Handling', () => {
  before(async () => {
    await initDb();
  });

  beforeEach(async () => {
    resetGuardrailConfig();
    FinancialSafetyService.clearLocks();
  });

  async function createFixtureCase(caseId: string, amount: number = 5000, failureCode: string = 'BANK_TIMEOUT') {
    const txId = `tx_${caseId}`;
    const now = new Date().toISOString();

    await TransactionRepository.save({
      id: txId,
      order_id: `ord_${caseId}`,
      amount,
      currency: 'INR',
      customer_name: 'Rahul Sharma',
      customer_email: 'rahul@example.com',
      customer_phone: '+919988776655',
      status: 'failed',
      failure_code: failureCode,
      failure_reason: 'Bank Network Timeout',
      created_at: now
    });

    await RecoveryCaseRepository.save({
      id: caseId,
      transaction_id: txId,
      status: 'new',
      current_stage: 'Detected',
      created_at: now,
      updated_at: now
    });

    await RecoveryJourneyRepository.clearByCaseId(caseId);
    await IdempotencyRepository.deleteByCaseId(caseId);
    FinancialSafetyService.clearLocks();
  }

  // 1. Idempotency: Duplicate Action Protection
  test('1. Idempotency: duplicate recovery action with same key cannot execute twice and emits SAFETY_BLOCKED', async () => {
    const caseId = 'TEST-L5-IDEMPOTENCY-1';
    await createFixtureCase(caseId, 5000);

    const actionKey = `act_${caseId}_whatsapp_payment_link_1`;

    // First execution lock acquires successfully
    const lock1 = await FinancialSafetyService.acquireActionLock(
      actionKey,
      caseId,
      'whatsapp_payment_link',
      { amount: 5000 },
      'TEST_MODE'
    );
    assert.equal(lock1.acquired, true);

    // Mark completed
    await FinancialSafetyService.completeActionLock(actionKey, caseId, { status: 'dispatched' });

    // Second execution with identical key MUST throw DuplicateActionError
    await assert.rejects(
      async () => {
        await FinancialSafetyService.acquireActionLock(
          actionKey,
          caseId,
          'whatsapp_payment_link',
          { amount: 5000 },
          'TEST_MODE'
        );
      },
      DuplicateActionError
    );

    // Verify SAFETY_BLOCKED audit event is recorded with mode label
    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.length > 0, 'Must record SAFETY_BLOCKED audit event');
    assert.ok(blockedEvents[0].details.includes('[TEST_MODE]'), 'Audit details must include mode label');
    assert.ok(blockedEvents[0].details.includes(actionKey));
  });

  // 2. Terminal-State Protection
  test('2. Terminal-State Protection: cases in RECOVERED, STOPPED, CANCELLED, or REJECTED cannot execute actions', async () => {
    const caseId = 'TEST-L5-TERMINAL-2';
    await createFixtureCase(caseId, 5000);

    for (const terminalStatus of TERMINAL_STATES) {
      await RecoveryCaseRepository.updateStatus(caseId, terminalStatus, `Terminal: ${terminalStatus}`);

      // Attempting to assert actionable state must throw TerminalCaseError
      await assert.rejects(
        async () => {
          await FinancialSafetyService.assertNotTerminal(caseId, terminalStatus, 'TEST_MODE');
        },
        TerminalCaseError
      );

      // Verify ClosedLoopAgent also blocks execution on terminal case
      await assert.rejects(
        async () => {
          await ClosedLoopAgent.executeStep(caseId, { overrideStrategyId: 'whatsapp_payment_link' });
        },
        TerminalCaseError
      );
    }

    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.length >= TERMINAL_STATES.length, 'Must record SAFETY_BLOCKED for each terminal attempt');
  });

  // 3. Amount Verification
  test('3. Amount Verification: mismatches between requested, case, and authorized amounts are blocked', async () => {
    const caseId = 'TEST-L5-AMOUNT-3';
    await createFixtureCase(caseId, 5000);

    // Exact match passes
    await FinancialSafetyService.verifyAmount(caseId, 5000, 5000, 'TEST_MODE');

    // Mismatched requested amount (₹7,500 vs ₹5,000) throws AmountMismatchError
    await assert.rejects(
      async () => {
        await FinancialSafetyService.verifyAmount(caseId, 7500, 5000, 'TEST_MODE');
      },
      AmountMismatchError
    );

    // Paise vs Rupee mismatch check: 500000 paise (which equals ₹5,000) passes normalized verification
    await FinancialSafetyService.verifyAmount(caseId, 500000, 5000, 'TEST_MODE');

    // Webhook with incorrect amount (₹1,000 vs ₹5,000) is rejected
    await assert.rejects(
      async () => {
        await FinancialSafetyService.verifyAmount(caseId, 1000, 5000, 'TEST_MODE');
      },
      AmountMismatchError
    );

    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.some((e) => e.details.includes('Amount verification mismatch')));
  });

  // 4. Policy Re-check Before Action
  test('4. Policy Re-check: fresh policy re-check blocks action if guardrails tightened prior to dispatch', async () => {
    const caseId = 'TEST-L5-POLICY-RECHECK-4';
    await createFixtureCase(caseId, 5000);

    // Initial check passes under default ₹25,000 auto limit
    const initialCheck = await FinancialSafetyService.recheckPolicyBeforeAction(
      caseId,
      'new',
      5000,
      'whatsapp_payment_link',
      [],
      null,
      'TEST_MODE',
      true
    );
    assert.equal(initialCheck.isApproved, true);

    // Merchant changes guardrail to lower auto limit to ₹2,000
    updateGuardrailConfig({ maxAutoRecoveryAmount: 2000 });

    // Strict policy re-check before dispatch must reject action with PolicyRecheckError
    await assert.rejects(
      async () => {
        await FinancialSafetyService.recheckPolicyBeforeAction(
          caseId,
          'new',
          5000,
          'whatsapp_payment_link',
          [],
          null,
          'TEST_MODE',
          true
        );
      },
      PolicyRecheckError
    );

    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.some((e) => e.details.includes('Pre-execution policy re-check failed')));
  });

  // 5. Stale Decision Protection
  test('5. Stale Decision Protection: invalidates authorization if guardrails changed after diagnosis', async () => {
    const caseId = 'TEST-L5-STALE-DECISION-5';
    await createFixtureCase(caseId, 5000);

    const authorizedVersion = getGuardrailVersion();

    // Guardrail updated by merchant (version increments)
    updateGuardrailConfig({ minRecoveryProbability: 0.50 });
    const currentVersion = getGuardrailVersion();
    assert.ok(currentVersion > authorizedVersion, 'Guardrail version must increment');

    // Attempting to proceed with old authorized version throws StaleAuthorizationError
    await assert.rejects(
      async () => {
        await FinancialSafetyService.assertDecisionNotStale(caseId, authorizedVersion, 'TEST_MODE');
      },
      StaleAuthorizationError
    );

    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.some((e) => e.details.includes('Stale decision invalidated')));
  });

  // 6. Safe AI Failure Handling
  test('6. Safe AI Failure: Gemini unavailable or malformed response routes safely to human_review with risk flags', async () => {
    const caseId = 'TEST-L5-SAFE-AI-6';
    await createFixtureCase(caseId, 5000);

    // Simulate AI failure (e.g. Gemini 503 or malformed payload)
    const result = await FinancialSafetyService.handleSafeAiFailure(
      caseId,
      'Gemini API timeout / quota exceeded (HTTP 503)',
      {
        attemptedStrategy: 'smart_retry',
        rawOutput: 'Malformed Non-JSON response'
      },
      'TEST_MODE'
    );

    assert.equal(result.status, 'human_review');
    assert.equal(result.isEscalated, true);

    // Verify case in database was moved to human_review
    const rc = await RecoveryCaseRepository.findById(caseId);
    assert.equal(rc?.status, 'human_review');

    // Verify audit trail logged SAFETY_BLOCKED and safe fallback
    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.some((e) => e.details.includes('AI intelligence unavailable or invalid')));
  });

  // 7. Verification Timeout Protection
  test('7. Verification Timeout: inconclusive payment verification moves to VERIFY_PENDING, not RECOVERED', async () => {
    const caseId = 'TEST-L5-TIMEOUT-7';
    await createFixtureCase(caseId, 5000);

    const stepId = `STEP-${caseId}-1`;
    const actionKey = `act_${caseId}_smart_retry_1`;

    await FinancialSafetyService.acquireActionLock(actionKey, caseId, 'smart_retry', {}, 'TEST_MODE');

    // Handle verification timeout
    const result = await FinancialSafetyService.handleVerificationTimeout(
      caseId,
      stepId,
      actionKey,
      'Payment verification timed out after 30s. Gateway did not confirm status.',
      'TEST_MODE'
    );

    assert.equal(result.status, 'verify_pending');
    assert.notEqual(result.status, 'recovered', 'Must never mark as recovered on verification timeout');

    // Verify DB case status
    const rc = await RecoveryCaseRepository.findById(caseId);
    assert.equal(rc?.status, 'verify_pending');

    // Verify audit event
    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.some((e) => e.details.includes('Payment verification timed out')));
  });

  // 8. Duplicate Webhook Protection
  test('8. Duplicate Webhook: repeat delivery of identical event ID is safely detected and ignored', async () => {
    const caseId = 'TEST-L5-WEBHOOK-8';
    const eventId = `evt_mock_${Date.now()}_dup_test`;

    // First time: not a duplicate
    const isDup1 = await FinancialSafetyService.isWebhookDuplicate(eventId, caseId, 'TEST_MODE');
    assert.equal(isDup1, false);

    // Second time with same event ID: is duplicate
    const isDup2 = await FinancialSafetyService.isWebhookDuplicate(eventId, caseId, 'TEST_MODE');
    assert.equal(isDup2, true);

    // Verify audit log has SAFETY_BLOCKED for duplicate webhook
    const audits = await AuditEventRepository.findByCaseId(caseId);
    const blockedEvents = audits.filter((a) => a.event_type === 'SAFETY_BLOCKED');
    assert.ok(blockedEvents.some((e) => e.details.includes('Duplicate webhook delivery ignored')));
  });

  // 9. Graceful External Execution Failure
  test('9. External Failure: Razorpay API failure records failure without marking recovered or silently retrying', async () => {
    const caseId = 'TEST-L5-EXT-FAIL-9';
    await createFixtureCase(caseId, 5000);

    const actionKey = `act_${caseId}_smart_retry_1`;
    await FinancialSafetyService.acquireActionLock(actionKey, caseId, 'smart_retry', {}, 'TEST_MODE');

    const result = await FinancialSafetyService.handleExternalExecutionFailure(
      caseId,
      actionKey,
      'smart_retry',
      new Error('Razorpay Gateway 502 Bad Gateway: Downstream switch connection severed'),
      'TEST_MODE'
    );

    assert.equal(result.recorded, true);
    assert.equal(result.status, 'failed');

    // Case should not be marked recovered
    const rc = await RecoveryCaseRepository.findById(caseId);
    assert.notEqual(rc?.status, 'recovered');

    // Idempotency record marked failed
    const idempRecord = await IdempotencyRepository.findByKey(actionKey);
    assert.equal(idempRecord?.status, 'failed');

    // Audit trail has SAFETY_BLOCKED or ACTION_FAILED
    const audits = await AuditEventRepository.findByCaseId(caseId);
    assert.ok(audits.some((a) => a.event_type === 'SAFETY_BLOCKED' || a.event_type === 'ACTION_FAILED'));
  });

  // 10. Retry Race Protection (Concurrent Execution)
  test('10. Retry Race: concurrent execution attempts on same case trigger RetryRaceError and are blocked', async () => {
    const caseId = 'TEST-L5-RACE-10';
    await createFixtureCase(caseId, 5000);

    const actionKey1 = `act_${caseId}_smart_retry_1`;
    const actionKey2 = `act_${caseId}_smart_retry_2`;

    // Thread 1 acquires lock
    await FinancialSafetyService.acquireActionLock(actionKey1, caseId, 'smart_retry', {}, 'TEST_MODE');

    // Thread 2 attempts simultaneous execution on the same case -> must be rejected
    await assert.rejects(
      async () => {
        await FinancialSafetyService.acquireActionLock(actionKey2, caseId, 'smart_retry', {}, 'TEST_MODE');
      },
      RetryRaceError
    );

    // Once Thread 1 completes, lock is released
    await FinancialSafetyService.completeActionLock(actionKey1, caseId);

    // Now another action can safely acquire
    const lock3 = await FinancialSafetyService.acquireActionLock(actionKey2, caseId, 'delayed_retry', {}, 'TEST_MODE');
    assert.equal(lock3.acquired, true);
    await FinancialSafetyService.releaseActionLock(actionKey2, caseId);
  });
});
