/**
 * ReviveAI Layer 4 — Merchant Policy Impact Simulator
 * 
 * READ-ONLY Simulation Engine:
 * - Allows merchant to test "What would happen if I changed my recovery policy?"
 * - Runs the existing batch evaluation engine against temporary parameters.
 * - STRICT INVARIANT: Never mutates active guardrails, active cases, database, or payment APIs.
 * - Compares CURRENT POLICY vs SIMULATED POLICY across all key recovery metrics.
 */

import { getGuardrailConfig, GuardrailConfig, AgentMode } from './guardrailConfig';
import { runBatchEvaluation, EvaluationRunResult, SyntheticCase } from './evaluationEngine';

export interface PolicyComparisonMetrics {
  autoRecoverCases: number;
  humanReviewCases: number;
  stoppedCases: number;
  interventions: number;
  expectedRecovery: number;
  recoveredRevenue: number;
  policyBlockedRevenue: number;
  recoveryRate: number;
  unnecessaryInterventions: number;
}

export interface PolicyImpactDeltas {
  autoRecoverCases: number;
  humanReviewCases: number;
  stoppedCases: number;
  interventions: number;
  expectedRecovery: number;
  recoveredRevenue: number;
  policyBlockedRevenue: number;
  recoveryRate: number;
  unnecessaryInterventions: number;
  highValueMovedToAuto: number;
}

export interface SafetyTradeOff {
  riskLevel: 'MINIMAL' | 'BALANCED' | 'ELEVATED';
  headline: string;
  tradeOffPoints: string[];
  recommendedSafeguard: string;
}

export interface PolicyTransitionCase {
  caseId: string;
  amount: number;
  failureCode: string;
  customerName: string;
  before: {
    status: 'Auto Recover' | 'Human Review' | 'Stopped';
    isApproved: boolean;
    policyStatus: string;
  };
  after: {
    status: 'Auto Recover' | 'Human Review' | 'Stopped';
    isApproved: boolean;
    policyStatus: string;
  };
  shiftType: 'review_to_auto' | 'stop_to_auto' | 'auto_to_review' | 'auto_to_stop' | 'unchanged';
}

export interface PolicyImpactSimulationResult {
  isSimulation: true;
  disclaimer: string;
  activeGuardrails: GuardrailConfig;
  simulatedGuardrails: GuardrailConfig;
  batchSize: number;
  seed: number;
  currentPolicy: PolicyComparisonMetrics;
  simulatedPolicy: PolicyComparisonMetrics;
  impactDeltas: PolicyImpactDeltas;
  safetyTradeOff: SafetyTradeOff;
  sampleTransitionCases: PolicyTransitionCase[];
  executionTimeMs?: number;
  totalEvaluatedCases?: number;
  createdAt: string;
}

export class PolicySimulatorService {
  /**
   * Sanitizes and bounds simulated policy inputs WITHOUT touching active guardrails.
   */
  public static validateSimulatedGuardrails(
    patch: Partial<GuardrailConfig>,
    base: GuardrailConfig
  ): GuardrailConfig {
    const next: GuardrailConfig = { ...base };

    if (typeof patch.maxAutoRecoveryAmount === 'number' && isFinite(patch.maxAutoRecoveryAmount)) {
      next.maxAutoRecoveryAmount = Math.max(0, Math.round(patch.maxAutoRecoveryAmount));
    }

    if (typeof patch.minRecoveryProbability === 'number' && isFinite(patch.minRecoveryProbability)) {
      const p = patch.minRecoveryProbability > 1
        ? patch.minRecoveryProbability / 100
        : patch.minRecoveryProbability;
      next.minRecoveryProbability = Math.min(1, Math.max(0, p));
    }

    if (typeof patch.maxAutomatedRetries === 'number' && isFinite(patch.maxAutomatedRetries)) {
      next.maxAutomatedRetries = Math.min(10, Math.max(0, Math.round(patch.maxAutomatedRetries)));
    }

    if (typeof patch.highValueRequiresApproval === 'boolean') {
      next.highValueRequiresApproval = patch.highValueRequiresApproval;
    }

    if (typeof patch.lowConfidenceStops === 'boolean') {
      next.lowConfidenceStops = patch.lowConfidenceStops;
    }

    if (
      patch.agentMode === 'auto_recover' ||
      patch.agentMode === 'review_first' ||
      patch.agentMode === 'manual_only'
    ) {
      next.agentMode = patch.agentMode as AgentMode;
    }

    return next;
  }

