/**
 * Layer 4: Merchant Policy Impact Simulator Tests
 * 
 * Verifies:
 * 1. Simulation CANNOT mutate active guardrails.
 * 2. Simulation is strictly read-only and leaves the database unmutated.
 * 3. Batch evaluation engine calculations drive all comparative metrics accurately.
 * 4. High-value cases correctly transition between review and auto-recovery.
 * 5. Tightening and loosening policy changes reflect truthful safety trade-offs.
 * 6. Disclaimer banner is prominently populated.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { getGuardrailConfig, updateGuardrailConfig, DEFAULT_GUARDRAILS, GuardrailConfig } from '../services/guardrailConfig';
import { PolicySimulatorService } from '../services/policySimulator';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { TransactionRepository } from '../repositories/transactionRepository';

test('Layer 4: Merchant Policy Impact Simulator (Track 03)', async (t) => {
  // Reset guardrails to standard default before test suite
  updateGuardrailConfig(DEFAULT_GUARDRAILS);

  await t.test('1. Security Invariant: simulation CANNOT mutate active policy or active guardrails', async () => {
    const baselineGuardrails = getGuardrailConfig();
    assert.equal(baselineGuardrails.maxAutoRecoveryAmount, 25000);
    assert.equal(baselineGuardrails.minRecoveryProbability, 0.30);
    assert.equal(baselineGuardrails.maxAutomatedRetries, 3);
    assert.equal(baselineGuardrails.agentMode, 'auto_recover');

    // Run simulation with drastically altered temporary parameters
    const simResult = PolicySimulatorService.simulatePolicyImpact(
      {
        maxAutoRecoveryAmount: 50000,
        minRecoveryProbability: 0.10,
        maxAutomatedRetries: 7,
        highValueRequiresApproval: false,
        lowConfidenceStops: false,
        agentMode: 'manual_only'
      },
      { seed: 42, batchSize: 500 }
    );

    // Active guardrails MUST remain strictly untouched
    const currentActive = getGuardrailConfig();
    assert.deepEqual(currentActive, baselineGuardrails, 'Active guardrails were corrupted by simulation!');
    assert.equal(currentActive.maxAutoRecoveryAmount, 25000);
    assert.equal(currentActive.minRecoveryProbability, 0.30);
    assert.equal(currentActive.maxAutomatedRetries, 3);
    assert.equal(currentActive.agentMode, 'auto_recover');

    // Simulated result reflects requested simulation parameters
    assert.equal(simResult.simulatedGuardrails.maxAutoRecoveryAmount, 50000);
    assert.equal(simResult.simulatedGuardrails.minRecoveryProbability, 0.10);
    assert.equal(simResult.simulatedGuardrails.maxAutomatedRetries, 7);
    assert.equal(simResult.simulatedGuardrails.agentMode, 'manual_only');
  });

  await t.test('2. Prominent Disclaimer: response explicitly flags read-only simulation mode', async () => {
    const simResult = PolicySimulatorService.simulatePolicyImpact({
      maxAutoRecoveryAmount: 40000
    });

    assert.equal(simResult.isSimulation, true);
    assert.ok(simResult.disclaimer.includes('SIMULATION — DOES NOT CHANGE ACTIVE POLICY'));
  });

  await t.test('3. Database Invariant: simulation does not create new recovery cases or transactions', async () => {
    const casesBefore = (await RecoveryCaseRepository.findAll()).length;

    PolicySimulatorService.simulatePolicyImpact(
      { maxAutoRecoveryAmount: 100000 },
      { seed: 42, batchSize: 500 }
    );

    const casesAfter = (await RecoveryCaseRepository.findAll()).length;
    assert.equal(casesAfter, casesBefore, 'Simulation created database case records!');
  });

  await t.test('4. Calculation Accuracy: raising auto-limit moves high-value cases from review to automation', async () => {
    // Current auto limit: 25,000 -> Sim limit: 50,000
    const simResult = PolicySimulatorService.simulatePolicyImpact(
      { maxAutoRecoveryAmount: 50000 },
      { seed: 42, batchSize: 500 }
    );

    // Automation eligible cases must increase or remain equal
    assert.ok(simResult.impactDeltas.autoRecoverCases >= 0);
    // Human review cases must decrease correspondingly
    assert.ok(simResult.impactDeltas.humanReviewCases <= 0);
    // highValueMovedToAuto must be tracked
    assert.ok(simResult.impactDeltas.highValueMovedToAuto >= 0);
    // Recovered revenue should be greater than or equal to current policy
    assert.ok(simResult.simulatedPolicy.recoveredRevenue >= simResult.currentPolicy.recoveredRevenue);
  });

  await t.test('5. Calculation Accuracy: tightening auto-limit increases human review safety queue', async () => {
    // Current limit: 25,000 -> Sim limit: 10,000
    const simResult = PolicySimulatorService.simulatePolicyImpact(
      { maxAutoRecoveryAmount: 10000 },
      { seed: 42, batchSize: 500 }
    );

    // More cases must move into human review queue
    assert.ok(simResult.impactDeltas.humanReviewCases > 0);
    // Automated interventions must decrease
    assert.ok(simResult.impactDeltas.autoRecoverCases < 0);
  });

  await t.test('6. Calculation Accuracy: tightening probability threshold reduces low-confidence interventions', async () => {
    // Raise min probability from 30% to 70%
    const simResult = PolicySimulatorService.simulatePolicyImpact(
      { minRecoveryProbability: 0.70 },
      { seed: 42, batchSize: 500 }
    );

    // Interventions attempted should decrease as low-confidence transactions are filtered
    assert.ok(simResult.impactDeltas.interventions <= 0);
    // Stopped cases should increase
    assert.ok(simResult.impactDeltas.stoppedCases >= 0);
  });

  await t.test('7. Agent Mode Simulation: manual_only halts automated interventions', async () => {
    const simResult = PolicySimulatorService.simulatePolicyImpact(
      { agentMode: 'manual_only' },
      { seed: 42, batchSize: 500 }
    );

    // In manual_only mode, auto recovered cases must be 0
    assert.equal(simResult.simulatedPolicy.autoRecoverCases, 0);
    assert.ok(simResult.safetyTradeOff.headline.includes('Zero autonomous execution'));
  });

  await t.test('8. Safety Trade-Off Synthesis: generates empirical trade-offs without hallucination', async () => {
    const simResult = PolicySimulatorService.simulatePolicyImpact(
      {
        maxAutoRecoveryAmount: 60000,
        highValueRequiresApproval: false
      },
      { seed: 42, batchSize: 500 }
    );

    assert.ok(simResult.safetyTradeOff.tradeOffPoints.length > 0);
    assert.ok(simResult.safetyTradeOff.recommendedSafeguard.length > 0);
    assert.equal(simResult.safetyTradeOff.riskLevel, 'ELEVATED');
  });

  await t.test('9. Seed Reproducibility: identical simulation seed generates identical comparison metrics', async () => {
    const run1 = PolicySimulatorService.simulatePolicyImpact(
      { maxAutoRecoveryAmount: 35000 },
      { seed: 99, batchSize: 500 }
    );
    const run2 = PolicySimulatorService.simulatePolicyImpact(
      { maxAutoRecoveryAmount: 35000 },
      { seed: 99, batchSize: 500 }
    );

    assert.deepEqual(run1.impactDeltas, run2.impactDeltas);
    assert.deepEqual(run1.currentPolicy, run2.currentPolicy);
    assert.deepEqual(run1.simulatedPolicy, run2.simulatedPolicy);
  });
});
