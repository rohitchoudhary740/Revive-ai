import { GoogleGenAI, Type } from '@google/genai';
import { RecoveryStrategyId, normalizeStrategyId } from './strategyRegistry';

export interface GeminiDiagnosisResult {
  rootCause: string;
  confidence: number;
  recoveryProbability: number;
  recommendedAction: RecoveryStrategyId;
  expectedRecovery: number;
  reasoning: string;
  evidence: string[];
}

let ai: GoogleGenAI | null = null;
const apiKey = process.env.GEMINI_API_KEY;

if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
  try {
    ai = new GoogleGenAI({ apiKey });
    console.log('Gemini AI service successfully initialized with API key.');
  } catch (err: any) {
    console.error('Failed to initialize Gemini AI client:', err.message);
  }
} else {
  console.warn('GEMINI_API_KEY is not configured or is default. Gemini Service will operate in Heuristic Fallback Mode.');
}

// Fallback logic when Gemini API key is missing or calls fail
function getFallbackDiagnosis(
  amount: number,
  failureCode: string,
  paymentMethod: string,
  retryCount: number
): GeminiDiagnosisResult {
  const code = failureCode.toUpperCase();
  
  let rootCause = 'Unknown Payment Failure';
  let recoveryProbability = 0.5;
  let recommendedAction: RecoveryStrategyId = 'smart_retry';
  let reasoning = 'Default heuristic evaluation applied due to standard code match.';
  let evidence: string[] = [`Transaction value: ₹${amount.toLocaleString('en-IN')}`];

  if (code.includes('TIMEOUT') || code.includes('504')) {
    rootCause = 'Temporary Bank Degradation';
    recoveryProbability = 0.85;
    recommendedAction = 'smart_retry';
    reasoning = 'The bank gateway appears temporarily degraded. Latency spike detected during authentication handshake; zero-wait retry via alternate acquiring route offers highest conversion.';
    evidence.push(
      'Bank success rate dropped below 70%',
      'OTP/3DS gateway timeout detected',
      `Customer has attempted only ${retryCount} previous retries`
    );
  } else if (code.includes('GATEWAY_ERROR') || code.includes('TEMPORARY_DEGRADATION')) {
    rootCause = 'Gateway Node Degradation';
    recoveryProbability = 0.80;
    recommendedAction = 'smart_retry';
    reasoning = 'Transient gateway error encountered. Secondary acquirer routing recommended.';
    evidence.push(
      'Gateway returned upstream HTTP 502/503 error',
      'Secondary acquiring route available'
    );
  } else if (code.includes('DOWNTIME') || code.includes('MAINTENANCE')) {
    rootCause = 'Scheduled Bank Maintenance Window';
    recoveryProbability = 0.75;
    recommendedAction = 'delayed_retry';
    reasoning = 'Issuer node under maintenance window. Queuing delayed retry after maintenance window clears.';
    evidence.push(
      'Bank maintenance schedule active',
      'Immediate retries suspended to prevent error burn'
    );
  } else if (
    code.includes('BALANCE') ||
    code.includes('ERR_INSUFFICIENT_FUNDS') ||
    code.includes('INSUFFICIENT_FUNDS') ||
    code.includes('CARD_EXPIRED') ||
    code.includes('EXPIRED_PAYMENT_METHOD')
  ) {
    rootCause = 'Payment Instrument Soft Decline';
    recoveryProbability = 0.35;
    recommendedAction = 'payment_method_update';
    reasoning = 'Soft decline due to instrument funds or expiration. Customer payment method switch is required.';
    evidence.push(
      `Issuer returned ${failureCode} error code`,
      'Primary payment instrument cannot be debited directly'
    );
  } else if (code.includes('LIMIT') || code.includes('EXCEEDED')) {
    rootCause = 'Mandate Limit Exceeded';
    recoveryProbability = 0.60;
    recommendedAction = 'human_review';
    reasoning = 'Account or daily limit has been exceeded. Requires operator approval to divide or schedule invoice.';
    evidence.push(
      'Issuer returned limit constraint error',
      'High order value compared to card profile'
    );
  } else if (code.includes('FRAUD') || code.includes('SUSPECTED') || code.includes('BLOCKED')) {
    rootCause = 'Blocked by Risk Sentinel';
    recoveryProbability = 0.05;
    recommendedAction = 'stop';
    reasoning = 'High risk velocity triggers indicating duplicate attempts from multiple locations.';
    evidence.push(
      'Card flagged by risk engine',
      'Multiple declined cards from same fingerprint'
    );
  } else if (
    code.includes('DROPPED') ||
    code.includes('USER_CANCELLED') ||
    code.includes('AUTH_EXPIRED') ||
    code.includes('AUTH_FAILED')
  ) {
    rootCause = 'Customer Checkout Abandonment';
    recoveryProbability = 0.75;
    recommendedAction = 'whatsapp_payment_link';
    reasoning = 'Customer abandoned checkout or session expired. Direct 1-click WhatsApp recovery link offers highest re-engagement.';
    evidence.push(
      'Customer dropped during 3DS OTP step',
      'High re-engagement intent via instant messaging'
    );
  }

  const expectedRecovery = Math.round(amount * recoveryProbability);

  return {
    rootCause,
    confidence: 0.90,
    recoveryProbability,
    recommendedAction,
    expectedRecovery,
    reasoning,
    evidence
  };
}

