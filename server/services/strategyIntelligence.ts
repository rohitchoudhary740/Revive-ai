/**
 * ReviveAI Layer 3 — Recovery Strategy Intelligence
 * 
 * Context-Aware & Explainable AI Recommendation Layer:
 * - Constructs structured Recovery Context from real case data.
 * - Prompts Gemini model for strict JSON recommendation with alternatives and risk flags.
 * - Enforces strict schema and strategy authorization validation.
 * - Guarantees AI NEVER modifies guardrails, amounts, or invokes payment APIs directly.
 * - Generates clear "Why this action?" explainability contrasting AI Recommendation vs Policy Decision.
 */

import { GoogleGenAI, Type } from '@google/genai';
import { RecoveryCaseRepository } from '../repositories/recoveryCaseRepository';
import { TransactionRepository } from '../repositories/transactionRepository';
import { RecoveryJourneyRepository, RecoveryJourneyStepRecord } from '../repositories/recoveryJourneyRepository';
import { StrategyIntelligenceRepository, StrategyIntelligenceRecord } from '../repositories/strategyIntelligenceRepository';
import {
  RecoveryStrategyId,
  STRATEGY_REGISTRY,
  getStrategyDefinition,
  isValidStrategyId,
  normalizeStrategyId
} from './strategyRegistry';
import { StrategyRanker, StrategySelectionDecision } from './strategyRanking';
import { getGuardrailConfig, GuardrailConfig } from './guardrailConfig';
import { evaluateDeterministicSafetyRules, PolicyEvaluationResult } from './policyEngine';
import { ClosedLoopAgent, LOOP_LIMITS } from './closedLoopAgent';
import { FinancialSafetyService } from './financialSafetyService';

export interface RecoveryContext {
  caseId: string;
  failureCode: string;
  failureReason: string;
  amount: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    tier?: string;
  };
  paymentMethod: string;
  customerRetryCount: number;
  previousAttempts: {
    attemptNumber: number;
    strategyId: RecoveryStrategyId;
    strategyName: string;
    actionStatus: string;
    outcome: string;
    failureReason?: string | null;
  }[];
  previousActionOutcomes: string[];
  guardrails: GuardrailConfig;
  availableStrategies: RecoveryStrategyId[];
}

export interface GeminiStrategyIntelligence {
  diagnosis: string;
  confidence: number;
  recovery_probability: number;
  recommended_strategy: RecoveryStrategyId;
  reasoning: string;
  evidence: string[];
  alternative_strategy: RecoveryStrategyId | null;
  why_not_alternative: string;
  risk_flags: string[];
}

export interface ExplainabilityReport {
  caseId: string;
  amount: number;
  failureCode: string;
  aiRecommendation: {
    recommendedStrategy: {
      id: RecoveryStrategyId;
      name: string;
      description: string;
    };
    confidence: number;
    recoveryProbability: number;
    reasoning: string;
    evidence: string[];
    alternativeConsidered: {
      id: RecoveryStrategyId | null;
      name: string | null;
      whyRejected: string;
    };
    riskFlags: string[];
    isFallback: boolean;
  };
  deterministicPolicyDecision: {
    isApproved: boolean;
    requiresHumanApproval: boolean;
    isStopped: boolean;
    statusText: string;
    checks: {
      name: string;
      passed: boolean;
      detail: string;
    }[];
  };
  authorityStatement: string;
  createdAt: string;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  intelligence?: GeminiStrategyIntelligence;
}

let aiClient: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (err: any) {
    console.error('[Layer 3 Intelligence] Gemini client initialization error:', err.message);
  }
}

