import React, { useState, useEffect, useRef } from 'react';
import {
  Zap,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  BrainCircuit,
  ArrowRight,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  ExternalLink,
  Bot,
  Activity,
  Check,
  ChevronRight,
  Sparkles,
  Lock,
  RefreshCw,
  Smartphone,
  Send,
  MessageSquare,
  CheckCheck,
  ShieldAlert,
  FileText,
  Info,
  Layers,
  Sparkle,
  DollarSign,
  Award,
  Circle,
  Eye,
  CheckCircle,
  CheckCheck as LucideCheckCheck,
} from 'lucide-react';
import { PageId } from '../../types';
import { useRecovery } from '../../context/RecoveryContext';
import {
  diagnosePaymentFailure,
  evaluateDeterministicSafetyRules,
  AiDiagnosisResult,
  PolicyEvaluationResult,
} from '../../services/aiDiagnosisService';
import { WorkflowDetailModal } from './WorkflowDetailModal';
import { FullscreenCheckoutModal, CheckoutMode } from './FullscreenCheckoutModal';

interface RecoveryControlPageProps {
  onNavigate: (page: PageId) => void;
}

type SimulationState =
  | 'idle'
  | 'checkout_processing'
  | 'payment_failed'
  | 'step1_detection'
  | 'step2_diagnosis'
  | 'step3_decision'
  | 'step4_policy'
  | 'step5_whatsapp_prep'
  | 'step5_whatsapp_approved'
  | 'step5_whatsapp_sent'
  | 'step5_whatsapp_delivered'
  | 'step5_whatsapp_read'
  | 'step5_customer_paying'
  | 'step5_customer_paid'
  | 'step6_verification'
  | 'step7_recovered';

interface AgentLogEvent {
  id: string;
  time: string;
  icon: string;
  message: string;
  type: 'info' | 'ai' | 'success' | 'warn' | 'action';
}

const AI_DIAGNOSIS_STEPS = [
  'Analyzing failure code (BANK_TIMEOUT / 504 Gateway)...',
  'Checking HDFC issuer node success rate (degraded at 69%)...',
  'Comparing similar clustered failure signatures (17 detected)...',
  'Evaluating customer history & retry limits (0 previous retries)...',
];

const INITIAL_SYSTEM_LOGS: AgentLogEvent[] = [
  {
    id: 'log-init-1',
    time: '10:40:55',
    icon: '🟢',
    message: 'System Ready — AI agent is monitoring payment activity.',
    type: 'success',
  },
  {
    id: 'log-init-2',
    time: '10:40:58',
    icon: '👁️',
    message: 'Waiting for a payment event.',
    type: 'info',
  },
];

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));

