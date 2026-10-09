import { evaluateDeterministicSafetyRules, PolicyEvaluationResult } from './policyEngine';
import { getGuardrailConfig, GuardrailConfig } from './guardrailConfig';
import { GeminiDiagnosisResult } from './geminiService';
import { StrategyRanker } from './strategyRanking';
import { RecoveryStrategyId } from './strategyRegistry';

/**
 * 32-bit Mulberry32 Deterministic Pseudo-Random Number Generator.
 * Given an integer seed, guarantees identical sequence across all platforms and runs.
 */
export function createPrng(seed: number) {
  let s = (seed >>> 0) || 1;
  return function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CustomerTier = 'B2C Customer' | 'B2B Merchant' | 'Enterprise Client';

export interface SyntheticCase {
  id: string; // e.g. REC-SIM-0001
  paymentId: string; // e.g. pay_sim_0001
  amount: number;
  failureType: string;
  failureCode: string;
  paymentMethod: 'UPI' | 'CARD' | 'NETBANKING';
  retryCount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerTier: CustomerTier;
  groundTruthProb: number;
  groundTruthRecoverable: boolean;
  isSynthetic: true;

  // ReviveAI pipeline diagnosis & policy result
  reviveAi: {
    rootCause: string;
    confidence: number;
    recoveryProbability: number;
    recommendedAction: string;
    selectedStrategy?: RecoveryStrategyId;
    strategyScore?: number;
    alternatives?: Array<{
      strategyId: RecoveryStrategyId;
      strategyName: string;
      score: number;
      whyRejected: string;
    }>;
    expectedRecovery: number;
    policyStatus: string;
    isApproved: boolean;
    requiresHumanApproval: boolean;
    isStopped: boolean;
    intervened: boolean;
    recovered: boolean;
    recoveredRevenue: number;
    unnecessaryIntervention: boolean;
  };

  // Naive Baseline evaluation (no policy gating, blind broad retries)
  baseline: {
    action: string;
    intervened: boolean;
    recovered: boolean;
    recoveredRevenue: number;
    unnecessaryIntervention: boolean;
  };
}

export interface StrategyMetrics {
  totalRevenueAtRisk: number;
  expectedRecoverableRevenue: number;
  interventionsAttempted: number;
  successfulRecoveries: number;
  recoveredRevenue: number;
  recoveryRate: number; // 0..1 fraction
  recoveryRatePercent: number; // 0..100
  recoveryRatePerIntervention: number; // 0..1 fraction
  recoveryRatePerInterventionPercent: number; // 0..100
  unnecessaryInterventions: number;
  humanReviewCases: number;
  stoppedCases: number;
  averageRecoveryValue: number;
  policyBlockedValue: number;
}

export interface LiftMetrics {
  recoveredRevenueLift: number;
  revenueLiftPercent: number;
  recoveryRateLiftPercentPoints: number;
  interventionEfficiencyLiftPercent: number;
  unnecessaryInterventionsReduced: number;
}

export interface EvaluationRunResult {
  runId: string;
  createdAt: string;
  seed: number;
  batchSize: number;
  isSynthetic: true;
  disclaimer: string;
  guardrailsSnapshot: GuardrailConfig;
  baseline: StrategyMetrics;
  reviveAi: StrategyMetrics;
  lift: LiftMetrics;
  sampleCases: SyntheticCase[];
  allCases?: SyntheticCase[];
}

const INDIAN_NAMES = [
  'Aarav Sharma', 'Priya Patel', 'Rohan Mehta', 'Ananya Reddy',
  'Vikram Singh', 'Sneha Iyer', 'Kavita Rao', 'Aditya Joshi',
  'Pooja Gupta', 'Arjun Nair', 'Neha Kapoor', 'Rahul Verma',
  'Siddharth Malhotra', 'Meera Sen', 'Karan Bajaj', 'Tanvi Kulkarni',
  'Deepak Bansal', 'Ritu Deshmukh', 'Manish Saxena', 'Divya Pillai'
];

interface FailureArchetype {
  code: string;
  type: string;
  rootCause: string;
  probBase: number;
  recommendedAction: RecoveryStrategyId;
  groundTruthProb: number;
  groundTruthRecoverable: boolean;
  baselineConversionRate: number;
}

const FAILURE_ARCHETYPES: FailureArchetype[] = [
  {
    code: 'BANK_TIMEOUT',
    type: 'temporary_bank_degradation',
    rootCause: 'Temporary Bank Degradation',
    probBase: 0.85,
    recommendedAction: 'smart_retry',
    groundTruthProb: 0.86,
    groundTruthRecoverable: true,
    baselineConversionRate: 0.38
  },
  {
    code: 'GATEWAY_ERROR',
    type: 'gateway_timeout',
    rootCause: 'Temporary Bank Degradation',
    probBase: 0.80,
    recommendedAction: 'delayed_retry',
    groundTruthProb: 0.80,
    groundTruthRecoverable: true,
    baselineConversionRate: 0.42
  },
  {
    code: 'ERR_INSUFFICIENT_FUNDS',
    type: 'insufficient_funds',
    rootCause: 'Insufficient Funds',
    probBase: 0.25,
    recommendedAction: 'stop',
    groundTruthProb: 0.18,
    groundTruthRecoverable: false,
    baselineConversionRate: 0.08
  },
  {
    code: 'LIMIT_EXCEEDED',
    type: 'mandate_limit_exceeded',
    rootCause: 'Mandate Limit Exceeded',
    probBase: 0.60,
    recommendedAction: 'human_review',
    groundTruthProb: 0.58,
    groundTruthRecoverable: true,
    baselineConversionRate: 0.22
  },
  {
    code: 'RISK_FLAGGED',
    type: 'suspected_fraud',
    rootCause: 'Blocked by Risk Sentinel',
    probBase: 0.10,
    recommendedAction: 'stop',
    groundTruthProb: 0.02,
    groundTruthRecoverable: false,
    baselineConversionRate: 0.0
  },
  {
    code: 'AUTH_EXPIRED',
    type: 'user_dropoff',
    rootCause: 'Customer Dropoff',
    probBase: 0.50,
    recommendedAction: 'whatsapp_payment_link',
    groundTruthProb: 0.52,
    groundTruthRecoverable: true,
    baselineConversionRate: 0.30
  }
];

/**
 * Deterministically generates and evaluates a batch of synthetic recovery cases.
 */
export function runBatchEvaluation(options?: {
  seed?: number;
  batchSize?: number;
  guardrails?: Partial<GuardrailConfig>;
}): EvaluationRunResult {
  const seed = typeof options?.seed === 'number' && isFinite(options.seed) ? Math.floor(options.seed) : 42;
  const batchSize = typeof options?.batchSize === 'number' && isFinite(options.batchSize)
    ? Math.max(1, Math.floor(options.batchSize))
    : 500;

  const currentGuardrails = getGuardrailConfig();
  const guardrails: GuardrailConfig = options?.guardrails
    ? { ...currentGuardrails, ...options.guardrails }
    : currentGuardrails;

  const prng = createPrng(seed);

  const cases: SyntheticCase[] = [];

  for (let i = 1; i <= batchSize; i++) {
    const padId = String(i).padStart(4, '0');
    const caseId = `REC-SIM-${padId}`;
    const paymentId = `pay_sim_${padId}`;

    // Select customer
    const nameIdx = Math.floor(prng() * INDIAN_NAMES.length);
    const customerName = INDIAN_NAMES[nameIdx];
    const customerEmail = `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    const customerPhone = `+9198${Math.floor(10000000 + prng() * 90000000)}`;

    // Payment method distribution: 70% UPI, 20% CARD, 10% NETBANKING
    const pmRoll = prng();
    const paymentMethod: 'UPI' | 'CARD' | 'NETBANKING' =
      pmRoll < 0.70 ? 'UPI' : pmRoll < 0.90 ? 'CARD' : 'NETBANKING';

    // Amount distribution:
    // 60% low/mid: ₹400 - ₹9,999
    // 25% mid-tier: ₹10,000 - ₹24,999
    // 15% high-value: ₹25,001 - ₹65,000 (crosses the ₹25k guardrail)
    const amtRoll = prng();
    let amount: number;
    let customerTier: CustomerTier;

    if (amtRoll < 0.60) {
      amount = Math.round(400 + prng() * 9599);
      customerTier = 'B2C Customer';
    } else if (amtRoll < 0.85) {
      amount = Math.round(10000 + prng() * 14999);
      customerTier = 'B2B Merchant';
    } else {
      amount = Math.round(25001 + prng() * 39999);
      customerTier = 'Enterprise Client';
    }

    // Failure archetype distribution
    const archRoll = prng();
    let arch: FailureArchetype;
    if (archRoll < 0.35) {
      arch = FAILURE_ARCHETYPES[0]; // BANK_TIMEOUT
    } else if (archRoll < 0.50) {
      arch = FAILURE_ARCHETYPES[1]; // GATEWAY_ERROR
    } else if (archRoll < 0.70) {
      arch = FAILURE_ARCHETYPES[2]; // ERR_INSUFFICIENT_FUNDS
    } else if (archRoll < 0.82) {
      arch = FAILURE_ARCHETYPES[3]; // LIMIT_EXCEEDED
    } else if (archRoll < 0.90) {
      arch = FAILURE_ARCHETYPES[4]; // RISK_FLAGGED
    } else {
      arch = FAILURE_ARCHETYPES[5]; // AUTH_EXPIRED
    }

    // Retry count distribution
    const retryRoll = prng();
    let retryCount = 0;
    if (retryRoll >= 0.65 && retryRoll < 0.85) {
      retryCount = 1;
    } else if (retryRoll >= 0.85 && retryRoll < 0.93) {
      retryCount = 2;
    } else if (retryRoll >= 0.93) {
      retryCount = 3 + (prng() < 0.3 ? 1 : 0);
    }

    // Ground truth probability around base
    const probJitter = (prng() - 0.5) * 0.08;
    const groundTruthProb = Math.min(0.98, Math.max(0.01, arch.groundTruthProb + probJitter));
    const groundTruthRecoverable = arch.groundTruthRecoverable;

    // --- ReviveAI Diagnosis Parameters ---
    const diagnosisConfidence = Math.min(0.99, Math.max(0.75, 0.90 + (prng() - 0.5) * 0.1));
    const reviveAiProb = Math.min(0.95, Math.max(0.05, arch.probBase + (prng() - 0.5) * 0.06));
    const expectedRecovery = Math.round(amount * reviveAiProb);

    // --- Context-Aware Canonical Strategy Ranking ---
    const strategyDecision = StrategyRanker.rankStrategies({
      failureCode: arch.code,
      amount,
      history: retryCount > 0 ? Array.from({ length: retryCount }, (_, idx) => ({
        attempt_number: idx + 1,
        strategy_id: 'smart_retry',
        action_status: 'executed',
        outcome: 'failure'
      })) : [],
      diagnosis: {
        recoveryProbability: reviveAiProb,
        confidence: diagnosisConfidence,
        rootCause: arch.rootCause
      },
      guardrails,
      customer: {
        name: customerName,
        phone: customerPhone,
        retryCount
      }
    });

    const selectedStrategy = strategyDecision.selectedStrategy;

    const diagnosis: GeminiDiagnosisResult = {
      rootCause: arch.rootCause,
      confidence: diagnosisConfidence,
      recoveryProbability: reviveAiProb,
      recommendedAction: selectedStrategy,
      expectedRecovery,
      reasoning: strategyDecision.reasoning,
      evidence: strategyDecision.evidence
    };

    // --- ReviveAI Policy Engine ---
    const policyResult: PolicyEvaluationResult = evaluateDeterministicSafetyRules(
      amount,
      retryCount,
      diagnosis,
      false, // isDuplicateActive
      guardrails
    );

    let reviveAiIntervened = false;
    let reviveAiRecovered = false;
    let reviveAiRecoveredRevenue = 0;
    let reviveAiUnnecessary = false;

    if (policyResult.isApproved) {
      reviveAiIntervened = true;
      const outcomeRoll = prng();
      if (outcomeRoll < groundTruthProb && groundTruthRecoverable) {
        reviveAiRecovered = true;
        reviveAiRecoveredRevenue = amount;
      } else {
        reviveAiRecovered = false;
        reviveAiRecoveredRevenue = 0;
        if (!groundTruthRecoverable) {
          reviveAiUnnecessary = true;
        }
      }
    } else if (policyResult.isStopped) {
      reviveAiIntervened = false;
      reviveAiRecovered = false;
      reviveAiRecoveredRevenue = 0;
      reviveAiUnnecessary = false;
    } else if (policyResult.requiresHumanApproval) {
      reviveAiIntervened = false;
      reviveAiRecovered = false;
      reviveAiRecoveredRevenue = 0;
      reviveAiUnnecessary = false;
    }

    // --- Naive Baseline Strategy ---
    const baselineInterveneRoll = prng();
    const baselineIntervened = baselineInterveneRoll < 0.96;
    let baselineRecovered = false;
    let baselineRecoveredRevenue = 0;
    let baselineUnnecessary = false;

    if (baselineIntervened) {
      if (!groundTruthRecoverable) {
        baselineUnnecessary = true;
        baselineRecovered = false;
        baselineRecoveredRevenue = 0;
      } else {
        const baselineRoll = prng();
        if (baselineRoll < arch.baselineConversionRate) {
          baselineRecovered = true;
          baselineRecoveredRevenue = amount;
        } else {
          baselineRecovered = false;
          baselineRecoveredRevenue = 0;
        }
      }
    }

    cases.push({
      id: caseId,
      paymentId,
      amount,
      failureType: arch.type,
      failureCode: arch.code,
      paymentMethod,
      retryCount,
      customerName,
      customerEmail,
      customerPhone,
      customerTier,
      groundTruthProb: Math.round(groundTruthProb * 100) / 100,
      groundTruthRecoverable,
      isSynthetic: true,
      reviveAi: {
        rootCause: arch.rootCause,
        confidence: Math.round(diagnosisConfidence * 100) / 100,
        recoveryProbability: Math.round(reviveAiProb * 100) / 100,
        recommendedAction: selectedStrategy,
        selectedStrategy: selectedStrategy,
        strategyScore: strategyDecision.score,
        alternatives: strategyDecision.alternatives,
        expectedRecovery,
        policyStatus: policyResult.statusText,
        isApproved: policyResult.isApproved,
        requiresHumanApproval: policyResult.requiresHumanApproval,
        isStopped: policyResult.isStopped,
        intervened: reviveAiIntervened,
        recovered: reviveAiRecovered,
        recoveredRevenue: reviveAiRecoveredRevenue,
        unnecessaryIntervention: reviveAiUnnecessary
      },
      baseline: {
        action: baselineIntervened ? 'Blind Direct Retry / Blast' : 'None',
        intervened: baselineIntervened,
        recovered: baselineRecovered,
        recoveredRevenue: baselineRecoveredRevenue,
        unnecessaryIntervention: baselineUnnecessary
      }
    });
  }

  // Calculate Metrics directly from evaluated batch
  const baselineMetrics = computeStrategyMetrics(cases, false);
  const reviveAiMetrics = computeStrategyMetrics(cases, true);
  const liftMetrics = computeLiftMetrics(reviveAiMetrics, baselineMetrics);

  const runId = `RUN-EVAL-${Date.now()}`;
  const createdAt = new Date().toISOString();

  return {
    runId,
    createdAt,
    seed,
    batchSize,
    isSynthetic: true,
    disclaimer: 'Batch evaluation uses reproducible synthetic data and does not represent live merchant revenue.',
    guardrailsSnapshot: guardrails,
    baseline: baselineMetrics,
    reviveAi: reviveAiMetrics,
    lift: liftMetrics,
    sampleCases: cases.slice(0, 50),
    allCases: cases
  };
}

export function computeStrategyMetrics(cases: SyntheticCase[], isReviveAi: boolean): StrategyMetrics {
  const totalRevenueAtRisk = cases.reduce((acc, c) => acc + c.amount, 0);
  const expectedRecoverableRevenue = cases.reduce((acc, c) => {
    return acc + (isReviveAi ? c.reviveAi.expectedRecovery : Math.round(c.amount * 0.45));
  }, 0);

  let interventionsAttempted = 0;
  let successfulRecoveries = 0;
  let recoveredRevenue = 0;
  let unnecessaryInterventions = 0;
  let humanReviewCases = 0;
  let stoppedCases = 0;
  let policyBlockedValue = 0;

  for (const c of cases) {
    if (isReviveAi) {
      if (c.reviveAi.intervened) interventionsAttempted++;
      if (c.reviveAi.recovered) {
        successfulRecoveries++;
        recoveredRevenue += c.amount;
      }
      if (c.reviveAi.unnecessaryIntervention) unnecessaryInterventions++;
      if (c.reviveAi.requiresHumanApproval) humanReviewCases++;
      if (c.reviveAi.isStopped) {
        stoppedCases++;
        policyBlockedValue += c.amount;
      }
    } else {
      if (c.baseline.intervened) interventionsAttempted++;
      if (c.baseline.recovered) {
        successfulRecoveries++;
        recoveredRevenue += c.amount;
      }
      if (c.baseline.unnecessaryIntervention) unnecessaryInterventions++;
    }
  }

  const totalCases = cases.length;
  const recoveryRate = totalCases > 0 ? successfulRecoveries / totalCases : 0;
  const recoveryRatePercent = Math.round(recoveryRate * 1000) / 10;

  const recoveryRatePerIntervention = interventionsAttempted > 0
    ? successfulRecoveries / interventionsAttempted
    : 0;
  const recoveryRatePerInterventionPercent = Math.round(recoveryRatePerIntervention * 1000) / 10;

  const averageRecoveryValue = successfulRecoveries > 0
    ? Math.round(recoveredRevenue / successfulRecoveries)
    : 0;

  return {
    totalRevenueAtRisk,
    expectedRecoverableRevenue,
    interventionsAttempted,
    successfulRecoveries,
    recoveredRevenue,
    recoveryRate: Math.round(recoveryRate * 10000) / 10000,
    recoveryRatePercent,
    recoveryRatePerIntervention: Math.round(recoveryRatePerIntervention * 10000) / 10000,
    recoveryRatePerInterventionPercent,
    unnecessaryInterventions,
    humanReviewCases,
    stoppedCases,
    averageRecoveryValue,
    policyBlockedValue
  };
}

export function computeLiftMetrics(reviveAi: StrategyMetrics, baseline: StrategyMetrics): LiftMetrics {
  const recoveredRevenueLift = reviveAi.recoveredRevenue - baseline.recoveredRevenue;

  const revenueLiftPercent = baseline.recoveredRevenue > 0
    ? Math.round(((reviveAi.recoveredRevenue - baseline.recoveredRevenue) / baseline.recoveredRevenue) * 1000) / 10
    : 0;

  const recoveryRateLiftPercentPoints = Math.round((reviveAi.recoveryRatePercent - baseline.recoveryRatePercent) * 10) / 10;

  const interventionEfficiencyLiftPercent = baseline.recoveryRatePerInterventionPercent > 0
    ? Math.round(((reviveAi.recoveryRatePerInterventionPercent - baseline.recoveryRatePerInterventionPercent) / baseline.recoveryRatePerInterventionPercent) * 1000) / 10
    : 0;

  const unnecessaryInterventionsReduced = baseline.unnecessaryInterventions - reviveAi.unnecessaryInterventions;

  return {
    recoveredRevenueLift,
    revenueLiftPercent,
    recoveryRateLiftPercentPoints,
    interventionEfficiencyLiftPercent,
    unnecessaryInterventionsReduced
  };
}