export class StrategyIntelligenceService {
  /**
   * Constructs the structured Recovery Context from real case data.
   */
  static async buildRecoveryContext(caseId: string): Promise<RecoveryContext> {
    const rc = await RecoveryCaseRepository.findById(caseId);
    if (!rc) {
      throw new Error(`Recovery case "${caseId}" not found.`);
    }

    const tx = await TransactionRepository.findById(rc.transaction_id);
    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    const guardrails = getGuardrailConfig();

    const previousAttempts = history.map((s) => ({
      attemptNumber: s.attempt_number,
      strategyId: s.strategy_id,
      strategyName: s.strategy_name,
      actionStatus: s.action_status,
      outcome: s.outcome,
      failureReason: s.failure_reason
    }));

    const previousActionOutcomes = history.map(
      (s) => `Attempt ${s.attempt_number} [${s.strategy_name}]: ${s.outcome.toUpperCase()}${s.failure_reason ? ` (${s.failure_reason})` : ''}`
    );

    // Compute bounded, currently permitted strategies
    const lastStep = history.length > 0 ? history[history.length - 1] : null;
    const availableStrategies = (Object.keys(STRATEGY_REGISTRY) as RecoveryStrategyId[]).filter((stratId) => {
      const def = STRATEGY_REGISTRY[stratId];
      // Max attempts per strategy
      const used = history.filter((s) => s.strategy_id === stratId).length;
      if (used >= def.maxAttempts) return false;
      // No consecutive identical failed action
      if (lastStep && lastStep.outcome === 'failure' && lastStep.strategy_id === stratId) return false;
      // Customer contact quota
      if (def.isCustomerContact) {
        const contactCount = history.filter(
          (s) => getStrategyDefinition(s.strategy_id).isCustomerContact && s.action_status === 'executed'
        ).length;
        if (contactCount >= LOOP_LIMITS.MAX_CUSTOMER_CONTACTS) return false;
      }
      return true;
    });

    return {
      caseId,
      failureCode: tx?.failure_code || 'BANK_TIMEOUT',
      failureReason: tx?.failure_reason || 'Gateway Timeout (504)',
      amount: tx?.amount ?? 5000,
      customer: {
        name: tx?.customer_name || 'Valued Customer',
        email: tx?.customer_email || 'customer@example.com',
        phone: tx?.customer_phone || '+919999999999',
        tier: (tx?.amount ?? 0) >= 25000 ? 'Enterprise Client' : (tx?.amount ?? 0) >= 10000 ? 'B2B Merchant' : 'B2C Customer'
      },
      paymentMethod: 'UPI',
      customerRetryCount: 0,
      previousAttempts,
      previousActionOutcomes,
      guardrails: {
        maxAutoRecoveryAmount: guardrails.maxAutoRecoveryAmount,
        minRecoveryProbability: guardrails.minRecoveryProbability,
        maxAutomatedRetries: guardrails.maxAutomatedRetries,
        highValueRequiresApproval: guardrails.highValueRequiresApproval,
        lowConfidenceStops: guardrails.lowConfidenceStops,
        agentMode: guardrails.agentMode
      },
      availableStrategies
    };
  }

  /**
   * Validates raw Gemini response against strict schema and strategy authorization rules.
   */
  static validateGeminiStrategyResponse(
    raw: any,
    allowedStrategies: RecoveryStrategyId[]
  ): ValidationResult {
    if (!raw || typeof raw !== 'object') {
      return { valid: false, error: 'Malformed response: expected JSON object.' };
    }

    if (typeof raw.diagnosis !== 'string' || raw.diagnosis.trim().length < 3) {
      return { valid: false, error: 'Malformed response: "diagnosis" must be a non-empty string.' };
    }

    if (typeof raw.confidence !== 'number' || isNaN(raw.confidence) || raw.confidence < 0 || raw.confidence > 1) {
      return { valid: false, error: 'Malformed response: "confidence" must be a float between 0.0 and 1.0.' };
    }

    if (
      typeof raw.recovery_probability !== 'number' ||
      isNaN(raw.recovery_probability) ||
      raw.recovery_probability < 0 ||
      raw.recovery_probability > 1
    ) {
      return { valid: false, error: 'Malformed response: "recovery_probability" must be a float between 0.0 and 1.0.' };
    }

    if (typeof raw.reasoning !== 'string' || raw.reasoning.trim().length < 5) {
      return { valid: false, error: 'Malformed response: "reasoning" must be a descriptive string.' };
    }

    if (!Array.isArray(raw.evidence) || raw.evidence.length === 0 || !raw.evidence.every((e: any) => typeof e === 'string')) {
      return { valid: false, error: 'Malformed response: "evidence" must be a non-empty array of strings.' };
    }

    // Recommended Strategy Authorization Check
    const recommended = raw.recommended_strategy;
    if (!recommended || typeof recommended !== 'string' || !isValidStrategyId(recommended)) {
      return {
        valid: false,
        error: `Unauthorized strategy: "${recommended}" is not in the typed strategy registry.`
      };
    }

    if (!allowedStrategies.includes(recommended)) {
      return {
        valid: false,
        error: `Strategy "${recommended}" violates loop invariants or is not in currently allowed strategies: [${allowedStrategies.join(', ')}].`
      };
    }

    // Alternative Strategy Authorization Check
    let alternative: RecoveryStrategyId | null = null;
    if (raw.alternative_strategy && typeof raw.alternative_strategy === 'string') {
      if (!isValidStrategyId(raw.alternative_strategy)) {
        return {
          valid: false,
          error: `Unauthorized alternative strategy: "${raw.alternative_strategy}" is not in the strategy registry.`
        };
      }
      alternative = raw.alternative_strategy;
    }

    const whyNotAlt = typeof raw.why_not_alternative === 'string' ? raw.why_not_alternative : 'Not applicable';
    const riskFlags = Array.isArray(raw.risk_flags) ? raw.risk_flags.filter((f: any) => typeof f === 'string') : [];

    return {
      valid: true,
      intelligence: {
        diagnosis: raw.diagnosis.trim(),
        confidence: Math.round(raw.confidence * 100) / 100,
        recovery_probability: Math.round(raw.recovery_probability * 100) / 100,
        recommended_strategy: recommended,
        reasoning: raw.reasoning.trim(),
        evidence: raw.evidence.map((e: string) => e.trim()),
        alternative_strategy: alternative,
        why_not_alternative: whyNotAlt.trim(),
        risk_flags: riskFlags
      }
    };
  }

