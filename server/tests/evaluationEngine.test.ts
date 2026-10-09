import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  runBatchEvaluation,
  computeStrategyMetrics,
  computeLiftMetrics,
  createPrng,
  SyntheticCase
} from '../services/evaluationEngine';

describe('Batch Recovery Evaluation Engine (Track 03)', () => {

  // 1. Deterministic Seed
  test('1. Deterministic Seed: identical seed produces identical results', () => {
    const run1 = runBatchEvaluation({ seed: 42, batchSize: 100 });
    const run2 = runBatchEvaluation({ seed: 42, batchSize: 100 });

    assert.equal(run1.baseline.totalRevenueAtRisk, run2.baseline.totalRevenueAtRisk);
    assert.equal(run1.baseline.recoveredRevenue, run2.baseline.recoveredRevenue);
    assert.equal(run1.reviveAi.recoveredRevenue, run2.reviveAi.recoveredRevenue);
    assert.equal(run1.reviveAi.successfulRecoveries, run2.reviveAi.successfulRecoveries);
    assert.equal(run1.lift.recoveredRevenueLift, run2.lift.recoveredRevenueLift);

    // Different seed produces different deterministic sequence
    const runDiff = runBatchEvaluation({ seed: 999, batchSize: 100 });
    assert.notEqual(run1.reviveAi.totalRevenueAtRisk, runDiff.reviveAi.totalRevenueAtRisk);
  });

  // 2. Batch Size
  test('2. Batch Size: respects requested batch size of at least 500 cases', () => {
    const run500 = runBatchEvaluation({ seed: 42, batchSize: 500 });
    assert.equal(run500.batchSize, 500);
    assert.equal(run500.allCases?.length, 500);

    const run1000 = runBatchEvaluation({ seed: 42, batchSize: 1000 });
    assert.equal(run1000.batchSize, 1000);
    assert.equal(run1000.allCases?.length, 1000);
  });

  // 3. Metric Calculations
  test('3. Metric Calculations: metrics accurately match sum of generated cases', () => {
    const run = runBatchEvaluation({ seed: 42, batchSize: 500 });
    const cases = run.allCases!;

    // Total revenue at risk equals sum of all case amounts
    const sumAtRisk = cases.reduce((acc, c) => acc + c.amount, 0);
    assert.equal(run.reviveAi.totalRevenueAtRisk, sumAtRisk);
    assert.equal(run.baseline.totalRevenueAtRisk, sumAtRisk);

    // Recovery rate equals successful recoveries / batch size
    const expectedReviveRate = cases.filter(c => c.reviveAi.recovered).length / cases.length;
    assert.equal(run.reviveAi.recoveryRate, Math.round(expectedReviveRate * 10000) / 10000);

    // Recovery rate per intervention equals recoveries / interventions
    const interventions = cases.filter(c => c.reviveAi.intervened).length;
    const recoveries = cases.filter(c => c.reviveAi.recovered).length;
    const expectedEfficiency = recoveries / interventions;
    assert.equal(run.reviveAi.recoveryRatePerIntervention, Math.round(expectedEfficiency * 10000) / 10000);

    // Average recovery value equals recovered revenue / successful recoveries
    const expectedAvg = Math.round(run.reviveAi.recoveredRevenue / recoveries);
    assert.equal(run.reviveAi.averageRecoveryValue, expectedAvg);
  });

  // 4. Baseline Calculation
  test('4. Baseline Calculation: naive strategy attempts broad recovery without policy gating', () => {
    const run = runBatchEvaluation({ seed: 42, batchSize: 500 });

    // Baseline has NO policy engine, so stoppedCases = 0 and humanReviewCases = 0
    assert.equal(run.baseline.stoppedCases, 0);
    assert.equal(run.baseline.humanReviewCases, 0);

    // Baseline attempts intervention broadly
    assert.ok(run.baseline.interventionsAttempted > 450);

    // Baseline incurs unnecessary interventions on unrecoverable/fraud cases
    assert.ok(run.baseline.unnecessaryInterventions > 0);

    // Baseline recovered revenue strictly equals sum of its recovered cases
    const baselineSum = run.allCases!
      .filter(c => c.baseline.recovered)
      .reduce((acc, c) => acc + c.amount, 0);
    assert.equal(run.baseline.recoveredRevenue, baselineSum);
  });

  // 5. ReviveAI Calculation
  test('5. ReviveAI Calculation: uses intelligent diagnosis, guardrails and policy gating', () => {
    const run = runBatchEvaluation({ seed: 42, batchSize: 500 });

    // ReviveAI protects merchant: stopped cases > 0 (fraud, low prob, retry limits)
    assert.ok(run.reviveAi.stoppedCases > 0);

    // ReviveAI flags high-ticket cases (> ₹25,000) for human review
    assert.ok(run.reviveAi.humanReviewCases > 0);

    // Policy blocked value equals sum of stopped case amounts
    const stoppedSum = run.allCases!
      .filter(c => c.reviveAi.isStopped)
      .reduce((acc, c) => acc + c.amount, 0);
    assert.equal(run.reviveAi.policyBlockedValue, stoppedSum);

    // ReviveAI has significantly fewer unnecessary interventions than baseline
    assert.ok(run.reviveAi.unnecessaryInterventions < run.baseline.unnecessaryInterventions);
  });

  // 6. No Division-by-Zero
  test('6. No Division-by-Zero: handles empty or zero-recovery datasets safely', () => {
    const emptyMetricsRevive = computeStrategyMetrics([], true);
    assert.equal(emptyMetricsRevive.recoveryRate, 0);
    assert.equal(emptyMetricsRevive.recoveryRatePercent, 0);
    assert.equal(emptyMetricsRevive.recoveryRatePerIntervention, 0);
    assert.equal(emptyMetricsRevive.averageRecoveryValue, 0);
    assert.equal(Number.isNaN(emptyMetricsRevive.recoveryRate), false);

    const emptyMetricsBaseline = computeStrategyMetrics([], false);
    assert.equal(emptyMetricsBaseline.recoveryRate, 0);
    assert.equal(Number.isNaN(emptyMetricsBaseline.recoveryRate), false);

    const liftEmpty = computeLiftMetrics(emptyMetricsRevive, emptyMetricsBaseline);
    assert.equal(liftEmpty.revenueLiftPercent, 0);
    assert.equal(liftEmpty.interventionEfficiencyLiftPercent, 0);
    assert.equal(Number.isNaN(liftEmpty.revenueLiftPercent), false);
    assert.equal(Number.isNaN(liftEmpty.interventionEfficiencyLiftPercent), false);
  });

  // 7. No Fabricated Recovered Revenue
  test('7. No Fabricated Recovered Revenue: recovered revenue strictly bounded and verifiable', () => {
    const run = runBatchEvaluation({ seed: 42, batchSize: 500 });
    const cases = run.allCases!;

    // Recovered revenue cannot exceed total revenue at risk
    assert.ok(run.reviveAi.recoveredRevenue <= run.reviveAi.totalRevenueAtRisk);
    assert.ok(run.baseline.recoveredRevenue <= run.baseline.totalRevenueAtRisk);

    // Every single rupee in reviveAi.recoveredRevenue is directly traced to a verified case
    let manualSum = 0;
    for (const c of cases) {
      if (c.reviveAi.recovered) {
        manualSum += c.amount;
        // Case must have been approved and intervened
        assert.equal(c.reviveAi.isApproved, true);
        assert.equal(c.reviveAi.intervened, true);
        // Case must NOT have been stopped or in human review
        assert.equal(c.reviveAi.isStopped, false);
        assert.equal(c.reviveAi.requiresHumanApproval, false);
      } else {
        assert.equal(c.reviveAi.recoveredRevenue, 0);
      }
    }
    assert.equal(run.reviveAi.recoveredRevenue, manualSum);
  });

  // 8. Evaluation Reproducibility
  test('8. Evaluation Reproducibility: consecutive runs yield exact case-by-case match', () => {
    const runA = runBatchEvaluation({ seed: 42, batchSize: 500 });
    const runB = runBatchEvaluation({ seed: 42, batchSize: 500 });

    assert.equal(runA.allCases!.length, runB.allCases!.length);

    for (let i = 0; i < runA.allCases!.length; i++) {
      const caseA = runA.allCases![i];
      const caseB = runB.allCases![i];

      assert.equal(caseA.id, caseB.id);
      assert.equal(caseA.amount, caseB.amount);
      assert.equal(caseA.failureCode, caseB.failureCode);
      assert.equal(caseA.retryCount, caseB.retryCount);
      assert.equal(caseA.groundTruthProb, caseB.groundTruthProb);
      assert.equal(caseA.reviveAi.policyStatus, caseB.reviveAi.policyStatus);
      assert.equal(caseA.reviveAi.recovered, caseB.reviveAi.recovered);
      assert.equal(caseA.baseline.recovered, caseB.baseline.recovered);
    }
  });
});
