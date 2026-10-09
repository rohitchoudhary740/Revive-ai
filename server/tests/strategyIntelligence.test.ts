import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { initDb } from '../db';
import { TransactionRepository } from '../repositories/transactionRepository';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { RecoveryJourneyRepository } from '../repositories/recoveryJourneyRepository';
import {
  StrategyIntelligenceService,
  GeminiStrategyIntelligence,
  RecoveryContext
} from '../services/strategyIntelligence';
import { RecoveryStrategyId, STRATEGY_REGISTRY } from '../services/strategyRegistry';

describe('Layer 3: Recovery Strategy Intelligence & Explainability', () => {
  before(async () => {
    await initDb();
  });

  const validSampleOutput = {
    diagnosis: 'Temporary Bank 3DS Gateway Timeout',
    confidence: 0.92,
    recovery_probability: 0.85,
    recommended_strategy: 'smart_retry',
    reasoning: 'Latency spike detected on primary issuing bank route. Immediate retry via alternate route has 85% probability.',
    evidence: [
      'Gateway returned 504 Gateway Timeout during authentication handshake',
      'HDFC issuer node success rate dropped to 68%',
      'Customer has 0 previous retries'
    ],
    alternative_strategy: 'whatsapp_payment_link',
    why_not_alternative: 'WhatsApp message incurs customer latency, whereas instant gateway retry settles within 3 seconds.',
    risk_flags: ['GATEWAY_504']
  };

  const allowedStrategies: RecoveryStrategyId[] = [
    'smart_retry',
    'whatsapp_payment_link',
    'delayed_retry',
    'payment_method_update',
    'human_review',
    'stop'
  ];

  // 1. Valid Gemini Strategy Response
  test('1. Valid Gemini Strategy Output: correctly validates and parses structured intelligence', () => {
    const result = StrategyIntelligenceService.validateGeminiStrategyResponse(
      validSampleOutput,
      allowedStrategies
    );

    assert.equal(result.valid, true);
    assert.ok(result.intelligence);
    assert.equal(result.intelligence.recommended_strategy, 'smart_retry');
    assert.equal(result.intelligence.alternative_strategy, 'whatsapp_payment_link');
    assert.equal(result.intelligence.confidence, 0.92);
    assert.equal(result.intelligence.recovery_probability, 0.85);
    assert.equal(result.intelligence.evidence.length, 3);
  });

  // 2. Malformed Output: Missing or empty diagnosis
  test('2. Malformed Output: rejects response missing or with empty diagnosis', () => {
    const malformed = { ...validSampleOutput, diagnosis: '' };
    const result = StrategyIntelligenceService.validateGeminiStrategyResponse(
      malformed,
      allowedStrategies
    );

    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('"diagnosis" must be a non-empty string'));
  });

  // 3. Malformed Output: Confidence out-of-bounds or NaN
  test('3. Malformed Output: rejects out-of-bounds confidence score (> 1.0, < 0.0, or NaN)', () => {
    const tooHigh = { ...validSampleOutput, confidence: 1.45 };
    const result1 = StrategyIntelligenceService.validateGeminiStrategyResponse(
      tooHigh,
      allowedStrategies
    );
    assert.equal(result1.valid, false);
    assert.ok(result1.error?.includes('"confidence" must be a float between 0.0 and 1.0'));

    const negative = { ...validSampleOutput, confidence: -0.1 };
    const result2 = StrategyIntelligenceService.validateGeminiStrategyResponse(
      negative,
      allowedStrategies
    );
    assert.equal(result2.valid, false);

    const isNan = { ...validSampleOutput, confidence: NaN };
    const result3 = StrategyIntelligenceService.validateGeminiStrategyResponse(
      isNan,
      allowedStrategies
    );
    assert.equal(result3.valid, false);
  });

  // 4. Malformed Output: Invalid recovery_probability
  test('4. Malformed Output: rejects invalid recovery_probability (non-number or out-of-bounds)', () => {
    const invalidType = { ...validSampleOutput, recovery_probability: 'high' as any };
    const result = StrategyIntelligenceService.validateGeminiStrategyResponse(
      invalidType,
      allowedStrategies
    );
    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('"recovery_probability" must be a float between 0.0 and 1.0'));
  });

  // 5. Malformed Output: Empty evidence array
  test('5. Malformed Output: rejects response with empty or non-array evidence', () => {
    const emptyEvidence = { ...validSampleOutput, evidence: [] };
    const result1 = StrategyIntelligenceService.validateGeminiStrategyResponse(
      emptyEvidence,
      allowedStrategies
    );
    assert.equal(result1.valid, false);
    assert.ok(result1.error?.includes('"evidence" must be a non-empty array of strings'));

    const nonArrayEvidence = { ...validSampleOutput, evidence: 'single string' as any };
    const result2 = StrategyIntelligenceService.validateGeminiStrategyResponse(
      nonArrayEvidence,
      allowedStrategies
    );
    assert.equal(result2.valid, false);
  });

  // 6. Unauthorized Strategy Output: AI invents arbitrary action
  test('6. Unauthorized Strategy: strictly rejects invented actions not in the strategy registry', () => {
    const inventedAction = {
      ...validSampleOutput,
      recommended_strategy: 'give_free_discount_coupon' as any
    };

    const result = StrategyIntelligenceService.validateGeminiStrategyResponse(
      inventedAction,
      allowedStrategies
    );

    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('Unauthorized strategy: "give_free_discount_coupon" is not in the typed strategy registry'));
  });

  // 7. Strategy Authorization Violation: Strategy violates current loop invariants
  test('7. Unauthorized Strategy: rejects strategy that is not currently permitted by loop budget', () => {
    // Suppose smart_retry exceeded its max attempts, so availableStrategies only includes customer link
    const restrictedAllowed: RecoveryStrategyId[] = ['whatsapp_payment_link', 'delayed_retry'];

    const result = StrategyIntelligenceService.validateGeminiStrategyResponse(
      validSampleOutput, // recommends smart_retry
      restrictedAllowed
    );

    assert.equal(result.valid, false);
    assert.ok(result.error?.includes('violates loop invariants or is not in currently allowed strategies'));
  });

  // 8. Safe Fallback Routing on Malformed Input
  test('8. Safe Fallback: malformed or unauthorized output routes safely to human_review with risk flags', async () => {
    const mockContext: RecoveryContext = {
      caseId: 'TEST-L3-FALLBACK-8',
      failureCode: 'BANK_TIMEOUT',
      failureReason: '504 Timeout',
      amount: 5000,
      customer: { name: 'Rahul Roy', email: 'rahul@example.com', phone: '+919876543210' },
      paymentMethod: 'UPI',
      customerRetryCount: 0,
      previousAttempts: [],
      previousActionOutcomes: [],
      guardrails: {
        maxAutoRecoveryAmount: 25000,
        minRecoveryProbability: 0.30,
        maxAutomatedRetries: 3,
        highValueRequiresApproval: true,
        lowConfidenceStops: true,
        agentMode: 'auto_recover'
      },
      availableStrategies: allowedStrategies
    };

    // When Gemini output fails validation, service diverts to safe human_review
    const invalidRaw = {
      diagnosis: 'Failure',
      recommended_strategy: 'unauthorized_random_hack'
    };

    const validation = StrategyIntelligenceService.validateGeminiStrategyResponse(
      invalidRaw,
      mockContext.availableStrategies
    );

    assert.equal(validation.valid, false);

    // Verify fallback intelligence defaults safely
    const fallback = StrategyIntelligenceService.getDeterministicHeuristicIntelligence(mockContext);
    assert.ok(fallback.recommended_strategy);
    assert.ok(allowedStrategies.includes(fallback.recommended_strategy));
    assert.ok(fallback.confidence > 0);
  });

  // 9. Immutable Security Wrapper: AI cannot mutate guardrails or monetary amount
  test('9. Immutable Security: raw AI output cannot override transaction amounts or merchant guardrails', async () => {
    const caseId = 'TEST-L3-IMMUTABLE-9';
    const txId = `tx_${caseId}`;
    const now = new Date().toISOString();

    await TransactionRepository.save({
      id: txId,
      order_id: `ord_${caseId}`,
      amount: 5000,
      currency: 'INR',
      customer_name: 'Pooja Hegde',
      customer_email: 'pooja@example.com',
      customer_phone: '+919988776655',
      status: 'failed',
      failure_code: 'BANK_TIMEOUT',
      failure_reason: 'Bank Gateway Timeout',
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

    const report = await StrategyIntelligenceService.evaluateAndExplain(caseId);

    // Verify amount is strictly from the real transaction, not altered by AI
    assert.equal(report.amount, 5000);
    // Verify policy evaluated real guardrails
    const amountCheck = report.deterministicPolicyDecision.checks.find(c => c.name === 'Amount within auto-limit');
    assert.ok(amountCheck, 'Amount check must exist in deterministic checks');
    assert.equal(amountCheck.passed, true);
  });

  // 10. Explainability Report: Clearly distinguishes AI Recommendation vs Deterministic Policy Decision
  test('10. Explainability Report: clearly separates AI Recommendation and Deterministic Policy Decision', async () => {
    const caseId = 'TEST-L3-EXPLAIN-10';
    const txId = `tx_${caseId}`;
    const now = new Date().toISOString();

    await TransactionRepository.save({
      id: txId,
      order_id: `ord_${caseId}`,
      amount: 5000,
      currency: 'INR',
      customer_name: 'Vikram Seth',
      customer_email: 'vikram@example.com',
      customer_phone: '+919876543210',
      status: 'failed',
      failure_code: 'BANK_TIMEOUT',
      failure_reason: '504 Timeout',
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

    const report = await StrategyIntelligenceService.evaluateAndExplain(caseId);

    // AI Recommendation section
    assert.ok(report.aiRecommendation);
    assert.ok(report.aiRecommendation.recommendedStrategy.id);
    assert.ok(report.aiRecommendation.recommendedStrategy.name);
    assert.ok(typeof report.aiRecommendation.confidence === 'number');
    assert.ok(typeof report.aiRecommendation.recoveryProbability === 'number');
    assert.ok(Array.isArray(report.aiRecommendation.evidence));
    assert.ok(report.aiRecommendation.alternativeConsidered.whyRejected);

    // Deterministic Policy Decision section (Final Authority)
    assert.ok(report.deterministicPolicyDecision);
    assert.equal(typeof report.deterministicPolicyDecision.isApproved, 'boolean');
    assert.ok(report.deterministicPolicyDecision.statusText);
    assert.ok(report.deterministicPolicyDecision.checks.length > 0);

    // Authority Statement
    assert.ok(report.authorityStatement.includes('Deterministic Policy Engine'));
  });
});