  /**
   * Deterministic heuristic fallback driven by the canonical StrategyRanker engine.
   */
  static getDeterministicHeuristicIntelligence(
    context: RecoveryContext
  ): GeminiStrategyIntelligence {
    const rankingDecision = this.rankStrategyFromContext(context);
    const code = context.failureCode.toUpperCase();
    
    let diagnosis = 'Temporary Banking Gateway Latency';
    let confidence = 0.90;
    let recoveryProb = 0.85;
    let riskFlags: string[] = [];

    if (code.includes('BALANCE') || code.includes('INSUFFICIENT_FUNDS')) {
      diagnosis = 'Issuer Account Insufficient Funds';
      confidence = 0.92;
      recoveryProb = 0.35;
      riskFlags.push('SOFT_DECLINE_BALANCE');
    } else if (code.includes('FRAUD') || code.includes('RISK') || code.includes('BLOCKED')) {
      diagnosis = 'Blocked by Risk Sentinel Velocity Filter';
      confidence = 0.96;
      recoveryProb = 0.05;
      riskFlags.push('HIGH_RISK_FRAUD_TRIGGER');
    } else if (code.includes('TIMEOUT') || code.includes('504')) {
      diagnosis = 'Temporary Bank 3DS Gateway Timeout';
      confidence = 0.92;
      recoveryProb = 0.85;
      riskFlags.push('GATEWAY_TIMEOUT');
    } else if (code.includes('GATEWAY') || code.includes('DEGRADED')) {
      diagnosis = 'Acquiring Gateway Node Degradation';
      confidence = 0.88;
      recoveryProb = 0.80;
    } else if (code.includes('DROPPED') || code.includes('AUTH_EXPIRED') || code.includes('USER_CANCELLED')) {
      diagnosis = 'Customer Checkout Session Abandonment';
      confidence = 0.89;
      recoveryProb = 0.75;
    }

    let recommended = rankingDecision.selectedStrategy;
    if (!context.availableStrategies.includes(recommended)) {
      recommended = context.availableStrategies[0] || 'human_review';
    }

    const topAlt = rankingDecision.alternatives[0];
    let alternative: RecoveryStrategyId | null = topAlt?.strategyId ?? null;
    let whyNotAlt = topAlt?.whyRejected ?? 'Not applicable';

    if (alternative && !context.availableStrategies.includes(alternative)) {
      alternative = null;
      whyNotAlt = 'Not applicable';
    }

    return {
      diagnosis,
      confidence,
      recovery_probability: recoveryProb,
      recommended_strategy: recommended,
      reasoning: rankingDecision.reasoning,
      evidence: rankingDecision.evidence,
      alternative_strategy: alternative,
      why_not_alternative: whyNotAlt,
      risk_flags: riskFlags
    };
  }

  /**
   * Authority Strategy Selection method: evaluates and ranks candidates for a case.
   */
  static async rankAndSelectStrategy(
    caseId: string,
    diagnosis?: any
  ): Promise<StrategySelectionDecision> {
    const context = await this.buildRecoveryContext(caseId);
    return this.rankStrategyFromContext(context, diagnosis);
  }

