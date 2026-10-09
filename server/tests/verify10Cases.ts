import { StrategyRanker, StrategyRankingContext } from '../services/strategyRanking';
import { ClosedLoopAgent } from '../services/closedLoopAgent';
import { getGuardrailConfig } from '../services/guardrailConfig';
import { STRATEGY_REGISTRY } from '../services/strategyRegistry';

interface CaseRunInput {
  caseId: string;
  failureCode: string;
  failureDescription: string;
  amount: number;
  retryCount: number;
  previousAttempts: Array<{ strategyId: string; outcome: string }>;
  customerContactsCount: number;
  recoveryProbability: number;
  diagnosisConfidence: number;
}

const testCases: CaseRunInput[] = [
  // 1. Classic ₹5,000 Checkout Abandonment (The ₹5,000 Live Demo Scenario)
  {
    caseId: 'CASE-01-RZP-5K',
    failureCode: 'USER_CANCELLED',
    failureDescription: 'Customer dismissed Razorpay checkout frame',
    amount: 5000,
    retryCount: 0,
    previousAttempts: [],
    customerContactsCount: 0,
    recoveryProbability: 0.87,
    diagnosisConfidence: 0.94
  },
  // 2. Bank Latency / Timeout
  {
    caseId: 'CASE-02-BANK-TIMEOUT',
    failureCode: 'BANK_TIMEOUT',
    failureDescription: 'Issuing bank 3DS handshake 504 timeout',
    amount: 3200,
    retryCount: 0,
    previousAttempts: [],
    customerContactsCount: 0,
    recoveryProbability: 0.88,
    diagnosisConfidence: 0.92
  },
  // 3. Transient Gateway Degradation
  {
    caseId: 'CASE-03-GATEWAY-DEGRADED',
    failureCode: 'GATEWAY_ERROR',
    failureDescription: 'Primary acquiring gateway transient 502/504 error',
    amount: 4500,
    retryCount: 0,
    previousAttempts: [],
    customerContactsCount: 0,
    recoveryProbability: 0.82,
    diagnosisConfidence: 0.91
  },
  // 4. Expired Payment Instrument
  {
    caseId: 'CASE-04-EXPIRED-CARD',
    failureCode: 'EXPIRED_PAYMENT_METHOD',
    failureDescription: 'Card token expired at card network',
    amount: 2100,
    retryCount: 0,
    previousAttempts: [],
    customerContactsCount: 0,
    recoveryProbability: 0.76,
    diagnosisConfidence: 0.95
  },
  // 5. Adaptive Shift after Failed Smart Retry
  {
    caseId: 'CASE-05-RETRY-FAILED',
    failureCode: 'BANK_TIMEOUT',
    failureDescription: 'Initial instant retry failed due to persistent bank node spike',
    amount: 4000,
    retryCount: 1,
    previousAttempts: [{ strategyId: 'smart_retry', outcome: 'failure' }],
    customerContactsCount: 0,
    recoveryProbability: 0.80,
    diagnosisConfidence: 0.90
  },
  // 6. High-Value Transaction (> ₹25k auto limit)
  {
    caseId: 'CASE-06-HIGH-VALUE',
    failureCode: 'USER_CANCELLED',
    failureDescription: 'Enterprise high-ticket cart abandoned',
    amount: 75000,
    retryCount: 0,
    previousAttempts: [],
    customerContactsCount: 0,
    recoveryProbability: 0.89,
    diagnosisConfidence: 0.95
  },
  // 7. Low Recovery Probability (< 30% guardrail floor)
  {
    caseId: 'CASE-07-LOW-PROBABILITY',
    failureCode: 'INSUFFICIENT_FUNDS',
    failureDescription: 'Account balance insufficient with poor re-attempt propensity',
    amount: 3000,
    retryCount: 0,
    previousAttempts: [],
    customerContactsCount: 0,
    recoveryProbability: 0.18,
    diagnosisConfidence: 0.85
  },
  // 8. Fraud Sentinel / Risk Flagged
  {
    caseId: 'CASE-08-RISK-FLAGGED',
    failureCode: 'RISK_FLAGGED',
    failureDescription: 'Velocity mismatch triggered card issuer risk sentinel',
    amount: 5000,
    retryCount: 0,
    previousAttempts: [],
    customerContactsCount: 0,
    recoveryProbability: 0.05,
    diagnosisConfidence: 0.98
  },
  // 9. Channel Fatigue (Customer communication quota 2/2 exhausted)
  {
    caseId: 'CASE-09-CHANNEL-FATIGUED',
    failureCode: 'USER_DROPPED',
    failureDescription: 'Customer unresponsive across 2 prior messaging attempts',
    amount: 4200,
    retryCount: 2,
    previousAttempts: [
      { strategyId: 'whatsapp_payment_link', outcome: 'failure' },
      { strategyId: 'delayed_retry', outcome: 'failure' }
    ],
    customerContactsCount: 2,
    recoveryProbability: 0.65,
    diagnosisConfidence: 0.87
  },
  // 10. Max Iteration Budget Exhausted (3 attempts failed)
  {
    caseId: 'CASE-10-ITERATION-EXHAUSTED',
    failureCode: 'BANK_TIMEOUT',
    failureDescription: 'Persistent multi-channel failure after 3 sequential iterations',
    amount: 5000,
    retryCount: 3,
    previousAttempts: [
      { strategyId: 'smart_retry', outcome: 'failure' },
      { strategyId: 'delayed_retry', outcome: 'failure' },
      { strategyId: 'whatsapp_payment_link', outcome: 'failure' }
    ],
    customerContactsCount: 1,
    recoveryProbability: 0.40,
    diagnosisConfidence: 0.90
  }
];