  /**
   * Runs a read-only policy impact simulation comparing current policy against temporary parameters.
   * Guarantees active guardrails remain 100% unchanged before, during, and after execution.
   */
  public static simulatePolicyImpact(
    simulatedPatch: Partial<GuardrailConfig>,
    options?: { seed?: number; batchSize?: number }
  ): PolicyImpactSimulationResult {
    const startTime = Date.now();

    // 1. Snapshot active guardrails (Read-only baseline)
    const activeGuardrails = getGuardrailConfig();
    const activeSnapshotJson = JSON.stringify(activeGuardrails);

    // 2. Build temporary simulated configuration
    const simulatedGuardrails = this.validateSimulatedGuardrails(simulatedPatch, activeGuardrails);

    const seed = typeof options?.seed === 'number' && isFinite(options.seed)
      ? Math.floor(options.seed)
      : 42;
    const batchSize = typeof options?.batchSize === 'number' && isFinite(options.batchSize)
      ? Math.max(1, Math.floor(options.batchSize))
      : 500;

    // 3. Run batch evaluation on active policy
    const currentRun: EvaluationRunResult = runBatchEvaluation({
      seed,
      batchSize,
      guardrails: activeGuardrails
    });

    // 4. Run batch evaluation on simulated temporary policy
    const simulatedRun: EvaluationRunResult = runBatchEvaluation({
      seed,
      batchSize,
      guardrails: simulatedGuardrails
    });

    // 5. HARD INVARIANT ASSERTION: Active guardrails must NEVER have changed
    const postCheckGuardrails = getGuardrailConfig();
    const postCheckJson = JSON.stringify(postCheckGuardrails);
    if (activeSnapshotJson !== postCheckJson) {
      throw new Error('SECURITY INVARIANT VIOLATION: Active guardrails were mutated during simulation!');
    }

    // 6. Extract and compute comparative metrics
    const currentCases = currentRun.allCases || currentRun.sampleCases || [];
    const simulatedCases = simulatedRun.allCases || simulatedRun.sampleCases || [];

    const currentAutoRecover = currentCases.filter(c => c.reviveAi.isApproved).length;
    const simulatedAutoRecover = simulatedCases.filter(c => c.reviveAi.isApproved).length;

    const currentMetrics: PolicyComparisonMetrics = {
      autoRecoverCases: currentAutoRecover,
      humanReviewCases: currentRun.reviveAi.humanReviewCases,
      stoppedCases: currentRun.reviveAi.stoppedCases,
      interventions: currentRun.reviveAi.interventionsAttempted,
      expectedRecovery: currentRun.reviveAi.expectedRecoverableRevenue,
      recoveredRevenue: currentRun.reviveAi.recoveredRevenue,
      policyBlockedRevenue: currentRun.reviveAi.policyBlockedValue,
      recoveryRate: currentRun.reviveAi.recoveryRatePercent,
      unnecessaryInterventions: currentRun.reviveAi.unnecessaryInterventions
    };

    const simulatedMetrics: PolicyComparisonMetrics = {
      autoRecoverCases: simulatedAutoRecover,
      humanReviewCases: simulatedRun.reviveAi.humanReviewCases,
      stoppedCases: simulatedRun.reviveAi.stoppedCases,
      interventions: simulatedRun.reviveAi.interventionsAttempted,
      expectedRecovery: simulatedRun.reviveAi.expectedRecoverableRevenue,
      recoveredRevenue: simulatedRun.reviveAi.recoveredRevenue,
      policyBlockedRevenue: simulatedRun.reviveAi.policyBlockedValue,
      recoveryRate: simulatedRun.reviveAi.recoveryRatePercent,
      unnecessaryInterventions: simulatedRun.reviveAi.unnecessaryInterventions
    };

    // 7. Case transitions analysis
    let highValueMovedToAuto = 0;
    const transitionCases: PolicyTransitionCase[] = [];

    const getStatusLabel = (c: SyntheticCase['reviveAi']): 'Auto Recover' | 'Human Review' | 'Stopped' => {
      if (c.isApproved) return 'Auto Recover';
      if (c.requiresHumanApproval) return 'Human Review';
      return 'Stopped';
    };

    for (let i = 0; i < currentCases.length; i++) {
      const bCase = currentCases[i];
      const aCase = simulatedCases[i];
      if (!bCase || !aCase) continue;

      const beforeStatus = getStatusLabel(bCase.reviveAi);
      const afterStatus = getStatusLabel(aCase.reviveAi);

      let shiftType: PolicyTransitionCase['shiftType'] = 'unchanged';
      if (beforeStatus === 'Human Review' && afterStatus === 'Auto Recover') {
        shiftType = 'review_to_auto';
        highValueMovedToAuto++;
      } else if (beforeStatus === 'Stopped' && afterStatus === 'Auto Recover') {
        shiftType = 'stop_to_auto';
      } else if (beforeStatus === 'Auto Recover' && afterStatus === 'Human Review') {
        shiftType = 'auto_to_review';
      } else if (beforeStatus === 'Auto Recover' && afterStatus === 'Stopped') {
        shiftType = 'auto_to_stop';
      }

      if (shiftType !== 'unchanged' && transitionCases.length < 30) {
        transitionCases.push({
          caseId: bCase.id,
          amount: bCase.amount,
          failureCode: bCase.failureCode,
          customerName: bCase.customerName,
          before: {
            status: beforeStatus,
            isApproved: bCase.reviveAi.isApproved,
            policyStatus: bCase.reviveAi.policyStatus
          },
          after: {
            status: afterStatus,
            isApproved: aCase.reviveAi.isApproved,
            policyStatus: aCase.reviveAi.policyStatus
          },
          shiftType
        });
      }
    }

    // 8. Deltas
    const impactDeltas: PolicyImpactDeltas = {
      autoRecoverCases: simulatedMetrics.autoRecoverCases - currentMetrics.autoRecoverCases,
      humanReviewCases: simulatedMetrics.humanReviewCases - currentMetrics.humanReviewCases,
      stoppedCases: simulatedMetrics.stoppedCases - currentMetrics.stoppedCases,
      interventions: simulatedMetrics.interventions - currentMetrics.interventions,
      expectedRecovery: simulatedMetrics.expectedRecovery - currentMetrics.expectedRecovery,
      recoveredRevenue: simulatedMetrics.recoveredRevenue - currentMetrics.recoveredRevenue,
      policyBlockedRevenue: simulatedMetrics.policyBlockedRevenue - currentMetrics.policyBlockedRevenue,
      recoveryRate: Number((simulatedMetrics.recoveryRate - currentMetrics.recoveryRate).toFixed(1)),
      unnecessaryInterventions: simulatedMetrics.unnecessaryInterventions - currentMetrics.unnecessaryInterventions,
      highValueMovedToAuto
    };

    // 9. Safety trade-offs synthesis
    const safetyTradeOff = this.evaluateSafetyTradeOff(
      activeGuardrails,
      simulatedGuardrails,
      impactDeltas,
      simulatedMetrics
    );

    return {
      isSimulation: true,
      disclaimer: 'SIMULATION — DOES NOT CHANGE ACTIVE POLICY. READ-ONLY EVALUATION.',
      activeGuardrails,
      simulatedGuardrails,
      batchSize,
      seed,
      currentPolicy: currentMetrics,
      simulatedPolicy: simulatedMetrics,
      impactDeltas,
      safetyTradeOff,
      sampleTransitionCases: transitionCases,
      executionTimeMs: Math.max(1, Date.now() - startTime),
      totalEvaluatedCases: batchSize,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Generates truthful safety trade-off summaries based on empirical deltas.
   */
  private static evaluateSafetyTradeOff(
    active: GuardrailConfig,
    sim: GuardrailConfig,
    deltas: PolicyImpactDeltas,
    simMetrics: PolicyComparisonMetrics
  ): SafetyTradeOff {
    const tradeOffPoints: string[] = [];
    let riskLevel: SafetyTradeOff['riskLevel'] = 'BALANCED';
    let headline = 'Policy adjustment maintains healthy guardrail balance.';
    let recommendedSafeguard = 'Maintain active idempotency checks and 24-hour customer contact quotas.';

    // Check maximum auto-recovery amount change
    if (sim.maxAutoRecoveryAmount > active.maxAutoRecoveryAmount) {
      tradeOffPoints.push(
        `Raising auto-recovery limit from ₹${active.maxAutoRecoveryAmount.toLocaleString('en-IN')} to ₹${sim.maxAutoRecoveryAmount.toLocaleString('en-IN')} shifted ${deltas.highValueMovedToAuto} high-ticket transactions directly to automated recovery without manual sign-off.`
      );
      if (sim.maxAutoRecoveryAmount >= 50000 && !sim.highValueRequiresApproval) {
        riskLevel = 'ELEVATED';
        headline = 'Higher recovery velocity with increased high-value exposure.';
        recommendedSafeguard = 'Enable high-value human approval flag or enforce 15-minute verification cool-down on transactions > ₹30,000.';
      }
    } else if (sim.maxAutoRecoveryAmount < active.maxAutoRecoveryAmount) {
      tradeOffPoints.push(
        `Tightening auto-recovery threshold from ₹${active.maxAutoRecoveryAmount.toLocaleString('en-IN')} to ₹${sim.maxAutoRecoveryAmount.toLocaleString('en-IN')} shifted ${Math.abs(deltas.humanReviewCases)} cases into operator review queue.`
      );
      riskLevel = 'MINIMAL';
      headline = 'Conservative policy stance with zero unauthorized high-value executions.';
      recommendedSafeguard = 'Ensure merchant operations team has capacity to review pending approvals within 30 minutes.';
    }

    // Check minimum probability change
    if (sim.minRecoveryProbability < active.minRecoveryProbability) {
      tradeOffPoints.push(
        `Lowering minimum confidence threshold from ${Math.round(active.minRecoveryProbability * 100)}% to ${Math.round(sim.minRecoveryProbability * 100)}% increased interventions by ${deltas.interventions}, resulting in ${deltas.unnecessaryInterventions >= 0 ? '+' : ''}${deltas.unnecessaryInterventions} low-yield interactions.`
      );
      if (deltas.unnecessaryInterventions > 5) {
        riskLevel = 'ELEVATED';
      }
    } else if (sim.minRecoveryProbability > active.minRecoveryProbability) {
      tradeOffPoints.push(
        `Raising minimum confidence threshold from ${Math.round(active.minRecoveryProbability * 100)}% to ${Math.round(sim.minRecoveryProbability * 100)}% pruned ${Math.abs(deltas.interventions)} low-confidence attempts, saving customer goodwill.`
      );
      riskLevel = 'MINIMAL';
    }

    // Check retries change
    if (sim.maxAutomatedRetries > active.maxAutomatedRetries) {
      tradeOffPoints.push(
        `Increasing automated retries from ${active.maxAutomatedRetries} to ${sim.maxAutomatedRetries} yields higher long-tail capture but increases gateway timeout retry load.`
      );
    }

    // Agent mode change
    if (sim.agentMode !== active.agentMode) {
      if (sim.agentMode === 'manual_only') {
        tradeOffPoints.push('Manual Only mode halts all autonomous actions. 100% of cases require manual merchant intervention.');
        riskLevel = 'MINIMAL';
        headline = 'Zero autonomous execution — strictly manual review.';
      } else if (sim.agentMode === 'review_first') {
        tradeOffPoints.push('Review First mode routes all approved recovery cases into the operator approval queue before dispatch.');
        riskLevel = 'MINIMAL';
        headline = 'Human-in-the-loop review for all recovery actions.';
      }
    }

    if (tradeOffPoints.length === 0) {
      tradeOffPoints.push('Simulated policy boundaries match current active guardrails. No behavioral shift detected.');
      riskLevel = 'MINIMAL';
      headline = 'Simulated policy is identical to active policy.';
    }

    return {
      riskLevel,
      headline,
      tradeOffPoints,
      recommendedSafeguard
    };
  }
}