export const RecoveryControlPage: React.FC<RecoveryControlPageProps> = ({ onNavigate }) => {
  const { completeRecovery } = useRecovery();
  const [simState, setSimState] = useState<SimulationState>('idle');
  const [logs, setLogs] = useState<AgentLogEvent[]>(INITIAL_SYSTEM_LOGS);
  const [diagnosis, setDiagnosis] = useState<AiDiagnosisResult | null>(null);
  const [policy, setPolicy] = useState<PolicyEvaluationResult | null>(null);
  const [aiProgressIndex, setAiProgressIndex] = useState<number>(0);
  const [verificationProgress, setVerificationProgress] = useState<number>(0);
  const [selectedDrillDownStep, setSelectedDrillDownStep] = useState<number | null>(null);
  const [checkoutStatusText, setCheckoutStatusText] = useState<string>('Processing payment...');
  const [recoveryCaseId, setRecoveryCaseId] = useState<string | null>(null);
  const [fullscreenCheckoutMode, setFullscreenCheckoutMode] = useState<CheckoutMode | null>(null);

  // ACTIVE merchant guardrails (live from GET /api/guardrails). Seeded with the
  // server defaults so Step-04 renders immediately; the fetch overwrites them.
  // These drive the cosmetic 7-step policy view so it reflects what the merchant
  // configured — the REAL decision is still made server-side.
  const [activeGuardrails, setActiveGuardrails] = useState<{
    maxAutoRecoveryAmount: number;
    minRecoveryProbability: number;
    maxAutomatedRetries: number;
    highValueRequiresApproval: boolean;
    lowConfidenceStops: boolean;
    agentMode: 'auto_recover' | 'review_first' | 'manual_only';
  }>({
    maxAutoRecoveryAmount: 25000,
    minRecoveryProbability: 0.3,
    maxAutomatedRetries: 3,
    highValueRequiresApproval: true,
    lowConfidenceStops: true,
    agentMode: 'auto_recover',
  });
  // Authoritative guardrail verdict for the synced backend case (real status_text).
  const [backendGuardrail, setBackendGuardrail] = useState<string | null>(null);

  // Execution ID: every new payment run gets a fresh id.
  // All async steps capture it at launch and bail if it no longer matches.
  const execIdRef = useRef<string>('');
  // Guard: prevent payment.failed + ondismiss from both triggering the flow
  const failureHandledRef = useRef<boolean>(false);
  // Guard: single scroll per recovery run
  const hasScrolledRef = useRef<boolean>(false);
  // Store active sleep promise cancellation tokens
  const abortRef = useRef<boolean>(false);

  // Manual step inspection tab override (defaults to current simulation step)
  const [inspectedStepOverride, setInspectedStepOverride] = useState<number | null>(null);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const workflowRef = useRef<HTMLDivElement>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const getNowTime = () => {
    const d = new Date();
    return d.toTimeString().split(' ')[0];
  };

  const addLog = (icon: string, message: string, type: AgentLogEvent['type'] = 'info') => {
    const newLog: AgentLogEvent = {
      id: `log-${Date.now()}-${Math.random()}`,
      time: getNowTime(),
      icon,
      message,
      type,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Safe internal scroll for log container ONLY (prevents window jumping)
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
    };
  }, []);

  // Load the ACTIVE merchant guardrails once on mount so the Step-04 policy view
  // and the cosmetic evaluator reflect what the merchant configured. Read-only;
  // the real recovery decision is still enforced server-side.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/guardrails');
        if (res.ok) {
          const cfg = await res.json();
          if (!cancelled && cfg) {
            setActiveGuardrails((prev) => ({
              maxAutoRecoveryAmount: cfg.maxAutoRecoveryAmount ?? prev.maxAutoRecoveryAmount,
              minRecoveryProbability: cfg.minRecoveryProbability ?? prev.minRecoveryProbability,
              maxAutomatedRetries: cfg.maxAutomatedRetries ?? prev.maxAutomatedRetries,
              highValueRequiresApproval: cfg.highValueRequiresApproval ?? prev.highValueRequiresApproval,
              lowConfidenceStops: cfg.lowConfidenceStops ?? prev.lowConfidenceStops,
              agentMode: cfg.agentMode ?? prev.agentMode,
            }));
          }
        }
      } catch {
        // Guardrails endpoint unreachable — keep server-default seed values.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── BACKEND CASE SYNC ─────────────────────────────────────────────────────
  // Once the real backend returns a caseId (from POST /api/recovery/failures),
  // poll the existing GET /api/recovery/cases endpoint for THIS case and mirror
  // the real server pipeline status into the live agent log. Minimal + additive:
  // it does not drive, gate, or replace the existing 7-step animation.
  useEffect(() => {
    if (!recoveryCaseId) return;

    let cancelled = false;
    let attempts = 0;
    let lastStatus: string | null = null;
    const MAX_ATTEMPTS = 15; // ~37s at 2.5s cadence, then give up quietly
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/recovery/cases/${recoveryCaseId}`);
        if (res.ok) {
          const found = await res.json();
          // Capture the authoritative, active-guardrail-aware verdict once the
          // real case has cleared the policy stage (null until then).
          if (!cancelled && found && found.guardrailDecision) {
            setBackendGuardrail(found.guardrailDecision);
          }
          if (!cancelled && found && found.status !== lastStatus) {
            lastStatus = found.status;
            addLog(
              '🛰️',
              `Backend case ${recoveryCaseId}: ${found.status} — ${found.currentStage}`,
              found.status === 'Completed' ? 'success' : found.status === 'Stopped' ? 'warn' : 'info'
            );
            
            if (found.status === 'Completed') {
              setSimState('step7_recovered');
            }
            
            if (found.status === 'Completed' || found.status === 'Stopped' || found.status === 'Awaiting Approval') {
              clearInterval(timer);
            }
          }
        }
      } catch {
        // Backend unreachable — stay silent; the local workflow already handles UX.
      }
      if (attempts >= MAX_ATTEMPTS) clearInterval(timer);
    };

    timer = setInterval(poll, 2500);
    poll(); // immediate first check

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [recoveryCaseId]);

  const addTimer = (fn: () => void, delay: number) => {
    const timer = setTimeout(fn, delay);
    timeoutsRef.current.push(timer);
    return timer;
  };

  // Scroll once per recovery run when the pipeline first becomes active
  const scrollOnce = () => {
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;
    // Small delay so the DOM has rendered the pipeline section
    setTimeout(() => {
      workflowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  };

  // Guarded sleep: resolves early if this run was aborted
  const guardedSleep = (ms: number, runId: string): Promise<boolean> =>
    new Promise(resolve => {
      const t = setTimeout(() => resolve(true), ms);
      timeoutsRef.current.push(t);
      // Poll abort flag
      const poll = setInterval(() => {
        if (execIdRef.current !== runId || abortRef.current) {
          clearTimeout(t);
          clearInterval(poll);
          resolve(false); // signals "aborted"
        }
      }, 50);
      timeoutsRef.current.push(poll as unknown as NodeJS.Timeout);
    });

  // ─── SINGLE SEQUENTIAL WORKFLOW RUNNER ─────────────────────────────────────
  // Uses execIdRef so any stale callbacks from a previous run are silently ignored.

  const runRecoveryWorkflow = async (runId: string, failureCode: string, _description: string) => {
    // Helper: run only if this runId is still the active one
    const alive = () => execIdRef.current === runId && !abortRef.current;
    const gs = (ms: number) => guardedSleep(ms, runId);

    // ── STEP 01: Payment Detection (2.5 s) ──────────────────────────────────
    if (!alive()) return;
    setSimState('payment_failed');
    scrollOnce();
    addLog('❌', 'Payment failure received — initiating triage', 'warn');

    if (!await gs(800)) return;
    if (!alive()) return;
    setSimState('step1_detection');
    addLog('🔍', 'Webhook event captured and parsed', 'info');

    if (!await gs(900)) return;
    if (!alive()) return;
    addLog('📡', 'Analyzing transaction telemetry...', 'info');

    if (!await gs(900)) return;
    if (!alive()) return;
    addLog('🟢', `Payment failure classified: ${failureCode || 'BANK_TIMEOUT'}`, 'success');

    if (!await gs(900)) return;

    // ── STEP 02: AI Diagnosis (4.5 s) ───────────────────────────────────────
    if (!alive()) return;
    setSimState('step2_diagnosis');
    addLog('🧠', 'Gemini 2.5 diagnosis started — analyzing payment telemetry...', 'ai');
    setAiProgressIndex(1);

    if (!await gs(1000)) return;
    if (!alive()) return;
    addLog('🔬', 'Identifying failure signature across 17 similar events...', 'ai');
    setAiProgressIndex(2);

    if (!await gs(1000)) return;
    if (!alive()) return;
    addLog('📊', 'Checking HDFC issuer node success rate (degraded at 69%)...', 'ai');
    setAiProgressIndex(3);

    if (!await gs(1000)) return;
    if (!alive()) return;
    addLog('👤', 'Evaluating customer history & retry limits (0 previous retries)...', 'ai');
    setAiProgressIndex(4);

    if (!await gs(1000)) return;
    if (!alive()) return;

    const diagResult = await diagnosePaymentFailure({
      amount: 5000,
      paymentMethod: 'UPI',
      failureCode: failureCode || 'BANK_TIMEOUT',
      bankSuccessRate: 69,
      recentSimilarFailures: 17,
      customerPreviousRetryCount: 0,
      customerName: 'Amit Sharma',
    });

    if (!alive()) return;
    setDiagnosis(diagResult);
    addLog('✓', 'Root cause identified: Temporary bank degradation (94% confidence)', 'ai');
    addLog('📊', 'Recovery probability: 87% — Expected Value: ₹4,350', 'info');

    if (!await gs(500)) return;

    // ── STEP 03: Recovery Decision (4 s) ────────────────────────────────────
    if (!alive()) return;
    setSimState('step3_decision');
    addLog('⚡', 'Evaluating candidate recovery strategies...', 'action');

    if (!await gs(1400)) return;
    if (!alive()) return;
    addLog('📱', 'WhatsApp 1-click selected: highest yield at 87% (₹4,350)', 'action');

    if (!await gs(1400)) return;
    if (!alive()) return;
    addLog('✓', 'Recovery strategy confirmed — proceeding to policy check', 'success');

    if (!await gs(1200)) return;

    // ── STEP 04: Safety & Policy Check (3.5 s) ──────────────────────────────
    if (!alive()) return;
    setSimState('step4_policy');
    addLog('⚖️', 'Deterministic safety evaluation started...', 'info');

    const polResult = evaluateDeterministicSafetyRules(
      { amount: 5000, paymentMethod: 'UPI', failureCode: failureCode || 'BANK_TIMEOUT',
        bankSuccessRate: 69, recentSimilarFailures: 17, customerPreviousRetryCount: 0 },
      diagResult,
      activeGuardrails // ACTIVE merchant guardrails drive the cosmetic thresholds
    );
    setPolicy(polResult);

    // Truthful per-check log lines derived from the (active-guardrail-aware)
    // deterministic result — icon/type reflect real pass/fail, no hardcoded verdict.
    const logCheck = (idx: number, label: string) => {
      const chk = polResult.checks[idx];
      if (!chk) return;
      addLog(chk.passed ? '✓' : '⚠️', `${label}: ${chk.detail}`, chk.passed ? 'success' : 'warn');
    };

    if (!await gs(700)) return;
    if (!alive()) return;
    logCheck(0, 'Amount limit');

    if (!await gs(600)) return;
    if (!alive()) return;
    logCheck(3, 'Duplicate prevention');

    if (!await gs(600)) return;
    if (!alive()) return;
    logCheck(1, 'Retry budget');

    if (!await gs(600)) return;
    if (!alive()) return;
    logCheck(4, 'Customer contact');

    if (!await gs(600)) return;
    if (!alive()) return;
    logCheck(2, 'Recovery probability');

    if (!await gs(600)) return;
    if (!alive()) return;
    addLog(
      polResult.isApproved ? '🟢' : polResult.isStopped ? '🛑' : '🟡',
      polResult.statusText,
      polResult.isApproved ? 'success' : 'warn'
    );

    if (!await gs(800)) return;

    // ── STEP 05: WhatsApp Recovery — WAITS for customer action ──────────────
    if (!alive()) return;
    setSimState('step5_whatsapp_prep');
    addLog('📱', 'Generating secure 1-click WhatsApp recovery token...', 'action');

    if (!await gs(900)) return;
    if (!alive()) return;
    setSimState('step5_whatsapp_approved');
    addLog('✓', 'Recovery message approved & token generated', 'info');

    if (!await gs(700)) return;
    if (!alive()) return;
    setSimState('step5_whatsapp_sent');
    addLog('📱', 'WhatsApp recovery message dispatched to +91 98765 43210', 'action');

    if (!await gs(900)) return;
    if (!alive()) return;
    setSimState('step5_whatsapp_delivered');
    addLog('✓', 'Message delivered to device', 'info');

    if (!await gs(900)) return;
    if (!alive()) return;
    setSimState('step5_whatsapp_read');
    addLog('✓', 'Customer opened WhatsApp recovery message', 'success');
    addLog('⏳', 'Waiting for customer to click Pay ₹5,000...', 'info');
    // STOP — wait for explicit customer action (handleCustomerPayViaWhatsApp)
  };

  // ─── ENTRY POINTS ───────────────────────────────────────────────────────────

  const launchRecoveryFlow = (code: string, description: string) => {
    // Abort any running flow
    abortRef.current = true;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];

    // New execution ID
    const runId = `run-${Date.now()}`;
    execIdRef.current = runId;
    abortRef.current = false;
    hasScrolledRef.current = false;

    setSimState('checkout_processing');
    setCheckoutStatusText('Payment failed — ReviveAI is analyzing the failure...');

    // Brief visual pause before starting the pipeline
    const t = setTimeout(() => runRecoveryWorkflow(runId, code, description), 1200);
    timeoutsRef.current.push(t);
  };

  const startSimulation = async () => {
    if (simState !== 'idle' && simState !== 'step7_recovered') return;

    // Abort any running flow and create fresh state
    abortRef.current = true;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    abortRef.current = false;
    failureHandledRef.current = false;
    hasScrolledRef.current = false;

    setLogs([]);
    setDiagnosis(null);
    setPolicy(null);
    setAiProgressIndex(0);
    setVerificationProgress(0);
    setInspectedStepOverride(null);
    setRecoveryCaseId(null);
    setBackendGuardrail(null);

    setSimState('checkout_processing');
    setCheckoutStatusText('Creating secure payment...');
    addLog('🛒', 'Creating secure checkout session...', 'info');

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: 5000,
          customerName: 'Amit Sharma',
          customerEmail: 'amit.sharma@gmail.com',
          customerPhone: '9876543210',
        }),
      });

      if (!res.ok) throw new Error(`Backend responded with ${res.status}`);

      const { orderId, amount, keyId } = await res.json();
      if (!orderId || !keyId) throw new Error('Invalid checkout data from server');

      addLog('✓', `Razorpay order created: ${orderId}`, 'success');
      setCheckoutStatusText('Opening Razorpay Checkout...');
      addLog('💳', 'Loading Razorpay secure payment frame...', 'info');

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Failed to load Razorpay checkout script');

      const options = {
        key: keyId,
        amount,
        currency: 'INR',
        name: 'ReviveAI',
        description: 'Noise-Cancelling Headphones',
        order_id: orderId,
        prefill: { name: 'Amit Sharma', email: 'amit.sharma@gmail.com', contact: '+919876543210' },
        theme: { color: '#4f46e5' },
        handler: (response: any) => {
          // SUCCESS: payment captured — no recovery needed
          addLog('✓', `Payment successful: ${response.razorpay_payment_id}`, 'success');
          addLog('🟢', 'Initial payment completed. No recovery required.', 'success');
          // Reset logs display after a moment so UI feels clean
          const t = setTimeout(() => setSimState('idle'), 2000);
          timeoutsRef.current.push(t);
        },
        modal: {
          ondismiss: () => {
            if (failureHandledRef.current) return; // payment.failed already handled this
            failureHandledRef.current = true;
            addLog('⚠️', 'Customer dismissed Razorpay checkout.', 'warn');
            launchRecoveryFlow('USER_CANCELLED', 'Customer dismissed checkout');
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', async (resp: any) => {
        if (failureHandledRef.current) return; // ondismiss already fired — ignore
        failureHandledRef.current = true;
        const failureCode = resp.error?.code || 'BANK_TIMEOUT';
        const failureReason = resp.error?.description || 'Payment failed';
        addLog('❌', `Payment failed: ${failureReason} (${failureCode})`, 'warn');
        // Close the modal before launching recovery pipeline
        rzp.close();

        const paymentId =
          resp.error?.metadata?.payment_id || `failed_${orderId}`;
        try {
          const bridgeRes = await fetch('/api/recovery/failures', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentId,
              orderId,
              amount: amount / 100,
              customer: {
                name: 'Amit Sharma',
                email: 'amit.sharma@gmail.com',
                phone: '9876543210',
              },
              failureCode,
              failureReason,
            }),
          });
          if (bridgeRes.ok) {
            const data = await bridgeRes.json();
            if (data.caseId) {
              setRecoveryCaseId(data.caseId);
              addLog('🔗', `Recovery case synchronized: ${data.caseId}`, 'success');
            }
          } else {
            addLog(
              '⚠️',
              'Backend sync unavailable — continuing with local recovery workflow',
              'warn'
            );
          }
        } catch {
          addLog(
            '⚠️',
            'Backend sync unavailable — continuing with local recovery workflow',
            'warn'
          );
        }

        launchRecoveryFlow(failureCode, failureReason);
      });

      rzp.open();
    } catch (err: any) {
      console.error('[ReviveAI] Razorpay error:', err.message);
      addLog('⚠️', `Razorpay unavailable: ${err.message}`, 'warn');
      addLog('⚠️', 'Falling back to Sandbox Simulator...', 'warn');
      // Sandbox fallback: jump straight into recovery pipeline
      launchRecoveryFlow('BANK_TIMEOUT', 'Temporary Bank Gateway Timeout');
    }
  };

  // Customer clicks "Pay ₹5,000" inside the simulated WhatsApp message
  const handleCustomerPayViaWhatsApp = () => {
    if (
      simState !== 'step5_whatsapp_read' &&
      simState !== 'step5_whatsapp_delivered' &&
      simState !== 'step5_whatsapp_sent'
    ) return;

    const runId = execIdRef.current; // capture current run

    setSimState('step5_customer_paying');
    addLog('💳', 'Customer initiated payment of ₹5,000 via WhatsApp recovery link...', 'action');

    // Step 06 sequence — guarded by same runId
    (async () => {
      const gs = (ms: number) => guardedSleep(ms, runId);
      const alive = () => execIdRef.current === runId && !abortRef.current;

      if (!await gs(1400)) return;
      if (!alive()) return;
      setSimState('step5_customer_paid');
      addLog('✓', 'Customer authorized ₹5,000 UPI payment', 'success');

      if (!await gs(900)) return;
      if (!alive()) return;

      // ── STEP 06: Payment Verification (4.5 s) ─────────────────────────────
      setSimState('step6_verification');
      setVerificationProgress(1);
      addLog('⏳', 'Payment received — initiating verification...', 'info');

      if (!await gs(900)) return;
      if (!alive()) return;
      setVerificationProgress(2);
      addLog('🔐', 'Validating payment signature (SHA256 HMAC)...', 'info');

      if (!await gs(900)) return;
      if (!alive()) return;
      setVerificationProgress(3);
      addLog('🔗', 'Matching original failed order #ORD-92831...', 'info');

      if (!await gs(900)) return;
      if (!alive()) return;
      setVerificationProgress(4);
      addLog('💰', 'Amount confirmed: ₹5,000 = ₹5,000', 'info');

      if (!await gs(900)) return;
      if (!alive()) return;
      addLog('✓', 'Payment verified and amount matched successfully', 'success');

      if (!await gs(800)) return;
      if (!alive()) return;

      // ── STEP 07: Revenue Recovered ─────────────────────────────────────────
      setSimState('step7_recovered');
      addLog('💰', '₹5,000 recovered and settled to merchant balance!', 'success');

      // Update global dashboard — called exactly once
      completeRecovery({
        paymentId: 'pay_92831',
        customerName: 'Amit Sharma',
        customerEmail: 'amit.sharma@gmail.com',
        amount: 5000,
        failureReason: 'Temporary Bank Degradation (504)',
        strategy: 'WhatsApp Recovery',
        aiConfidence: 94,
        recoveryProbability: 87,
      });
    })();
  };

  const handleReset = () => {
    abortRef.current = true;
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
    execIdRef.current = '';
    failureHandledRef.current = false;
    hasScrolledRef.current = false;
    abortRef.current = false;
    setSimState('idle');
    setLogs(INITIAL_SYSTEM_LOGS);
    setDiagnosis(null);
    setPolicy(null);
    setAiProgressIndex(0);
    setVerificationProgress(0);
    setInspectedStepOverride(null);
    setCheckoutStatusText('Processing payment...');
    setRecoveryCaseId(null);
    setBackendGuardrail(null);
  };

  // Determine current active pipeline stage (1-7)
  const getCurrentStepNumber = (): number => {
    if (simState === 'idle' || simState === 'checkout_processing') {
      return 1;
    }
    if (simState === 'payment_failed' || simState === 'step1_detection') return 1;
    if (simState === 'step2_diagnosis') return 2;
    if (simState === 'step3_decision') return 3;
    if (simState === 'step4_policy') return 4;
    if (
      simState.startsWith('step5_') ||
      simState === 'step5_customer_paying' ||
      simState === 'step5_customer_paid'
    )
      return 5;
    if (simState === 'step6_verification') return 6;
    if (simState === 'step7_recovered') return 7;
    return 1;
  };

  const currentStep = getCurrentStepNumber();
  const displayedDetailStep = inspectedStepOverride ?? currentStep;

  // ── Step-04 policy view: active guardrails + authoritative verdict ──────────
  // The checklist renders from the config-aware client policy result; the result
  // banner PREFERS the real backend verdict (status_text) once the case syncs, so
  // it never contradicts the actual server decision.
  const modeLabel =
    activeGuardrails.agentMode === 'auto_recover'
      ? 'Auto Recover'
      : activeGuardrails.agentMode === 'review_first'
      ? 'Review First'
      : 'Manual Only';
  const step4Checks = policy?.checks ?? null;
  const rawVerdict = backendGuardrail ?? policy?.statusText ?? null;
  const verdictClean = rawVerdict ? rawVerdict.replace(/^[^\p{L}\p{N}]+/u, '').trim() : null;
  const verdictTone: 'ok' | 'stop' | 'review' = rawVerdict
    ? /APPROVED/i.test(rawVerdict)
      ? 'ok'
      : /STOP|HALT/i.test(rawVerdict)
      ? 'stop'
      : 'review'
    : 'ok';
  const verdictSource = backendGuardrail ? 'Backend policy engine' : policy ? 'Local simulation' : null;

  const isStepActive = (stepNum: number) => {
    if (simState === 'idle' || simState === 'checkout_processing') {
      return false; // In clean initial state, no step is actively processing failure recovery yet
    }
    switch (stepNum) {
      case 1:
        return simState === 'step1_detection' || simState === 'payment_failed';
      case 2:
        return simState === 'step2_diagnosis';
      case 3:
        return simState === 'step3_decision';
      case 4:
        return simState === 'step4_policy';
      case 5:
        return (
          simState.startsWith('step5_whatsapp') ||
          simState === 'step5_customer_paying' ||
          simState === 'step5_customer_paid'
        );
      case 6:
        return simState === 'step6_verification';
      case 7:
        return simState === 'step7_recovered';
      default:
        return false;
    }
  };

  const isStepCompleted = (stepNum: number) => {
    if (simState === 'idle' || simState === 'checkout_processing') {
      return false;
    }
    const states: SimulationState[] = [
      'idle',
      'checkout_processing',
      'payment_failed',
      'step1_detection',
      'step2_diagnosis',
      'step3_decision',
      'step4_policy',
      'step5_whatsapp_prep',
      'step5_whatsapp_approved',
      'step5_whatsapp_sent',
      'step5_whatsapp_delivered',
      'step5_whatsapp_read',
      'step5_customer_paying',
      'step5_customer_paid',
      'step6_verification',
      'step7_recovered',
    ];
    const currentIndex = states.indexOf(simState);

    const stepCompleteIndex: Record<number, number> = {
      1: states.indexOf('step2_diagnosis'),
      2: states.indexOf('step3_decision'),
      3: states.indexOf('step4_policy'),
      4: states.indexOf('step5_whatsapp_prep'),
      5: states.indexOf('step6_verification'),
      6: states.indexOf('step7_recovered'),
      7: states.indexOf('step7_recovered'),
    };

    if (stepNum === 7) {
      return simState === 'step7_recovered';
    }

    return currentIndex >= (stepCompleteIndex[stepNum] ?? 999);
  };

  // Step definitions for the compact 7-step horizontal pipeline
  const pipelineSteps = [
    { num: 1, name: 'Detection', short: '01 Detection', icon: AlertCircle },
    { num: 2, name: 'Diagnosis', short: '02 Diagnosis', icon: BrainCircuit },
    { num: 3, name: 'Decision', short: '03 Decision', icon: Zap },
    { num: 4, name: 'Policy', short: '04 Policy', icon: ShieldCheck },
    { num: 5, name: 'WhatsApp', short: '05 WhatsApp', icon: Smartphone },
    { num: 6, name: 'Verify', short: '06 Verify', icon: CheckCircle2 },
    { num: 7, name: 'Recovered', short: '07 Recovered', icon: Award },
  ];

  // Helper to get step status text dynamically
  const getStepStatusLabel = (stepNum: number) => {
    if (simState === 'idle' || simState === 'checkout_processing') {
      return stepNum === 1 ? 'Waiting' : 'Pending';
    }
    if (isStepCompleted(stepNum)) {
      return 'Completed';
    }
    if (isStepActive(stepNum)) {
      if (stepNum === 1) return 'Active';
      if (stepNum === 2) return 'AI Analyzing';
      if (stepNum === 3) return 'Active';
      if (stepNum === 4) return 'Active';
      if (stepNum === 5) return 'Active';
      if (stepNum === 6) return 'Verifying';
      if (stepNum === 7) return 'Recovered';
      return 'Active';
    }
    return 'Pending';
  };

  return (
    <div id="recovery-control-page" className="space-y-5 pb-16">
      {/* ========================================================================= */}
      {/* 1. TOP HERO AREA (Compact, High-Precision Fintech Header) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-md bg-blue-50 text-blue-600">
              <Zap className="w-3.5 h-3.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-900 tracking-tight">Command Center</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">Autonomous AI recovery in real time</p>
            </div>
          </div>
        </div>

        {/* Right Header Status & Action Controls */}
        <div className="flex items-center gap-3">
          {/* Agent Status Pill */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  simState === 'step7_recovered'
                    ? 'bg-emerald-400'
                    : simState !== 'idle' && simState !== 'checkout_processing'
                    ? 'bg-indigo-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  simState === 'step7_recovered'
                    ? 'bg-emerald-400'
                    : simState !== 'idle' && simState !== 'checkout_processing'
                    ? 'bg-indigo-400'
                    : 'bg-emerald-400'
                }`}
              />
            </span>
            <div className="text-left">
              <div className="text-[10px] font-semibold tracking-wider uppercase font-mono text-gray-700 flex items-center gap-1">
                {simState === 'step7_recovered' ? (
                  <span className="text-emerald-600">✓ RECOVERY COMPLETE</span>
                ) : simState !== 'idle' && simState !== 'checkout_processing' ? (
                  <span className="text-blue-600">● RECOVERY IN PROGRESS</span>
                ) : (
                  <span className="text-emerald-600">● AI AGENT ACTIVE</span>
                )}
              </div>
              <p className="text-[9px] text-gray-400 font-mono leading-none mt-0.5">
                {simState === 'step7_recovered'
                  ? '₹5,000 recovered'
                  : simState !== 'idle' && simState !== 'checkout_processing'
                  ? '₹5,000 payment'
                  : 'Monitoring payment activity'}
              </p>
            </div>
          </div>

          {/* Primary Action Button */}
          {simState === 'idle' ? (
            <button
              id="simulate-payment-failure-btn"
              onClick={startSimulation}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Simulate Payment Failure</span>
            </button>
          ) : simState === 'step7_recovered' ? (
            <button
              id="run-another-simulation-btn"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Run Another Simulation</span>
            </button>
          ) : (
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-3 py-2 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-lg border border-gray-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PAYMENT CONTEXT BAR (Clean Initial State: WAITING FOR PAYMENT) */}
      {/* ========================================================================= */}
      <div
        id="payment-context-bar"
        className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-center text-xs">
          {/* Customer */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-mono block uppercase">Customer</span>
            <span className="font-bold text-slate-900 truncate block mt-0.5">Amit Sharma</span>
          </div>

          {/* Amount */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-mono block uppercase">Amount</span>
            <span className="font-black text-slate-900 font-mono block mt-0.5">₹5,000</span>
          </div>

          {/* Method */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-mono block uppercase">Method</span>
            <span className="font-bold text-indigo-700 font-mono block mt-0.5">UPI (HDFC)</span>
          </div>

          {/* Payment */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-mono block uppercase">Payment</span>
            <span className="font-mono text-slate-700 font-semibold block mt-0.5">
              {simState === 'idle' ? 'Ready' : 'pay_92831'}
            </span>
          </div>

          {/* Status */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-[10px] text-slate-400 font-mono block uppercase">Status</span>
            <span className="block mt-0.5">
              {simState === 'idle' ? (
                <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  WAITING FOR PAYMENT
                </span>
              ) : simState === 'checkout_processing' ? (
                <span className="font-bold text-indigo-600 flex items-center gap-1 animate-pulse font-mono text-[11px]">
                  <RefreshCw className="w-3 h-3 animate-spin" /> {checkoutStatusText}
                </span>
              ) : simState === 'step7_recovered' ? (
                <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  ✓ Recovered
                </span>
              ) : (
                <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-mono text-[11px]">
                  Payment Failed
                </span>
              )}
            </span>
          </div>

          {/* Failure / Outcome */}
          <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 font-mono block uppercase">
                {simState === 'step7_recovered' ? 'Outcome' : 'Failure'}
              </span>
              <span className="font-bold truncate block mt-0.5">
                {simState === 'step7_recovered' ? (
                  <span className="text-emerald-700 font-mono">100% Captured</span>
                ) : simState !== 'idle' && simState !== 'checkout_processing' ? (
                  <span className="text-red-700 font-mono">BANK_TIMEOUT</span>
                ) : (
                  <span className="text-slate-400 font-mono">—</span>
                )}
              </span>
            </div>

            {simState === 'idle' && (
              <button
                id="pay-checkout-button"
                onClick={startSimulation}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shrink-0 font-mono shadow-xs"
              >
                Pay ₹5,000
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* WORKFLOW CONTAINER (Target of smooth autoscroll when payment fails) */}
      {/* ========================================================================= */}
      <div ref={workflowRef} className="space-y-5">
        {/* ========================================================================= */}
        {/* 3. CONNECTED 7-STEP COMPACT PIPELINE (Horizontal Stepper) */}
        {/* ========================================================================= */}
        <div
          id="connected-7-step-pipeline"
          className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <div className="flex items-center gap-3">
              <h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Recovery Pipeline</h2>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono">7 stages</span>
            </div>
            <div className="text-[10px] text-gray-400 font-mono">
              {simState === 'idle' ? (
                <span className="text-gray-500">Standing by</span>
              ) : inspectedStepOverride ? (
                <button
                  onClick={() => setInspectedStepOverride(null)}
                  className="text-blue-600 hover:underline font-semibold cursor-pointer"
                >
                  ← Return to live step
                </button>
              ) : (
                <span>Step {currentStep} of 7 active</span>
              )}
            </div>
          </div>

          {/* Stepper — horizontal, open, no inner card */}
          <div className="px-5 py-5 overflow-x-auto scrollbar-none">
            <div className="min-w-[680px] flex items-start justify-between relative">
              {pipelineSteps.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = isStepCompleted(step.num);
                const isActive = isStepActive(step.num);
                const isInspected = displayedDetailStep === step.num;
                const isNext = idx < pipelineSteps.length - 1;
                const statusLabel = getStepStatusLabel(step.num);

                return (
                  <React.Fragment key={step.num}>
                    <div
                      onClick={() => setInspectedStepOverride(step.num)}
                      className={`flex flex-col items-center gap-2 cursor-pointer group transition-all z-10 select-none ${
                        isInspected ? 'scale-105' : ''
                      }`}
                    >
                      {/* Step circle */}
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                          isCompleted
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : isActive
                            ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 ring-4 ring-blue-100'
                            : isInspected
                            ? 'bg-gray-800 text-white'
                            : 'bg-gray-100 text-gray-400 border border-gray-200 group-hover:border-gray-300 group-hover:text-gray-600'
                        }`}
                      >
                        {isCompleted ? (
                          <Check className="w-4 h-4 stroke-[2.5]" />
                        ) : isActive ? (
                          <StepIcon className="w-4 h-4" />
                        ) : (
                          <span className="font-mono">{step.num}</span>
                        )}
                      </div>

                      <div className="text-center min-w-[72px]">
                        <div className={`text-[11px] font-semibold whitespace-nowrap ${
                          isActive ? 'text-blue-600'
                          : isCompleted ? 'text-emerald-600'
                          : isInspected ? 'text-gray-900'
                          : 'text-gray-400 group-hover:text-gray-700'
                        }`}>
                          {step.name}
                        </div>
                        <div className="text-[9px] mt-0.5">
                          {isCompleted ? (
                            <span className="text-emerald-500 font-semibold">Done</span>
                          ) : isActive ? (
                            <span className="text-blue-500 font-semibold flex items-center justify-center gap-1">
                              <span className="w-1 h-1 rounded-full bg-blue-500 animate-ping inline-block" />
                              {statusLabel}
                            </span>
                          ) : (
                            <span className="text-gray-300">{statusLabel}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isNext && (
                      <div className="flex-1 mx-1 h-px bg-gray-200 relative mt-[18px]">
                        <div
                          className={`h-full transition-all duration-700 ${
                            isStepCompleted(step.num + 1) || isStepActive(step.num + 1)
                              ? 'bg-emerald-400 w-full'
                              : isStepCompleted(step.num)
                              ? 'bg-blue-300 w-1/2'
                              : 'w-0'
                          }`}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. MAIN CONTENT AREA: ACTIVE STEP DETAIL + STICKY LIVE AGENT ACTIVITY */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ========================================================================= */}
          {/* LEFT COLUMN: ACTIVE STEP DETAIL PANEL (7 Cols) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-7 space-y-4">
            <div
              id="active-step-detail-panel"
              className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm min-h-[460px] flex flex-col justify-between transition-all"
            >
              {/* Top Step Card Header */}
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-semibold text-xs flex items-center justify-center font-mono">
                      {simState === 'idle' ? '—' : `${displayedDetailStep}`}
                    </div>
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-blue-600">
                        {simState === 'idle' ? 'System Ready' : `Step ${displayedDetailStep} of 7`}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 tracking-tight">
                        {simState === 'idle'
                          ? 'Waiting for Payment Transaction'
                          : simState === 'checkout_processing'
                          ? 'Payment Ingest — Processing'
                          : displayedDetailStep === 1
                          ? 'Payment Failure Detected'
                          : displayedDetailStep === 2
                          ? 'AI Root Cause Diagnosis'
                          : displayedDetailStep === 3
                          ? 'Recovery Strategy Decision'
                          : displayedDetailStep === 4
                          ? 'Safety & Policy Check'
                          : displayedDetailStep === 5
                          ? 'WhatsApp Recovery — Customer Action'
                          : displayedDetailStep === 6
                          ? 'Payment Verification'
                          : 'Revenue Recovered'}
                      </h3>
                    </div>
                  </div>

                  {simState !== 'idle' && (
                    <button
                      id="open-drilldown-modal-btn"
                      onClick={() => setSelectedDrillDownStep(displayedDetailStep)}
                      className="px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-200"
                    >
                      <span>Full Telemetry</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* DYNAMIC CONTENT PER STEP */}
                <div className="py-5">
                  {/* ------------------------------------------------------------- */}
                  {/* CLEAN INITIAL IDLE STATE (Before user clicks Pay) */}
                  {/* ------------------------------------------------------------- */}
                  {simState === 'idle' && (
                    <div className="space-y-4">
                      {/* Ready Banner */}
                      <div className="p-5 rounded-2xl bg-indigo-50/70 border border-indigo-100 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold tracking-wide text-indigo-950 font-mono">
                              AUTONOMOUS AGENT ACTIVE & LISTENING
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-white text-indigo-700 text-[10px] font-bold font-mono border border-indigo-200">
                            Zero Failures
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          The autonomous recovery engine is standing by. When customer Amit Sharma initiates a payment that fails due to bank gateway issues, ReviveAI will instantly detect, diagnose root cause with Gemini, verify policy guardrails, and execute high-converting WhatsApp recovery.
                        </p>
                      </div>

                      {/* Simulated Customer Checkout Card */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <ShoppingBag className="w-4 h-4 text-indigo-600" />
                            <span>Simulate Customer Transaction</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">Order #ORD-92831</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                            <span className="text-[10px] text-slate-400 uppercase font-mono block">Item</span>
                            <span className="font-semibold text-slate-800">Noise-Cancelling Headphones</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                            <span className="text-[10px] text-slate-400 uppercase font-mono block">Amount</span>
                            <span className="font-black text-slate-900 font-mono">₹5,000</span>
                          </div>
                        </div>

                        <button
                          id="idle-pay-5000-button"
                          onClick={startSimulation}
                          className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer font-mono"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>Pay ₹5,000 (Simulate Payment & Failure)</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* PROCESSING STATE */}
                  {/* ------------------------------------------------------------- */}
                  {simState === 'checkout_processing' && (
                    <div className="space-y-4 py-8 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto animate-bounce">
                        <RefreshCw className="w-6 h-6 animate-spin" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 font-mono">{checkoutStatusText}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          {checkoutStatusText.includes('failed')
                            ? 'Initiating intelligent recovery triage...'
                            : 'Communicating with HDFC UPI Intent Rail for ₹5,000 (Order #ORD-92831)...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* STEP 01 DETAIL: Detection (Shown only AFTER failure!) */}
                  {/* ------------------------------------------------------------- */}
                  {displayedDetailStep === 1 && simState !== 'idle' && simState !== 'checkout_processing' && (
                    <div className="space-y-4">
                      {/* Failure Banner */}
                      <div className="p-4 rounded-xl bg-red-50/90 border border-red-200 text-red-900 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
                            <span className="text-xs font-black tracking-wide text-red-700 font-mono">
                              FAILURE CODE: BANK_TIMEOUT
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-red-200 text-red-800 text-[10px] font-bold font-mono">
                            Gateway 504
                          </span>
                        </div>
                        <div className="text-base font-black text-red-700 font-mono">
                          ❌ PAYMENT FAILED — ₹5,000 NOT CAPTURED
                        </div>
                        <p className="text-xs text-red-800 leading-relaxed">
                          The issuing bank gateway exceeded the 15,000ms SLA timeout. Funds were neither debited nor captured by Razorpay.
                        </p>
                      </div>

                      {/* Telemetry Grid */}
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[10px] uppercase font-mono block">Gateway Node</span>
                          <span className="font-semibold text-slate-800">Razorpay Node #04</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[10px] uppercase font-mono block">Issuer Rail</span>
                          <span className="font-semibold text-indigo-700 font-mono">HDFC UPI Intent</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[10px] uppercase font-mono block">Ingestion Source</span>
                          <span className="font-mono text-slate-700">Webhook Event Stream</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                          <span className="text-slate-400 text-[10px] uppercase font-mono block">Merchant Order</span>
                          <span className="font-mono text-slate-700">#ORD-92831 (Headphones)</span>
                        </div>
                      </div>

                      {/* Event Timeline snippet */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                        <div className="flex items-center gap-2.5 text-slate-700">
                          <span className="font-mono text-[10px] text-slate-400">10:41:00</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span>Customer initiated payment via UPI</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-red-700 font-semibold">
                          <span className="font-mono text-[10px] text-red-400">10:41:02</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          <span>Payment failed (BANK_TIMEOUT) — Webhook ingested by ReviveAI</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* STEP 02 DETAIL: AI Diagnosis */}
                  {/* ------------------------------------------------------------- */}
                  {displayedDetailStep === 2 && (
                    <div className="space-y-4">
                      {/* Gemini Reasoning Engine Active */}
                      {!diagnosis && simState === 'step2_diagnosis' ? (
                        <div className="p-4 rounded-xl bg-slate-900 text-slate-100 border border-slate-800 space-y-3 font-mono text-xs shadow-inner">
                          <div className="flex items-center justify-between text-indigo-400 font-bold pb-2 border-b border-slate-800">
                            <span className="flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                              GEMINI IS ANALYZING PAYMENT TELEMETRY...
                            </span>
                            <span className="text-[10px] text-slate-500">Live Synthesis</span>
                          </div>
                          <div className="space-y-2">
                            {AI_DIAGNOSIS_STEPS.slice(0, aiProgressIndex).map((stepText, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-slate-300">
                                <span className="text-emerald-400 font-bold">✓</span>
                                <span>{stepText}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Revealed Diagnostic Metrics */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                              <span className="text-[10px] text-amber-700 font-mono block uppercase font-bold">
                                Root Cause
                              </span>
                              <span className="text-xs font-black text-amber-900 block mt-0.5">
                                Temporary Bank Degradation
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                              <span className="text-[10px] text-emerald-700 font-mono block uppercase font-bold">
                                Gemini Confidence
                              </span>
                              <span className="text-sm font-black text-emerald-800 font-mono block mt-0.5">
                                94%
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200">
                              <span className="text-[10px] text-indigo-700 font-mono block uppercase font-bold">
                                Recovery Probability
                              </span>
                              <span className="text-sm font-black text-indigo-800 font-mono block mt-0.5">
                                87%
                              </span>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-900 text-white border border-slate-800">
                              <span className="text-[10px] text-slate-400 font-mono block uppercase font-bold">
                                Expected Recovery
                              </span>
                              <span className="text-sm font-black text-emerald-400 font-mono block mt-0.5">
                                ₹4,350
                              </span>
                            </div>
                          </div>

                          {/* Telemetry Evidence Bullet Cards */}
                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs text-slate-700">
                            <div className="flex items-center gap-2 font-bold text-slate-900 font-mono text-[11px]">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Telemetry Evidence Synthesized by Gemini</span>
                            </div>
                            <div className="space-y-1.5 pt-1">
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-amber-500 font-bold">📉</span>
                                <span><strong>Bank success rate dropped 31%:</strong> HDFC issuer node dropped to 69% in the last 15 minutes.</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-indigo-500 font-bold">📊</span>
                                <span><strong>17 similar failures:</strong> Clustered failure signature matched 17 simultaneous timeout events.</span>
                              </div>
                              <div className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                                <span className="text-emerald-500 font-bold">👤</span>
                                <span><strong>Customer retry count = 0:</strong> Intent is intact without retry fatigue.</span>
                              </div>
                            </div>
                          </div>

                          {/* AI Reasoning Quote */}
                          <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950 space-y-1">
                            <span className="font-bold font-mono uppercase text-[10px] text-indigo-700 block">
                              AI Diagnostic Reasoning:
                            </span>
                            <p className="leading-relaxed text-slate-700">
                              "Recent bank success-rate degradation and clustered failures indicate a temporary issuer issue rather than hard customer decline."
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* STEP 03 DETAIL: Recovery Decision */}
                  {/* ------------------------------------------------------------- */}
                  {displayedDetailStep === 3 && (
                    <div className="space-y-4">
                      <p className="text-xs text-slate-600">
                        ReviveAI evaluated candidate interventions to maximize expected recovery yield:
                      </p>

                      {/* Candidate Strategies Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">1. Retry Now</span>
                            <span className="text-[10px] text-slate-400">Immediate re-execution</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-slate-700 block">42%</span>
                            <span className="text-[10px] text-slate-400">₹2,100</span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">2. Delayed Retry</span>
                            <span className="text-[10px] text-slate-400">Auto-retry after 15m</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-slate-700 block">81%</span>
                            <span className="text-[10px] text-slate-400">₹4,050</span>
                          </div>
                        </div>

                        {/* SELECTED STRATEGY (Visually Dominant) */}
                        <div className="sm:col-span-2 p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 text-emerald-950 shadow-xs relative">
                          <span className="text-[9px] font-black uppercase text-emerald-800 bg-emerald-200 px-2 py-0.5 rounded absolute top-2 right-2 font-mono">
                            ✓ SELECTED
                          </span>
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center gap-1.5 font-black text-sm text-emerald-950">
                                <span>📱</span>
                                <span>3. WhatsApp Recovery</span>
                              </div>
                              <p className="text-xs text-emerald-800 mt-1 max-w-md">
                                Interactive 1-click tokenized recovery message sent once bank degradation normalizes.
                              </p>
                            </div>
                            <div className="text-right font-mono mr-16">
                              <span className="text-lg font-black text-emerald-800 block">87%</span>
                              <span className="text-xs font-bold text-emerald-700">₹4,350 Exp</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-slate-200 text-slate-700 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 block">4. Email Recovery</span>
                            <span className="text-[10px] text-slate-400">Standard inbox link</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-slate-700 block">38%</span>
                            <span className="text-[10px] text-slate-400">₹1,900</span>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 flex items-center justify-between opacity-80">
                          <div>
                            <span className="font-bold text-slate-600 block">5. STOP (No Action)</span>
                            <span className="text-[10px] text-slate-400">If prob &lt;30%</span>
                          </div>
                          <div className="text-right font-mono">
                            <span className="font-bold text-slate-500 block">0%</span>
                            <span className="text-[10px] text-slate-400">Preserve Rep</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 text-xs text-indigo-950">
                        <span className="font-bold font-mono text-[10px] text-indigo-700 uppercase block">
                          Strategic Rationale:
                        </span>
                        <p className="text-slate-700 mt-0.5">
                          WhatsApp delivers the highest expected yield (₹4,350) by giving the customer immediate 1-click payment completion without manual re-entry.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* STEP 04 DETAIL: Safety & Policy */}
                  {/* ------------------------------------------------------------- */}
                  {displayedDetailStep === 4 && (
                    <div className="space-y-4">
                      {/* Bounded Autonomy Callout */}
                      <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 space-y-1">
                        <div className="flex items-center gap-1.5 text-gray-700 font-semibold text-xs">
                          <ShieldCheck className="w-4 h-4 text-blue-600" />
                          <span>BOUNDED AUTONOMY GUARANTEE</span>
                        </div>
                        <p className="text-xs text-gray-600">
                          Gemini recommends the action. The deterministic policy engine authorizes execution.
                        </p>
                      </div>

                      {/* Active Merchant Guardrails context (live config) */}
                      <div className="p-2.5 rounded-lg bg-blue-50 border border-blue-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-mono text-blue-800">
                        <span className="font-bold uppercase tracking-wider text-indigo-700">Active Guardrails</span>
                        <span>Auto-limit ₹{activeGuardrails.maxAutoRecoveryAmount.toLocaleString('en-IN')}</span>
                        <span>·</span>
                        <span>Min confidence {Math.round(activeGuardrails.minRecoveryProbability * 100)}%</span>
                        <span>·</span>
                        <span>Max retries {activeGuardrails.maxAutomatedRetries}</span>
                        <span>·</span>
                        <span>Mode {modeLabel}</span>
                      </div>

                      {/* Deterministic Policy Checklist (reflects active guardrails) */}
                      <div className="space-y-2 text-xs">
                        {step4Checks && step4Checks.length > 0 ? (
                          step4Checks.map((chk, i) => (
                            <div
                              key={`p4chk-${i}`}
                              className={`p-2.5 rounded-xl border flex items-center justify-between ${
                                chk.passed
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                  : 'bg-amber-50 border-amber-200 text-amber-900'
                              }`}
                            >
                              <div className="flex items-center gap-2 font-medium">
                                {chk.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                )}
                                <span>{chk.detail || chk.name}</span>
                              </div>
                              <span
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                                  chk.passed
                                    ? 'text-emerald-700 bg-emerald-100'
                                    : 'text-amber-700 bg-amber-100'
                                }`}
                              >
                                {chk.passed ? 'PASSED' : 'REVIEW'}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-mono">
                            Awaiting live deterministic evaluation…
                          </div>
                        )}
                      </div>

                      {/* Result Banner — prefers the authoritative backend verdict once synced */}
                      {verdictClean && (
                        <div
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            verdictTone === 'ok'
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-950'
                              : verdictTone === 'stop'
                              ? 'bg-rose-100 border-rose-300 text-rose-950'
                              : 'bg-amber-100 border-amber-300 text-amber-950'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 animate-pulse ${
                                verdictTone === 'ok'
                                  ? 'bg-emerald-600'
                                  : verdictTone === 'stop'
                                  ? 'bg-rose-600'
                                  : 'bg-amber-600'
                              }`}
                            />
                            <span
                              className="text-xs font-black uppercase tracking-wider font-mono truncate"
                              title={verdictClean}
                            >
                              RESULT: {verdictClean}
                            </span>
                          </div>
                          {verdictSource && (
                            <span className="text-[10px] font-bold font-mono opacity-80 shrink-0 ml-2">
                              {verdictSource === 'Backend policy engine' && recoveryCaseId
                                ? `${verdictSource} · ${recoveryCaseId}`
                                : verdictSource}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* STEP 05 DETAIL: WhatsApp Recovery (Smartphone Frame Sandbox) */}
                  {/* ------------------------------------------------------------- */}
                  {displayedDetailStep === 5 && (
                    <div className="space-y-4">
                      {/* Realistic Smartphone-Style Frame Inside Detail Panel */}
                      <div className="rounded-2xl border border-slate-300 overflow-hidden shadow-md max-w-lg mx-auto">
                        {/* WhatsApp Business Header */}
                        <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-xs">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs shrink-0 ring-1 ring-white/50">
                              RA
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold tracking-tight">ReviveAI</span>
                                <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 text-white flex items-center justify-center text-[9px] font-bold">
                                  ✓
                                </span>
                              </div>
                              <span className="text-[10px] text-emerald-100/90 font-mono block">
                                Verified Business (+91 98765 43210)
                              </span>
                            </div>
                          </div>

                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/20 text-white font-mono font-bold">
                            WhatsApp Sandbox
                          </span>
                        </div>

                        {/* Chat Body */}
                        <div className="p-4 space-y-3 bg-[#EFEAE2] bg-[radial-gradient(#d1d7db_1px,transparent_1px)] [background-size:16px_16px] min-h-[260px] flex flex-col justify-between">
                          <div className="space-y-2.5">
                            {/* Encryption Notice */}
                            <div className="text-center">
                              <span className="inline-block text-[10px] bg-[#FFEECD] text-amber-900/80 px-3 py-0.5 rounded-md shadow-2xs font-medium">
                                🔒 Messages are end-to-end encrypted.
                              </span>
                            </div>

                            {/* Message Date */}
                            <div className="text-center">
                              <span className="text-[9px] uppercase font-bold text-slate-500 bg-white/80 px-2 py-0.5 rounded shadow-2xs">
                                Today
                              </span>
                            </div>

                            {/* Preparing Indicator */}
                            {simState === 'step5_whatsapp_prep' && (
                              <div className="bg-white/90 p-3 rounded-xl shadow-xs text-xs text-slate-600 flex items-center gap-2 animate-pulse">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                                <span>Preparing recovery message with 1-click token...</span>
                              </div>
                            )}

                            {/* WhatsApp Message Bubble */}
                            {simState !== 'step5_whatsapp_prep' && (
                              <div className="bg-white rounded-xl rounded-tl-none p-3.5 shadow-sm border border-slate-200/60 space-y-2 relative animate-fadeIn">
                                <p className="text-xs font-semibold text-slate-900">
                                  Hi Amit 👋
                                </p>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                  Your <span className="font-bold text-slate-900">₹5,000</span> payment couldn't be completed because of a temporary bank issue.
                                </p>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                  The issue has now been resolved.
                                </p>
                                <p className="text-xs text-slate-700 leading-relaxed">
                                  You can safely complete your payment below:
                                </p>

                                {/* Item card embedded in WhatsApp message */}
                                <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                                  <div>
                                    <div className="font-bold text-slate-900 text-[11px]">Wireless Headphones</div>
                                    <div className="text-[10px] text-slate-500 font-mono">Order #ORD-92831</div>
                                  </div>
                                  <div className="font-black text-slate-900 font-mono text-sm">
                                    ₹5,000
                                  </div>
                                </div>

                                {/* INTERACTIVE PAY BUTTON INSIDE WHATSAPP */}
                                <div className="pt-1">
                                  {simState === 'step5_customer_paying' ? (
                                    <button
                                      disabled
                                      className="w-full py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm animate-pulse cursor-wait"
                                    >
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      <span>Processing payment...</span>
                                    </button>
                                  ) : simState === 'step5_customer_paid' || isStepCompleted(5) ? (
                                    <div className="w-full py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm">
                                      <Check className="w-4 h-4 stroke-[3]" />
                                      <span>✓ Payment successful (₹5,000)</span>
                                    </div>
                                  ) : (
                                    <button
                                      id="whatsapp-pay-button"
                                      onClick={handleCustomerPayViaWhatsApp}
                                      className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20bd5a] active:scale-[0.98] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer ring-2 ring-emerald-500/30"
                                    >
                                      <CreditCard className="w-4 h-4" />
                                      <span>Pay ₹5,000</span>
                                    </button>
                                  )}
                                </div>

                                {/* Message Timestamp & Status Ticks */}
                                <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 font-mono pt-1">
                                  <span>{getNowTime().slice(0, 5)}</span>
                                  {simState === 'step5_whatsapp_approved' ? (
                                    <span className="text-slate-400">🕒</span>
                                  ) : simState === 'step5_whatsapp_sent' ? (
                                    <span className="text-slate-400 text-[10px]">✓ Sent</span>
                                  ) : simState === 'step5_whatsapp_delivered' ? (
                                    <span className="text-slate-500 text-[10px] flex items-center gap-0.5">
                                      <CheckCheck className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Delivered</span>
                                    </span>
                                  ) : (
                                    <span className="text-[#53bdeb] text-[10px] font-bold flex items-center gap-0.5">
                                      <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                                      <span>Read</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Interactive prompt hint */}
                            {simState === 'step5_whatsapp_read' && (
                              <div className="p-2 rounded-lg bg-emerald-100 border border-emerald-300 text-[11px] text-emerald-950 font-medium text-center shadow-xs">
                                👆 Click the green <strong>"Pay ₹5,000"</strong> button above to complete recovery.
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* STEP 06 DETAIL: Payment Verification */}
                  {/* ------------------------------------------------------------- */}
                  {displayedDetailStep === 6 && (
                    <div className="space-y-4">
                      {/* Comparison Cards */}
                      <div className="grid grid-cols-3 gap-3 text-center">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] text-slate-400 uppercase font-mono block">Original Failed</span>
                          <span className="text-sm font-black text-slate-700 font-mono">₹5,000</span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] text-emerald-700 uppercase font-mono block">Recovered Amount</span>
                          <span className="text-sm font-black text-emerald-700 font-mono">₹5,000</span>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-600 text-white">
                          <span className="text-[10px] text-emerald-100 uppercase font-mono block">Status</span>
                          <span className="text-sm font-black font-mono">VERIFIED</span>
                        </div>
                      </div>

                      {/* Cryptographic Webhook Verification Steps */}
                      <div className="space-y-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Payment received via official UPI webhook</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            Captured
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Amount matched exactly (₹5,000 = ₹5,000)</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            Matched
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Original failed payment linked (#pay_92831 → #REC-92831)</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            Linked
                          </span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-slate-800">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Transaction verified with SHA256 HMAC signature</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded">
                            Verified
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ------------------------------------------------------------- */}
                  {/* STEP 07 DETAIL: Verified Revenue Recovered (Hero Moment) */}
                  {/* ------------------------------------------------------------- */}
                  {displayedDetailStep === 7 && (
                    <div className="space-y-4">
                      {/* Final Success State Card */}
                      <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white shadow-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-200">
                            ✓ RECOVERY COMPLETE
                          </span>
                          <span className="text-xs font-black bg-white/20 text-white px-2.5 py-1 rounded-full font-mono">
                            STATUS: SUCCESS
                          </span>
                        </div>

                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-black font-mono tracking-tight text-white">
                            ₹5,000
                          </span>
                          <span className="text-sm font-bold uppercase tracking-widest text-emerald-200">
                            RECOVERED
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-emerald-500/50 text-xs">
                          <div>
                            <span className="text-emerald-200 text-[10px] block">Recovery Method:</span>
                            <span className="font-bold text-white">WhatsApp</span>
                          </div>
                          <div>
                            <span className="text-emerald-200 text-[10px] block">Recovery Time:</span>
                            <span className="font-bold text-white font-mono">10m 04s</span>
                          </div>
                          <div>
                            <span className="text-emerald-200 text-[10px] block">Verification:</span>
                            <span className="font-bold text-white font-mono">Payment Verified</span>
                          </div>
                        </div>
                      </div>

                      {/* Settlement Confirmation */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs text-slate-700">
                        <div className="font-bold text-slate-900 uppercase font-mono text-[10px]">
                          Merchant Ledger Status
                        </div>
                        <p className="leading-relaxed">
                          ✓ ₹5,000 has been credited to merchant settlement balance. Customer order #ORD-92831 is marked <strong>FULFILLED</strong> and dispatched to delivery queue.
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                        <button
                          id="view-full-audit-trail-btn"
                          onClick={() => onNavigate('audit-trail')}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold font-mono flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] cursor-pointer"
                        >
                          <FileText className="w-4 h-4 text-emerald-400" />
                          <span>View Immutable Audit Trail</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={handleReset}
                          className="py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold font-mono flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Run Another Simulation</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>ReviveAI Autonomous OS</span>
                {simState !== 'idle' && (
                  <button
                    onClick={() => setSelectedDrillDownStep(displayedDetailStep)}
                    className="text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>Drill-Down</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* RIGHT COLUMN: STICKY LIVE AGENT ACTIVITY PANEL (5 Cols) */}
          {/* ========================================================================= */}
          <div className="lg:col-span-5 space-y-4 sticky top-6">
            {/* LIVE AGENT ACTIVITY — Premium light timeline */}
            <div
              id="live-agent-activity-panel"
              className="bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-[460px]"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                  </span>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                    Agent Activity
                  </h3>
                </div>
                <span className="text-[10px] font-mono text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
                  Gemini 2.5
                </span>
              </div>

              {/* Timeline Stream */}
              <div
                ref={logContainerRef}
                className="flex-1 overflow-y-auto px-5 py-4 space-y-0 max-h-[350px] scrollbar-thin scrollbar-thumb-gray-200"
              >
                {logs.length === 0 ? (
                  <div className="h-44 flex flex-col items-center justify-center text-center">
                    <Bot className="w-7 h-7 text-gray-300 mb-2" />
                    <p className="text-xs font-medium text-gray-400">Agent standing by</p>
                    <p className="text-[11px] text-gray-400 max-w-xs mt-1">
                      Trigger a payment to start the recovery workflow.
                    </p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[6px] top-2 bottom-2 w-px bg-gray-100"></div>
                    <div className="space-y-4">
                      {logs.map((item) => (
                        <div key={item.id} className="flex items-start gap-3 relative">
                          {/* Timeline dot */}
                          <div className={`w-3.5 h-3.5 rounded-full border-2 bg-white mt-0.5 shrink-0 z-10 ${
                            item.type === 'success' ? 'border-emerald-500'
                            : item.type === 'warn' ? 'border-amber-500'
                            : item.type === 'ai' ? 'border-blue-500'
                            : item.type === 'action' ? 'border-violet-500'
                            : 'border-gray-300'
                          }`}></div>
                          <div className="flex-1 min-w-0 pb-1">
                            <span className="text-[9px] text-gray-400 font-mono block mb-0.5">{item.time}</span>
                            <p className={`text-[11px] leading-relaxed ${
                              item.type === 'success' ? 'text-emerald-700'
                              : item.type === 'warn' ? 'text-amber-700'
                              : item.type === 'ai' ? 'text-blue-700'
                              : item.type === 'action' ? 'text-violet-700'
                              : 'text-gray-600'
                            }`}>{item.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* System status footer */}
              <div className="px-5 py-3 border-t border-gray-100 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] text-gray-400 uppercase tracking-wider block">Safety Gate</span>
                  <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                    <ShieldCheck className="w-3 h-3" />
                    Deterministic
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-gray-400 uppercase tracking-wider block">Channel</span>
                  <span className="text-xs font-semibold text-blue-600 flex items-center gap-1 mt-0.5">
                    <MessageSquare className="w-3 h-3" />
                    WhatsApp
                  </span>
                </div>
              </div>
            </div>

            {/* Routing Matrix */}
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <h4 className="text-xs font-semibold text-gray-800 uppercase tracking-wider">
                  Recovery Routing
                </h4>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-600">Temporary Bank Issue</span>
                  <span className="text-emerald-600 font-semibold">WhatsApp 1-Click</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-gray-50">
                  <span className="text-gray-600">Checkout Dropoff</span>
                  <span className="text-blue-600 font-semibold">Payment Link SMS</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-gray-600">Low Probability (&lt;30%)</span>
                  <span className="text-red-500 font-semibold">Stop — No Fatigue</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-Screen Payment Recovery Modal */}
      {fullscreenCheckoutMode === 'recovery' && (
        <FullscreenCheckoutModal
          isOpen={true}
          mode="recovery"
          onClose={() => setFullscreenCheckoutMode(null)}
          onFailInitial={(_code, _desc) => {
            setFullscreenCheckoutMode(null);
          }}
          onPayRecovery={() => {
            setFullscreenCheckoutMode(null);
            handleCustomerPayViaWhatsApp();
          }}
          onLaunchRazorpaySDK={() => {
            setFullscreenCheckoutMode(null);
            startSimulation();
          }}
        />
      )}

      {/* Workflow Step Drill-Down Detail Modal */}
      <WorkflowDetailModal
        stepNumber={selectedDrillDownStep}
        isOpen={selectedDrillDownStep !== null}
        onClose={() => setSelectedDrillDownStep(null)}
        onNavigate={onNavigate}
        simulationRecovered={simState === 'step7_recovered'}
      />
    </div>
  );
};