export function run10Cases() {
  const guardrails = getGuardrailConfig();
  const results = [];

  for (const c of testCases) {
    const context: StrategyRankingContext = {
      caseId: c.caseId,
      failureCode: c.failureCode,
      amount: c.amount,
      retryCount: c.retryCount,
      previousAttempts: c.previousAttempts,
      customerContactsCount: c.customerContactsCount,
      recoveryProbability: c.recoveryProbability,
      diagnosisConfidence: c.diagnosisConfidence,
      merchantGuardrails: guardrails
    };

    // 1. Authoritative Strategy Ranking
    const decision = StrategyRanker.rankStrategies(context);

    // 2. Deterministic Policy Validation
    const policyResult = ClosedLoopAgent.evaluatePolicyForStrategy(
      'new',
      c.amount,
      decision.selectedStrategy,
      c.previousAttempts.map((p, idx) => ({
        id: `step-${idx}`,
        case_id: c.caseId,
        attempt_number: idx + 1,
        strategy_id: p.strategyId as any,
        strategy_name: STRATEGY_REGISTRY[p.strategyId as any]?.name || p.strategyId,
        reasoning: 'Prior step',
        policy_approved: 1,
        policy_checks: '[]',
        policy_status_text: 'Approved',
        action_status: 'executed',
        action_payload: '{}',
        outcome: p.outcome as 'success' | 'failure',
        failure_reason: 'Prior failure',
        next_action: 'RETRY',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })),
      {
        rootCause: c.failureDescription,
        confidence: c.diagnosisConfidence,
        recoveryProbability: c.recoveryProbability,
        recommendedAction: decision.selectedStrategy,
        expectedRecovery: Math.round(c.amount * c.recoveryProbability),
        reasoning: decision.reasoning,
        evidence: decision.evidence
      },
      guardrails
    );

    // 3. Final Outcome Determination
    let finalOutcome: string;
    if (!policyResult.isApproved) {
      if (policyResult.isStopped) {
        finalOutcome = 'STOPPED (Guardrail / Risk Sentinel Halt)';
      } else if (policyResult.requiresHumanApproval) {
        finalOutcome = 'HUMAN_REVIEW (Escalated to Operator Desk)';
      } else {
        finalOutcome = 'REJECTED';
      }
    } else {
      if (decision.selectedStrategy === 'stop') {
        finalOutcome = 'STOPPED (Terminal Halt)';
      } else if (decision.selectedStrategy === 'human_review') {
        finalOutcome = 'HUMAN_REVIEW (Escalated)';
      } else {
        finalOutcome = `RECOVERED (₹${c.amount.toLocaleString('en-IN')} via ${STRATEGY_REGISTRY[decision.selectedStrategy]?.name || decision.selectedStrategy})`;
      }
    }

    results.push({
      caseId: c.caseId,
      failureCode: c.failureCode,
      failureDescription: c.failureDescription,
      amount: `₹${c.amount.toLocaleString('en-IN')}`,
      selectedStrategy: decision.selectedStrategy,
      selectedStrategyName: STRATEGY_REGISTRY[decision.selectedStrategy]?.name || decision.selectedStrategy,
      score: `${decision.score}/100`,
      alternatives: decision.alternatives.slice(0, 2).map(a => `${a.strategyName} (${a.score}pts)`).join(', '),
      policyVerdict: policyResult.statusText,
      finalOutcome,
      reasoning: decision.reasoning
    });
  }

  return results;
}

const output = run10Cases();
console.log(JSON.stringify(output, null, 2));

