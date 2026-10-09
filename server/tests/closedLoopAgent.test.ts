import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../db';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { AuditEventRepository } from '../repositories/auditEventRepository';
import { RecoveryJourneyRepository } from '../repositories/recoveryJourneyRepository';
import { IdempotencyRepository } from '../repositories/idempotencyRepository';
import { FinancialSafetyService } from '../services/financialSafetyService';
import { ClosedLoopAgent, LOOP_LIMITS } from '../services/closedLoopAgent';
import { STRATEGY_REGISTRY, isValidStrategyId } from '../services/strategyRegistry';

describe('Layer 2: Adaptive Closed-Loop Recovery Agent', () => {
  before(async () => {
    await initDb();
  });

  async function createFixtureCase(caseId: string, amount: number = 5000, failureCode: string = 'BANK_TIMEOUT') {
    const txId = `tx_${caseId}`;
    const now = new Date().toISOString();

    await TransactionRepository.save({
      id: txId,
      order_id: `ord_${caseId}`,
      amount,
      currency: 'INR',
      customer_name: 'Aditi Verma',
      customer_email: 'aditi@example.com',
      customer_phone: '+919876543210',
      status: 'failed',
      failure_code: failureCode,
      failure_reason: 'Gateway Timeout 504',
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

  // 1. Successful first attempt
  test('1. Successful first attempt: executes policy-approved strategy, verifies outcome, marks RECOVERED and terminates', async () => {
    const caseId = 'TEST-L2-SUCCESS-1';
    await createFixtureCase(caseId, 5000, 'BANK_TIMEOUT');

    const result = await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'whatsapp_payment_link',
      overrideOutcome: 'success'
    });

    assert.equal(result.isTerminated, true);
    assert.equal(result.finalCaseStatus, 'recovered');
    assert.equal(result.step.attempt_number, 1);
    assert.equal(result.step.strategy_id, 'whatsapp_payment_link');
    assert.equal(result.step.outcome, 'success');
    assert.equal(result.step.policy_approved, 1);

    const rc = await RecoveryCaseRepository.findById(caseId);
    assert.equal(rc?.status, 'recovered');

    const journey = await ClosedLoopAgent.getCaseJourney(caseId);
    assert.equal(journey.totalAttempts, 1);
    assert.equal(journey.finalDecision, 'RECOVERED');
    assert.equal(journey.isTerminal, true);

    const auditEvents = await AuditEventRepository.findByCaseId(caseId);
    const eventTypes = auditEvents.map((e) => e.event_type);
    assert.ok(eventTypes.includes('STRATEGY_SELECTED'), 'Should log STRATEGY_SELECTED');
    assert.ok(eventTypes.includes('ACTION_EXECUTED'), 'Should log ACTION_EXECUTED');
    assert.ok(eventTypes.includes('OUTCOME_EVALUATED'), 'Should log OUTCOME_EVALUATED');
    assert.ok(eventTypes.includes('CASE_RECOVERED'), 'Should log CASE_RECOVERED');
  });

  // 2. Failed first attempt followed by valid second strategy
  test('2. Failed first attempt followed by valid second strategy: re-evaluates, adapts strategy, and recovers on attempt 2', async () => {
    const caseId = 'TEST-L2-ADAPTIVE-2';
    await createFixtureCase(caseId, 5000, 'BANK_TIMEOUT');

    // Attempt 1: Smart immediate retry fails due to bank gateway timeout
    const attempt1 = await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'smart_retry',
      overrideOutcome: 'failure',
      failureReason: 'Secondary node timeout 504'
    });

    assert.equal(attempt1.isTerminated, false);
    assert.equal(attempt1.finalCaseStatus, 're_evaluating');
    assert.equal(attempt1.step.attempt_number, 1);
    assert.equal(attempt1.step.strategy_id, 'smart_retry');
    assert.equal(attempt1.step.outcome, 'failure');

    let auditEvents = await AuditEventRepository.findByCaseId(caseId);
    let eventTypes = auditEvents.map((e) => e.event_type);
    assert.ok(eventTypes.includes('OUTCOME_EVALUATED'));
    assert.ok(eventTypes.includes('RE_EVALUATION'));

    // Attempt 2: Reasoning layer adapts strategy to whatsapp_payment_link and succeeds
    const attempt2 = await ClosedLoopAgent.executeStep(caseId, {
      overrideOutcome: 'success'
    });

    assert.equal(attempt2.isTerminated, true);
    assert.equal(attempt2.finalCaseStatus, 'recovered');
    assert.equal(attempt2.step.attempt_number, 2);
    // Verified adaptive switch occurred
    assert.equal(attempt2.step.strategy_id, 'whatsapp_payment_link');
    assert.equal(attempt2.step.outcome, 'success');

    auditEvents = await AuditEventRepository.findByCaseId(caseId);
    eventTypes = auditEvents.map((e) => e.event_type);
    assert.ok(eventTypes.includes('STRATEGY_CHANGED'), 'Should log STRATEGY_CHANGED audit event');
    assert.ok(eventTypes.includes('CASE_RECOVERED'), 'Should log CASE_RECOVERED');

    const journey = await ClosedLoopAgent.getCaseJourney(caseId);
    assert.equal(journey.totalAttempts, 2);
    assert.equal(journey.steps[0].strategy_id, 'smart_retry');
    assert.equal(journey.steps[0].outcome, 'failure');
    assert.equal(journey.steps[1].strategy_id, 'whatsapp_payment_link');
    assert.equal(journey.steps[1].outcome, 'success');
    assert.equal(journey.finalDecision, 'RECOVERED');
  });

  // 3. Retry limit enforcement
  test('3. Retry limit: policy blocks strategy once its maxAttempts is exhausted', async () => {
    const caseId = 'TEST-L2-RETRY-LIMIT-3';
    await createFixtureCase(caseId, 5000, 'BANK_TIMEOUT');

    // delayed_retry has maxAttempts = 1
    const maxAllowed = STRATEGY_REGISTRY['delayed_retry'].maxAttempts;
    assert.equal(maxAllowed, 1);

    // Run first delayed_retry attempt
    await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'delayed_retry',
      overrideOutcome: 'failure'
    });

    // Reset status to re-evaluating so case is not in terminal state
    await RecoveryCaseRepository.updateStatus(caseId, 're_evaluating', 'Testing Limit');

    // Attempting delayed_retry again must be rejected by policy engine
    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    const policyResult = ClosedLoopAgent.evaluatePolicyForStrategy(
      're_evaluating',
      5000,
      'delayed_retry',
      history,
      null
    );

    assert.equal(policyResult.isApproved, false);
    assert.equal(policyResult.isStopped, true);
    assert.ok(policyResult.statusText.includes('Strategy retry limit reached'));
  });

  // 4. Duplicate action prevention (no consecutive identical action)
  test('4. Duplicate action prevention: identical failed strategy cannot be executed back-to-back', async () => {
    const caseId = 'TEST-L2-NO-DUP-4';
    await createFixtureCase(caseId, 5000, 'BANK_TIMEOUT');

    // Attempt 1: smart_retry fails
    await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'smart_retry',
      overrideOutcome: 'failure'
    });

    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    assert.equal(history.length, 1);

    // Attempting smart_retry immediately again must violate consecutive identical rule
    const policyCheck = ClosedLoopAgent.evaluatePolicyForStrategy(
      're_evaluating',
      5000,
      'smart_retry',
      history,
      null
    );

    assert.equal(policyCheck.isApproved, false);
    assert.ok(policyCheck.statusText.includes('Consecutive identical action prohibited'));
    assert.ok(policyCheck.rejectionReason?.includes('Consecutive identical action prohibited'));
  });

  // 5. Terminal-state protection
  test('5. Terminal-state protection: cases in recovered, stopped, or exhausted states strictly reject execution', async () => {
    const caseId = 'TEST-L2-TERMINAL-5';
    await createFixtureCase(caseId, 5000, 'BANK_TIMEOUT');

    // Mark case as recovered (terminal state)
    await RecoveryCaseRepository.updateStatus(caseId, 'recovered', 'Settled');

    await assert.rejects(
      async () => {
        await ClosedLoopAgent.executeStep(caseId, { overrideStrategyId: 'whatsapp_payment_link' });
      },
      /Terminal case in state "recovered" cannot be acted upon again/
    );

    // Test with stopped state as well
    await RecoveryCaseRepository.updateStatus(caseId, 'stopped', 'Halted');
    await assert.rejects(
      async () => {
        await ClosedLoopAgent.executeStep(caseId, { overrideStrategyId: 'smart_retry' });
      },
      /Terminal case in state "stopped" cannot be acted upon again/
    );
  });

  // 6. Policy rejection
  test('6. Policy rejection: action is blocked if recovery probability is below guardrail', async () => {
    const caseId = 'TEST-L2-POLICY-REJECT-6';
    await createFixtureCase(caseId, 5000, 'BANK_TIMEOUT');

    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    const lowProbDiag = {
      rootCause: 'Suspected Bot / Fraud',
      confidence: 0.95,
      recoveryProbability: 0.15, // Below default 0.30 guardrail
      recommendedAction: 'stop' as const,
      expectedRecovery: 750,
      reasoning: 'High risk fingerprint detected',
      evidence: ['Multiple failures across cards']
    };

    const policyCheck = ClosedLoopAgent.evaluatePolicyForStrategy(
      'new',
      5000,
      'whatsapp_payment_link',
      history,
      lowProbDiag,
      {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover'
      }
    );

    assert.equal(policyCheck.isApproved, false);
    assert.equal(policyCheck.isStopped, true);
    assert.ok(policyCheck.statusText.includes('Recovery probability below guardrail'));
  });

  // 7. Human escalation
  test('7. Human escalation: transactions exceeding auto-recovery limit escalate to human_review with ESCALATED audit event', async () => {
    const caseId = 'TEST-L2-ESCALATE-7';
    // Amount ₹60,000 exceeds default ₹25,000 threshold
    await createFixtureCase(caseId, 60000, 'BANK_TIMEOUT');

    const result = await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'whatsapp_payment_link'
    });

    assert.equal(result.isTerminated, true);
    assert.equal(result.finalCaseStatus, 'human_review');
    assert.equal(result.policyResult.requiresHumanApproval, true);
    assert.equal(result.step.action_status, 'skipped');

    const rc = await RecoveryCaseRepository.findById(caseId);
    assert.equal(rc?.status, 'human_review');

    const auditEvents = await AuditEventRepository.findByCaseId(caseId);
    const eventTypes = auditEvents.map((e) => e.event_type);
    assert.ok(eventTypes.includes('ESCALATED'), 'Should emit ESCALATED audit event');
  });

  // 8. Infinite-loop prevention
  test('8. Infinite-loop prevention: agent stops after max iterations (3) and prevents endless cycles', async () => {
    const caseId = 'TEST-L2-LOOP-PREVENT-8';
    await createFixtureCase(caseId, 5000, 'BANK_TIMEOUT');

    // Attempt 1: smart_retry fails
    const step1 = await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'smart_retry',
      overrideOutcome: 'failure'
    });
    assert.equal(step1.isTerminated, false);
    assert.equal(step1.step.attempt_number, 1);

    // Attempt 2: whatsapp_payment_link fails
    const step2 = await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'whatsapp_payment_link',
      overrideOutcome: 'failure'
    });
    assert.equal(step2.isTerminated, false);
    assert.equal(step2.step.attempt_number, 2);

    // Attempt 3: payment_method_update fails (reaches MAX_TOTAL_ITERATIONS)
    const step3 = await ClosedLoopAgent.executeStep(caseId, {
      overrideStrategyId: 'payment_method_update',
      overrideOutcome: 'failure'
    });

    // On 3rd failure, max iterations reached -> MUST terminate with human escalation or stop
    assert.equal(step3.isTerminated, true);
    assert.equal(step3.step.attempt_number, 3);
    assert.ok(['human_review', 'stopped'].includes(step3.finalCaseStatus));

    // Verifying journey
    const journey = await ClosedLoopAgent.getCaseJourney(caseId);
    assert.equal(journey.totalAttempts, 3);
    assert.equal(journey.totalAttempts, LOOP_LIMITS.MAX_TOTAL_ITERATIONS);

    // Attempting a 4th step MUST be rejected
    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    assert.equal(history.length, 3);

    const check4 = ClosedLoopAgent.evaluatePolicyForStrategy(
      're_evaluating',
      5000,
      'delayed_retry',
      history,
      null
    );

    assert.equal(check4.isApproved, false);
    assert.ok(check4.statusText.includes('Iteration budget exhausted') || check4.statusText.includes('BLOCKED'));
  });
});