  /**
   * Evaluates and ranks candidates synchronously from a RecoveryContext.
   */
  static rankStrategyFromContext(
    context: RecoveryContext,
    diagnosis?: any
  ): StrategySelectionDecision {
    return StrategyRanker.rankStrategies({
      failureCode: context.failureCode,
      amount: context.amount,
      history: context.previousAttempts.map((p) => ({
        attempt_number: p.attemptNumber,
        strategy_id: p.strategyId,
        strategy_name: p.strategyName,
        action_status: p.actionStatus,
        outcome: p.outcome,
        failure_reason: p.failureReason
      })),
      diagnosis: {
        recoveryProbability: diagnosis?.recoveryProbability ?? 0.85,
        confidence: diagnosis?.confidence ?? 0.90,
        rootCause: diagnosis?.rootCause || context.failureReason
      },
      guardrails: context.guardrails,
      customer: context.customer,
      advisoryAiRecommendation: diagnosis?.recommendedAction
    });
  }

  /**
   * Asks Gemini for a strict JSON recommendation or falls back cleanly.
   */
  static async generateStrategyIntelligence(
    context: RecoveryContext
  ): Promise<{ intelligence: GeminiStrategyIntelligence; isFallback: boolean; validationPassed: boolean }> {
    if (!aiClient) {
      const fallback = this.getDeterministicHeuristicIntelligence(context);
      return { intelligence: fallback, isFallback: true, validationPassed: true };
    }

    const prompt = `
You are the ReviveAI Recovery Strategy Intelligence Engine.
Analyze this payment failure and recommend the optimal recovery strategy from the allowed set.

STRUCTURED RECOVERY CONTEXT:
- Case ID: ${context.caseId}
- Failure Code: ${context.failureCode}
- Failure Reason: ${context.failureReason}
- Transaction Amount: ₹${context.amount}
- Customer: ${context.customer.name} (Tier: ${context.customer.tier})
- Customer Previous Retries: ${context.customerRetryCount}
- Previous Recovery Attempts: ${JSON.stringify(context.previousAttempts)}
- Previous Action Outcomes: ${JSON.stringify(context.previousActionOutcomes)}
- Merchant Guardrails: Auto-Limit ₹${context.guardrails.maxAutoRecoveryAmount}, Min-Prob ${context.guardrails.minRecoveryProbability * 100}%, Max-Retries ${context.guardrails.maxAutomatedRetries}
- STRICTLY ALLOWED STRATEGY IDS: ${JSON.stringify(context.availableStrategies)}

RULES:
1. "recommended_strategy" MUST BE EXACTLY ONE OF: ${JSON.stringify(context.availableStrategies)}
2. "alternative_strategy" MUST BE ONE OF: ${JSON.stringify(context.availableStrategies)} or null.
3. You MUST NEVER invent arbitrary actions.
4. You MUST NEVER attempt to modify guardrails, monetary amounts, or mark cases recovered.
5. Provide crisp, realistic bulleted telemetry evidence.
6. Explain why the alternative strategy was considered and why it was rejected in favor of the recommended strategy.

RETURN STRICT JSON ONLY:
{
  "diagnosis": "string",
  "confidence": 0.0 to 1.0,
  "recovery_probability": 0.0 to 1.0,
  "recommended_strategy": "string",
  "reasoning": "string",
  "evidence": ["string", "string"],
  "alternative_strategy": "string or null",
  "why_not_alternative": "string",
  "risk_flags": ["string"]
}
`;

    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diagnosis: { type: Type.STRING },
              confidence: { type: Type.NUMBER },
              recovery_probability: { type: Type.NUMBER },
              recommended_strategy: { type: Type.STRING },
              reasoning: { type: Type.STRING },
              evidence: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              alternative_strategy: { type: Type.STRING },
              why_not_alternative: { type: Type.STRING },
              risk_flags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: [
              'diagnosis',
              'confidence',
              'recovery_probability',
              'recommended_strategy',
              'reasoning',
              'evidence',
              'why_not_alternative',
              'risk_flags'
            ]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      const parsed = JSON.parse(text);
      const validation = this.validateGeminiStrategyResponse(parsed, context.availableStrategies);

      if (!validation.valid || !validation.intelligence) {
        console.warn(`[Layer 3 Intelligence] Gemini response failed validation: ${validation.error}. Falling back to safe routing.`);
        await FinancialSafetyService.handleSafeAiFailure(
          context.caseId,
          validation.error || 'Schema validation failure',
          'TEST_MODE'
        );
        // Malformed or unauthorized: Safe fallback routes to human review
        return {
          intelligence: {
            diagnosis: parsed.diagnosis || 'Uncertain Failure Signature',
            confidence: 0.0,
            recovery_probability: 0.0,
            recommended_strategy: 'human_review',
            reasoning: `AI recommendation rejected due to validation failure: ${validation.error}. Routed safely to human operator.`,
            evidence: ['AI output failed schema validation', 'Safety sentinel diverted case to human review'],
            alternative_strategy: null,
            why_not_alternative: 'Autonomous execution disabled due to validation check.',
            risk_flags: ['MALFORMED_AI_OUTPUT', 'SENTINEL_DIVERTED']
          },
          isFallback: true,
          validationPassed: false
        };
      }

      return {
        intelligence: validation.intelligence,
        isFallback: false,
        validationPassed: true
      };
    } catch (err: any) {
      console.warn(`[Layer 3 Intelligence] Gemini API call error: ${err.message}. Using deterministic fallback.`);
      await FinancialSafetyService.handleSafeAiFailure(
        context.caseId,
        err.message || 'Gemini API unreachable',
        'TEST_MODE'
      );
      const fallback = this.getDeterministicHeuristicIntelligence(context);
      return { intelligence: fallback, isFallback: true, validationPassed: true };
    }
  }

  /**
   * Generates and persists the full "Why this action?" Explainability Report.
   */
  static async evaluateAndExplain(caseId: string): Promise<ExplainabilityReport> {
    const context = await this.buildRecoveryContext(caseId);
    const { intelligence, isFallback, validationPassed } = await this.generateStrategyIntelligence(context);

    // Persist intelligence record
    const recordId = `INTEL-${caseId}-${Date.now()}`;
    await StrategyIntelligenceRepository.save({
      id: recordId,
      case_id: caseId,
      diagnosis: intelligence.diagnosis,
      confidence: intelligence.confidence,
      recovery_probability: intelligence.recovery_probability,
      recommended_strategy: intelligence.recommended_strategy,
      reasoning: intelligence.reasoning,
      evidence: JSON.stringify(intelligence.evidence),
      alternative_strategy: intelligence.alternative_strategy,
      why_not_alternative: intelligence.why_not_alternative,
      risk_flags: JSON.stringify(intelligence.risk_flags),
      validation_passed: validationPassed ? 1 : 0,
      is_fallback: isFallback ? 1 : 0,
      created_at: new Date().toISOString()
    });

    // Deterministic Policy Engine Evaluation (Final Authority)
    const rc = await RecoveryCaseRepository.findById(caseId);
    const history = await RecoveryJourneyRepository.findByCaseId(caseId);
    const policyResult = ClosedLoopAgent.evaluatePolicyForStrategy(
      rc?.status || 'new',
      context.amount,
      intelligence.recommended_strategy,
      history,
      {
        rootCause: intelligence.diagnosis,
        confidence: intelligence.confidence,
        recoveryProbability: intelligence.recovery_probability,
        recommendedAction: intelligence.recommended_strategy,
        expectedRecovery: Math.round(context.amount * intelligence.recovery_probability),
        reasoning: intelligence.reasoning,
        evidence: intelligence.evidence
      }
    );

    const recDef = getStrategyDefinition(intelligence.recommended_strategy);
    const altDef = intelligence.alternative_strategy ? getStrategyDefinition(intelligence.alternative_strategy) : null;

    return {
      caseId,
      amount: context.amount,
      failureCode: context.failureCode,
      aiRecommendation: {
        recommendedStrategy: {
          id: intelligence.recommended_strategy,
          name: recDef.name,
          description: recDef.description
        },
        confidence: intelligence.confidence,
        recoveryProbability: intelligence.recovery_probability,
        reasoning: intelligence.reasoning,
        evidence: intelligence.evidence,
        alternativeConsidered: {
          id: intelligence.alternative_strategy,
          name: altDef ? altDef.name : null,
          whyRejected: intelligence.why_not_alternative
        },
        riskFlags: intelligence.risk_flags,
        isFallback
      },
      deterministicPolicyDecision: {
        isApproved: policyResult.isApproved,
        requiresHumanApproval: policyResult.requiresHumanApproval,
        isStopped: policyResult.isStopped,
        statusText: policyResult.statusText,
        checks: policyResult.checks
      },
      authorityStatement:
        'The Gemini model recommended this strategy based on failure telemetry and previous journey history. The Deterministic Policy Engine evaluated all merchant guardrails and holds ultimate execution authority.',
      createdAt: new Date().toISOString()
    };
  }
}
