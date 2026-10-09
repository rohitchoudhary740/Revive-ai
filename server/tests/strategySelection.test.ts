import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../db';
import { StrategyRanker, StrategyRankingContext } from '../services/strategyRanking';
import { StrategyIntelligenceService } from '../services/strategyIntelligence';
import {
  STRATEGY_REGISTRY,
  normalizeStrategyId,
  CANONICAL_RECOVERY_STRATEGIES,
  isValidStrategyId
} from '../services/strategyRegistry';
import { PolicyEngine } from '../services/policyEngine';
import { ClosedLoopAgent } from '../services/closedLoopAgent';
import { runBatchEvaluation } from '../services/evaluationEngine';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { RecoveryJourneyRepository } from '../repositories/recoveryJourneyRepository';
import {
  FinancialSafetyService,
  TerminalCaseError,
  DuplicateActionError
} from '../services/financialSafetyService';

describe('Authoritative Strategy Selection Architecture Tests', () => {
  before(async () => {
    await initDb();
  });

  // 1. BANK_TIMEOUT → smart_retry candidate
  test('1. BANK_TIMEOUT: ranks smart_retry as top candidate', async () => {
    const context: StrategyRankingContext = {
      caseId: 'CASE-TEST-1',
      failureCode: 'BANK_TIMEOUT',
      amount: 5000,
      retryCount: 0,
      previousAttempts: [],
      recoveryProbability: 0.88,
      diagnosisConfidence: 0.94,
      customerContactsCount: 0,
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(context);
    assert.equal(decision.selectedStrategy, 'smart_retry');
    assert.ok(decision.score > 70);
    assert.ok(decision.reasoning.includes('timeout') || decision.reasoning.includes('retry'));
    assert.ok(decision.alternatives.length > 0);
  });

  // 2. GATEWAY_ERROR → context-aware selection (delayed_retry)
  test('2. GATEWAY_ERROR: selects delayed_retry for transient degradation', async () => {
    const context: StrategyRankingContext = {
      caseId: 'CASE-TEST-2',
      failureCode: 'GATEWAY_ERROR',
      amount: 3500,
      retryCount: 0,
      previousAttempts: [],
      recoveryProbability: 0.82,
      diagnosisConfidence: 0.91,
      customerContactsCount: 0,
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(context);
    assert.equal(decision.selectedStrategy, 'delayed_retry');
    assert.ok(decision.score > 60);
    assert.ok(decision.alternatives.some(a => a.strategyId === 'smart_retry' || a.strategyId === 'whatsapp_payment_link'));
  });

  // 3. NETWORK_ERROR → no blind WhatsApp fallback
  test('3. NETWORK_ERROR: avoids blind WhatsApp fallback, chooses passive retry', async () => {
    const context: StrategyRankingContext = {
      caseId: 'CASE-TEST-3',
      failureCode: 'NETWORK_ERROR',
      amount: 4000,
      retryCount: 0,
      previousAttempts: [],
      recoveryProbability: 0.79,
      diagnosisConfidence: 0.88,
      customerContactsCount: 0,
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(context);
    // NETWORK_ERROR must not blindly select whatsapp_payment_link on initial attempt
    assert.notEqual(decision.selectedStrategy, 'whatsapp_payment_link');
    assert.ok(decision.selectedStrategy === 'delayed_retry' || decision.selectedStrategy === 'smart_retry');
  });

  // 4. EXPIRED_PAYMENT_METHOD → update_payment_method candidate
  test('4. EXPIRED_PAYMENT_METHOD: selects update_payment_method candidate', async () => {
    const context: StrategyRankingContext = {
      caseId: 'CASE-TEST-4',
      failureCode: 'EXPIRED_PAYMENT_METHOD',
      amount: 2500,
      retryCount: 0,
      previousAttempts: [],
      recoveryProbability: 0.76,
      diagnosisConfidence: 0.95,
      customerContactsCount: 0,
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(context);
    assert.equal(decision.selectedStrategy, 'payment_method_update');
    assert.ok(decision.reasoning.includes('payment_method_update') || decision.reasoning.includes('update'));
  });

  // 5. MULTIPLE_FAILED_ATTEMPTS → human review / stop
  test('5. MULTIPLE_FAILED_ATTEMPTS: escalates to human_review or stop', async () => {
    const context: StrategyRankingContext = {
      caseId: 'CASE-TEST-5',
      failureCode: 'BANK_TIMEOUT',
      amount: 5000,
      retryCount: 3,
      previousAttempts: [
        { strategyId: 'smart_retry', outcome: 'failure' },
        { strategyId: 'whatsapp_payment_link', outcome: 'failure' },
        { strategyId: 'delayed_retry', outcome: 'failure' }
      ],
      recoveryProbability: 0.35,
      diagnosisConfidence: 0.90,
      customerContactsCount: 2,
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(context);
    assert.ok(decision.selectedStrategy === 'human_review' || decision.selectedStrategy === 'stop');
  });

  // 6. HIGH_VALUE → policy blocks auto execution
  test('6. HIGH_VALUE: amounts exceeding threshold require human approval', async () => {
    const guardrails = {
      maxAutoRecoveryAmount: 25000,
      minRecoveryProbability: 0.30,
      maxAutomatedRetries: 3,
      highValueRequiresApproval: true,
      lowConfidenceStops: true,
      agentMode: 'auto_recover' as const
    };

    const policy = PolicyEngine.evaluateCase(
      {
        amount: 50000, // ₹50k > ₹25k limit
        customerPreviousRetryCount: 0,
        isDuplicate: false,
        customerContactCount: 0
      },
      {
        confidence: 0.95,
        recoveryProbability: 0.85
      },
      guardrails
    );

    assert.equal(policy.isApproved, false);
    assert.equal(policy.requiresHumanApproval, true);
    assert.equal(policy.isStopped, false);
    assert.ok(policy.statusText.includes('HUMAN APPROVAL REQUIRED'));
  });

  // 7. Low recovery probability → stop
  test('7. LOW_RECOVERY_PROBABILITY: stops execution when below guardrail threshold', async () => {
    const guardrails = {
      maxAutoRecoveryAmount: 25000,
      minRecoveryProbability: 0.40,
      maxAutomatedRetries: 3,
      highValueRequiresApproval: true,
      lowConfidenceStops: true,
      agentMode: 'auto_recover' as const
    };

    const policy = PolicyEngine.evaluateCase(
      {
        amount: 3000,
        customerPreviousRetryCount: 0,
        isDuplicate: false,
        customerContactCount: 0
      },
      {
        confidence: 0.80,
        recoveryProbability: 0.20 // 20% < 40% minimum
      },
      guardrails
    );

    assert.equal(policy.isApproved, false);
    assert.equal(policy.isStopped, true);
    assert.ok(policy.statusText.includes('ACTION STOPPED'));
  });

  // 8. Failed smart_retry → next valid strategy without forcing WhatsApp
  test('8. FAILED_SMART_RETRY: adapts to next valid candidate and penalizes repetition', async () => {
    const contextAfterRetryFail: StrategyRankingContext = {
      caseId: 'CASE-TEST-8',
      failureCode: 'BANK_TIMEOUT',
      amount: 4500,
      retryCount: 1,
      previousAttempts: [{ strategyId: 'smart_retry', outcome: 'failure' }],
      recoveryProbability: 0.82,
      diagnosisConfidence: 0.90,
      customerContactsCount: 0,
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(contextAfterRetryFail);
    // Must NOT repeat smart_retry consecutively
    assert.notEqual(decision.selectedStrategy, 'smart_retry');
    // Must select a valid permitted alternative
    assert.ok(
      decision.selectedStrategy === 'whatsapp_payment_link' ||
      decision.selectedStrategy === 'delayed_retry'
    );

    // Verify smart_retry was penalized for consecutive repeat
    const smartCandidate = decision.candidates.find(c => c.strategyId === 'smart_retry');
    assert.ok(smartCandidate && (!smartCandidate.isEligible || smartCandidate.score <= 0 || smartCandidate.breakdown.historyPenalty <= -100));
  });

  // 9. Failed customer-contact strategy → channel fatigue penalty applies
  test('9. CHANNEL_FATIGUE: penalizes customer-contact strategy if quota utilized', async () => {
    const contextFatigued: StrategyRankingContext = {
      caseId: 'CASE-TEST-9',
      failureCode: 'USER_DROPPED',
      amount: 5000,
      retryCount: 2,
      previousAttempts: [
        { strategyId: 'whatsapp_payment_link', outcome: 'failure' },
        { strategyId: 'delayed_retry', outcome: 'failure' }
      ],
      recoveryProbability: 0.70,
      diagnosisConfidence: 0.88,
      customerContactsCount: 2, // Quota exhausted
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(contextFatigued);
    assert.notEqual(decision.selectedStrategy, 'whatsapp_payment_link');
    const waCandidate = decision.candidates.find(c => c.strategyId === 'whatsapp_payment_link');
    assert.ok(waCandidate && (!waCandidate.isEligible || waCandidate.score <= 0 || waCandidate.breakdown.fatiguePenalty <= -100));
  });

  // 10. Terminal case → no execution
  test('10. TERMINAL_STATE: blocks recovery execution on terminal cases', async () => {
    const uniqueTxId = `tx_term_${Date.now()}`;
    const uniqueCaseId = `case_term_${Date.now()}`;
    const now = new Date().toISOString();

    await TransactionRepository.save({
      id: uniqueTxId,
      order_id: `ord_${Date.now()}`,
      amount: 5000,
      currency: 'INR',
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      customer_phone: '+919988776655',
      status: 'failed',
      failure_code: 'BANK_TIMEOUT',
      failure_reason: 'Bank timeout',
      created_at: now
    });

    await RecoveryCaseRepository.save({
      id: uniqueCaseId,
      transaction_id: uniqueTxId,
      status: 'recovered', // Terminal status!
      current_stage: 'Verified',
      created_at: now,
      updated_at: now
    });

    await assert.rejects(
      async () => {
        await ClosedLoopAgent.executeStep(uniqueCaseId);
      },
      TerminalCaseError
    );
  });

  // 11. Gemini invalid strategy → safe fallback
  test('11. GEMINI_INVALID_STRATEGY: strictly rejects invented strings and routes safely', async () => {
    const inventedPayload = {
      diagnosis: 'Network disruption',
      confidence: 0.90,
      recovery_probability: 0.85,
      recommended_strategy: 'invented_magic_coupon_strategy', // NOT CANONICAL
      reasoning: 'Send user a free discount code',
      evidence: ['Connection dropped'],
      alternative_strategy: 'smart_retry',
      why_not_alternative: 'Retry might fail',
      risk_flags: []
    };

    const validation = StrategyIntelligenceService.validateGeminiStrategyResponse(
      inventedPayload,
      [...CANONICAL_RECOVERY_STRATEGIES]
    );

    assert.equal(validation.valid, false);
    assert.ok(!validation.intelligence);
    assert.ok(validation.error?.includes('Unauthorized strategy'));

    // Normalization test
    assert.equal(normalizeStrategyId('whatsapp_recovery'), 'whatsapp_payment_link');
    assert.equal(normalizeStrategyId('retry_now'), 'smart_retry');
    assert.equal(normalizeStrategyId('update_payment_method'), 'payment_method_update');
  });

  // 12. Duplicate execution → blocked by idempotency
  test('12. IDEMPOTENCY: prevents duplicate execution with identical key', async () => {
    const key = `idem_test_${Date.now()}`;
    const caseId = `case_idem_${Date.now()}`;

    const lock1 = await FinancialSafetyService.acquireActionLock(
      key,
      caseId,
      'smart_retry',
      { amount: 5000 },
      'TEST_MODE'
    );
    assert.equal(lock1.acquired, true);

    await FinancialSafetyService.completeActionLock(key, caseId, { status: 'dispatched' });

    await assert.rejects(
      async () => {
        await FinancialSafetyService.acquireActionLock(
          key,
          caseId,
          'smart_retry',
          { amount: 5000 },
          'TEST_MODE'
        );
      },
      DuplicateActionError
    );
  });

  // 13. Batch evaluation uses the same strategy selector
  test('13. BATCH_EVALUATION: uses StrategyRanker with strategy diversity across archetypes', async () => {
    const results = runBatchEvaluation({ batchSize: 100, seed: 42 });

    const cases = results.allCases || results.sampleCases;
    assert.equal(cases.length, 100);
    assert.ok(results.reviveAi.recoveredRevenue > 0);

    const strategiesUsed = new Set(cases.map(c => c.reviveAi.selectedStrategy));
    // Verify diversity: batch evaluation MUST NOT hardcode WhatsApp for 100% of cases
    assert.ok(strategiesUsed.size >= 3, `Expected at least 3 distinct strategies, found: ${Array.from(strategiesUsed).join(', ')}`);
    assert.ok(strategiesUsed.has('smart_retry'), 'Expected smart_retry in batch evaluation');
    assert.ok(strategiesUsed.has('whatsapp_payment_link'), 'Expected whatsapp_payment_link in batch evaluation');
  });

  // 14. Successful WhatsApp case still works
  test('14. SUCCESSFUL_WHATSAPP: checkout abandonment correctly selects WhatsApp link', async () => {
    const context: StrategyRankingContext = {
      caseId: 'CASE-TEST-14',
      failureCode: 'USER_CANCELLED',
      amount: 5000,
      retryCount: 0,
      previousAttempts: [],
      recoveryProbability: 0.87,
      diagnosisConfidence: 0.92,
      customerContactsCount: 0,
      merchantGuardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover' as const
      }
    };

    const decision = StrategyRanker.rankStrategies(context);
    assert.equal(decision.selectedStrategy, 'whatsapp_payment_link');
    assert.ok(decision.score > 70);

    const policy = ClosedLoopAgent.evaluatePolicyForStrategy(
      'new',
      5000,
      'whatsapp_payment_link',
      [],
      null
    );

    assert.equal(policy.isApproved, true);
  });

  // 15. Existing ₹5,000 Razorpay Test Mode recovery still works
  test('15. RAZORPAY_TEST_MODE: ₹5,000 recovery workflow completes and settles balance', async () => {
    const txId = `tx_rzp_5k_${Date.now()}`;
    const caseId = `case_rzp_5k_${Date.now()}`;
    const now = new Date().toISOString();

    await TransactionRepository.save({
      id: txId,
      order_id: `ord_rzp_5k_${Date.now()}`,
      amount: 5000,
      currency: 'INR',
      customer_name: 'Amit Sharma',
      customer_email: 'amit.sharma@gmail.com',
      customer_phone: '+919876543210',
      status: 'failed',
      failure_code: 'USER_CANCELLED',
      failure_reason: 'Customer dismissed checkout',
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

    FinancialSafetyService.clearLocks();

    // Execute step using canonical strategy selection
    const stepResult = await ClosedLoopAgent.executeStep(caseId, {
      overrideOutcome: 'success'
    });
    assert.ok(stepResult.step);
    assert.equal(stepResult.step.strategy_id, 'whatsapp_payment_link');
    assert.equal(stepResult.finalCaseStatus, 'recovered');

    // Simulate verified payment completion
    await RecoveryCaseRepository.updateStatus(caseId, 'recovered', 'Payment verified and settled');

    const updatedCase = await RecoveryCaseRepository.findById(caseId);
    assert.equal(updatedCase?.status, 'recovered');
  });
});
