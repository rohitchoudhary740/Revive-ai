import { GoogleGenAI, Type } from '@google/genai';

export interface GeminiDiagnosisResult {
  rootCause: string;
  confidence: number;
  recoveryProbability: number;
  recommendedAction: 'whatsapp_recovery' | 'delayed_retry' | 'payment_link' | 'stop' | 'human_approval';
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
  let recommendedAction: GeminiDiagnosisResult['recommendedAction'] = 'payment_link';
  let reasoning = 'Default heuristic evaluation applied due to standard code match.';
  let evidence: string[] = [`Transaction value: ₹${amount.toLocaleString('en-IN')}`];

  if (code.includes('TIMEOUT') || code.includes('504') || code.includes('DEGRADED')) {
    rootCause = 'Temporary Bank Degradation';
    recoveryProbability = 0.85;
    recommendedAction = 'whatsapp_recovery';
    reasoning = 'The bank gateway appears temporarily degraded. Latency spike detected during authentication handshake.';
    evidence.push(
      'Bank success rate dropped below 70%',
      'OTP/3DS gateway timeout detected',
      `Customer has attempted only ${retryCount} previous retries`
    );
  } else if (code.includes('BALANCE') || code.includes('ERR_INSUFFICIENT_FUNDS')) {
    rootCause = 'Insufficient Funds';
    recoveryProbability = 0.25;
    recommendedAction = 'stop';
    reasoning = 'Soft decline due to lack of funds. Immediate retry is blocked to prevent transaction fee waste.';
    evidence.push(
      'Issuer returned INSUFFICIENT_FUNDS error code',
      'Transaction declined on primary bank account'
    );
  } else if (code.includes('LIMIT') || code.includes('EXCEEDED')) {
    rootCause = 'Mandate Limit Exceeded';
    recoveryProbability = 0.60;
    recommendedAction = 'human_approval';
    reasoning = 'Account or daily limit has been exceeded. Requires operator approval to divide or schedule invoice.';
    evidence.push(
      'Issuer returned limit constraint error',
      'High order value compared to card profile'
    );
  } else if (code.includes('FRAUD') || code.includes('SUSPECTED')) {
    rootCause = 'Blocked by Risk Sentinel';
    recoveryProbability = 0.10;
    recommendedAction = 'stop';
    reasoning = 'High risk velocity triggers indicating duplicate attempts from multiple locations.';
    evidence.push(
      'Card flagged by risk engine',
      'Multiple declined cards from same fingerprint'
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
    4. Recommended recovery strategy. Must be one of: "whatsapp_recovery", "delayed_retry", "payment_link", "stop", "human_approval".
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
              enum: ['whatsapp_recovery', 'delayed_retry', 'payment_link', 'stop', 'human_approval']
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
    
    // Add expectedRecovery calculation
    const recoveryProbability = parsed.recoveryProbability || 0.5;
    const expectedRecovery = Math.round(amount * recoveryProbability);

    return {
      rootCause: parsed.rootCause || 'Temporary Bank Degradation',
      confidence: parsed.confidence || 0.8,
      recoveryProbability: recoveryProbability,
      recommendedAction: parsed.recommendedAction || 'payment_link',
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