export async function diagnosePaymentFailureWithGemini(
  amount: number,
  failureCode: string,
  paymentMethod: string,
  retryCount: number,
  customerName: string
): Promise<GeminiDiagnosisResult> {
  if (!ai) {
    console.log('Gemini Service operating in Heuristic Fallback Mode (no API key).');
    return getFallbackDiagnosis(amount, failureCode, paymentMethod, retryCount);
  }

  const prompt = `
    Analyze this payment failure event and diagnose the root cause:
    - Customer Name: ${customerName}
    - Payment Method: ${paymentMethod}
    - Failed Transaction Amount: ₹${amount}
    - Gateway/Issuer Failure Code: ${failureCode}
    - Customer Previous Retry Count: ${retryCount}

    Determine:
    1. The root cause of failure.
    2. A confidence score between 0.0 and 1.0.
    3. A recovery success probability between 0.0 and 1.0.
    4. Recommended recovery strategy. Must be exactly one of: "smart_retry", "whatsapp_payment_link", "delayed_retry", "payment_method_update", "human_review", "stop".
    5. Reasoning why you recommended this.
    6. Bulleted key telemetry evidence (minimum 2 items).
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rootCause: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            recoveryProbability: { type: Type.NUMBER },
            recommendedAction: {
              type: Type.STRING,
              enum: [
                'smart_retry',
                'whatsapp_payment_link',
                'delayed_retry',
                'payment_method_update',
                'human_review',
                'stop'
              ]
            },
            reasoning: { type: Type.STRING },
            evidence: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: [
            'rootCause',
            'confidence',
            'recoveryProbability',
            'recommendedAction',
            'reasoning',
            'evidence'
          ]
        }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini API returned an empty response.');
    }

    const parsed = JSON.parse(text);
    
    // Add expectedRecovery calculation and normalize action
    const recoveryProbability = parsed.recoveryProbability || 0.5;
    const expectedRecovery = Math.round(amount * recoveryProbability);
    const normalizedAction = normalizeStrategyId(parsed.recommendedAction);

    return {
      rootCause: parsed.rootCause || 'Temporary Bank Degradation',
      confidence: parsed.confidence || 0.8,
      recoveryProbability: recoveryProbability,
      recommendedAction: normalizedAction,
      expectedRecovery,
      reasoning: parsed.reasoning || 'Default Gemini output processing.',
      evidence: parsed.evidence || []
    };
  } catch (err: any) {
    console.error('Error invoking Gemini API:', err.message);
    console.log('Gemini API call failed, falling back to heuristic diagnostics.');
    return getFallbackDiagnosis(amount, failureCode, paymentMethod, retryCount);
  }
}

